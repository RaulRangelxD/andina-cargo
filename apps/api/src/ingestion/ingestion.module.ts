import { Module } from '@nestjs/common';
import { adapters } from '../normalization/normalization.js';
import { NormalizationService } from '../normalization/normalization.service.js';
import { IngestionController } from './ingestion.controller.js';
import { IngestionService } from './ingestion.service.js';

@Module({
  controllers: [IngestionController],
  providers: [
    {
      provide: NormalizationService,
      useValue: NormalizationService.forAdapters(adapters),
    },
    IngestionService,
  ],
})
export class IngestionModule {}
