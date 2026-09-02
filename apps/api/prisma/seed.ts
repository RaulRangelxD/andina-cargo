import { createHash } from 'node:crypto'
import { PrismaClient, ShipmentStatus, type Prisma } from '@prisma/client'

const prisma = new PrismaClient()

interface SeedNormalizedEvent {
  trackingNumber: string
  carrierId: string
  carrierCode: string
  status: ShipmentStatus
  occurredAt: Date
  city: string
  country?: string
  rawPayload: unknown
}

// Mismo criterio que la ingesta (Fase 5): hash SHA-256 del evento normalizado
// canónico. Garantiza unicidad en ShipmentEvent.dedupeKey.
function dedupeKey(event: SeedNormalizedEvent): string {
  const canonical = JSON.stringify({
    trackingNumber: event.trackingNumber,
    carrierCode: event.carrierCode,
    occurredAt: event.occurredAt.toISOString(),
    status: event.status,
    city: event.city,
    country: event.country ?? null,
  })
  return createHash('sha256').update(canonical).digest('hex')
}

const carriers = [
  { id: 'carrier-andes-express', code: 'andes-express', name: 'Andes Express' },
  { id: 'carrier-trans-bolivar', code: 'trans-bolivar', name: 'TransBolívar' },
  { id: 'carrier-ruta-sur', code: 'ruta-sur', name: 'RutaSur' },
]

interface SeedShipment {
  trackingNumber: string
  carrierId: string
  carrierCode: string
  events: Array<Omit<SeedNormalizedEvent, 'trackingNumber' | 'carrierId' | 'carrierCode'>>
}

const shipments: SeedShipment[] = [
  {
    trackingNumber: 'AC-4471',
    carrierId: 'carrier-andes-express',
    carrierCode: 'andes-express',
    events: [
      {
        status: ShipmentStatus.picked_up,
        occurredAt: new Date('2026-08-29T18:00:00.000Z'),
        city: 'Bogotá',
        country: 'CO',
        rawPayload: { guia: 'AC-4471', evento: 'RECOGIDO', ts: '2026-08-29T18:00:00Z', ciudad: 'Bogotá' },
      },
      {
        status: ShipmentStatus.in_transit,
        occurredAt: new Date('2026-08-30T14:22:10.000Z'),
        city: 'Cúcuta',
        country: 'CO',
        rawPayload: { guia: 'AC-4471', evento: 'EN_TRANSITO', ts: '2026-08-30T14:22:10Z', ciudad: 'Cúcuta' },
      },
      {
        status: ShipmentStatus.out_for_delivery,
        occurredAt: new Date('2026-08-31T10:05:00.000Z'),
        city: 'Cúcuta',
        country: 'CO',
        rawPayload: { guia: 'AC-4471', evento: 'EN_REPARTO', ts: '2026-08-31T10:05:00Z', ciudad: 'Cúcuta' },
      },
      {
        status: ShipmentStatus.delivered,
        occurredAt: new Date('2026-08-31T15:40:30.000Z'),
        city: 'Cúcuta',
        country: 'CO',
        rawPayload: { guia: 'AC-4471', evento: 'ENTREGADO', ts: '2026-08-31T15:40:30Z', ciudad: 'Cúcuta' },
      },
    ],
  },
  {
    trackingNumber: 'TB-8820',
    carrierId: 'carrier-trans-bolivar',
    carrierCode: 'trans-bolivar',
    events: [
      {
        status: ShipmentStatus.picked_up,
        occurredAt: new Date('2026-08-29T17:30:00.000Z'),
        city: 'Maracaibo',
        country: 'VE',
        rawPayload: {
          tracking_number: 'TB-8820',
          status: { code: 1, label: 'picked up' },
          occurred_at: Math.floor(new Date('2026-08-29T17:30:00.000Z').getTime() / 1000),
          location: { city: 'Maracaibo', country: 'VE' },
        },
      },
      {
        status: ShipmentStatus.in_transit,
        occurredAt: new Date('2026-08-30T13:00:00.000Z'),
        city: 'Valencia',
        country: 'VE',
        rawPayload: {
          tracking_number: 'TB-8820',
          status: { code: 3, label: 'in transit' },
          occurred_at: Math.floor(new Date('2026-08-30T13:00:00.000Z').getTime() / 1000),
          location: { city: 'Valencia', country: 'VE' },
        },
      },
      {
        status: ShipmentStatus.incident,
        occurredAt: new Date('2026-08-31T09:12:00.000Z'),
        city: 'Valencia',
        country: 'VE',
        rawPayload: {
          tracking_number: 'TB-8820',
          status: { code: 4, label: 'incident' },
          occurred_at: Math.floor(new Date('2026-08-31T09:12:00.000Z').getTime() / 1000),
          location: { city: 'Valencia', country: 'VE' },
        },
      },
    ],
  },
  {
    trackingNumber: 'RS-3045',
    carrierId: 'carrier-ruta-sur',
    carrierCode: 'ruta-sur',
    events: [
      {
        status: ShipmentStatus.picked_up,
        occurredAt: new Date('2026-08-29T17:50:00.000Z'),
        city: 'Medellín',
        rawPayload: { guia: 'RS-3045', estado: 'Recogido', fecha: '29/08/2026 12:50', lugar: 'Medellín' },
      },
      {
        status: ShipmentStatus.in_transit,
        occurredAt: new Date('2026-08-30T15:22:00.000Z'),
        city: 'Cali',
        rawPayload: { guia: 'RS-3045', estado: 'EnRuta', fecha: '30/08/2026 10:22', lugar: 'Cali' },
      },
      {
        status: ShipmentStatus.out_for_delivery,
        occurredAt: new Date('2026-08-31T13:30:00.000Z'),
        city: 'Cali',
        rawPayload: { guia: 'RS-3045', estado: 'EnReparto', fecha: '31/08/2026 08:30', lugar: 'Cali' },
      },
    ],
  },
]

