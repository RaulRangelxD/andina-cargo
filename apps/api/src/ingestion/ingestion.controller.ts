import { BadRequestException, Body, Controller, HttpCode, Post } from '@nestjs/common';
import { IngestionService } from './ingestion.service.js';
import { validateEnvelope } from './envelope.js';

@Controller('ingest')
export class IngestionController {
  constructor(private readonly ingestionService: IngestionService) {}

  @Post()
  @HttpCode(200)
  async ingest(@Body() body: unknown) {
    const envelope = validateEnvelope(body);
    if (!envelope.ok) {
      throw new BadRequestException(envelope.message);
    }
    return this.ingestionService.ingest(envelope.events);
  }
}
