# Driver Containers + Drag-to-Reassign + 6pm Summaries — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/schedule`'s day list into a driver-grouped board the scheduler can drag jobs around, and replace the per-drag Telegram with two 6pm summaries — with jobs dated today still notifying immediately.

**Architecture:** A job's band is **derived, never stored** — the formal crew decides it (0 → Unassigned, 1 driver → that driver's container, 2+ drivers → Mixed Drivers), and every confirmed external installer gets a **second card for the same job object**, so the driver and the contractor each see their day complete without anything being duplicated in the database. That one rule gives the layout, every drag outcome, and the "job stops being shared" behaviour for free, and it lives in a pure module with no React so it can be tested standalone. Drags go through a single new server route that writes drivers and support crew together, records the change to the existing append-only `events` table (no new table), and notifies immediately only when the job is dated today. A 6pm cron reads those event rows and sends two different messages from a new summary bot.

**Tech Stack:** Next.js 15 App Router, TypeScript strict, Supabase (PostgREST + RLS), Tailwind, pointer-event drag (no library — mirrors `TaskListSection`), Telegram Bot API, Vercel cron.

**Spec:** `docs/superpowers/specs/2026-09-14-schedule-feedback.md` — item **5** (board + drag) and item **11** (summaries), which item 5 merged with.

## Global Constraints

- **Migration number 0061 is claimed** for this plan and nothing else. Verified 2026-09-16: highest applied on the live DB is `0060`; highest on any branch, local or remote (`dev`, `main`, `dev-bryan`, `feat-designer-load-flow`, `feat-live-updates`, `feat-voice-pa`, `feat-workflow-v2`, `origin/feat-provision`, `origin/feat-provision-organisation`) is also `0060`. **Never renumber or edit an applied migration.**
- **Run `npx supabase db push` BEFORE the code that reads the new columns reaches any deployment.** A preview crashing on a missing column is a repeat of the 2026-08-06 incident.
- **Overlays layer above the bottom nav** — `BottomNav` is `z-50`; every modal here uses `z-[60]` or higher. (CLAUDE.md hard rule.)
- **No new dependency.** The stack is locked. Drag is hand-rolled pointer events, the pattern already proven in `src/features/job-detail/TaskListSection.tsx:117-146`.
- **Tailwind theme colours are bare `var()` with no `<alpha-value>`** — `bg-x/20` compiles to NOTHING. Use `-soft` tokens or an rgba literal. Token names are `brand-green` / `brand-amber` / `brand-blue`, never bare `green` / `amber` / `blue`. Red is `--bad`, never `--terracotta` (that value is moss green).
- **Check the response of anything that writes.** `fetch` does not reject on HTTP errors; a `.catch(() => {})` is how a silent failure gets shipped. Every write in this plan reads its response.
- **English only for new user-facing strings**, added to `en.ts` + `zh.ts`; `bn` falls back automatically (bn freeze, boss decision 2026-08-03).
- **Date labels are always English** in every language (CLAUDE.md hard rule).
- **Tests are standalone tsx scripts**, no framework. Run one with `npx tsx path/to/file.test.ts`. Exit 1 on failure. Follow the shape of `src/lib/utils/job-card.test.ts`.
- **Every new test keeps the OLD behaviour asserted alongside the new one** where a bug is being fixed, so the test demonstrably catches the real thing (the 2026-09-14 rule).
- **Nic's decisions, 2026-09-16:** build board + summaries and merge only when both work · a **new** summary bot, not the ops bot · sort inside a container by **time**, and capture coordinates now for a later proximity feature · leave the job form's instant "Save & notify" Telegram exactly as it is.
- **Nic's external-installer decisions, 2026-09-16:** a job with a driver AND an external shows **twice — once in the driver's container, once in the external's** ("both the same thing, its for visibility purpose"), with the driver's copy the live one · external containers are **display-only, no drag in** — assigning an outsider stays on the job form · **accept/decline is removed entirely** from the external page: "we inform beforehand through message and call to set agreement, in which they have no rights to reject once agreed unless informed otherwise again."
- **Mixed Drivers stays** (Nic, 2026-09-16) — two of OUR drivers sharing a job do NOT mirror into both containers, because both copies would be draggable and could contradict each other. Mirrors are safe only because an external copy cannot be dragged.
- **Coming out of Mixed onto a driver drops the support crew too** (Nic, 2026-09-16) — "drop both driver and support then prompt who to include" — because a shared job's helpers belong to two different drivers' teams. A one-driver move keeps them, pre-ticked.

## Already built — do not rebuild

**The job card is done.** Spec item 5's "#### The card — Nic's type scale" shipped on 2026-09-15: full address (the `max-w-[150px]` truncation is gone), description over two lines, support crew and driver as name pills, status pill bottom-right. `JobRow.tsx` already renders it. This plan touches that file for **one thing only** — the optional drag handle (Task 7, Step 2).

## Not in scope, said out loud

- **Spec item 7 — the FCFS board is 2,282px wide at AM/PM zoom.** The spec parks it "with this", but it was never designed: it is a different board, on a different page, with a different fix (a zoom or a horizontal strategy for phones). Building it blind here would be guessing. It stays on the feedback list as its own item.
- **Hand-sorting jobs inside a container.** Answered 2026-09-16: time order, which is the driver's real day. No manual-order column, so nothing to migrate later if it changes.
- **Proximity sorting and a "who's already nearby" hint.** Deferred by the same decision. Task 2 captures the coordinates so the data is accumulating towards it; nothing reads them yet, and that is deliberate.
- **The job form's instant Telegram.** Nic, 2026-09-16: left exactly as it is. Pressing a button that says "notify" is a decision; dragging a card is arranging.

---

## File Structure

**Create**
| File | Responsibility |
|---|---|
| `src/lib/utils/driver-board.ts` | Pure band + drag rules. No React, no DOM. |
| `src/lib/utils/driver-board.test.ts` | Standalone test for the above. |
| `src/lib/utils/location-coords.ts` | Pure rule: when a picked address's coordinates survive and when they are cleared. |
| `src/lib/utils/location-coords.test.ts` | Standalone test for the above. |
| `src/app/api/jobs/[id]/crew/route.ts` | The one write path for a drag: drivers + support crew together, event recorded, today-only Telegram. |
| `src/features/schedule/useCardDrag.ts` | Pointer-event drag state for a card over bands. |
| `src/features/schedule/DriverBoard.tsx` | The three bands and their containers. |
| `src/features/schedule/CrewChangeModal.tsx` | The confirm prompt every drag must pass through. |
| `src/lib/telegram/day-summary.ts` | Pure builders for both 6pm messages + `tgEscape`. |
| `src/lib/telegram/day-summary.test.ts` | Standalone test for the above. |
| `src/app/api/cron/day-summary/route.ts` | The 6pm job: reads events, sends both summaries. |
| `supabase/migrations/0061_job_coords.sql` | `jobs.lat` / `jobs.lng`. |

**Modify**
| File | Change |
|---|---|
| `src/lib/supabase/queries/jobs.ts` | Select `lat, lng`; add `is_driver` to the assignee embed; new `getDrivers()`. |
| `src/features/schedule/ScheduleShell.tsx` | Fourth view mode `board`, scheduler/admin default, per-device memory. |
| `src/features/schedule/JobRow.tsx` | Optional drag handle on the left edge. |
| `src/app/schedule/page.tsx` | Pass the driver list down. |
| `src/app/api/places/details/route.ts` | Add `location` to the field mask, return lat/lng. |
| `src/features/job-detail/LocationInput.tsx` | Surface the picked coordinates. |
| `src/features/job-detail/JobDetailShell.tsx`, `NewJobShell.tsx` | Save / clear coordinates. |
| `src/lib/telegram/bot.ts` | `sendSummaryTelegram` on `TELEGRAM_SUMMARY_BOT_TOKEN`. |
| `src/app/api/admin/health/route.ts` | Health row for the summary bot. |
| `src/lib/i18n/en.ts`, `zh.ts` | New strings. |
| `vercel.json` | The 6pm cron. |
| `src/lib/supabase/types.ts` | `lat` / `lng` on the jobs Row. |

---

### Task 1: Pure board rules

The whole feature's logic, with no React around it. Everything else in this plan calls into this file.

**Files:**
- Create: `src/lib/utils/driver-board.ts`
- Test: `src/lib/utils/driver-board.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `MIXED`, `UNASSIGNED`, `driverBandId(userId)`, `externalBandId(contactId)`, `mainCrew(job)`, `supportCrew(job)`, `externalCrew(job)`, `primaryBand(job)`, `landingBand(driverIds, externalIds)`, `mirrorBands(job)`, `isMirror(job)`, `isMirrorCard(job, bandId)`, `buildBands(jobs, drivers)`, `countRealJobs(bands)`, `sortByStartTime(jobs)`, `planDrag(job, targetBand, drivers)`. Types `BoardJob`, `BoardAssignee`, `BoardExternal`, `DriverRef`, `Band`, `DragPlan`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/utils/driver-board.test.ts
/**
 * Standalone test for the driver board rules (no test framework).
 * Run: npx tsx src/lib/utils/driver-board.test.ts
 * Exits 1 on any failure.
 */

import {
  MIXED, UNASSIGNED, driverBandId, externalBandId,
  mainCrew, primaryBand, mirrorBands, isMirror, isMirrorCard, buildBands, countRealJobs,
  sortByStartTime, planDrag,
  type BoardJob, type DriverRef,
} from './driver-board'

let failures = 0

function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`); failures++ }
}

const CK    = { id: 'ck',    name: 'CK'      }
const RINTU = { id: 'rintu', name: 'Rintu'   }
const XY    = { id: 'xy',    name: 'Xiao Yi' }
const DRIVERS: DriverRef[] = [CK, RINTU, XY]

const main    = (u: DriverRef) => ({ users: { id: u.id, name: u.name }, is_sub_installer: false })
const support = (u: DriverRef) => ({ users: { id: u.id, name: u.name }, is_sub_installer: true  })
const sugg    = (u: DriverRef) => ({ users: { id: u.id, name: u.name }, is_sub_installer: false, is_suggestion: true })

/** An external installer link. Not a user — externals live in their own table. */
const ext = (id: string, name: string, isSuggestion = false) =>
  ({ is_suggestion: isSuggestion, external_contacts: { id, name } })

const job = (
  id: string,
  assignees: BoardJob['job_assignees'],
  time: string | null = '09:00:00',
  externals: BoardJob['job_external_contacts'] = [],
): BoardJob =>
  ({ id, time_start: time, job_assignees: assignees, job_external_contacts: externals })

console.log('mainCrew:')

check('formal non-support assignees only',
  mainCrew(job('j1', [main(CK), support(RINTU)])),
  [{ id: 'ck', name: 'CK' }])

// A suggestion is a tentative sales pick. It must never place a job in a
// driver's container — that would show an installer as booked when nobody
// has confirmed it (the rule behind migration 0037).
check('a suggestion is not crew',
  mainCrew(job('j2', [sugg(CK)])),
  [])

console.log('primaryBand — where the ONE draggable copy of a job lives:')

check('nobody on it → Unassigned',    primaryBand(job('p1', [])),                    UNASSIGNED)
check('one driver → their container', primaryBand(job('p2', [main(CK)])),            driverBandId('ck'))
check('two drivers → Mixed',          primaryBand(job('p3', [main(CK), main(RINTU)])), MIXED)
check('three drivers → Mixed',        primaryBand(job('p4', [main(CK), main(RINTU), main(XY)])), MIXED)
check('support crew alone does NOT place a job', primaryBand(job('p5', [support(CK)])), UNASSIGNED)

// Someone not flagged is_driver still gets their own container rather than
// vanishing. Old rows predate the 2026-09-07 Drivers bucket, and a job that
// is not on the board is a job the scheduler cannot find.
check('a lone non-driver still gets their own container',
  primaryBand(job('p6', [{ users: { id: 'zz', name: 'Ali Ramjan' }, is_sub_installer: false }])),
  driverBandId('zz'))

// A job with a driver AND an external belongs to the DRIVER (Nic): it is the
// driver's van and the driver's day. The external ALSO sees it — as a mirror,
// below — but the live, draggable card sits here.
check('a driver plus an external is still the driver\'s',
  primaryBand(job('p7', [main(CK)], '09:00:00', [ext('ahseng', 'Ah Seng')])),
  driverBandId('ck'))

// An external-only job has NO primary band: its external container is its only
// home, so that copy is the live one. null says "look in the mirrors".
check('external only → no primary band', primaryBand(job('p8', [], '09:00:00', [ext('ahseng','Ah Seng')])), null)

console.log('mirrorBands — the extra copies, one per external:')

check('no externals → no mirrors', mirrorBands(job('m1', [main(CK)])), [])

