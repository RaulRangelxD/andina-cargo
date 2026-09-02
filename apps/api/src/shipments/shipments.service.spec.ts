import { ShipmentStatus } from '@andina-cargo/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PrismaService } from '../db/prisma.service.js'
import { ShipmentsService } from './shipments.service.js'

const CARRIER = { id: 'c-driver', code: 'andes-express', name: 'Andes Express' }

const EVENTS = [
  {
    id: 'ev-1',
    shipmentId: 's-1',
    carrierId: CARRIER.id,
    status: ShipmentStatus.PICKED_UP,
    city: 'Bogotá',
    country: 'CO',
    occurredAt: new Date('2026-08-29T18:00:00.000Z'),
  },
  {
    id: 'ev-2',
    shipmentId: 's-1',
    carrierId: CARRIER.id,
    status: ShipmentStatus.IN_TRANSIT,
    city: 'Cúcuta',
    country: 'CO',
    occurredAt: new Date('2026-08-30T14:22:10.000Z'),
  },
]

const SHIPMENT = {
  id: 's-1',
  trackingNumber: 'AC-4471',
  carrierId: CARRIER.id,
  currentStatus: ShipmentStatus.IN_TRANSIT,
  currentCity: 'Cúcuta',
  currentOccurredAt: EVENTS[1].occurredAt,
  createdAt: new Date('2026-08-29T18:00:00.000Z'),
  updatedAt: new Date('2026-08-30T14:22:10.000Z'),
  carrier: CARRIER,
}

function createFakePrisma() {
  const findMany = vi.fn()
  const count = vi.fn()
  return {
    shipment: { findMany, count },
  } as unknown as PrismaService
}

describe('ShipmentsService', () => {
  let prisma: ReturnType<typeof createFakePrisma>
  let service: ShipmentsService

  beforeEach(() => {
    prisma = createFakePrisma()
    service = new ShipmentsService(prisma)
  })

  describe('findByTrackingNumber', () => {
    it('returns the shipment with ordered timeline including carrier', async () => {
      ;(prisma.shipment.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([{ ...SHIPMENT, events: EVENTS }])

      const result = await service.findByTrackingNumber('AC-4471')

      expect(result).toHaveLength(1)
      const shipment = result[0]
      expect(shipment.trackingNumber).toBe('AC-4471')
      expect(shipment.currentStatus).toBe(ShipmentStatus.IN_TRANSIT)
      expect(shipment.currentOccurredAt).toBe('2026-08-30T14:22:10.000Z')
      expect(shipment.carrier.code).toBe('andes-express')
      expect(shipment.timeline.map((e) => e.occurredAt)).toEqual([
        '2026-08-29T18:00:00.000Z',
        '2026-08-30T14:22:10.000Z',
      ])
    })

    it('returns an empty array when no shipment matches', async () => {
      ;(prisma.shipment.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
      expect(await service.findByTrackingNumber('NOPE')).toEqual([])
    })
  })

  describe('findAll', () => {
    it('returns paginated list with meta', async () => {
      ;(prisma.shipment.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([{ ...SHIPMENT, events: [] }])
      ;(prisma.shipment.count as ReturnType<typeof vi.fn>).mockResolvedValue(1)

      const result = await service.findAll({ page: 1, limit: 20 })

      expect(result.data).toHaveLength(1)
      expect(result.data[0].trackingNumber).toBe('AC-4471')
      expect(result.meta).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 })

      // Leverages the (carrierId, currentStatus) and (updatedAt) indexes.
      const findManyCall = (prisma.shipment.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(findManyCall.orderBy).toEqual({ updatedAt: 'desc' })
      expect(findManyCall.take).toBe(20)
      expect(findManyCall.skip).toBe(0)
    })

    it('passes status/carrierCode/city filters and computes skip', async () => {
      ;(prisma.shipment.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
      ;(prisma.shipment.count as ReturnType<typeof vi.fn>).mockResolvedValue(0)

      await service.findAll({ page: 3, limit: 10, status: ShipmentStatus.DELIVERED, carrierCode: 'ruta-sur', city: 'Cali' })

      const findManyCall = (prisma.shipment.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(findManyCall.skip).toBe(20)
      expect(findManyCall.where).toEqual({
        currentStatus: ShipmentStatus.DELIVERED,
        carrier: { code: 'ruta-sur' },
        currentCity: { contains: 'Cali', mode: 'insensitive' },
      })
    })
  })
})