async function seedCarriers() {
  for (const carrier of carriers) {
    await prisma.carrier.upsert({
      where: { id: carrier.id },
      update: { code: carrier.code, name: carrier.name },
      create: carrier,
    })
  }
}

async function seedShipment(shipment: SeedShipment) {
  const fullEvents: SeedNormalizedEvent[] = shipment.events.map((e) => ({
    ...e,
    trackingNumber: shipment.trackingNumber,
    carrierId: shipment.carrierId,
    carrierCode: shipment.carrierCode,
  }))

  const last = fullEvents[fullEvents.length - 1]

  await prisma.shipment.upsert({
    where: {
      trackingNumber_carrierId: {
        trackingNumber: shipment.trackingNumber,
        carrierId: shipment.carrierId,
      },
    },
    create: {
      trackingNumber: shipment.trackingNumber,
      carrierId: shipment.carrierId,
      currentStatus: last.status,
      currentCity: last.city,
      currentOccurredAt: last.occurredAt,
      events: {
        createMany: {
          data: fullEvents.map((e) => ({
            status: e.status,
            city: e.city,
            country: e.country,
            occurredAt: e.occurredAt,
            carrierId: shipment.carrierId,
            dedupeKey: dedupeKey(e),
            rawPayload: e.rawPayload as Prisma.InputJsonValue,
          })),
        },
      },
    },
    update: {
      currentStatus: last.status,
      currentCity: last.city,
      currentOccurredAt: last.occurredAt,
    },
  })
}

async function main() {
  await seedCarriers()
  for (const shipment of shipments) {
    await seedShipment(shipment)
  }
  const eventCount = await prisma.shipmentEvent.count()
  const shipmentCount = await prisma.shipment.count()
  console.log(`Seed completo: ${carriers.length} carriers, ${shipmentCount} shipments, ${eventCount} eventos.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
