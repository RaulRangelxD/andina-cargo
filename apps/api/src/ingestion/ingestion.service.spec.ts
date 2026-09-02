import { ShipmentStatus } from '@andina-cargo/shared'
import { beforeEach, describe, expect, it } from 'vitest'
import { NormalizationService } from '../normalization/normalization.service.js'
import { adapters } from '../normalization/normalization.js'
import { IngestionService } from './ingestion.service.js'

interface FakeShipment {
  id: string
  trackingNumber: string
  carrierId: string
  currentStatus: ShipmentStatus
  currentCity: string
  currentOccurredAt: Date
}

interface FakeEvent {
  dedupeKey: string
  shipmentId: string
  status: ShipmentStatus
  city: string
  occurredAt: Date
}

// In-memory Postgres stand-in used to drive assertions and to model the
// `$transaction` atomicity (snapshot + restore on failure).
function createFakeDb(initial?: { shipments: FakeShipment[]; events: FakeEvent[] }) {
  const state = {
    shipments: [...(initial?.shipments ?? [])],
    events: [...(initial?.events ?? [])],
  }
  let shipmentSeq = 0
  let failCreateManyEvent = false

  const tx = {
    shipment: {
      findMany: async ({
        where,
      }: {
        where: { OR?: Array<{ trackingNumber: string; carrierId: string }> }
      }) => {
        if (!where?.OR) return state.shipments.map((s) => ({ ...s }))
        return state.shipments
          .filter((s) => where.OR!.some((k) => k.trackingNumber === s.trackingNumber && k.carrierId === s.carrierId))
          .map((s) => ({ ...s }))
      },
      createMany: async ({
        data,
        skipDuplicates,
      }: {
        data: Array<{ trackingNumber: string; carrierId: string }>
        skipDuplicates?: boolean
      }) => {
        let created = 0
        for (const d of data) {
          const exists = state.shipments.some(
            (s) => s.trackingNumber === d.trackingNumber && s.carrierId === d.carrierId,
          )
          if (exists && skipDuplicates) continue
          state.shipments.push({
            id: `shipment-${++shipmentSeq}`,
            trackingNumber: d.trackingNumber,
            carrierId: d.carrierId,
            currentStatus: ShipmentStatus.picked_up,
            currentCity: '',
            currentOccurredAt: new Date(0),
          })
          created++
        }
        return { count: created }
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: string; currentOccurredAt: { lt: Date } }
        data: {
          currentStatus: ShipmentStatus
          currentCity: string
          currentOccurredAt: Date
        }
      }) => {
        let updated = 0
        for (const s of state.shipments) {
          if (s.id === where.id && s.currentOccurredAt < where.currentOccurredAt.lt) {
            s.currentStatus = data.currentStatus
            s.currentCity = data.currentCity
            s.currentOccurredAt = new Date(data.currentOccurredAt)
            updated++
          }
        }
        return { count: updated }
      },
    },
    shipmentEvent: {
      createMany: async ({
        data,
        skipDuplicates,
      }: {
        data: Array<{ dedupeKey: string; shipmentId: string; status: ShipmentStatus; city: string; occurredAt: Date }>
        skipDuplicates?: boolean
      }) => {
        if (failCreateManyEvent) {
          throw new Error('simulated DB failure')
        }
        let created = 0
        for (const d of data) {
          const exists = state.events.some((e) => e.dedupeKey === d.dedupeKey)
          if (exists && skipDuplicates) continue
          state.events.push({
            dedupeKey: d.dedupeKey,
            shipmentId: d.shipmentId,
            status: d.status,
            city: d.city,
            occurredAt: new Date(d.occurredAt),
          })
          created++
        }
        return { count: created }
      },
    },
  }

  return {
    state,
    tx,
    client: {
      carrier: {
        findMany: async () => [
          { id: 'carrier-andes-express', code: 'andes-express' },
          { id: 'carrier-trans-bolivar', code: 'trans-bolivar' },
          { id: 'carrier-ruta-sur', code: 'ruta-sur' },
        ],
      },
      $transaction: async (fn: (tx: typeof tx) => Promise<unknown>) => {
        const snapshot = JSON.parse(JSON.stringify(state)) as typeof state
        try {
          return await fn(tx)
        } catch (error) {
          // Rollback to snapshot to emulate atomicity.
          for (const key of Object.keys(state) as Array<keyof typeof state>) {
            ;(state as Record<string, unknown>)[key] = snapshot[key]
          }
          throw error
        }
      },
    },
    setFailCreateManyEvent: (v: boolean) => {
      failCreateManyEvent = v
    },
  }
}

