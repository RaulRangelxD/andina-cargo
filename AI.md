# AI.md — Cómo usé la IA en Andina Cargo

La IA se usó como **copiloto de implementación rápida**, no como diseñadora de la solución. El diseño del dominio (el modelo de cinco estados, la normalización por adaptadores, la deduplicación por huella, el despliegue Supabase + Render + Vercel) fue decisión técnica mía, siguiendo el encargo y documentada en `DECISIONS.md`.

## Qué se generó con IA

- **Andamiaje y estructura**: la base del monorepo pnpm, los scaffolds de proyectos (API NestJS, paquete `shared`, panel Next.js), y la configuración de tooling (tsc strict, vitest, oxlint) los generó la IA a partir de las instrucciones y de un encargo claro de fases.
- **Plantillas de adaptadores**: los tres adaptadores de normalización (Andes Express, TransBolívar, RutaSur) nacieron como borrador generado, montados sobre el contrato `NormalizedEvent` que definí yo.
- **Código de relleno (glue)**: los módulos de ingesta, consulta y el panel (fetch, componentes de UI) los escribió la IA como primer borrador operativo sobre los contratos compartidos ya decididos.

## Qué reescribí y por qué

- **La normalización de estados y fechas** la reescribí a mano. El primer borrador de la IA encadenaba `if/else` por transportista en un solo sitio, violando la regla "agregar un cuarto transportista no toca el núcleo". Lo rehíce como adaptadores independientes más un registro (registry) con resolución por `supports()`.
- **La deduplicación** la reescribí para que firmara el evento **normalizado** y no el payload crudo. La versión de la IA firmaba el JSON original, y eso habría duplicado el mismo aviso cuando el transportista varía el "texto" aunque el evento sea el mismo (ver el ejemplo rechazado abajo).
- **El "estado actual"** lo reescribí con la regla de "solo avanza si es más nuevo", para que un evento fuera de orden no haga retroceder un paquete a "en tránsito" habiendo estado "entregado".
- **El despliegue** lo reescribí: la IA propuso repetidamente `docker compose` local, y para esta prueba evaluada lo correcto es producción en línea (base real + API + panel), que es lo que se puede abrir y ver funcionando.

## Un ejemplo concreto que rechacé y por qué

La IA propuso deduplicar los eventos de ingesta **calculando el hash sobre el `rawPayload`** (el JSON tal cual llega del transportista) y almacenarlo como clave única.

**Motivo técnico del rechazo**: el payload crudo no es estable. El mismo aviso lógico —guía `AC-4471`, "en tránsito", Cúcuta, misma fecha— llega con variaciones triviales según el transportista (orden de campos, espacios, capitalización, un campo extra). Dos representaciones distintas del mismo evento darían **hashes distintos**, la clave única nunca colisionaría y el mismo aviso se guardaría duplicado, ensuciando la historia del paquete que ve el agente.

Lo reemplacé por una huella sobre el **evento ya normalizado** (`trackingNumber`, `carrierCode`, `occurredAt`, `status`, `city`, `country`) con un JSON canónico estable y SHA-256 (`apps/api/src/ingestion/dedupe-key.ts`). Así, el mismo evento lógico siempre produce la misma huella, se marca como duplicado y no se repite, que es exactamente el comportamiento que necesita el negocio.
