import { describe, expect, it } from 'vitest'
import { MAX_BATCH_SIZE, validateEnvelope } from './envelope.js'

describe('validateEnvelope', () => {
  it('accepts a non-empty array of plain objects', () => {
    expect(validateEnvelope([{ a: 1 }, { b: 2 }])).toEqual({
      ok: true,
      events: [{ a: 1 }, { b: 2 }],
    })
  })

  it('rejects a non-array body', () => {
    const res = validateEnvelope({ not: 'array' })
    expect(res.ok).toBe(false)
  })

  it('rejects an empty array', () => {
    const res = validateEnvelope([])
    expect(res).toMatchObject({ ok: false })
  })

  it('rejects arrays above the max batch size', () => {
    const big = Array.from({ length: MAX_BATCH_SIZE + 1 }, () => ({}))
    const res = validateEnvelope(big)
    expect(res.ok).toBe(false)
    expect((res as { message: string }).message).toMatch(/5000/)
  })

  it('rejects an array that is not a plain object element (null/array/scalar)', () => {
    expect(validateEnvelope([null])).toMatchObject({ ok: false })
    expect(validateEnvelope([[1, 2]])).toMatchObject({ ok: false })
    expect(validateEnvelope(['string'])).toMatchObject({ ok: false })
  })
})
