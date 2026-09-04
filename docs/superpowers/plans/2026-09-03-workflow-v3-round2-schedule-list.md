# Workflow V3 Round 2 — Schedule List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/schedule` into the one job page: pending-is-personal RLS (migration 0052), filter chips + `/pending`/`/completed` retirement, project folding with folder headers, the completed veil, the sort & filter dropdown, "Day x / y" labels, and bulk bars that follow the active chip.

**Architecture:** Migration 0052 rewrites the two `jobs` SELECT policies so pending rows are personal at the DB layer (owner + assigned coordinators + admin + scheduler — the scheduler is Nic's 2026-09-03 ruling: their *screens* hide pending, but the "Notify Scheduler" clash Telegram link must still open the one flagged job; the schedule page strips pending server-side for them). All list logic that can be pure lives in a new tested `schedule-list.ts` (chips, sort, filters, folder grouping, day counter); `ScheduleShell` swaps its `pageMode` status gate for a chip pipeline and `ListView` renders the grouped day items. `/pending` dies as a redirect; `/completed` stays alive **for installers only** (their nav's Completed list — InstallerShell has no completed tab) and redirects office roles.

**Tech Stack:** Next.js 15 App Router, Supabase (Postgres RLS), Tailwind + repo tokens, standalone `npx tsx` test files (no framework).

**Spec:** `docs/superpowers/specs/2026-09-02-workflow-v3-nesting-design.md` §6 (+ §12 gate, §13 round 2). Read it first. Nic's 2026-09-03 ruling amends §6: scheduler keeps DB-level pending SELECT for the Notify-Scheduler link; every scheduler *screen* still shows no pending.

