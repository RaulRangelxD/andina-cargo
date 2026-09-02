import { ShipmentStatus } from '../enums/shipment-status.js'

export interface ShipmentEvent {
  id: string
  shipmentId: string
  carrierId: string
  status: ShipmentStatus
  city: string
  country?: string
  occurredAt: string
}
