# AGENTS.md — Andina Cargo

> Documento de contexto principal para cualquier IA/agente que trabaje sobre este repositorio.

---

## Contexto del proyecto

**Andina Cargo** es una empresa de mensajería en Colombia/Venezuela que contrata tres transportistas externos. Cada transportista informa eventos de envíos con un formato diferente. El equipo de atención al cliente debe consultar tres portales para responder: *"¿Dónde está mi paquete?"*.

El objetivo es construir un sistema que permita buscar una guía y consultar su historia desde una única interfaz.

El sistema será mantenido por un equipo de dos personas que no participaron en la fase de desarrollo. **Priorizar simplicidad, mantenibilidad, claridad y extensibilidad.**

---

## Stack obligatorio

- TypeScript de principio a fin
- Node.js 22+
- NestJS (API)
- Next.js (panel)
- PostgreSQL y/o MongoDB según decisión arquitectónica
- pnpm (package manager)
- Docker / Docker Compose
- Git / GitHub
- No usar servicios de pago

---

## Flujo del sistema

```
Transportista
     │ lote de eventos
     ▼
API NestJS
     │
  Validación
     │
Normalización
     │
Persistencia
     │
API de consulta
     │
Next.js
     │
Camila consulta una guía
```

Los transportistas **empujan eventos** hacia Andina Cargo. No hay API para consultarles.

Lotes: hasta **5.000 eventos**, hasta **3 veces al día**.

---

## Formatos de los tres transportistas

### Andes Express — JSON plano

```json
{
  "guia": "AC-4471",
  "evento": "EN_TRANSITO",
  "ts": "2026-08-30T14:22:10Z",
  "ciudad": "Cúcuta"
}
```

### TransBolívar — JSON anidado

```json
{
  "tracking_number": "AC-4471",
  "status": {
    "code": 3,
    "label": "in transit"
  },
  "occurred_at": 1756563730,
  "location": {
    "city": "Cúcuta",
    "country": "CO"
  }
}
```

### RutaSur — Campos planos, sin timezone

```json
{
  "guia": "AC-4471",
  "estado": "EnRuta",
  "fecha": "30/08/2026 10:22",
  "lugar": "Cúcuta"
}
```

---

## Estados internos

Andina Cargo maneja exactamente cinco estados:

```ts
export enum ShipmentStatus {
  PICKED_UP = 'picked_up',
  IN_TRANSIT = 'in_transit',
  OUT_FOR_DELIVERY = 'out_for_delivery',
  INCIDENT = 'incident',
  DELIVERED = 'delivered',
}
```

Los transportistas pueden usar nombres, idiomas, códigos numéricos y estructuras diferentes. La aplicación debe convertirlos a este modelo único.

---

## Contratos compartidos existentes

**NO recrear, mover ni modificar sin razón técnica real.**

Ubicación: `packages/shared/src/`

```
packages/shared/
└── src/
    ├── index.ts
    ├── domain/
    │   ├── carrier.ts
    │   ├── normalized-event.ts
    │   ├── shipment-event.ts
    │   └── shipment.ts
    └── enums/
        └── shipment-status.ts
```

### carrier.ts

```ts
export interface Carrier {
  id: string
  code: string
  name: string
}
```

### normalized-event.ts

```ts
import { ShipmentStatus } from '../enums/shipment-status'

export interface NormalizedEvent {
  trackingNumber: string
  carrierCode: string
  status: ShipmentStatus
  occurredAt: string
  city: string
  country?: string
  rawPayload: unknown
}
```

### shipment-event.ts

```ts
import { ShipmentStatus } from '../enums/shipment-status'

export interface ShipmentEvent {
  id: string
  shipmentId: string
  carrierId: string
  status: ShipmentStatus
  city: string
  country?: string
  occurredAt: string
}
```

### shipment.ts

```ts
import { ShipmentStatus } from '../enums/shipment-status'
import { ShipmentEvent } from './shipment-event'

export interface Shipment {
  id: string
  trackingNumber: string
  carrierId: string
  currentStatus: ShipmentStatus
  currentCity: string
  currentOccurredAt: string
  timeline: ShipmentEvent[]
}
```

