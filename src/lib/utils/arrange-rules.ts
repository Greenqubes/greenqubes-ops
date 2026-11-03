/**
 * To arrange — the rules (spec docs/superpowers/specs/2026-11-04-to-arrange-design.md).
 *
 * Some clients give no install date and ask US to propose one (Nic,
 * 2026-11-03). Sales marks an Ongoing job "Ready to install" with a guide
 * (day: any / between / fixed; time: start + optional end, or any); the
 * scheduler offers a slot (day, time, optional crew); sales checks it with
 * the client; Client OK puts it on the schedule, Client said no sends it
 * back. Nothing touches the schedule until the client agrees.
 *
 * Pure, so the route, the Jobs tab, the job page and the tests share one
 * answer. The job stays an Ongoing job (raw `awaiting_date`) throughout —
 * `arrange_state` only says whose turn it is.
 */
import { isSharer, type StageViewer, type StageJob4Rules } from './job-stage-rules'
import { punctualityFor } from './job-form-rules'
import type { Punctuality } from '@/lib/supabase/types'

export type ArrangeState = 'needs_date' | 'offered' | 'no_fit' | 'clash'
const STATES: readonly ArrangeState[] = ['needs_date', 'offered', 'no_fit', 'clash']

export type DayGuide =
  | { mode: 'any' }
  | { mode: 'between'; from: string; to: string }   // ISO dates, inclusive
  | { mode: 'fixed'; day: string }

export type ArrangeOffer = {
  by: string; byName: string; at: string            // at = ISO timestamp
  date: string; dateEnd: string | null; timeStart: string | null; timeEnd: string | null
  driverIds: string[]; supportIds: string[]; contactIds: string[]
  /** Drivers, then support crew, then outside contractors — for display. */
  crewNames: string[]
  /** Clashes the scheduler saw and offered past (clashKeys). Client OK sends
   *  the job back only for a clash NOT in this list (spec, builder check). */
  acceptedClashKeys: string[]
}

export type ArrangeReturn = {
  kind: 'client_no' | 'no_fit' | 'withdrawn' | 'clash'
  text: string | null; by: string; byName: string; at: string
}

export type Arrangement = {
  readyBy: string; readyByName: string; readyAt: string
  day: DayGuide; timeStart: string | null; timeEnd: string | null; note: string | null
  /** Kept after a "client said no" or a withdraw, so the scheduler's crew
   *  stays filled in for the next offer (Nic: "ready to change"). */
  offer: ArrangeOffer | null
  lastReturn: ArrangeReturn | null
}

export type ArrangeAction = 'ready' | 'offer' | 'send_back' | 'withdraw' | 'client_no' | 'client_ok' | 'pull_back'
export type GuideInput = { day: DayGuide; timeStart: string | null; timeEnd: string | null; note: string | null }
export type Slot = { date: string | null; dateEnd: string | null; timeStart: string | null; timeEnd: string | null }

// ── Parsing what the database hands back ────────────────────────────────────
// The jsonb column is untrusted input like anything stored: a wrong shape is
// treated as "no arrangement" rather than crashing a page.

export function parseArrangeState(v: unknown): ArrangeState | null {
  return typeof v === 'string' && (STATES as readonly string[]).includes(v) ? v as ArrangeState : null
}

const isStr = (v: unknown): v is string => typeof v === 'string'
const isStrOrNull = (v: unknown) => v === null || typeof v === 'string'
const isStrArr = (v: unknown) => Array.isArray(v) && v.every(isStr)

function isDayGuide(v: unknown): v is DayGuide {
  if (!v || typeof v !== 'object') return false
  const d = v as Record<string, unknown>
  if (d.mode === 'any') return true
  if (d.mode === 'between') return isStr(d.from) && isStr(d.to)
  if (d.mode === 'fixed') return isStr(d.day)
  return false
}

function isOffer(v: unknown): v is ArrangeOffer {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return isStr(o.by) && isStr(o.byName) && isStr(o.at) && isStr(o.date)
    && isStrOrNull(o.dateEnd) && isStrOrNull(o.timeStart) && isStrOrNull(o.timeEnd)
    && isStrArr(o.driverIds) && isStrArr(o.supportIds) && isStrArr(o.contactIds)
    && isStrArr(o.crewNames) && isStrArr(o.acceptedClashKeys)
}

