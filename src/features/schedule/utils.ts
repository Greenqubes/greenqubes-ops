export function timeToMinutes(t: string | null): number | null {
  if (!t) return null
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export function toISO(d: Date): string {
  const y  = d.getFullYear()
  const m  = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function fmtTime(t: string | null): string {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const suffix = h >= 12 ? 'pm' : 'am'
  const h12   = h % 12 || 12
  return m === 0 ? `${h12}${suffix}` : `${h12}:${String(m).padStart(2, '0')}${suffix}`
}

export function isOverdue(status: string, date: string): boolean {
  return status === 'scheduled' && date < toISO(new Date())
}

export function getWeekDays(anchor: string): string[] {
  const d = new Date(anchor + 'T00:00:00')
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)) // back to Monday
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(d)
    day.setDate(d.getDate() + i)
    return toISO(day)
  })
}

export function getMonthDays(anchor: string): string[] {
  const d        = new Date(anchor + 'T00:00:00')
  const year     = d.getFullYear()
  const month    = d.getMonth()
  const daysInMo = new Date(year, month + 1, 0).getDate()
  return Array.from({ length: daysInMo }, (_, i) => toISO(new Date(year, month, i + 1)))
}

export function getMonthCells(anchor: string): (string | null)[] {
  const d         = new Date(anchor + 'T00:00:00')
  const year      = d.getFullYear()
  const month     = d.getMonth()
  const firstDay  = (new Date(year, month, 1).getDay() + 6) % 7 // Mon-first column index
  const daysInMo  = new Date(year, month + 1, 0).getDate()
  return [
    ...Array.from<null>({ length: firstDay }).fill(null),
    ...Array.from({ length: daysInMo }, (_, i) => toISO(new Date(year, month, i + 1))),
  ]
}

export function shiftDate(anchor: string, days: number): string {
  const d = new Date(anchor + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return toISO(d)
}

export function shiftMonth(anchor: string, delta: number): string {
  const d = new Date(anchor + 'T00:00:00')
  d.setMonth(d.getMonth() + delta, 1)
  return toISO(d)
}

// Date names are ALWAYS English regardless of UI language (CLAUDE.md hard rule).
export function dayLabel(isoDate: string): string {
  return new Date(isoDate + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short' })
}

export function monthLabel(isoDate: string): string {
  return new Date(isoDate + 'T00:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}
