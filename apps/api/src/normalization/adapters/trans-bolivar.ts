import type { NormalizedEvent, ShipmentStatus } from '@andina-cargo/shared'
import type { CarrierAdapter } from '../carrier-adapter.js'
import { NormalizationError } from '../normalization-errors.js'
import { isObject, parseUnixSeconds, requireString } from '../helpers.js'
import { transBolivarStatusFromCode, tryMapStatus } from '../status-mapper.js'

/**
 * TransBolívar — nested JSON:
 * {
 *   "tracking_number": "AC-4471",
 *   "status": { "code": 3, "label": "in transit" },
 *   "occurred_at": 1756563730,
 *   "location": { "city": "Cúcuta", "country": "CO" }
 * }
 *
 * Status is resolved from the human-readable `label` first (most reliable),
 * falling back to the numeric `code` table when the label is unknown.
 */
export class TransBolivarAdapter implements CarrierAdapter {
  readonly code = 'trans-bolivar'
  readonly name = 'TransBolívar'

  supports(payload: unknown): boolean {
    return (
      isObject(payload) &&
      typeof payload.tracking_number === 'string' &&
      isObject(payload.status)
    )
  }

  normalize(payload: unknown): NormalizedEvent {
    if (!isObject(payload)) {
      throw new NormalizationError('INVALID_FORMAT', 'Payload is not an object')
    }
    const trackingNumber = requireString(payload, 'tracking_number', this.code)
    const status = this.resolveStatus(payload.status, trackingNumber)
    const location = this.resolveLocation(payload.location, trackingNumber)
    const occurredAt = parseUnixSeconds(payload.occurred_at, this.code, trackingNumber)
    return {
      trackingNumber,
      carrierCode: this.code,
      status,
      occurredAt,
      city: location.city,
      country: location.country,
      rawPayload: payload,
    }
  }

  private resolveStatus(statusRaw: unknown, trackingNumber: string): ShipmentStatus {
    if (!isObject(statusRaw)) {
      throw new NormalizationError('INVALID_FORMAT', 'status must be an object', trackingNumber)
    }
    const fromLabel = tryMapStatus(statusRaw.label)
    if (fromLabel) {
      return fromLabel
    }
    const fromCode = transBolivarStatusFromCode(statusRaw.code)
    if (fromCode) {
      return fromCode
    }
    throw new NormalizationError('UNKNOWN_STATUS', 'Unknown TransBolívar status', trackingNumber)
  }

  private resolveLocation(
    locationRaw: unknown,
    trackingNumber: string,
  ): { city: string; country?: string } {
    if (!isObject(locationRaw)) {
      throw new NormalizationError('MISSING_FIELD', 'Missing location object', trackingNumber)
    }
    const city = requireString(locationRaw, 'city', this.code, trackingNumber)
    const country = typeof locationRaw.country === 'string' ? locationRaw.country.trim() : undefined
    return { city, country: country || undefined }
  }
}
