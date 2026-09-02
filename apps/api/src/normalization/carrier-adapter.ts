import type { NormalizedEvent } from '@andina-cargo/shared'

/**
 * A carrier adapter converts a raw, untrusted carrier payload into a
 * `NormalizedEvent` that uses Andina Cargo's internal model.
 *
 * The `supports(payload)` predicate drives identification, so adding a fourth
 * transportista only requires a new adapter registered in the registry, not
 * changes to the core normalization logic.
 */
export interface CarrierAdapter {
  readonly code: string
  readonly name: string
  supports(payload: unknown): boolean
  normalize(payload: unknown): NormalizedEvent
}