// Nic, 2026-09-16: "i actually prefer having 2 duplicate copies of the job but
// linking to same job form — my driver gets 1 jobcard, external installer gets
// another, both the same thing. its for visibility purpose."
check('a driver + external job appears in the external\'s container too',
  mirrorBands(job('m2', [main(CK)], '09:00:00', [ext('ahseng','Ah Seng')])),
  [externalBandId('ahseng')])

check('two externals → a copy each',
  mirrorBands(job('m3', [main(CK)], '09:00:00', [ext('ahseng','Ah Seng'), ext('bl','Boon Leong')])),
  [externalBandId('ahseng'), externalBandId('bl')])

// A suggested external is a tentative sales pick that has not been confirmed
// — invisible on the contact's own link page (migration 0040), so it must not
// make the job look staffed here either.
check('a SUGGESTED external gets no copy',
  mirrorBands(job('m4', [main(CK)], '09:00:00', [ext('ahseng','Ah Seng', true)])),
  [])

console.log('isMirror — a copy is read-only only when the job has a real home:')

// The drag acts on the JOB, not on the container it was picked up from, so a
// mirror must not be draggable: two live cards for one job is how a board
// starts contradicting itself.
check('an external copy beside a driver copy is a mirror',
  isMirror(job('r1', [main(CK)], '09:00:00', [ext('ahseng','Ah Seng')])), true)

// With nobody internal on it, the external container IS the job's only home —
// so that card must stay draggable, or an external-only job could never be
// given to a driver.
check('an external-only job is NOT a mirror', isMirror(job('r2', [], '09:00:00', [ext('ahseng','Ah Seng')])), false)

console.log('buildBands — fixed order, drivers always present:')

const bands = buildBands(
  [job('a', [main(CK)]), job('b', [main(CK), main(RINTU)]), job('c', [])],
  DRIVERS,
)
check('order is Mixed, then every driver, then Unassigned',
  bands.map(b => b.id),
  [MIXED, driverBandId('ck'), driverBandId('rintu'), driverBandId('xy'), UNASSIGNED])
check('jobs land in the right bands',
  bands.map(b => b.jobs.map(j => j.id)),
  [['b'], ['a'], [], [], ['c']])

// An empty driver container must still render: "CK has nothing today" is
// information, and a band that appears only when full moves the others.
check('an idle driver keeps their container',
  buildBands([], DRIVERS).map(b => b.id),
  [MIXED, driverBandId('ck'), driverBandId('rintu'), driverBandId('xy'), UNASSIGNED])

check('a stray non-driver gets a container after the real drivers',
  buildBands([job('s', [{ users: { id: 'zz', name: 'Ali Ramjan' }, is_sub_installer: false }])], DRIVERS)
    .map(b => b.id),
  [MIXED, driverBandId('ck'), driverBandId('rintu'), driverBandId('xy'), driverBandId('zz'), UNASSIGNED])

// External containers sit BELOW the three main drivers and ABOVE Unassigned
// (Nic's words: "a new container below my 3 main driver… unassigned container
// always below all of these"). They appear ONLY when they hold a job — an
// external is an occasional contractor, not a standing column, so an empty
// one would be clutter. That is the deliberate difference from a driver,
// whose empty container is itself information.
check('an external container sits under the drivers, above Unassigned',
  buildBands([job('e', [], '09:00:00', [ext('ahseng', 'Ah Seng')])], DRIVERS).map(b => b.id),
  [MIXED, driverBandId('ck'), driverBandId('rintu'), driverBandId('xy'), externalBandId('ahseng'), UNASSIGNED])

check('no external jobs → no external containers',
  buildBands([job('n', [main(CK)])], DRIVERS).map(b => b.id),
  [MIXED, driverBandId('ck'), driverBandId('rintu'), driverBandId('xy'), UNASSIGNED])

check('an external container is named after the contact',
  buildBands([job('e', [], '09:00:00', [ext('ahseng', 'Ah Seng')])], DRIVERS)
    .find(b => b.id === externalBandId('ahseng'))?.driver?.name,
  'Ah Seng')

// The duplicate-copy rule (Nic, 2026-09-16). ONE job row, TWO cards, both
// opening the same job form — the driver sees their day complete and the
// external sees theirs, and neither has to know about the other's container.
const shared = buildBands(
  [job('sh', [main(CK)], '09:00:00', [ext('ahseng', 'Ah Seng')])],
  DRIVERS,
)
check('a shared job appears in BOTH containers',
  shared.filter(b => b.jobs.length > 0).map(b => b.id),
  [driverBandId('ck'), externalBandId('ahseng')])
check('and it is the same job, not a copy of the data',
  shared.filter(b => b.jobs.length > 0).map(b => b.jobs[0].id),
  ['sh', 'sh'])
// Per CARD, not per band: one external container can hold a mirror of a
// driver's job AND an external-only job that is live, side by side.
check('the driver copy is live, the external copy is a mirror',
  shared.filter(b => b.jobs.length > 0).map(b => isMirrorCard(b.jobs[0], b.id)),
  [false, true])
check('an external-only job in an external container is NOT a mirror',
  isMirrorCard(job('eo', [], '09:00:00', [ext('ahseng','Ah Seng')]), externalBandId('ahseng')),
  false)

// The count must not lie. Two cards for one job would otherwise read as two
// jobs, and a scheduler counting the day's work would be wrong.
check('the real job count ignores mirrors', countRealJobs(shared), 1)
check('and counts unshared jobs once each',
  countRealJobs(buildBands([job('x', [main(CK)]), job('y', [])], DRIVERS)), 2)

console.log('sortByStartTime — a driver\'s day runs in clock order:')

check('earliest first, no-time last',
  sortByStartTime([job('late', [], '14:00:00'), job('none', [], null), job('early', [], '08:30:00')])
    .map(j => j.id),
  ['early', 'late', 'none'])

console.log('planDrag:')

// Mixed → a driver. Nic, 2026-09-16: "CK + RINTU in mixed, if i drag into
// xiao yi container, drop BOTH driver and support then prompt who to include
// for support xiao yi." A shared job's support crew belongs to two different
// drivers' teams, so carrying them across to a third driver would be wrong —
// the slate is wiped and the prompt starts empty.
check('mixed to a driver drops every other driver AND the support crew',
  planDrag(job('m', [main(CK), main(RINTU), support(XY)]), driverBandId('ck'), DRIVERS),
  {
    targetBand: driverBandId('ck'),
    driverIds: ['ck'], removedDriverIds: ['rintu'],
    supportIds: [], removedSupportIds: ['xy'],
    askSupport: true, askDrivers: false, destructive: false,
  })

check('three drivers in mixed → only the target survives',
  planDrag(job('m3', [main(CK), main(RINTU), main(XY)]), driverBandId('ck'), DRIVERS),
  {
    targetBand: driverBandId('ck'),
    driverIds: ['ck'], removedDriverIds: ['rintu', 'xy'],
    supportIds: [], removedSupportIds: [],
    askSupport: true, askDrivers: false, destructive: false,
  })

// A ONE-driver move is different: the job was one driver's all along, so its
// support crew is that job's crew and travels with it, pre-ticked. The
// scheduler can still take them off in the prompt.
check('driver to driver KEEPS the support crew, pre-ticked',
  planDrag(job('d2', [main(CK), support(XY)]), driverBandId('rintu'), DRIVERS),
  {
    targetBand: driverBandId('rintu'),
    driverIds: ['rintu'], removedDriverIds: ['ck'],
    supportIds: ['xy'], removedSupportIds: [],
    askSupport: true, askDrivers: false, destructive: false,
  })

// Nic's rule: ALWAYS asks, even with no support crew — no silent drags.
check('a driver-to-driver move still asks with no support crew',
  planDrag(job('d', [main(CK)]), driverBandId('rintu'), DRIVERS),
  {
    targetBand: driverBandId('rintu'),
    driverIds: ['rintu'], removedDriverIds: ['ck'],
    supportIds: [], removedSupportIds: [],
    askSupport: true, askDrivers: false, destructive: false,
  })

check('unassigned to a driver adds them and offers support crew',
  planDrag(job('u', []), driverBandId('xy'), DRIVERS),
  {
    targetBand: driverBandId('xy'),
    driverIds: ['xy'], removedDriverIds: [],
    supportIds: [], removedSupportIds: [],
    askSupport: true, askDrivers: false, destructive: false,
  })

// The most destructive drag on the board — it clears everybody.
check('to Unassigned clears everyone and is flagged destructive',
  planDrag(job('x', [main(CK), support(RINTU)]), UNASSIGNED, DRIVERS),
  {
    targetBand: UNASSIGNED,
    driverIds: [], removedDriverIds: ['ck'],
    supportIds: [], removedSupportIds: ['rintu'],
    askSupport: false, askDrivers: false, destructive: true,
  })

check('to Mixed asks who should be on it',
  planDrag(job('y', [main(CK)]), MIXED, DRIVERS),
  {
    targetBand: MIXED,
    driverIds: ['ck'], removedDriverIds: [],
    supportIds: [], removedSupportIds: [],
    askSupport: true, askDrivers: true, destructive: false,
  })

// Dropping a card back where it already is must be a no-op, not a prompt.
check('a drag onto its own band is refused',
  planDrag(job('z', [main(CK)]), driverBandId('ck'), DRIVERS),
  null)

// Nic's call: external containers are display-only. Assigning an outsider
// stays on the job form, where the suggest-then-confirm rules live. The board
// also never registers them as drop targets, so this is belt and braces —
// the rule is asserted here so it cannot be lost in a UI refactor.
check('dragging INTO an external container is refused',
  planDrag(job('e1', [main(CK)]), externalBandId('ahseng'), DRIVERS),
  null)

// Dragging a job OUT of an external's container onto a driver is allowed, and
// the external STAYS: they were phoned and agreed to this job, so a drag must
// not quietly drop a contractor who is expecting to turn up.
check('external to a driver adds the driver and keeps the external',
  planDrag(job('e2', [], '09:00:00', [ext('ahseng', 'Ah Seng')]), driverBandId('ck'), DRIVERS),
  {
    targetBand: driverBandId('ck'),
    driverIds: ['ck'], removedDriverIds: [],
    supportIds: [], askSupport: true, askDrivers: false, destructive: false,
  })

