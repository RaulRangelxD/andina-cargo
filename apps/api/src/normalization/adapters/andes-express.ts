import type { NormalizedEvent } from '@andina-cargo/shared'
import type { CarrierAdapter } from '../carrier-adapter.js'
import { NormalizationError } from '../normalization-errors.js'
import { isObject, parseIsoDate, requireString } from '../helpers.js'
import { mapStatus } from '../status-mapper.js'

/**
 * Andes Express — flat JSON:
 * { "guia": "AC-4471", "evento": "EN_TRANSITO", "ts": "...Z", "ciudad": "Cúcuta" }
 */
export class AndesExpressAdapter implements CarrierAdapter {
  readonly code = 'andes-express'
  readonly name = 'Andes Express'

  supports(payload: unknown): boolean {
    return (
      isObject(payload) &&
      typeof payload.guia === 'string' &&
      typeof payload.evento === 'string'
    )
  }

  normalize(payload: unknown): NormalizedEvent {
    if (!isObject(payload)) {
      throw new NormalizationError('INVALID_FORMAT', 'Payload is not an object')
    }
    const trackingNumber = requireString(payload, 'guia', this.code)
    const city = requireString(payload, 'ciudad', this.code, trackingNumber)
    const occurredAt = parseIsoDate(payload.ts, this.code, trackingNumber)
    const status = mapStatus(payload.evento, this.code, trackingNumber)
    return {
      trackingNumber,
      carrierCode: this.code,
      status,
      occurredAt,
      city,
      rawPayload: payload,
    }
  }
}
