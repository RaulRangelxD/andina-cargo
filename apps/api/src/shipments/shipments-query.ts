import { ShipmentStatus } from '@andina-cargo/shared'

const VALID_STATUSES = new Set<string>(Object.values(ShipmentStatus))

export interface ShipmentsQuery {
  page: number
  limit: number
  status?: ShipmentStatus
  carrierCode?: string
  city?: string
}

export function parseShipmentsQuery(
  query: Record<string, unknown>,
): { ok: true; query: ShipmentsQuery } | { ok: false; message: string } {
  const page = toPositiveInt(query.page, 1)
  if (page === null) return { ok: false, message: 'page debe ser un entero positivo' }

  const limit = toPositiveInt(query.limit, 20)
  if (limit === null) return { ok: false, message: 'limit debe ser un entero positivo' }
  if (limit > 100) return { ok: false, message: 'limit no puede exceder 100' }

  let status: ShipmentStatus | undefined
  if (query.status != null) {
    if (typeof query.status !== 'string' || !VALID_STATUSES.has(query.status)) {
      return { ok: false, message: `status inválido. Valores permitidos: ${[...VALID_STATUSES].join(', ')}` }
    }
    status = query.status as ShipmentStatus
  }

  let carrierCode: string | undefined
  if (query.carrierCode != null) {
    if (typeof query.carrierCode !== 'string' || query.carrierCode.trim() === '') {
      return { ok: false, message: 'carrierCode debe ser una cadena no vacía' }
    }
    carrierCode = query.carrierCode
  }

  let city: string | undefined
  if (query.city != null) {
    if (typeof query.city !== 'string' || query.city.trim() === '') {
      return { ok: false, message: 'city debe ser una cadena no vacía' }
    }
    city = query.city
  }

  return { ok: true, query: { page, limit, status, carrierCode, city } }
}

function toPositiveInt(value: unknown, defaultValue: number): number | null {
  if (value == null || value === '') return defaultValue
  const n = Number(value)
  if (!Number.isInteger(n) || n < 1) return null
  return n
}
