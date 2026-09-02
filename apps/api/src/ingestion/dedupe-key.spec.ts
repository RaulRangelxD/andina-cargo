import { ShipmentStatus } from '@andina-cargo/shared'
import { describe, expect, it } from 'vitest'
import { dedupeKey } from './dedupe-key.js'

const base = {
  trackingNumber: 'AC-4471',
  carrierCode: 'andes-express',
  status: ShipmentStatus.IN_TRANSIT,
  occurredAt: '2026-08-30T14:22:10.000Z',
  city: 'Cúcuta',
  country: 'CO',
}

describe('dedupeKey', () => {
  it('is deterministic', () => {
    expect(dedupeKey(base)).toBe(dedupeKey({ ...base }))
  })

  it('differs when a normalized field changes', () => {
    expect(dedupeKey(base)).not.toBe(dedupeKey({ ...base, city: 'Bogotá' }))
    expect(dedupeKey(base)).not.toBe(
      dedupeKey({ ...base, occurredAt: '2026-08-30T15:00:00.000Z' }),
    )
    expect(dedupeKey(base)).not.toBe(
      dedupeKey({ ...base, status: ShipmentStatus.DELIVERED }),
    )
  })

  it('is independent of the raw payload formatting', () => {
    expect(dedupeKey({ ...base, rawPayload: { a: 1 } })).toBe(
      dedupeKey({ ...base, rawPayload: { totally: 'different', x: [1, 2, 3] } }),
    )
  })

  it('treats missing vs null country consistently', () => {
    const noCountry = { ...base, country: undefined }
    expect(dedupeKey(noCountry)).toBe(dedupeKey({ ...base, country: null as unknown as string }))
  })

  it('reflects the carrier code in the key', () => {
    expect(dedupeKey(base)).not.toBe(dedupeKey({ ...base, carrierCode: 'ruta-sur' }))
  })
})