function isReturn(v: unknown): v is ArrangeReturn {
  if (!v || typeof v !== 'object') return false
  const r = v as Record<string, unknown>
  return ['client_no', 'no_fit', 'withdrawn', 'clash'].includes(r.kind as string)
    && isStrOrNull(r.text) && isStr(r.by) && isStr(r.byName) && isStr(r.at)
}

export function parseArrangement(v: unknown): Arrangement | null {
  if (!v || typeof v !== 'object') return null
  const a = v as Record<string, unknown>
  if (!isStr(a.readyBy) || !isStr(a.readyByName) || !isStr(a.readyAt)) return null
  if (!isDayGuide(a.day)) return null
  if (!isStrOrNull(a.timeStart) || !isStrOrNull(a.timeEnd) || !isStrOrNull(a.note)) return null
  if (a.offer !== null && !isOffer(a.offer)) return null
  if (a.lastReturn !== null && !isReturn(a.lastReturn)) return null
  return a as unknown as Arrangement
}

// ── Reading what the browser sends ──────────────────────────────────────────
// The route's body is untrusted: only known words, only strings, and only
// the fields of the chosen day mode survive.

const ACTIONS: readonly ArrangeAction[] = ['ready', 'offer', 'send_back', 'withdraw', 'client_no', 'client_ok', 'pull_back']
const TEXT_MAX = 500

export function parseArrangeAction(v: unknown): ArrangeAction | null {
  return typeof v === 'string' && (ACTIONS as readonly string[]).includes(v) ? v as ArrangeAction : null
}

/** Free text from a person (a note, a reason): trimmed, blank → null, capped. */
export function reasonText(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t ? t.slice(0, TEXT_MAX) : null
}

/** A list of ids: strings only, each once. */
export function idList(v: unknown): string[] {
  return Array.isArray(v) ? [...new Set(v.filter(isStr))] : []
}

export function parseGuideInput(v: unknown): GuideInput | null {
  if (!v || typeof v !== 'object') return null
  const b = v as Record<string, unknown>
  if (!isDayGuide(b.day)) return null
  const d = b.day
  const day: DayGuide = d.mode === 'any' ? { mode: 'any' }
    : d.mode === 'between' ? { mode: 'between', from: d.from, to: d.to }
    : { mode: 'fixed', day: d.day }
  for (const k of ['timeStart', 'timeEnd', 'note'] as const) {
    if (b[k] !== undefined && b[k] !== null && typeof b[k] !== 'string') return null
  }
  const time = (t: unknown) => (typeof t === 'string' && t.trim() ? t.trim() : null)
  return { day, timeStart: time(b.timeStart), timeEnd: time(b.timeEnd), note: reasonText(b.note) }
}

// ── The round trip ──────────────────────────────────────────────────────────

/**
 * The state an action moves a job to, or 'invalid'. client_ok answers null
 * (on the schedule); the route writes 'clash' instead when the crew now
 * clashes. From 'clash' only pull_back is allowed — the scheduler finishes a
 * clash with the ordinary Push to Schedule, which clears the arrangement.
 */
export function nextArrangeState(from: ArrangeState | null, action: ArrangeAction): ArrangeState | null | 'invalid' {
  switch (action) {
    case 'ready':     return from === 'clash' ? 'invalid' : 'needs_date'
    case 'offer':     return from === 'needs_date' ? 'offered'    : 'invalid'
    case 'send_back': return from === 'needs_date' ? 'no_fit'     : 'invalid'
    case 'withdraw':  return from === 'offered'    ? 'needs_date' : 'invalid'
    case 'client_no': return from === 'offered'    ? 'needs_date' : 'invalid'
    case 'client_ok': return from === 'offered'    ? null         : 'invalid'
    case 'pull_back': return from === null         ? 'invalid'    : null
  }
}

export function arrangeTurn(state: ArrangeState): 'scheduler' | 'sales' {
  return state === 'needs_date' || state === 'clash' ? 'scheduler' : 'sales'
}

// ── Who may press what ──────────────────────────────────────────────────────
// isAdmin is the REAL role: getEffectiveRole answers 'scheduler' for a plain
// admin, so `role` alone cannot tell them apart.

/** Sales side: the job's creator / sales PIC / coordinators on it — as
 *  sales or coordinator — and admin. A scheduler who made the job is not:
 *  he can simply push it. */