console.log(failures === 0 ? '\nAll driver-board checks passed.' : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tsx src/lib/utils/driver-board.test.ts`
Expected: FAIL — `Cannot find module './driver-board'`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/utils/driver-board.ts
/**
 * Pure rules for the driver board on /schedule — no React, no DOM, so the
 * board and its tests lean on the same logic.
 *
 * From Nic's two hand sketches and the 2026-09-15 design session; spec at
 * docs/superpowers/specs/2026-09-14-schedule-feedback.md item 5.
 *
 * THE ONE RULE: a job's band is DERIVED from its formal crew, never stored.
 * 0 → Unassigned, 1 driver → that driver's container, 2+ drivers → Mixed, no
 * driver but an external → that external's container. Everything else falls
 * out of it, including two things the spec listed as open questions: "if only
 * one driver is picked the card drops into that driver's own container
 * instead", and "drag one driver off a Mixed job and it should fall into the
 * other driver's container by itself". Both are the same line of code, so
 * neither can drift from the other.
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
  id:                    string
  time_start:            string | null
  job_assignees:         BoardAssignee[]
  /** Optional: only the live schedule query loads these. */
  job_external_contacts?: BoardExternal[]
}

export type DriverRef = { id: string; name: string }

export type Band = {
  id:     string
  kind:   'mixed' | 'driver' | 'external' | 'unassigned'
  /** The person this band belongs to — null for Mixed and Unassigned. */
  driver: DriverRef | null
  jobs:   BoardJob[]
}

export const MIXED      = 'mixed'
export const UNASSIGNED = 'unassigned'

export const driverBandId   = (userId: string)    => `driver:${userId}`
export const externalBandId = (contactId: string) => `external:${contactId}`

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
  return bandId.startsWith('external:') && isMirror(job)
}

/**
 * How many jobs are really on this day.
 *
 * A shared job renders twice, so adding up the band counts would tell the
 * scheduler there is more work than there is. Counting distinct ids is the
 * only figure that stays true however many containers a job appears in.
 */
export function countRealJobs(bands: Band[]): number {
  const seen = new Set<string>()
  for (const band of bands) for (const job of band.jobs) seen.add(job.id)
  return seen.size
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
 * The bands to render, in FIXED order: Mixed, every driver, Unassigned last.
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
export function buildBands(jobs: BoardJob[], drivers: DriverRef[]): Band[] {
  const knownIds  = drivers.map(d => d.id)
  const byBand    = new Map<string, BoardJob[]>()
  const strays    = new Map<string, DriverRef>()
  const externals = new Map<string, DriverRef>()

  const put = (bandId: string, job: BoardJob) =>
    (byBand.get(bandId) ?? byBand.set(bandId, []).get(bandId)!).push(job)

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

export type DragPlan = {
  targetBand:       string
  /** The driver set this drag proposes. The modal may still change it. */
  driverIds:        string[]
  /** Drivers coming OFF, so the prompt can name them. */
  removedDriverIds: string[]
  /** Support crew this drag proposes, PRE-TICKED in the prompt. Empty when
   *  coming out of Mixed — see planDrag. */
  supportIds:       string[]
  /** Support crew coming OFF, so the prompt can say so out loud rather than
   *  silently emptying a list the scheduler had filled. */
  removedSupportIds: string[]
  /** Offer the support-crew list. Always true except a drop to Unassigned,
   *  which clears everybody anyway. Nic: no silent drags. */
  askSupport:       boolean
  /** Offer the driver multi-select — a drop onto Mixed asks who is on it. */
  askDrivers:       boolean
  /** Clears the whole crew: confirm in the strongest terms. */
  destructive:      boolean
}

/**
 * What a drop proposes. Returns null when the card was dropped on the band it
 * already lives in — a no-op must not raise a prompt.
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
  if (targetBand.startsWith('external:')) return null

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

  /**
   * Coming OUT of Mixed, the support crew is dropped too and the prompt
   * starts empty.
   *
   * Nic, 2026-09-16: "CK + RINTU in mixed, if i drag into xiao yi container,
   * drop both driver and support then prompt who to include for support xiao
   * yi." A shared job's helpers belong to two different drivers' teams, so
   * carrying them across to a third driver would hand him someone else's
   * crew. A ONE-driver move is the opposite case — that support crew is the
   * job's own, so it travels with it, pre-ticked and removable.
   */
  const fromMixed = current.length >= 2

  return {
    targetBand,
    driverIds:         [targetId],
    removedDriverIds:  current.filter(id => id !== targetId),
    supportIds:        fromMixed ? []      : support,
    removedSupportIds: fromMixed ? support : [],
    askSupport:        true,
    askDrivers:        false,
    destructive:       false,
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx tsx src/lib/utils/driver-board.test.ts`
Expected: PASS, every check ticked, exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/driver-board.ts src/lib/utils/driver-board.test.ts
git commit -m "feat: pure band and drag rules for the driver board

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Migration 0061 + capturing address coordinates

Independent of the board. Nic's call: start saving coordinates now so a proximity feature has months of data when it is designed. Costs nothing — `location` sits in Google's **Essentials** SKU, the same tier as the `formattedAddress` we already request (verified against Google's docs 2026-09-16).

**Files:**
- Create: `supabase/migrations/0061_job_coords.sql`
- Create: `src/lib/utils/location-coords.ts`
- Test: `src/lib/utils/location-coords.test.ts`
- Modify: `src/app/api/places/details/route.ts`, `src/features/job-detail/LocationInput.tsx`, `src/lib/supabase/types.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `coordsAfterChange({ previous, nextValue, fromPick, pickedCoords })` returning `{ lat: number | null; lng: number | null }`; `PlaceDetailsResponse` gains `lat: number | null; lng: number | null`; `LocationInput` gains an optional `onCoords?: (c: { lat: number; lng: number } | null) => void`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/utils/location-coords.test.ts
/**
 * Standalone test for job location coordinates (no test framework).
 * Run: npx tsx src/lib/utils/location-coords.test.ts
 * Exits 1 on any failure.
 */

import { coordsAfterChange } from './location-coords'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`); failures++ }
}

const HERE  = { lat: 1.3036, lng: 103.8318 }
const THERE = { lat: 1.3521, lng: 103.8198 }

console.log('coordsAfterChange:')

check('picking a suggestion stores its coordinates',
  coordsAfterChange({ previous: { lat: null, lng: null }, nextValue: '313 Orchard Rd', fromPick: true, pickedCoords: HERE }),
  HERE)

check('picking a different place replaces them',
  coordsAfterChange({ previous: HERE, nextValue: 'Somewhere else', fromPick: true, pickedCoords: THERE }),
  THERE)

// The bug this rule exists to prevent: pick "313 Orchard", then hand-edit the
// text to a different address. Without clearing, the job would carry
// coordinates pointing at a place it is no longer at — silently wrong data
// that a future proximity feature would trust.
check('typing over a picked address clears the coordinates',
  coordsAfterChange({ previous: HERE, nextValue: 'Blk 825 Tampines', fromPick: false }),
  { lat: null, lng: null })

// Whitespace-only edits are not a different place.
check('trailing whitespace is not a new address',
  coordsAfterChange({ previous: HERE, nextValue: '313 Orchard Rd  ', fromPick: false, previousValue: '313 Orchard Rd' }),
  HERE)

check('a pick that returns no coordinates leaves nothing behind',
  coordsAfterChange({ previous: HERE, nextValue: 'Unknown place', fromPick: true, pickedCoords: null }),
  { lat: null, lng: null })

check('an empty box has no coordinates',
  coordsAfterChange({ previous: HERE, nextValue: '', fromPick: false }),
  { lat: null, lng: null })

