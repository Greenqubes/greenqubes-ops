# Job Stages (Drafts · Pending · My Jobs panel) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split today's "pending" into a private **Draft** stage and an office-visible **Pending (date TBC)** stage that designers can start work on, make the job date optional before scheduling, and add a **My Jobs** quick-link panel to the Schedule page.

**Architecture:** Today's `pending` status keeps meaning "private draft" in the database (0062 untouched). A NEW enum value `awaiting_date` is the office-visible Pending stage. One module, `src/lib/utils/job-stage.ts`, translates raw statuses into stages (`draft | pending | scheduled | completed`). All screens and new rules speak stages only. The rules (required fields per stage, who may move stages, crew/designer guards, my-jobs selection, design-date change) are pure, standalone-tested modules. A new `/api/jobs/[id]/stage` route performs stage moves on the server.

**Tech Stack:** Next.js 15 (App Router), React 19, Supabase (Postgres + RLS) via `@supabase/ssr`, Tailwind, Telegram Bot API. Tests are standalone `npx tsx <file>.test.ts` scripts with no framework.

**Spec:** `docs/superpowers/specs/2026-10-09-job-stages-design.md`. Read it before Task 1. **The status ↔ stage table in its "Data" section is the single most important fact in this plan.**

## Global Constraints

- **Status ↔ stage, never confused:** `pending` and `awaiting_approval` = **Draft** (private). `awaiting_date` = **Pending** (office-visible). `scheduled` = Scheduled. `completed` = Completed. New code calls `stageOf()` instead of comparing raw strings, except inside `job-stage.ts`, SQL, and query filters (each such filter gets a one-line comment `// raw status — see job-stage.ts`).
- Draft = the full job form with **nothing required**. Pending requires `project_title, client, client_poc_name, client_poc_phone, location`. Push to Schedule requires all six, including `date`.
- Migration numbers: **claim at implementation** per CLAUDE.md (`npx supabase migration list` + `git ls-tree` on every branch). Written below as `<N>` / `<N+1>`. State in the response which numbers were taken and what was checked.
- No new `public` tables (so no GRANT block is needed). If a table is added after all, CLAUDE.md's grants rule applies.
- Overlays: `z-[60]` or above (over BottomNav `z-50`) and **below `z-[100]`** (toast layer; `src/components/toast-layer.test.ts` fails otherwise).
- `/schedule` is hydration-sensitive (#418): anything read from browser storage is read **after mount** in a `useEffect`, never during the first render.
- i18n: new keys go in `en.ts` + `zh.ts` only. bn falls back to English, **except the guided-tour keys**, which are the scoped bn exception and are updated in all three.
- Dates on screen are English regardless of language (CLAUDE.md hard rule).
- No emoji in UI. Icons are lucide stroke icons, as elsewhere.
- Every write checks its result (`.select('id')` on UPDATE/INSERT, and `res.ok` on fetch). An RLS-filtered write is not an error in PostgREST.
- Tests: each new test file **keeps the wrong/old behaviour as its first check and is watched failing** against a deliberately wrong stub before the real code is written.
- Run all suites: `for f in $(git ls-files '*.test.ts'); do npx tsx "$f" > /dev/null || echo "FAIL $f"; done` (prints nothing when everything passes).
- Commits end with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`. **Never push without asking Nic.**

## Review Focus

1. **A Draft must never become visible to the office by any path.** That includes New Job "Save draft", Duplicate, the AI assistant, Bin restore, and "Move back to Drafts". Each path must write `pending`, never `awaiting_date`. Pinned by `job-stage-rules.test.ts` (`targetStatus`) and the Task 13 DB script (existing `pending` count unchanged).
2. **A job with no date reaching date-reading code** (6pm summary, Telegram templates, Design board, overdue, FCFS). Expect "To be confirmed" text, never a crash or "NaN undefined". Pinned by `templates-date.test.ts` and `day-summary-label.test.ts` (Task 4) plus the type-checker sweep (Task 3).
3. **Scheduled → Pending on a job dated today:** the crew must be told immediately and not again at 6pm. Pinned in `job-stage-rules.test.ts` (`postponeNotifyNow`).
4. **Clearing the date on a Pending job that has a design due date:** the due date must not move. Pinned in `design-date-change.test.ts`.
5. **A designer or installer added on the wrong stage** (designer on a Draft, formal crew on a Pending job). It must be refused by the server, not just hidden in the UI. Pinned in `job-stage-rules.test.ts` (`designersAllowed`, `formalCrewAllowed`). The routes call those functions.

---

## File map

| File | New / Modified | Responsibility |
|---|---|---|
| `src/lib/utils/job-stage.ts` (+ `.test.ts`) | New | status ↔ stage translation |
| `src/lib/utils/job-stage-rules.ts` (+ `.test.ts`) | New | required fields per stage, stage moves, crew/designer guards, postpone notify rule |
| `src/lib/utils/my-jobs.ts` (+ `.test.ts`) | New | which jobs are "mine", grouped and sorted |
| `src/lib/utils/design-date-change.ts` (+ `.test.ts`) | New | classifies an install-date change for the design due-date logic |
| `supabase/migrations/<N>_job_status_awaiting_date.sql` | New | enum value |
| `supabase/migrations/<N+1>_job_stages.sql` | New | nullable date + check, sales UPDATE policy |
| `src/lib/supabase/types.ts` | Mod | `JobStatus` gains `awaiting_date`; `jobs.date` → `string \| null` |
| `src/lib/utils/job-form-rules.ts` | Mod | `designBriefEditable` uses stages |
| `src/features/job-detail/useRequiredFields.ts` | Mod | stage-aware checks |
| `src/app/api/jobs/[id]/stage/route.ts` | New | Draft↔Pending, Scheduled→Pending moves |
| `src/app/api/jobs/[id]/submit/route.ts` | Mod | refuse push without a date |
| `src/app/api/jobs/[id]/{assign-installers,sub-installers,crew,external-contacts}/route.ts` | Mod | refuse formal crew on Pending |
| `src/app/api/jobs/[id]/designers/route.ts` | Mod | refuse designers on Draft |
| `src/app/api/jobs/[id]/route.ts` (PATCH) | Mod | date may be set/cleared; no due shift from/to null |
| `src/lib/telegram/templates.ts` | Mod | null-safe dates, `tplJobPostponed` |
| `src/app/api/cron/day-summary/route.ts` | Mod | null-date label |
| `src/lib/supabase/queries/jobs.ts` | Mod | `getScheduleJobs` scheduled-only; `getStageJobs` + `StageJob` |
| `src/lib/supabase/queries/design-load.ts` | Mod | carries `status`, excludes drafts |
| `src/features/stages/StageListShell.tsx` | New | Drafts + Pending list pages |
| `src/app/drafts/page.tsx`, `loading.tsx` | New | Drafts tab |
| `src/app/pending/page.tsx` | Mod | Pending tab on the new list |
| `src/lib/navTabs.ts` | Mod | Drafts tab; Pending for designer/production/hr |
| `src/features/schedule/ScheduleShell.tsx` | Mod | drop `pending` page mode; mount My Jobs panel |
| `src/lib/utils/schedule-date.ts` (+ test) | Mod | drop `pending` mode |
| `src/features/schedule/MyJobsPanel.tsx` | New | the quick-link panel |
| `src/app/schedule/page.tsx` | Mod | pass user id + stage jobs |
| `src/features/job-detail/NewJobShell.tsx` | Mod | Save draft / Save as Pending / Push |
| `src/features/job-detail/StageActions.tsx` | New | stage-move buttons on the edit form |
| `src/features/job-detail/JobDetailShell.tsx` | Mod | wire stages, brief, designers, crew suggest mode |
| `src/components/Pill.tsx` | Mod | stage labels |
| `src/features/design-load/DesignerBar.tsx` | Mod | Pending tag + "TBC" |
| `src/lib/i18n/{en,zh,bn}.ts`, `src/features/tour/steps/{sales,coordinator}.ts` | Mod | copy |
| `src/lib/ai/tool-schemas.ts` | Mod | wording only |

---

### Task 1: The stage module

**Files:**
- Create: `src/lib/utils/job-stage.ts`
- Test: `src/lib/utils/job-stage.test.ts`

**Interfaces:**
- Produces: `type Stage = 'draft' | 'pending' | 'scheduled' | 'completed'`; `stageOf(status: string | null | undefined): Stage`; `STAGE_STATUS: Record<Stage, string>` (the status a move INTO that stage writes); `DRAFT_STATUSES: readonly string[]`; `NOT_YET_SCHEDULED_STATUSES: readonly string[]`.

- [ ] **Step 1: Write the failing test**

```ts
/**
 * Standalone test for the status ↔ stage translation (no test framework).
 * Run: npx tsx src/lib/utils/job-stage.test.ts
 * Exits 1 on any failure.
 */
import { stageOf, STAGE_STATUS, DRAFT_STATUSES, NOT_YET_SCHEDULED_STATUSES } from './job-stage'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`); failures++ }
}

console.log('stageOf:')
// THE TRAP this module exists to contain (Nic, 2026-10-09): in the database
// `pending` means a PRIVATE DRAFT. Reading it as the office Pending stage is
// how a draft leaks to the whole company.
check("raw 'pending' is a Draft, not Pending", stageOf('pending'), 'draft')
check('the legacy awaiting_approval is a Draft', stageOf('awaiting_approval'), 'draft')
check('awaiting_date is the office Pending stage', stageOf('awaiting_date'), 'pending')
check('scheduled', stageOf('scheduled'), 'scheduled')
check('completed', stageOf('completed'), 'completed')
// Unknown or missing must land on the MOST private stage.
check('unknown status is treated as a Draft', stageOf('something-new'), 'draft')
check('null is treated as a Draft', stageOf(null), 'draft')

console.log('STAGE_STATUS (what a move into each stage writes):')
check('into Draft writes pending', STAGE_STATUS.draft, 'pending')
check('into Pending writes awaiting_date', STAGE_STATUS.pending, 'awaiting_date')
check('into Scheduled writes scheduled', STAGE_STATUS.scheduled, 'scheduled')

console.log('lists:')
check('draft statuses', DRAFT_STATUSES, ['pending', 'awaiting_approval'])
check('not yet scheduled', NOT_YET_SCHEDULED_STATUSES, ['pending', 'awaiting_approval', 'awaiting_date'])

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nall job-stage checks passed')
```

- [ ] **Step 2: Watch it fail against a wrong stub.** Create `job-stage.ts` with the naive mapping, `export function stageOf(s: string | null | undefined) { return (s === 'pending' ? 'pending' : s ?? 'draft') as Stage }`, plus the exported constants left as empty arrays/objects. Run `npx tsx src/lib/utils/job-stage.test.ts`. Expected: FAIL on "raw 'pending' is a Draft, not Pending".

- [ ] **Step 3: Write the real module**

```ts
/**
 * Status ↔ stage — the ONE place the database's job_status words are
 * translated into what people see (spec 2026-10-09-job-stages-design.md).
 *
 * In the database, `pending` means a PRIVATE DRAFT (migration 0062 keeps it
 * private) and `awaiting_date` is the office-visible Pending stage. The words
 * are the wrong way round on purpose: drafts kept the status they already
 * had, so going live moved no rows and opened no privacy gap while preview
 * and production shared one database (Nic, 2026-10-09).
 *
 * Screens and rules speak in stages. Compare raw statuses only here, in SQL,
 * and in query filters (marked `// raw status — see job-stage.ts`).
 */

export type Stage = 'draft' | 'pending' | 'scheduled' | 'completed'

export const DRAFT_STATUSES = ['pending', 'awaiting_approval'] as const
export const NOT_YET_SCHEDULED_STATUSES = ['pending', 'awaiting_approval', 'awaiting_date'] as const

/** Unknown or missing statuses fall to Draft — the most private stage. */
export function stageOf(status: string | null | undefined): Stage {
  switch (status) {
    case 'awaiting_date': return 'pending'
    case 'scheduled':     return 'scheduled'
    case 'completed':     return 'completed'
    default:              return 'draft'
  }
}

/** The status a move INTO each stage writes. */
export const STAGE_STATUS: Record<Stage, 'pending' | 'awaiting_date' | 'scheduled' | 'completed'> = {
  draft:     'pending',
  pending:   'awaiting_date',
  scheduled: 'scheduled',
  completed: 'completed',
}
```

- [ ] **Step 4: Run it.** `npx tsx src/lib/utils/job-stage.test.ts`. Expected: `all job-stage checks passed`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/job-stage.ts src/lib/utils/job-stage.test.ts
git commit -m "feat(stages): one module translating job status into stage

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Stage rules (required fields, moves, guards)

**Files:**
- Create: `src/lib/utils/job-stage-rules.ts`
- Test: `src/lib/utils/job-stage-rules.test.ts`
- Modify: `src/lib/utils/job-form-rules.ts` (`designBriefEditable`, lines ~259-266) and its test `src/lib/utils/job-form-rules.test.ts`

**Interfaces:**
- Consumes: `Stage`, `stageOf`, `STAGE_STATUS` (Task 1); `REQUIRED_JOB_FIELDS`, `RequiredJobField` from `job-form-rules.ts`.
- Produces:
  - `REQUIRED_FOR_STAGE: Record<Stage, RequiredJobField[]>`
  - `missingForStage(stage: Stage, values: Partial<Record<RequiredJobField, string | null | undefined>>): RequiredJobField[]`
  - `clearedForStage(stage: Stage, original, current): RequiredJobField[]`
  - `type StageJob4Rules = { status: string; created_by: string | null; sales_poc_id: string | null; coordinatorIds: string[] }`
  - `type StageViewer = { id: string; role: string }`
  - `isStageMoveValid(from: Stage, to: Stage): boolean`
  - `canMoveStage(viewer: StageViewer, job: StageJob4Rules, to: Stage): boolean`
  - `canEditAtStage(viewer: StageViewer, job: StageJob4Rules): boolean`
  - `designersAllowed(status: string): boolean`
  - `formalCrewAllowed(status: string): boolean`
  - `postponeNotifyNow(jobDate: string | null, todayISO: string): boolean`

- [ ] **Step 1: Write the failing test**

```ts
/**
 * Standalone test for the job-stage rules (no test framework).
 * Run: npx tsx src/lib/utils/job-stage-rules.test.ts
 * Exits 1 on any failure.
 */
import {
  REQUIRED_FOR_STAGE, missingForStage, clearedForStage,
  isStageMoveValid, canMoveStage, canEditAtStage,
  designersAllowed, formalCrewAllowed, postponeNotifyNow,
} from './job-stage-rules'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`); failures++ }
}

const full = {
  project_title: 'Fossil', date: '2026-10-15', client: 'Fossil SG',
  client_poc_name: 'Marvin', client_poc_phone: '91234567', location: '313 Orchard Rd',
}
const noDate = { ...full, date: '' }

console.log('required fields per stage:')
// THE OLD RULE, kept first: before stages, every save that left the draft
// demanded all six fields, date included. A Pending job must NOT need a date —
// that is the whole point of the stage (sales colleague, 2026-10-08).
check('Pending does NOT require a date', missingForStage('pending', noDate), [])
check('Scheduled still requires the date', missingForStage('scheduled', noDate), ['date'])
check('a Draft requires nothing at all (Nic, 2026-10-09)', missingForStage('draft', {}), [])
check('Pending requires the other five', missingForStage('pending', {}),
  ['project_title', 'client', 'client_poc_name', 'client_poc_phone', 'location'])
check('Pending list has no date', REQUIRED_FOR_STAGE.pending.includes('date'), false)

console.log('cannot empty a required field at its stage:')
check('a Draft may empty anything', clearedForStage('draft', full, {}), [])
check('a Pending job may clear its date', clearedForStage('pending', full, noDate), [])
check('a Pending job may not empty its client', clearedForStage('pending', full, { ...full, client: ' ' }), ['client'])
check('a Scheduled job may not clear its date', clearedForStage('scheduled', full, noDate), ['date'])

console.log('valid moves:')
check('draft → pending', isStageMoveValid('draft', 'pending'), true)
check('draft → scheduled', isStageMoveValid('draft', 'scheduled'), true)
check('pending → scheduled', isStageMoveValid('pending', 'scheduled'), true)
check('pending → draft', isStageMoveValid('pending', 'draft'), true)
check('scheduled → pending (postponed)', isStageMoveValid('scheduled', 'pending'), true)
check('scheduled → draft is NOT a move', isStageMoveValid('scheduled', 'draft'), false)
check('completed → anything is NOT a move (Revert owns that)', isStageMoveValid('completed', 'scheduled'), false)
check('same stage is not a move', isStageMoveValid('pending', 'pending'), false)

const NIC = 'u-nic', OTHER = 'u-other', COORD = 'u-coord'
const draft   = { status: 'pending',       created_by: NIC, sales_poc_id: NIC, coordinatorIds: [COORD] }
const pending = { status: 'awaiting_date', created_by: NIC, sales_poc_id: NIC, coordinatorIds: [COORD] }
const sched   = { status: 'scheduled',     created_by: NIC, sales_poc_id: NIC, coordinatorIds: [] }

console.log('who may move a job:')
check('the PIC moves their draft to Pending', canMoveStage({ id: NIC, role: 'sales' }, draft, 'pending'), true)
check('another sales person may not', canMoveStage({ id: OTHER, role: 'sales' }, pending, 'draft'), false)
check('a coordinator ON the job may', canMoveStage({ id: COORD, role: 'coordinator' }, pending, 'draft'), true)
check('a coordinator NOT on the job may not', canMoveStage({ id: OTHER, role: 'coordinator' }, pending, 'draft'), false)
check('a scheduler may move any', canMoveStage({ id: OTHER, role: 'scheduler' }, sched, 'pending'), true)
check('admin may move any', canMoveStage({ id: OTHER, role: 'admin' }, pending, 'draft'), true)
check('a designer may never move a stage', canMoveStage({ id: NIC, role: 'designer' }, pending, 'draft'), false)
check('an invalid move is refused even for admin', canMoveStage({ id: NIC, role: 'admin' }, sched, 'draft'), false)

console.log('who may edit a Pending job:')
check('another sales person reads a Pending job only', canEditAtStage({ id: OTHER, role: 'sales' }, pending), false)
check('its PIC edits it', canEditAtStage({ id: NIC, role: 'sales' }, pending), true)
check('a scheduler edits it', canEditAtStage({ id: OTHER, role: 'scheduler' }, pending), true)
check('hr never edits', canEditAtStage({ id: OTHER, role: 'hr' }, pending), false)

console.log('guards:')
check('no designer on a Draft (they could not see it)', designersAllowed('pending'), false)
check('designer on a Pending job', designersAllowed('awaiting_date'), true)
check('designer on a Scheduled job', designersAllowed('scheduled'), true)
check('no formal crew on a Pending job (installers must never see one)', formalCrewAllowed('awaiting_date'), false)
check('formal crew on a Draft is unchanged (0062 hides drafts)', formalCrewAllowed('pending'), true)
check('formal crew on a Scheduled job', formalCrewAllowed('scheduled'), true)

console.log('postponing a job tells the crew now only if it was today:')
check('dated today → now', postponeNotifyNow('2026-10-09', '2026-10-09'), true)
check('dated tomorrow → 6pm summary', postponeNotifyNow('2026-10-10', '2026-10-09'), false)
check('no date → 6pm summary', postponeNotifyNow(null, '2026-10-09'), false)

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nall job-stage-rules checks passed')
```

- [ ] **Step 2: Watch it fail against a wrong stub.** Create `job-stage-rules.ts` exporting every name above, with `REQUIRED_FOR_STAGE` set to `REQUIRED_JOB_FIELDS` for every stage (the old rule) and the other functions returning `true` / `[]`. Run it. Expected: FAIL on "Pending does NOT require a date".

- [ ] **Step 3: Write the real module**

```ts
/**
 * Job-stage rules — pure, so the forms, the routes and the tests share them
 * (spec 2026-10-09-job-stages-design.md). Stages come from job-stage.ts;
 * never compare raw statuses here except through stageOf().
 */
import { REQUIRED_JOB_FIELDS, type RequiredJobField } from './job-form-rules'
import { stageOf, type Stage } from './job-stage'

type MaybeText = string | null | undefined
type Values = Partial<Record<RequiredJobField, MaybeText>>

/** Draft = the full form with nothing required (Nic, 2026-10-09). Pending =
 *  everything but the date. Scheduled = all six, as since 2026-09-10. */
export const REQUIRED_FOR_STAGE: Record<Stage, RequiredJobField[]> = {
  draft:     [],
  pending:   REQUIRED_JOB_FIELDS.filter(f => f !== 'date'),
  scheduled: [...REQUIRED_JOB_FIELDS],
  completed: [...REQUIRED_JOB_FIELDS],
}

const filled = (v: MaybeText) => (v ?? '').trim() !== ''

export function missingForStage(stage: Stage, values: Values): RequiredJobField[] {
  return REQUIRED_FOR_STAGE[stage].filter(f => !filled(values[f]))
}

/** Required-at-this-stage fields that HAD something and are now empty. */
export function clearedForStage(stage: Stage, original: Values, current: Values): RequiredJobField[] {
  return REQUIRED_FOR_STAGE[stage].filter(f => filled(original[f]) && !filled(current[f]))
}

const MOVES: ReadonlyArray<[Stage, Stage]> = [
  ['draft', 'pending'], ['draft', 'scheduled'],
  ['pending', 'scheduled'], ['pending', 'draft'],
  ['scheduled', 'pending'],
]
export function isStageMoveValid(from: Stage, to: Stage): boolean {
  return MOVES.some(([a, b]) => a === from && b === to)
}

export type StageJob4Rules = {
  status: string; created_by: string | null; sales_poc_id: string | null; coordinatorIds: string[]
}
export type StageViewer = { id: string; role: string }

const OFFICE_ALL = ['scheduler', 'admin']
const SHARER_ROLES = ['sales', 'coordinator']

function isSharer(v: StageViewer, j: StageJob4Rules): boolean {
  return v.id === j.created_by || v.id === j.sales_poc_id || j.coordinatorIds.includes(v.id)
}

/** Creator, sales PIC, coordinators on it, schedulers, admin (spec). Scheduled
 *  and Draft jobs keep their existing gates; this answers for Pending. */
export function canEditAtStage(v: StageViewer, j: StageJob4Rules): boolean {
  if (OFFICE_ALL.includes(v.role)) return true
  return SHARER_ROLES.includes(v.role) && isSharer(v, j)
}

export function canMoveStage(v: StageViewer, j: StageJob4Rules, to: Stage): boolean {
  if (!isStageMoveValid(stageOf(j.status), to)) return false
  return canEditAtStage(v, j)
}

/** A designer on a Draft could not see it (0062) yet would be Telegrammed. */
export function designersAllowed(status: string): boolean {
  return stageOf(status) !== 'draft'
}

/** Formal crew is confirmed once a job is on the schedule. On a Pending job
 *  only suggestions are allowed, so no installer (0037) can ever see one. */
export function formalCrewAllowed(status: string): boolean {
  return stageOf(status) !== 'pending'
}

/** Scheduled → Pending: crew hear immediately only for a job dated today;
 *  otherwise the 6pm summary tells them (same split as a board drag). */
export function postponeNotifyNow(jobDate: string | null, todayISO: string): boolean {
  return jobDate === todayISO
}
```

- [ ] **Step 4: Run it.** `npx tsx src/lib/utils/job-stage-rules.test.ts`. Expected: `all job-stage-rules checks passed`.

- [ ] **Step 5: Update `designBriefEditable`.** In `src/lib/utils/job-form-rules.ts` replace the body's `return status === 'scheduled'` with a stage check, and add the import at the top of the file:

```ts
import { stageOf } from './job-stage'
// …
export function designBriefEditable(input: {
  status:   string | null
  readOnly: boolean
}): boolean {
  const { status, readOnly } = input
  if (readOnly) return false
  // Pending (awaiting_date) unlocks it: designers start work before the
  // install date is confirmed (spec 2026-10-09). A Draft stays locked —
  // designers cannot see drafts.
  const stage = stageOf(status)
  return stage === 'pending' || stage === 'scheduled'
}
```

In `src/lib/utils/job-form-rules.test.ts`, find the `designBriefEditable` checks and add these two at the top of that block, keeping the old expectation as a comment above them:

```ts
// OLD RULE (until 2026-10-09): scheduled only. A Pending job was locked.
check('brief unlocks on a Pending job (awaiting_date)', designBriefEditable({ status: 'awaiting_date', readOnly: false }), true)
check('brief stays locked on a Draft (raw pending)', designBriefEditable({ status: 'pending', readOnly: false }), false)
```

Run `npx tsx src/lib/utils/job-form-rules.test.ts`. Expected: PASS. (Run it once BEFORE editing `designBriefEditable` to see the first new check fail.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/utils/job-stage-rules.ts src/lib/utils/job-stage-rules.test.ts src/lib/utils/job-form-rules.ts src/lib/utils/job-form-rules.test.ts
git commit -m "feat(stages): required fields, stage moves and crew/designer guards

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Migrations + types, then the type-checker sweep

**Files:**
- Create: `supabase/migrations/<N>_job_status_awaiting_date.sql`, `supabase/migrations/<N+1>_job_stages.sql`
- Modify: `src/lib/supabase/types.ts` (line 11 `JobStatus`; line ~53 `date`)
- Modify: `src/lib/supabase/queries/jobs.ts` (`getScheduleJobs`, line ~91)
- Modify: every file `npm run type-check` flags (see Step 6)

**Interfaces:**
- Produces: `JobStatus` includes `'awaiting_date'`; `Database['public']['Tables']['jobs']['Row']['date']` is `string | null`; `getScheduleJobs()` returns scheduled jobs only, so `ScheduleJob.date` stays `string`.

- [ ] **Step 1: Claim the numbers.** Run `npx supabase migration list` (highest number in the `remote` column), then `git branch -a` and, for each branch, `git ls-tree -r --name-only <branch> -- supabase/migrations/ | tail -3`. Take the next two numbers above both. Write them into your response with what was checked.

- [ ] **Step 2: Write `<N>_job_status_awaiting_date.sql`**

```sql
-- <N> — the office-visible Pending stage (spec 2026-10-09-job-stages-design.md)
--
-- Its own migration on purpose: Postgres cannot use a new enum value inside
-- the transaction that adds it (the 0018/0019 and 0057 rule).
--
-- NAMING, read before touching job statuses: `pending` stays a PRIVATE DRAFT
-- (0062, unchanged). `awaiting_date` is the new office-visible Pending stage.
-- Screens translate through src/lib/utils/job-stage.ts.
alter type job_status add value if not exists 'awaiting_date';
```

- [ ] **Step 3: Write `<N+1>_job_stages.sql`**

```sql
-- <N+1> — job stages: an optional date before scheduling, sales edit rights
-- on Pending (spec 2026-10-09-job-stages-design.md, Nic 2026-10-09).
--
-- SAFE BEFORE THE NEW CODE IS LIVE: preview and production share this
-- database. Old code always writes a date and never writes awaiting_date,
-- so nothing here changes what it can see or do. No existing row is touched.
--
-- Already right with NO edit, checked 2026-10-09:
--   0060 "designer and production see non-pending" — awaiting_date is not in
--        its exclusion list, so they see Pending jobs.
--   0058 "readonly role non-pending select" (hr) — same.
--   0062 pending privacy — keys off ('pending','awaiting_approval'), i.e. Drafts.
--   0019 scheduler/admin and 0037 coordinator/production UPDATE — blanket.
--   Installers (0037 assigned, 0053 completed) — formal crew is refused on
--        awaiting_date by the routes, so 0037 can never match one.

-- 1. A date is optional until a job is on the schedule.
alter table jobs alter column date drop not null;
alter table jobs drop constraint if exists jobs_date_required_when_scheduled;
alter table jobs add constraint jobs_date_required_when_scheduled
  check (date is not null or status in ('pending', 'awaiting_approval', 'awaiting_date'));

-- 2. Sales edit their own Pending jobs, as they already do drafts and
--    scheduled ones (0056 + awaiting_date in both clauses).
drop policy if exists "jobs: sales can update own pending or scheduled jobs" on jobs;
create policy "jobs: sales can update own pending or scheduled jobs"
  on jobs for update to authenticated
  using (
    get_my_role() = 'sales' and
    sales_poc_id = get_my_id() and
    status in ('pending', 'awaiting_approval', 'awaiting_date', 'scheduled')
  )
  with check (
    get_my_role() = 'sales' and
    sales_poc_id = get_my_id() and
    status in ('pending', 'awaiting_approval', 'awaiting_date', 'scheduled', 'completed')
  );
```

- [ ] **Step 4: Ask Nic before applying.** Tell him in one line that both are safe while production runs the old code, and wait for his go. **First record the draft count** (service-key script: count jobs with `status in ('pending','awaiting_approval')`). Task 13 compares against it. Then run `npx supabase db push --dry-run` (expected: exactly `<N>` and `<N+1>` pending) followed by `npx supabase db push`. Then `npx supabase migration list`: both appear under `remote`.

- [ ] **Step 5: Types.** In `src/lib/supabase/types.ts`:

```ts
// line 11
export type JobStatus   = 'scheduled' | 'pending' | 'awaiting_approval' | 'awaiting_date' | 'completed'
```

and in `jobs.Row` change `date: string` to `date: string | null`.

In `src/lib/supabase/queries/jobs.ts` `getScheduleJobs()`, add `.eq('status', 'scheduled') // raw status — see job-stage.ts` before the first `.order(`, with a comment above it: `// The schedule only ever draws scheduled jobs (ScheduleShell's own filter dropped the rest), and narrowing here keeps ScheduleJob.date a non-null string.`

- [ ] **Step 6: The sweep.** Run `npm run type-check`. Every error is a place that reads `jobs.date` and must now be classified. For each one, apply exactly one of these and nothing else:
  - (a) The query already filters to `scheduled`/`completed`: cast at the query boundary (e.g. `as { date: string }`) with the comment `// scheduled-only query — date is never null here`.
  - (b) It can see not-yet-scheduled jobs and only needs the date for display: use `job.date ?? null` and let the display show "TBC" (Tasks 4, 9 and 11 supply the helpers).
  - (c) It can see not-yet-scheduled jobs and does date maths: add a status filter (`.eq('status','scheduled')`), **never** a silent `?? today`.

  Record each file and the letter chosen in the commit message body. Known in advance: `src/app/api/jobs/[id]/route.ts` PATCH (Task 5 rewrites it), `src/app/api/jobs/[id]/designers/route.ts` (b), `src/app/api/cron/day-summary/route.ts` (Task 4), `src/lib/supabase/queries/design-load.ts` (already `?? null`), `src/lib/supabase/queries/job-bin.ts` (already `?? null`), `src/features/job-detail/JobDetailShell.tsx` (`job.date ?? ''` already at line ~83).

- [ ] **Step 7: Run all suites** (command in Global Constraints). Expected: no output.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations src/lib/supabase/types.ts src/lib/supabase/queries/jobs.ts <every file from the sweep>
git commit -m "feat(stages): awaiting_date status + optional date before scheduling

Migrations <N> and <N+1>, applied on Nic's go. Type sweep: <file — a/b/c list>.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Telegram templates + 6pm summary cope with no date; the postponed message

**Files:**
- Modify: `src/lib/telegram/templates.ts` (`formatDate`, line 3; new `tplJobPostponed`)
- Test: `src/lib/telegram/templates-date.test.ts` (new)
- Modify: `src/app/api/cron/day-summary/route.ts` (line ~229, `dateLabel`)
- Create: `src/lib/utils/day-summary-label.ts`; Test: `src/lib/utils/day-summary-label.test.ts`

**Interfaces:**
- Produces: `formatDate(iso: string | null | undefined): string` (returns `'To be confirmed'` for empty); `tplJobPostponed(p: { projectTitle: string | null; jobClient: string; oldDate: string; location: string; jobUrl: string }): string`; `changeDateLabel(date: string | null, format: (iso: string) => string): string`.

- [ ] **Step 1: Write the failing tests**

`src/lib/telegram/templates-date.test.ts`:

```ts
/**
 * Run: npx tsx src/lib/telegram/templates-date.test.ts
 */
import { formatDate, tplJobPostponed, tplDesignAssigned } from './templates'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`); failures++ }
}

