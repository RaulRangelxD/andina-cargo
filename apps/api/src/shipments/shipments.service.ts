import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import type { ShipmentStatus, ShipmentEvent } from '@andina-cargo/shared'
import { PrismaService } from '../db/prisma.service.js'

export interface CarrierInfo {
  id: string
  code: string
  name: string
}

export interface ShipmentListItem {
  id: string
  trackingNumber: string
  carrierId: string
  carrier: CarrierInfo
  currentStatus: ShipmentStatus
  currentCity: string
  currentOccurredAt: string
}

export interface ShipmentDetail extends ShipmentListItem {
  timeline: ShipmentEvent[]
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface ListQuery {
  page: number
  limit: number
  status?: ShipmentStatus
  carrierCode?: string
  city?: string
}

const CARRIER_SELECT = { id: true, code: true, name: true } as const

@Injectable()
export class ShipmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findByTrackingNumber(trackingNumber: string): Promise<ShipmentDetail[]> {
    const shipments = await this.prisma.shipment.findMany({
      where: { trackingNumber },
      include: {
        carrier: { select: CARRIER_SELECT },
        events: {
          orderBy: { occurredAt: 'asc' },
          select: {
            id: true,
            shipmentId: true,
            carrierId: true,
            status: true,
            city: true,
            country: true,
            occurredAt: true,
          },
        },
      },
    })

    return shipments.map((s) => ({
      id: s.id,
      trackingNumber: s.trackingNumber,
      carrierId: s.carrierId,
      carrier: s.carrier,
      currentStatus: s.currentStatus as ShipmentStatus,
      currentCity: s.currentCity,
      currentOccurredAt: s.currentOccurredAt.toISOString(),
      timeline: s.events.map((e) => ({
        id: e.id,
        shipmentId: e.shipmentId,
        carrierId: e.carrierId,
        status: e.status as ShipmentStatus,
        city: e.city,
        country: e.country ?? undefined,
        occurredAt: e.occurredAt.toISOString(),
      })),
    }))
  }

  async findAll(query: ListQuery): Promise<PaginatedResponse<ShipmentListItem>> {
    const { page, limit, status, carrierCode, city } = query
    const skip = (page - 1) * limit

    const where: Prisma.ShipmentWhereInput = {}
    if (status) where.currentStatus = status
    if (carrierCode) where.carrier = { code: carrierCode }
    if (city) where.currentCity = { contains: city, mode: 'insensitive' }

    const [shipments, total] = await Promise.all([
      this.prisma.shipment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: { carrier: { select: CARRIER_SELECT } },
      }),
      this.prisma.shipment.count({ where }),
    ])

    return {
      data: shipments.map((s) => ({
        id: s.id,
        trackingNumber: s.trackingNumber,
        carrierId: s.carrierId,
        carrier: s.carrier,
        currentStatus: s.currentStatus as ShipmentStatus,
        currentCity: s.currentCity,
        currentOccurredAt: s.currentOccurredAt.toISOString(),
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  }
}
