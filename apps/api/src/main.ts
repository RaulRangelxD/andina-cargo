import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Los lotes de ingesta pueden contener hasta 5000 eventos (superan los 100kb
  // por defecto de express). Subimos el límite del body JSON.
  app.useBodyParser('json', { limit: '10mb' });
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
