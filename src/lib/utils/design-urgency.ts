// Urgency + bar geometry for the Design Load board. Pure functions — the AI
// stores complexity once; everything time-sensitive is recomputed here so a
// job reddens as its due date nears with zero AI calls (spec: scoring engine).

export type UrgencyLevel = 0 | 1 | 2 | 3 | 4 | 5

export function daysBetween(fromISO: string, toISO: string): number {
  const from = Date.UTC(+fromISO.slice(0, 4), +fromISO.slice(5, 7) - 1, +fromISO.slice(8, 10))
  const to   = Date.UTC(+toISO.slice(0, 4),   +toISO.slice(5, 7) - 1,   +toISO.slice(8, 10))
  return Math.round((to - from) / 86_400_000)
}

// Shifts a date-only ISO string by `days` (may be negative). Used by the
// design-due-date auto-shift: when a job's install date moves, the due date
// moves by the same signed delta.
export function addDaysISO(iso: string, days: number): string {
  const d = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)))
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// Same "today" clamp the PATCH route's auto-shift uses server-side (SGT,
// UTC+8) — kept as its own copy here (not imported by the route) so this
// file stays pure/client-safe. Used to preview the clamped shifted date in
// the client-side same-save due-date conflict prompt (Task 14 addendum §1).
export function todaySGT(): string {
  return new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10)
}

export function computeUrgency(input: {
  complexity:   number | null
  daysToDue:    number | null
  openCount:    number
  maxOpenCount: number
}): UrgencyLevel {
  const { complexity, daysToDue, openCount, maxOpenCount } = input
  if (complexity == null || daysToDue == null) return 0
  let level = complexity
  if (daysToDue <= 1) level += 2
  else if (daysToDue <= 3) level += 1
  else if (daysToDue >= 10) level -= 1
  if (maxOpenCount > 0 && openCount >= 3 && openCount / maxOpenCount >= 0.75) level += 1
  return Math.min(5, Math.max(1, level)) as UrgencyLevel
}

export function segmentHeightPx(daysToDue: number | null): number {
  if (daysToDue == null) return 32
  if (daysToDue <= 1)  return 96
  if (daysToDue <= 3)  return 76
  if (daysToDue <= 7)  return 56
  if (daysToDue <= 14) return 44
  return 32
}

export const URGENCY_META: Record<UrgencyLevel, { label: string; barClass: string }> = {
  0: { label: 'Not scored', barClass: 'bg-muted/40' },
  1: { label: 'Relaxed',    barClass: 'bg-brand-blue' },
  2: { label: 'Low',        barClass: 'bg-brand-green' },
  3: { label: 'Medium',     barClass: 'bg-yellow-500' },
  4: { label: 'High',       barClass: 'bg-brand-amber' },
  5: { label: 'Urgent',     barClass: 'bg-bad' },
}
