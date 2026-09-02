'use client'

import type { ShipmentEvent } from '@andina-cargo/shared'
import { ShipmentDetail } from '../lib/api'
import { formatOccurredAt, statusLabel } from '../lib/status-labels'

interface Props {
  shipment: ShipmentDetail
}

export function ShipmentCard({ shipment }: Props) {
  const locationText = shipment.currentCity || '—'

  return (
    <article className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Transportista</p>
          <p className="font-medium">{shipment.carrier?.name ?? shipment.carrierId}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Guía</p>
          <p className="font-mono font-medium">{shipment.trackingNumber}</p>
        </div>
      </header>

      <dl className="my-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-zinc-500 dark:text-zinc-400">Estado actual</dt>
          <dd className="mt-0.5 inline-block rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium dark:bg-zinc-800">
            {statusLabel(shipment.currentStatus)}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-zinc-500 dark:text-zinc-400">Ubicación</dt>
          <dd className="mt-0.5 font-medium">{locationText}</dd>
        </div>
      </dl>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          Línea de tiempo
        </h2>
        {shipment.timeline.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Sin eventos registrados.</p>
        ) : (
          <ol className="relative border-l border-zinc-200 pl-4 dark:border-zinc-800">
            {shipment.timeline.map((event) => (
              <TimelineItem key={event.id} event={event} />
            ))}
          </ol>
        )}
      </section>
    </article>
  )
}

function TimelineItem({ event }: { event: ShipmentEvent }) {
  return (
    <li className="relative pb-4 last:pb-0">
      <span
        aria-hidden
        className="absolute -left-[calc(1rem+3px)] top-1 h-1.5 w-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500"
      />
      <p className="font-medium">{statusLabel(event.status)}</p>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        {event.city}
        {event.country ? `, ${event.country}` : ''} · {formatOccurredAt(event.occurredAt)}
      </p>
    </li>
  )
}
