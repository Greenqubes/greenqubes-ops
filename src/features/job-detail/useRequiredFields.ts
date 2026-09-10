'use client'

import { useCallback, useState } from 'react'
import {
  missingRequiredJobFields,
  clearedRequiredFields,
  type RequiredJobField,
} from '@/lib/utils/job-form-rules'

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

type FormLike = Partial<Record<RequiredJobField, string | null | undefined>>

export function useRequiredFields(reveal: () => void) {
  const [missingFields, setMissingFields] = useState<RequiredJobField[]>([])

  // Mark the gaps, reveal the Details card, land the cursor on the first one.
  const flag = useCallback((gaps: RequiredJobField[]): boolean => {
    setMissingFields(gaps)
    if (gaps.length === 0) return true

    reveal()
    setTimeout(() => focusField(gaps[0]), REVEAL_DELAY_MS)
    return false
  }, [reveal])

  /** Push to Schedule: every required field must be filled. */
  const checkRequired = useCallback(
    (values: FormLike): boolean => flag(missingRequiredJobFields(values)),
    [flag],
  )

  /** Save on the edit form: what was already there may be replaced, never
   *  emptied. A field that was blank when the form loaded is not the rule's
   *  business, so a parked draft still saves. */
  const checkNotCleared = useCallback(
    (original: FormLike, values: FormLike): boolean =>
      flag(clearedRequiredFields(original, values)),
    [flag],
  )

  const clearMissing = useCallback(() => setMissingFields([]), [])

  return { missingFields, checkRequired, checkNotCleared, clearMissing }
}