> **⚠️ STALE MIGRATION NUMBER + HR interplay (added 2026-09-04, hr-leave brainstorm):** This plan predates two things. (1) `dev`'s provisioning overhaul already took **0052** (applied to the shared DB) — renumber this plan's migration to the next free number at build time (0054 if `feat-hr-leave`'s 0053 has landed first). (2) The **HR/Finance role + leave** feature (`feat-hr-leave`, spec `2026-09-04-hr-leave-design.md`) may merge before this round: its `hr` role must be carried into the rewritten `jobs` SELECT policies below (hr = non-pending read-only, never pending), and its "On leave" / public-holiday lines on the schedule list must be **re-carried** into the rebuilt ListView during this round or the V3 merge.

## Global Constraints

- Branch: `feat-workflow-v3` (worktree `c:\Greenqubes_GitHub\greenqubes-ops-workflow-v3`); never touch `feat-workflow-v2`, never push `origin dev`/`origin main`; pushing `feat-workflow-v3` is allowed. Commit after every task.
- No new npm dependencies. Stack is locked.
- i18n: new user-facing strings go in `src/lib/i18n/en.ts` + `zh.ts` ONLY, keep the `jp` key prefix (assistant owns the bare `project*` keys); bn frozen, falls back per-key. Date labels always English; "Day 1 / 3" stays English in zh too (numeric label, same rule as dates).
- localStorage reads only in a mount `useEffect` (the /schedule hydration-#418 rule — copy `useCardCollapse.ts`). No `toLocale*` calls in render paths on this page.
- Overlays layer above BottomNav: scrim `z-[60]`, panel `z-[70]` (copy `JumpCalendar.tsx`).
- Never embed `users` directly onto `jobs` (PGRST201). Embedding `job_projects` onto `jobs` is fine (single FK).
- Tests: standalone scripts, `check()` pattern, exit 1 on failure, run `npx tsx <file>` (copy `src/lib/utils/date-ranges.test.ts`).
- Files < 500 lines target. `ScheduleShell.tsx` is 454 lines already — new UI goes in NEW files.
- **Migration 0052 is applied to the SHARED DB (prod uses it too).** It changes visibility behaviour on production immediately: sales see only their own pending jobs, designers/production see none. No crash risk (no schema change the deployed code reads), but Nic must OK the `npx supabase db push` explicitly, and it must be applied BEFORE his preview smoke test (the §12 pending-leak gate tests RLS truth, and without it the Pending chip would leak other sales' jobs).
- Round-1 helpers to reuse, not re-write: `mergeDateRanges`/`formatRanges` (`src/lib/utils/date-ranges.ts`), `chipsForRole`-style role lists in `src/app/api/projects/[id]/push/route.ts` (`MANAGER_ROLES`), `useLiveChannel`.

---

### Task 1: Migration 0052 — pending is personal + `job_projects` realtime; spec amendment

**Files:**
- Create: `supabase/migrations/0052_pending_visibility.sql`
- Modify: `docs/superpowers/specs/2026-09-02-workflow-v3-nesting-design.md` (§6 — append the scheduler ruling)

**Interfaces:**
- Consumes: `get_my_role()` (0002 L22), `job_coordinators` (0029), `jobs.created_by` (0050), `job_assignees.is_suggestion` (0033-era).
- Produces: two replacement `jobs` SELECT policies; `job_projects` in the `supabase_realtime` publication. No schema change — deployed dev/main code keeps working (behaviour tightens only).

- [ ] **Step 1: Write the migration**

```sql
-- 0052_pending_visibility.sql
-- Workflow V3 round 2 (spec §6): pending is personal. A pending (or legacy
-- awaiting_approval) job is visible only to its owner (sales POC / creator),
-- the coordinators assigned via job_coordinators, admin, and the scheduler.
-- Scheduler kept by Nic's ruling (2026-09-03): scheduler SCREENS never show
-- pending (the schedule page strips them server-side), but the
-- "Notify Scheduler" clash Telegram links to a pending job and must open.
-- Installers lose the (theoretical) formally-assigned-pending read too.
-- Replaces BOTH live jobs SELECT policies (0034 blanket office read,
-- 0037 role-or-assignment). Subquery style copied from 0037 — proven safe.

drop policy "jobs: sales and scheduler see all" on jobs;
drop policy "jobs: select by role or assignment" on jobs;

create policy "jobs: non-pending by role or assignment"
  on jobs for select to authenticated
  using (
    status not in ('pending', 'awaiting_approval')
    and (
      get_my_role() in ('sales', 'scheduler', 'admin', 'designer', 'coordinator', 'production')
      or auth.uid() in (
        select u.auth_id from users u
        join job_assignees ja on ja.user_id = u.id
        where ja.job_id = jobs.id
          and ja.is_suggestion = false
      )
    )
  );

create policy "jobs: pending personal"
  on jobs for select to authenticated
  using (
    status in ('pending', 'awaiting_approval')
    and (
      get_my_role() in ('admin', 'scheduler')
      or (
        get_my_role() in ('sales', 'coordinator')
        and auth.uid() in (
          select u.auth_id from users u
          where u.id = jobs.sales_poc_id or u.id = jobs.created_by
          union
          select u.auth_id from users u
          join job_coordinators jc on jc.user_id = u.id
          where jc.job_id = jobs.id
        )
      )
    )
  );

-- Live folder headers: project renames / timing edits reach open schedule
-- pages (0043 pattern).
alter table job_projects replica identity full;
alter publication supabase_realtime add table job_projects;
```

- [ ] **Step 2: Amend the spec** — in `2026-09-02-workflow-v3-nesting-design.md` §6, directly after the sentence ending "the UI hiding is on top.", insert:

```markdown
**Ruling (Nic, 2026-09-03):** the scheduler is privileged at the DB layer like
admin — the "Notify Scheduler" clash flow Telegrams schedulers a link to a job
that stays pending, and that link must open. Scheduler *screens* still show no
Pending chip and no pending rows (the schedule page strips pending rows
server-side for schedulers before they reach the browser).
```

- [ ] **Step 3: Verify**

Run: `npx supabase db push --dry-run`
Expected: exactly `0052_pending_visibility.sql` listed as pending. **Do NOT apply** — Nic (or the controller with Nic's explicit OK) applies it before the preview smoke.
Run: `npm run type-check` → PASS (nothing changed in TS).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0052_pending_visibility.sql docs/superpowers/specs/2026-09-02-workflow-v3-nesting-design.md
git commit -m "feat(v3): migration 0052 — pending is personal (RLS) + job_projects realtime; spec ruling noted"
```

---

### Task 2: Pure schedule-list helpers — TDD

**Files:**
- Create: `src/lib/utils/schedule-list.ts`
- Test: `src/lib/utils/schedule-list.test.ts`

**Interfaces:**
- Produces (later tasks import these EXACT names):
  - `type ChipId = 'all' | 'scheduled' | 'pending' | 'completed'`
  - `PENDING_CHIP_ROLES: string[]` = `['sales', 'coordinator', 'admin']`
  - `chipsForRole(role: string): ChipId[]`
  - `parseChip(raw: string | undefined, role: string): ChipId`
  - `applyChip<J extends { status: string }>(jobs: J[], chip: ChipId): J[]`
  - `stripHiddenPending<J extends { status: string }>(jobs: J[], role: string): J[]`
  - `type SortId = 'time' | 'created-desc' | 'created-asc' | 'alpha-asc' | 'alpha-desc'`
  - `type ListFilters = { client: string; dateFrom: string; dateTo: string; window: '' | 'am' | 'pm' | 'allday'; installerId: string; noInstaller: boolean }`
  - `EMPTY_FILTERS: ListFilters`
  - `sortJobs<J extends SortableJob>(jobs: J[], sort: SortId): J[]` (stable, returns a new array)
  - `applyFilters<J extends FilterableJob>(jobs: J[], f: ListFilters): J[]`
  - `activeFilterCount(f: ListFilters): number`
  - `type FolderInfo = { name: string; client: string; time_start: string | null; time_end: string | null }`
  - `type FolderGroup<J> = { projectId: string; info: FolderInfo; dayJobs: J[]; projectTotal: number; doneCount: number; spans: { date: string; date_end: string | null }[]; punctuality: 'strict' | 'flexible' | 'mixed' }`
  - `type DayListItem<J> = { kind: 'job'; job: J } | { kind: 'folder'; group: FolderGroup<J> }`
  - `groupDayJobs<J extends GroupableJob>(dayJobs: J[], allJobs: J[]): DayListItem<J>[]`
  - `dayCounter(date: string, dateEnd: string | null, currentDate: string): { day: number; total: number } | null`

- [ ] **Step 1: Write the failing test** (`src/lib/utils/schedule-list.test.ts`)

```ts
/**
 * Standalone test for the V3 round-2 schedule list rules (spec §6). No framework.
 * Run: npx tsx src/lib/utils/schedule-list.test.ts — exits 1 on any failure.
 */
import {
  chipsForRole, parseChip, applyChip, stripHiddenPending,
  sortJobs, applyFilters, activeFilterCount, EMPTY_FILTERS,
  groupDayJobs, dayCounter,
} from './schedule-list'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual); const e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`); failures++ }
}

// ── chips ──
check('sales chips include Pending', chipsForRole('sales'), ['all', 'scheduled', 'pending', 'completed'])
check('coordinator chips include Pending', chipsForRole('coordinator'), ['all', 'scheduled', 'pending', 'completed'])
check('admin chips include Pending', chipsForRole('admin'), ['all', 'scheduled', 'pending', 'completed'])
check('scheduler chips have NO Pending', chipsForRole('scheduler'), ['all', 'scheduled', 'completed'])
check('designer chips have NO Pending', chipsForRole('designer'), ['all', 'scheduled', 'completed'])

check('parseChip valid', parseChip('completed', 'scheduler'), 'completed')
check('parseChip pending blocked for scheduler → all', parseChip('pending', 'scheduler'), 'all')
check('parseChip pending ok for sales', parseChip('pending', 'sales'), 'pending')
check('parseChip garbage → all', parseChip('xyz', 'sales'), 'all')
check('parseChip missing → all', parseChip(undefined, 'sales'), 'all')

const J = (id: string, status: string, extra: object = {}) => ({ id, status, ...extra })
const mix = [J('a', 'scheduled'), J('b', 'pending'), J('c', 'completed'), J('d', 'awaiting_approval')]
check('applyChip all keeps everything', applyChip(mix, 'all').map(j => j.id), ['a', 'b', 'c', 'd'])
check('applyChip scheduled', applyChip(mix, 'scheduled').map(j => j.id), ['a'])
check('applyChip pending includes legacy awaiting_approval', applyChip(mix, 'pending').map(j => j.id), ['b', 'd'])
check('applyChip completed', applyChip(mix, 'completed').map(j => j.id), ['c'])

check('stripHiddenPending removes pending for scheduler', stripHiddenPending(mix, 'scheduler').map(j => j.id), ['a', 'c'])
check('stripHiddenPending keeps pending for sales (RLS already scoped them)', stripHiddenPending(mix, 'sales').map(j => j.id), ['a', 'b', 'c', 'd'])
check('stripHiddenPending keeps for admin', stripHiddenPending(mix, 'admin').map(j => j.id), ['a', 'b', 'c', 'd'])

// ── sort ──
const S = [
  { id: '1', time_start: '14:00', created_at: '2026-09-01T02:00:00Z', project_title: 'Bravo', client: 'Zed' },
  { id: '2', time_start: null,    created_at: '2026-09-03T02:00:00Z', project_title: null,    client: 'Acme' },
  { id: '3', time_start: '09:00', created_at: '2026-09-02T02:00:00Z', project_title: 'Alpha', client: 'Mid' },
]
check('sort time: nulls last', sortJobs(S, 'time').map(j => j.id), ['3', '1', '2'])
check('sort created newest first', sortJobs(S, 'created-desc').map(j => j.id), ['2', '3', '1'])
check('sort created oldest first', sortJobs(S, 'created-asc').map(j => j.id), ['1', '3', '2'])
check('sort A–Z by title, client fallback', sortJobs(S, 'alpha-asc').map(j => j.id), ['2', '3', '1']) // Acme, Alpha, Bravo
check('sort Z–A', sortJobs(S, 'alpha-desc').map(j => j.id), ['1', '3', '2'])

// ── filters ──
const asg = (id: string, sug: boolean) => ({ is_suggestion: sug, users: { id, name: id } })
const F = [
  { id: 'f1', client: 'Acme', date: '2026-09-10', date_end: null,         time_start: '09:00', time_end: '13:00', job_assignees: [asg('u1', false)] },
  { id: 'f2', client: 'Zed',  date: '2026-09-12', date_end: '2026-09-14', time_start: '14:00', time_end: null,    job_assignees: [asg('u2', true)] },
  { id: 'f3', client: 'Acme', date: '2026-09-20', date_end: null,         time_start: null,    time_end: null,    job_assignees: [] },
]
check('filter client', applyFilters(F, { ...EMPTY_FILTERS, client: 'Acme' }).map(j => j.id), ['f1', 'f3'])
check('filter date range overlaps multi-day span', applyFilters(F, { ...EMPTY_FILTERS, dateFrom: '2026-09-13', dateTo: '2026-09-15' }).map(j => j.id), ['f2'])
check('filter AM', applyFilters(F, { ...EMPTY_FILTERS, window: 'am' }).map(j => j.id), ['f1'])
check('filter PM', applyFilters(F, { ...EMPTY_FILTERS, window: 'pm' }).map(j => j.id), ['f2'])
check('filter all-day = no start time', applyFilters(F, { ...EMPTY_FILTERS, window: 'allday' }).map(j => j.id), ['f3'])
check('installer filter matches SUGGESTED too', applyFilters(F, { ...EMPTY_FILTERS, installerId: 'u2' }).map(j => j.id), ['f2'])
check('installer filter matches assigned', applyFilters(F, { ...EMPTY_FILTERS, installerId: 'u1' }).map(j => j.id), ['f1'])
check('no-installer-yet = no FORMAL assignee (suggestion does not count)', applyFilters(F, { ...EMPTY_FILTERS, noInstaller: true }).map(j => j.id), ['f2', 'f3'])
check('empty filters count 0', activeFilterCount(EMPTY_FILTERS), 0)
check('filter count', activeFilterCount({ ...EMPTY_FILTERS, client: 'Acme', noInstaller: true, window: 'am' }), 3)

// ── folding ──
const proj = { name: 'ABC Refresh', client: 'Luxottica', time_start: '09:00', time_end: '13:00' }
const G = (id: string, project_id: string | null, extra: object = {}) => ({
  id, project_id, job_projects: project_id ? proj : null,
  status: 'scheduled', date: '2026-09-10', date_end: null,
  punctuality: 'strict' as const, ...extra,
})
const day = [G('s1', null), G('p1', 'P'), G('p2', 'P', { punctuality: 'flexible' }), G('s2', null)]
const all = [...day, G('p3', 'P', { date: '2026-09-15', status: 'completed' }), G('q1', 'Q', { date: '2026-09-11' })]
const items = groupDayJobs(day, all)
check('folder appears once, at first child position, loose jobs kept in order',
  items.map(i => (i.kind === 'folder' ? `folder:${i.group.projectId}` : i.job.id)),
  ['s1', 'folder:P', 's2'])
const fold = items[1] as { kind: 'folder'; group: ReturnType<typeof Object> } as never as { kind: 'folder'; group: { dayJobs: { id: string }[]; projectTotal: number; doneCount: number; punctuality: string; spans: unknown[]; info: { name: string } } }
check('folder holds the day\'s nested jobs', fold.group.dayJobs.map(j => j.id), ['p1', 'p2'])
check('project total counts ALL visible rows across days/status', fold.group.projectTotal, 3)
check('done count from all visible rows', fold.group.doneCount, 1)
check('punctuality mixed when the day\'s nested jobs differ', fold.group.punctuality, 'mixed')
check('spans collected from all visible rows', fold.group.spans.length, 3)
check('folder info carried', fold.group.info.name, 'ABC Refresh')
check('single-punctuality folder not mixed',
  (groupDayJobs([G('x1', 'Q'), G('x2', 'Q')], all)[0] as { group: { punctuality: string } }).group.punctuality, 'strict')

// ── day counter ──
check('single-day job → null', dayCounter('2026-09-10', null, '2026-09-10'), null)
check('multi-day, first day', dayCounter('2026-09-10', '2026-09-12', '2026-09-10'), { day: 1, total: 3 })
check('multi-day, middle day', dayCounter('2026-09-10', '2026-09-12', '2026-09-11'), { day: 2, total: 3 })
check('outside the span → null', dayCounter('2026-09-10', '2026-09-12', '2026-09-14'), null)
check('date_end before date → null (bad data)', dayCounter('2026-09-10', '2026-09-08', '2026-09-10'), null)

if (failures > 0) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nAll schedule-list checks passed')
```

- [ ] **Step 2: Run it — must fail**

Run: `npx tsx src/lib/utils/schedule-list.test.ts`
Expected: FAIL (module `./schedule-list` not found).

- [ ] **Step 3: Implement** (`src/lib/utils/schedule-list.ts`)

```ts
// Workflow V3 round 2 (spec §6): the pure rules behind the one-page schedule —
// role-gated filter chips, the pending server-side strip, list sort & filters,
// project folder grouping, and the "Day x / y" counter. UI applies these.

export type ChipId = 'all' | 'scheduled' | 'pending' | 'completed'

// Pending is personal: only these roles get the Pending chip. Admin is
// full-access by design (Nic 2026-09-02). The scheduler deliberately has NO
// chip even though RLS lets them open a Notify-Scheduler link (Nic 2026-09-03).
export const PENDING_CHIP_ROLES = ['sales', 'coordinator', 'admin']

const PENDING_STATUSES = ['pending', 'awaiting_approval'] // awaiting_approval is legacy data

export function chipsForRole(role: string): ChipId[] {
  return PENDING_CHIP_ROLES.includes(role)
    ? ['all', 'scheduled', 'pending', 'completed']
    : ['all', 'scheduled', 'completed']
}

export function parseChip(raw: string | undefined, role: string): ChipId {
  if (raw === 'scheduled' || raw === 'completed') return raw
  if (raw === 'pending' && PENDING_CHIP_ROLES.includes(role)) return 'pending'
  return 'all'
}

export function applyChip<J extends { status: string }>(jobs: J[], chip: ChipId): J[] {
  if (chip === 'all') return jobs
  if (chip === 'pending') return jobs.filter(j => PENDING_STATUSES.includes(j.status))
  return jobs.filter(j => j.status === chip)
}

/** Server-side belt: roles without a Pending chip never receive pending rows
 *  in the page payload (RLS already scopes sales/coordinator to their own). */
export function stripHiddenPending<J extends { status: string }>(jobs: J[], role: string): J[] {
  if (PENDING_CHIP_ROLES.includes(role)) return jobs
  return jobs.filter(j => !PENDING_STATUSES.includes(j.status))
}

// ── sort ──

export type SortId = 'time' | 'created-desc' | 'created-asc' | 'alpha-asc' | 'alpha-desc'

type SortableJob = {
  time_start: string | null
  created_at: string
  project_title: string | null
  client: string
}

export function sortJobs<J extends SortableJob>(jobs: J[], sort: SortId): J[] {
  const out = [...jobs]
  const alpha = (j: SortableJob) => (j.project_title || j.client || '').toLowerCase()
  switch (sort) {
    case 'time':
      out.sort((a, b) =>
        (a.time_start ?? '99:99').localeCompare(b.time_start ?? '99:99'))
      break
    case 'created-desc': out.sort((a, b) => b.created_at.localeCompare(a.created_at)); break
    case 'created-asc':  out.sort((a, b) => a.created_at.localeCompare(b.created_at)); break
    case 'alpha-asc':    out.sort((a, b) => alpha(a).localeCompare(alpha(b))); break
    case 'alpha-desc':   out.sort((a, b) => alpha(b).localeCompare(alpha(a))); break
  }
  return out
}

// ── filters ──

export type ListFilters = {
  client: string          // '' = any; exact match on jobs.client
  dateFrom: string        // ISO or ''
  dateTo: string          // ISO or ''
  window: '' | 'am' | 'pm' | 'allday'
  installerId: string     // '' = any; matches suggested AND assigned (spec §6)
  noInstaller: boolean    // no FORMAL assignee yet (a suggestion is not an installer)
}

export const EMPTY_FILTERS: ListFilters = {
  client: '', dateFrom: '', dateTo: '', window: '', installerId: '', noInstaller: false,
}

type AssigneeRow = { is_suggestion: boolean; users: { id: string; name: string } | null }
type FilterableJob = {
  client: string
  date: string
  date_end: string | null
  time_start: string | null
  job_assignees?: AssigneeRow[]
}

export function applyFilters<J extends FilterableJob>(jobs: J[], f: ListFilters): J[] {
  return jobs.filter(j => {
    if (f.client && j.client !== f.client) return false
    const end = j.date_end && j.date_end > j.date ? j.date_end : j.date
    if (f.dateFrom && end < f.dateFrom) return false
    if (f.dateTo && j.date > f.dateTo) return false
    if (f.window === 'am' && !(j.time_start !== null && j.time_start < '12:00')) return false
    if (f.window === 'pm' && !(j.time_start !== null && j.time_start >= '12:00')) return false
    if (f.window === 'allday' && j.time_start !== null) return false
    const rows = j.job_assignees ?? []
    if (f.installerId && !rows.some(a => a.users?.id === f.installerId)) return false
    if (f.noInstaller && rows.some(a => !a.is_suggestion)) return false
    return true
  })
}

export function activeFilterCount(f: ListFilters): number {
  let n = 0
  if (f.client) n++
  if (f.dateFrom || f.dateTo) n++
  if (f.window) n++
  if (f.installerId) n++
  if (f.noInstaller) n++
  return n
}

// ── folding ──

export type FolderInfo = {
  name: string; client: string
  time_start: string | null; time_end: string | null
}

export type FolderGroup<J> = {
  projectId: string
  info: FolderInfo
  dayJobs: J[]
  projectTotal: number
  doneCount: number
  spans: { date: string; date_end: string | null }[]
  punctuality: 'strict' | 'flexible' | 'mixed'
}

export type DayListItem<J> = { kind: 'job'; job: J } | { kind: 'folder'; group: FolderGroup<J> }

type GroupableJob = {
  id: string
  project_id: string | null
  job_projects?: FolderInfo | null
  status: string
  date: string
  date_end: string | null
  punctuality: 'strict' | 'flexible'
}

/** Fold one day's (already sorted) jobs. Counts / spans come from allJobs —
 *  every row the viewer can see, so RLS truth can never leak (spec §6). */
export function groupDayJobs<J extends GroupableJob>(dayJobs: J[], allJobs: J[]): DayListItem<J>[] {
  const items: DayListItem<J>[] = []
  const folders = new Map<string, FolderGroup<J>>()
  for (const job of dayJobs) {
    if (!job.project_id || !job.job_projects) {
      items.push({ kind: 'job', job })
      continue
    }
    const existing = folders.get(job.project_id)
    if (existing) {
      existing.dayJobs.push(job)
      if (existing.punctuality !== 'mixed' && existing.punctuality !== job.punctuality) {
        existing.punctuality = 'mixed'
      }
      continue
    }
    const projectRows = allJobs.filter(a => a.project_id === job.project_id)
    const group: FolderGroup<J> = {
      projectId:    job.project_id,
      info:         job.job_projects,
      dayJobs:      [job],
      projectTotal: projectRows.length,
      doneCount:    projectRows.filter(a => a.status === 'completed').length,
      spans:        projectRows.map(a => ({ date: a.date, date_end: a.date_end })),
      punctuality:  job.punctuality,
    }
    folders.set(job.project_id, group)
    items.push({ kind: 'folder', group })
  }
  return items
}

// ── day counter ──

/** "Day x / y" for multi-day jobs (spec §6). null = not a multi-day job on
 *  this date. Pure string math on ISO dates — no locale calls. */
export function dayCounter(
  date: string, dateEnd: string | null, currentDate: string,
): { day: number; total: number } | null {
  if (!dateEnd || dateEnd <= date) return null
  if (currentDate < date || currentDate > dateEnd) return null
  const days = (a: string, b: string) =>
    Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86_400_000)
  return { day: days(date, currentDate) + 1, total: days(date, dateEnd) + 1 }
}
```

- [ ] **Step 4: Run the test — must pass**

Run: `npx tsx src/lib/utils/schedule-list.test.ts` → all ✓, exit 0. `npm run type-check` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/schedule-list.ts src/lib/utils/schedule-list.test.ts
git commit -m "feat(v3): schedule-list rules — chips, pending strip, sort/filter, folding, day counter (TDD)"
```

---

### Task 3: Schedule query carries project + suggestion data

**Files:**
- Modify: `src/lib/supabase/queries/jobs.ts` (`SCHEDULE_SELECT` L30-36, `ScheduleJob` L7-28, `getScheduleJobs` L68, delete `getPendingJobs` L91)
- Modify: `src/features/schedule/JobRow.tsx` (assigned-names must exclude suggestions)
- Modify: `src/features/schedule/ScheduleShell.tsx` (search over assignee names → assigned only)

**Interfaces:**
- Consumes: `FolderInfo` shape (Task 2).
- Produces: `ScheduleJob` gains `project_id: string | null`, `created_at: string`, `job_projects: { name: string; client: string; time_start: string | null; time_end: string | null } | null`; `getScheduleJobs()` now returns **suggestion rows too** (`is_suggestion` flag kept — the sort/filter dropdown matches suggested installers, spec §6). `getCompletedJobs` is untouched (it keeps `stripSuggestions` — it serves the installer-only /completed page after Task 4).

- [ ] **Step 1: Extend `SCHEDULE_SELECT` and `ScheduleJob`**

In `SCHEDULE_SELECT` add three fields to the select string (before the `job_assignees(...)` embed):

```
project_id, created_at, job_projects(name, client, time_start, time_end),
```

In `type ScheduleJob` add:

```ts
  project_id:   string | null
  created_at:   string
  job_projects: { name: string; client: string; time_start: string | null; time_end: string | null } | null
```

(Embedding `job_projects` onto `jobs` is safe — single FK `jobs_project_id_fkey`, unlike the banned `users` embeds.)

- [ ] **Step 2: Keep suggestions in `getScheduleJobs` only**

In `getScheduleJobs` (L68-77) remove the `stripSuggestions(...)` call so rows pass through with `is_suggestion` intact. Leave `stripSuggestions` itself and its use in `getCompletedJobs` alone. Add a comment on `getScheduleJobs`:

```ts
// Suggestions are KEPT here (office-only page; the sort & filter dropdown
// matches suggested installers too — spec §6). Display components must
// filter is_suggestion themselves. /completed (installer page) still strips.
```

Delete `getPendingJobs` (L91-…) — its page becomes a redirect in Task 4 and nothing else calls it (verify with a grep for `getPendingJobs` first; if the /pending page is the only caller, delete both in whichever of Task 3/4 lands second — leave a `// removed in V3 round 2` note in neither, just delete).

- [ ] **Step 3: Fix the two display consumers**

`JobRow.tsx`: where the installer names are built from `job.job_assignees` (the `assignedFullNames` value near L56-60 and the `hasTeamInfo` meta row around L148-172), filter first:

```ts
const formal = (job.job_assignees ?? []).filter(a => !a.is_suggestion)
```

and build the displayed names from `formal` (both the compact first-name row and the `Installer:` team line). Suggested names must never render on the card.

`ScheduleShell.tsx` L131 (the free-text search over assignee names): apply the same `.filter(a => !a.is_suggestion)` before matching names.

- [ ] **Step 4: Verify + commit**

Run: `npm run type-check` → PASS. Run `npm run build` → PASS.
Manual sanity (worktree `npm run dev`): /schedule renders exactly as before (suggested installers absent from cards).

```bash
git add src/lib/supabase/queries/jobs.ts src/features/schedule/JobRow.tsx src/features/schedule/ScheduleShell.tsx
git commit -m "feat(v3): schedule query carries project embed + created_at; suggestions kept with flag, display filtered"
```

---

### Task 4: One page — chips, bulk-bar adaptation, tab retirement, redirects, nav

**Files:**
- Create: `src/features/schedule/FilterChips.tsx`
- Modify: `src/features/schedule/ScheduleShell.tsx` (chip pipeline replaces the pageMode status gate; bulk gates per chip)
- Modify: `src/app/schedule/page.tsx` (`?filter=` param + server-side pending strip)
- Modify: `src/app/pending/page.tsx` (redirect), `src/app/completed/page.tsx` (installer keeps page; office redirect)
- Modify: `src/lib/navTabs.ts` (office pending/completed entries removed; installer untouched)
- Modify: `src/lib/i18n/en.ts` + `zh.ts` (chip keys)

**Interfaces:**
- Consumes: `ChipId`, `chipsForRole`, `parseChip`, `applyChip`, `stripHiddenPending` (Task 2).
- Produces: `ScheduleShell` props gain `initialChip?: ChipId` (default `'all'`); `pageMode` narrows to `'schedule' | 'completed'` (`'completed'` = the installer flat page, no chips, no bulk); `FilterChips({ chips, active, onSelect, lang })`.

- [ ] **Step 1: i18n keys** — append to the `── Job projects (Workflow V3) ──` block in `en.ts`:

```ts
  jpChipAll:       'All',
  jpChipScheduled: 'Scheduled',
  jpChipPending:   'Pending',
  jpChipCompleted: 'Completed',
```

and in `zh.ts`:

```ts
  jpChipAll:       '全部',
  jpChipScheduled: '已排期',
  jpChipPending:   '待处理',
  jpChipCompleted: '已完成',
```

- [ ] **Step 2: `FilterChips.tsx`**

```tsx
'use client'

import { t, type LangCode } from '@/lib/i18n'
import type { ChipId } from '@/lib/utils/schedule-list'

const LABEL_KEY: Record<ChipId, 'jpChipAll' | 'jpChipScheduled' | 'jpChipPending' | 'jpChipCompleted'> = {
  all: 'jpChipAll', scheduled: 'jpChipScheduled', pending: 'jpChipPending', completed: 'jpChipCompleted',
}

export function FilterChips({ chips, active, onSelect, lang }: {
  chips: ChipId[]
  active: ChipId
  onSelect: (c: ChipId) => void
  lang: LangCode
}) {
  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-none">
      {chips.map(c => (
        <button
          key={c}
          type="button"
          onClick={() => onSelect(c)}
          className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            active === c
              ? 'border-terracotta bg-terracotta text-paper'
              : 'border-line bg-paper text-ink2 hover:border-terracotta'
          }`}
        >
          {t(lang, LABEL_KEY[c])}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: `ScheduleShell` chip pipeline**

- Props (L31-34): `pageMode?: 'schedule' | 'completed'`; add `initialChip?: ChipId`.
- New state: `const [chip, setChip] = useState<ChipId>(initialChip ?? 'all')`; `const chips = pageMode === 'schedule' && role ? chipsForRole(role) : []`.
- Replace the status conditions in the `filtered` useMemo (L125-138) with:

```ts
let rows = pageMode === 'completed'
  ? jobs.filter(j => j.status === 'completed')
  : applyChip(jobs, chip)
```

(keep the free-text search on the result; the sort/filter dropdown joins this pipeline in Task 7).
- Chip change clears selection: `const selectChip = (c: ChipId) => { setChip(c); setSelectedIds(new Set()) }`.
- Render `<FilterChips chips={chips} active={chip} onSelect={selectChip} lang={lang} />` under the heading row when `chips.length > 0` (list AND week views — one filtered set feeds all views; month view consumes it too until round 3 rebuilds it).
- **Bulk gates** (replace L57-61):

```ts
const canBulkDelete   = (chip === 'scheduled' && role === 'scheduler')
                     || (chip === 'pending' && (role === 'sales' || role === 'coordinator'))
const canBulkComplete = chip === 'scheduled' && role === 'scheduler'
const canBulkRevert   = chip === 'completed' && role === 'scheduler'
const selectable      = canBulkDelete || canBulkComplete || canBulkRevert
```

(Under `pageMode === 'completed'` — installers — `chip` stays `'all'` so all three are false: no selection UI, matching today.) Wire `selectable` (not `canBulkDelete`) into the ListView props at L340 so Revert/Complete selection no longer piggy-backs on the delete gate. Bar buttons stay as they are — each already renders only when its own `canBulk*` is true. Single-row swipe delete (`deletable`) keeps following `canBulkDelete`.

- [ ] **Step 4: Pages + nav**

`src/app/schedule/page.tsx`:

```ts
import { parseChip, stripHiddenPending } from '@/lib/utils/schedule-list'

export default async function SchedulePage({ searchParams }: {
  searchParams: Promise<{ filter?: string }>
}) {
  // …existing auth/profile/role code unchanged (installer redirect stays)…
  const { filter } = await searchParams
  const all  = await getScheduleJobs()
  const jobs = stripHiddenPending(all, role)   // scheduler et al: pending never reaches the browser
  return <ScheduleShell jobs={jobs} lang={lang} role={role} initialChip={parseChip(filter, role)} />
}
```

`src/app/pending/page.tsx` — whole file becomes:

```ts
import { redirect } from 'next/navigation'

// V3 round 2 (spec §6): tabs retired — pending lives on /schedule as a chip.
export default function PendingPage() {
  redirect('/schedule?filter=pending')
}
```

`src/app/completed/page.tsx` — keep the existing auth/profile/role lookup, then:

```ts
  if (role !== 'installer') redirect('/schedule?filter=completed')
  // installers keep this page: their nav's Completed list (InstallerShell has
  // no completed tab; RLS scopes rows to their own jobs). Flat, no chips.
```

…and below it the existing `getCompletedJobs()` + `<ScheduleShell pageMode="completed" …>` render, unchanged.

`src/lib/navTabs.ts` — remove the `completed` entry from scheduler/admin/designer/production and the `completed` + `pending` entries from sales/coordinator. **Installer's entries stay exactly as they are** (installer(“My Jobs”), completed, assistant). Result per role: scheduler/admin/designer = schedule, fcfs, design-load, assistant; production = schedule, fcfs, assistant; sales/coordinator = schedule, fcfs, design-load, assistant.

Also delete `getPendingJobs` from `queries/jobs.ts` now if Task 3 left it (grep `getPendingJobs` — must have zero callers).

- [ ] **Step 5: Verify + commit**

`npm run type-check` → PASS. `npm run build` → PASS.
Dev-server sanity: `/pending` lands on /schedule with the Pending chip active (sales); `/completed` as admin lands on the Completed chip; scheduler sees only All/Scheduled/Completed chips; bulk bar appears per chip as gated.

```bash
git add src/features/schedule/FilterChips.tsx src/features/schedule/ScheduleShell.tsx src/app/schedule/page.tsx src/app/pending/page.tsx src/app/completed/page.tsx src/lib/navTabs.ts src/lib/i18n/en.ts src/lib/i18n/zh.ts src/lib/supabase/queries/jobs.ts
git commit -m "feat(v3): one schedule page — filter chips, per-chip bulk bars, /pending + /completed retired (installer keeps /completed)"
```

---

### Task 5: Project folding — folder headers in the day list

**Files:**
- Create: `src/features/schedule/ProjectFolder.tsx`
- Modify: `src/features/schedule/ListView.tsx` (render grouped items)
- Modify: `src/features/schedule/ScheduleShell.tsx` (pass `allJobs` + chip to ListView)
- Modify: `src/lib/i18n/en.ts` + `zh.ts`

**Interfaces:**
- Consumes: `groupDayJobs`, `DayListItem`, `FolderGroup` (Task 2); `mergeDateRanges`, `formatRanges` (`src/lib/utils/date-ranges.ts`); `JobRow`.
- Produces: `ProjectFolder({ group, lang, autoExpand, selectable, selectedIds, onToggleJob, onDelete, currentDate })` — renders the folder header + (when open) its `dayJobs` as `JobRow`s.

- [ ] **Step 1: i18n keys** — `en.ts`:

```ts
  jpFolderToday:     'jobs today',
  jpFolderInProject: 'in this project',
  jpFolderDone:      'done',
```

`zh.ts`:

```ts
  jpFolderToday:     '项今日工作',
  jpFolderInProject: '项属此项目',
  jpFolderDone:      '已完成',
```

- [ ] **Step 2: `ProjectFolder.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Folder, ExternalLink } from 'lucide-react'
import { t, type LangCode } from '@/lib/i18n'
import { mergeDateRanges, formatRanges } from '@/lib/utils/date-ranges'
import type { FolderGroup } from '@/lib/utils/schedule-list'
import type { ScheduleJob } from '@/lib/supabase/queries/jobs'
import { JobRow } from './JobRow'
import { fmtTime } from './utils'

// Fold state is per device per project, default collapsed (spec §6). Read
// after mount only — the /schedule hydration-#418 rule.
function useFoldState(projectId: string) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    try { setOpen(localStorage.getItem(`gq-fold:${projectId}`) === 'open') } catch { /* default */ }
  }, [projectId])
  const toggle = () => setOpen(o => {
    try { localStorage.setItem(`gq-fold:${projectId}`, o ? 'closed' : 'open') } catch { /* best effort */ }
    return !o
  })
  return { open, toggle }
}

export function ProjectFolder({ group, lang, autoExpand, selectable, selectedIds, onToggleJob, onDelete, currentDate }: {
  group: FolderGroup<ScheduleJob>
  lang: LangCode
  autoExpand: boolean          // non-All chip: folders with matches open themselves
  selectable: boolean
  selectedIds: Set<string>
  onToggleJob?: (id: string) => void
  onDelete?: (id: string) => void
  currentDate: string
}) {
  const { open, toggle } = useFoldState(group.projectId)
  const expanded = autoExpand || open
  const ranges = formatRanges(mergeDateRanges(group.spans))
  const timing = group.info.time_start
    ? `${fmtTime(group.info.time_start)}${group.info.time_end ? ` – ${fmtTime(group.info.time_end)}` : ''}`
    : null
  const allSelected = group.dayJobs.every(j => selectedIds.has(j.id))

  return (
    <div className="mb-2">
      <div className="relative flex items-start gap-2">
        {selectable && (
          <button
            type="button"
            onClick={() => group.dayJobs.forEach(j => {
              if (allSelected === selectedIds.has(j.id)) onToggleJob?.(j.id)
            })}
            className={`hidden md:flex mt-4 h-5 w-5 shrink-0 items-center justify-center rounded border ${
              allSelected ? 'border-terracotta bg-terracotta text-paper' : 'border-line bg-paper'
            }`}
            aria-label="Select project jobs"
          >
            {allSelected && <span className="text-[11px] leading-none">✓</span>}
          </button>
        )}
        <button
          type="button"
          onClick={toggle}
          className="relative w-full rounded-[14px] border-[1.5px] border-terracotta bg-paper p-3 pl-5 text-left"
        >
          {/* punctuality stripe under the fold arrow — split when mixed */}
          <span className="absolute left-2 top-3 bottom-3 w-1 overflow-hidden rounded-full" aria-hidden>
            {group.punctuality === 'mixed' ? (
              <>
                <span className="absolute inset-x-0 top-0 h-1/2 bg-punct-strict" />
                <span className="absolute inset-x-0 bottom-0 h-1/2 bg-punct-flex" />
              </>
            ) : (
              <span className={`absolute inset-0 ${group.punctuality === 'strict' ? 'bg-punct-strict' : 'bg-punct-flex'}`} />
            )}
          </span>
          <span className="flex items-center gap-2">
            <ChevronRight size={14} className={`shrink-0 text-muted transition-transform ${expanded ? 'rotate-90' : ''}`} />
            <Folder size={14} className="shrink-0 text-terracotta" />
            <span className="font-medium text-[15px] text-ink truncate">{group.info.name}</span>
            <Link
              href={`/projects/${group.projectId}`}
              onClick={e => e.stopPropagation()}
              className="ml-auto shrink-0 text-muted hover:text-terracotta"
              aria-label="Open project"
            >
              <ExternalLink size={14} />
            </Link>
          </span>
          <span className="mt-1 block text-xs text-ink2 truncate">
            {group.info.client}{timing ? ` · ${timing}` : ''}
          </span>
          <span className="mt-1 block text-xs text-muted">
            {group.dayJobs.length} {t(lang, 'jpFolderToday')} · {group.projectTotal} {t(lang, 'jpFolderInProject')}
          </span>
          <span className="mt-1 flex items-center gap-2 text-xs text-muted">
            {ranges && <span className="truncate">{ranges}</span>}
            <span className="ml-auto shrink-0 rounded-full border border-line px-2 py-0.5">
              {group.doneCount} / {group.projectTotal} {t(lang, 'jpFolderDone')}
            </span>
          </span>
        </button>
      </div>
      {expanded && (
        <div className="mt-2 space-y-0 border-l-2 border-line pl-3 ml-2">
          {group.dayJobs.map(job => (
            <JobRow
              key={job.id}
              job={job}
              currentDate={currentDate}
              selectable={selectable}
              selected={selectedIds.has(job.id)}
              onToggle={onToggleJob}
              deletable={!!onDelete}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}
```

(Match `JobRow`'s actual prop names — read its `JobRowProps` before wiring; if `onToggle`/`onDelete` take the full job rather than an id, adapt here, not in JobRow.)

- [ ] **Step 3: `ListView` renders grouped items**

Add props: `allJobs: ScheduleJob[]`, `chip: ChipId`, keep the rest. Replace the flat `dayJobs.map(<JobRow…>)` (L65-76) with:

```tsx
{groupDayJobs(dayJobs, allJobs).map(item =>
  item.kind === 'folder' ? (
    <ProjectFolder
      key={`folder-${item.group.projectId}`}
      group={item.group}
      lang={lang}
      autoExpand={chip !== 'all'}
      selectable={selectable}
      selectedIds={selectedIds}
      onToggleJob={onToggle}
      onDelete={deletable ? onDelete : undefined}
      currentDate={selectedDate}
    />
  ) : (
    <JobRow key={item.job.id} job={item.job} currentDate={selectedDate} … />
  )
)}
```

Folders with no matching children never render (grouping runs on the already-filtered rows), which is spec §6's "hides folders with none". `ScheduleShell` passes `allJobs={jobs}` (the full server-stripped prop — counts are "rows the viewer can see", independent of the active chip) and `chip={chip}`.

**Installers never see folders:** their pages (`InstallerShell`, `/completed` via `pageMode='completed'`) — for the `/completed` installer page, pass `chip="all"` and `allJobs={jobs}`; its rows come from `getCompletedJobs()` whose select has no `job_projects` embed, so `job_projects` is undefined and every job renders loose. Verify that in the dev server with an installer preview-as.

- [ ] **Step 4: Verify + commit**

`npm run type-check`, `npm run build`, `npx tsx src/lib/utils/schedule-list.test.ts` → all PASS.
Dev-server: nest 2+ jobs on one date under a project (round-1 picker) → folder appears with ring, stripe, counts, ranges, open icon; fold state survives reload; Scheduled chip auto-expands.

```bash
git add src/features/schedule/ProjectFolder.tsx src/features/schedule/ListView.tsx src/features/schedule/ScheduleShell.tsx src/lib/i18n/en.ts src/lib/i18n/zh.ts
git commit -m "feat(v3): project folding on the schedule day list — folder header, stripe, counts, fold memory"
```

---

### Task 6: Completed veil

**Files:**
- Create: `src/features/schedule/CompletedVeil.tsx`
- Modify: `src/features/schedule/ListView.tsx`, `src/features/schedule/WeekView.tsx`, `src/features/schedule/ProjectFolder.tsx` (wrap completed rows)
- Modify: `src/lib/i18n/en.ts` + `zh.ts` (`jpVeilCompleted`)

**Interfaces:**
- Consumes: nothing new.
- Produces: `CompletedVeil({ children, lang })` — dotted border + 75% overlay + the word centred; hover reveals (desktop), first tap lifts (touch), second tap reaches the card (spec §6).

- [ ] **Step 1: i18n** — `en.ts`: `jpVeilCompleted: 'Completed',` · `zh.ts`: `jpVeilCompleted: '已完成',`

- [ ] **Step 2: `CompletedVeil.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { t, type LangCode } from '@/lib/i18n'

// Spec §6: completed jobs stay in their day's list under a veil — dotted
// border, 75% overlay, the word centred; hover or tap reveals the card.
export function CompletedVeil({ children, lang }: { children: React.ReactNode; lang: LangCode }) {
  const [lifted, setLifted] = useState(false)
  return (
    <div className="group relative">
      {children}
      {!lifted && (
        <button
          type="button"
          onClick={() => setLifted(true)}
          className="absolute inset-0 z-10 mb-2 flex items-center justify-center rounded-[14px] border border-dashed border-line bg-bg/75 transition-opacity group-hover:opacity-0"
          aria-label={t(lang, 'jpVeilCompleted')}
        >
          <span className="text-xs font-medium uppercase tracking-wide text-muted">
            {t(lang, 'jpVeilCompleted')}
          </span>
        </button>
      )}
    </div>
  )
}
```

(`mb-2` mirrors JobRow's own bottom margin so the veil hugs the card, not the gap — check JobRow's wrapper class and match it. Hover-reveal uses opacity so the click falls through to the card only after the veil is gone on touch: the first tap hits the veil button, lifts it; on desktop hover hides it and clicks reach the card directly. `z-10` is local stacking inside the list — nothing here approaches the BottomNav rule.)

- [ ] **Step 3: Wrap completed rows on the All chip**

`ListView.tsx` + `ProjectFolder.tsx`: where a `JobRow` renders and `chip === 'all' && job.status === 'completed'`, wrap it:

```tsx
<CompletedVeil lang={lang}><JobRow … /></CompletedVeil>
```

(`ProjectFolder` gains a `veilCompleted: boolean` prop = `chip === 'all'` from ListView.) `WeekView.tsx` L52: same wrap (WeekView needs `lang` — it already has it — plus a `veilCompleted` prop passed from ScheduleShell = `chips.length > 0 && chip === 'all'`). The Completed chip shows completed cards **unveiled** (the viewer asked for them); Scheduled excludes them; the installer `/completed` page stays unveiled (`pageMode='completed'` → `chip` is `'all'`… so gate the ListView/WeekView wrap on `pageMode !== 'completed'` too — pass `veilCompleted` down from ScheduleShell as `pageMode === 'schedule' && chip === 'all'` and use that single boolean in both views and the folder).

- [ ] **Step 4: Verify + commit**

`npm run type-check` + `npm run build` → PASS. Dev-server: All chip shows completed cards veiled (hover reveals on PC; tap lifts on phone emulation), Completed chip shows them plain, installer /completed unchanged.

```bash
git add src/features/schedule/CompletedVeil.tsx src/features/schedule/ListView.tsx src/features/schedule/WeekView.tsx src/features/schedule/ProjectFolder.tsx src/features/schedule/ScheduleShell.tsx src/lib/i18n/en.ts src/lib/i18n/zh.ts
git commit -m "feat(v3): completed veil — finished jobs stay in the day under a reveal-on-hover/tap overlay"
```

---

### Task 7: Sort & filter dropdown

**Files:**
- Create: `src/features/schedule/SortFilterDropdown.tsx`
- Modify: `src/features/schedule/ScheduleShell.tsx` (state + pipeline + render beside the view toggle)
- Modify: `src/lib/i18n/en.ts` + `zh.ts`

**Interfaces:**
- Consumes: `SortId`, `ListFilters`, `EMPTY_FILTERS`, `sortJobs`, `applyFilters`, `activeFilterCount` (Task 2).
- Produces: `SortFilterDropdown({ lang, sort, filters, clients, installers, onSort, onFilters })` where `clients: string[]`, `installers: { id: string; name: string }[]`.

- [ ] **Step 1: i18n keys** — `en.ts`:

```ts
  jpSortFilter:       'Sort & filter',
  jpSortBy:           'Sort by',
  jpSortTime:         'Start time',
  jpSortCreatedNew:   'Newest created',
  jpSortCreatedOld:   'Oldest created',
  jpSortAZ:           'A to Z',
  jpSortZA:           'Z to A',
  jpFilterClient:     'Client',
  jpFilterDates:      'Date range',
  jpFilterWindow:     'Time of day',
  jpWindowAM:         'AM',
  jpWindowPM:         'PM',
  jpWindowAllDay:     'All day',
  jpFilterInstaller:  'Installer',
  jpFilterNoInstaller:'No installer yet',
  jpFilterAny:        'Any',
  jpClearAll:         'Clear all',
```

`zh.ts`:

```ts
  jpSortFilter:       '排序与筛选',
  jpSortBy:           '排序方式',
  jpSortTime:         '开始时间',
  jpSortCreatedNew:   '最新创建',
  jpSortCreatedOld:   '最早创建',
  jpSortAZ:           'A 到 Z',
  jpSortZA:           'Z 到 A',
  jpFilterClient:     '客户',
  jpFilterDates:      '日期范围',
  jpFilterWindow:     '时间段',
  jpWindowAM:         '上午',
  jpWindowPM:         '下午',
  jpWindowAllDay:     '全天',
  jpFilterInstaller:  '安装人员',
  jpFilterNoInstaller:'尚未指派安装人员',
  jpFilterAny:        '不限',
  jpClearAll:         '清除全部',
```

- [ ] **Step 2: `SortFilterDropdown.tsx`** — trigger button (SlidersHorizontal icon + count badge) beside the view toggle; panel follows the `JumpCalendar` pattern: scrim `fixed inset-0 z-[60]`, panel `z-[70]` (absolute right-0 on lg, bottom sheet feel is NOT needed — small dropdown per spec).

```tsx
'use client'

import { SlidersHorizontal } from 'lucide-react'
import { t, type LangCode } from '@/lib/i18n'
import {
  activeFilterCount, EMPTY_FILTERS,
  type ListFilters, type SortId,
} from '@/lib/utils/schedule-list'
import { useState } from 'react'

const SORTS: { id: SortId; key: 'jpSortTime' | 'jpSortCreatedNew' | 'jpSortCreatedOld' | 'jpSortAZ' | 'jpSortZA' }[] = [
  { id: 'time',         key: 'jpSortTime' },
  { id: 'created-desc', key: 'jpSortCreatedNew' },
  { id: 'created-asc',  key: 'jpSortCreatedOld' },
  { id: 'alpha-asc',    key: 'jpSortAZ' },
  { id: 'alpha-desc',   key: 'jpSortZA' },
]

export function SortFilterDropdown({ lang, sort, filters, clients, installers, onSort, onFilters }: {
  lang: LangCode
  sort: SortId
  filters: ListFilters
  clients: string[]
  installers: { id: string; name: string }[]
  onSort: (s: SortId) => void
  onFilters: (f: ListFilters) => void
}) {
  const [open, setOpen] = useState(false)
  const count = activeFilterCount(filters)
  const set = (patch: Partial<ListFilters>) => onFilters({ ...filters, ...patch })

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`relative flex h-9 w-9 items-center justify-center rounded-lg border ${
          count > 0 || sort !== 'time' ? 'border-terracotta text-terracotta' : 'border-line text-ink2'
        }`}
        aria-label={t(lang, 'jpSortFilter')}
      >
        <SlidersHorizontal size={16} />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-terracotta px-1 text-[10px] text-paper">
            {count}
          </span>
        )}
      </button>
      {open && (
        <>
          <button type="button" className="fixed inset-0 z-[60] cursor-default" onClick={() => setOpen(false)} aria-label="Close" />
          <div className="absolute right-0 top-11 z-[70] w-72 rounded-[14px] border border-line bg-paper p-4 shadow-lg space-y-3">
            <div>
              <p className="mb-1 text-[11px] uppercase tracking-wide text-muted">{t(lang, 'jpSortBy')}</p>
              <div className="flex flex-wrap gap-1.5">
                {SORTS.map(s => (
                  <button key={s.id} type="button" onClick={() => onSort(s.id)}
                    className={`rounded-full border px-2.5 py-1 text-xs ${sort === s.id ? 'border-terracotta bg-terracotta text-paper' : 'border-line text-ink2'}`}>
                    {t(lang, s.key)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1 text-[11px] uppercase tracking-wide text-muted">{t(lang, 'jpFilterClient')}</p>
              <select value={filters.client} onChange={e => set({ client: e.target.value })}
                className="w-full rounded-lg border border-line bg-paper px-2 py-1.5 text-sm">
                <option value="">{t(lang, 'jpFilterAny')}</option>
                {clients.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <p className="mb-1 text-[11px] uppercase tracking-wide text-muted">{t(lang, 'jpFilterDates')}</p>
              <div className="flex items-center gap-2">
                <input type="date" value={filters.dateFrom} onChange={e => set({ dateFrom: e.target.value })}
                  className="w-full rounded-lg border border-line bg-paper px-2 py-1.5 text-sm" />
                <span className="text-muted">–</span>
                <input type="date" value={filters.dateTo} onChange={e => set({ dateTo: e.target.value })}
                  className="w-full rounded-lg border border-line bg-paper px-2 py-1.5 text-sm" />
              </div>
            </div>
            <div>
              <p className="mb-1 text-[11px] uppercase tracking-wide text-muted">{t(lang, 'jpFilterWindow')}</p>
              <div className="flex gap-1.5">
                {([['am', 'jpWindowAM'], ['pm', 'jpWindowPM'], ['allday', 'jpWindowAllDay']] as const).map(([w, key]) => (
                  <button key={w} type="button" onClick={() => set({ window: filters.window === w ? '' : w })}
                    className={`rounded-full border px-2.5 py-1 text-xs ${filters.window === w ? 'border-terracotta bg-terracotta text-paper' : 'border-line text-ink2'}`}>
                    {t(lang, key)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1 text-[11px] uppercase tracking-wide text-muted">{t(lang, 'jpFilterInstaller')}</p>
              <select value={filters.installerId} onChange={e => set({ installerId: e.target.value })}
                className="w-full rounded-lg border border-line bg-paper px-2 py-1.5 text-sm">
                <option value="">{t(lang, 'jpFilterAny')}</option>
                {installers.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
              <label className="mt-2 flex items-center gap-2 text-sm text-ink2">
                <input type="checkbox" checked={filters.noInstaller} onChange={e => set({ noInstaller: e.target.checked })} />
                {t(lang, 'jpFilterNoInstaller')}
              </label>
            </div>
            <button type="button" onClick={() => { onFilters(EMPTY_FILTERS); onSort('time') }}
              className="w-full rounded-lg border border-line py-1.5 text-xs text-muted hover:text-ink">
              {t(lang, 'jpClearAll')}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Wire into `ScheduleShell`**

- State: `const [sort, setSort] = useState<SortId>('time')`; `const [listFilters, setListFilters] = useState<ListFilters>(EMPTY_FILTERS)`.
- Pipeline: in the `filtered` useMemo, after the chip + search steps: `rows = sortJobs(applyFilters(rows, listFilters), sort)`.
- Options (useMemo over `jobs`): `clients` = sorted unique non-empty `j.client`; `installers` = unique `{id, name}` from every `job_assignees` row (suggested AND assigned — spec §6), sorted by name.
- Render `<SortFilterDropdown …>` beside the view toggle (L312-329 area), **office list view only**: `pageMode === 'schedule' && viewMode === 'list'`.

- [ ] **Step 4: Verify + commit**

`npm run type-check` + `npm run build` → PASS. Dev-server: each sort reorders the day list; each filter narrows it; badge counts; Clear all resets; folders with no matching children disappear (grouping runs post-filter).

```bash
git add src/features/schedule/SortFilterDropdown.tsx src/features/schedule/ScheduleShell.tsx src/lib/i18n/en.ts src/lib/i18n/zh.ts
git commit -m "feat(v3): sort & filter dropdown on the schedule list (client/date/window/installer incl. suggestions/no-installer)"
```

---

### Task 8: "Day x / y" labels

**Files:**
- Modify: `src/features/schedule/JobRow.tsx` (L21-25 `daysBetween`, L70-75 `jobDayLabel`, L130-135 render)
- Modify: `src/features/installer/InstallerJobCard.tsx` (+ its data source if `date_end` is missing)
- Modify: `src/lib/i18n/en.ts` + `zh.ts`

**Interfaces:**
- Consumes: `dayCounter` (Task 2).
- Produces: the label reads `Day 1 / 3` everywhere (was `Job Day: 1/3`); installer cards gain it.

- [ ] **Step 1: i18n** — `en.ts`: `jpDayLabel: 'Day',` · `zh.ts`: `jpDayLabel: 'Day',` (numeric label stays English in every language — same rule as date labels; note the duplication is deliberate).

- [ ] **Step 2: `JobRow.tsx`** — delete the local `daysBetween` (L21-25) and the `jobDayLabel` computation (L70-75); replace with:

```ts
const counter = currentDate ? dayCounter(job.date, job.date_end, currentDate) : null
```

and the render block (L130-135) becomes:

```tsx
{counter && (
  <div className="text-right">
    <span className="block text-[9px] uppercase tracking-wide text-muted">{t(lang, 'jpDayLabel')}</span>
    <span className="text-[15px] text-ink">{counter.day} / {counter.total}</span>
  </div>
)}
```

(`JobRow` currently has no `lang` prop — check `JobRowProps`; if absent, add `lang: LangCode` and pass it from `ListView`/`WeekView`/`ProjectFolder`, which all have it. Keep the sibling "Job Time:" line as it is — only the day counter is in scope.)

- [ ] **Step 3: `InstallerJobCard.tsx`** — first check `InstallerJob` (in `src/lib/supabase/queries/installer.ts`) selects `date_end`; if not, add it to the select + type. Then in the card, under the `Clock` time row (L43-48), add:

```tsx
{(() => {
  const today = new Date().toISOString().slice(0, 10)
  const c = dayCounter(job.date, job.date_end, today)
  return c ? (
    <p className="text-xs text-muted">{t(lang, 'jpDayLabel')} {c.day} / {c.total}</p>
  ) : null
})()}
```

Wait — `new Date().toISOString()` is UTC and this card renders on the client for installers in SGT; use the same "today" source InstallerShell already uses (it computes today for its tabs — reuse that value via a `today` prop if it exists, otherwise compute with the repo's `toISO(new Date())` from `src/features/schedule/utils.ts`, which is local-time based). Follow whatever InstallerShell already does — do not introduce a second today-convention.

- [ ] **Step 4: Verify + commit**

`npm run type-check` + `npm run build` → PASS. Dev-server: a 3-day job shows `Day 1 / 3` on the schedule list under its first date, `Day 2 / 3` under the second; installer preview-as shows the counter on a mid-span day.

```bash
git add src/features/schedule/JobRow.tsx src/features/installer/InstallerJobCard.tsx src/lib/supabase/queries/installer.ts src/lib/i18n/en.ts src/lib/i18n/zh.ts
git commit -m "feat(v3): Day x / y labels — schedule cards renamed, installer cards gain the counter"
```

---

### Task 9: Realtime, held-job links, verification sweep

**Files:**
- Modify: `src/features/schedule/ScheduleShell.tsx` (live tables)
- Modify: `src/features/projects/ProjectFormShell.tsx` (push-result sheet, L678-700 region)

**Interfaces:**
- Consumes: `useLiveChannel` (existing), migration 0052's publication entry (Task 1).

- [ ] **Step 1: Live folder headers** — `ScheduleShell.tsx` L41-46, extend the subscription:

```ts
tables: [{ table: 'jobs' }, { table: 'job_projects' }],
```

(A project rename/timing edit now refreshes open schedule pages; `job_projects` broadcasts since 0052.)

- [ ] **Step 2: Held-job links the pusher can't open** — in the push-result sheet (`ProjectFormShell.tsx` L678-700), a held row with reason `'not-yours'` must render its reason text **without** the Open link: under 0052 the pusher (sales/coordinator) cannot SELECT that job, so the link would land on a not-found page. Keep Open for the other reasons.

- [ ] **Step 3: Full verification sweep**

Run, all must pass:
- `npm run type-check`
- `npm run build`
- every standalone suite: `for f in src/lib/*/*.test.ts; do npx tsx "$f" || exit 1; done` (expect the round-1 three + `schedule-list.test.ts` + the twelve pre-existing — all green)

- [ ] **Step 4: Commit + push the branch**

```bash
git add src/features/schedule/ScheduleShell.tsx src/features/projects/ProjectFormShell.tsx
git commit -m "feat(v3): live project headers on the schedule + held-job rows drop dead Open links"
git push origin feat-workflow-v3
```

---

## Nic's smoke gate (after `npx supabase db push` for 0052 — his OK required first)

The §12 pending-leak test plus round-2 UI, on the `feat-workflow-v3` preview:

1. **Pending leak (the gate):** real installer login — no Pending chip, no pending rows anywhere (list, folders, counts). Real scheduler login (or a second office account) — same. Second sales login — cannot see the first sales user's pending jobs on the Pending chip or in folder counts. *(Preview-as does NOT test this — admin's DB role sees everything; real logins only.)*
2. Notify Scheduler still works: sales pushes a clashing job → Notify Scheduler → the scheduler's Telegram link opens the pending job.
3. Chips: All default; Scheduled/Pending/Completed each narrow; `/pending` + `/completed` URLs land on the right chip; bottom nav lost the Pending/Completed tabs (office); installer nav unchanged and installer `/completed` still lists their finished jobs.
4. Folding: nested jobs fold under the ring header (stripe splits when strict+flex mix, counts, date ranges, done pill, open icon); fold memory per device; non-All chips auto-expand.
5. Completed veil on All (hover on PC, tap on phone); plain cards on the Completed chip.
6. Sort & filter: each sort, each filter, suggested-installer match, no-installer-yet, Clear all, count badge.
7. Bulk bars: Delete N on Pending (sales/coordinator), Complete N + Delete N on Scheduled (scheduler), Revert N on Completed (scheduler); folder checkbox selects its children (PC).
8. `Day 1 / 3` labels on schedule + installer cards.
9. Regression: FCFS, job form, Design Load, installer dashboard untouched.

## Self-review notes

- Spec §6 coverage: chips ✓ (T4), pending-personal RLS ✓ (T1) + server strip ✓ (T4), folding/ring/stripe/ranges/progress/open ✓ (T5), fold memory + auto-expand/hide ✓ (T5), completed veil ✓ (T6), bulk bars per chip + folder checkbox ✓ (T4/T5), sort & filter incl. suggested installers + no-installer ✓ (T7), Day x/y ✓ (T8), tab retirement + redirects ✓ (T4), installers never fold ✓ (T5 step 3). §12 suites: list sort/filter reducer ✓ (T2). §13 round-2 list complete.
- Round-3 items deliberately absent: month rebuild, project pop-outs, week-view project chips.
- Type consistency: `ChipId`/`SortId`/`ListFilters`/`FolderGroup`/`DayListItem` defined once in T2 and imported everywhere; `ScheduleJob.job_projects` shape matches `FolderInfo`.
