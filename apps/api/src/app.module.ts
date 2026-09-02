import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { DbModule } from './db/db.module.js';
import { IngestionModule } from './ingestion/ingestion.module.js';
import { ShipmentsModule } from './shipments/shipments.module.js';

@Module({
  imports: [DbModule, IngestionModule, ShipmentsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