const andesPayload = (guia: string, evento: string, ts: string, ciudad: string) => ({
  guia,
  evento,
  ts,
  ciudad,
})

const rutaPayload = (guia: string, estado: string, fecha: string, lugar: string) => ({
  guia,
  estado,
  fecha,
  lugar,
})

const normalizationService = NormalizationService.forAdapters(adapters)

function buildService(db: ReturnType<typeof createFakeDb>) {
  return new IngestionService(normalizationService, db.client as never)
}

describe('IngestionService', () => {
  let db: ReturnType<typeof createFakeDb>
  let service: IngestionService

  beforeEach(() => {
    db = createFakeDb({
      shipments: [
        {
          id: 'existing-shipment',
          trackingNumber: 'EX-1',
          carrierId: 'carrier-andes-express',
          currentStatus: ShipmentStatus.IN_TRANSIT,
          currentCity: 'Bogotá',
          currentOccurredAt: new Date('2026-08-30T14:22:10.000Z'),
        },
      ],
    })
    service = buildService(db)
  })

  it('persists a valid batch with a single carrier', async () => {
    const result = await service.ingest([
      andesPayload('AC-1', 'RECOGIDO', '2026-08-29T18:00:00Z', 'Bogotá'),
      andesPayload('AC-1', 'EN_TRANSITO', '2026-08-30T14:22:10Z', 'Cúcuta'),
      andesPayload('AC-1', 'ENTREGADO', '2026-08-31T15:40:30Z', 'Cúcuta'),
    ])

    expect(result.received).toBe(3)
    expect(result.created).toBe(3)
    expect(result.duplicates).toBe(0)
    expect(result.rejected).toHaveLength(0)

    // One shipment created with the latest event as current state.
    const shipment = db.state.shipments.find((s) => s.trackingNumber === 'AC-1')!
    expect(shipment.currentStatus).toBe(ShipmentStatus.DELIVERED)
    expect(shipment.currentOccurredAt.toISOString()).toBe('2026-08-31T15:40:30.000Z')
    expect(db.state.events).toHaveLength(3)
  })

  it('invalid events are rejected but the rest of the batch is persisted', async () => {
    const result = await service.ingest([
      andesPayload('AC-1', 'EN_TRANSITO', '2026-08-30T14:22:10Z', 'Cúcuta'),
      andesPayload('AC-1', 'NO_EXISTE', '2026-08-30T14:22:10Z', 'Cúcuta'), // bad status
      { guia: 'AC-1' }, // missing fields -> unsupported/bad
    ])

    expect(result.created).toBe(1)
    expect(result.rejected).toEqual([
      expect.objectContaining({ code: 'UNKNOWN_STATUS', index: 1 }),
      expect.objectContaining({ index: 2 }),
    ])
    expect(db.state.events).toHaveLength(1)
    expect(db.state.events[0].city).toBe('Cúcuta')
  })

  it('deduplicates identical events within the same batch', async () => {
    const payload = andesPayload('AC-1', 'EN_TRANSITO', '2026-08-30T14:22:10Z', 'Cúcuta')
    const result = await service.ingest([payload, payload, payload])

    expect(result.received).toBe(3)
    expect(result.created).toBe(1)
    expect(result.duplicates).toBe(2)
    expect(db.state.events).toHaveLength(1)
  })

  it('skips events already present in the DB (cross-batch dedupe via dedupeKey)', async () => {
    const payload = andesPayload('AC-1', 'EN_TRANSITO', '2026-08-30T14:22:10Z', 'Cúcuta')
    await service.ingest([payload])
    const again = await service.ingest([payload])

    expect(again.created).toBe(0)
    expect(again.duplicates).toBe(1)
    expect(db.state.events).toHaveLength(1)
  })

  it('does not regress current status when events arrive out of order', async () => {
    // EX-1 already has currentOccurredAt = 2026-08-30T14:22:10 delivering.
    const older = andesPayload('EX-1', 'EN_TRANSITO', '2026-08-29T10:00:00Z', 'Bogotá')
    const result = await service.ingest([older])

    expect(result.created).toBe(1)
    const shipment = db.state.shipments.find((s) => s.trackingNumber === 'EX-1')!
    expect(shipment.currentStatus).toBe(ShipmentStatus.IN_TRANSIT)
    expect(shipment.currentOccurredAt.toISOString()).toBe('2026-08-30T14:22:10.000Z')
  })

  it('advances current status when a newer out-of-order event arrives', async () => {
    const newer = andesPayload('EX-1', 'ENTREGADO', '2026-09-01T10:00:00Z', 'Cúcuta')
    const result = await service.ingest([newer])

    expect(result.created).toBe(1)
    expect(result.updatedShipments).toBe(1)
    const shipment = db.state.shipments.find((s) => s.trackingNumber === 'EX-1')!
    expect(shipment.currentStatus).toBe(ShipmentStatus.DELIVERED)
    expect(shipment.currentOccurredAt.toISOString()).toBe('2026-09-01T10:00:00.000Z')
  })

  it('rejects events whose carrier is not registered', async () => {
    const unknownCarrier = { guia: 'X-1', evento: 'EN_TRANSITO', ts: '2026-08-30T14:22:10Z', ciudad: 'Cúcuta' }
    const fake = createFakeDb()
    fake.client.carrier.findMany = async () => [] // no carriers
    const svc = buildService(fake)
    const result = await svc.ingest([unknownCarrier])

    expect(result.rejected).toHaveLength(1)
    expect(result.rejected[0].code).toBe('UNKNOWN_CARRIER')
    expect(result.created).toBe(0)
  })

  it('rolls back the whole batch when persistence fails', async () => {
    db.setFailCreateManyEvent(true)
    await expect(
      service.ingest([
        andesPayload('AC-1', 'EN_TRANSITO', '2026-08-30T14:22:10Z', 'Cúcuta'),
        andesPayload('AC-2', 'ENTREGADO', '2026-08-31T15:40:30Z', 'Bogotá'),
      ]),
    ).rejects.toThrow('simulated DB failure')

    // Nothing persisted: no new shipments, no events.
    expect(db.state.shipments.filter((s) => s.trackingNumber !== 'EX-1')).toHaveLength(0)
    expect(db.state.events).toHaveLength(0)
  })

  it('handles a batch from all three carriers', async () => {
    const result = await service.ingest([
      andesPayload('A-1', 'EN_TRANSITO', '2026-08-30T14:22:10Z', 'Cúcuta'),
      {
        tracking_number: 'T-1',
        status: { label: 'delivered' },
        occurred_at: Math.floor(new Date('2026-08-31T15:40:30Z').getTime() / 1000),
        location: { city: 'Bogotá', country: 'CO' },
      },
      rutaPayload('R-1', 'EnRuta', '30/08/2026 10:22', 'Cali'),
    ])

    expect(result.created).toBe(3)
    expect(result.rejected).toHaveLength(0)
    for (const tracking of ['A-1', 'T-1', 'R-1']) {
      expect(db.state.shipments.some((s) => s.trackingNumber === tracking)).toBe(true)
    }
  })

  it('uses NormalizationError codes for rejected events', async () => {
    const result = await service.ingest([{ tracking_number: 'T-1', status: { label: 'in transit' } }])
    expect(result.rejected[0].code).toBe('MISSING_FIELD')
  })
})
