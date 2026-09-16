/**
 * Pure rules for the driver board on /schedule — no React, no DOM, so the
 * board and its tests lean on the same logic.
 *
 * From Nic's two hand sketches and the 2026-09-15 design session, refined
 * 2026-09-16; spec at docs/superpowers/specs/2026-09-14-schedule-feedback.md
 * item 5.
 *
 * THE ONE RULE: a job's band is DERIVED from its formal crew, never stored.
 * 0 drivers → Unassigned, 1 → that driver's container, 2+ → Mixed. Everything
 * else falls out of it, including two things the spec listed as open
 * questions: "if only one driver is picked the card drops into that driver's
 * own container instead", and "drag one driver off a Mixed job and it should
 * fall into the other driver's container by itself". Both are the same line
 * of code, so neither can drift from the other.
 */

export type BoardAssignee = {
  users?:            { id: string; name: string } | null
  is_suggestion?:    boolean
  is_sub_installer?: boolean
}

/**
 * An outside contractor on a job. NOT a user — externals live in their own
 * `external_contacts` table with a lifetime link token, so they never appear
 * in job_assignees and the card was blind to them until 2026-09-16.
 */
export type BoardExternal = {
  is_suggestion?:     boolean
  external_contacts?: { id: string; name: string } | null
}

export type BoardJob = {
  id:                     string
  time_start:             string | null
  job_assignees:          BoardAssignee[]
  /** Optional: only the live schedule query loads these. */
  job_external_contacts?: BoardExternal[]
}

export type DriverRef = { id: string; name: string }

/**
 * Generic over the job type so a caller passing richer rows (ScheduleJob,
 * which carries the title, address and team the card renders) gets them back
 * unchanged rather than narrowed to the handful of fields these rules read.
 */
export type Band<T extends BoardJob = BoardJob> = {
  id:     string
  kind:   'mixed' | 'driver' | 'external' | 'unassigned'
  /** The person this band belongs to — null for Mixed and Unassigned. */
  driver: DriverRef | null
  jobs:   T[]
}

export const MIXED      = 'mixed'
export const UNASSIGNED = 'unassigned'

export const driverBandId   = (userId: string)    => `driver:${userId}`
export const externalBandId = (contactId: string) => `external:${contactId}`

const EXTERNAL_PREFIX = 'external:'

/**
 * The job's drivers: formal, non-support assignees.
 *
 * `is_sub_installer` lives on `job_assignees`, not on the person — the same
 * installer drives one job and supports another, so read it per row.
 * Suggestions are dropped here as well as in the query: a tentative sales
 * pick must never render as confirmed crew (migration 0037's rule), and this
 * module is fed from more than one caller.
 */
export function mainCrew(job: BoardJob): DriverRef[] {
  const out: DriverRef[] = []
  for (const row of job.job_assignees ?? []) {
    if (row?.is_suggestion) continue
    if (row?.is_sub_installer) continue
    if (!row?.users?.id) continue
    out.push({ id: row.users.id, name: row.users.name })
  }
  return out
}

/** The job's support crew: formal assignees carrying is_sub_installer. */
export function supportCrew(job: BoardJob): DriverRef[] {
  const out: DriverRef[] = []
  for (const row of job.job_assignees ?? []) {
    if (row?.is_suggestion) continue
    if (!row?.is_sub_installer) continue
    if (!row?.users?.id) continue
    out.push({ id: row.users.id, name: row.users.name })
  }
  return out
}

/**
 * The job's external installers: confirmed links only.
 *
 * A SUGGESTED external is a tentative sales pick, invisible on the contact's
 * own link page until a scheduler or coordinator confirms it (migration
 * 0040). It must not make a job look staffed on the board either.
 */
export function externalCrew(job: BoardJob): DriverRef[] {
  const out: DriverRef[] = []
  for (const row of job.job_external_contacts ?? []) {
    if (row?.is_suggestion) continue
    if (!row?.external_contacts?.id) continue
    out.push({ id: row.external_contacts.id, name: row.external_contacts.name })
  }
  return out
}

/**
 * THE rule — where the ONE live, draggable copy of a job lives.
 *
 * Internal crew decides it. A job with one of OUR drivers belongs to that
 * driver's container even when an outside contractor is helping (Nic): it is
 * the driver's van and the driver's day.
 *
 * Returns **null** when the job has no internal crew but does have an
 * external: its external container is then its only home, so that copy is the
 * live one rather than a mirror. Without this an external-only job could
 * never be dragged onto a driver.
 */