// THE CRASH this prevents: formatDate(null) used to throw (null.split), and
// '' rendered "NaN undefined NaN". A Pending job has no date (2026-10-09).
check('a real date', formatDate('2026-10-15'), '15 Oct 2026')
check('no date reads "To be confirmed"', formatDate(null), 'To be confirmed')
check('empty string reads "To be confirmed"', formatDate(''), 'To be confirmed')
check('design-assigned on a dateless job does not crash',
  tplDesignAssigned({ projectTitle: 'X', client: 'C', date: null as unknown as string, assignedBy: 'Nic', jobUrl: 'u' }).includes('To be confirmed'), true)
const msg = tplJobPostponed({ projectTitle: 'Fossil', jobClient: 'Fossil SG', oldDate: '2026-10-09', location: '313 Orchard', jobUrl: 'https://x/jobs/1' })
check('postponed message names the old date', msg.includes('9 Oct 2026'), true)
check('postponed message says date TBC', msg.includes('To be confirmed'), true)

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nall templates-date checks passed')
```

`src/lib/utils/day-summary-label.test.ts`:

```ts
/**
 * Run: npx tsx src/lib/utils/day-summary-label.test.ts
 */
import { changeDateLabel } from './day-summary-label'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`); failures++ }
}
const fmt = (iso: string) => `F(${iso})`
// A postponed job (Scheduled → Pending) has no date by 6pm; the line must
// still say something a person understands.
check('a dated job uses the formatter', changeDateLabel('2026-10-15', fmt), 'F(2026-10-15)')
check('a postponed job', changeDateLabel(null, fmt), 'Postponed, date to be confirmed')

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nall day-summary-label checks passed')
```

