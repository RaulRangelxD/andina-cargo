import { describe, expect, it } from 'vitest'
import { parseShipmentsQuery } from './shipments-query.js'

describe('parseShipmentsQuery', () => {
  it('returns defaults for an empty query', () => {
    const res = parseShipmentsQuery({})
    expect(res).toEqual({ ok: true, query: { page: 1, limit: 20 } })
  })

  it('parses valid page, limit, status, carrierCode and city', () => {
    const res = parseShipmentsQuery({
      page: '3',
      limit: '50',
      status: 'in_transit',
      carrierCode: 'trans-bolivar',
      city: 'Cúcuta',
    })
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.query).toEqual({
        page: 3,
        limit: 50,
        status: 'in_transit',
        carrierCode: 'trans-bolivar',
        city: 'Cúcuta',
      })
    }
  })

  it('rejects a non-positive page', () => {
    expect(parseShipmentsQuery({ page: '0' }).ok).toBe(false)
    expect(parseShipmentsQuery({ page: '-1' }).ok).toBe(false)
    expect(parseShipmentsQuery({ page: 'abc' }).ok).toBe(false)
  })

  it('rejects a non-positive limit', () => {
    expect(parseShipmentsQuery({ limit: '0' }).ok).toBe(false)
  })

  it('rejects a limit above the max', () => {
    const res = parseShipmentsQuery({ limit: '101' })
    expect(res.ok).toBe(false)
  })

  it('rejects an invalid status', () => {
    const res = parseShipmentsQuery({ status: 'not-a-status' })
    expect(res.ok).toBe(false)
  })

  it('rejects an empty carrierCode or city', () => {
    expect(parseShipmentsQuery({ carrierCode: '' }).ok).toBe(false)
    expect(parseShipmentsQuery({ city: '  ' }).ok).toBe(false)
  })
})