### index.ts

```ts
export * from './enums/shipment-status'
export * from './domain/carrier'
export * from './domain/shipment'
export * from './domain/shipment-event'
export * from './domain/normalized-event'
```

---

## Estado actual del monorepo

### Estructura

```
andina-cargo/
├── package.json              (root — pnpm@11.25.0, type: module)
├── pnpm-workspace.yaml       (apps/*, packages/*)
├── README.md
├── apps/
│   ├── api/                  NestJS 12, ESM, NodeNext, vitest, oxlint
│   │   ├── prisma/
│   │   │   ├── schema.prisma     modelos Carrier, Shipment, ShipmentEvent (Fase 4)
│   │   │   ├── migrations/       migración inicial (0001_init)
│   │   │   └── seed.ts           datos de ejemplo (3 carriers + timelines)
│   │   └── src/
│   │       ├── app.*         Hello World por defecto
│   │       ├── db/           PrismaService + DbModule global (Fase 4)
│   │       ├── normalization/   Normalización de los 3 transportistas (Fase 3)
│   │       └── ingestion/       POST /ingest + persistencia de lotes (Fase 5)
│   └── web/                  Next.js 16.3.4, React 19, Tailwind v4, App Router
│       └── src/app/          Template create-next-app por defecto
└── packages/
    └── shared/               Contratos de dominio (buildable → dist/)
        ├── tsconfig.json     compila a dist/ (NodeNext ESM, .js extensions)
        └── src/              interfaces y enums del dominio
```

### Notas

- `@andina-cargo/shared` **sí es dependencia** de `apps/api` y de `apps/web` (ambas `workspace:*`).
- `packages/shared` **es buildable** → `dist/` (usa `.ts` como fuente; `pnpm build` genera `dist/*.js` + `.d.ts`). Imports internos usan extensión `.js` (NodeNext ESM).
- La API importa archivos con extensión `.js` (convención NodeNext ESM). El panel Next.js usa `moduleResolution: bundler` → imports **sin** extensión.
- `apps/api` usa **Prisma** `@prisma/client` + schema `apps/api/prisma/schema.prisma`. Cliente generado en node_modules. Scripts `prisma:*`.
- Durante Fase 7 se eliminaron los `pnpm-workspace.yaml` y `pnpm-lock.yaml` anidados de `apps/web` (no estándar) para integrar web al workspace raíz y así consumir `@andina-cargo/shared`.
- El panel configura la URL de la API vía `NEXT_PUBLIC_API_URL` (ver `apps/web/.env.example`); default `http://localhost:3000`.
- No existen Docker, docker-compose ni archivos `.env` (solo los `.env.example` de `DATABASE_URL` y `NEXT_PUBLIC_API_URL`).
- Git: la rama tiene cambios de Fase 2 a Fase 7 sin commitear.

---

## Requisitos obligatorios

### A — Ingesta y normalización

- Endpoint que reciba lotes de eventos de un transportista.
- Los tres formatos deben entrar por este mecanismo.
- La normalización es el corazón del ejercicio.
- Normalizar: nombres de campos, estados, fechas, zonas horarias, ubicación.
- Resultado independiente del transportista.
- Agregar un cuarto transportista no debe modificar la lógica central.
- Decisión explícita sobre eventos que no pueden interpretarse.

### B — Persistencia

- Al menos un motor de base de datos real.
- Datos deben sobrevivir a reinicios.
- Seed/datos de ejemplo con: tres transportistas, tres formatos, varios eventos, al menos un shipment con timeline.
- Decisión documentada sobre el modelado.
- Responder: ¿Qué ocurre con el modelo a 2.000.000+ eventos y 4 transportistas?

### C — API de consulta

- `GET /shipments/:trackingNumber` → estado actual, ubicación, timeline completo ordenado.
- `GET /shipments` → listado paginado con al menos un filtro.
- Validación en el borde, códigos HTTP coherentes, errores útiles.

### D — Panel Next.js

- Buscador de guía → Detalle del shipment → Estado actual → Ubicación → Timeline.
- Funcional y legible. Diseño visual no es prioridad.
- Estrategia de fetching/refresco documentada en `DECISIONS.md`.

