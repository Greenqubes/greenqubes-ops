'use client'

import { useCallback, useEffect, useState } from 'react'

// Collapse state for a job-form card, remembered per device. Collapse is a
// PC-only affordance — callers hide the toggle and the collapsed state below
// lg. localStorage is read after mount only, never during render (the
// /schedule hydration #418 rule).
export function useCardCollapse(storageKey: string) {
  const [open, setOpen] = useState(true)

  // Force the card open — for a validation error inside a card the person has
  // folded away on PC. Remembered like any other open, so it stays open.
  const forceOpen = useCallback(() => {
    setOpen(prev => {
      if (prev) return prev
      try { localStorage.setItem(storageKey, 'open') } catch { /* ignore */ }
      return true
    })
  }, [storageKey])

  useEffect(() => {
    try {
      if (localStorage.getItem(storageKey) === 'closed') setOpen(false)
    } catch { /* storage unavailable (private mode) — stay open */ }
  }, [storageKey])

  const toggle = useCallback(() => {
    setOpen(prev => {
      try { localStorage.setItem(storageKey, prev ? 'closed' : 'open') } catch { /* ignore */ }
      return !prev
    })
  }, [storageKey])

  return { open, toggle, forceOpen }
}
