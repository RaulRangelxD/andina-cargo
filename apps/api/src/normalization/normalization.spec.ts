import { ShipmentStatus } from '@andina-cargo/shared'
import { describe, expect, it } from 'vitest'
import { AndesExpressAdapter } from '../normalization/adapters/andes-express.js'
import { RutaSurAdapter } from '../normalization/adapters/ruta-sur.js'
import { TransBolivarAdapter } from '../normalization/adapters/trans-bolivar.js'
import { CarrierRegistry } from '../normalization/carrier-registry.js'
import { NormalizationError } from '../normalization/normalization-errors.js'
import { normalizationService } from '../normalization/normalization.js'

describe('CarrierRegistry identification', () => {
  const registry = new CarrierRegistry([
    new AndesExpressAdapter(),
    new TransBolivarAdapter(),
    new RutaSurAdapter(),
  ])

  it('identifies Andes Express', () => {
    expect(
      registry.find({ guia: 'AC-4471', evento: 'EN_TRANSITO', ts: '2026-08-30T14:22:10Z', ciudad: 'Cúcuta' })
        .code,
    ).toBe('andes-express')
  })

  it('identifies TransBolívar', () => {
    expect(
      registry.find({
        tracking_number: 'AC-4471',
        status: { code: 3, label: 'in transit' },
        occurred_at: 1756563730,
        location: { city: 'Cúcuta', country: 'CO' },
      }).code,
    ).toBe('trans-bolivar')
  })

  it('identifies RutaSur', () => {
    expect(
      registry.find({ guia: 'AC-4471', estado: 'EnRuta', fecha: '30/08/2026 10:22', lugar: 'Cúcuta' }).code,
    ).toBe('ruta-sur')
  })

  it('rejects an unrecognized payload', () => {
    expect(() => registry.find({ unknown: true })).toThrow(NormalizationError)
  })

  it('rejects a non-object payload', () => {
    expect(() => registry.find('AC-4471')).toThrow(NormalizationError)
  })
})

describe('Andes Express normalization', () => {
  const adapter = new AndesExpressAdapter()

  it('normalizes a valid event', () => {
    const payload = { guia: 'AC-4471', evento: 'EN_TRANSITO', ts: '2026-08-30T14:22:10Z', ciudad: 'Cúcuta' }
    const event = adapter.normalize(payload)
    expect(event).toMatchObject({
      trackingNumber: 'AC-4471',
      carrierCode: 'andes-express',
      status: ShipmentStatus.IN_TRANSIT,
      city: 'Cúcuta',
      occurredAt: '2026-08-30T14:22:10.000Z',
    })
    expect(event.rawPayload).toBe(payload)
  })

  it.each([
    ['RECOGIDO', ShipmentStatus.PICKED_UP],
    ['EN_TRANSITO', ShipmentStatus.IN_TRANSIT],
    ['EN_REPARTO', ShipmentStatus.OUT_FOR_DELIVERY],
    ['INCIDENTE', ShipmentStatus.INCIDENT],
    ['ENTREGADO', ShipmentStatus.DELIVERED],
  ])('maps status "%s" to %s', (evento, status) => {
    const event = adapter.normalize({
      guia: 'AC-2',
      evento,
      ts: '2026-08-30T14:22:10Z',
      ciudad: 'Bogotá',
    })
    expect(event.status).toBe(status)
  })

  it('throws on missing guia', () => {
    expect(() =>
      adapter.normalize({ evento: 'EN_TRANSITO', ts: '2026-08-30T14:22:10Z', ciudad: 'Bogotá' }),
    ).toThrow(NormalizationError)
  })

  it('throws on invalid date', () => {
    expect(() =>
      adapter.normalize({ guia: 'AC-1', evento: 'EN_TRANSITO', ts: 'not-a-date', ciudad: 'Bogotá' }),
    ).toThrow(NormalizationError)
  })

  it('throws on unknown status', () => {
    expect(() =>
      adapter.normalize({ guia: 'AC-1', evento: 'NO_EXISTE', ts: '2026-08-30T14:22:10Z', ciudad: 'Bogotá' }),
    ).toThrow(NormalizationError)
  })
})

