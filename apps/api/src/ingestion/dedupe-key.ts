import { createHash } from 'node:crypto'
import type { NormalizedEvent } from '@andina-cargo/shared'

/**
 * Deterministic deduplication key for a normalized event.
 *
 * The canonical representation is a stable JSON of the *normalized* fields
 * (not the raw payload), so the same logical event re-sent by a carrier with
 * free-form differences in the raw payload still yields the same key.
 *
 * `ShipmentEvent.dedupeKey` is `@unique` in Prisma; the ingestion relies on it
 * via `createMany({ skipDuplicates })`.
 */
export function dedupeKey(event: NormalizedEvent): string {
  const canonical = JSON.stringify({
    trackingNumber: event.trackingNumber,
    carrierCode: event.carrierCode,
    occurredAt: event.occurredAt,
    status: event.status,
    city: event.city,
    country: event.country ?? null,
  })
  return createHash('sha256').update(canonical).digest('hex')
}
