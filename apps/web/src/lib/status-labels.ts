import { ShipmentStatus } from '@andina-cargo/shared'

export const STATUS_LABELS: Record<ShipmentStatus, string> = {
  [ShipmentStatus.PICKED_UP]: 'Recogido',
  [ShipmentStatus.IN_TRANSIT]: 'En tránsito',
  [ShipmentStatus.OUT_FOR_DELIVERY]: 'En reparto',
  [ShipmentStatus.INCIDENT]: 'Incidencia',
  [ShipmentStatus.DELIVERED]: 'Entregado',
}

export function statusLabel(status: ShipmentStatus): string {
  return STATUS_LABELS[status] ?? status
}

export function formatOccurredAt(occurredAt: string): string {
  const date = new Date(occurredAt)
  if (Number.isNaN(date.getTime())) return occurredAt
  return date.toLocaleString('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Bogota',
  })
}