- [ ] **Step 2: Run both. Expected: FAIL.** The first throws on `formatDate(null)`; the second cannot import a module that doesn't exist yet.

- [ ] **Step 3: Implement.** In `templates.ts` replace `formatDate`:

```ts
export function formatDate(iso: string | null | undefined): string {
  // A Pending job (awaiting_date) may have no install date yet (2026-10-09).
  if (!iso) return 'To be confirmed'
  const [y, m, d] = iso.split('-').map(Number)
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${d} ${months[m - 1]} ${y}`
}
```

Then change every template parameter typed `date: string`, `jobDate: string` or `installDate: string` to `string | null` (they all already route through `formatDate`). Append:

```ts
// Sent immediately to crew taken off a job that was dated TODAY when it was
// moved back to Pending (postponed, date to be confirmed). Any other day,
// the 6pm summary tells them instead (spec 2026-10-09).
export function tplJobPostponed(p: {
  projectTitle: string | null
  jobClient:    string
  oldDate:      string
  location:     string
  jobUrl:       string
}): string {
  return (
    `⏸ <b>Job Postponed</b>\n` +
    `<b>Project:</b> ${p.projectTitle ?? p.jobClient}\n` +
    `<b>Client:</b> ${p.jobClient}\n` +
    `<b>Was:</b> ${formatDate(p.oldDate)}\n` +
    `<b>New date:</b> ${formatDate(null)}\n` +
    `<b>Location:</b> ${p.location}\n\n` +
    `You are no longer on this job.\n` +
    `<a href="${p.jobUrl}">View in app →</a>`
  )
}
```

(Match the emoji usage of neighbouring templates: Telegram messages already use them, and the no-emoji rule covers app UI only.)

Create `src/lib/utils/day-summary-label.ts`:

```ts
/** The date part of a 6pm-summary change line. A job moved back to Pending
 *  has no date by the time the summary runs (spec 2026-10-09). */
