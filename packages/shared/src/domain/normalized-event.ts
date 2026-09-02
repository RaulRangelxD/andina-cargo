import { ShipmentStatus } from '../enums/shipment-status.js'

export interface NormalizedEvent {
  trackingNumber: string
  carrierCode: string
  status: ShipmentStatus
  occurredAt: string
  city: string
  country?: string
  rawPayload: unknown
}
