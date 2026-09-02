'use client'

import { StatusMessage } from './status-message'
import { TrackingForm } from './tracking-form'
import { ShipmentCard } from './shipment-card'
import type { ShipmentDetail } from '../lib/api'

interface Props {
  query: string
  loading: boolean
  error: string | null
  shipments: ShipmentDetail[]
  hasSearched: boolean
  onChange: (value: string) => void
  onSearch: () => void
}

export function TrackingPanel({ query, loading, error, shipments, hasSearched, onChange, onSearch }: Props) {
  return (
    <main className="flex w-full max-w-2xl flex-1 flex-col gap-6">
      <section>
        <h1 className="text-2xl font-semibold">Andina Cargo</h1>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">
          Consulta el estado y la historia de tu guía.
        </p>
      </section>

      <TrackingForm query={query} loading={loading} onChange={onChange} onSubmit={onSearch} />

      {loading ? (
        <StatusMessage tone="info">Buscando la guía…</StatusMessage>
      ) : error ? (
        <StatusMessage tone="error">{error}</StatusMessage>
      ) : hasSearched ? (
        shipments.length === 0 ? (
          <StatusMessage tone="empty">
            No se encontraron envíos. Verificá el número de guía e intentá de nuevo.
          </StatusMessage>
        ) : (
          <section className="flex flex-col gap-6">
            {shipments.map((shipment) => (
              <ShipmentCard key={shipment.id} shipment={shipment} />
            ))}
          </section>
        )
      ) : null}
    </main>
  )
}