export function changeDateLabel(date: string | null, format: (iso: string) => string): string {
  return date ? format(date) : 'Postponed, date to be confirmed'
}
```

In `day-summary/route.ts`: type `JobLite.date` as `string | null`, import `changeDateLabel`, and replace `dateLabel: formatDayDate(job.date),` (line ~229) with `dateLabel: changeDateLabel(job.date, formatDayDate),`.

- [ ] **Step 4: Run both tests.** Expected: PASS. Then `npm run type-check`: clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/telegram/templates.ts src/lib/telegram/templates-date.test.ts src/lib/utils/day-summary-label.ts src/lib/utils/day-summary-label.test.ts src/app/api/cron/day-summary/route.ts
git commit -m "feat(stages): Telegram and 6pm summary handle a job with no date

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Design due date never shifts from or to a missing date

**Files:**
- Create: `src/lib/utils/design-date-change.ts`; Test: `src/lib/utils/design-date-change.test.ts`
- Modify: `src/app/api/jobs/[id]/route.ts` PATCH (lines ~96-239)
- Modify: `src/features/job-detail/JobDetailShell.tsx` `saveDesignBriefFields` (line ~491)

**Interfaces:**
- Produces: `type DateChange = 'none' | 'set' | 'cleared' | 'moved'`; `designDateChange(oldDate: string | null, newDate: string | null | undefined): DateChange` (`undefined` = not sent).

- [ ] **Step 1: Failing test**

```ts
/**
 * Run: npx tsx src/lib/utils/design-date-change.test.ts
 */
import { designDateChange } from './design-date-change'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`); failures++ }
}
// THE BUG this prevents: the auto-shift measured daysBetween(old, new). With a
// missing old date that is NaN, and the due date became "Invalid Date".
check('first date on a dateless Pending job is a SET, not a move', designDateChange(null, '2026-10-15'), 'set')
check('clearing the date', designDateChange('2026-10-15', null), 'cleared')
check('a real move', designDateChange('2026-10-15', '2026-10-20'), 'moved')
check('same date', designDateChange('2026-10-15', '2026-10-15'), 'none')
check('not sent', designDateChange('2026-10-15', undefined), 'none')
check('null to null', designDateChange(null, null), 'none')
check("'' counts as cleared", designDateChange('2026-10-15', ''), 'cleared')

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nall design-date-change checks passed')
```