### E — Tipos y entrega

- Frontend y backend comparten tipos (`packages/shared`).
- TypeScript `strict: true`. Evitar `any`.
- Repositorio público con README, licencia, historial real, mínimo 6 commits significativos.

---

## Opcionales

Solo cuando el núcleo obligatorio esté cerrado. Máximo uno:

1. Reprocesamiento de lotes
2. Actualización en vivo del panel
3. Métricas de ingesta
4. Contrato verificable en runtime
5. Pruebas específicas de normalización

No sacrificar obligatorios por opcionales.

---

## No necesario

No implementar salvo tiempo extra: autenticación, permisos, CI/CD, infraestructura como código, cobertura exhaustiva de tests, diseño visual avanzado, servicios de pago.

---

## Entregables

1. **Repositorio público** — README, licencia, historial real de commits.
2. **Sistema reproducible** — `docker compose up` levanta el proyecto.
3. **DECISIONS.md** — 4-6 decisiones importantes. Formato:
   - Situación / Decisión / Alternativas descartadas / Qué sacrifiqué / Qué rompe a escala 100× / Qué haría con una semana más.
4. **AI.md** — Qué se generó con IA, qué se reescribió, por qué, ejemplo concreto rechazado.
5. **Vídeo** — Máximo 5 minutos, sin edición. Al menos la mitad explicando decisiones.

---

## Arquitectura objetivo

```
Raw Carrier Event
       │
Carrier Adapter
       │
NormalizedEvent
       │
Domain / Persistence
       │
Shipment / ShipmentEvent
       │
Query API
       │
Next.js
```

---

## Arquitectura de despliegue (producción)

**Especificación fija acordada por el equipo** — la infraestructura de producción es:

```
Supabase (PostgreSQL real, destino Fase 4)
     ▲
     │ DATABASE_URL (Prisma)
     │
Render (API NestJS)
     ▲
     │ NEXT_PUBLIC_API_URL
     │
Vercel (panel Next.js web)
```

- **Supabase** → base de datos PostgreSQL real. La API se conecta vía Prisma usando `DATABASE_URL` (connection pooler `*.pooler.supabase.com:6543` + `sslmode=require`). Migración `0001_init` y seed se aplican contra Supabase.
- **Render** → aloja la **API NestJS** (servicio Node). Variables de entorno: `DATABASE_URL` (Supabase) y `PORT`.
- **Vercel** → aloja el **panel Next.js**. Variable de entorno: `NEXT_PUBLIC_API_URL` apuntando a la URL pública de la API en Render.

> Docker/Docker Compose (requisito obligatorio Fase 8) se mantiene como mecanismo de ejecución **local** del proyecto para reproducibilidad, pero la **producción se despliega con Supabase + Render + Vercel**. No sustituir esta especificación por Docker en producción.

Adapters por transportista (en `apps/api/src/normalization/adapters/`):
- `AndesExpressAdapter`
- `TransBolivarAdapter`
- `RutaSurAdapter`

Posteriormente: `FourthCarrierAdapter` sin modificar el core (crear el adapter y registrarlo).

---

## Plan de implementación por fases

### FASE 1 — Bootstrap del monorepo
- Crear monorepo con pnpm, Node 22+, NestJS, Next.js, TypeScript.
- Validar que todo funciona.
- **Estado: COMPLETADA**

### FASE 2 — Shared domain contracts
- Crear contratos en `packages/shared`: `Carrier`, `Shipment`, `ShipmentEvent`, `NormalizedEvent`, `ShipmentStatus`.
- **Estado: COMPLETADA**

### FASE 3 — Normalización de transportistas
- Implementar adapters para Andes Express, TransBolívar, RutaSur.
- Convertir cada formato a `NormalizedEvent`.
- Resolver: campos, estados, fechas, timezone, ciudades, países, payload original.
- Identificación de adapters. Extensibilidad para cuarto carrier.
- Tests de normalización de los tres formatos.
- NO introducir: PostgreSQL, MongoDB, ORM, Redis, frontend, auth.
- **Estado: COMPLETADA**

> Implementación en `apps/api/src/normalization/`. Ver sección "Módulo de normalización (Fase 3)" más abajo.

