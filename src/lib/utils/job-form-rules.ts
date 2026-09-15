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

/** Below this, an address is too short to be worth asking Google about. */
export const MIN_ADDRESS_QUERY_LENGTH = 3

/**
 * Whether the Location box should be asking Google for suggestions right now.
 *
 * The one that matters is `userEdited`. Opening a saved job puts its address
 * straight into the box, and treating that as a search made the suggestion
 * list drop open the moment the form loaded, over the fields underneath
 * (Nic, 2026-09-14). A person opening a job has not asked for suggestions —
 * only typing is a request.
 *
 * `justPicked` covers the two programmatic writes that follow a tap: the
 * label going in immediately, and the detailed address replacing it when
 * Google answers. Neither should re-open the list the pick just closed.
 */
export function shouldSuggestAddresses(input: {
  value:      string
  disabled:   boolean
  userEdited: boolean
  justPicked: boolean
}): boolean {
  const { value, disabled, userEdited, justPicked } = input
  if (disabled || justPicked || !userEdited) return false
  return value.trim().length >= MIN_ADDRESS_QUERY_LENGTH
}

/**
 * Whether to offer the source job's address under an empty Location box.
 *
 * Duplicate used to COPY the address into the copy (Nic, 2026-09-10 — a
 * duplicate is usually the same site, so blanking it made people retype).
 * A bulk order inverts that: 18 branches on one date means the inherited
 * address is wrong every time, and an unedited copy looks finished, so two
 * jobs can sit at the same address unnoticed (Nic, 2026-09-15).
 *
 * The copy now starts blank — which also means Push to Schedule blocks it
 * until someone fills the address in, since Location is a required field —
 * and the old value is offered beneath as a one-tap fill, so the same-site
 * case still costs nothing.
 *
 * The offer is for an EMPTY box only: the moment anything is typed it is gone.
 * Using or dismissing the offer is the caller's job — it drops `previous`,
 * which is the same thing as having nothing to offer.
 */
export function shouldOfferPreviousLocation(input: {
  current:  MaybeText
  previous: MaybeText
  disabled: boolean
}): boolean {
  const { current, previous, disabled } = input
  if (disabled) return false
  if (!(previous ?? '').trim()) return false
  return !(current ?? '').trim()
}

/** Roles that may tick "Production ready" / "DO issued" on ANY job. */
const PRODUCTION_FLAG_ROLES = ['scheduler', 'coordinator', 'admin', 'production']

/**
 * Whether this person may tick "Production ready" / "DO issued".
 *
 * Sales joined these two ticks on 2026-09-15 (Nic), but **only on jobs where
 * they are the Person-in-Charge** — his call when asked whether it should be
 * every job. That boundary is not decoration: "Production ✓" also shows on the
 * schedule card everyone sees, so "any job" would let one sales person change
 * what the whole team reads about a colleague's job.
 *
 * Scoping it to their own jobs also keeps this a screen change with no
 * migration, because sales already holds the database permission on their own
 * jobs (0055/0056). A sales person who somehow reached a colleague's job would
 * be refused by the database and told so — `saveValues` asks for the row back,
 * so a write RLS filters out is a visible failure, not a silent one.
 */
export function canTickProductionFlags(input: {
  role:       string
  isSalesPoc: boolean
  readOnly:   boolean
}): boolean {
  const { role, isSalesPoc, readOnly } = input
  if (readOnly) return false
  if (role === 'sales') return isSalesPoc
  return PRODUCTION_FLAG_ROLES.includes(role)
}

/**
 * Whether Push to Schedule should Telegram the schedulers.
 *
 * Normally yes — that message is how a scheduler learns a job needs an
 * installer. Nic asked for a quiet push (2026-09-15) for backfilling work the
 * team already knows about, now that everyone is on board and a burst of
 * notifications is noise rather than news.
 *
 * **Admin only, and decided on the server.** The flag arrives in the request
 * body, so without this check any sales person could silence the schedulers by
 * sending one extra field — a job would land on the schedule with nobody told.
 *
 * `realRole`, never the effective one: `getEffectiveRole` never returns
 * 'admin', so an admin previewing as sales is still an admin here, and a
 * genuine sales user can never become one.
 */
export function shouldNotifyOnPush(input: {
  realRole:         string
  silentRequested?: boolean
}): boolean {
  const { realRole, silentRequested } = input
  return !(realRole === 'admin' && silentRequested === true)
}

/**
 * Whether the Design brief card can be filled in yet.
 *
 * Locked until the job is ON the schedule (Nic, 2026-09-15). This follows
 * directly from migration 0060: designers no longer see pending jobs, so a
 * brief written on one — or a designer attached to one — would be invisible
 * to the very person it is for, with nothing on screen to say why.
 *
 * `status: null` is the New Job form, where the job does not exist yet.
 * `readOnly` still wins, so completed jobs stay locked as they always were.
 */
export function designBriefEditable(input: {
  status:   string | null
  readOnly: boolean
}): boolean {
  const { status, readOnly } = input
  if (readOnly) return false
  return status === 'scheduled'
}