- [ ] **Step 2: Wrong stub** (`return newDate && newDate !== oldDate ? 'moved' : 'none'`, which is the old route's logic). Run. Expected: FAIL on "first date … is a SET".

- [ ] **Step 3: Implement**

```ts
/** How an install-date edit should be treated by the design due-date logic
 *  (spec 2026-10-09). Only 'moved' shifts the due date; 'set' and 'cleared'
 *  leave it alone because there is no old date to measure from or to. */
export type DateChange = 'none' | 'set' | 'cleared' | 'moved'

export function designDateChange(
  oldDate: string | null,
  newDate: string | null | undefined,
): DateChange {
  if (newDate === undefined) return 'none'
  const next = newDate || null
  if (next === oldDate) return 'none'
  if (!oldDate) return 'set'
  if (!next)    return 'cleared'
  return 'moved'
}
```

- [ ] **Step 4: Rewire the PATCH route.** In `src/app/api/jobs/[id]/route.ts`:
  - body type: `date?: string | null`.
  - `JobRow.date`: `string | null`.
  - Replace the `if (body.date && body.date !== job.date) { … }` block (lines ~193-223) with:

```ts
  const change = designDateChange(job.date, 'date' in body ? body.date : undefined)
  if (change !== 'none') updates.date = body.date || null

  if (change === 'moved' && job.date && body.date) {
    // (existing auto-shift + install_shift logic, unchanged, using job.date and body.date)
  } else if ((change === 'set' || change === 'cleared') && !dueCleared && !dueTyped) {
    // No old (or new) date to measure from: the due date stays put, and the
    // designers are told the install date was set / removed.
    const dueAfterSave = ('design_due_date' in updates ? updates.design_due_date : job.design_due_date) as string | null
    notify = { kind: 'install_shift', oldInstallDate: job.date, installDate: body.date || null, dueDate: dueAfterSave }
  }
```

  - Widen `InstallShiftNotify` (and `DueRemovedNotify` / `DueSetNotify`'s install fields) to `string | null`, and the `installDate: body.date ?? job.date` expressions to `('date' in body ? (body.date || null) : job.date)`.
  - `dateChanged` (line ~249) becomes `const dateChanged = change !== 'none'`.
  - In `tplDesignInstallShift`, when `oldInstallDate` is null, the title line reads `Install Date Set`; when `installDate` is null, it reads `Install Date Removed`. Keep the arrow line, which renders "To be confirmed" through `formatDate`.

- [ ] **Step 5: Client.** In `JobDetailShell.tsx` `saveDesignBriefFields(newDate: string | null, …)`: change the spread to `...(newDate !== job.date ? { date: newDate || null } : {})`. Callers pass `getValues().date || null`.

- [ ] **Step 6: Run** the new test, `npx tsx src/lib/utils/design-urgency.test.ts`, and `npm run type-check`. Expected: PASS / clean.

- [ ] **Step 7: Commit** (`feat(stages): design due date ignores a first or cleared install date`).

---

### Task 6: Server — stage moves, push needs a date, crew/designer guards

**Files:**
- Create: `src/app/api/jobs/[id]/stage/route.ts`
- Modify: `src/app/api/jobs/[id]/submit/route.ts`
- Modify: `src/app/api/jobs/[id]/assign-installers/route.ts`, `sub-installers/route.ts`, `crew/route.ts`, `external-contacts/route.ts` (POST), `designers/route.ts` (POST)

**Interfaces:**
- Consumes: `stageOf`, `STAGE_STATUS` (T1); `canMoveStage`, `missingForStage`, `designersAllowed`, `formalCrewAllowed`, `postponeNotifyNow` (T2); `tplJobPostponed` (T4); `recordCrewChange` from `queries/notifications.ts`.
- Produces: `POST /api/jobs/[id]/stage` with body `{ to: 'draft' | 'pending' }` → `200 { ok: true, status }` | `400 { error: 'bad_target' }` | `403 { error: 'not_permitted' }` | `404` | `409 { error: 'invalid_move' }` | `422 { error: 'missing_fields', fields: RequiredJobField[] }`. Scheduled→Pending clears the date and removes all crew rows. `POST /submit` now returns `422 { error: 'date_required' }` when the job has no date.

- [ ] **Step 1: Write the stage route**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveRole } from '@/lib/utils/role-override'
import { stageOf, STAGE_STATUS, type Stage } from '@/lib/utils/job-stage'
import { canMoveStage, missingForStage, postponeNotifyNow } from '@/lib/utils/job-stage-rules'
import { recordCrewChange } from '@/lib/supabase/queries/notifications'
import { sendTelegram } from '@/lib/telegram/bot'
import { tplJobPostponed } from '@/lib/telegram/templates'
import type { Role } from '@/lib/supabase/types'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://greenqubes-ops.vercel.app'

/**
 * Stage moves that are not "push to schedule" (spec 2026-10-09):
 *   Draft → Pending, Pending → Draft, Scheduled → Pending (postponed).
 * Push to Schedule keeps its own route (/submit): it carries the clash flow
 * and the scheduler Telegram.
 *
 * Scheduled → Pending clears the date and takes the whole crew off — crew
 * are confirmed once a job is on the schedule, and an installer must never
 * see a Pending job. Removed crew are told at 6pm, or now if it was today.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: jobId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  type ProfileRow = { id: string; role: Role }
  const { data: profile } = await supabase.from('users').select('id, role')
    .eq('auth_id', user.id).maybeSingle() as { data: ProfileRow | null; error: unknown }
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = await getEffectiveRole(profile.role)

  const body = await req.json().catch(() => ({})) as { to?: string }
  const to = body.to
  if (to !== 'draft' && to !== 'pending') return NextResponse.json({ error: 'bad_target' }, { status: 400 })

  type JobRow = {
    id: string; status: string; date: string | null; created_by: string | null; sales_poc_id: string | null
    project_title: string | null; client: string; client_poc_name: string | null
    client_poc_phone: string | null; location: string
    job_coordinators: Array<{ user_id: string }>
  }
  const { data: job } = await supabase.from('jobs')
    .select('id, status, date, created_by, sales_poc_id, project_title, client, client_poc_name, client_poc_phone, location, job_coordinators(user_id)')
    .eq('id', jobId).maybeSingle() as { data: JobRow | null; error: unknown }
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const from = stageOf(job.status)
  const rulesJob = { status: job.status, created_by: job.created_by, sales_poc_id: job.sales_poc_id,
    coordinatorIds: job.job_coordinators.map(c => c.user_id) }
  if (!canMoveStage({ id: profile.id, role }, rulesJob, to as Stage)) {
    // Distinguish "not a legal move" from "not yours" for the toast.
    const legal = canMoveStage({ id: profile.id, role: 'admin' }, rulesJob, to as Stage)
    return NextResponse.json({ error: legal ? 'not_permitted' : 'invalid_move' }, { status: legal ? 403 : 409 })
  }

  if (to === 'pending') {
    const missing = missingForStage('pending', job)
    if (missing.length) return NextResponse.json({ error: 'missing_fields', fields: missing }, { status: 422 })
  }

  const postponing = from === 'scheduled' && to === 'pending'
  const patch: Record<string, unknown> = { status: STAGE_STATUS[to as Stage] }
  if (postponing) patch.date = null

  // Crew first when postponing: the check constraint allows a null date on
  // awaiting_date, and removing crew before the status flips means no moment
  // where an installer is formally on a Pending job.
  let removed: Array<{ user_id: string; is_sub_installer: boolean }> = []
  if (postponing) {
    const { data: crew } = await supabase.from('job_assignees')
      .select('user_id, is_sub_installer').eq('job_id', jobId).eq('is_suggestion', false) as
      { data: Array<{ user_id: string; is_sub_installer: boolean }> | null }
    removed = crew ?? []
    const { error: delErr } = await supabase.from('job_assignees').delete().eq('job_id', jobId)
    if (delErr) return NextResponse.json({ error: 'not_permitted' }, { status: 403 })
    // Outside contractors come off too — their /ext link would otherwise
    // show a job with no date.
    await supabase.from('job_external_contacts').delete().eq('job_id', jobId).eq('is_suggestion', false)
  }

  // .select('id'): an UPDATE filtered by RLS is not an error (the trap this
  // repo has shipped four times).
  const { data: updated } = await supabase.from('jobs').update(patch as never)
    .eq('id', jobId).select('id').throwOnError()
  if (!updated?.length) return NextResponse.json({ error: 'not_permitted' }, { status: 403 })

  if (postponing && removed.length) {
    const todayISO = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' })
    const now = postponeNotifyNow(job.date, todayISO)
    if (now) {
      try {
        const { data: users } = await supabase.from('users').select('id, telegram_chat_id')
          .in('id', removed.map(r => r.user_id)).is('deleted_at', null) as
          { data: Array<{ id: string; telegram_chat_id: string | null }> | null }
        const text = tplJobPostponed({ projectTitle: job.project_title, jobClient: job.client,
          oldDate: job.date!, location: job.location, jobUrl: `${APP_URL}/jobs/${jobId}` })
        await Promise.all((users ?? []).filter(u => u.telegram_chat_id)
          .map(u => sendTelegram(u.telegram_chat_id!, text)))
      } catch (err) {
        // The move already happened — log, don't undo (Design Load B3 lesson).
        console.error('[jobs/stage] postpone notify failed', err)
      }
    }
    await recordCrewChange(jobId,
      removed.map(r => ({ userId: r.user_id, action: 'removed' as const, asSupport: r.is_sub_installer })),
      profile.id, now)
  }

  return NextResponse.json({ ok: true, status: patch.status })
}
```

- [ ] **Step 2: `/submit` needs a date.** In `submit/route.ts`, select `status, date` (not just `status`), widen `StatusRow` to `{ status: string; date: string | null }`, and after the `completed` guard add:

```ts
  // A Pending job may have no date; the schedule needs one (spec 2026-10-09).
  // The DB check constraint would refuse it anyway — this gives a clear reason.
  if (!newDate && !current.date) {
    return NextResponse.json({ error: 'date_required' }, { status: 422 })
  }
```

- [ ] **Step 3: Crew guards.** In each of `assign-installers`, `sub-installers`, `crew` and `external-contacts` (POST, formal branch only, where `is_suggestion: false` is written), after the job has been loaded (add `status` to its select where missing), add:

```ts
  // No formal crew on a Pending job: crew is confirmed once it is on the
  // schedule, so an installer can never see a Pending job (spec 2026-10-09).
  if (!formalCrewAllowed(<job>.status)) {
    return NextResponse.json({ error: 'Crew is confirmed once the job is on the schedule.' }, { status: 409 })
  }
```

  `suggest-installer` is NOT guarded: suggestions stay allowed.

- [ ] **Step 4: Designer guard.** In `designers/route.ts` POST, load `status` with the job and add:

```ts
  if (!designersAllowed(job.status)) {
    return NextResponse.json({ error: 'Designers can be added once the job is Pending.' }, { status: 409 })
  }
```

- [ ] **Step 5: Verify.** Run `npm run type-check` and all suites. Then run a real-row check script in the scratchpad (not committed), using `.env.local` and the service key the same way as the Bin check of 2026-09-28: insert a throwaway job `{ status: 'awaiting_date', date: null, client: 'ZZ test', location: 'x' }` → succeeds; update it to `{ status: 'scheduled' }` with date still null → **refused** by `jobs_date_required_when_scheduled`; delete it. Print each result. Expected: insert ok, update error code `23514`, delete ok.

- [ ] **Step 6: Commit** (`feat(stages): stage-move route; push needs a date; crew and designer guards`).

---

### Task 7: Queries — stage jobs, Design board carries status

**Files:**
- Modify: `src/lib/supabase/queries/jobs.ts` (add `StageJob`, `getStageJobs`)
- Modify: `src/lib/supabase/queries/design-load.ts` (`DesignLoadJob` + select + filter)

**Interfaces:**
- Produces:

```ts
export type StageJob = {
  id: string; status: JobStatus; date: string | null; date_end: string | null
  project_title: string | null; client: string; location: string
  created_by: string | null; sales_poc_id: string | null; created_at: string
  coordinatorIds: string[]; designerNames: string[]
}
export async function getStageJobs(statuses: JobStatus[]): Promise<StageJob[]>
```

  `DesignLoadJob` gains `status: JobStatus`.

- [ ] **Step 1: Implement `getStageJobs`** (append to `queries/jobs.ts`):

```ts
// Drafts / Pending lists and the My Jobs panel (spec 2026-10-09). The date
// may be null, which is why this is its own type rather than ScheduleJob.
// Visibility is RLS's job: other people's drafts never come back (0062).
// Designer names come from a follow-up query — never embed users onto jobs
// in a PostgREST select (standing rule, broke twice).
export async function getStageJobs(statuses: JobStatus[]): Promise<StageJob[]> {
  const supabase = await createClient()
  type Row = Omit<StageJob, 'coordinatorIds' | 'designerNames'> & {
    job_coordinators: Array<{ user_id: string }>
    job_designers:    Array<{ user_id: string }>
  }
  const { data, error } = await supabase.from('jobs')
    .select('id, status, date, date_end, project_title, client, location, created_by, sales_poc_id, created_at, job_coordinators(user_id), job_designers(user_id)')
    .in('status', statuses) // raw status — see job-stage.ts
    .order('created_at', { ascending: false })
  if (error) throw error
  const rows = (data ?? []) as unknown as Row[]
  const designerIds = [...new Set(rows.flatMap(r => r.job_designers.map(d => d.user_id)))]
  const names = new Map<string, string>()
  if (designerIds.length) {
    const { data: us } = await supabase.from('users').select('id, name').in('id', designerIds) as
      { data: Array<{ id: string; name: string }> | null }
    for (const u of us ?? []) names.set(u.id, u.name)
  }
  return rows.map(({ job_coordinators, job_designers, ...r }) => ({
    ...r,
    coordinatorIds: job_coordinators.map(c => c.user_id),
    designerNames:  job_designers.map(d => names.get(d.user_id)).filter((n): n is string => !!n),
  }))
}
```

- [ ] **Step 2: Design board.** In `design-load.ts`, add `status: JobStatus` to `DesignLoadJob`, select `status` in the jobs embed (line ~59 already selects it for `MyDesignJob`; make sure the board's select includes it too), set `status: job.status` in the mapper (line ~91), and in the filter (line ~118) also drop Drafts: `&& stageOf(r.jobs.status) !== 'draft'`. Comment: `// a designer on a Draft cannot see it (0062); the board must not show the office one either`.

- [ ] **Step 3: Verify.** `npm run type-check`; all suites.

- [ ] **Step 4: Commit** (`feat(stages): stage-jobs query; Design board knows the stage`).

---

### Task 8: My Jobs rule

**Files:**
- Create: `src/lib/utils/my-jobs.ts`; Test: `src/lib/utils/my-jobs.test.ts`

**Interfaces:**
- Consumes: `stageOf`, `Stage` (T1). Input shape: `Pick<StageJob, 'id' | 'status' | 'date' | 'created_by' | 'sales_poc_id' | 'coordinatorIds' | 'project_title' | 'client'>`.
- Produces: `type MyJobsGroups = { draft: T[]; pending: T[]; scheduled: T[] }`; `myJobs<T extends MyJobInput>(jobs: T[], userId: string): MyJobsGroups<T>`.

- [ ] **Step 1: Failing test**

```ts
/**
 * Run: npx tsx src/lib/utils/my-jobs.test.ts
 */
import { myJobs } from './my-jobs'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`); failures++ }
}
const ME = 'u-me', OTHER = 'u-other'
const j = (id: string, status: string, date: string | null, o: Partial<{ created_by: string; sales_poc_id: string; coordinatorIds: string[] }> = {}) => ({
  id, status, date, project_title: id, client: 'C',
  created_by: o.created_by ?? OTHER, sales_poc_id: o.sales_poc_id ?? OTHER, coordinatorIds: o.coordinatorIds ?? [],
})
const jobs = [
  j('made-by-me',  'scheduled', '2026-10-20', { created_by: ME }),
  j('my-pic',      'scheduled', '2026-10-12', { sales_poc_id: ME }),           // Nic's screenshot: "jobs that they are PIC"
  j('coord-on',    'awaiting_date', null,     { coordinatorIds: [ME] }),
  j('dated-pend',  'awaiting_date', '2026-11-01', { created_by: ME }),
  j('my-draft',    'pending', null,           { created_by: ME }),
  j('not-mine',    'scheduled', '2026-10-10'),
  j('done',        'completed', '2026-10-01', { created_by: ME }),
]
const g = myJobs(jobs, ME)
const ids = (xs: Array<{ id: string }>) => xs.map(x => x.id)

// THE TRAP: raw 'pending' is a Draft. Grouping by raw status would put
// my-draft under Pending.
check('raw pending lands in Drafts', ids(g.draft), ['my-draft'])
check('Pending: dated first, undated last', ids(g.pending), ['dated-pend', 'coord-on'])
check('Scheduled: soonest first, creator AND PIC included', ids(g.scheduled), ['my-pic', 'made-by-me'])
check("someone else's job is not mine", [...g.draft, ...g.pending, ...g.scheduled].some(x => x.id === 'not-mine'), false)
check('completed drops off', [...g.draft, ...g.pending, ...g.scheduled].some(x => x.id === 'done'), false)

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nall my-jobs checks passed')
```

- [ ] **Step 2: Wrong stub** (group by raw `status` string). Run. Expected: FAIL on "raw pending lands in Drafts".

- [ ] **Step 3: Implement**

```ts
/**
 * The My Jobs panel's list (Nic's screenshot, 2026-10-08): jobs the viewer
 * created, is the sales PIC of, or coordinates — grouped by stage, soonest
 * first, undated last. Completed jobs drop off by themselves.
 */
import { stageOf } from './job-stage'

export type MyJobInput = {
  id: string; status: string; date: string | null
  created_by: string | null; sales_poc_id: string | null; coordinatorIds: string[]
}
export type MyJobsGroups<T> = { draft: T[]; pending: T[]; scheduled: T[] }

const byDate = (a: { date: string | null }, b: { date: string | null }) => {
  if (a.date && b.date) return a.date.localeCompare(b.date)
  if (a.date) return -1
  if (b.date) return 1
  return 0
}

export function myJobs<T extends MyJobInput>(jobs: T[], userId: string): MyJobsGroups<T> {
  const out: MyJobsGroups<T> = { draft: [], pending: [], scheduled: [] }
  for (const job of jobs) {
    const mine = job.created_by === userId || job.sales_poc_id === userId || job.coordinatorIds.includes(userId)
    if (!mine) continue
    const stage = stageOf(job.status)
    if (stage === 'completed') continue
    out[stage].push(job)
  }
  out.draft.sort(byDate); out.pending.sort(byDate); out.scheduled.sort(byDate)
  return out
}
```

Note: `Array.prototype.sort` is stable, so undated items keep their input order (newest first, from `getStageJobs`).

- [ ] **Step 4: Run.** Expected: PASS.

- [ ] **Step 5: Commit** (`feat(stages): my-jobs rule for the quick-link panel`).

---

### Task 9: Drafts and Pending tabs

**Files:**
- Create: `src/features/stages/StageListShell.tsx`, `src/app/drafts/page.tsx`, `src/app/drafts/loading.tsx`
- Modify: `src/app/pending/page.tsx`, `src/lib/navTabs.ts`
- Modify: `src/features/schedule/ScheduleShell.tsx` (remove the `'pending'` page mode), `src/lib/utils/schedule-date.ts` + its test (remove `'pending'` from `SchedulePageMode`)
- Modify: `src/lib/i18n/en.ts`, `zh.ts`

**Interfaces:**
- Consumes: `getStageJobs`, `StageJob` (T7); `stageOf` (T1).
- Produces: `<StageListShell jobs={StageJob[]} stage="draft"|"pending" lang role navRole />`; routes `/drafts` and `/pending`; query param `?highlight=<jobId>` scrolls to and rings that row (used by Task 12).

- [ ] **Step 1: i18n keys** (en; zh in brackets, add to `zh.ts`):

```ts
  navDrafts:           'Drafts',                           // 草稿
  draftsTitle:         'Drafts',                           // 草稿
  draftsSubtitle:      'Private to you, the person in charge and coordinators on the job', // 仅你、负责人和该工作的协调员可见
  pendingTitle:        'Pending',                          // 待定
  pendingSubtitle:     'Confirmed projects waiting for an install date', // 已确认、等待安装日期的项目
  dateTbcHeading:      'Date to be confirmed',             // 日期待定
  dateTbc:             'TBC',                              // 待定
  stageListEmpty:      'Nothing here yet',                 // 暂无内容
  stageDesigner:       'Designer',                         // 设计师
```

(`pendingTitle` may already exist; if so reuse it and do not duplicate the key.)

- [ ] **Step 2: Write `StageListShell.tsx`**

```tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { t as tr } from '@/lib/i18n'
import { CompanyBar } from '@/components/CompanyBar'
import { BottomNav } from '@/components/BottomNav'
import { useToast } from '@/components/Toast'
import type { StageJob } from '@/lib/supabase/queries/jobs'
import type { LangCode } from '@/lib/i18n'
import type { Role } from '@/lib/supabase/types'

/**
 * Drafts and Pending tabs (spec 2026-10-09). Plain lists, not the date strip:
 * many jobs here have no date. Drafts = newest first. Pending = dated first
 * (soonest first), then "Date to be confirmed" (newest first).
 */
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
function dayLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`
}