### FASE 4 — Modelo de datos y persistencia
- Persistencia real (PostgreSQL recomendado a evaluar).
- JSONB para `rawPayload`.
- Schema/migrations, shipments, events, carriers, índices, relaciones, seed.
- Pensar en 2M+ eventos, 4 carriers.
- **Estado: COMPLETADA**

> Implementación en `apps/api/prisma/` + `apps/api/src/db/`. Ver sección "Módulo de persistencia (Fase 4)" más abajo.

### FASE 5 — Endpoint de ingesta
- Recibir lotes hasta 5.000 eventos.
- Request → Validación → Identificación carrier → Adapter → NormalizedEvent → Persistencia.
- Eventos inválidos, duplicados, errores parciales, respuesta del endpoint.
- Estrategia de idempotencia/deduplicación.
- **Estado: COMPLETADA**

> Implementación en `apps/api/src/ingestion/`. Ver sección "Módulo de ingesta (Fase 5)" más abajo.

### FASE 6 — API de consulta
- `GET /shipments/:trackingNumber` y `GET /shipments` (paginado + filtro).
- DTOs, validación, errores HTTP.
- **Estado: COMPLETADA**

> Implementación en `apps/api/src/shipments/`. Ver sección "Módulo de consulta (Fase 6)" más abajo.

### FASE 7 — Panel Next.js
- Buscador → Detalle → Estado → Ubicación → Timeline.
- Consumir API real, tipos de `packages/shared`.
- Documentar estrategia de fetching.
- **Estado: COMPLETADA**

> Implementación en `apps/web/src/app/`, `apps/web/src/components/` y `apps/web/src/lib/`. Ver sección "Módulo panel (Fase 7)" más abajo.

### FASE 8 — Docker + Seed + ejecución reproducible
- `docker compose up` funcional.
- Seed completo con los tres transportistas.
- README con instrucciones claras.
- **Estado: SIGUIENTE**

### FASE 9 — Documentación y decisiones
- `README.md`, `DECISIONS.md`, `AI.md`.
- 4-6 decisiones en DECISIONS.md.
- **Estado: PENDIENTE**

### FASE 10 — Tests y revisión final
- Priorizar: normalización (3 carriers), casos problemáticos, ingesta, consulta, timeline.
- Ejecutar: typecheck, lint, tests, build.
- **Estado: PENDIENTE**

### FASE 11 — Entrega
- Verificar: README, DECISIONS.md, AI.md, LICENSE, Docker, Seed, Tests, Git history.
- Mínimo 6 commits significativos.
- Preparar: repo público, instrucciones, vídeo, resumen de lo faltante.
- **Estado: PENDIENTE**

---

## Reglas para cualquier agente

### 1. No adelantarse
Si se está trabajando en una fase concreta, implementar **solamente esa fase**. No construir funcionalidades de fases posteriores salvo estrictamente necesario.

### 2. Inspeccionar antes de modificar
Antes de cambiar archivos: revisar estructura existente, `package.json`, `tsconfig`, configuración de pnpm, imports, código existente. No sobrescribir archivos completos si basta con modificarlos parcialmente.

### 3. Mantener compatibilidad
No romper `packages/shared`, `apps/api`, `apps/web` sin justificación.

### 4. TypeScript estricto
Mantener `strict: true`. Evitar `any`. Usar `unknown` para datos externos.

### 5. Datos externos no confiables
Todo payload de transportistas es **no confiable**. No asumir que los campos existen, los tipos son correctos, las fechas son válidas o los estados son conocidos.

### 6. Extensibilidad
Agregar un carrier = crear nuevo adapter + configuración/registro. No modificar lógica de negocio central.

### 7. No sobreingeniería
Prueba de ~8 horas. Priorizar: correcto, simple, explicable, mantenible sobre complejo, abstracto, enterprise.

### 8. Git
Cada fase importante debe producir commits significativos. No hacer un commit gigante al final.

### 9. Sin operaciones de remoto
**No ejecutar `git push`, `git pull`, `git fetch`, `gh pr create`, `gh issue create`, ni ninguna operación sobre el repositorio remoto** a menos que el usuario lo solicite explícitamente y por escrito.

