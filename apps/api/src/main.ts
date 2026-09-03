import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // CORS: el panel Next.js corre en otro puerto (dev: localhost:3001) y en
  // producción en Vercel. Permitir los orígenes listados en CORS_ORIGIN
  // (coma-separados). Si no se define, se permite cualquier origen (dev).
  const origins = (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: origins.length > 0 ? origins : true,
    methods: ['GET', 'POST'],
  });
  // Los lotes de ingesta pueden contener hasta 5000 eventos (superan los 100kb
  // por defecto de express). Subimos el límite del body JSON.
  app.useBodyParser('json', { limit: '10mb' });
  // Bind a todas las interfaces: necesario para Render (proxies externos).
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
await bootstrap();
