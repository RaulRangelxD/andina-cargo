import { ShipmentStatus } from '../enums/shipment-status.js'
import { ShipmentEvent } from './shipment-event.js'

export interface Shipment {
  id: string
  trackingNumber: string
  carrierId: string
  currentStatus: ShipmentStatus
  currentCity: string
  currentOccurredAt: string
  timeline: ShipmentEvent[]
}