### 10. Prioridad del código real
**El estado real del código siempre tiene prioridad sobre lo que diga este documento.** Si el agente encuentra que una fase ya está parcialmente implementada, debe: identificarla, explicarlo, conservar lo existente, adaptar el plan, no duplicar implementaciones.

---

## Presupuesto de tiempo

| Actividad                | Horas |
|--------------------------|-------|
| Lectura + diseño         | 1 h   |
| Normalización + modelo   | 2 h   |
| Ingesta + persistencia   | 2 h   |
| API consulta             | 1 h   |
| Panel                    | 1.5 h |
| Documentación + vídeo    | 1.5 h |

Si una funcionalidad amenaza el tiempo: **recortar alcance antes que entregar funcionalidades incompletas.**

---

## Siguiente tarea

**Fase 8 — Docker + Seed + ejecución reproducible**, conectando la base real **Supabase** y desplegando API en **Render** + panel en **Vercel** según la especificación de despliegue (ver sección "Arquitectura de despliegue (producción)").

---

## Módulo de normalización (Fase 3)

Ubicación: `apps/api/src/normalization/`. Sin dependencia de Nest/persistencia/HTTP: es lógica de dominio pura que la Fase 5 (ingesta) consumirá.

```
normalization/
├── carrier-adapter.ts        interfaz CarrierAdapter (code, name, supports, normalize)
├── carrier-registry.ts       identificación por predicado supports(payload)
├── normalization.service.ts  punto de entrada único normalize(payload)
├── normalization.ts          wiring por defecto: 3 adapters + normalizationService singleton
├── normalization-errors.ts   NormalizationError (code + trackingNumber)
├── status-mapper.ts          mapa central de aliases (ES/EN, sin acentos) → ShipmentStatus
├── helpers.ts                requireString / parseIsoDate / parseUnixSeconds / parseLocalDateTime
├── carriers.ts               metadatos Carrier de los 3 transportistas
├── adapters/
│   ├── andes-express.ts
│   ├── trans-bolivar.ts
│   └── ruta-sur.ts
└── normalization.spec.ts     tests de los 3 formatos + casos problemáticos
```

### Contratos
- Todo adapter devuelve `NormalizedEvent` de `@andina-cargo/shared`.
- **Extensibilidad**: agregar un carrier = nuevo archivo en `adapters/` + registrarlo en `normalization.ts`. No tocar el core (`CarrierRegistry` itera adapters y elige por `supports`).

### Decisiones de normalización (detalle en DECISIONS.md en Fase 9)
- **Identificación**: cada adapter expone `supports(payload)`; el registry usa el primer match. Granularidad mutuamente excluyente entre los 3 formatos.
- **Estados**: mapa central de aliases normalizados (lowercase, sin acentos, solo alfanuméricos).
- **TransBolívar**: estado por `label` (fiable) con fallback a tabla de códigos numéricos (`1`..`5`); fecha = `occurred_at` Unix en segundos.
- **RutaSur**: fecha `DD/MM/YYYY HH:mm` sin timezone interpretada como **Colombia (America/Bogota, UTC-5)** → determinista.
- **Andes Express**: `ts` ISO 8601.
- **Country**: solo se asigna si el payload lo provee (no se inventa).
- **Eventos no interpretables**: lanza `NormalizationError` con código (`MISSING_FIELD`, `INVALID_DATE`, `UNKNOWN_STATUS`, `UNSUPPORTED_CARRIER`) y `trackingNumber` opcional. La Fase 5 decidirá cómo rechazarlos/omitirlos en el lote.

---

## Módulo de persistencia (Fase 4)

Ubicación: `apps/api/prisma/` + `apps/api/src/db/`. PostgreSQL vía Prisma, destino Supabase.

```
apps/api/
├── prisma/
│   ├── schema.prisma          Carrier, Shipment, ShipmentEvent, enum ShipmentStatus
│   ├── migrations/0001_init/  migración inicial (creada offline con migrate diff)
│   └── seed.ts                seed idempotente (3 carriers + timelines)
└── src/db/
    ├── prisma.service.ts      PrismaClient inyectable (OnModuleInit/Destroy)
    └── db.module.ts           DbModule global que exporta PrismaService
```

