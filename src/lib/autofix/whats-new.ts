// Auto-fix lines in the What's new pop-up.
//
// Nic, 2026-11-04: "when a major bug fix or crashes goes live, whats new should
// pop up once. minor ones should appear once a week on monday morning."
//
// The lines live in the database (autofix_items.whats_new_line), not in
// entries.ts — otherwise every fix would need a second deploy just for the
// pop-up, and Monday's batch would need one of its own. Here they are merged
// into the hand-written entries by date, so "one entry per date" still holds.

import type { ChangelogEntry } from '@/lib/changelog/entries'

export type AutoLine = { date: string; time?: string; line: string }

const SGT_MS = 8 * 60 * 60 * 1000

/** 'YYYY-MM-DD' in Singapore time. */
export function sgtDate(iso: string): string {
  return new Date(new Date(iso).getTime() + SGT_MS).toISOString().slice(0, 10)
}

/** 'HH:MM' (24-hour) in Singapore time — the pop-up formats it to AM/PM. */
export function sgtTime(iso: string): string {
  return new Date(new Date(iso).getTime() + SGT_MS).toISOString().slice(11, 16)
}

export function todaySgt(now: Date = new Date()): string {
  return sgtDate(now.toISOString())
}

/** The Monday strictly after `date` — a Monday goes to the following one. */
export function nextMondayAfter(date: string): string {
  const d = new Date(`${date}T00:00:00Z`)
  const dow = d.getUTCDay() // 0 = Sunday
  const days = (8 - dow) % 7 || 7
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function autoLineFor(x: { severity: 'major' | 'minor'; liveAt: string; line: string }): AutoLine {
  if (x.severity === 'major') return { date: sgtDate(x.liveAt), time: sgtTime(x.liveAt), line: x.line }
  // Minor fixes wait for Monday's batch, which carries no time of its own.
  return { date: nextMondayAfter(sgtDate(x.liveAt)), line: x.line }
}

/**
 * Hand-written entries plus auto lines, newest first. Nothing dated after
 * `today` is returned — that is what holds Monday's batch back until Monday.
 * An auto line on a date that already has an entry joins its Fixed section and
 * keeps the entry's own time (the session's release).
 */
export function mergeChangelog(entries: ChangelogEntry[], auto: AutoLine[], today: string): ChangelogEntry[] {
  const visible = entries.filter(e => e.date <= today).map(e => ({ ...e }))

  const byDate = new Map<string, AutoLine[]>()
  for (const a of auto) {
    if (a.date > today) continue
    byDate.set(a.date, [...(byDate.get(a.date) ?? []), a])
  }

  for (const [date, lines] of byDate) {
    const latestTime = lines.map(l => l.time).filter((t): t is string => !!t).sort().at(-1)
    const existing = visible.find(e => e.date === date)
    if (existing) {
      existing.fixed = [...(existing.fixed ?? []), ...lines.map(l => l.line)]
      if (!existing.time && latestTime) existing.time = latestTime
    } else {
      visible.push({ date, ...(latestTime ? { time: latestTime } : {}), fixed: lines.map(l => l.line) })
    }
  }

  return visible.sort((a, b) => b.date.localeCompare(a.date))
}

/**
 * What a reader must have seen for the pop-up to stay shut.
 *
 * The bare newest date while it has no auto lines — exactly what everyone has
 * stored today, so nobody's pop-up reopens on deploy. Once auto lines land on
 * that date the marker becomes `date+count`, so a major fix going live on a
 * date someone already read pops once more (Nic: "pop up once"), while a
 * session's own hand-written lines still never re-pop a seen date.
 */
export function seenMarker(merged: ChangelogEntry[], auto: AutoLine[]): string {
  const newest = merged[0]?.date
  if (!newest) return ''
  const n = auto.filter(a => a.date === newest).length
  return n > 0 ? `${newest}+${n}` : newest
}