export function primaryBand(job: BoardJob): string | null {
  const drivers = mainCrew(job)
  if (drivers.length === 1) return driverBandId(drivers[0].id)
  if (drivers.length >= 2)  return MIXED
  if (externalCrew(job).length > 0) return null
  return UNASSIGNED
}

/**
 * Where a PROPOSED crew would put the card — the confirmation prompt's "lands
 * in" line.
 *
 * Same rule as primaryBand, but asked of a driver set the scheduler is still
 * choosing rather than of a saved job. Kept here beside it so the two can
 * never answer differently.
 */
export function landingBand(driverIds: string[], externalIds: string[] = []): string {
  if (driverIds.length === 1) return driverBandId(driverIds[0])
  if (driverIds.length >= 2)  return MIXED
  if (externalIds.length > 0) return externalBandId(externalIds[0])
  return UNASSIGNED
}

/**
 * The extra copies: one per confirmed external installer.
 *
 * Nic, 2026-09-16 — "i actually prefer having 2 duplicate copies of the job
 * but linking to same job form? so my driver gets 1 jobcard, external
 * installer gets another job card but both are the same thing. its for
 * visibility purpose."
 *
 * ONE job row, two cards, both opening the same job form. Nothing is
 * duplicated in the database; the board simply renders the same object twice,
 * so the two can never drift apart.
 */
export function mirrorBands(job: BoardJob): string[] {
  return externalCrew(job).map(e => externalBandId(e.id))
}

/**
 * Is an external copy of this job read-only?
 *
 * Yes whenever the job also has internal crew — the driver's card is the live
 * one, and two draggable cards for one job is how a board starts
 * contradicting itself. No when the externals are the job's only home, or it
 * could never be handed to a driver.
 */
export function isMirror(job: BoardJob): boolean {
  return mainCrew(job).length > 0
}

/**
 * Is THIS card, in THIS band, a read-only mirror?
 *
 * Asked per card rather than per band because one external container can hold
 * both: a mirror of a job that belongs to a driver, and an external-only job
 * that is live and draggable, side by side.
 */
export function isMirrorCard(job: BoardJob, bandId: string): boolean {
  return bandId.startsWith(EXTERNAL_PREFIX) && isMirror(job)
}

/** Earliest first; a job with no start time is an all-day floater and sorts last. */
export function sortByStartTime<T extends { time_start: string | null }>(jobs: T[]): T[] {
  return [...jobs].sort((a, b) => {
    if (!a.time_start && !b.time_start) return 0
    if (!a.time_start) return 1
    if (!b.time_start) return -1
    return a.time_start.localeCompare(b.time_start)
  })
}

/**
 * The bands to render, in FIXED order: Mixed, every driver, then any external
 * installer holding work, Unassigned last.
 *
 * A band is always in the same place — that is the whole point, and why this
 * beats one flowing grid, which reshuffles as the day fills so the scheduler
 * has to hunt. More drivers push Unassigned DOWN, never aside (Nic's words).
 *
 * Every known driver keeps a container even with nothing in it: "CK has
 * nothing today" is information, and a band that appears only when occupied
 * would move the others. Anyone assigned but NOT flagged is_driver gets a
 * container after the real ones, so no job can be invisible.
 *
 * EXTERNAL containers sit below every driver and above Unassigned (Nic,
 * 2026-09-16: "a new container below my 3 main driver… unassigned container
 * always below all of these"), and appear ONLY when they hold a job. That is
 * the deliberate difference from a driver: an external is an occasional
 * contractor, not a standing column, so an empty one would be clutter, while
 * an empty driver container is itself information.
 */
export function buildBands<T extends BoardJob>(jobs: T[], drivers: DriverRef[]): Band<T>[] {
  const knownIds  = drivers.map(d => d.id)
  const byBand    = new Map<string, T[]>()
  const strays    = new Map<string, DriverRef>()
  const externals = new Map<string, DriverRef>()

  const put = (bandId: string, job: T) => {
    const list = byBand.get(bandId)
    if (list) list.push(job)
    else byBand.set(bandId, [job])
  }

  for (const job of jobs) {
    const crew = mainCrew(job)
    const exts = externalCrew(job)

    if (crew.length === 1 && !knownIds.includes(crew[0].id)) strays.set(crew[0].id, crew[0])

    // The live card, where there is one.
    const primary = primaryBand(job)
    if (primary) put(primary, job)

    // A copy per external. The SAME object is pushed, not a clone — one job
    // row, two cards, both opening the same form, and they cannot drift.
    for (const e of exts) {
      externals.set(e.id, e)
      put(externalBandId(e.id), job)
    }
  }

  const take = (id: string) => sortByStartTime(byBand.get(id) ?? [])

  return [
    { id: MIXED, kind: 'mixed' as const, driver: null, jobs: take(MIXED) },
    ...[...drivers, ...strays.values()].map(d => ({
      id: driverBandId(d.id), kind: 'driver' as const, driver: d, jobs: take(driverBandId(d.id)),
    })),
    ...[...externals.values()].map(e => ({
      id: externalBandId(e.id), kind: 'external' as const, driver: e, jobs: take(externalBandId(e.id)),
    })),
    { id: UNASSIGNED, kind: 'unassigned' as const, driver: null, jobs: take(UNASSIGNED) },
  ]
}