export function isArrangeSalesSide(v: StageViewer, j: StageJob4Rules): boolean {
  return !!v.isAdmin || ((v.role === 'sales' || v.role === 'coordinator') && isSharer(v, j))
}

export function isArrangeSchedulerSide(v: StageViewer): boolean {
  return v.role === 'scheduler' || !!v.isAdmin
}

const SALES_ACTIONS: readonly ArrangeAction[] = ['ready', 'client_no', 'client_ok', 'pull_back']

export function canArrange(v: StageViewer, j: StageJob4Rules, action: ArrangeAction): boolean {
  return SALES_ACTIONS.includes(action) ? isArrangeSalesSide(v, j) : isArrangeSchedulerSide(v)
}

// ── Times and dates ─────────────────────────────────────────────────────────

/** '22:00:00' (Postgres) and '22:00' (the form) are the same time. */
export function hhmm(t: string | null | undefined): string | null {
  return t ? t.slice(0, 5) : null
}

/** A real calendar date — a regex alone passes 31 November. */
function isIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

// ── The guide sales gives ───────────────────────────────────────────────────

export function validateGuide(g: GuideInput): 'bad_range' | 'bad_day' | 'end_without_start' | 'end_before_start' | null {
  if (g.day.mode === 'between') {
    if (!isIsoDate(g.day.from) || !isIsoDate(g.day.to) || g.day.from > g.day.to) return 'bad_range'
  }
  if (g.day.mode === 'fixed' && !isIsoDate(g.day.day)) return 'bad_day'
  const start = hhmm(g.timeStart), end = hhmm(g.timeEnd)
  if (end && !start) return 'end_without_start'
  // A night job ending after midnight is entered without an end time — the
  // job form has no overnight end either.
  if (start && end && end <= start) return 'end_before_start'
  return null
}

/**
 * What marking a job ready writes onto the job itself. A fixed day IS the
 * date (the scheduler sees it filled and locked); a range or any day leaves
 * the date for the scheduler to pick. The time is written as given, and a
 * blank start time drops strict to flexible exactly as the form does.
 */
export function guideJobPatch(g: GuideInput, punctuality: Punctuality): Record<string, unknown> {
  const day = g.day.mode === 'fixed' ? { date: g.day.day } : { date: null, date_end: null }
  return {
    ...day,
    time_start:  g.timeStart || null,
    time_end:    g.timeEnd || null,
    punctuality: punctualityFor(g.timeStart, punctuality),
  }
}

// ── The scheduler's offer ───────────────────────────────────────────────────

export function validateOffer(
  a: Pick<Arrangement, 'day' | 'timeStart' | 'timeEnd'>, slot: Slot, todayISO: string,
): 'date_required' | 'in_past' | 'outside_range' | 'not_fixed_day' | 'time_locked' | null {
  if (!slot.date) return 'date_required'
  if (slot.date < todayISO) return 'in_past'
  if (a.day.mode === 'between' && (slot.date < a.day.from || slot.date > a.day.to)) return 'outside_range'
  if (a.day.mode === 'fixed' && slot.date !== a.day.day) return 'not_fixed_day'
  if (a.timeStart && hhmm(slot.timeStart) !== hhmm(a.timeStart)) return 'time_locked'
  if (a.timeEnd && hhmm(slot.timeEnd) !== hhmm(a.timeEnd)) return 'time_locked'
  return null
}

// ── Clashes at Client OK ────────────────────────────────────────────────────
// Nothing is held while the client thinks it over, so the crew may be booked
// elsewhere in the meantime. Only a clash that was NOT there when the
// scheduler offered sends the job back to him — one he knowingly offered
// past would otherwise bounce it every time (spec, builder check). Away never
// counts: it is amber and never blocks (2026-10-12 rule).

export function clashKeys(r: {
  clashes: Array<{ installerId: string; conflict: { jobId: string } }>
  leaveClashes: Array<{ installerId: string }>
}): string[] {
  const keys = new Set<string>([
    ...r.clashes.map(c => `b:${c.installerId}:${c.conflict.jobId}`),
    ...r.leaveClashes.map(l => `l:${l.installerId}`),
  ])
  return [...keys].sort()
}

