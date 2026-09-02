'use client'

interface Props {
  query: string
  loading: boolean
  onChange: (value: string) => void
  onSubmit: () => void
}

export function TrackingForm({ query, loading, onChange, onSubmit }: Props) {
  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!loading) onSubmit()
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full gap-2" role="search">
      <input
        type="search"
        value={query}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ej. AC-4471"
        aria-label="Número de guía"
        className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      />
      <button
        type="submit"
        disabled={loading || query.trim() === ''}
        className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {loading ? 'Buscando…' : 'Buscar'}
      </button>
    </form>
  )
}
