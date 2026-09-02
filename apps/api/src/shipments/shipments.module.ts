import { Module } from '@nestjs/common'
import { ShipmentsController } from './shipments.controller.js'
import { ShipmentsService } from './shipments.service.js'

@Module({
  controllers: [ShipmentsController],
  providers: [ShipmentsService],
})
export class ShipmentsModule {}
