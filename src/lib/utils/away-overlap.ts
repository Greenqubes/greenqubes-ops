// Pure "is this person away on work during this job?" math — the single source
// of truth for the Away list (courses + business trips). Consumed by the clash
// routes, the FCFS board, the job-form grids, the notifier and the assistant.
//
// Deliberately separate from leave-overlap.ts: leave is whole-day / AM-PM and
// RED; a trip is exact-time and AMBER (a warning, never a block — Nic,
// 2026-10-09). Times compare lexicographically on 'HH:MM', the same semantics
// as clash-detection's timesOverlap. Touching edges do NOT overlap.
// Self-contained on purpose: tests run under npx tsx and import pure modules only.

export type AwayPerson = { id: string; name: string }

export type AwayTrip = {
  id:         string
  title:      string
  business:   string | null
  location:   string | null
  start_date: string   // YYYY-MM-DD, Singapore wall-clock
  start_time: string   // HH:MM or HH:MM:SS
  end_date:   string
  end_time:   string
  note:       string | null
  people:     AwayPerson[]
}

export type AwaySpan = Pick<AwayTrip, 'start_date' | 'start_time' | 'end_date' | 'end_time'>

const DAY_START     = '00:00'
const DAY_END       = '24:00'   // exclusive; every real 'HH:MM' sorts below it
const MAX_SPAN_DAYS = 62        // same guard as leave against runaway data

const hhmm = (t: string | null) => t?.slice(0, 5) ?? null

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + n))
  const p = (x: number) => String(x).padStart(2, '0')
  return `${dt.getUTCFullYear()}-${p(dt.getUTCMonth() + 1)}-${p(dt.getUTCDate())}`
}

/** The away window on one calendar date, or null when the trip does not cover it. */
export function awayWindowOnDate(trip: AwaySpan, date: string): { start: string; end: string } | null {
  if (date < trip.start_date || date > trip.end_date) return null
  const start = date === trip.start_date ? hhmm(trip.start_time)! : DAY_START
  const end   = date === trip.end_date   ? hhmm(trip.end_time)!   : DAY_END
  // An empty window (a trip ending at exactly 00:00) covers nothing that day.
  return start < end ? { start, end } : null
}

// Same rules as leave's overlapsWindow / timesOverlap, with strict
// inequalities so touching edges never warn.
function overlapsWindow(jobStart: string | null, jobEnd: string | null, win: { start: string; end: string }): boolean {
  const a = hhmm(jobStart)
  const b = hhmm(jobEnd)
  if (!a) return true                          // no start time = whole-day job
  if (b)  return a < win.end && win.start < b
  return a >= win.start && a < win.end         // open-ended: counts if it starts inside
}

export function awayBlocksJob(
  trip: AwaySpan, jobDate: string, jobDateEnd: string | null,
  timeStart: string | null, timeEnd: string | null,
): boolean {
  const end = jobDateEnd && jobDateEnd > jobDate ? jobDateEnd : jobDate
  let cur = jobDate
  for (let i = 0; i < MAX_SPAN_DAYS && cur <= end; i++) {
    const win = awayWindowOnDate(trip, cur)
    if (win && overlapsWindow(timeStart, timeEnd, win)) return true
    cur = addDays(cur, 1)
  }
  return false
}

/** Every date the trip actually covers — for the strip and the calendar dots. */
export function awayDates(trip: AwaySpan): string[] {
  const out: string[] = []
  let cur = trip.start_date
  for (let i = 0; i < MAX_SPAN_DAYS && cur <= trip.end_date; i++) {
    if (awayWindowOnDate(trip, cur)) out.push(cur)
    cur = addDays(cur, 1)
  }
  return out
}

/** date -> trips covering it. A trip shows on every day it actually covers. */
export function buildAwayByDate(trips: AwayTrip[]): Record<string, AwayTrip[]> {
  const acc: Record<string, AwayTrip[]> = {}
  for (const trip of trips) for (const d of awayDates(trip)) (acc[d] ??= []).push(trip)
  return acc
}

export type AwayConflict ={ personId: string; personName: string; jobId: string; trip: AwayTrip }

export type AwayCheckableJob = {
  id:         string
  date:       string
  date_end?:  string | null
  time_start: string | null
  time_end:   string | null
  people:     Array<{ id: string; name: string }>
}

/** First trip that puts this person away during the job, or null. */
export function awayTripFor(
  personId: string, jobDate: string, jobDateEnd: string | null,
  timeStart: string | null, timeEnd: string | null, trips: AwayTrip[],
): AwayTrip | null {
  for (const trip of trips) {
    if (!trip.people.some(p => p.id === personId)) continue
    if (awayBlocksJob(trip, jobDate, jobDateEnd, timeStart, timeEnd)) return trip
  }
  return null
}

/** Everyone a trip puts away during this date/time — the crew pickers' tag.
 *  No date yet (a blank New Job form) means nobody. */
export function awayIdsFor(
  trips: AwayTrip[], jobDate: string, jobDateEnd: string | null,
  timeStart: string | null, timeEnd: string | null,
): Set<string> {
  const out = new Set<string>()
  if (!jobDate) return out
  for (const trip of trips) {
    if (!awayBlocksJob(trip, jobDate, jobDateEnd, timeStart, timeEnd)) continue
    for (const p of trip.people) out.add(p.id)
  }
  return out
}

/** One conflict per (person, job) — the first trip wins. */
export function awayConflictsForJobs(jobs: AwayCheckableJob[], trips: AwayTrip[]): AwayConflict[] {
  const out: AwayConflict[] = []
  for (const job of jobs) {
    for (const p of job.people) {
      const trip = awayTripFor(p.id, job.date, job.date_end ?? null, job.time_start, job.time_end, trips)
      if (trip) out.push({ personId: p.id, personName: p.name, jobId: job.id, trip })
    }
  }
  return out
}

// Static English tables — never toLocaleDateString (hydration #418 + the
// "dates are always English" hard rule).
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAYS   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function fmtDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return `${DAYS[dow]} ${d} ${MONTHS[m - 1]} ${y}`
}

function fmtClock(t: string): string {
  const [h, m] = hhmm(t)!.split(':').map(Number)
  const suffix = h >= 12 ? 'pm' : 'am'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')}${suffix}`
}

/** "Tue 13 Oct 2026, 2:00pm → Thu 15 Oct 2026, 12:00pm" (or "…, 2:00pm – 5:30pm" same day). */
export function awayWhenLabel(trip: AwaySpan): string {
  if (trip.start_date === trip.end_date) {
    return `${fmtDay(trip.start_date)}, ${fmtClock(trip.start_time)} – ${fmtClock(trip.end_time)}`
  }
  return `${fmtDay(trip.start_date)}, ${fmtClock(trip.start_time)} → ${fmtDay(trip.end_date)}, ${fmtClock(trip.end_time)}`
}

/** Identity of one "person X is away during job Y" warning. */
export function pairKey(personId: string, jobId: string): string {
  return `${personId}:${jobId}`
}

/** jobId -> the people on it the trip affects, in first-seen order. A trip is
 *  multi-person, so messaging per (person, job) multiplies — three people on
 *  one job would send everyone three messages about the same job. */
export function groupPairsByJob(pairs: Array<{ personId: string; jobId: string }>): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const { personId, jobId } of pairs) {
    const list = out.get(jobId)
    if (list) { if (!list.includes(personId)) list.push(personId) } else { out.set(jobId, [personId]) }
  }
  return out
}

/** Warnings present after an edit that were not present before it. */
export function newPairs(before: Set<string>, after: Set<string>): Set<string> {
  return new Set([...after].filter(k => !before.has(k)))
}