export function newClashKeys(current: string[], accepted: string[]): string[] {
  const seen = new Set(accepted)
  return current.filter(k => !seen.has(k))
}

/** The job still carries the slot that was offered. The page locks the
 *  fields while an offer is out; this catches a stale tab that did not. */
export function offerMatchesJob(o: ArrangeOffer, slot: Slot): boolean {
  return o.date === slot.date
    && (o.dateEnd ?? null) === (slot.dateEnd ?? null)
    && hhmm(o.timeStart) === hhmm(slot.timeStart)
    && hhmm(o.timeEnd) === hhmm(slot.timeEnd)
}

export function offerHasCrew(o: ArrangeOffer): boolean {
  return o.driverIds.length + o.supportIds.length + o.contactIds.length > 0
}

/** Without a driver the job still needs crew, so the schedulers get the
 *  ordinary "New Job — Assign Installer" message (Nic: crew is optional in an
 *  offer). With one, a short "client agreed, it's on the schedule". */
export function clientOkSchedulerMessage(o: ArrangeOffer): 'arranged' | 'assign_crew' {
  return o.driverIds.length > 0 ? 'arranged' : 'assign_crew'
}

// ── The job page ────────────────────────────────────────────────────────────

/**
 * Which of the job form's date/time fields are locked. One source of truth
 * for the slot: while an offer is out, or once the client agreed (clash),
 * nobody may change it. While the scheduler is choosing, what sales fixed
 * stays fixed; sales change the slot through the guide, not the form.
 */
export function arrangeFieldLocks(
  state: ArrangeState | null, a: Arrangement | null,
  side: { sales: boolean; scheduler: boolean },
): { date: boolean; time: boolean } {
  if (state === null) return { date: false, time: false }
  if (state === 'offered' || state === 'clash') return { date: true, time: true }
  if (side.scheduler) return { date: a?.day.mode === 'fixed', time: !!a?.timeStart }
  return { date: true, time: true }
}

/** The scheduler's crew picks, filled back in from his last offer — after a
 *  client no or a withdraw, and in a clash, where he only changes the crew.
 *  Seeds the picks, never the saved baseline, so they count as unsaved and
 *  Push to Schedule writes them (pushCrewPlan). */
export function seedCrewFromOffer(
  state: ArrangeState | null, a: Arrangement | null, canAssign: boolean,
): { driverIds: string[]; supportIds: string[] } | null {
  if (!canAssign || !a?.offer || (state !== 'needs_date' && state !== 'clash')) return null
  return { driverIds: a.offer.driverIds, supportIds: a.offer.supportIds }
}

/** While an offer is with the client, Push to Schedule would skip the
 *  client — Client OK or a withdraw first. */
export function blocksPush(state: ArrangeState | null): boolean {
  return state === 'offered'
}

/** Every move out of Ongoing writes this in the SAME update — migration 0068's
 *  check refuses an arrange_state on any other status. */
export function arrangeClearPatch(): { arrange_state: null; arrangement: null } {
  return { arrange_state: null, arrangement: null }
}

// ── The To arrange list ─────────────────────────────────────────────────────

type ListRow = { arrange_state: ArrangeState | null; arrangement: Arrangement | null }

/** Sort key, oldest first; a missing one sorts last rather than dropping the
 *  job from the list. */
function byKey<T>(key: (j: T) => string | undefined) {
  return (a: T, b: T) => {
    const x = key(a), y = key(b)
    if (x === y) return 0
    if (x === undefined) return 1
    if (y === undefined) return -1
    return x < y ? -1 : 1
  }
}

/**
 * Needs a date (the scheduler's turn): clashes first — the client already
 * agreed — then longest-waiting first. Waiting on sales: offers out
 * (oldest first), then the ones he could not fit.
 */
export function groupArrangeJobs<T extends ListRow>(jobs: T[]): { needsDate: T[]; withSales: T[] } {
  const of = (s: ArrangeState) => jobs.filter(j => j.arrange_state === s)
  const ready = byKey<T>(j => j.arrangement?.readyAt)
  return {
    needsDate: [...of('clash').sort(ready), ...of('needs_date').sort(ready)],
    withSales: [
      ...of('offered').sort(byKey<T>(j => j.arrangement?.offer?.at)),
      ...of('no_fit').sort(byKey<T>(j => j.arrangement?.lastReturn?.at)),
    ],
  }
}
