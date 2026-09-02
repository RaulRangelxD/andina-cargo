'use client'

import { useState } from 'react'
import { ApiError, fetchShipmentByTrackingNumber, ShipmentDetail } from '../lib/api'
import { TrackingPanel } from '../components/tracking-panel'

export function TrackingPage() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shipments, setShipments] = useState<ShipmentDetail[]>([])
  const [hasSearched, setHasSearched] = useState(false)

  async function handleSearch() {
    const trackingNumber = query.trim()
    if (trackingNumber === '' || loading) return

    setLoading(true)
    setError(null)
    setShipments([])
    try {
      const results = await fetchShipmentByTrackingNumber(trackingNumber)
      setShipments(results)
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setShipments([])
      } else {
        setError(err instanceof Error ? err.message : 'Ocurrió un error inesperado')
      }
    } finally {
      setHasSearched(true)
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-100 px-4 py-10 dark:bg-black">
      <TrackingPanel
        query={query}
        loading={loading}
        error={error}
        shipments={shipments}
        hasSearched={hasSearched}
        onChange={setQuery}
        onSearch={handleSearch}
      />
    </div>
  )
}
