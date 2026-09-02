interface Props {
  tone: 'info' | 'error' | 'empty'
  children: React.ReactNode
}

const TONES: Record<Props['tone'], string> = {
  info: 'border-zinc-300 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300',
  error: 'border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300',
  empty: 'border-zinc-300 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300',
}

export function StatusMessage({ tone, children }: Props) {
  return (
    <p role="status" className={`rounded-md border px-4 py-3 text-sm ${TONES[tone]}`}>
      {children}
    </p>
  )
}