### Modelo
- `enum ShipmentStatus`: los 5 estados idénticos a `@andina-cargo/shared` (mapeo 1:1).
- `Carrier` (`id` cuid, `code` unique, `name`).
- `Shipment`: `@@unique([trackingNumber, carrierId])`, `current*` denormalizado (estado actual), índices `(carrierId, currentStatus)` y `(updatedAt)`.
- `ShipmentEvent`: `dedupeKey @unique` (deduplicación), `rawPayload Jsonb`, `occurredAt Timestamptz(6)`, índices `(shipmentId, occurredAt DESC)` y `(carrierId, occurredAt DESC)`. `onDelete: Cascade` (eventos) / `Restrict` (carrier).

### Decisiones
- **Deduplicación**: `dedupeKey` = hash SHA-256 del evento normalizado canónico. Se usa con `createMany({ skipDuplicates })`.
- **Escala 2M+ / 4 carriers**: denormalización `current*` + índices B-tree. A 100×: particionar `ShipmentEvent` por `occurredAt` o índice BRIN (documentado, no implementado aún).
- Config: `.env.example` con `DATABASE_URL` Supabase. `prisma:generate/validate/migrate/push/seed/studio`.

---

## Módulo de ingesta (Fase 5)

Ubicación: `apps/api/src/ingestion/`. Endpoint `POST /ingest`.

```
ingestion/
├── ingestion.controller.ts   POST /ingest + validación de envelope
├── ingestion.service.ts      orquestación: normalize → dedupe → persistir (transacción atómica)
├── ingestion.module.ts       providers: IngestionService + NormalizationService (reutiliza F3)
├── envelope.ts               validateEnvelope (array no vacío, ≤5000, objetos planos) + MAX_BATCH_SIZE
├── dedupe-key.ts             sha256 del evento normalizado canónico (reutilizado por seed)
└── *.spec.ts                 dedupe-key, envelope, ingestion.service (Prisma mockeado)
```

### Comportamiento
- **Auto-detección**: la `NormalizationService` identifica el carrier por evento (`supports()`), sin carrierCode en la ruta → agregar un 4º carrier no toca el core.
- **Validación en el borde**: envelope inválido → `400` (no array, vacío, >5000, elemento no-objeto). Errores por evento NO descartan el lote.
- **Flujo**: normalize por evento (fallos → lista `rejected`, continúa) → dedupe in-batch (primera ocurrencia por `dedupeKey`) → carriers `code→id` (1 query/lote) → shipments existentes + `createMany skipDuplicates` (3 queries/lote) → `createMany` de eventos con `skipDuplicates` (dedup cross-batch) → `updateMany` condicional del `current*` (solo avanza si es más nuevo → no regresa con eventos fuera de orden).
- **Transacción**: `prisma.$transaction` (atómico); un fallo de persistencia hace rollback completo.
- **Respuesta**: `200` con `{ received, created, duplicates, updatedShipments, rejected[] }`; `400` envelope; `500` error de DB.
- `main.ts`: límite de body JSON subido a `10mb` (5000 eventos superan los 100kb por defecto).

---

## Módulo de consulta (Fase 6)

Ubicación: `apps/api/src/shipments/`. Endpoints `GET /shipments` y `GET /shipments/:trackingNumber`.

```
shipments/
├── shipments.controller.ts    GET :trackingNumber + GET listado; valida query; códigos HTTP
├── shipments.service.ts       queries Prisma: detalle (con timeline) + listado paginado
├── shipments.module.ts        providers: ShipmentsService
├── shipments-query.ts         parseShipmentsQuery (page, limit, status, carrierCode, city)
└── *.spec.ts                  shipments-query, shipments.controller, shipments.service (Prisma mockeado)
```

Registrado en `AppModule` (junto a `DbModule` global que provee `PrismaService`).

