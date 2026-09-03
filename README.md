# Andina Cargo

Technical test for Crazy Imagine Software.

Sistema de seguimiento de envíos que recibe eventos de varios transportistas con
formatos distintos, los normaliza en un modelo único de dominio y expone una API
de consulta junto a un panel web. El equipo de atención al cliente busca una guía
y consulta su historia desde una sola interfaz, sin tocar los portales de cada
transportista.

## Contenido

- [Stack](#stack)
- [Arquitectura](#arquitectura)
- [Estructura del monorepo](#estructura-del-monorepo)
- [Puesta en marcha](#puesta-en-marcha)
- [Scripts](#scripts)
- [Despliegue (producción)](#despliegue-producción)
- [Documentación de decisiones](#documentación-de-decisiones)

## Stack

- Node.js 22+
- TypeScript (strict) de principio a fin
- NestJS (API)
- Next.js (panel web)
- PostgreSQL vía Prisma (destino Supabase)
- pnpm (package manager)

## Arquitectura

```
Transportista
     │ lote de eventos (≤ 5.000, hasta 3× al día)
     ▼
API NestJS
     │
  Validación en el borde
     │
Normalización (adapter por transportista)
     │
Persistencia (deduplicación por huella)
     │
API de consulta (GET /shipments…)
     │
Panel Next.js → Camila busca una guía
```

La clave es la **normalización**: cada transportista (Andes Express, TransBolívar,
RutaSur) tiene un adaptador que traduce su formato a un `NormalizedEvent` de
`@andina-cargo/shared` con un vocabulario común de cinco estados, fecha normalizada
y ciudad. El resto del sistema solo conoce ese modelo único. Agregar un cuarto
transportista es escribir un adaptador y registrarlo, sin tocar el núcleo.

## Estructura del monorepo

```
andina-cargo/
├── apps/
│   ├── api/                  NestJS 12 (ingesta + consulta + persistencia)
│   │   └── prisma/           schema, migraciones y seed
│   └── web/                  Next.js 16 (panel de consulta)
└── packages/
    └── shared/               Contratos de dominio compartidos (buildable → dist/)
```

## Puesta en marcha

Requisitos: Node.js 22+, pnpm 11+.

### 1) Instalar dependencias

```bash
pnpm install
```

### 2) Base de datos (PostgreSQL / Supabase)

Copia la plantilla y completa con tu cadena de conexión:

```bash
cp apps/api/.env.example apps/api/.env   # Windows: copy apps\api\.env.example apps\api\.env
```

Genera el cliente de Prisma y aplica la migración:

```bash
pnpm --filter api prisma:generate
pnpm --filter api prisma:migrate
```

Carga los datos de ejemplo (3 transportistas + timelines):

```bash
pnpm --filter api prisma:seed
```

### 3) Levantar la API (puerto 3000)

```bash
pnpm dev:api
```

### 4) Configurar y levantar el panel web (puerto 3001)

```bash
cp apps/web/.env.example apps/web/.env.local   # copia los .env.example necesarios
pnpm dev:web
```

Abre `http://localhost:3001`, escribe una guía de ejemplo (`AC-4471`, `TB-8820`,
`RS-3045`) y consulta su timeline.

## Scripts

| Comando            | Descripción                                     |
|--------------------|-------------------------------------------------|
| `pnpm dev:api`     | Arranca la API NestJS en modo watch             |
| `pnpm dev:web`     | Arranca el panel Next.js en el puerto 3001      |
| `pnpm build`       | Compila todos los paquetes                      |
| `pnpm test`        | Ejecuta la suite de tests de la API             |
| `pnpm --filter api lint`  | Lint de la API (oxlint)                  |
| `pnpm --filter web lint`  | Lint del panel (eslint)                  |
| `pnpm --filter @andina-cargo/shared typecheck` | Typecheck de shared |

## Despliegue (producción)

```
Supabase (PostgreSQL) ←─ DATABASE_URL (Prisma) ←─ Render (API NestJS) ←─ NEXT_PUBLIC_API_URL ←─ Vercel (panel Next.js)
```

- **Supabase** → base de datos PostgreSQL real. La API se conecta vía Prisma
  (`DATABASE_URL`, transaction pooler `*.pooler.supabase.com:6543` + `sslmode=require`).
- **Render** → aloja la API NestJS. Variables: `DATABASE_URL` y `PORT`.
- **Vercel** → aloja el panel Next.js. Variable: `NEXT_PUBLIC_API_URL` apuntando
  a la URL pública de la API.

## Documentación de decisiones

- [`DECISIONS.md`](./DECISIONS.md) — las 6 decisiones de diseño en lenguaje de negocio.
- [`AI.md`](./AI.md) — qué se generó con IA, qué se reescribió y por qué.
- [`LICENSE`](./LICENSE) — MIT.