describe('TransBolívar normalization', () => {
  const adapter = new TransBolivarAdapter()

  it('normalizes a valid event (status via label)', () => {
    const payload = {
      tracking_number: 'AC-4471',
      status: { code: 3, label: 'in transit' },
      occurred_at: 1756563730,
      location: { city: 'Cúcuta', country: 'CO' },
    }
    const event = adapter.normalize(payload)
    expect(event).toMatchObject({
      trackingNumber: 'AC-4471',
      carrierCode: 'trans-bolivar',
      status: ShipmentStatus.IN_TRANSIT,
      city: 'Cúcuta',
      country: 'CO',
      occurredAt: '2025-08-30T14:22:10.000Z',
    })
  })

  it('falls back to numeric code when the label is unknown', () => {
    const event = adapter.normalize({
      tracking_number: 'AC-5',
      status: { code: 5, label: 'unknown-label' },
      occurred_at: 1756563730,
      location: { city: 'Medellín', country: 'CO' },
    })
    expect(event.status).toBe(ShipmentStatus.DELIVERED)
  })

  it.each([
    [1, ShipmentStatus.PICKED_UP],
    [2, ShipmentStatus.OUT_FOR_DELIVERY],
    [3, ShipmentStatus.IN_TRANSIT],
    [4, ShipmentStatus.INCIDENT],
    [5, ShipmentStatus.DELIVERED],
  ])('maps numeric code %i to %s', (code, status) => {
    const event = adapter.normalize({
      tracking_number: 'AC-9',
      status: { code },
      occurred_at: 1756563730,
      location: { city: 'Bogotá', country: 'CO' },
    })
    expect(event.status).toBe(status)
  })

  it('omits country when not provided', () => {
    const event = adapter.normalize({
      tracking_number: 'AC-9',
      status: { label: 'delivered' },
      occurred_at: 1756563730,
      location: { city: 'Bogotá' },
    })
    expect(event.country).toBeUndefined()
  })

  it('throws when location is missing', () => {
    expect(() =>
      adapter.normalize({
        tracking_number: 'AC-9',
        status: { label: 'delivered' },
        occurred_at: 1756563730,
      }),
    ).toThrow(NormalizationError)
  })

  it('throws on invalid unix timestamp', () => {
    expect(() =>
      adapter.normalize({
        tracking_number: 'AC-9',
        status: { label: 'delivered' },
        occurred_at: 'nope',
        location: { city: 'Bogotá' },
      }),
    ).toThrow(NormalizationError)
  })
})

describe('RutaSur normalization', () => {
  const adapter = new RutaSurAdapter()

  it('normalizes a valid event and interprets the naive datetime as UTC-5', () => {
    const payload = { guia: 'AC-4471', estado: 'EnRuta', fecha: '30/08/2026 10:22', lugar: 'Cúcuta' }
    const event = adapter.normalize(payload)
    expect(event).toMatchObject({
      trackingNumber: 'AC-4471',
      carrierCode: 'ruta-sur',
      status: ShipmentStatus.IN_TRANSIT,
      city: 'Cúcuta',
      occurredAt: '2026-08-30T15:22:00.000Z',
    })
  })

  it.each([
    ['Recogido', ShipmentStatus.PICKED_UP],
    ['EnRuta', ShipmentStatus.IN_TRANSIT],
    ['EnReparto', ShipmentStatus.OUT_FOR_DELIVERY],
    ['Incidencia', ShipmentStatus.INCIDENT],
    ['Entregado', ShipmentStatus.DELIVERED],
  ])('maps status "%s" to %s', (estado, status) => {
    const event = adapter.normalize({
      guia: 'AC-2',
      estado,
      fecha: '30/08/2026 10:22',
      lugar: 'Bogotá',
    })
    expect(event.status).toBe(status)
  })

  it('throws on a malformed datetime', () => {
    expect(() =>
      adapter.normalize({ guia: 'AC-1', estado: 'Entregado', fecha: '30/08/2026', lugar: 'Bogotá' }),
    ).toThrow(NormalizationError)
  })

  it('throws when status is unknown', () => {
    expect(() =>
      adapter.normalize({ guia: 'AC-1', estado: 'Perdido', fecha: '30/08/2026 10:22', lugar: 'Bogotá' }),
    ).toThrow(NormalizationError)
  })
})

describe('Default normalizationService', () => {
  it('normalizes all three carrier formats through one entry point', () => {
    const events = [
      { guia: 'A-1', evento: 'EN_TRANSITO', ts: '2026-08-30T14:22:10Z', ciudad: 'Cúcuta' },
      {
        tracking_number: 'A-2',
        status: { label: 'delivered' },
        occurred_at: 1756563730,
        location: { city: 'Bogotá', country: 'CO' },
      },
      { guia: 'A-3', estado: 'EnRuta', fecha: '30/08/2026 10:22', lugar: 'Medellín' },
    ]
    const normalized = events.map((e) => normalizationService.normalize(e))
    expect(normalized.map((e) => e.carrierCode)).toEqual([
      'andes-express',
      'trans-bolivar',
      'ruta-sur',
    ])
  })

  it('throws a NormalizationError on unparseable input', () => {
    expect(() => normalizationService.normalize({ totally: 'unknown' })).toThrow(NormalizationError)
  })
})
