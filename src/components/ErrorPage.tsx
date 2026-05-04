'use client'

import { useEffect } from 'react'

type Props = {
  error: Error & { digest?: string }
  reset: () => void
  route: string
}

export function ErrorPage({ error, reset, route }: Props) {
  useEffect(() => {
    fetch('/api/crash', {
      method:  'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        route,
        errorMessage: error.message,
        stackTrace:   error.stack,
      }),
    }).catch(() => {})
  }, [error, route])

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center gap-4 px-4">
      <p className="font-display text-2xl text-ink font-medium tracking-tight">
        Something went wrong
      </p>
      <p className="text-sm text-muted text-center max-w-sm">
        This error has been logged. Tap below to try again.
      </p>
      <button
        onClick={reset}
        className="text-sm font-medium text-terracotta underline underline-offset-2"
      >
        Try again
      </button>
    </div>
  )
}
