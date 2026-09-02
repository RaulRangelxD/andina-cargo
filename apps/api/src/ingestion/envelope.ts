export const MAX_BATCH_SIZE = 5000;

/**
 * Validates the raw request envelope: a non-empty array of up to MAX_BATCH_SIZE
 * plain objects. Per-event semantic validation is done by the normalization
 * adapters (Fase 3), not here.
 */
export function validateEnvelope(body: unknown): { ok: true; events: unknown[] } | { ok: false; message: string } {
  if (!Array.isArray(body)) {
    return { ok: false, message: 'El body debe ser un array de eventos' };
  }
  if (body.length === 0) {
    return { ok: false, message: 'El array de eventos no puede estar vacío' };
  }
  if (body.length > MAX_BATCH_SIZE) {
    return { ok: false, message: `Se permiten hasta ${MAX_BATCH_SIZE} eventos por lote` };
  }
  for (let i = 0; i < body.length; i++) {
    const item = body[i];
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      return { ok: false, message: `El elemento en el índice ${i} debe ser un objeto` };
    }
  }
  return { ok: true, events: body };
}
