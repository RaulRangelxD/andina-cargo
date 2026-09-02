# Fase 4 — Modelo de datos + persistencia (PostgreSQL + Prisma + Supabase)

## Objetivo
Implementar el modelo persistente para `Carrier`, `Shipment`, `ShipmentEvent`, relaciones, índices,
estrategia de deduplicación, migraciones Prisma y configuración PostgreSQL/Supabase.
Sin ingesta (F5), consulta (F6), frontend, Docker ni funcionalidades posteriores.

## Decisiones confirmadas con el usuario
- **Deduplicación**: columna `dedupeKey @unique` = hash SHA-256 del evento normalizado canónico
  `{trackingNumber, carrierCode, occurredAt, status, city, country}`. F5 la usará con
  `createMany({ skipDuplicates })`.
- **DB de destino**: modo offline. Se genera esquema + migración inicial (SQL declarativo) + `.env.example`.
  Validación con `prisma validate` / `prisma generate` / `prisma migrate diff` + typecheck.
  El usuario aplica `db push`/`migrate deploy` + seed con su `DATABASE_URL` de Supabase.
- **Ubicación**: `apps/api/prisma/schema.prisma`, cliente generado en node_modules.

## Archivos a crear / modificar

### 1. `apps/api/package.json` (modificar)
- Deps: `@prisma/client` (^6.19.0). DevDeps: `prisma` (^6.19.0), `@types/node` ya existe.
- Scripts:
  - `prisma:generate`: `prisma generate`
  - `prisma:validate`: `prisma validate`
  - `prisma:migrate`: `prisma migrate dev`
  - `prisma:push`: `prisma db push`
  - `prisma:seed`: `tsx prisma/seed.ts`
  - `prisma:studio`: `prisma studio`
- `prisma.seed` en package.json: `"prisma": { "seed": "tsx prisma/seed.ts" }` (dependencia `tsx` como dev).

### 2. `apps/api/prisma/schema.prisma` (crear)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum ShipmentStatus {
  picked_up
  in_transit
  out_for_delivery
  incident
  delivered
}

model Carrier {
  id        String          @id @default(cuid())
  code      String          @unique
  name      String
  shipments Shipment[]
  events    ShipmentEvent[]
}

model Shipment {
  id                String         @id @default(cuid())
  trackingNumber    String
  carrierId         String
  currentStatus     ShipmentStatus
  currentCity       String
  currentOccurredAt DateTime       @db.Timestamptz(6)
  createdAt         DateTime       @default(now()) @db.Timestamptz(6)
  updatedAt         DateTime       @updatedAt @db.Timestamptz(6)
  carrier           Carrier        @relation(fields: [carrierId], references: [id], onDelete: Restrict)
  events            ShipmentEvent[]

  @@unique([trackingNumber, carrierId])
  @@index([carrierId, currentStatus])
  @@index([updatedAt])
}

model ShipmentEvent {
  id         String         @id @default(cuid())
  shipmentId String
  carrierId  String
  status     ShipmentStatus
  city       String
  country    String?
  occurredAt DateTime       @db.Timestamptz(6)
  dedupeKey  String         @unique
  rawPayload Json
  createdAt  DateTime       @default(now()) @db.Timestamptz(6)
  shipment   Shipment       @relation(fields: [shipmentId], references: [id], onDelete: Cascade)
  carrier    Carrier        @relation(fields: [carrierId], references: [id], onDelete: Restrict)

  @@index([shipmentId, occurredAt(sort: Desc)])
  @@index([carrierId, occurredAt(sort: Desc)])
}
```

Detalles/decisiones:
- `enum ShipmentStatus` con exactamente los 5 valores del shared (`packages/shared`) → mapeo 1:1 sin traducción.
- `Shipment` denormaliza `currentStatus/currentCity/currentOccurredAt` (evita escanear 2M eventos para estado actual/listado).
- `@@unique([trackingNumber, carrierId])`: una guía es única por transportista.
- `ShipmentEvent.dedupeKey @unique`: estrategia de deduplicación (hash del evento normalizado).
- `rawPayload Json` → `jsonb` en Postgres.
- `occurredAt` `@db.Timestamptz(6)` conserva la zona/hora exacta del evento.
- Índices para timeline (`shipmentId, occurredAt DESC`) y por transportista (`carrierId, occurredAt DESC`).
- `onDelete: Cascade` en eventos del shipment; `Restrict` en carrier (no borrar carrier con datos).

Escala 2M+ eventos / 4 carriers (documentado en DECISIONS.md en F9):
- Denormalización del estado actual + índices (B-tree) es suficiente ahora.
- A 100× la respuesta sería: particionar `ShipmentEvent` por `occurredAt` (o BRIN index) y,
  si aplica, sharding/servicios de streaming. No se implementa por no-sobre-ingeniería.

### 3. `apps/api/prisma/migrations/0001_init/migration.sql` (crear, generado)
- Generar con `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`.
- Crear `migrations/migration_lock.toml` con `provider = "postgresql"`.

### 4. `apps/api/prisma/seed.ts` (crear)
- 3 carriers (andes-express, trans-bolivar, ruta-sur) con sus ids (`carrier-andes-express`, etc.).
- 1+ shipment con timeline de eventos de los 3 transportistas (estados, ciudades, tiempos, rawPayloads).
- `upsert` para ser idempotente.

### 5. `apps/api/src/db/prisma.service.ts` y `apps/api/src/db/db.module.ts` (crear)
- `PrismaService extends PrismaClient implements OnModuleInit/OnModuleDestroy`.
- `DbModule` global con `PrismaService` como provider/export.

### 6. `apps/api/.env.example` (crear)
- `DATABASE_URL="postgresql://..."` (con comentario de formato Supabase).
- `.gitignore` ya ignora `.env`.

## Validaciones
- `prisma validate`
- `prisma generate`
- `prisma migrate diff` (generar SQL sin DB)
- typecheck `src` (`tsc -p tsconfig.build.json --noEmit`)
- `pnpm --filter api lint` (oxlint)
- `pnpm --filter api test` (35 tests existentes deben seguir pasando)
- `pnpm --filter api build` (nest build)

## Fuera de alcance (Fases 5+)
- No endpoints de ingesta/consulta, no frontend, no Docker, no `.env` real, no aplicar migración a DB viva.