console.log(failures === 0 ? '\nAll location-coords checks passed.' : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tsx src/lib/utils/location-coords.test.ts`
Expected: FAIL — `Cannot find module './location-coords'`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/utils/location-coords.ts
/**
 * When a job's saved map coordinates survive an edit to the Location box, and
 * when they must be thrown away.
 *
 * Captured from 2026-09-16 on Nic's call, against a future "which driver is
 * already near this job" feature. Nothing reads lat/lng yet — this is
 * deliberate data capture, recorded here and in the migration so a later
 * session does not mistake it for dead code.
 *
 * The rule that matters: coordinates belong to a PICKED suggestion. The
 * moment someone types over the box by hand the pin no longer describes what
 * is written there, and stale coordinates are worse than none — a proximity
 * feature would trust them.
 */

export type Coords = { lat: number; lng: number }
export type MaybeCoords = { lat: number | null; lng: number | null }

const EMPTY: MaybeCoords = { lat: null, lng: null }

export function coordsAfterChange(p: {
  previous:       MaybeCoords
  previousValue?: string
  nextValue:      string
  fromPick:       boolean
  pickedCoords?:  Coords | null
}): MaybeCoords {
  if (p.fromPick) {
    return p.pickedCoords
      ? { lat: p.pickedCoords.lat, lng: p.pickedCoords.lng }
      : EMPTY
  }
  if (!p.nextValue.trim()) return EMPTY
  // A hand edit that changes nothing but whitespace is not a new address.
  if (p.previousValue !== undefined && p.previousValue.trim() === p.nextValue.trim()) {
    return p.previous
  }
  return EMPTY
}
```

```sql
-- supabase/migrations/0061_job_coords.sql
-- =============================================================
-- 0061 — job location coordinates
--
-- Captured from the Google Places pick on the job form (Nic, 2026-09-16).
-- `location` sits in Google's Essentials SKU, the same tier as the
-- formattedAddress the form already requests, so this costs nothing extra:
-- one more field in a request we were already making.
--
-- NOTHING READS THESE COLUMNS YET, on purpose. They exist so that when the
-- "which driver is already near this job" hint is designed, there is real
-- data behind it instead of an empty table. Do not delete them as dead code
-- — see docs/context.md, 2026-09-16.
--
-- Additive and nullable: every existing job keeps NULL, and no deployed code
-- path requires a value. Jobs whose address was typed rather than picked
-- stay NULL for ever unless someone re-picks the address.
-- =============================================================

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS lat double precision;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS lng double precision;

COMMENT ON COLUMN jobs.lat IS 'Latitude of the picked Google Place. NULL when typed by hand. Unused by any code as of 0061 — deliberate capture for a future proximity feature.';
COMMENT ON COLUMN jobs.lng IS 'Longitude of the picked Google Place. NULL when typed by hand. Unused by any code as of 0061 — deliberate capture for a future proximity feature.';
```

In `src/app/api/places/details/route.ts`, change the field mask and response:

```ts
export interface PlaceDetailsResponse {
  /** '' when unavailable — the caller then keeps the suggestion's own text. */
  formattedAddress: string
  /** Null when Google gave no location. Same Essentials SKU as the address,
   *  so asking for it costs nothing extra (verified 2026-09-16). */
  lat: number | null
  lng: number | null
}
```

- `'X-Goog-FieldMask': 'formattedAddress,location'`
- Parse `data.location?.latitude` / `.longitude`, defaulting to `null`.
- Every early return in the route must now also return `lat: null, lng: null`.

In `LocationInput.tsx`, add `onCoords?: (c: { lat: number; lng: number } | null) => void` to `Props`; call `onCoords?.(null)` inside the plain `onChange` handler (line 162, the hand-typing path), and `onCoords?.(data.lat !== null && data.lng !== null ? { lat: data.lat, lng: data.lng } : null)` in the details `.then` beside the existing `onChange`.

In `src/lib/supabase/types.ts`, add `lat: number | null` and `lng: number | null` to the `jobs` Row type.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx tsx src/lib/utils/location-coords.test.ts` → PASS.
Then `npm run type-check` → clean.

- [ ] **Step 5: Apply the migration, then commit**

```bash
npx supabase db push
git add supabase/migrations/0061_job_coords.sql src/lib/utils/location-coords.ts src/lib/utils/location-coords.test.ts src/app/api/places/details/route.ts src/features/job-detail/LocationInput.tsx src/lib/supabase/types.ts
git commit -m "feat: capture map coordinates when an address is picked (migration 0061)

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

**Verify the push landed before moving on:** `npx supabase migration list` must show `0061` in the remote column.

---

### Task 3: Wire coordinates through both job forms

**Files:**
- Modify: `src/features/job-detail/CoreSection.tsx:388` (the single `LocationInput` call site — both forms share this section), `src/features/job-detail/JobDetailShell.tsx`, `src/features/job-detail/NewJobShell.tsx`

**Interfaces:**
- Consumes: `coordsAfterChange` (Task 2), `LocationInput`'s `onCoords`.
- Produces: `lat` / `lng` included in both forms' saved payloads.

- [ ] **Step 1: Confirm the single call site**

Run: `rg -n "LocationInput" src/features --glob '!LocationInput.tsx'`
Expected: `src/features/job-detail/CoreSection.tsx` only — the New Job and Edit forms share `CoreSection`, so this is wired once, not twice.

- [ ] **Step 2: Add lat/lng to the form state**

Register `lat` and `lng` as react-hook-form fields (`useForm` defaults from the loaded job, `null` on a new job). Pass `onCoords` to `LocationInput` inside the existing `<Controller name="location">` render at `CoreSection.tsx:388`:

```tsx
onCoords={c => {
  setValue('lat', c?.lat ?? null, { shouldDirty: true })
  setValue('lng', c?.lng ?? null, { shouldDirty: true })
}}
```

Because `LocationInput` already calls `onCoords?.(null)` on any hand edit, `coordsAfterChange`'s clearing rule is enforced by the component, and the form only mirrors it.

- [ ] **Step 3: Include them in the save payload**

Add `lat: values.lat ?? null, lng: values.lng ?? null` to both forms' update/insert objects, beside `location`.

- [ ] **Step 4: Verify**

Run: `npm run type-check` → clean. Then `npm run build` → clean.

- [ ] **Step 5: Commit**

```bash
git add src/features/job-detail
git commit -m "feat: job forms save the picked address coordinates

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: The crew write route

One route, one write, one place where a drag becomes real. It replaces what would otherwise be two calls (`assign-installers` + `sub-installers`), because a drag changes drivers and support crew together and a half-applied drag is worse than a refused one.

**Files:**
- Create: `src/app/api/jobs/[id]/crew/route.ts`
- Modify: `src/lib/supabase/queries/notifications.ts` (add `recordCrewChange`)

**Interfaces:**
- Consumes: `mainCrew`, `supportCrew` from `driver-board.ts`; `sendTelegram`, `tplJobAssigned`, `tplInstallerAssigned` from the existing Telegram modules.
- Produces: `POST /api/jobs/[id]/crew` taking `{ driver_ids: string[]; support_ids: string[] }`, answering `{ ok: true; notifiedNow: boolean }` or `{ error }`; `recordCrewChange(jobId, changes, actorId, notifiedNow)` writing one `events` row per affected person with `kind: 'crew_change'`.

- [ ] **Step 1: Add the event recorder**

```ts
// append to src/lib/supabase/queries/notifications.ts

/**
 * One append-only row per person affected by a board drag.
 *
 * This is the queue the 6pm summary reads. It rides on the existing `events`
 * table rather than a new one: events already has a jsonb payload, is
 * service-role-only, and is never updated or deleted — exactly the shape a
 * change log needs. No migration.
 *
 * `notified_now` marks a change that already went out immediately because the
 * job is dated today (Nic's exception, 2026-09-15). The cron skips those, so
 * nobody gets the same reassignment twice.
 */
export async function recordCrewChange(
  jobId:       string,
  changes:     Array<{ userId: string; action: 'added' | 'removed'; asSupport: boolean }>,
  actorId:     string | null,
  notifiedNow: boolean,
): Promise<void> {
  if (changes.length === 0) return
  const supabase = createServiceClient()
  await supabase.from('events').insert(
    changes.map(c => ({
      actor_id:     actorId,
      kind:         'crew_change',
      target_id:    jobId,
      target_table: 'jobs',
      payload:      { user_id: c.userId, action: c.action, as_support: c.asSupport, notified_now: notifiedNow },
      visibility:   ['role:scheduler'],
    })) as never,
  )
}
```

- [ ] **Step 2: Write the route**

```ts
// src/app/api/jobs/[id]/crew/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveRole } from '@/lib/utils/role-override'
import { getJobNotifData, getJobRecipients, recordCrewChange } from '@/lib/supabase/queries/notifications'
import { sendTelegram } from '@/lib/telegram/bot'
import { tplJobAssigned, tplInstallerAssigned } from '@/lib/telegram/templates'
import type { Role } from '@/lib/supabase/types'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://greenqubes-ops.vercel.app'

/**
 * The ONE write path for a driver-board drag: drivers and support crew set
 * together, in one request.
 *
 * Why not reuse /assign-installers + /sub-installers: a drag changes both
 * lists at once, and two sequential calls can leave a job with the new driver
 * and the old support crew if the second fails. They also each fire their own
 * Telegram, which is precisely what the board is designed NOT to do.
 *
 * NOTIFICATIONS (Nic, 2026-09-15 — the load-bearing decision of the feature):
 * a drag Telegrams NOBODY, because a scheduler arranging tomorrow would buzz
 * an installer ten times for a day that is not settled, each message
 * contradicting the last. Changes are recorded and collected into a 6pm
 * summary instead — EXCEPT a job dated TODAY, which notifies immediately, so
 * a 2pm reassignment never reaches the installer after the job should have
 * started.
 *
 * Scheduler and admin only. Sales and coordinators have been suggest-only for
 * installers since 2026-09-01; for them the board is read-only.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: jobId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  type ProfileRow = { id: string; role: Role }
  const { data: profile } = await supabase
    .from('users').select('id, role').eq('auth_id', user.id).maybeSingle() as
    { data: ProfileRow | null; error: unknown }
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // The REAL role, not the effective one — getEffectiveRole never returns
  // 'admin' (a plain admin resolves to 'scheduler'), so an admin-only gate
  // written against it silently never matches. Same trap as the quiet-push
  // button, 2026-09-15.
  const effectiveRole = await getEffectiveRole(profile.role)
  if (!['scheduler', 'admin'].includes(effectiveRole) && profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const asIds = (x: unknown): string[] =>
    Array.isArray(x) ? x.filter((v): v is string => typeof v === 'string') : []
  const driverIds  = [...new Set(asIds(body.driver_ids))]
  // Nobody can be a driver and support crew on the same job — the
  // job_assignees PK is (job_id, user_id), so one row per person.
  const supportIds = [...new Set(asIds(body.support_ids))].filter(id => !driverIds.includes(id))

  type JobRow = { id: string; date: string; status: string }
  const { data: job } = await supabase
    .from('jobs').select('id, date, status').eq('id', jobId).maybeSingle() as
    { data: JobRow | null; error: unknown }
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (job.status === 'completed') {
    return NextResponse.json({ error: 'This job is completed — reopen it first.' }, { status: 409 })
  }

  // ── What changed, before we write ───────────────────────────────────────
  type ExistingRow = { user_id: string; is_sub_installer: boolean }
  const { data: existing } = await supabase
    .from('job_assignees')
    .select('user_id, is_sub_installer')
    .eq('job_id', jobId)
    .eq('is_suggestion', false) as { data: ExistingRow[] | null }
  const before = new Map((existing ?? []).map(r => [r.user_id, r.is_sub_installer]))
  const after  = new Map<string, boolean>([
    ...driverIds.map(id  => [id, false] as const),
    ...supportIds.map(id => [id, true]  as const),
  ])

  const changes: Array<{ userId: string; action: 'added' | 'removed'; asSupport: boolean }> = []
  for (const [id, asSupport] of after) {
    if (!before.has(id) || before.get(id) !== asSupport) changes.push({ userId: id, action: 'added', asSupport })
  }
  for (const [id, asSupport] of before) {
    if (!after.has(id)) changes.push({ userId: id, action: 'removed', asSupport })
  }

  // ── Write: replace the whole formal crew in one pass ─────────────────────
  // Suggestions go too. A drag is a formal decision by the scheduler, and
  // leaving a stale sales suggestion behind would resurface it on the form.
  await supabase.from('job_assignees').delete()
    .eq('job_id', jobId).throwOnError()

  if (after.size > 0) {
    const rows = [...after].map(([uid, asSupport]) => ({
      job_id: jobId, user_id: uid, is_suggestion: false, is_sub_installer: asSupport,
    }))
    // .select() so an RLS refusal is a real failure — an UPDATE or INSERT
    // filtered out by RLS is NOT an error: PostgREST answers with no rows and
    // .throwOnError() passes. This repo has shipped that bug four times.
    const { data: written, error } = await supabase
      .from('job_assignees').insert(rows as never).select('user_id')
    if (error || (written ?? []).length !== rows.length) {
      return NextResponse.json({ error: 'The crew could not be saved — you may not have permission.' }, { status: 403 })
    }
  }

  // ── Notify only when the job is TODAY ────────────────────────────────────
  const todayISO   = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' })
  const isToday    = job.date === todayISO
  let notifiedNow  = false

  if (isToday && changes.length > 0) {
    try {
      const notif = await getJobNotifData(jobId)
      if (notif) {
        const jobUrl  = `${APP_URL}/jobs/${jobId}`
        const addedIds = changes.filter(c => c.action === 'added').map(c => c.userId)
        if (addedIds.length > 0) {
          const { data: users } = await supabase
            .from('users').select('id, name, telegram_chat_id')
            .in('id', addedIds).is('deleted_at', null) as
            { data: Array<{ id: string; name: string; telegram_chat_id: string | null }> | null }
          await Promise.all((users ?? [])
            .filter(u => u.telegram_chat_id)
            .map(u => sendTelegram(u.telegram_chat_id!, tplJobAssigned({
              projectTitle: notif.project_title, jobClient: notif.client,
              pocName: notif.client_poc_name, pocPhone: notif.client_poc_phone,
              jobDate: notif.date, timeStart: notif.time_start, timeEnd: notif.time_end,
              location: notif.location, jobUrl,
            }))))
        }
        const { salesPoc } = await getJobRecipients(jobId)
        if (salesPoc?.telegram_chat_id) {
          const { data: names } = await supabase
            .from('users').select('name').in('id', driverIds) as { data: Array<{ name: string }> | null }
          await sendTelegram(salesPoc.telegram_chat_id, tplInstallerAssigned({
            projectTitle: notif.project_title, jobClient: notif.client, jobDate: notif.date,
            timeStart: notif.time_start, timeEnd: notif.time_end, location: notif.location,
            installerNames: (names ?? []).map(n => n.name), jobUrl,
            kind: driverIds.length === 0 ? 'removed' : before.size > 0 ? 'changed' : 'assigned',
          }))
        }
        notifiedNow = true
      }
    } catch (err) {
      // The crew change already succeeded — a failed send must not undo it.
      // Logged rather than swallowed: a silent notification failure is how
      // Design Load's B3 went unexplained for days.
      console.error('[jobs/crew] immediate notify failed', err)
    }
  }

  await recordCrewChange(jobId, changes, profile.id, notifiedNow)

  return NextResponse.json({ ok: true, notifiedNow })
}
```

- [ ] **Step 3: Verify it compiles and the gate answers**

Run: `npm run type-check` → clean.
Then with the dev server running (`npm run dev`), signed OUT:
`curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3000/api/jobs/00000000-0000-0000-0000-000000000000/crew -H 'Content-Type: application/json' -d '{"driver_ids":[],"support_ids":[]}'`
Expected: `401`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/jobs/\[id\]/crew src/lib/supabase/queries/notifications.ts
git commit -m "feat: one crew write path for board drags, quiet except for today

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: The drag hook

**Files:**
- Create: `src/features/schedule/useCardDrag.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `useCardDrag({ onDrop })` returning `{ draggingId, hoverBandId, startDrag, registerBand }`.

- [ ] **Step 1: Write it**

```ts
// src/features/schedule/useCardDrag.ts
'use client'

import { useCallback, useRef, useState } from 'react'

/**
 * Dragging a job card between bands, on mouse AND finger.
 *
 * Pointer events, no library — the stack is locked, and this is the pattern
 * already proven by the job task list's drag-reorder
 * (src/features/job-detail/TaskListSection.tsx). Hit-testing is done against
 * registered band elements rather than HTML5 drag-and-drop, which does not
 * work on touch at all.
 *
 * The card is only PICKED UP after a small movement threshold, so a tap that
 * opens the job is never mistaken for a drag — the card is wrapped in a Link.
 */
const DRAG_THRESHOLD_PX = 6

export function useCardDrag({ onDrop }: { onDrop: (jobId: string, bandId: string) => void }) {
  const [draggingId,  setDraggingId]  = useState<string | null>(null)
  const [hoverBandId, setHoverBandId] = useState<string | null>(null)

  const bands   = useRef(new Map<string, HTMLElement>())
  const pending = useRef<{ id: string; x: number; y: number } | null>(null)
  const active  = useRef<string | null>(null)

  const registerBand = useCallback((bandId: string, el: HTMLElement | null) => {
    if (el) bands.current.set(bandId, el)
    else    bands.current.delete(bandId)
  }, [])

  const bandUnder = useCallback((x: number, y: number): string | null => {
    for (const [id, el] of bands.current) {
      const r = el.getBoundingClientRect()
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return id
    }
    return null
  }, [])

  const startDrag = useCallback((jobId: string, e: React.PointerEvent) => {
    // Left button / touch only — a right-click must not start a drag.
    if (e.button !== 0) return
    pending.current = { id: jobId, x: e.clientX, y: e.clientY }

    const move = (ev: PointerEvent) => {
      const p = pending.current
      if (!p) return
      if (!active.current) {
        if (Math.hypot(ev.clientX - p.x, ev.clientY - p.y) < DRAG_THRESHOLD_PX) return
        active.current = p.id
        setDraggingId(p.id)
        // Stops the page scrolling under a finger mid-drag.
        document.body.style.touchAction = 'none'
        document.body.style.userSelect  = 'none'
      }
      setHoverBandId(bandUnder(ev.clientX, ev.clientY))
    }

    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup',   up)
      window.removeEventListener('pointercancel', up)
      document.body.style.touchAction = ''
      document.body.style.userSelect  = ''
      const dragged = active.current
      const target  = dragged ? bandUnder(ev.clientX, ev.clientY) : null
      pending.current = null
      active.current  = null
      setDraggingId(null)
      setHoverBandId(null)
      if (dragged && target) onDrop(dragged, target)
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup',   up)
    window.addEventListener('pointercancel', up)
  }, [bandUnder, onDrop])

  return { draggingId, hoverBandId, startDrag, registerBand }
}
```

- [ ] **Step 2: Verify**

Run: `npm run type-check` → clean.

- [ ] **Step 3: Commit**

```bash
git add src/features/schedule/useCardDrag.ts
git commit -m "feat: pointer-event card drag for the driver board

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: The crew-change confirmation modal

Every drag passes through this. Nothing is written until it is confirmed; cancel and the drag never happened.

**Files:**
- Create: `src/features/schedule/CrewChangeModal.tsx`

**Interfaces:**
- Consumes: `DragPlan`, `DriverRef` (Task 1); `POST /api/jobs/[id]/crew` (Task 4); the existing `assign-installers?checkOnly=true` clash report.
- Produces: `<CrewChangeModal plan job drivers supportPool onClose onSaved />`.

- [ ] **Step 1: Write it**

```tsx
// src/features/schedule/CrewChangeModal.tsx
'use client'

import { useEffect, useState } from 'react'
import { X, AlertTriangle } from 'lucide-react'
import { Btn } from '@/components/Btn'
import { cn } from '@/lib/utils/cn'
import { MIXED, UNASSIGNED, landingBand, driverBandId, externalBandId, type DragPlan, type DriverRef } from '@/lib/utils/driver-board'

interface Props {
  plan:        DragPlan
  job:         { id: string; title: string }
  drivers:     DriverRef[]
  supportPool: DriverRef[]
  /** Confirmed outside contractors already on the job. A drag never adds or
   *  removes these — they are here so the "lands in" line tells the truth. */
  externals:   DriverRef[]
  onClose:     () => void
  onSaved:     () => void
}

type ClashReport = {
  hasClash: boolean
  clashes:      Array<{ installerName: string; severity: 'hard' | 'soft'; conflict: { projectTitle: string | null; client: string } }>
  leaveClashes: Array<{ installerName: string; dates: string }>
}

/**
 * The prompt a drag must pass. Nic's rules, 2026-09-15:
 *   • it ALWAYS asks, even when there is no support crew to ask about —
 *     no silent drags
 *   • the clash check runs on CONFIRM, not on drop: dragging a card over a
 *     driver is not a decision yet and must not throw warnings mid-shuffle
 *   • cancel at any point and nothing was written, no message sent, card
 *     snaps back
 *
 * z-[60]: BottomNav is z-50 and nothing interactive may sit behind it
 * (CLAUDE.md hard rule).
 */
export function CrewChangeModal({ plan, job, drivers, supportPool, externals, onClose, onSaved }: Props) {
  const externalIds   = externals.map(e => e.id)
  const externalNames = externals.map(e => e.name)
  const [driverIds,  setDriverIds]  = useState<string[]>(plan.driverIds)
  const [supportIds, setSupportIds] = useState<string[]>(plan.supportIds)
  const [checking,   setChecking]   = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [report,     setReport]     = useState<ClashReport | null>(null)
  const [error,      setError]      = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const toggle = (list: string[], set: (v: string[]) => void, id: string) =>
    set(list.includes(id) ? list.filter(x => x !== id) : [...list, id])

  // Where the card will ACTUALLY land — a Mixed drop with one driver picked
  // drops into that driver's own container instead, so the band can never
  // hold a single-driver job (Nic's rule).
  // Where the card will ACTUALLY land, externals included. A job dragged to
  // Unassigned that still has an outside contractor on it does NOT become
  // unassigned — the crew route clears internal crew only, so it falls into
  // that external's container. The label has to say so, or the scheduler is
  // told something untrue about a drag they are about to confirm.
  const landing = landingBand(driverIds, externalIds)
  const landingLabel =
    landing === UNASSIGNED ? 'Unassigned'
    : landing === MIXED    ? 'Mixed Drivers'
    : externalBandId(externalIds[0] ?? '') === landing
      ? `${externalNames[0] ?? 'an external installer'} (external)`
      : drivers.find(d => driverBandId(d.id) === landing)?.name ?? 'a driver'

  async function confirm() {
    setError(null)

    // Clash + leave check first, unless the job is being emptied — nobody can
    // clash with nobody.
    if (!report && driverIds.length > 0) {
      setChecking(true)
      try {
        const res = await fetch(`/api/jobs/${job.id}/assign-installers?checkOnly=true`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ installer_ids: driverIds }),
        })
        if (res.ok) {
          const data = await res.json() as ClashReport
          if (data.hasClash) { setReport(data); setChecking(false); return }
        }
      } catch {
        // A failed check must not block the scheduler — they are told, and
        // the save is still theirs to make.
        setError('Could not check for clashes. You can still save.')
      }
      setChecking(false)
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/jobs/${job.id}/crew`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ driver_ids: driverIds, support_ids: supportIds }),
      })
      // Read the response. fetch does not reject on an HTTP error, and a
      // swallowed failure is indistinguishable from success — the exact trap
      // that lost Nic's attachment on 2026-09-15.
      const data = await res.json().catch(() => ({})) as { error?: string; notifiedNow?: boolean }
      if (!res.ok) { setError(data.error ?? 'The change could not be saved.'); setSaving(false); return }
      onSaved()
    } catch {
      setError('The change could not be saved. Check your connection and try again.')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/45 p-0 sm:p-6" onClick={onClose}>
      <div
        className="w-full sm:max-w-md max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-line bg-paper p-5 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold text-ink leading-tight">Move this job</h2>
            <p className="text-[13px] text-ink2 truncate">{job.title}</p>
          </div>
          <button onClick={onClose} className="shrink-0 p-1 text-muted hover:text-ink"><X size={18} /></button>
        </div>

        {plan.destructive && (
          <div className="rounded-xl border border-bad bg-bad-soft p-3">
            <p className="text-[13px] font-semibold text-bad">This takes everyone off the job.</p>
            <p className="text-[12px] text-ink2 mt-0.5">
              The driver and all support crew are removed. The job stays on the schedule with nobody on it.
            </p>
          </div>
        )}

        {plan.removedDriverIds.length > 0 && !plan.destructive && (
          <p className="text-[13px] text-ink2">
            Coming off:{' '}
            <span className="font-semibold text-ink">
              {plan.removedDriverIds.map(id => drivers.find(d => d.id === id)?.name ?? 'someone').join(', ')}
            </span>
          </p>
        )}

        {/* Said out loud, never silently. Coming out of Mixed clears the
            support crew as well (Nic, 2026-09-16) — a shared job's helpers
            belong to two different drivers' teams. Emptying a list the
            scheduler had filled without a word would read as a bug. */}
        {plan.removedSupportIds.length > 0 && !plan.destructive && (
          <div className="rounded-xl border border-brand-amber bg-brand-amber-soft p-3">
            <p className="text-[13px] font-semibold text-brand-amber">
              The support crew comes off too
            </p>
            <p className="text-[12px] text-ink2 mt-0.5">
              {plan.removedSupportIds.map(id => supportPool.find(p => p.id === id)?.name ?? 'someone').join(', ')}
              {' '}rode with the drivers this job is leaving. Pick who should support it now.
            </p>
          </div>
        )}

        {plan.askDrivers && (
          <div className="space-y-2">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">Drivers on this job</p>
            <div className="flex flex-wrap gap-2">
              {drivers.map(d => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => { toggle(driverIds, setDriverIds, d.id); setReport(null) }}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors',
                    driverIds.includes(d.id)
                      ? 'border-terracotta bg-terracotta text-white'
                      : 'border-line bg-bg text-ink2 hover:border-ink2',
                  )}
                >
                  {d.name}
                </button>
              ))}
            </div>
            <p className="text-[11.5px] text-muted">
              Pick one and it goes into that driver&apos;s own container instead.
            </p>
          </div>
        )}

        {plan.askSupport && (
          <div className="space-y-2">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">Support crew</p>
            {supportPool.length === 0 ? (
              <p className="text-[13px] italic text-muted">Nobody available.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {supportPool.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggle(supportIds, setSupportIds, p.id)}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors',
                      supportIds.includes(p.id)
                        ? 'border-brand-green bg-brand-green-soft text-brand-green'
                        : 'border-line bg-bg text-ink2 hover:border-ink2',
                    )}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
            <p className="text-[11.5px] text-muted">Tap to add or remove. They stay on the job unless you take them off.</p>
          </div>
        )}

        <p className="text-[13px] text-ink2">
          Lands in <span className="font-semibold text-ink">{landingLabel}</span>.
        </p>

        {report && (
          <div className="rounded-xl border border-bad bg-bad-soft p-3 space-y-1">
            <p className="flex items-center gap-1.5 text-[13px] font-semibold text-bad">
              <AlertTriangle size={14} /> Conflicts found
            </p>
            {report.clashes.map((c, i) => (
              <p key={`c${i}`} className="text-[12px] text-ink2">
                {c.installerName} is already on {c.conflict.projectTitle || c.conflict.client}
                {c.severity === 'hard' ? ' at the same time' : ' in an overlapping window'}.
              </p>
            ))}
            {report.leaveClashes.map((l, i) => (
              <p key={`l${i}`} className="text-[12px] text-ink2">{l.installerName} is on leave ({l.dates}).</p>
            ))}
            <p className="text-[12px] text-ink2 pt-1">Save anyway, or go back and pick someone else.</p>
          </div>
        )}

        {error && <p className="text-[13px] font-medium text-bad">{error}</p>}

        {/* Nobody is told about this now — the 6pm summary carries it. Said
            out loud so a scheduler never assumes a drag sent a message. */}
        <p className="text-[11.5px] text-muted">
          Nobody is messaged now — changes go out in the 6pm summary. Jobs dated today are sent straight away.
        </p>

        <div className="flex gap-3 pt-1">
          <Btn variant="secondary" onClick={onClose} className="flex-1">Cancel</Btn>
          <Btn onClick={confirm} disabled={checking || saving} className="flex-1">
            {checking ? 'Checking…' : saving ? 'Saving…' : report ? 'Save anyway' : 'Confirm'}
          </Btn>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Check the `Btn` API matches**