/**
 * How many jobs are really on this day.
 *
 * A shared job renders twice, so adding up the band counts would tell the
 * scheduler there is more work than there is. Counting distinct ids is the
 * only figure that stays true however many containers a job appears in.
 */
export function countRealJobs(bands: Array<{ jobs: Array<{ id: string }> }>): number {
  const seen = new Set<string>()
  for (const band of bands) for (const job of band.jobs) seen.add(job.id)
  return seen.size
}

export type DragPlan = {
  targetBand:        string
  /** The driver set this drag proposes. The modal may still change it. */
  driverIds:         string[]
  /** Drivers coming OFF, so the prompt can name them. */
  removedDriverIds:  string[]
  /** Support crew this drag proposes, PRE-TICKED in the prompt. Empty when a
   *  driver is being removed — see planDrag. */
  supportIds:        string[]
  /** Support crew coming OFF, so the prompt can say so out loud rather than
   *  silently emptying a list the scheduler had filled. */
  removedSupportIds: string[]
  /** Offer the support-crew list. Always true except a drop to Unassigned,
   *  which clears everybody anyway. Nic: no silent drags. */
  askSupport:        boolean
  /** Offer the driver multi-select — a drop onto Mixed asks who is on it. */
  askDrivers:        boolean
  /** Clears the whole crew: confirm in the strongest terms. */
  destructive:       boolean
}

/**
 * What a drop proposes. Returns null when the drag would change nothing — a
 * no-op must not raise a prompt.
 *
 * Nothing here writes anything. The caller shows the prompt, the user
 * confirms, and only then does the crew route run. Cancel at any point and
 * the drag never happened.
 */
export function planDrag(job: BoardJob, targetBand: string, _drivers: DriverRef[]): DragPlan | null {
  const current = mainCrew(job).map(d => d.id)
  const support = supportCrew(job).map(d => d.id)

  // External containers are display-only (Nic, 2026-09-16) — assigning an
  // outside contractor stays on the job form, where the suggest-then-confirm
  // rules already live. The board also declines to register them as drop
  // targets; this is the second lock, so a UI refactor cannot undo the rule.
  if (targetBand.startsWith(EXTERNAL_PREFIX)) return null

  if (targetBand === UNASSIGNED) {
    // Already empty — a drop that changes nothing must not raise a prompt.
    if (current.length === 0 && support.length === 0) return null
    return {
      targetBand, driverIds: [], removedDriverIds: current,
      supportIds: [], removedSupportIds: support,
      askSupport: false, askDrivers: false, destructive: true,
    }
  }

  if (targetBand === MIXED) {
    if (current.length >= 2) return null       // already there
    return {
      targetBand, driverIds: current, removedDriverIds: [],
      supportIds: support, removedSupportIds: [],
      askSupport: true, askDrivers: true, destructive: false,
    }
  }

  const targetId = targetBand.replace(/^driver:/, '')
  if (current.length === 1 && current[0] === targetId) return null   // already there

  const removedDriverIds = current.filter(id => id !== targetId)

  /**
   * THE SUPPORT RULE: the support crew belongs to the DRIVER, not to the job.
   *
   * Nic, 2026-09-16 — first for Mixed ("CK + RINTU in mixed, if i drag into
   * xiao yi container, drop both driver and support then prompt who to
   * include for support xiao yi"), then widened to every move: "if moving
   * from one driver container over to another driver container, drop support
   * crew too. cuz its a different team altogether."
   *
   * So: whenever a drag takes a driver OFF, their helpers go with them and
   * the prompt starts empty. When no driver is removed — adding a second
   * driver to make a job Mixed, or placing an unassigned job — the existing
   * crew stays, because the person they ride with is still on it.
   *
   * One line, no special cases, and it reads the same way out loud as it does
   * in code.
   */
  const losesADriver = removedDriverIds.length > 0

  return {
    targetBand,
    driverIds:         [targetId],
    removedDriverIds,
    supportIds:        losesADriver ? []      : support,
    removedSupportIds: losesADriver ? support : [],
    askSupport:        true,
    askDrivers:        false,
    destructive:       false,
  }
}
