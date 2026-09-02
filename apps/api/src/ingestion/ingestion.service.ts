import { Injectable } from '@nestjs/common';
import { NormalizationError } from '../normalization/normalization-errors.js';
import { NormalizationService } from '../normalization/normalization.service.js';
import type { NormalizedEvent } from '@andina-cargo/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../db/prisma.service.js';
import { dedupeKey } from './dedupe-key.js';

export interface RejectedEvent {
  index: number;
  code: string;
  trackingNumber?: string;
  message: string;
}

export interface IngestResult {
  received: number;
  created: number;
  duplicates: number;
  updatedShipments: number;
  rejected: RejectedEvent[];
}

interface NormalizedItem {
  index: number;
  event: NormalizedEvent;
  dedupe: string;
}

interface PersistableItem extends NormalizedItem {
  carrierId: string;
}

type Tx = Prisma.TransactionClient;
type ShipmentKey = `${string}::${string}`;

function shipmentKey(carrierId: string, trackingNumber: string): ShipmentKey {
  return `${carrierId}::${trackingNumber}`;
}

function toRejected(itemIndex: number, error: unknown): RejectedEvent {
  if (error instanceof NormalizationError) {
    return {
      index: itemIndex,
      code: error.code,
      trackingNumber: error.trackingNumber,
      message: error.message,
    };
  }
  return {
    index: itemIndex,
    code: 'INTERNAL',
    message: error instanceof Error ? error.message : String(error),
  };
}

@Injectable()
export class IngestionService {
  constructor(
    private readonly normalizationService: NormalizationService,
    private readonly prisma: PrismaService,
  ) {}

  async ingest(rawEvents: unknown[]): Promise<IngestResult> {
    const received = rawEvents.length;
    const rejected: RejectedEvent[] = [];

    // 1) Normalize each event individually; failures are collected, never
    //    discarded as a batch.
    const normalized: NormalizedItem[] = [];
    for (let i = 0; i < rawEvents.length; i++) {
      try {
        const event = this.normalizationService.normalize(rawEvents[i]);
        normalized.push({ index: i, event, dedupe: dedupeKey(event) });
      } catch (error) {
        rejected.push(toRejected(i, error));
      }
    }

    // 2) In-batch deduplication: keep the first occurrence of each dedupeKey.
    const seen = new Set<string>();
    const unique: NormalizedItem[] = [];
    let inBatchDuplicates = 0;
    for (const item of normalized) {
      if (seen.has(item.dedupe)) {
        inBatchDuplicates++;
        continue;
      }
      seen.add(item.dedupe);
      unique.push(item);
    }

    // 3) Resolve carrier code -> id once per batch.
    const carriers = await this.prisma.carrier.findMany({
      select: { id: true, code: true },
    });
    const carrierIdByCode = new Map(carriers.map((c) => [c.code, c.id]));

    const persistable: PersistableItem[] = [];
    for (const item of unique) {
      const carrierId = carrierIdByCode.get(item.event.carrierCode);
      if (!carrierId) {
        rejected.push({
          index: item.index,
          code: 'UNKNOWN_CARRIER',
          trackingNumber: item.event.trackingNumber,
          message: `No carrier registered for code "${item.event.carrierCode}"`,
        });
        continue;
      }
      persistable.push({ ...item, carrierId });
    }

    if (persistable.length === 0) {
      return { received, created: 0, duplicates: inBatchDuplicates, updatedShipments: 0, rejected };
    }

    // 4) Persist atomically.
    const { created, dbDuplicates, updatedShipments } = await this.prisma.$transaction(
      async (tx) => this.persistBatch(tx, persistable),
    );

    return {
      received,
      created,
      duplicates: inBatchDuplicates + dbDuplicates,
      updatedShipments,
      rejected,
    };
  }

