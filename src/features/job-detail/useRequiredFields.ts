'use client'

import { useCallback, useState } from 'react'
import { missingRequiredJobFields, type RequiredJobField } from '@/lib/utils/job-form-rules'

/**
 * The required-field gate on Push to Schedule, shared by the new-job and edit
 * forms so both refuse in exactly the same way (Nic, 2026-09-10).
 *
 * Saving is deliberately NOT gated — a half-filled job can still be parked as
 * a draft. Only putting it on the schedule demands the six fields.
 */

// Field titles sit above their box, so centre the field and the title is on
// screen with it.
const SCROLL_OPTIONS: ScrollIntoViewOptions = { behavior: 'smooth', block: 'center' }
// Long enough for the phone's tab switch and a collapsed card to have opened.
const REVEAL_DELAY_MS = 80

function focusField(field: RequiredJobField) {
  const wrap = document.querySelector(`[data-required-field="${field}"]`)
  if (!wrap) return
  wrap.scrollIntoView(SCROLL_OPTIONS)
  const control = wrap.querySelector<HTMLElement>('input, textarea, select, button')
  // preventScroll: the smooth scroll above owns the movement; focus would
  // otherwise jump the page instantly and fight it.
  control?.focus({ preventScroll: true })
}

export function useRequiredFields(reveal: () => void) {
  const [missingFields, setMissingFields] = useState<RequiredJobField[]>([])

  /** True when every required field is filled. False marks the gaps, reveals
   *  the Details card and lands the cursor on the first empty one. */
  const checkRequired = useCallback((
    values: Partial<Record<RequiredJobField, string | null | undefined>>,
  ): boolean => {
    const gaps = missingRequiredJobFields(values)
    setMissingFields(gaps)
    if (gaps.length === 0) return true

    reveal()
    setTimeout(() => focusField(gaps[0]), REVEAL_DELAY_MS)
    return false
  }, [reveal])

  const clearMissing = useCallback(() => setMissingFields([]), [])

  return { missingFields, checkRequired, clearMissing }
}
