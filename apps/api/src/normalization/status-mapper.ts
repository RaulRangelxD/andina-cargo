import { ShipmentStatus } from '@andina-cargo/shared'
import { NormalizationError } from './normalization-errors.js'

const STATUS_ALIASES: ReadonlyArray<readonly [ShipmentStatus, readonly string[]]> = [
  [ShipmentStatus.PICKED_UP, ['picked up', 'recogido', 'recolectado', 'registrado', 'en poder']],
  [
    ShipmentStatus.IN_TRANSIT,
    ['in transit', 'transit', 'en transito', 'transito', 'en ruta', 'enruta', 'on the way', 'ruta'],
  ],
  [
    ShipmentStatus.OUT_FOR_DELIVERY,
    ['out for delivery', 'en reparto', 'en entrega', 'reparto', 'delivering'],
  ],
  [ShipmentStatus.INCIDENT, ['incident', 'incidencia', 'incidente', 'exception', 'excepcion', 'problema']],
  [ShipmentStatus.DELIVERED, ['delivered', 'entregado', 'entregada', 'entregado al destinatario']],
]

function strip(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

const ALIAS_LOOKUP: Record<string, ShipmentStatus> = {}
for (const [status, aliases] of STATUS_ALIASES) {
  for (const alias of aliases) {
    ALIAS_LOOKUP[strip(alias)] = status
  }
}

export function tryMapStatus(input: unknown): ShipmentStatus | undefined {
  if (typeof input !== 'string' || input.trim() === '') {
    return undefined
  }
  return ALIAS_LOOKUP[strip(input)]
}

export function mapStatus(
  input: unknown,
  carrierCode: string,
  trackingNumber?: string,
): ShipmentStatus {
  const status = tryMapStatus(input)
  if (!status) {
    throw new NormalizationError('UNKNOWN_STATUS', `Unknown status "${String(input)}"`, trackingNumber)
  }
  return status
}

const TRANS_BOLIVAR_CODE_MAP: Record<number, ShipmentStatus> = {
  1: ShipmentStatus.PICKED_UP,
  2: ShipmentStatus.OUT_FOR_DELIVERY,
  3: ShipmentStatus.IN_TRANSIT,
  4: ShipmentStatus.INCIDENT,
  5: ShipmentStatus.DELIVERED,
}

export function transBolivarStatusFromCode(code: unknown): ShipmentStatus | undefined {
  if (typeof code !== 'number') {
    return undefined
  }
  return TRANS_BOLIVAR_CODE_MAP[code]
}