export function StageListShell({ jobs, stage, lang, role, navRole }: {
  jobs: StageJob[]; stage: 'draft' | 'pending'; lang: LangCode; role: Role; navRole: Role
}) {
  const router = useRouter()
  const params = useSearchParams()
  const highlight = params.get('highlight')
  const { error: showError } = useToast()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  // Bulk delete as the old Pending list had it: sales and coordinators on
  // their drafts, schedulers anywhere. Deletes go to the Bin.
  const canBulkDelete = role === 'scheduler' || (stage === 'draft' && (role === 'sales' || role === 'coordinator'))

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? jobs.filter(j => [j.project_title ?? '', j.client, j.location].join(' ').toLowerCase().includes(q)) : jobs
  }, [jobs, query])

  const dated   = stage === 'pending' ? filtered.filter(j => j.date).sort((a, b) => a.date!.localeCompare(b.date!)) : filtered
  const undated = stage === 'pending' ? filtered.filter(j => !j.date) : []

  useEffect(() => {
    if (!highlight) return
    document.getElementById(`stage-row-${highlight}`)?.scrollIntoView({ block: 'center' })
  }, [highlight])

  async function bulkDelete() {
    setBusy(true)
    try {
      const results = await Promise.all([...selected].map(id =>
        fetch(`/api/jobs/${id}`, { method: 'DELETE' }).then(r => ({ id, ok: r.ok })).catch(() => ({ id, ok: false }))))
      const failed = results.filter(r => !r.ok).map(r => r.id)
      setSelected(new Set(failed))
      if (failed.length) showError(tr(lang, 'bulkDeleteFailed').replace('{n}', String(failed.length)))
      router.refresh()
    } finally { setBusy(false) }
  }

  const row = (j: StageJob) => (
    <li key={j.id} id={`stage-row-${j.id}`}
      className={cn('flex items-center gap-3 rounded-[14px] border bg-paper px-4 py-3',
        highlight === j.id ? 'border-terracotta ring-2 ring-terracotta' : 'border-line')}>
      {canBulkDelete && (
        <input type="checkbox" checked={selected.has(j.id)} aria-label="Select"
          onChange={() => setSelected(s => { const n = new Set(s); n.has(j.id) ? n.delete(j.id) : n.add(j.id); return n })} />
      )}
      <Link href={`/jobs/${j.id}`} className="flex-1 min-w-0">
        <p className="font-display text-sm font-semibold text-ink truncate">{j.project_title || j.client || 'Untitled job'}</p>
        <p className="text-xs text-muted truncate">{j.client}</p>
        {stage === 'pending' && j.designerNames.length > 0 && (
          <p className="text-[11px] text-ink2 truncate">{tr(lang, 'stageDesigner')}: {j.designerNames.join(', ')}</p>
        )}
      </Link>
      <span className="shrink-0 text-xs text-ink2">{j.date ? dayLabel(j.date) : tr(lang, 'dateTbc')}</span>
    </li>
  )

  return (
    <div className="min-h-screen bg-bg pb-24">
      <CompanyBar lang={lang} role={role} navRole={navRole} />
      <div className="mx-auto max-w-3xl px-4 pt-4 space-y-4">
        <div>
          <h1 className="font-display text-xl text-ink">{tr(lang, stage === 'draft' ? 'draftsTitle' : 'pendingTitle')}</h1>
          <p className="text-xs text-muted">{tr(lang, stage === 'draft' ? 'draftsSubtitle' : 'pendingSubtitle')}</p>
        </div>
        <label className="flex items-center gap-2 rounded-[10px] border border-line bg-paper px-3 py-2">
          <Search size={14} className="text-muted" />
          <input value={query} onChange={e => setQuery(e.target.value)} className="flex-1 bg-transparent text-sm outline-none" placeholder="Search" />
        </label>
        {canBulkDelete && selected.size > 0 && (
          <button onClick={bulkDelete} disabled={busy}
            className="px-3 py-1.5 text-xs font-medium text-white rounded-lg bg-bad disabled:opacity-50">
            Delete {selected.size}
          </button>
        )}
        {filtered.length === 0 && <p className="text-sm text-muted py-8 text-center">{tr(lang, 'stageListEmpty')}</p>}
        <ul className="space-y-2">{dated.map(row)}</ul>
        {undated.length > 0 && (
          <>
            <h2 className="pt-2 text-[11px] uppercase tracking-widest text-muted">{tr(lang, 'dateTbcHeading')}</h2>
            <ul className="space-y-2">{undated.map(row)}</ul>
          </>
        )}
      </div>
      <div className="hidden lg:block"><BottomNav role={navRole} /></div>
    </div>
  )
}
```

Confirm `bg-bad`, `border-terracotta`, `ring-terracotta` and `ring-2` exist in the built CSS in Task 13 (bare-`var()` token lesson: **no slash opacity on theme colours**).

- [ ] **Step 3: Pages.** `src/app/drafts/page.tsx`: copy the auth/profile/role block from `src/app/pending/page.tsx` lines 10-27 verbatim. Then:

```tsx
  if (effectiveRole === 'installer') redirect('/installer')
  // Drafts are for the roles that create jobs (spec 2026-10-09).
  if (!['sales', 'coordinator', 'scheduler', 'admin'].includes(effectiveRole)) redirect('/schedule')
  const jobs = await getStageJobs(['pending', 'awaiting_approval']) // raw status — see job-stage.ts (these are DRAFTS)
  return <StageListShell jobs={jobs} stage="draft" lang={(profile.lang as LangCode) ?? 'en'} role={effectiveRole} navRole={navRole} />
```

Wrap the shell in `<Suspense>` (it uses `useSearchParams`). `loading.tsx`: copy `src/app/pending/loading.tsx`.

Rewrite `src/app/pending/page.tsx`: keep the installer redirect, **remove** the designer/production and hr redirects (they now see Pending; update the comments to say so, with the date), and render `getStageJobs(['awaiting_date'])` through `<StageListShell stage="pending" …/>`.

- [ ] **Step 4: Nav.** In `src/lib/navTabs.ts` import `FileText` from lucide and add `{ href: '/drafts', label: 'Drafts', Icon: FileText }` immediately **before** Pending for scheduler, sales, admin and coordinator. Add Pending (`/pending`, `Clock`) for designer (after Design), production (after FCFS) and hr (after Schedule). Update the hr comment ("No Pending" → "Pending read-only since 2026-10-09"). The tour anchors become `nav-drafts` and `nav-pending` automatically (`data-tour={\`nav-${href.slice(1)}\`}`).

- [ ] **Step 5: Retire the Pending page mode.** In `ScheduleShell.tsx`, change `pageMode?: 'schedule' | 'pending' | 'completed'` to `'schedule' | 'completed'`, delete the `pageMode === 'pending'` filter line (176), simplify `canBulkDelete` to `role === 'scheduler'`, and simplify the schedule filter line 175 to `if (pageMode === 'schedule' && j.status !== 'scheduled') return false // raw status — see job-stage.ts`. In `schedule-date.ts` drop `'pending'` from `SchedulePageMode` and fix its test file's expectations. A stale `gq-schedule-date:pending` sessionStorage key is harmless and is not cleaned up.

- [ ] **Step 6: Verify.** `npm run type-check`; all suites; `npm run dev`, then open `/drafts` and `/pending` as an admin. Both render, search filters, and `?highlight=<id>` rings a row.

- [ ] **Step 7: Commit** (`feat(stages): Drafts tab and the list-style Pending tab`).

---

### Task 10: New Job form — Save draft · Save as Pending · Push to Schedule

**Files:**
- Modify: `src/features/job-detail/NewJobShell.tsx` (`saveJob` line ~154; buttons ~612-642; `date` default line ~104)
- Modify: `src/features/job-detail/useRequiredFields.ts`
- Modify: `en.ts`, `zh.ts`

**Interfaces:**
- Consumes: `missingForStage`, `designersAllowed` (T2); `STAGE_STATUS` (T1).
- Produces: `useRequiredFields(...).checkForStage(stage: Stage, values): boolean` and `.checkNotClearedAtStage(stage, original, values): boolean`.

- [ ] **Step 1: Hook.** In `useRequiredFields.ts` add (keep `checkRequired`, since it means "scheduled"):

```ts
  /** The fields a move INTO `stage` needs (spec 2026-10-09). */
  const checkForStage = useCallback(
    (stage: Stage, values: FormLike): boolean => flag(missingForStage(stage, values)),
    [flag],
  )
  /** Edit form save: fields required at the job's CURRENT stage may be
   *  replaced, never emptied. A Draft requires nothing, so nothing is checked. */
  const checkNotClearedAtStage = useCallback(
    (stage: Stage, original: FormLike, values: FormLike): boolean =>
      flag(clearedForStage(stage, original, values)),
    [flag],
  )
```

  Return both. Update the file's header comment: saving a Draft is ungated, Save as Pending needs five fields, Push needs six.

- [ ] **Step 2: i18n:** `saveDraftBtn: 'Save draft'` (保存草稿), `saveAsPendingBtn: 'Save as Pending'` (保存为待定), `designersNeedPending: 'Designers can be added once the job is Pending'` (工作设为待定后才能添加设计师), `crewNeedsSchedule: 'Crew is confirmed once the job is on the schedule'` (工作排程后才确认人员), `dateRequiredToPush: 'Add the install date to push to the schedule'` (请填写安装日期后再排程).

- [ ] **Step 3: `saveJob`.** Change the signature to `saveJob(mode: 'draft' | 'pending' | 'push_to_schedule', silent = false)`. At the top, after `const values = watch()`:

```ts
    const target: Stage = mode === 'push_to_schedule' ? 'scheduled' : mode
    if (!checkForStage(target, values)) {
      showError(t(lang, 'requiredFieldsMissing'))
      return
    }
    // A designer on a Draft could not see it (spec 2026-10-09).
    if (mode === 'draft' && selectedDesignerIds.length > 0) {
      showError(t(lang, 'designersNeedPending'))
      return
    }
```

  This replaces the old `if (mode === 'push_to_schedule' && !checkRequired(values))` block. In the insert, set `status: mode === 'pending' ? STAGE_STATUS.pending : STAGE_STATUS.draft,` (push still inserts a Draft and `/submit` flips it, exactly as before), and `date: values.date || null,`. Update the insert comment to say so.

  Formal crew on Pending: when `mode === 'pending'`, insert driver and support picks as **suggestions** (`is_suggestion: true, suggested_by: userId`) whatever the role. A Pending job takes no formal crew (T6 guard), so use `const crewAsSuggestion = suggestMode || mode === 'pending'` in both inserts.

- [ ] **Step 4: Default date.** Keep `date: today` as the default. A sales person typing a Pending job without a date clears the box, and that is allowed.