Run: `rg -n "interface BtnProps|variant" src/components/Btn.tsx | head -20`
If `ghost` is not a variant, use whichever secondary variant exists. Do not invent one.

- [ ] **Step 3: Verify**

Run: `npm run type-check` → clean.

- [ ] **Step 4: Commit**

```bash
git add src/features/schedule/CrewChangeModal.tsx
git commit -m "feat: confirm prompt for every board drag

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: The board itself, wired into the schedule

**Files:**
- Create: `src/features/schedule/DriverBoard.tsx`
- Modify: `src/features/schedule/JobRow.tsx`, `src/features/schedule/ScheduleShell.tsx`, `src/app/schedule/page.tsx`, `src/lib/supabase/queries/jobs.ts`, `src/lib/i18n/en.ts`, `src/lib/i18n/zh.ts`

**Interfaces:**
- Consumes: `buildBands`, `planDrag` (Task 1); `useCardDrag` (Task 5); `CrewChangeModal` (Task 6).
- Produces: `<DriverBoard jobs drivers supportPool canDrag onChanged />`; `getDrivers()` and `getSupportPool()` in `queries/jobs.ts`; `JobRow`'s new optional `onDragHandle?: (e: React.PointerEvent) => void`.

- [ ] **Step 1: Add the queries**

```ts
// append to src/lib/supabase/queries/jobs.ts

export type CrewMember = { id: string; name: string }

/**
 * The drivers, in name order. `is_driver` is a fact about the PERSON (set in
 * Admin → Users), unlike `is_sub_installer`, which is a fact about the job.
 * Exactly three people carry it today — Rintu, Xiao Yi and CK — but the board
 * reads the flag rather than hard-coding them, so a fourth driver appears on
 * the board the moment the tick is made.
 */
export async function getDrivers(): Promise<CrewMember[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('users').select('id, name')
    .eq('is_driver', true).is('deleted_at', null)
    .order('name') as { data: CrewMember[] | null }
  return data ?? []
}

/**
 * Who can ride along as support crew. The Support crew bucket was widened to
 * ALL roles on 2026-09-04 so anyone can be dispatched for a night job or a
 * manpower shortage — so this is everyone active, minus nobody by role.
 */
export async function getSupportPool(): Promise<CrewMember[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('users').select('id, name')
    .is('deleted_at', null)
    .order('name') as { data: CrewMember[] | null }
  return data ?? []
}
```

`job_assignees ( is_suggestion, is_sub_installer, users ( id, name ) )` stays as it is — the board reads `is_driver` from `getDrivers()`, not from the embed. Add to `SCHEDULE_SELECT`:

```
  lat, lng,
  job_external_contacts ( is_suggestion, external_contacts ( id, name ) )
```

and to `ScheduleJob`:

```ts
  lat?: number | null
  lng?: number | null
  // Outside contractors. The card and the board were BLIND to these until
  // 2026-09-16 — this query never loaded them, so a job with only an external
  // installer on it rendered "Driver: nobody yet" and sat in Unassigned
  // looking unstaffed. Optional because the installer views feed rows through
  // a different query.
  job_external_contacts?: Array<{ is_suggestion: boolean; external_contacts: { id: string; name: string } | null }>
```

Embedding `external_contacts` from `job_external_contacts` is safe: there is exactly ONE foreign key between them (`contact_id`), unlike the `jobs → users` case the standing rule forbids. **Note for the reviewer:** `hr` has no SELECT policy on `job_external_contacts` (0039/0040 cover scheduler/coordinator/admin and sales/designer/production). PostgREST returns `[]` for an unreadable embed rather than erroring, so HR simply sees no external containers. Acceptable — HR's schedule is view-only and externals are not her concern.

- [ ] **Step 2: Add the drag handle to JobRow**

Add to `JobRowProps`:

```ts
  /** Scheduler/admin on the driver board only. Absent everywhere else, so
   *  the pending and completed lists are untouched. */
  onDragHandle?: (e: React.PointerEvent) => void
  dragging?:     boolean
```

Inside the outer `<div className="flex items-start gap-2 mb-2">`, before the `<Link>`:

```tsx
{onDragHandle && (
  <button
    type="button"
    aria-label="Drag to another driver"
    onPointerDown={onDragHandle}
    className="mt-6 shrink-0 cursor-grab touch-none rounded p-1 text-muted hover:text-ink active:cursor-grabbing"
  >
    <GripVertical size={16} />
  </button>
)}
```

Import `GripVertical` from `lucide-react`. Apply `dragging && 'opacity-50'` to the card's `cn(...)` so the card being carried is visibly lifted.

**Also add the External line to the card.** In the team-card branch, directly under the existing `<CrewLine label="Support Crew:" names={support} />`:

```tsx
{externalNames.length > 0 && (
  <CrewLine label="External:" names={externalNames} />
)}
```

with, beside the existing `splitCrew` call:

```ts
// Outside contractors, confirmed only — a suggested external is invisible on
// their own link page (migration 0040) and must not look staffed here. Until
// 2026-09-16 the card could not show these at all: the schedule query never
// loaded them, so a job crewed entirely by an outside contractor read
// "Driver: nobody yet".
const externalNames = (job.job_external_contacts ?? [])
  .filter(e => !e.is_suggestion)
  .map(e => e.external_contacts?.name)
  .filter((n): n is string => !!n)
