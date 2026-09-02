import { NormalizationError } from './normalization-errors.js'

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function requireString(
  obj: Record<string, unknown>,
  key: string,
  carrierCode: string,
  trackingNumber?: string,
): string {
  const value = obj[key]
  if (typeof value !== 'string' || value.trim() === '') {
    throw new NormalizationError(
      'MISSING_FIELD',
      `Missing or invalid string field "${key}"`,
      trackingNumber,
    )
  }
  return value.trim()
}

export function parseIsoDate(
  value: unknown,
  carrierCode: string,
  trackingNumber?: string,
): string {
  if (typeof value !== 'string') {
    throw new NormalizationError('INVALID_DATE', 'Date must be an ISO 8601 string', trackingNumber)
  }
  const timestamp = Date.parse(value)
  if (Number.isNaN(timestamp)) {
    throw new NormalizationError('INVALID_DATE', `Invalid date "${value}"`, trackingNumber)
  }
  return new Date(timestamp).toISOString()
}

export function parseUnixSeconds(
  value: unknown,
  carrierCode: string,
  trackingNumber?: string,
): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new NormalizationError(
      'INVALID_DATE',
      'Date must be a Unix timestamp in seconds',
      trackingNumber,
    )
  }
  const date = new Date(value * 1000)
  if (Number.isNaN(date.getTime())) {
    throw new NormalizationError('INVALID_DATE', `Invalid Unix timestamp "${value}"`, trackingNumber)
  }
  return date.toISOString()
}

// RutaSur reports a naive "DD/MM/YYYY HH:mm" datetime without timezone.
// It is interpreted as local time in the carrier's operating zone (Colombia,
// America/Bogota, UTC-5). The UTC instant therefore equals local + 5 hours.
export function parseLocalDateTime(
  value: unknown,
  carrierCode: string,
  trackingNumber?: string,
): string {
  if (typeof value !== 'string') {
    throw new NormalizationError(
      'INVALID_DATE',
      'Date must be a "DD/MM/YYYY HH:mm" string',
      trackingNumber,
    )
  }
  const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/)
  if (!match) {
    throw new NormalizationError(
      'INVALID_DATE',
      `Invalid local datetime "${value}" (expected DD/MM/YYYY HH:mm)`,
      trackingNumber,
    )
  }
  const [, dd, mm, yyyy, hh, min] = match
  const naiveUtc = Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min))
  return new Date(naiveUtc + 5 * 60 * 60 * 1000).toISOString()
}