- [ ] **Step 5: Buttons.** Replace the single "Save as pending" button with two, in this order, keeping the old button's classes:
  - `onClick={() => saveJob('draft')}`, label `saving ? 'Saving…' : t(lang, 'saveDraftBtn')`, border style (secondary).
  - `onClick={() => saveJob('pending')}`, label `t(lang, 'saveAsPendingBtn')`, amber style (the old pending button's classes).
  - Push buttons unchanged.

  The action row is `flex`. Add `flex-wrap` to its container so five buttons wrap on a phone rather than overflow (the 2026-09-07 action-bar lesson).

- [ ] **Step 6: Verify.** `npm run type-check`; all suites; `npm run dev`. New Job → empty form → **Save draft** succeeds and opens the job with the Draft pill. Fill five fields with no date → **Save as Pending** succeeds. With a designer picked → Save draft refuses with the message.

- [ ] **Step 7: Commit** (`feat(stages): New Job form saves Draft, Pending or pushes`).

---

### Task 11: Edit form — stage buttons, brief, designers, crew suggest mode, pill

**Files:**
- Create: `src/features/job-detail/StageActions.tsx`
- Modify: `src/features/job-detail/JobDetailShell.tsx`, `src/components/Pill.tsx`, `src/features/job-detail/ChatSection.tsx` call site (prop only), `src/app/jobs/[id]/page.tsx` (only if `created_by` is not already on `job`)

**Interfaces:**
- Consumes: `stageOf`, `Stage` (T1); `canMoveStage`, `canEditAtStage`, `missingForStage` (T2); `POST /api/jobs/[id]/stage` (T6).
- Produces: `<StageActions jobId stage canMove={(to: Stage) => boolean} onMoved={(status: string) => void} beforeMove={() => Promise<boolean>} lang />`.

- [ ] **Step 1: Pill labels.** In `Pill.tsx` add `awaiting_date` to both maps: style `'bg-brand-blue-soft text-brand-blue'`, label `'Pending'`. Change `pending`'s label to `'Draft'` and `awaiting_approval`'s to `'Draft'`, with the comment `// raw 'pending' is a private Draft — see src/lib/utils/job-stage.ts`. This also fixes the Bin's status pills (BinShell renders `Pill`), so add `'awaiting_date'` to `PILL_STATUSES` in `src/features/bin/BinShell.tsx` line 30.

- [ ] **Step 2: Write `StageActions.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { Modal } from '@/components/Modal'
import { useToast } from '@/components/Toast'
import { t, type LangCode } from '@/lib/i18n'
import type { Stage } from '@/lib/utils/job-stage'

/**
 * Stage moves on the edit form that are not Push to Schedule (spec
 * 2026-10-09): Draft → Pending, Pending → Draft, Scheduled → Pending.
 * Server-checked by /api/jobs/[id]/stage; these buttons are a convenience.
 */
export function StageActions({ jobId, stage, canMove, beforeMove, onMoved, lang }: {
  jobId: string; stage: Stage; lang: LangCode
  canMove: (to: Stage) => boolean
  /** Saves unsaved edits and checks required fields; false = stop. */
  beforeMove: (to: Stage) => Promise<boolean>
  onMoved: (status: string) => void
}) {
  const { error: showError, success: showSuccess } = useToast()
  const [busy, setBusy] = useState(false)
  const [confirmPostpone, setConfirmPostpone] = useState(false)

  async function move(to: Stage) {
    if (!(await beforeMove(to))) return
    setBusy(true)
    try {
      const res = await fetch(`/api/jobs/${jobId}/stage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to }),
      })
      const data = await res.json().catch(() => ({})) as { status?: string; error?: string }
      if (!res.ok || !data.status) {
        showError(data.error === 'missing_fields' ? t(lang, 'requiredFieldsMissing')
          : data.error === 'not_permitted' ? t(lang, 'saveBlocked') : t(lang, 'saveError'))
        return
      }
      onMoved(data.status)
      showSuccess(t(lang, 'savedSuccessfully'))
    } finally { setBusy(false); setConfirmPostpone(false) }
  }

  const btn = 'flex-1 flex items-center justify-center px-4 py-2.5 rounded-[10px] border border-line bg-paper text-sm font-medium text-ink2 hover:bg-bg disabled:opacity-40'
  return (
    <div className="flex flex-wrap gap-2">
      {stage === 'draft' && canMove('pending') && (
        <button type="button" className={btn} disabled={busy} onClick={() => move('pending')}>{t(lang, 'saveAsPendingBtn')}</button>
      )}
      {stage === 'pending' && canMove('draft') && (
        <button type="button" className={btn} disabled={busy} onClick={() => move('draft')}>{t(lang, 'moveBackToDrafts')}</button>
      )}
      {stage === 'scheduled' && canMove('pending') && (
        <button type="button" className={btn} disabled={busy} onClick={() => setConfirmPostpone(true)}>{t(lang, 'moveBackToPending')}</button>
      )}
      <Modal isOpen={confirmPostpone} onClose={() => setConfirmPostpone(false)}>
        <div className="space-y-4 p-1">
          <p className="font-display text-lg text-ink">{t(lang, 'moveBackToPending')}</p>
          <p className="text-sm text-ink2">{t(lang, 'postponeConfirmBody')}</p>
          <div className="flex gap-2">
            <button type="button" className={btn} onClick={() => setConfirmPostpone(false)}>{t(lang, 'cancel')}</button>
            <button type="button" disabled={busy} onClick={() => move('pending')}
              className="flex-1 px-4 py-2.5 rounded-[10px] bg-terracotta text-white text-sm font-semibold disabled:opacity-40">
              {t(lang, 'moveBackToPending')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
```

  Check `Modal`'s real import path, prop names and `useToast`'s `success` name against `src/components/` before using them, and adjust to match. i18n: `moveBackToDrafts: 'Move back to Drafts'` (移回草稿), `moveBackToPending: 'Move back to Pending'` (移回待定), `postponeConfirmBody: 'This clears the install date and takes the crew off. The designer keeps working.'` (这将清除安装日期并移除人员。设计师继续工作。). Use the existing `cancel` key if there is one; otherwise add it.

- [ ] **Step 3: Wire into `JobDetailShell.tsx`.**
  - `const stage = stageOf(status)` beside `completed` (line ~192).
  - `const stageRulesJob = { status, created_by: job.created_by ?? null, sales_poc_id: job.sales_poc_id ?? null, coordinatorIds: initialCoordinatorIds }` and `const viewer = { id: userId, role }`.
  - Read-only for non-editors of a Pending job: `const formReadOnly = readOnly || isReadOnlyRole || (stage === 'pending' && !canEditAtStage(viewer, stageRulesJob))`.
  - `onSubmit` (line ~598): replace `checkNotCleared(defaultValues ?? {}, values)` with `checkNotClearedAtStage(stage, defaultValues ?? {}, values)`.
  - `handlePushToSchedule` (line ~911): the existing `checkRequired` stays (it means "scheduled"). Pass `pushDate || null` into `saveDesignBriefFields`.
  - `saveValues`: `date: values.date || null`.
  - `canAssign` (line ~172): `const canAssign = role === 'scheduler' && stage !== 'pending'`. Add `const schedulerCanSuggest = role === 'scheduler' && stage === 'pending'` and OR it into every `salesCanSuggest || coordinatorCanSuggest` expression (lines ~1231, 1263, 1309, 1578). Under the crew pickers, when `stage === 'pending'`, render `<p className="text-xs text-muted">{t(lang, 'crewNeedsSchedule')}</p>`.
  - Designers picker: when `stage === 'draft'`, render it read-only with `t(lang, 'designersNeedPending')` as its note (find the Designers card by searching `designer` near `canEditCore`).
  - `preScheduleLocked={stage === 'draft' || stage === 'pending'}` (line ~1641).
  - `showDelete` (line ~1038): `(['sales', 'coordinator'].includes(role) && stage !== 'scheduled' && stage !== 'completed') || role === 'scheduler'`.
  - `pendingPicHandover` (job-form-rules) already keys off raw `pending`/`awaiting_approval` = Drafts. Leave it as is.
  - Mount `<StageActions>` directly **above** the existing action bar's `<div className="flex gap-2">` (inside the same non-installer, non-designer branch), passing:
    - `canMove={to => canMoveStage(viewer, stageRulesJob, to)}`
    - `beforeMove`: for `to === 'pending'` it runs `checkForStage('pending', getValues())`, and when the form is dirty it awaits `handleSubmit(onSubmit)()` first; for other targets it just saves when dirty. Return false on any failure.
    - `onMoved={s => { setStatus(s as JobStatus); if (s === 'awaiting_date' && stage === 'scheduled') setValue('date', ''); router.refresh() }}`
  - The sales/coordinator bar's branch condition `status !== 'scheduled'` (line ~1808 and ~1831) means "not yet scheduled". Rewrite it as `stage !== 'scheduled'` so Pending jobs get Save + Push like drafts did.

- [ ] **Step 4: Verify.** `npm run type-check`; all suites; `npm run dev` as admin:
  - A Draft shows "Save as Pending". It refuses with five empty fields and succeeds when they are filled.
  - The brief unlocks on Pending.
  - The Designers picker is locked on Draft.
  - "Move back to Drafts" works.
  - Push from Pending without a date shows the required-field message on Date.
  - Scheduled → "Move back to Pending" asks first, then clears the date and the crew.

- [ ] **Step 5: Commit** (`feat(stages): edit form stage buttons, brief and crew rules per stage`).

---

### Task 12: Design board tag + My Jobs panel

**Files:**
- Modify: `src/features/design-load/DesignerBar.tsx` (`JobCardContent`, lines ~95-115)
- Create: `src/features/schedule/MyJobsPanel.tsx`
- Modify: `src/features/schedule/ScheduleShell.tsx`, `src/app/schedule/page.tsx`
- Modify: `en.ts`, `zh.ts`

**Interfaces:**
- Consumes: `DesignLoadJob.status` (T7); `myJobs` (T8); `getStageJobs` (T7); ScheduleShell's `setSelectedDate` (line 95).
- Produces: `<MyJobsPanel jobs={StageJob[]} userId lang onPickDate={(iso: string) => void} />`; ScheduleShell props `myJobsSource?: StageJob[]`, `userId?: string`.

- [ ] **Step 1: Design board.** In `JobCardContent` render, after the client line:

```tsx
      {stageOf(job.status) === 'pending' && (
        <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-brand-blue-soft text-brand-blue">Pending</span>
      )}
```

  Change the Install line to `Install: {job.installDate ? fmtDate(job.installDate) : 'TBC'}`. `MyJobsView.bucketOf` already treats a null install date as not-past. No change there.

- [ ] **Step 2: i18n:** `myJobsTitle: 'My jobs'` (我的工作), `myJobsShow: 'Show my jobs'` (显示我的工作), `myJobsHide: 'Hide my jobs'` (隐藏我的工作), `stageDrafts: 'Drafts'` (草稿), `stagePending: 'Pending'` (待定), `stageScheduled: 'Scheduled'` (已排程), `myJobsEmpty: 'No jobs of yours yet'` (暂无你的工作).

- [ ] **Step 3: Write `MyJobsPanel.tsx`**

```tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { t, type LangCode } from '@/lib/i18n'
import { myJobs } from '@/lib/utils/my-jobs'
import type { StageJob } from '@/lib/supabase/queries/jobs'

/**
 * My Jobs quick links (Nic's screenshot, 2026-10-08). Tapping a row never
 * opens the job: a scheduled one moves the schedule to its date, a draft or
 * pending one opens that tab with the row highlighted.
 *
 * Open/closed is a per-device setting (localStorage), read AFTER mount —
 * /schedule is hydration-sensitive (#418), so the first render must match the
 * server's: closed on the server, then restored.
 */
const KEY = 'gq-my-jobs-open'
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const label = (iso: string | null, tbc: string) => {
  if (!iso) return tbc
  const d = new Date(`${iso}T00:00:00`)
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`
}

export function MyJobsPanel({ jobs, userId, lang, onPickDate }: {
  jobs: StageJob[]; userId: string; lang: LangCode; onPickDate: (iso: string) => void
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)          // server render: closed
  const [isDesktop, setIsDesktop] = useState(false)
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)').matches
    setIsDesktop(desktop)
    let saved: string | null = null
    try { saved = localStorage.getItem(KEY) } catch { /* private window */ }
    // Phone: hidden by default (spec). PC: remembered, open the first time.
    setOpen(desktop ? saved !== 'closed' : false)
  }, [])
  const toggle = (next: boolean) => {
    setOpen(next)
    if (isDesktop) { try { localStorage.setItem(KEY, next ? 'open' : 'closed') } catch { /* ignore */ } }
  }

  const groups = useMemo(() => myJobs(jobs, userId), [jobs, userId])
  const total = groups.draft.length + groups.pending.length + groups.scheduled.length

  const pick = (j: StageJob, stage: 'draft' | 'pending' | 'scheduled') => {
    if (stage === 'scheduled' && j.date) { onPickDate(j.date); if (!isDesktop) toggle(false); return }
    router.push(`/${stage === 'draft' ? 'drafts' : 'pending'}?highlight=${j.id}`)
  }

  const section = (title: string, list: StageJob[], stage: 'draft' | 'pending' | 'scheduled') =>
    list.length === 0 ? null : (
      <div key={stage}>
        <h3 className="px-3 pt-3 pb-1 text-[10px] uppercase tracking-widest text-muted">{title} · {list.length}</h3>
        <ul>
          {list.map(j => (
            <li key={`${stage}-${j.id}`}>
              <button type="button" onClick={() => pick(j, stage)}
                className="w-full text-left px-3 py-2 hover:bg-bg rounded-lg">
                <span className="block text-[11px] text-ink2">{label(j.date, t(lang, 'dateTbc'))}</span>
                <span className="block text-sm font-medium text-ink truncate">{j.project_title || j.client || 'Untitled job'}</span>
                <span className="block text-xs text-muted truncate">{j.client}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    )

  return (
    <>
      {/* The arrow tab. Fixed on the right edge, above the bottom nav. */}
      <button type="button" onClick={() => toggle(!open)}
        aria-label={t(lang, open ? 'myJobsHide' : 'myJobsShow')}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-[60] rounded-l-lg border border-r-0 border-line bg-paper px-1 py-3 text-ink2 shadow">
        {open ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
      {open && (
        <aside
          className={cn(
            'fixed right-0 z-[60] w-72 max-w-[85vw] bg-paper border-l border-line overflow-y-auto',
            'top-0 h-dvh lg:top-14 lg:h-[calc(100dvh-3.5rem)] shadow-xl lg:shadow-none',
          )}>
          <div className="flex items-center justify-between px-3 py-3 border-b border-line">
            <h2 className="font-display text-sm font-semibold text-ink">{t(lang, 'myJobsTitle')}</h2>
            <button type="button" onClick={() => toggle(false)} aria-label={t(lang, 'myJobsHide')} className="p-1 text-muted"><X size={14} /></button>
          </div>
          {total === 0 && <p className="px-3 py-6 text-sm text-muted">{t(lang, 'myJobsEmpty')}</p>}
          {section(t(lang, 'stageDrafts'), groups.draft, 'draft')}
          {section(t(lang, 'stagePending'), groups.pending, 'pending')}
          {section(t(lang, 'stageScheduled'), groups.scheduled, 'scheduled')}
        </aside>
      )}
    </>
  )
}
```

  On PC the open panel overlays the right edge of the schedule. Give ScheduleShell's main content `lg:pr-72` while the panel is open, through an `onOpenChange` callback prop (add `onOpenChange?: (open: boolean) => void`, called from `toggle` and from the mount effect), so nothing is hidden underneath it. Check `top-14` against the real CompanyBar height in the browser and adjust.

- [ ] **Step 4: Mount it.** `src/app/schedule/page.tsx`: select `id, role, lang` in the profile query. Add `getStageJobs(['pending', 'awaiting_approval', 'awaiting_date', 'scheduled'])` to the `Promise.all` **only when** `['sales', 'coordinator', 'scheduler'].includes(effectiveRole)` (otherwise `[]`). Pass `myJobsSource={…}` and `userId={profile.id}`. In `ScheduleShell`, render `{pageMode === 'schedule' && userId && myJobsSource && <MyJobsPanel jobs={myJobsSource} userId={userId} lang={lang} onPickDate={setSelectedDate} onOpenChange={setPanelOpen} />}` just before the BottomNav wrapper, and add `className={cn(panelOpen && 'lg:pr-72')}` to the outer content wrapper.

- [ ] **Step 5: Verify.** `npm run type-check`; all suites; `npm run dev` as admin (who resolves to scheduler):
  - The arrow shows; the panel opens; its state is remembered after a reload on desktop width.
  - A scheduled row moves the date strip in List, Drivers, Week and Month.
  - A draft row opens `/drafts` with that row ringed.
  - At 390px width: the panel starts hidden, opens over the bottom nav, and the page has no sideways scroll.
  - A hard reload of `/schedule` gives no hydration warning in the console.

- [ ] **Step 6: Commit** (`feat(stages): My Jobs panel on the schedule; Pending tag on the Design board`).

---

### Task 13: Copy, tour, assistant wording, and full verification

**Files:**
- Modify: `src/lib/i18n/en.ts`, `zh.ts`, `bn.ts` (tour keys only), `src/features/tour/steps/sales.ts`, `coordinator.ts`, `src/lib/ai/tool-schemas.ts`
- Test: the existing tour validation suite (find it with `git ls-files '*tour*test*'`)

- [ ] **Step 1: Tour copy** (en / zh / bn):
  - `tourPendingTitle`: 'Your Pending tab' / '待定标签' / 'আপনার পেন্ডিং ট্যাব'
  - `tourPendingBody`: 'Confirmed projects waiting for an install date. The whole office can see them, and designers can start work.' / '已确认、等待安装日期的项目。全公司可见，设计师可以开始工作。' / 'নিশ্চিত প্রকল্প যেগুলোর ইনস্টল তারিখ বাকি। পুরো অফিস দেখতে পায়, ডিজাইনাররা কাজ শুরু করতে পারেন।'
  - new `tourDraftsTitle`: 'Your Drafts' / '你的草稿' / 'আপনার ড্রাফট'
  - new `tourDraftsBody`: 'Your notepad. Save any job here half-finished. Only you, the person in charge and its coordinators can see it.' / '你的记事本。未完成的工作可以先存在这里，只有你、负责人和协调员可见。' / 'আপনার নোটপ্যাড। অসম্পূর্ণ কাজ এখানে রাখুন। শুধু আপনি, দায়িত্বপ্রাপ্ত ব্যক্তি ও কোঅর্ডিনেটর দেখতে পান।'
  - `tourJobActionsBody`: 'Save draft keeps it private. Save as Pending shares it with the office while the date is open. Push to Schedule makes it live and notifies the schedulers.' (+ zh: '保存草稿仅自己可见；保存为待定会在日期未定时与全公司共享；排程后正式上线并通知排程员。', + bn: 'ড্রাফট সেভ করলে শুধু আপনার কাছে থাকে। পেন্ডিং হিসেবে সেভ করলে তারিখ ঠিক না হওয়া পর্যন্ত অফিস দেখতে পায়। শিডিউলে পাঠালে এটি চালু হয় এবং শিডিউলারদের জানানো হয়।')
  - `tourCoordPendingTitle` / `Body`: 'Pending jobs' / 'Confirmed projects waiting for a date, visible to the whole office.' (+ zh '待定工作' / '已确认、等待日期的项目，全公司可见。', + bn 'পেন্ডিং কাজ' / 'তারিখের অপেক্ষায় থাকা নিশ্চিত প্রকল্প, পুরো অফিস দেখতে পায়।')
  - Add a step `{ id: 'drafts', before: 'open-nav-drawer', targets: ['nav-drafts'], titleKey: 'tourDraftsTitle', bodyKey: 'tourDraftsBody' }` immediately before the `pending` step in both `sales.ts` and `coordinator.ts` (the coordinator can reuse the same keys).

  Bengali is written here under the tour's scoped exception (Nic, 2026-09-03). Flag it to Nic as unvetted, like the rest of the tour's bn.

- [ ] **Step 2: Assistant wording.** In `tool-schemas.ts`, `create_pending_job.description`: replace "in pending status" with "as a private draft", and "saved as pending for the user to review" with "saved as a draft (only the user and its sharers can see it) for them to review". **Keep the tool name.** In `en.ts`, `assistantJobCreated: 'Draft job created'` (zh: '已创建草稿工作'). Behaviour is unchanged: it inserts raw `pending`, which is a Draft.

- [ ] **Step 3: Run the tour validation suite and all suites.** Expected: no output from the all-suites loop.

- [ ] **Step 4: Production build.** `npm run build`. Expected: success. Then confirm the new utilities exist in the built CSS: `grep -o "lg\\\\:pr-72\|ring-terracotta\|bg-bad{\|z-\\\\\[60\\\\\]\|h-dvh" .next/static/css/*.css | sort -u`. Each must appear. (Lesson from `bg-green`: classes that don't compile fail silently.)

- [ ] **Step 5: Real-row verification script** (scratchpad, not committed; service key from `.env.local`; prints each line):
  1. Count jobs with `status in ('pending','awaiting_approval')`, and compare with the count taken before Task 3 (record that first count in your notes during Task 3 Step 4). **Must be equal**: no draft moved.
  2. Insert a throwaway `awaiting_date` job with no date and one `job_designers` row → ok.
  3. Move it to the Bin via `moveJobToBin` → ok. Restore via the `restore_job_snapshot` RPC → the job is back with `date` null and `status` `awaiting_date`.
  4. Purge the bin row and delete the job. Expected: every line ok.

- [ ] **Step 6: Commit** (`feat(stages): tour, assistant wording and copy for Drafts and Pending`).

---

## Release (after Task 13; each step on Nic's word)

**Shared-database window (final review #9, 2026-10-09).** From the moment 0064/0065 are applied until `main` ships, today's production code reads anything the preview creates. Old production shows `awaiting_date` jobs on the schedule as if they were scheduled, its crew routes have no Pending guard, and its 6pm cron crashes on a job with no date. So:
- Applying the migrations, the preview check, dev and main happen **in one evening**.
- Test Scheduled → Pending **only on jobs with no crew**.
- **Delete every test Pending job before 6pm SGT.**

1. Ask Nic before pushing. Push `feat-job-stages` → branch preview `greenqubes-ops-git-feat-job-stages-greenqubes-projects.vercel.app`. Verify `/api/version` matches the commit hash. Give Nic the URL.
2. **Nic's real-login checks on the preview** (the database is shared and the migrations are already applied):
   - From his sales login, a colleague's draft is not under Drafts.
   - A designer login sees a Pending job and can edit its brief.
   - An HR login sees Pending read-only.
   - An installer login sees no Drafts or Pending tab, and `/pending` redirects.
3. Merge to `dev` → dev preview → Nic checks.
4. `main` only on Nic's explicit "push to main". Production probes: login 200, `/drafts` and `/pending` 307 signed-out, `sin1`. Release time from `x-vercel-id`, **probed after** the deploy lands.
5. Changelog entry (CLAUDE.md step 4): `headsUp` — "Your unfinished jobs are now in a new Drafts tab, private to you. Pending is now for confirmed projects waiting for a date, and the whole office can see it." `added` — "Drafts tab for jobs you are still working on", "Designers can start on Pending jobs before the install date is set", "My jobs panel on the schedule, to jump to any of your jobs".
6. Nic tells the team in the group chat: everything they had in Pending is now under Drafts, and they move the confirmed ones to Pending themselves.
