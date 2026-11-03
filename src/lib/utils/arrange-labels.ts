/**
 * To arrange — display labels for the Jobs tab and the job page. Always
 * English, whatever the person's language (CLAUDE.md hard rule), from static
 * tables — never locale calls.
 */
import { hhmm, type Arrangement, type Slot } from './arrange-rules'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAYS   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** '2026-11-12' → 'Thu 12 Nov'. Read as a calendar date, never a moment. */
export function shortDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return `${DAYS[dt.getUTCDay()]} ${d} ${MONTHS[m - 1]}`
}

/** '22:00:00' → '10:00 PM'. */
export function timeLabel(t: string | null): string | null {
  const v = hhmm(t)
  if (!v) return null
  const [h, m] = v.split(':').map(Number)
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

function timeRange(start: string | null, end: string | null): string | null {
  const s = timeLabel(start), e = timeLabel(end)
  return s ? (e ? `${s} – ${e}` : s) : null
}

export function guideLabel(a: Pick<Arrangement, 'day' | 'timeStart' | 'timeEnd'>): string {
  const day = a.day.mode === 'any' ? 'Any day'
    : a.day.mode === 'between' ? `Between ${shortDay(a.day.from)} and ${shortDay(a.day.to)}`
    : `${shortDay(a.day.day)} only`
  return `${day} · ${timeRange(a.timeStart, a.timeEnd) ?? 'any time'}`
}

export function slotLabel(s: Slot): string {
  if (!s.date) return 'Date to be confirmed'
  const days = s.dateEnd && s.dateEnd !== s.date ? `${shortDay(s.date)} – ${shortDay(s.dateEnd)}` : shortDay(s.date)
  const time = timeRange(s.timeStart, s.timeEnd)
  return time ? `${days} · ${time}` : days
}

/** Whole Singapore days between a UTC timestamp and today's SG date. */
export function daysWaiting(sinceISO: string, todayISO: string): number {
  const sgDay = new Date(new Date(sinceISO).getTime() + 8 * 3600_000).toISOString().slice(0, 10)
  const ms = Date.parse(`${todayISO}T00:00:00Z`) - Date.parse(`${sgDay}T00:00:00Z`)
  return Math.max(0, Math.round(ms / 86_400_000))
}