```

The line is rendered only when there is someone on it — unlike Support Crew, which shows "none", because most jobs never involve an outside contractor and an empty row on every card is noise.

- [ ] **Step 3: Write the board**

```tsx
// src/features/schedule/DriverBoard.tsx
'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Link2 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { JobRow } from './JobRow'
import { useCardDrag } from './useCardDrag'
import { CrewChangeModal } from './CrewChangeModal'
import { buildBands, planDrag, externalCrew, mainCrew, isMirrorCard, countRealJobs, type DragPlan, type DriverRef } from '@/lib/utils/driver-board'
import type { ScheduleJob } from '@/lib/supabase/queries/jobs'

interface Props {
  jobs:        ScheduleJob[]
  drivers:     DriverRef[]
  supportPool: DriverRef[]
  /** Scheduler and admin only — everyone else reads the board (Nic, 2026-09-15). */
  canDrag:     boolean
  currentDate: string
}

/**
 * Three FIXED bands, top to bottom: Mixed Drivers, every driver, Unassigned.
 *
 * A band is always in the same place — that is the point. One flowing grid
 * reshuffles as the day fills, so the scheduler would have to hunt. More
 * drivers push Unassigned DOWN, never aside (Nic's words, 2026-09-15).
 *
 * Mixed Drivers holds 2+ driver jobs ONLY, and is what makes the board
 * honest: a shared job appears exactly once, with every driver named on it,
 * instead of being filed under one driver (leaving the other's day
 * incomplete) or duplicated into both.
 *
 * Column count follows the screen, set by the width at which a card stops
 * being readable rather than by what fits: below ~700px per card the crew
 * column crowds the address, which is the very thing the card redesign
 * exists to expose.
 */