### Comportamiento
- **`GET /shipments/:trackingNumber`**: devuelve `{ shipments: ShipmentDetail[] }` (puede haber varias guías con el mismo número en distintos carriers). Cada elemento incluye `carrier`, estado/ubicación actual y `timeline` ordenado por `occurredAt` ascendente. Tipos de `@andina-cargo/shared`.
  - Query por `trackingNumber` (índice `@@unique([trackingNumber, carrierId])`) + busca `events` vía índice `(shipmentId, occurredAt)`.
  - No encontrado → `404` con mensaje útil; `trackingNumber` vacío → `400`.
- **`GET /shipments`**: listado paginado con filtros. Query params: `page` (≥1, default 1), `limit` (≥1, ≤100, default 20), `status`, `carrierCode`, `city`.
  - Filtros: `status` → `currentStatus`, `carrierCode` → `carrier.code`, `city` → `currentCity` (contains, case-insensitive).
  - Orden por `updatedAt DESC` (aprovecha `@@index([updatedAt])`); denormalizado `current*` evita escanear eventos (aprovecha `@@index([carrierId, currentStatus])`).
  - Respuesta: `{ data: ShipmentListItem[], meta: { page, limit, total, totalPages } }`.
  - Query inválida → `400` con mensaje.
- **Validación en el borde**: `parseShipmentsQuery` valida tipos, rangos y valores de estado (solo los 5 del enum) antes de tocar la BD.
- **Tipos compartidos**: respuestas modeladas con `Shipment`, `ShipmentEvent`, `ShipmentStatus` de `@andina-cargo/shared` (casts explícitos de `$Enums.ShipmentStatus` → shared por ser tipos nominalmente distintos a nivel de TS, mismo valor en runtime).

---

## Módulo panel (Fase 7)

Ubicación: `apps/web/src/`. SPA mínima sobre el API de consulta (Fase 6).

```
apps/web/src/
├── app/
│   ├── layout.tsx            metadata + lang es
│   ├── page.tsx              server component → renderiza TrackingPage
│   └── tracking-client.tsx   estado del buscador: query/loading/error/datos
├── components/
│   ├── tracking-panel.tsx    orquestación de estados (carga, vacío, error, datos)
│   ├── tracking-form.tsx     input de guía + botón Buscar
│   ├── shipment-card.tsx     detalle: carrier, guía, estado actual, ubicación, timeline
│   └── status-message.tsx    mensaje contextual (info/error/empty)
└── lib/
    ├── api.ts                cliente fetch del API + tipos de respuesta (usa @andina-cargo/shared)
    └── status-labels.ts      mapa ShipmentStatus → etiqueta ES + formateo de fecha
```

### Estrategia de fetching y refresco

- **Consumo del API**: `lib/api.ts` expone `fetchShipmentByTrackingNumber(guia)` que llama a `GET {NEXT_PUBLIC_API_URL}/shipments/{guia}` y tipa la respuesta con `@andina-cargo/shared` (`Shipment`, `ShipmentEvent`, `Carrier`). Cada llamada usa `fetch(..., { cache: 'no-store' })` para no cachear en Next y reflejar datos frescos.
- **URL base**: variable de entorno `NEXT_PUBLIC_API_URL` (ver `apps/web/.env.example`), default `http://localhost:3000`. Desarrollo local → apunta a la API NestJS local; despliegue Vercel → se configura la URL del entorno.
- **Componente cliente**: `tracking-client.tsx` (marcado `'use client'`) gestiona `query`, `loading`, `error`, `shipments` y `hasSearched`. La búsqueda se dispara con el submit del form.
- **Estados de UI** en `tracking-panel.tsx`: `loading` (mensaje "Buscando…"), `error` (mensaje del `ApiError`, incluye el 404 con el texto de la API), vacío (sin resultados de la API) y datos (una `ShipmentCard` por envío).
- **Timeline**: el API ya devuelve `timeline` ordenado por `occurredAt` ascendente; el panel lo pinta en orden. Estados y fechas se presentan en español (`status-labels.ts`, timezone America/Bogota).
- **Refresco**: no hay auto-refresh ni live update (fuera de alcance). Cada búsqueda es una petición nueva; al re-buscar se resetean datos y errores.
- **Sin SSR de datos**: la página es estática (`○` prerendered); el fetching ocurre 100% en el cliente tras la interacción del usuario (no hay datos sensibles que precargar, prioridad simplicidad).
