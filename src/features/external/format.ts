// Date/time labels for the external link pages. External contacts get English
// only — and date labels are always English app-wide regardless of language.

const DAYS   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// '2026-06-12' → 'Thu 12 Jun' (static tables, not toLocaleDateString — the
// locale formatters caused the /schedule hydration saga; never again)
export function fmtExtDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`
}

// '09:00:00' → '9:00am'
export function fmtExtTime(time: string | null): string {
  if (!time) return ''
  const [h, m] = time.split(':').map(Number)
  if (Number.isNaN(h)) return ''
  const suffix = h >= 12 ? 'pm' : 'am'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${String(m ?? 0).padStart(2, '0')}${suffix}`
}

export function fmtExtTimeRange(start: string | null, end: string | null): string {
  if (!start) return 'All day'
  const s = fmtExtTime(start)
  return end ? `${s} – ${fmtExtTime(end)}` : s
}

// Local YYYY-MM-DD for "is this job in the past" checks (SGT users).
export function todayIso(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
