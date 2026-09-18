/**
 * Which date the schedule opens on.
 *
 * Nic, 2026-09-18: "i press oct 2 to edit arnotts, then either i press back to
 * schedule or greenqubes logo to go schedule page, it jumps to today. very
 * repetitive any annoying." Leaving /schedule and coming back builds the page
 * fresh, so the selected date was reset to today every time.
 *
 * The date is remembered in sessionStorage, not localStorage, and that is the
 * whole of Nic's decision: it survives every move inside the app, and is gone
 * when the tab or the app is closed — so tomorrow morning still opens on today
 * rather than stranding someone on a date they set last week.
 *
 * Pure and dependency-free so it can be run standalone by its test.
 */

export type SchedulePageMode = 'schedule' | 'pending' | 'completed'

/** One key per tab of the app. The same shell draws /schedule, /pending and
 *  /completed, and a shared key would let browsing Pending move the schedule's
 *  date under the user — the same annoyance in a new place. */
export function scheduleDateKey(pageMode: SchedulePageMode): string {
  return `gq-schedule-date:${pageMode}`
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

/** Date rolls an impossible day forward — 2026-09-31 becomes 1 October — so a
 *  value that does not come back out unchanged was never a real day. A regex
 *  alone would accept 31 September and 29 February in a common year. */
function isRealCalendarDay(value: string): boolean {
  const d = new Date(`${value}T00:00:00`)
  if (Number.isNaN(d.getTime())) return false
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}` === value
}

/**
 * @param stored what the browser handed back, which is never trusted: it can be
 *   missing, half-written, an old format, or edited by hand.
 * @param today  today in the same YYYY-MM-DD form the schedule uses.
 *
 * A bad value must land on today rather than on the stored value, because every
 * view indexes `jobsByDate[selectedDate]` — a nonsense key renders an empty day
 * with no explanation on it.
 */
export function resolveScheduleDate(stored: string | null | undefined, today: string): string {
  if (!stored) return today
  if (!ISO_DAY.test(stored)) return today
  if (!isRealCalendarDay(stored)) return today
  return stored
}