export function DriverBoard({ jobs, drivers, supportPool, canDrag, currentDate }: Props) {
  const router = useRouter()
  const [plan,    setPlan]    = useState<{ plan: DragPlan; job: ScheduleJob } | null>(null)

  const bands = useMemo(() => buildBands(jobs, drivers), [jobs, drivers])

  const { draggingId, hoverBandId, startDrag, registerBand } = useCardDrag({
    onDrop: (jobId, bandId) => {
      const job = jobs.find(j => j.id === jobId)
      if (!job) return
      const p = planDrag(job, bandId, drivers)
      if (!p) return              // dropped on its own band — a no-op, not a prompt
      setPlan({ plan: p, job })
    },
  })

  return (
    <div className="space-y-3">
      {/* The honest number. A shared job renders twice, so adding up the band
          counts would tell the scheduler there is more work than there is. */}
      <p className="text-[11px] text-muted">
        {countRealJobs(bands)} job{countRealJobs(bands) === 1 ? '' : 's'} today
      </p>

      {bands.map(band => {
        const isDriverBand = band.kind === 'driver'
        // External containers are display-only (Nic, 2026-09-16): assigning an
        // outside contractor stays on the job form. NOT registering them means
        // hit-testing can never return one, so a card dropped over an external
        // simply snaps back — no prompt, nothing written.
        const droppable = band.kind !== 'external'
        return (
          <section
            key={band.id}
            ref={el => { if (droppable) registerBand(band.id, el) }}
            className={cn(
              'rounded-card border p-3 transition-colors',
              hoverBandId === band.id && draggingId ? 'border-terracotta bg-terracotta-soft' : 'border-line bg-bg',
              band.kind === 'unassigned' && 'border-dashed',
              band.kind === 'external'   && 'border-dashed border-brand-blue',
            )}
          >
            <div className="flex items-baseline justify-between gap-2 mb-2">
              <h2 className="font-display text-[15px] font-semibold text-ink">
                {band.kind === 'mixed'      ? 'Mixed Drivers'
                 : band.kind === 'unassigned' ? 'Unassigned'
                 : band.driver!.name}
              </h2>
              {band.kind === 'external' && (
                <span className="rounded-full border border-brand-blue bg-brand-blue-soft px-2 py-[1px] text-[10px] font-semibold text-brand-blue">
                  External
                </span>
              )}
              <span className="text-[11px] text-muted">
                {band.jobs.length === 0 ? 'nothing today' : `${band.jobs.length} job${band.jobs.length === 1 ? '' : 's'}`}
              </span>
            </div>

            {/* The driver band is the only one that goes multi-column: they
                are PEOPLE, not an ordered sequence, so they run left to right
                and wrap. Mixed and Unassigned stay full width. */}
            <div className={cn(isDriverBand ? '' : 'xl:columns-1')}>
              {band.jobs.map(job => {
                // A mirror is a read-only view of a job that lives in a
                // driver's container. It gets no drag handle: the drag acts
                // on the JOB, so two draggable cards for one job is how a
                // board starts contradicting itself.
                const mirror = isMirrorCard(job, band.id)
                return (
                  <div key={`${band.id}:${job.id}`}>
                    {mirror && (
                      <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
                        <Link2 size={11} />
                        Same job — also with {mainCrew(job).map(d => d.name).join(', ')}
                      </p>
                    )}
                    <JobRow
                      job={job}
                      currentDate={currentDate}
                      dragging={draggingId === job.id}
                      onDragHandle={canDrag && !mirror ? e => startDrag(job.id, e) : undefined}
                    />
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}

      {plan && (
        <CrewChangeModal
          plan={plan.plan}
          job={{ id: plan.job.id, title: plan.job.project_title || plan.job.client || 'Untitled job' }}
          drivers={drivers}
          supportPool={supportPool}
          externals={externalCrew(plan.job)}
          onClose={() => setPlan(null)}
          onSaved={() => { setPlan(null); router.refresh() }}
        />
      )}
    </div>
  )
}
```

The driver bands sit side by side via a wrapper in the band list — wrap the `drivers` bands in one grid rather than each being its own row. Replace the `bands.map` above with, in this exact order: the **Mixed** band full width, then a `<div>` holding every `kind === 'driver'` band as a grid, then every `kind === 'external'` band full width, then **Unassigned** full width. External containers stay full width rather than joining the driver grid — they are occasional, they come and go with the day's work, and slotting them into the grid would shift the drivers' fixed positions, which is the one thing the band layout exists to prevent.

The driver grid uses

```tsx
style={{
  display: 'grid',
  gridTemplateColumns: `repeat(${driverCols}, minmax(0, 1fr))`,
  gap: '0.75rem',
}}
```

where `driverCols` is read after mount exactly as `ListView` does it (starting at 1 so the first render matches the server's — `/schedule` is hydration-sensitive, bug #418):

```ts
const [driverCols, setDriverCols] = useState(1)
useEffect(() => {
  const read = () => setDriverCols(
    window.matchMedia('(min-width: 2200px)').matches ? 3
      : window.matchMedia('(min-width: 1600px)').matches ? 2
      : 1,
  )
  read()
  window.addEventListener('resize', read)
  return () => window.removeEventListener('resize', read)
}, [])
```

Then the Unassigned band last.

- [ ] **Step 4: Add the view to ScheduleShell**

- Extend `type ViewMode = 'list' | 'board' | 'week' | 'month'`.
- Add `{ v: 'board', Icon: Truck, label: tr(lang, 'viewBoard') }` to `views`, **only when `pageMode === 'schedule'`** — pending jobs have no drivers and completed jobs must not be dragged.
- Add props `drivers: CrewMember[]` and `supportPool: CrewMember[]`, both defaulting to `[]`.
- Remember the choice per device beside `LIST_COLUMNS_KEY`, read after mount:

```ts
const VIEW_MODE_KEY = 'gq-schedule-view-mode'
useEffect(() => {
  const saved = localStorage.getItem(VIEW_MODE_KEY)
  if (saved === 'board' || saved === 'list' || saved === 'week' || saved === 'month') setViewMode(saved)
  else if (pageMode === 'schedule' && (role === 'scheduler' || navRole === 'admin')) setViewMode('board')
}, [pageMode, role, navRole])
```

The scheduler and admin land on the board by default; everyone else keeps the list they have now, and either can switch. Persist on every change.

- Render it beside the existing views, keeping the `DateStrip` above:

```tsx
{viewMode === 'board' && (
  <>
    <DateStrip
      jobsByDate={jobsByDate} selectedDate={selectedDate} today={today} lang={lang}
      leaveNamesByDate={leaveNamesByDate} holidayByDate={holidayByDate} onSelectDate={setSelectedDate}
    />
    <div className="px-4 pb-8 lg:pb-24">
      <DayNotices
        leaveNames={[...new Set(leaveNamesByDate[selectedDate] ?? [])]}
        holiday={holidayByDate[selectedDate]}
        events={eventsByDate[selectedDate] ?? []}
        onLeaveLabel={listStrings.onLeave}
        holidayLabel={listStrings.publicHoliday}
        eventLabel={listStrings.companyEvent}
      />
      <DriverBoard
        jobs={jobsByDate[selectedDate] ?? []}
        drivers={drivers}
        supportPool={supportPool}
        canDrag={role === 'scheduler' || navRole === 'admin'}
        currentDate={selectedDate}
      />
    </div>
  </>
)}
```

- [ ] **Step 5: Feed it from the page**

In `src/app/schedule/page.tsx`, add `getDrivers()` and `getSupportPool()` to the existing `Promise.all` and pass both to `ScheduleShell`.

- [ ] **Step 6: Add the strings**

`src/lib/i18n/en.ts`: `viewBoard: 'Drivers',`
`src/lib/i18n/zh.ts`: `viewBoard: '司机',`

- [ ] **Step 7: Verify**

Run: `npm run type-check` → clean. `npm run build` → clean.
Then run the whole suite — every file in the list below must exit 0:

```bash
for f in $(find src -name "*.test.ts"); do npx tsx "$f" > /dev/null || echo "FAILED: $f"; done; echo done
```

- [ ] **Step 8: Commit**

```bash
git add src/features/schedule src/app/schedule/page.tsx src/lib/supabase/queries/jobs.ts src/lib/i18n
git commit -m "feat: driver containers on the schedule, with drag-to-reassign

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: The summary bot

**Files:**
- Modify: `src/lib/telegram/bot.ts`, `src/app/api/admin/health/route.ts`, `.env.local`

**Interfaces:**
- Consumes: nothing.
- Produces: `sendSummaryTelegram(chatId, text): Promise<boolean>`.

- [ ] **Step 1: Add the sender**

```ts
// append to src/lib/telegram/bot.ts

// ── Summary bot ──────────────────────────────────────────────────────────────
// Third bot, reading TELEGRAM_SUMMARY_BOT_TOKEN. Carries both 6pm summaries.
//
// Nic's call, 2026-09-16, made with the cost stated: a separate bot keeps the
// daily digest out of the job-notification thread, at the price of every
// recipient having to message it once — Telegram blocks a bot from messaging
// anyone who has not started it. That is exactly what bit the digest bot in
// August 2026, so a failed send is REPORTED rather than swallowed: the return
// value tells the cron who never received theirs.
export async function sendSummaryTelegram(chatId: string, text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_SUMMARY_BOT_TOKEN
  if (!token || !chatId?.trim()) {
    console.warn('[telegram-summary] TELEGRAM_SUMMARY_BOT_TOKEN or chat id missing — skipping')
    return false
  }

  const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
  })
  if (!res.ok) {
    // 403 "bot was blocked" / "can't initiate conversation" = they never
    // pressed START. Say which, so it is chased rather than guessed at.
    console.error('[telegram-summary] sendMessage failed', chatId, res.status, await res.text())
    return false
  }
  void logApiUsage({ service: 'telegram', endpoint: 'summary', called_by: null, estimated_cost: 0 })
  return true
}
```

Check `logApiUsage`'s signature first (`rg -n "export async function logApiUsage" -A 10 src/lib/supabase/queries/admin.ts`) and match it; if `called_by` is not nullable, omit the call rather than inventing a shape.

- [ ] **Step 2: Add the health row**

In `src/app/api/admin/health/route.ts`, beside the existing digest-bot check:

```ts
checkTelegramBot('Telegram summary bot', 'TELEGRAM_SUMMARY_BOT_TOKEN'),
```

- [ ] **Step 3: Verify**

Run: `npm run type-check` → clean.

- [ ] **Step 4: Commit**

```bash
git add src/lib/telegram/bot.ts src/app/api/admin/health/route.ts
git commit -m "feat: summary Telegram bot plumbing and health check

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: The two summary messages

Pure text builders, tested standalone, so the wording can be checked without sending anything.

**Files:**
- Create: `src/lib/telegram/day-summary.ts`
- Test: `src/lib/telegram/day-summary.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `tgEscape(s)`, `buildSchedulerSummary(p)`, `buildInstallerSummary(p)`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/telegram/day-summary.test.ts
/**
 * Standalone test for the 6pm summary messages (no test framework).
 * Run: npx tsx src/lib/telegram/day-summary.test.ts
 * Exits 1 on any failure.
 */

import { tgEscape, buildSchedulerSummary, buildInstallerSummary } from './day-summary'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`); failures++ }
}
function contains(name: string, haystack: string, needle: string) {
  if (haystack.includes(needle)) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      missing: ${needle}\n      in: ${haystack}`); failures++ }
}
function absent(name: string, haystack: string, needle: string) {
  if (!haystack.includes(needle)) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      should not contain: ${needle}`); failures++ }
}

console.log('tgEscape:')

// Messages go out as HTML. A job title is user text, so an unescaped angle
// bracket can inject formatting or a fake link into a Telegram message —
// the hardening item on the checklist since the 2026-08-13 audit.
check('angle brackets and ampersands are neutralised',
  tgEscape('A & B <b>bold</b>'),
  'A &amp; B &lt;b&gt;bold&lt;/b&gt;')
check('plain text is untouched', tgEscape('Tampines Optical'), 'Tampines Optical')

console.log('buildSchedulerSummary:')

const sched = buildSchedulerSummary({
  dateLabel: '16/09/2026 (Wed)',
  appUrl:    'https://x.test',
  roster: [
    { name: 'Nicholas', jobs: [
      { id: 'j1', title: 'Tampines Optical',       driverNames: ['CK'] },
      { id: 'j2', title: 'Arnotts <script>',       driverNames: [] },
    ] },
    { name: 'Daniel',  jobs: [{ id: 'j3', title: 'Fossil Bugis', driverNames: ['Rintu', 'Xiao Yi'] }] },
    { name: 'Charles', jobs: [] },
  ],
})

contains('header carries the date',        sched, 'End of Day Summary')
contains('header is bold + underlined',    sched, '<b><u>End of Day Summary (16/09/2026 (Wed))</u></b>')
contains('each person is bold',            sched, '<b>Nicholas</b>')
contains('someone with jobs says JOBS ADDED', sched, '<u>JOBS ADDED</u>')
contains('a job shows its driver',         sched, 'Tampines Optical (CK)')
contains('two drivers are both named',     sched, 'Fossil Bugis (Rintu, Xiao Yi)')
contains('no driver reads Unassigned, bold', sched, '<b>Unassigned</b>')
contains('every job carries a link',       sched, 'https://x.test/jobs/j1')
// Charles added nothing and must still appear — the sketch shows an unchanging
// roster, not just whoever was busy.
contains('an idle person is still listed', sched, 'NO JOBS ADDED')
contains('and it is Charles',              sched, '<b>Charles</b>')
contains('it ends',                        sched, 'END OF SUMMARY')
absent('a job title cannot inject HTML',   sched, '<script>')
contains('the title is escaped instead',   sched, 'Arnotts &lt;script&gt;')

console.log('buildInstallerSummary:')

const inst = buildInstallerSummary({
  dateLabel: '16/09/2026 (Wed)',
  name:      'CK',
  appUrl:    'https://x.test',
  added:   [{ id: 'j1', title: 'Tampines Optical', dateLabel: '17/09/2026 (Thu)', role: 'driver'  }],
  removed: [{ id: 'j9', title: 'Fossil Bugis',     dateLabel: '18/09/2026 (Fri)', role: 'support' }],
})

contains('greets the person',        inst, 'CK')
contains('says what was added',      inst, '<u>ADDED TO YOUR JOBS</u>')
contains('names the job and day',    inst, 'Tampines Optical')
contains('says which day it is on',  inst, '17/09/2026 (Thu)')
contains('says what came off',       inst, '<u>TAKEN OFF</u>')
contains('names that job too',       inst, 'Fossil Bugis')
contains('marks a support role',     inst, 'support crew')
contains('links through',            inst, 'https://x.test/jobs/j1')

// Somebody with only removals must not be sent an empty "added" heading.
const removalsOnly = buildInstallerSummary({
  dateLabel: '16/09/2026 (Wed)', name: 'Rintu', appUrl: 'https://x.test',
  added: [], removed: [{ id: 'j2', title: 'Bugis', dateLabel: '17/09/2026 (Thu)', role: 'driver' }],
})
absent('no empty ADDED heading', removalsOnly, 'ADDED TO YOUR JOBS')
contains('the removal still shows', removalsOnly, '<u>TAKEN OFF</u>')

console.log(failures === 0 ? '\nAll day-summary checks passed.' : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)
```

Add these checks at the top of the same file, before `tgEscape`:

```ts
import { formatDayDate } from './day-summary'

console.log('formatDayDate:')

// Static English tables, no toLocaleDateString: date labels are ALWAYS
// English in every language (CLAUDE.md hard rule), and a locale call here is
// what caused hydration error #418 on /schedule.
check('day name and DD/MM/YYYY', formatDayDate('2026-09-16'), '16/09/2026 (Wed)')
check('pads single digits',      formatDayDate('2026-01-05'), '05/01/2026 (Mon)')
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tsx src/lib/telegram/day-summary.test.ts`
Expected: FAIL — `Cannot find module './day-summary'`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/telegram/day-summary.ts
/**
 * The two 6pm Telegram summaries.
 *
 * Pure string building so the wording can be checked without sending
 * anything. Nic's sketch, 2026-09-14, answered 2026-09-15: TWO messages, not
 * one, because the audiences want different things — the scheduler wants the
 * whole day, an installer wants only their own.
 *
 * Both are sent as HTML, so every piece of user text goes through tgEscape.
 * A crafted job title could otherwise inject formatting or a fake link into
 * a Telegram message (audit hardening item, 2026-08-13).
 */

/** HTML-escape user text destined for a parse_mode:'HTML' message. */
export function tgEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/**
 * `17/09/2026 (Thu)` — the same shape the overdue bell cards use.
 *
 * Static English tables and a UTC-anchored Date, deliberately: date labels
 * are ALWAYS English in every language (CLAUDE.md hard rule), and a
 * toLocaleDateString call is what produced hydration error #418 on
 * /schedule. `templates.formatDate` gives "17 Sep 2026" with no day name —
 * useful in a one-line notification, not enough in a list someone scans.
 */
export function formatDayDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const day = DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y} (${day})`
}

const LINE = '────────────'

export function buildSchedulerSummary(p: {
  dateLabel: string
  appUrl:    string
  roster: Array<{
    name: string
    jobs: Array<{ id: string; title: string; driverNames: string[] }>
  }>
}): string {
  const parts = [`<b><u>End of Day Summary (${tgEscape(p.dateLabel)})</u></b>`, '']

  for (const person of p.roster) {
    parts.push(`<b>${tgEscape(person.name)}</b>`)
    if (person.jobs.length === 0) {
      parts.push('<u>NO JOBS ADDED</u>')
    } else {
      parts.push('<u>JOBS ADDED</u>')
      person.jobs.forEach((job, i) => {
        const who = job.driverNames.length > 0
          ? tgEscape(job.driverNames.join(', '))
          : '<b>Unassigned</b>'
        parts.push(`${i + 1}. ${tgEscape(job.title)} (${who})`)
        parts.push(`   <a href="${p.appUrl}/jobs/${job.id}">Open</a>`)
      })
    }
    parts.push(LINE)
  }

  parts.push('END OF SUMMARY')
  return parts.join('\n')
}

export function buildInstallerSummary(p: {
  dateLabel: string
  name:      string
  appUrl:    string
  added:   Array<{ id: string; title: string; dateLabel: string; role: 'driver' | 'support' }>
  removed: Array<{ id: string; title: string; dateLabel: string; role: 'driver' | 'support' }>
}): string {
  const parts = [`<b><u>Your jobs — ${tgEscape(p.dateLabel)}</u></b>`, '', `<b>${tgEscape(p.name)}</b>`]

  const block = (heading: string, rows: typeof p.added) => {
    if (rows.length === 0) return
    parts.push(`<u>${heading}</u>`)
    rows.forEach((r, i) => {
      const as = r.role === 'support' ? ' — support crew' : ''
      parts.push(`${i + 1}. ${tgEscape(r.title)} — ${tgEscape(r.dateLabel)}${as}`)
      parts.push(`   <a href="${p.appUrl}/jobs/${r.id}">Open</a>`)
    })
    parts.push(LINE)
  }

  // A heading with nothing under it reads as an error. Only the sections
  // that have something appear.
  block('ADDED TO YOUR JOBS', p.added)
  block('TAKEN OFF',          p.removed)

  parts.push('END OF SUMMARY')
  return parts.join('\n')
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx tsx src/lib/telegram/day-summary.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/telegram/day-summary.ts src/lib/telegram/day-summary.test.ts
git commit -m "feat: the two 6pm summary messages

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: The 6pm cron

**Files:**
- Create: `src/app/api/cron/day-summary/route.ts`
- Modify: `vercel.json`

**Interfaces:**
- Consumes: `buildSchedulerSummary`, `buildInstallerSummary` (Task 9); `sendSummaryTelegram` (Task 8); the `crew_change` event rows (Task 4).
- Produces: `GET /api/cron/day-summary`, answering `{ ok, schedulerSent, installerSent, skipped }`.

- [ ] **Step 1: Write the route**

```ts
// src/app/api/cron/day-summary/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendSummaryTelegram } from '@/lib/telegram/bot'
import { buildSchedulerSummary, buildInstallerSummary, formatDayDate } from '@/lib/telegram/day-summary'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://greenqubes-ops.vercel.app'

/**
 * The 6pm summaries. Vercel cron "0 10 * * *" — Vercel schedules in UTC, and
 * 10:00 UTC is 18:00 SGT.
 *
 * TWO messages (Nic, 2026-09-15):
 *   • Scheduler summary — every job CREATED today, grouped by who created it,
 *     each showing the driver it landed on. Everyone who can create a job is
 *     listed, busy or not: the sketch shows an unchanging roster.
 *   • Installer summary — per person, what a board drag put on them and what
 *     it took off. Only people with an actual change are messaged; sending
 *     "nothing happened" to seven installers every evening is noise.
 *
 * Changes already sent immediately (jobs dated today) carry notified_now on
 * their event row and are skipped here, so nobody hears the same
 * reassignment twice.
 *
 * Fail-closed auth: an unset CRON_SECRET must 401, never run open
 * (2026-08-13 hardening rule).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth   = req.headers.get('authorization')
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createServiceClient()

  // SGT day boundaries. This machine's clock is NOT Singapore time and TZ= is
  // ignored here, so the date is derived through Intl rather than read off
  // the shell (2026-09-10).
  const todayISO = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' })
  const dayStart = new Date(`${todayISO}T00:00:00+08:00`).toISOString()
  const dateLbl  = formatDayDate(todayISO)

  // ── A. Scheduler summary ────────────────────────────────────────────────
  type Creator = { id: string; name: string; role: string; telegram_chat_id: string | null }
  const { data: people } = await db
    .from('users').select('id, name, role, telegram_chat_id')
    .is('deleted_at', null).order('name') as { data: Creator[] | null }
  const staff = people ?? []

  // Who appears in the message: everyone who can create a job.
  const CAN_CREATE = ['sales', 'coordinator', 'scheduler', 'admin']
  const roster     = staff.filter(u => CAN_CREATE.includes(u.role))

  type NewJob = {
    id: string; project_title: string | null; client: string; created_by: string | null
    job_assignees: Array<{ user_id: string; is_suggestion: boolean; is_sub_installer: boolean }>
  }
  const { data: newJobs } = await db
    .from('jobs')
    .select('id, project_title, client, created_by, job_assignees(user_id, is_suggestion, is_sub_installer)')
    .gte('created_at', dayStart) as { data: NewJob[] | null }

  const nameById = new Map(staff.map(u => [u.id, u.name]))

  const schedulerText = buildSchedulerSummary({
    dateLabel: dateLbl,
    appUrl:    APP_URL,
    roster: roster.map(person => ({
      name: person.name,
      jobs: (newJobs ?? [])
        .filter(j => j.created_by === person.id)
        .map(j => ({
          id:    j.id,
          title: j.project_title || j.client || 'Untitled job',
          driverNames: j.job_assignees
            .filter(a => !a.is_suggestion && !a.is_sub_installer)
            .map(a => nameById.get(a.user_id) ?? 'Unknown')
            .filter(Boolean),
        })),
    })),
  })

  // Recipients: the schedulers and admins — this is the whole-day overview.
  let schedulerSent = 0
  for (const u of staff.filter(x => x.role === 'scheduler' || x.role === 'admin')) {
    if (!u.telegram_chat_id) continue
    if (await sendSummaryTelegram(u.telegram_chat_id, schedulerText)) schedulerSent++
  }

  // ── B. Installer summaries ──────────────────────────────────────────────
  type ChangeRow = {
    target_id: string
    payload: { user_id: string; action: 'added' | 'removed'; as_support: boolean; notified_now: boolean } | null
  }
  const { data: changes } = await db
    .from('events')
    .select('target_id, payload')
    .eq('kind', 'crew_change')
    .gte('ts', dayStart) as { data: ChangeRow[] | null }

  const pending = (changes ?? []).filter(c => c.payload && !c.payload.notified_now)

  const jobIds = [...new Set(pending.map(c => c.target_id))]
  type JobLite = { id: string; project_title: string | null; client: string; date: string }
  const { data: jobRows } = jobIds.length === 0
    ? { data: [] as JobLite[] }
    : await db.from('jobs').select('id, project_title, client, date').in('id', jobIds) as
      { data: JobLite[] | null }
  const jobById = new Map((jobRows ?? []).map(j => [j.id, j]))

  type Entry = { id: string; title: string; dateLabel: string; role: 'driver' | 'support' }
  const byPerson = new Map<string, { added: Entry[]; removed: Entry[] }>()

  for (const c of pending) {
    const job = jobById.get(c.target_id)
    if (!job || !c.payload) continue
    const bucket = byPerson.get(c.payload.user_id) ?? { added: [], removed: [] }
    const entry: Entry = {
      id:        job.id,
      title:     job.project_title || job.client || 'Untitled job',
      dateLabel: formatDayDate(job.date),
      role:      c.payload.as_support ? 'support' : 'driver',
    }
    // The last word wins: dragged on then off again in the same evening is
    // no change at all, and must not send two contradicting lines.
    const other = c.payload.action === 'added' ? bucket.removed : bucket.added
    const undo  = other.findIndex(e => e.id === entry.id)
    if (undo >= 0) other.splice(undo, 1)
    else (c.payload.action === 'added' ? bucket.added : bucket.removed).push(entry)
    byPerson.set(c.payload.user_id, bucket)
  }

  let installerSent = 0
  for (const [userId, bucket] of byPerson) {
    if (bucket.added.length === 0 && bucket.removed.length === 0) continue
    const person = staff.find(u => u.id === userId)
    if (!person?.telegram_chat_id) continue
    const text = buildInstallerSummary({
      dateLabel: dateLbl, name: person.name, appUrl: APP_URL,
      added: bucket.added, removed: bucket.removed,
    })
    if (await sendSummaryTelegram(person.telegram_chat_id, text)) installerSent++
  }

  // Breadcrumb for Admin → Health, same as the other crons.
  await db.from('events').insert({
    actor_id: null, kind: 'day_summary_cron', target_id: null, target_table: null,
    payload: { schedulerSent, installerSent, changes: pending.length },
    visibility: ['role:scheduler'],
  } as never)

  return NextResponse.json({ ok: true, schedulerSent, installerSent, skipped: (changes ?? []).length - pending.length })
}
```

- [ ] **Step 2: Add the cron**

In `vercel.json`, inside `crons`:

```json
{
  "path": "/api/cron/day-summary",
  "schedule": "0 10 * * *"
}
```

Leave `"regions": ["sin1"]` exactly where it is — it must survive every edit to this file.

- [ ] **Step 3: Verify**

Run: `npm run type-check` → clean. `npm run build` → clean.
Then, with the dev server running, check the gate is fail-closed:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/api/cron/day-summary
```
Expected: `401`.

And with the secret, a real dry run against the shared DB (it will send nothing while `TELEGRAM_SUMMARY_BOT_TOKEN` is unset — `sendSummaryTelegram` returns false and warns):

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/day-summary
```
Expected: `{"ok":true,"schedulerSent":0,"installerSent":0,"skipped":0}`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/cron/day-summary vercel.json
git commit -m "feat: 6pm scheduler and installer summaries

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Remove accept/decline from the external installer page

Nic, 2026-09-16: *"external installer don't have the option to accept or decline because we will inform beforehand through message and call to set agreement for the job, in which they have no rights to reject once agreed unless informed otherwise again."*

**The trap, found before writing any code:** Accept is not just a button. `if (link !== 'accepted')` gates BOTH `/api/ext/[token]/job/[jobId]` (the job detail) and `/api/ext/[token]/tasks` (ticking the task list). Delete the buttons alone and **every external installer is locked out of every job with a 403, permanently.** The gate has to change in the same commit: being formally on the job IS the agreement.

**Files:**
- Delete: `src/app/api/ext/[token]/respond/route.ts`
- Modify: `src/app/api/ext/[token]/job/[jobId]/route.ts:21`, `src/app/api/ext/[token]/tasks/route.ts:31`, `src/lib/supabase/queries/external.ts:96-115`, `src/features/external/ExternalHomePage.tsx`, `src/features/job-detail/ExternalPOCBucket.tsx`, `src/lib/i18n/en.ts`, `src/lib/i18n/zh.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `isContactOnJob(contactId, jobId)` returns `boolean` — whether a CONFIRMED link exists — instead of the old status string.

- [ ] **Step 1: Change the gate first, before removing anything**

In `src/lib/supabase/queries/external.ts`, replace `getContactJobLink`:

```ts
/**
 * Is this contact formally on this job?
 *
 * Was: the link's accept/decline status, used to gate the detail page and the
 * task list until the person pressed Accept. Accept/decline was removed on
 * 2026-09-16 (Nic): agreement is reached by message and call before anyone is
 * put on a job, so being on it IS the agreement and there is nothing to
 * accept. `is_suggestion` still gates: a tentative sales pick is invisible
 * here until a scheduler or coordinator confirms it (migration 0040).
 *
 * This function must change in the SAME commit as the buttons. Leaving the
 * old `!== 'accepted'` check in place while removing the only way to reach
 * 'accepted' would lock every external out of every job with a 403.
 */
export async function isContactOnJob(contactId: string, jobId: string): Promise<boolean> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('job_external_contacts')
    .select('job_id')
    .eq('contact_id', contactId)
    .eq('job_id', jobId)
    .eq('is_suggestion', false)
    .maybeSingle()
  return !!data
}
```

Then in both routes, replace the import and the gate:

```ts
import { getContactByToken, isContactOnJob } from '@/lib/supabase/queries/external'
// …
if (!await isContactOnJob(check.contact.id, jobId)) {
  return NextResponse.json({ error: 'not_on_job' }, { status: 403 })
}
```

- [ ] **Step 2: Verify the gate opens before the buttons go**

Run: `npm run type-check` → clean, and `rg -n "'accepted'" src/app/api/ext` → **no matches**.

- [ ] **Step 3: Delete the respond route**

```bash
git rm -r "src/app/api/ext/[token]/respond"
```

- [ ] **Step 4: Simplify the external home page**

In `src/features/external/ExternalHomePage.tsx`:
- Delete the `respond` function (line ~38) and the `busy` state it drives if nothing else uses it.
- Delete the Accept and Decline buttons (lines ~186-200) and the whole **Pending** section they sit in.
- Recompute the two remaining sections with no status in them at all:

```ts
// Every confirmed job, split by date alone. There is no pending state any
// more: agreement happens by phone before anyone is put on a job.
const today    = todayIso()
const upcoming = jobs.filter(j =>
  j.job.job_status !== 'completed' && (j.job.date_end ?? j.job.date) >= today)
const past     = jobs.filter(j =>
  j.job.job_status === 'completed' || (j.job.date_end ?? j.job.date) < today)
```

- In the Past section, `const isDone = j.status === 'accepted'` becomes `const isDone = true` — every past job is now openable, so simply drop the conditional and always render the card as a button.
- Drop `status` from `ExtJobSummary` in `src/lib/supabase/queries/external.ts` and from the query that fills it.

- [ ] **Step 5: Remove the chips from the job form**

In `src/features/job-detail/ExternalPOCBucket.tsx`, delete the `LinkStatus` type and every `status ===` branch (lines ~23, 247-248, 258-259, 300). A confirmed external now renders with one style — the amber **suggestion** state is untouched, because suggest-then-confirm is a different mechanism and still in force. Remove the now-unused `extBucketAccepted` / `extBucketDeclined` keys from `en.ts` and `zh.ts`.

- [ ] **Step 6: Verify nothing still reads the status**

Run: `rg -n "'accepted'|'declined'" src/ --glob '!*.test.ts'`
Expected: **no matches outside `src/lib/supabase/types.ts`**, where the column's type stays because the column itself stays (see Step 7).

Then `npm run type-check` → clean, `npm run build` → clean.

- [ ] **Step 7: Ledger the column, do not drop it**

`job_external_contacts.status` stays in the database, defaulted and unread. Dropping a column is destructive and buys nothing today, and this repo already handles exactly this case the same way — `users.years_experience` / `skills` were hidden in 0052 with the drop ledgered for a quiet session. Add the same line to `docs/nic-checklist.md` under Provisioning overhaul's neighbouring cleanup item, so it is not rediscovered as a mystery:

> **Drop `job_external_contacts.status`** — accept/decline was removed 2026-09-16, so the column is written once at creation and never read. Needs a small migration in a quiet session.

- [ ] **Step 8: Commit**

```bash
git add -A src/app/api/ext src/features/external src/features/job-detail/ExternalPOCBucket.tsx src/lib/supabase/queries/external.ts src/lib/i18n docs/nic-checklist.md
git commit -m "feat: external installers no longer accept or decline a job

Agreement is reached by message and call before anyone is put on a job
(Nic, 2026-09-16), so there is nothing to accept. The 'accepted' check
also gated the job detail and task routes — being formally on the job is
now what unlocks them, changed in the same commit so no external is ever
locked out.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: Docs, and the bot Nic has to create

**Files:**
- Modify: `docs/nic-checklist.md`, `docs/context.md`, `docs/superpowers/specs/2026-09-14-schedule-feedback.md`, `.env.local`

- [ ] **Step 1: Add the checklist items**

Under a new `### Driver board + 6pm summaries` heading in **Pending — Next Session**, in Nic's plain language:

- Create the summary bot with @BotFather and send Claude the token (goes into Vercel for all three environments plus `.env.local`).
- **Everyone who should get a summary must message that bot once.** Telegram blocks a bot from messaging anyone who has not started it — this is what bit the digest bot in August, and a person who skips it silently never receives theirs.
- Decide whether the scheduler summary should also go to you, or schedulers only.
- **Heads up for your outside contractors:** the Accept and Decline buttons are gone from their link page, and every job they are on now opens straight away. Anyone who was sent a job and never pressed Accept could not open it before and can now — worth knowing if one of them mentions seeing more than they used to.

- [ ] **Step 2: Record the standing facts in `docs/context.md`**

A dated `_Last updated: 2026-09-16 (feat-schedule — …)_` line covering: the derived-band rule and why nothing stores a band; that a drag notifies nobody except for jobs dated today; that `jobs.lat`/`lng` exist and are **deliberately unread** so a future session does not delete them as dead code; and that `location` is in Google's Essentials SKU so capturing coordinates costs nothing.

- [ ] **Step 3: Close the spec's open questions**

In item 5's "Still open" section, record that the hand-sorted order question is **answered — sort by time** (Nic, 2026-09-16, with proximity deferred and coordinates being captured towards it), and that "what happens when a job stops being shared" is answered by the derived-band rule and needs no separate code.

- [ ] **Step 4: Commit**

```bash
git add docs
git commit -m "docs: driver board decisions and the summary bot Nic must create

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Before merging to main

- [ ] `npm run type-check` clean, `npm run build` clean.
- [ ] Every test file exits 0 (the loop in Task 7, Step 7). Expected: **34 suites** (31 before + driver-board, location-coords, day-summary).
- [ ] New Tailwind utilities used here actually appear in the built CSS — the `bg-green` lesson: `rg -o "terracotta-soft|bad-soft|brand-green-soft" .next/static/css/*.css | sort -u`.
- [ ] Push `dev`, and Nic tests on the preview: drag between every pair of bands, cancel a drag mid-prompt and confirm nothing changed, drop onto Unassigned, and drag a job dated TODAY to confirm it Telegrams immediately.
- [ ] `TELEGRAM_SUMMARY_BOT_TOKEN` set in Vercel (Production + Preview + Development) before the merge, and at least one recipient has pressed START.
- [ ] Trigger the cron by hand against production once, and read the result: `curl -s -H "Authorization: Bearer $CRON_SECRET" https://greenqubes-ops.vercel.app/api/cron/day-summary`.
- [ ] Changelog entry in `src/lib/changelog/entries.ts` — one entry for the date, `time` decoded from the production deployment's own clock (`x-vercel-id` epoch-ms → UTC+8), probed **after** the deploy lands. `headsUp` earns its words here: the board changes how the scheduler works, and the quiet-until-6pm rule changes what everyone expects from Telegram.
