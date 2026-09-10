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

/**
 * Required fields that HAD something and are now empty — the edit form's rule
 * (Nic, 2026-09-10): details already on a job may be replaced but not deleted,
 * because an emptied field leaves the job incomplete for whoever works it.
 *
 * A field that was empty when the form loaded is left alone, so a half-filled
 * draft can still be saved and finished later.
 */
export function clearedRequiredFields(
  original: Partial<Record<RequiredJobField, MaybeText>>,
  current:  Partial<Record<RequiredJobField, MaybeText>>,
): RequiredJobField[] {
  return REQUIRED_JOB_FIELDS.filter(field =>
    (original[field] ?? '').trim() !== '' && (current[field] ?? '').trim() === '',
  )
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

// Google's own labels for "this is a business", as opposed to a road or a
// building. Only a business is worth naming in front of its address.
const BUSINESS_TYPES = ['establishment', 'point_of_interest', 'store']

/**
 * What goes into the Location box when a suggestion is tapped.
 *
 * The list shows a short label ("Capitol Optical (Great World City)"), but a
 * driver needs the unit number and postcode, so the detailed address from
 * Place Details wins — with the shop name in front, since knowing which shop
 * still matters at a mall (Nic, 2026-09-10). A plain street address is never
 * prefixed with itself, and a failed lookup falls back to the label.
 */
export function composeAddress(input: {
  name:      string
  /** The suggestion's own text, used when the detailed lookup gives nothing. */
  fallback:  string
  /** formattedAddress from Place Details; '' when the lookup failed. */
  detailed:  string
  types:     string[]
}): string {
  const { name, fallback, detailed, types } = input
  if (!detailed) return fallback

  const isBusiness = types.some(type => BUSINESS_TYPES.includes(type))
  if (!name || !isBusiness) return detailed

  // Google sometimes leads the address with the place name already.
  if (detailed.toLowerCase().includes(name.toLowerCase())) return detailed

  return `${name}, ${detailed}`
}

/** Google Maps search link for whatever address is in the box; null when empty. */
export function mapsSearchUrl(location: MaybeText): string | null {
  const query = (location ?? '').trim()
  if (!query) return null
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}
