import { BadRequestException, Controller, Get, NotFoundException, Param, Query } from '@nestjs/common'
import { ShipmentsService } from './shipments.service.js'
import { parseShipmentsQuery } from './shipments-query.js'

@Controller('shipments')
export class ShipmentsController {
  constructor(private readonly shipmentsService: ShipmentsService) {}

  @Get()
  async findAll(@Query() query: Record<string, unknown>) {
    const parsed = parseShipmentsQuery(query)
    if (!parsed.ok) {
      throw new BadRequestException(parsed.message)
    }
    return this.shipmentsService.findAll(parsed.query)
  }

  @Get(':trackingNumber')
  async findByTrackingNumber(@Param('trackingNumber') trackingNumber: string) {
    if (!trackingNumber || trackingNumber.trim() === '') {
      throw new BadRequestException('El número de guía es requerido')
    }
    const shipments = await this.shipmentsService.findByTrackingNumber(trackingNumber.trim())
    if (shipments.length === 0) {
      throw new NotFoundException(`No se encontraron envíos con guía "${trackingNumber}"`)
    }
    return { shipments }
  }
}
