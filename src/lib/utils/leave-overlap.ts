// Pure leave-overlap math — the single source of truth for "is this person
// away during this job?". Consumed by the clashes route, assign-installers
// checkOnly, the FCFS board, the pickers, and the assistant's clash tool.
//
// AM/PM boundary is 12:00 — the same split as the FCFS board's zoom ranges
// (RANGES in src/features/fcfs/FCFSShell.tsx). Times compare lexicographically
// on 'HH:MM' (DB sends 'HH:MM:SS', forms send 'HH:MM' — both truncate), the
// same semantics as clash-detection's timesOverlap. Self-contained on purpose:
// test files run under npx tsx and may import pure modules only.

export type LeavePortion = 'full' | 'am' | 'pm'

export type LeaveRecord = {
  id:            string
  user_id:       string
  date_start:    string  // YYYY-MM-DD
  date_end:      string  // YYYY-MM-DD, >= date_start
  start_portion: LeavePortion
  end_portion:   LeavePortion
}

const AMPM_SPLIT   = '12:00'
const DAY_START    = '00:00'
const DAY_END      = '24:00'   // exclusive bound; every real 'HH:MM' sorts below it
const MAX_SPAN_DAYS = 62       // guard against runaway ranges in bad data

const hhmm = (t: string | null) => t?.slice(0, 5) ?? null

export function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + n)
  const p = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function portionWindow(p: LeavePortion): { start: string; end: string } {
  if (p === 'am') return { start: DAY_START, end: AMPM_SPLIT }
  if (p === 'pm') return { start: AMPM_SPLIT, end: DAY_END }
  return { start: DAY_START, end: DAY_END }
}

// The on-leave time window for one calendar date, or null when the leave
// doesn't cover that date. Half days only apply at the range's ends; for a
// single-day entry the form keeps both portions equal.
export function leaveWindowOnDate(leave: LeaveRecord, date: string): { start: string; end: string } | null {
  if (date < leave.date_start || date > leave.date_end) return null
  if (leave.date_start === leave.date_end) {
    const p = leave.start_portion !== 'full' ? leave.start_portion : leave.end_portion
    return portionWindow(p)
  }
  if (date === leave.date_start) return portionWindow(leave.start_portion)
  if (date === leave.date_end)   return portionWindow(leave.end_portion)
  return portionWindow('full')
}

// Job times vs a leave window — same rules as timesOverlap: a job with no
// start time is a whole-day floater and overlaps any window that day; an
// open-ended job counts if it starts inside the window.
function overlapsWindow(jobStart: string | null, jobEnd: string | null, win: { start: string; end: string }): boolean {
  const a = hhmm(jobStart)
  const b = hhmm(jobEnd)
  if (!a) return true
  if (b)  return a < win.end && win.start < b
  return a >= win.start && a < win.end
}

export function leaveBlocksJob(
  leave: LeaveRecord,
  jobDate: string,
  jobDateEnd: string | null,
  timeStart: string | null,
  timeEnd: string | null,
): boolean {
  const end = jobDateEnd && jobDateEnd > jobDate ? jobDateEnd : jobDate
  let cur = jobDate
  for (let i = 0; i < MAX_SPAN_DAYS && cur <= end; i++) {
    const win = leaveWindowOnDate(leave, cur)
    // Multi-day jobs have one time range that applies to every day (the app
    // stores no per-day times), so the same window compare runs per day.
    if (win && overlapsWindow(timeStart, timeEnd, win)) return true
    cur = addDays(cur, 1)
  }
  return false
}

export function leaveRangesOverlap(
  a: Pick<LeaveRecord, 'date_start' | 'date_end'>,
  b: Pick<LeaveRecord, 'date_start' | 'date_end'>,
): boolean {
  return a.date_start <= b.date_end && b.date_start <= a.date_end
}

export type LeaveConflict = {
  personId:   string
  personName: string
  jobId:      string
  leave:      LeaveRecord
}

export type LeaveCheckableJob = {
  id:         string
  date:       string
  date_end?:  string | null
  time_start: string | null
  time_end:   string | null
  people:     Array<{ id: string; name: string }>
}

// One conflict per (person, job) — the first blocking leave wins.
export function leaveClashesForJobs(jobs: LeaveCheckableJob[], leaves: LeaveRecord[]): LeaveConflict[] {
  const byUser = new Map<string, LeaveRecord[]>()
  for (const l of leaves) {
    const list = byUser.get(l.user_id)
    if (list) { list.push(l) } else { byUser.set(l.user_id, [l]) }
  }
  const out: LeaveConflict[] = []
  for (const job of jobs) {
    for (const p of job.people) {
      for (const l of byUser.get(p.id) ?? []) {
        if (leaveBlocksJob(l, job.date, job.date_end ?? null, job.time_start, job.time_end)) {
          out.push({ personId: p.id, personName: p.name, jobId: job.id, leave: l })
          break
        }
      }
    }
  }
  return out
}

export function onLeaveIds(
  peopleIds: string[],
  jobDate: string,
  jobDateEnd: string | null,
  timeStart: string | null,
  timeEnd: string | null,
  leaves: LeaveRecord[],
): Set<string> {
  const ids = new Set(peopleIds)
  const out = new Set<string>()
  for (const l of leaves) {
    if (!ids.has(l.user_id) || out.has(l.user_id)) continue
    if (leaveBlocksJob(l, jobDate, jobDateEnd, timeStart, timeEnd)) out.add(l.user_id)
  }
  return out
}

// "2026-09-10 (from PM) – 2026-09-12 (until AM)" — fmt renders the date part
// (pass templates.formatDate server-side, or an 'en-GB' helper client-side).
export function leaveDatesLabel(
  leave: Pick<LeaveRecord, 'date_start' | 'date_end' | 'start_portion' | 'end_portion'>,
  fmt: (iso: string) => string,
): string {
  if (leave.date_start === leave.date_end) {
    const p = leave.start_portion !== 'full' ? leave.start_portion : leave.end_portion
    return fmt(leave.date_start) + (p !== 'full' ? ` (${p.toUpperCase()} only)` : '')
  }
  const startTag = leave.start_portion === 'pm' ? ' (from PM)' : ''
  const endTag   = leave.end_portion === 'am' ? ' (until AM)' : ''
  return `${fmt(leave.date_start)}${startTag} – ${fmt(leave.date_end)}${endTag}`
}
