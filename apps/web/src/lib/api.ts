import type { Carrier, Shipment, ShipmentEvent } from '@andina-cargo/shared'

export interface ShipmentDetail extends Shipment {
  carrier: Carrier
  timeline: ShipmentEvent[]
}

export interface ShipmentDetailResponse {
  shipments: ShipmentDetail[]
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'
}

/**
 * Consulta la guía determinada y devuelve sus envíos (puede haber varias guías
 * con el mismo número en distintos transportistas). Lanza `ApiError` con el
 * código HTTP en caso de error.
 */
export async function fetchShipmentByTrackingNumber(trackingNumber: string): Promise<ShipmentDetail[]> {
  const url = `${apiBaseUrl()}/shipments/${encodeURIComponent(trackingNumber.trim())}`
  const res = await fetch(url, { cache: 'no-store' })

  if (!res.ok) {
    // 404 (no encontrado) y 400 (guía inválida) devuelven el mensaje de la API.
    let message = `Error ${res.status} al consultar la guía`
    try {
      const body = (await res.json()) as { message?: unknown }
      if (typeof body?.message === 'string') message = body.message
    } catch {
      // sin cuerpo JSON válido; queda el mensaje por defecto
    }
    throw new ApiError(message, res.status)
  }

  const data = (await res.json()) as ShipmentDetailResponse
  return data.shipments
}
