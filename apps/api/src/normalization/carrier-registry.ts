import type { CarrierAdapter } from './carrier-adapter.js'
import { NormalizationError } from './normalization-errors.js'
import { isObject } from './helpers.js'

export class CarrierRegistry {
  constructor(private readonly adapters: readonly CarrierAdapter[]) {
    if (adapters.length === 0) {
      throw new Error('CarrierRegistry requires at least one adapter')
    }
  }

  find(payload: unknown): CarrierAdapter {
    if (!isObject(payload)) {
      throw new NormalizationError('UNSUPPORTED_CARRIER', 'Payload is not an object')
    }
    const match = this.adapters.find((adapter) => adapter.supports(payload))
    if (!match) {
      throw new NormalizationError(
        'UNSUPPORTED_CARRIER',
        'No carrier adapter supports the given payload',
      )
    }
    return match
  }
}
