import { BadRequestException, NotFoundException } from '@nestjs/common'
import { ShipmentStatus } from '@andina-cargo/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ShipmentsController } from './shipments.controller.js'
import { ShipmentsService } from './shipments.service.js'

describe('ShipmentsController', () => {
  let controller: ShipmentsController
  let service: { findByTrackingNumber: ReturnType<typeof vi.fn>; findAll: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    service = {
      findByTrackingNumber: vi.fn(),
      findAll: vi.fn(),
    }
    controller = new ShipmentsController(service as unknown as ShipmentsService)
  })

  describe('findAll', () => {
    it('delegates to the service for a valid query', async () => {
      service.findAll.mockResolvedValue({ data: [], meta: { page: 2, limit: 10, total: 0, totalPages: 0 } })
      const result = await controller.findAll({ page: '2', limit: '10' })
      expect(service.findAll).toHaveBeenCalledWith({ page: 2, limit: 10 })
      expect(result.meta.page).toBe(2)
    })

    it('throws BadRequestException for an invalid query', async () => {
      await expect(controller.findAll({ page: '0' })).rejects.toBeInstanceOf(BadRequestException)
    })
  })

  describe('findByTrackingNumber', () => {
    it('returns shipments found', async () => {
      service.findByTrackingNumber.mockResolvedValue([
        {
          id: 's-1',
          trackingNumber: 'AC-4471',
          carrierId: 'c',
          currentStatus: ShipmentStatus.IN_TRANSIT,
          currentCity: 'Cúcuta',
          currentOccurredAt: '2026-08-30T14:22:10.000Z',
          carrier: { id: 'c', code: 'andes-express', name: 'Andes Express' },
          timeline: [],
        },
      ])
      const result = await controller.findByTrackingNumber('AC-4471')
      expect(result.shipments[0].trackingNumber).toBe('AC-4471')
    })

    it('throws NotFoundException when nothing matches', async () => {
      service.findByTrackingNumber.mockResolvedValue([])
      await expect(controller.findByTrackingNumber('NOPE')).rejects.toBeInstanceOf(NotFoundException)
    })

    it('throws BadRequestException for an empty tracking number', async () => {
      await expect(controller.findByTrackingNumber('')).rejects.toBeInstanceOf(BadRequestException)
      await expect(controller.findByTrackingNumber('   ')).rejects.toBeInstanceOf(BadRequestException)
    })
  })
})
