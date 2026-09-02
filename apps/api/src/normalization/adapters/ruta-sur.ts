import type { NormalizedEvent } from '@andina-cargo/shared'
import type { CarrierAdapter } from '../carrier-adapter.js'
import { NormalizationError } from '../normalization-errors.js'
import { isObject, parseLocalDateTime, requireString } from '../helpers.js'
import { mapStatus } from '../status-mapper.js'

/**
 * RutaSur — flat fields, no timezone:
 * { "guia": "AC-4471", "estado": "EnRuta", "fecha": "30/08/2026 10:22", "lugar": "Cúcuta" }
 */
export class RutaSurAdapter implements CarrierAdapter {
  readonly code = 'ruta-sur'
  readonly name = 'RutaSur'

  supports(payload: unknown): boolean {
    return (
      isObject(payload) &&
      typeof payload.guia === 'string' &&
      typeof payload.estado === 'string' &&
      typeof payload.lugar === 'string'
    )
  }

  normalize(payload: unknown): NormalizedEvent {
    if (!isObject(payload)) {
      throw new NormalizationError('INVALID_FORMAT', 'Payload is not an object')
    }
    const trackingNumber = requireString(payload, 'guia', this.code)
    const city = requireString(payload, 'lugar', this.code, trackingNumber)
    const occurredAt = parseLocalDateTime(payload.fecha, this.code, trackingNumber)
    const status = mapStatus(payload.estado, this.code, trackingNumber)
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
