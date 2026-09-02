import type { CarrierAdapter } from './carrier-adapter.js'
import { CarrierRegistry } from './carrier-registry.js'
import type { NormalizedEvent } from '@andina-cargo/shared'

/**
 * Identifies the carrier for a raw payload and normalizes it to a
 * `NormalizedEvent`. Pure domain logic, independent of any persistence or HTTP
 * concerns.
 */
export class NormalizationService {
  constructor(private readonly registry: CarrierRegistry) {}

  static forAdapters(adapters: readonly CarrierAdapter[]): NormalizationService {
    return new NormalizationService(new CarrierRegistry(adapters))
  }

  normalize(payload: unknown): NormalizedEvent {
    return this.registry.find(payload).normalize(payload)
  }
}
