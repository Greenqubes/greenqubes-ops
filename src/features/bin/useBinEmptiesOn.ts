'use client'

import { useEffect, useState } from 'react'
import { emptiesOn, parseRetention } from '@/lib/utils/bin-rules'
import { fmtDate } from '@/features/leave/format'

/** The date a job deleted NOW could still be restored until, formatted for the
 *  delete confirmations ("10 Sep 2026", English in every language). Null until
 *  loaded — the confirm shows "…" in its place until then. */
export function useBinEmptiesOn(enabled: boolean): string | null {
  const [date, setDate] = useState<string | null>(null)
  useEffect(() => {
    if (!enabled) return
    let live = true
    fetch('/api/bin/settings')
      .then(r => (r.ok ? r.json() : null))
      .then(j => { if (live && j) setDate(fmtDate(emptiesOn(new Date().toISOString(), parseRetention(j.retention)))) })
      .catch(() => { /* the confirm simply shows no date */ })
    return () => { live = false }
  }, [enabled])
  return date
}
