/**
 * Pure rules for the Job Details card — no React, no DOM, no network, so the
 * form and its tests can both lean on the same logic.
 *
 * From Nic's marked-up screenshot, 2026-09-10.
 */

export type RequiredJobField =
  | 'project_title'
  | 'date'
  | 'client'
  | 'client_poc_name'
  | 'client_poc_phone'
  | 'location'

/**
 * The six fields that must be filled before a job goes on the schedule,
 * listed in the order they appear on screen. The order is load-bearing:
 * the form scrolls to the FIRST entry, which has to be the topmost empty
 * field a person can see, not whichever key happened to be checked first.
 */
export const REQUIRED_JOB_FIELDS: RequiredJobField[] = [
  'project_title',
  'date',
  'client',
  'client_poc_name',
  'client_poc_phone',
  'location',
]

type MaybeText = string | null | undefined

/** Which required fields are still empty. Whitespace does not count as filled. */
export function missingRequiredJobFields(
  values: Partial<Record<RequiredJobField, MaybeText>>,
): RequiredJobField[] {
  return REQUIRED_JOB_FIELDS.filter(field => !(values[field] ?? '').trim())
}

// A phone number inside free text: starts on a digit (or +), may carry
// spaces, dashes and brackets, ends on a digit.
const PHONE_CANDIDATE = /\+?\d[\d\s\-()]*\d/g

// Below this many digits it is a unit number, an extension or a postcode
// fragment — not something worth dialling.
const MIN_PHONE_DIGITS = 7

/**
 * Pull a dialable number out of free text, so "Marvin 9123 4567 (site)"
 * still gives the call button something to ring. Returns the first number
 * found, keeping a leading country code; null when there is nothing to dial.
 */
export function extractDialNumber(text: MaybeText): string | null {
  if (!text) return null

  for (const match of text.matchAll(PHONE_CANDIDATE)) {
    const raw    = match[0]
    const digits = raw.replace(/\D/g, '')
    if (digits.length < MIN_PHONE_DIGITS) continue
    return raw.startsWith('+') ? `+${digits}` : digits
  }
  return null
}

export type Punctuality = 'strict' | 'flexible'

/**
 * Punctuality only means something once there is a start time to be on time
 * for, so a job with no start time is always a flexible window — including
 * one that was strict until its start time was cleared.
 */
export function punctualityFor(timeStart: MaybeText, current: Punctuality): Punctuality {
  return timeStart ? current : 'flexible'
}

/** True when an end date lands before the job's own date. ISO dates sort as text. */
export function endDateBeforeStart(date: MaybeText, dateEnd: MaybeText): boolean {
  if (!date || !dateEnd) return false
  return dateEnd < date
}

/** Google Maps search link for whatever address is in the box; null when empty. */
export function mapsSearchUrl(location: MaybeText): string | null {
  const query = (location ?? '').trim()
  if (!query) return null
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}
