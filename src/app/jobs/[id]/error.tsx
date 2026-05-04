'use client'

import { ErrorPage } from '@/components/ErrorPage'

export default function JobDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <ErrorPage error={error} reset={reset} route="/jobs/[id]" />
}