  private async persistBatch(
    tx: Tx,
    items: PersistableItem[],
  ): Promise<{ created: number; dbDuplicates: number; updatedShipments: number }> {
    // Per-shipment latest event within this batch (for initial state + advance).
    const latestByKey = new Map<ShipmentKey, PersistableItem>();
    for (const item of items) {
      const key = shipmentKey(item.carrierId, item.event.trackingNumber);
      const current = latestByKey.get(key);
      if (!current || item.event.occurredAt > current.event.occurredAt) {
        latestByKey.set(key, item);
      }
    }

    const shipmentIds = await this.resolveShipments(tx, items, latestByKey);

    const eventRows = items.map((item) => {
      const shipmentKeyStr = shipmentKey(item.carrierId, item.event.trackingNumber);
      const shipmentId = shipmentIds.get(shipmentKeyStr);
      if (!shipmentId) {
        throw new Error(`Internal error: shipment not resolved for ${shipmentKeyStr}`);
      }
      return {
        shipmentId,
        carrierId: item.carrierId,
        status: item.event.status,
        city: item.event.city,
        country: item.event.country,
        occurredAt: new Date(item.event.occurredAt),
        dedupeKey: item.dedupe,
        rawPayload: item.event.rawPayload as Prisma.InputJsonValue,
      };
    });

    const insert = await tx.shipmentEvent.createMany({
      data: eventRows,
      skipDuplicates: true,
    });
    const created = insert.count;
    const dbDuplicates = eventRows.length - created;

    // Advance current* only if the in-batch latest is newer than stored.
    let updatedShipments = 0;
    for (const [key, latest] of latestByKey) {
      const shipmentId = shipmentIds.get(key);
      if (!shipmentId) continue;
      const res = await tx.shipment.updateMany({
        where: {
          id: shipmentId,
          currentOccurredAt: { lt: new Date(latest.event.occurredAt) },
        },
        data: {
          currentStatus: latest.event.status,
          currentCity: latest.event.city,
          currentOccurredAt: new Date(latest.event.occurredAt),
        },
      });
      updatedShipments += res.count;
    }

    return { created, dbDuplicates, updatedShipments };
  }

  private async resolveShipments(
    tx: Tx,
    items: PersistableItem[],
    latestByKey: Map<ShipmentKey, PersistableItem>,
  ): Promise<Map<ShipmentKey, string>> {
    const keys = [...latestByKey.keys()];
    const keyParts = keys.map((key) => {
      const [carrierId, trackingNumber] = key.split('::');
      return { carrierId, trackingNumber };
    });

    // Batch query for existing shipments (single round-trip).
    const existing = await tx.shipment.findMany({
      where: { OR: keyParts.map((k) => ({ trackingNumber: k.trackingNumber, carrierId: k.carrierId })) },
      select: { id: true, trackingNumber: true, carrierId: true },
    });
    const existingIds = new Map<string, string>();
    for (const s of existing) {
      existingIds.set(shipmentKey(s.carrierId, s.trackingNumber), s.id);
    }

    // Create the missing ones in a single batch with their initial current state.
    const toCreate = keys
      .filter((key) => !existingIds.has(key))
      .map((key) => {
        const latest = latestByKey.get(key)!;
        const [carrierId, trackingNumber] = key.split('::');
        return {
          trackingNumber,
          carrierId,
          currentStatus: latest.event.status,
          currentCity: latest.event.city,
          currentOccurredAt: new Date(latest.event.occurredAt),
        };
      });
    if (toCreate.length > 0) {
      await tx.shipment.createMany({ data: toCreate, skipDuplicates: true });
    }

    // Re-fetch to obtain ids for every shipment touched by this batch.
    const all = await tx.shipment.findMany({
      where: { OR: keyParts.map((k) => ({ trackingNumber: k.trackingNumber, carrierId: k.carrierId })) },
      select: { id: true, trackingNumber: true, carrierId: true },
    });
    const ids = new Map<ShipmentKey, string>();
    for (const s of all) {
      ids.set(shipmentKey(s.carrierId, s.trackingNumber), s.id);
    }
    return ids;
  }
}
