# Workflow V3 Round 1 — Container Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the project container: migration 0051, project mode on the job form, the nest/un-nest picker, new-job-in-project, timing write-through, project files, the /projects list, push-from-project with one summary Telegram, and the assistant "Projects → Workspaces" rename.

**Architecture:** A new `job_projects` table holds container labels; jobs point at it via `jobs.project_id` (SET NULL on delete — deleting a project can never delete a job). All nest/un-nest/push/label writes go through new `/api/projects/*` routes on the service client with in-route role checks; timing inheritance is written through onto jobs (`time_inherited` flag) so every existing surface just sees normal job times. UI: a new `ProjectFormShell` (reused by New-Project mode and `/projects/[id]`) rides inside the existing `JobFormLayout`; `NewJobShell` only gains a switch and a prefill mode.

**Tech Stack:** Next.js 15 App Router, Supabase (Postgres + RLS, service client for routes), Cloudflare R2, Tailwind with the repo's tokens, standalone `npx tsx` test files (no framework).

**Spec:** `docs/superpowers/specs/2026-09-02-workflow-v3-nesting-design.md` — read it first; this plan implements its §2–§5, §7, §9, §10 (rounds 2–3 are separate plans).

## Global Constraints

- Branch: `feat-workflow-v3` (work in a worktree; never touch `feat-workflow-v2`).
- No new npm dependencies. Stack is locked.
- i18n: new user-facing strings go in `src/lib/i18n/en.ts` + `zh.ts` ONLY (bn is frozen and falls back per-key). Never hardcode copy in components — but note the existing job-form files do hardcode some English strings; match whichever pattern the file you're editing already uses.
- Date labels always English. Plain everyday language in all UI copy.
- Overlays (modals, sheets, pickers) layer above BottomNav: `z-[60]` or higher. Hard rule.
- Never embed `users` directly onto `jobs` in a PostgREST select (PGRST201) — follow-up queries only.
- Files < 500 lines target (hard cap 2000).
- Tests are standalone scripts: header comment, `check()` pattern, exit 1 on failure, run via `npx tsx <file>` (copy the style of `src/lib/utils/design-brief-rules.test.ts`).
- Commit after every task. Never push to `origin dev` or `origin main`; pushing `feat-workflow-v3` is allowed.
- Migration 0051 must be applied (`npx supabase db push`, Nic's approval first) BEFORE any preview deploy of this code — the code SELECTs new columns (42703 crash otherwise).
- `punctuality` is an existing Postgres enum type (`'strict' | 'flexible'`); `get_my_role()` is an existing SQL helper (see 0034).

---

### Task 1: Migration 0051 + TypeScript types

**Files:**
- Create: `supabase/migrations/0051_job_projects.sql`
- Modify: `src/lib/supabase/types.ts` (jobs Row/Insert; new job_projects table type; attachment_buckets + files rows)

**Interfaces:**
- Consumes: existing `get_my_role()` SQL helper (0034), `punctuality` enum.
- Produces: table `job_projects`; `jobs.project_id: string | null`, `jobs.time_inherited: boolean`; `attachment_buckets.project_id`, `files.project_id`; TS type `Database['public']['Tables']['job_projects']`.

- [ ] **Step 1: Write the migration**

```sql
-- 0051_job_projects.sql
-- Workflow V3 round 1 (spec: docs/superpowers/specs/2026-09-02-workflow-v3-nesting-design.md §2).
-- A project is a container with labels. Jobs point at it; deleting a project
-- can never delete a job (SET NULL). All nest/label writes go through
-- /api/projects/* routes (service client) — RLS here is defense in depth.

create table job_projects (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  client              text not null default '',
  description         text,
  time_start          text,             -- HH:MM, optional "project timing"
  time_end            text,
  default_punctuality punctuality,      -- NULL = not set; pre-fill only, never written onto jobs
  created_by          uuid,
  r2_folder           text,             -- stamped app-side on insert: {YYYY-MM-DD}_{name-slug}_{8-char-code}
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()  -- PATCH route sets it explicitly
);

alter table jobs
  add column project_id     uuid references job_projects(id) on delete set null,
  add column time_inherited boolean not null default false;

create index jobs_project_id_idx on jobs(project_id) where project_id is not null;

-- Buckets/files can belong to a project instead of a job (project Files tab).
-- attachment_buckets.job_id was NOT NULL — exactly one owner from now on.
alter table attachment_buckets
  alter column job_id drop not null,
  add column project_id uuid references job_projects(id) on delete cascade,
  add constraint attachment_buckets_one_owner check (
    (job_id is not null and project_id is null)
    or (job_id is null and project_id is not null)
  );

-- files.job_id is already nullable (legacy rows may be NULL/NULL) — only
-- forbid BOTH owners being set at once.
alter table files
  add column project_id uuid references job_projects(id) on delete cascade,
  add constraint files_not_both_owners check (
    not (job_id is not null and project_id is not null)
  );

alter table job_projects enable row level security;

-- Every office role reads projects; installers get nothing (their queries
-- never touch this table; the job title carries the project name).
create policy "job_projects: office roles select"
  on job_projects for select to authenticated
  using (get_my_role() in ('sales','scheduler','admin','designer','coordinator','production'));

create policy "job_projects: managers write"
  on job_projects for all to authenticated
  using (get_my_role() in ('sales','scheduler','coordinator','admin'))
  with check (get_my_role() in ('sales','scheduler','coordinator','admin'));

-- Project-scoped files: SELECT already flows through the blanket by-role
-- files policies (0049/0050). INSERT for the client-side upload path in
-- AttachmentBuckets (project mode) — office manager roles only.
create policy "files: project files insert by managers"
  on files for insert to authenticated
  with check (
    project_id is not null
    and get_my_role() in ('sales','scheduler','coordinator','admin')
  );

-- Project buckets are created by the service client (POST /api/projects), and
-- bucket rename/update falls under 0025/0049's existing authenticated
-- policies — no new bucket policy needed.
```

- [ ] **Step 2: Update `src/lib/supabase/types.ts`**

In the `jobs` Row (after `design_rating_resolution`), add:

```ts
          project_id:              string | null
          time_inherited:          boolean
```

In the `jobs` Insert type, add to the `Omit<...>` union list: `'project_id' | 'time_inherited'`, and to the optional overrides block:

```ts
          project_id?:             string | null
          time_inherited?:         boolean
```

In the `attachment_buckets` Row, change `job_id: string` to `job_id: string | null` and add `project_id: string | null`; mirror into its Insert (both optional). In the `files` Row add `project_id: string | null`; add `project_id?: string | null` to its Insert.

Add a new table type alongside the others (same hand-written style):

```ts
      job_projects: {
        Row: {
          id:                  string
          name:                string
          client:              string
          description:         string | null
          time_start:          string | null
          time_end:            string | null
          default_punctuality: Punctuality | null
          created_by:          string | null
          r2_folder:           string | null
          created_at:          string
          updated_at:          string
        }
        Insert: Omit<Database['public']['Tables']['job_projects']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?:         string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['job_projects']['Insert']>
        Relationships: []
      }
```

- [ ] **Step 3: Verify**

Run: `npm run type-check`
Expected: PASS (nothing consumes the new types yet).
Also run: `npx supabase db push --dry-run` — expected output lists exactly `0051_job_projects.sql` as pending. Do NOT apply it; Nic (or the controller with Nic's OK) applies before the preview deploy.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0051_job_projects.sql src/lib/supabase/types.ts
git commit -m "feat(v3): migration 0051 — job_projects container + project_id/time_inherited on jobs"
```

---

### Task 2: Timing-inheritance helper (pure) — TDD

**Files:**
- Create: `src/lib/utils/project-timing.ts`
- Test: `src/lib/utils/project-timing.test.ts`

**Interfaces:**
- Produces:
  - `type Times = { time_start: string | null; time_end: string | null }`
  - `timingOnNest(job: Times, project: Times): { time_start: string | null; time_end: string | null; time_inherited: boolean } | null` — null = leave the job's row untouched.
  - `timingOnJobTimeEdit(newStart: string | null, newEnd: string | null, isNested: boolean, project: Times | null): { time_start: string | null; time_end: string | null; time_inherited: boolean }`
  - `timingOnUnnest(): { time_inherited: false }` (times stay as they are).

- [ ] **Step 1: Write the failing test** (`src/lib/utils/project-timing.test.ts`)

```ts
/**
 * Standalone test for Workflow V3 timing inheritance (spec §5). No framework.
 * Run: npx tsx src/lib/utils/project-timing.test.ts — exits 1 on any failure.
 */
import { timingOnNest, timingOnJobTimeEdit, timingOnUnnest } from './project-timing'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual); const e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`); failures++ }
}

const P  = { time_start: '09:00', time_end: '13:00' }
const P0 = { time_start: null, time_end: null }

// nest: empty job times + project has time → inherit
check('nest, empty job + project time → inherit', timingOnNest({ time_start: null, time_end: null }, P),
  { time_start: '09:00', time_end: '13:00', time_inherited: true })
// nest: job has ANY own time → untouched
check('nest, own start only → untouched', timingOnNest({ time_start: '10:00', time_end: null }, P), null)
check('nest, own both → untouched', timingOnNest({ time_start: '10:00', time_end: '12:00' }, P), null)
// nest: both empty, project has none → untouched (stays a floater)
check('nest, both empty → untouched', timingOnNest({ time_start: null, time_end: null }, P0), null)

// job time edit while nested: user typed a time → stops following
check('edit sets time → own', timingOnJobTimeEdit('14:00', '18:00', true, P),
  { time_start: '14:00', time_end: '18:00', time_inherited: false })
// cleared both while nested + project has a time → re-inherit (spec §5)
check('edit clears → re-inherit', timingOnJobTimeEdit(null, null, true, P),
  { time_start: '09:00', time_end: '13:00', time_inherited: true })
// cleared while nested but project has no time → floater, not inherited
check('edit clears, project timeless → floater', timingOnJobTimeEdit(null, null, true, P0),
  { time_start: null, time_end: null, time_inherited: false })
// not nested: whatever the user set, never inherited
check('edit, not nested → own', timingOnJobTimeEdit(null, null, false, null),
  { time_start: null, time_end: null, time_inherited: false })
// one-sided time counts as "own"
check('edit start only → own', timingOnJobTimeEdit('08:00', null, true, P),
  { time_start: '08:00', time_end: null, time_inherited: false })

// un-nest: times stay, flag drops
check('unnest → flag false', timingOnUnnest(), { time_inherited: false })

if (failures > 0) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nAll project-timing checks passed')
```

- [ ] **Step 2: Run it — must fail**

Run: `npx tsx src/lib/utils/project-timing.test.ts`
Expected: FAIL (module `./project-timing` not found).

- [ ] **Step 3: Implement** (`src/lib/utils/project-timing.ts`)

```ts
// Workflow V3 timing inheritance (spec §5). The project's time is WRITTEN
// onto nested jobs (time_inherited = true) so FCFS, clash checks, Telegram
// and installer views just see a normal job time. These pure rules decide
// every transition; routes and forms apply them.

export type Times = { time_start: string | null; time_end: string | null }

const hasOwnTime = (t: Times) => t.time_start !== null || t.time_end !== null
const hasTime    = (t: Times | null) => !!t && (t.time_start !== null || t.time_end !== null)

/** Nesting a job into a project. null = leave the job row's times untouched. */
export function timingOnNest(job: Times, project: Times):
  { time_start: string | null; time_end: string | null; time_inherited: boolean } | null {
  if (hasOwnTime(job)) return null
  if (!hasTime(project)) return null
  return { time_start: project.time_start, time_end: project.time_end, time_inherited: true }
}

/** The user saved the job form with these time values. */
export function timingOnJobTimeEdit(
  newStart: string | null, newEnd: string | null,
  isNested: boolean, project: Times | null,
): { time_start: string | null; time_end: string | null; time_inherited: boolean } {
  const cleared = newStart === null && newEnd === null
  if (isNested && cleared && hasTime(project)) {
    return { time_start: project!.time_start, time_end: project!.time_end, time_inherited: true }
  }
  return { time_start: newStart, time_end: newEnd, time_inherited: false }
}

/** Removing a job from a project: it keeps whatever times it has. */
export function timingOnUnnest(): { time_inherited: false } {
  return { time_inherited: false }
}
```

- [ ] **Step 4: Run the test — must pass**

Run: `npx tsx src/lib/utils/project-timing.test.ts`
Expected: all checks ✓, exit 0. Also `npm run type-check` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/project-timing.ts src/lib/utils/project-timing.test.ts
git commit -m "feat(v3): timing-inheritance rules (nest / edit / unnest) with standalone tests"
```

---

### Task 3: Date-range merger (pure) — TDD

**Files:**
- Create: `src/lib/utils/date-ranges.ts`
- Test: `src/lib/utils/date-ranges.test.ts`

**Interfaces:**
- Produces:
  - `mergeDateRanges(spans: { date: string; date_end: string | null }[]): { start: string; end: string }[]` — ISO in, merged + sorted out; overlapping AND adjacent (next-day) spans merge.
  - `formatRanges(ranges: { start: string; end: string }[]): string` — `"15/9/26 – 19/9/26, 23/9/26"` (single-day range renders one date; d/m/yy, Nic's format).

- [ ] **Step 1: Write the failing test** (`src/lib/utils/date-ranges.test.ts`)

```ts
/**
 * Standalone test for project date-range merging (spec §6). No framework.
 * Run: npx tsx src/lib/utils/date-ranges.test.ts — exits 1 on any failure.
 */
import { mergeDateRanges, formatRanges } from './date-ranges'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual); const e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`); failures++ }
}

check('empty → empty', mergeDateRanges([]), [])
check('single day', mergeDateRanges([{ date: '2026-09-15', date_end: null }]),
  [{ start: '2026-09-15', end: '2026-09-15' }])
check('overlap merges', mergeDateRanges([
  { date: '2026-09-15', date_end: '2026-09-17' },
  { date: '2026-09-16', date_end: '2026-09-19' },
]), [{ start: '2026-09-15', end: '2026-09-19' }])
check('adjacent (next day) merges', mergeDateRanges([
  { date: '2026-09-15', date_end: null },
  { date: '2026-09-16', date_end: null },
]), [{ start: '2026-09-15', end: '2026-09-16' }])
check('gap stays split + sorted', mergeDateRanges([
  { date: '2026-09-23', date_end: '2026-09-26' },
  { date: '2026-09-15', date_end: '2026-09-19' },
  { date: '2026-09-30', date_end: '2026-10-01' },
]), [
  { start: '2026-09-15', end: '2026-09-19' },
  { start: '2026-09-23', end: '2026-09-26' },
  { start: '2026-09-30', end: '2026-10-01' },
])
check('date_end before date is ignored (bad data)', mergeDateRanges([
  { date: '2026-09-15', date_end: '2026-09-10' },
]), [{ start: '2026-09-15', end: '2026-09-15' }])

check('format multi', formatRanges([
  { start: '2026-09-15', end: '2026-09-19' },
  { start: '2026-09-30', end: '2026-10-01' },
]), '15/9/26 – 19/9/26, 30/9/26 – 1/10/26')
check('format single-day range', formatRanges([{ start: '2026-09-23', end: '2026-09-23' }]), '23/9/26')
check('format empty', formatRanges([]), '')

if (failures > 0) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nAll date-range checks passed')
```

- [ ] **Step 2: Run it — must fail**

Run: `npx tsx src/lib/utils/date-ranges.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** (`src/lib/utils/date-ranges.ts`)

```ts
// Merge nested jobs' date spans into the "15/9/26 – 19/9/26, 23/9/26" lines
// shown on /projects cards (round 1) and folder headers (round 2). Pure
// string math on ISO dates — no Date locale calls (dates stay English).

export type Span  = { date: string; date_end: string | null }
export type Range = { start: string; end: string }

function nextDayISO(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

export function mergeDateRanges(spans: Span[]): Range[] {
  const norm = spans
    .map(s => ({ start: s.date, end: s.date_end && s.date_end > s.date ? s.date_end : s.date }))
    .sort((a, b) => a.start.localeCompare(b.start))
  const out: Range[] = []
  for (const r of norm) {
    const last = out[out.length - 1]
    if (last && r.start <= nextDayISO(last.end)) {
      if (r.end > last.end) last.end = r.end
    } else {
      out.push({ ...r })
    }
  }
  return out
}

function dmy(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${Number(d)}/${Number(m)}/${y.slice(2)}`
}

export function formatRanges(ranges: Range[]): string {
  return ranges
    .map(r => (r.start === r.end ? dmy(r.start) : `${dmy(r.start)} – ${dmy(r.end)}`))
    .join(', ')
}
```

- [ ] **Step 4: Run the test — must pass**

Run: `npx tsx src/lib/utils/date-ranges.test.ts` → all ✓. `npm run type-check` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/date-ranges.ts src/lib/utils/date-ranges.test.ts
git commit -m "feat(v3): date-range merger + d/m/yy formatter with standalone tests"
```

---

### Task 4: Picker keyword matcher (pure) — TDD

**Files:**
- Create: `src/lib/utils/project-keywords.ts`
- Test: `src/lib/utils/project-keywords.test.ts`

**Interfaces:**
- Produces:
  - `extractKeywords(name: string, client: string): string[]` — lowercase word tokens ≥ 2 chars, stop-words removed, deduped, insertion order.
  - `scoreJob(job: { project_title: string | null; client: string }, keywords: string[]): number` — count of distinct keywords found as substrings of the lowercase `title + ' ' + client`.

- [ ] **Step 1: Write the failing test** (`src/lib/utils/project-keywords.test.ts`)

```ts
/**
 * Standalone test for the + Add job picker's keyword matching (spec §4).
 * Run: npx tsx src/lib/utils/project-keywords.test.ts — exits 1 on any failure.
 */
import { extractKeywords, scoreJob } from './project-keywords'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual); const e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`); failures++ }
}

check('tokenises, lowers, drops stop-words + short words',
  extractKeywords('ABC Project — Visual Refresh', 'Luxottica'),
  ['abc', 'project', 'visual', 'refresh', 'luxottica'])
check('dedupes', extractKeywords('Fossil Fossil', 'Fossil'), ['fossil'])
check('empty in, empty out', extractKeywords('', ''), [])

const kw = extractKeywords('ABC Project — Visual Refresh', 'Luxottica')
check('full match scores high',
  scoreJob({ project_title: 'ABC Project — Jurong Point', client: 'Luxottica' }, kw), 3) // abc, project, luxottica
check('client-only match scores 1',
  scoreJob({ project_title: 'Ray-Ban window, Paragon', client: 'Luxottica' }, kw), 1)
check('no match scores 0',
  scoreJob({ project_title: 'Fossil pop-up', client: 'Fossil' }, kw), 0)
check('null title still scores client',
  scoreJob({ project_title: null, client: 'Luxottica' }, kw), 1)

if (failures > 0) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nAll keyword checks passed')
```

- [ ] **Step 2: Run it — must fail**

Run: `npx tsx src/lib/utils/project-keywords.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement** (`src/lib/utils/project-keywords.ts`)

```ts
// The + Add job picker seeds its suggestions from the project's own words:
// tokens of name + client, ranked by how many appear in each candidate job.

const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'for', 'to', 'in', 'on', 'at', 'by', 'with'])

export function extractKeywords(name: string, client: string): string[] {
  const out: string[] = []
  for (const raw of `${name} ${client}`.toLowerCase().split(/[^a-z0-9一-鿿]+/)) {
    if (raw.length < 2 || STOP.has(raw)) continue
    if (!out.includes(raw)) out.push(raw)
  }
  return out
}

export function scoreJob(
  job: { project_title: string | null; client: string },
  keywords: string[],
): number {
  const hay = `${job.project_title ?? ''} ${job.client}`.toLowerCase()
  let score = 0
  for (const k of keywords) if (hay.includes(k)) score++
  return score
}
```

- [ ] **Step 4: Run the test — must pass**

Run: `npx tsx src/lib/utils/project-keywords.test.ts` → all ✓. `npm run type-check` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/project-keywords.ts src/lib/utils/project-keywords.test.ts
git commit -m "feat(v3): picker keyword extraction + job scoring with standalone tests"
```

---

### Task 5: Project queries module

**Files:**
- Create: `src/lib/supabase/queries/projects.ts`

**Interfaces:**
- Consumes: `createClient` from `../server` (server components/routes), `createBrowserClient` from `../client` (picker), `extractKeywords`/`scoreJob` (Task 4), `mergeDateRanges` (Task 3).
- Produces (later tasks import these EXACT names):
  - `type JobProject = { id: string; name: string; client: string; description: string | null; time_start: string | null; time_end: string | null; default_punctuality: 'strict' | 'flexible' | null; created_by: string | null; r2_folder: string | null }`
  - `type ProjectJobRow = { id: string; status: string; date: string; date_end: string | null; time_start: string | null; time_end: string | null; time_inherited: boolean; project_title: string | null; client: string; location: string; punctuality: 'strict' | 'flexible'; sales_poc_id: string | null; completed_at: string | null }`
  - `type ProjectListItem = JobProject & { jobCount: number; doneCount: number; spans: { date: string; date_end: string | null }[] }`
  - `getProjectById(id): Promise<JobProject | null>` (server)
  - `getProjectJobs(projectId): Promise<ProjectJobRow[]>` (server)
  - `getProjectsList(): Promise<ProjectListItem[]>` (server)
  - `type NestableJob = { id: string; project_title: string | null; client: string; status: string; date: string; sales_poc_id: string | null; created_by: string | null }`
  - `searchNestableJobs(opts: { keywords: string[]; query: string; callerRole: string; callerId: string }): Promise<NestableJob[]>` (browser)

- [ ] **Step 1: Write the module**

```ts
import { createClient } from '../server'
import { createBrowserClient } from '../client'
import { scoreJob } from '@/lib/utils/project-keywords'

export type JobProject = {
  id: string; name: string; client: string; description: string | null
  time_start: string | null; time_end: string | null
  default_punctuality: 'strict' | 'flexible' | null
  created_by: string | null; r2_folder: string | null
}

export type ProjectJobRow = {
  id: string; status: string; date: string; date_end: string | null
  time_start: string | null; time_end: string | null; time_inherited: boolean
  project_title: string | null; client: string; location: string
  punctuality: 'strict' | 'flexible'
  sales_poc_id: string | null; completed_at: string | null
}

export type ProjectListItem = JobProject & {
  jobCount: number; doneCount: number
  spans: { date: string; date_end: string | null }[]
}

const PROJECT_SELECT = 'id, name, client, description, time_start, time_end, default_punctuality, created_by, r2_folder'

export async function getProjectById(id: string): Promise<JobProject | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('job_projects').select(PROJECT_SELECT).eq('id', id).maybeSingle()
  if (error) throw error
  return data as unknown as JobProject | null
}

export async function getProjectJobs(projectId: string): Promise<ProjectJobRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('jobs')
    .select('id, status, date, date_end, time_start, time_end, time_inherited, project_title, client, location, punctuality, sales_poc_id, completed_at')
    .eq('project_id', projectId)
    .order('date', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as ProjectJobRow[]
}

export async function getProjectsList(): Promise<ProjectListItem[]> {
  const supabase = await createClient()
  const [{ data: projects, error: pErr }, { data: jobs, error: jErr }] = await Promise.all([
    supabase.from('job_projects').select(PROJECT_SELECT).order('created_at', { ascending: false }),
    supabase.from('jobs').select('project_id, status, date, date_end').not('project_id', 'is', null),
  ])
  if (pErr) throw pErr
  if (jErr) throw jErr
  type MiniJob = { project_id: string; status: string; date: string; date_end: string | null }
  const byProject = new Map<string, MiniJob[]>()
  for (const j of (jobs ?? []) as unknown as MiniJob[]) {
    const list = byProject.get(j.project_id) ?? []
    list.push(j); byProject.set(j.project_id, list)
  }
  return ((projects ?? []) as unknown as JobProject[]).map(p => {
    const list = byProject.get(p.id) ?? []
    return {
      ...p,
      jobCount:  list.length,
      doneCount: list.filter(j => j.status === 'completed').length,
      spans:     list.map(j => ({ date: j.date, date_end: j.date_end })),
    }
  })
}

export type NestableJob = {
  id: string; project_title: string | null; client: string; status: string
  date: string; sales_poc_id: string | null; created_by: string | null
}

// Picker search (browser). Pending is personal (spec §6): when the caller is
// sales or coordinator, other people's PENDING jobs are filtered out here
// even though today's blanket RLS would return them — scheduler/admin see all.
export async function searchNestableJobs(opts: {
  keywords: string[]; query: string; callerRole: string; callerId: string
}): Promise<NestableJob[]> {
  const supabase = createBrowserClient()
  let q = supabase
    .from('jobs')
    .select('id, project_title, client, status, date, sales_poc_id, created_by')
    .is('project_id', null)
    .in('status', ['pending', 'scheduled', 'completed'])
    .order('date', { ascending: false })
    .limit(200)
  const text = opts.query.trim()
  if (text) q = q.or(`project_title.ilike.%${text}%,client.ilike.%${text}%`)
  const { data, error } = await q
  if (error) throw error
  let rows = (data ?? []) as unknown as NestableJob[]
  if (opts.callerRole === 'sales' || opts.callerRole === 'coordinator') {
    rows = rows.filter(j =>
      j.status !== 'pending' || j.sales_poc_id === opts.callerId || j.created_by === opts.callerId)
  }
  return rows
    .map(j => ({ j, s: scoreJob(j, opts.keywords) }))
    .sort((a, b) => b.s - a.s || a.j.date.localeCompare(b.j.date))
    .map(x => x.j)
    .slice(0, 30)
}
```

- [ ] **Step 2: Verify**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase/queries/projects.ts
git commit -m "feat(v3): project queries — detail, jobs, list aggregates, picker search"
```

---

### Task 6: Project API routes — create / update / delete / nest

**Files:**
- Create: `src/app/api/projects/route.ts` (POST create)
- Create: `src/app/api/projects/[id]/route.ts` (PATCH labels + timing fan-out, DELETE)
- Create: `src/app/api/projects/[id]/jobs/route.ts` (POST nest / un-nest)

**Interfaces:**
- Consumes: `timingOnNest`, `timingOnUnnest` (Task 2); `createClient`/`createServiceClient`; `getEffectiveRole`; `deleteObject` from `@/lib/storage/r2`.
- Produces:
  - `POST /api/projects` body `{ name, client, description, time_start, time_end, default_punctuality, nestJobIds: string[] }` → `{ id: string }`
  - `PATCH /api/projects/[id]` body: any subset of `{ name, client, description, time_start, time_end, default_punctuality }` → `{ ok: true }`
  - `DELETE /api/projects/[id]` → `{ ok: true }` (un-nests jobs; deletes project files/buckets/row)
  - `POST /api/projects/[id]/jobs` body `{ jobId: string; action: 'nest' | 'unnest' }` → `{ ok: true }`

Every route: auth → profile lookup by `auth_id` → `getEffectiveRole` → allow `['sales','scheduler','coordinator','admin']`, else 403. Copy the exact auth/profile boilerplate from `src/app/api/jobs/[id]/duplicate/route.ts` (lines 17–35).

- [ ] **Step 1: Write `src/app/api/projects/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getEffectiveRole } from '@/lib/utils/role-override'
import { timingOnNest } from '@/lib/utils/project-timing'
import type { Role, Punctuality } from '@/lib/supabase/types'

const MANAGER_ROLES: Role[] = ['sales', 'scheduler', 'coordinator', 'admin']

// Same pattern as the jobs r2_folder trigger (0042), app-side: date + slug + code.
function projectFolder(name: string, id: string): string {
  const slug = (name || 'Untitled')
    .replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'Untitled'
  const today = new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10) // SGT
  return `${today}_${slug}_${id.slice(0, 8)}`
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  type ProfileRow = { id: string; role: Role }
  const { data: profile } = await supabase
    .from('users').select('id, role').eq('auth_id', user.id).maybeSingle() as
    { data: ProfileRow | null; error: unknown }
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = await getEffectiveRole(profile.role)
  if (!MANAGER_ROLES.includes(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json() as {
    name?: string; client?: string; description?: string | null
    time_start?: string | null; time_end?: string | null
    default_punctuality?: Punctuality | null
    nestJobIds?: string[]
  }
  const name = (body.name ?? '').trim()
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const service = createServiceClient()
  const { data: project, error } = await service
    .from('job_projects')
    .insert({
      name,
      client:              body.client ?? '',
      description:         body.description ?? null,
      time_start:          body.time_start || null,
      time_end:            body.time_end || null,
      default_punctuality: body.default_punctuality ?? null,
      created_by:          profile.id,
    } as never)
    .select('id')
    .single() as unknown as { data: { id: string } | null; error: Error | null }
  if (error || !project) return NextResponse.json({ error: 'Insert failed' }, { status: 500 })

  await service.from('job_projects')
    .update({ r2_folder: projectFolder(name, project.id) } as never)
    .eq('id', project.id)

  // Default buckets — same four as jobs (spec §2).
  await service.from('attachment_buckets').insert([
    { project_id: project.id, name: 'PERMIT-TO-WORK', position: 0 },
    { project_id: project.id, name: 'BCA',            position: 1 },
    { project_id: project.id, name: 'DESIGNER JO',    position: 2 },
    { project_id: project.id, name: 'OTHERS',         position: 3 },
  ] as never)

  // Nest the picker's selections (created-then-nested in one Save).
  const projectTimes = { time_start: body.time_start || null, time_end: body.time_end || null }
  for (const jobId of body.nestJobIds ?? []) {
    type JobRow = { id: string; project_id: string | null; time_start: string | null; time_end: string | null }
    const { data: job } = await service.from('jobs')
      .select('id, project_id, time_start, time_end').eq('id', jobId).maybeSingle() as
      { data: JobRow | null; error: unknown }
    if (!job || job.project_id) continue
    const timing = timingOnNest({ time_start: job.time_start, time_end: job.time_end }, projectTimes)
    await service.from('jobs')
      .update({ project_id: project.id, ...(timing ?? {}) } as never)
      .eq('id', jobId)
  }

  return NextResponse.json({ id: project.id })
}
```

- [ ] **Step 2: Write `src/app/api/projects/[id]/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getEffectiveRole } from '@/lib/utils/role-override'
import { deleteObject } from '@/lib/storage/r2'
import type { Role, Punctuality } from '@/lib/supabase/types'

const MANAGER_ROLES: Role[] = ['sales', 'scheduler', 'coordinator', 'admin']

async function requireManager() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  type ProfileRow = { id: string; role: Role }
  const { data: profile } = await supabase
    .from('users').select('id, role').eq('auth_id', user.id).maybeSingle() as
    { data: ProfileRow | null; error: unknown }
  if (!profile) return null
  const role = await getEffectiveRole(profile.role)
  if (!MANAGER_ROLES.includes(role)) return null
  return { profile, role }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const auth = await requireManager()
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json() as Partial<{
    name: string; client: string; description: string | null
    time_start: string | null; time_end: string | null
    default_punctuality: Punctuality | null
  }>

  const service = createServiceClient()
  type ProjectRow = { id: string; time_start: string | null; time_end: string | null }
  const { data: project } = await service.from('job_projects')
    .select('id, time_start, time_end').eq('id', id).maybeSingle() as
    { data: ProjectRow | null; error: unknown }
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if ('name' in body)                updates.name                = (body.name ?? '').trim() || 'Untitled'
  if ('client' in body)              updates.client              = body.client ?? ''
  if ('description' in body)         updates.description         = body.description ?? null
  if ('time_start' in body)          updates.time_start          = body.time_start || null
  if ('time_end' in body)            updates.time_end            = body.time_end || null
  if ('default_punctuality' in body) updates.default_punctuality = body.default_punctuality ?? null

  const { error } = await service.from('job_projects').update(updates as never).eq('id', id)
  if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 })

  // Timing fan-out (spec §5): a changed project time is written onto every
  // job still following it. Clash checks are NOT re-run here (documented).
  const timeTouched = 'time_start' in body || 'time_end' in body
  const newStart = 'time_start' in body ? (body.time_start || null) : project.time_start
  const newEnd   = 'time_end'   in body ? (body.time_end   || null) : project.time_end
  if (timeTouched && (newStart !== project.time_start || newEnd !== project.time_end)) {
    await service.from('jobs')
      .update({ time_start: newStart, time_end: newEnd } as never)
      .eq('project_id', id)
      .eq('time_inherited', true)
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const auth = await requireManager()
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const service = createServiceClient()

  // 1. Un-nest every job — jobs are NEVER deleted (spec §3). Times stay.
  await service.from('jobs')
    .update({ project_id: null, time_inherited: false } as never)
    .eq('project_id', id)

  // 2. Delete the project's R2 objects, then rows (files → buckets → project).
  type FileRow = { id: string; kind: string; r2_key: string }
  const { data: files } = await service.from('files')
    .select('id, kind, r2_key').eq('project_id', id) as { data: FileRow[] | null; error: unknown }
  for (const f of files ?? []) {
    if (f.kind !== 'url_link' && f.r2_key) { try { await deleteObject(f.r2_key) } catch { /* row still goes */ } }
  }
  await service.from('files').delete().eq('project_id', id)
  await service.from('attachment_buckets').delete().eq('project_id', id)
  const { error } = await service.from('job_projects').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'Delete failed' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Write `src/app/api/projects/[id]/jobs/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getEffectiveRole } from '@/lib/utils/role-override'
import { timingOnNest, timingOnUnnest } from '@/lib/utils/project-timing'
import type { Role } from '@/lib/supabase/types'

const MANAGER_ROLES: Role[] = ['sales', 'scheduler', 'coordinator', 'admin']

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  type ProfileRow = { id: string; role: Role }
  const { data: profile } = await supabase
    .from('users').select('id, role').eq('auth_id', user.id).maybeSingle() as
    { data: ProfileRow | null; error: unknown }
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = await getEffectiveRole(profile.role)
  if (!MANAGER_ROLES.includes(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { jobId, action } = await req.json() as { jobId?: string; action?: 'nest' | 'unnest' }
  if (!jobId || (action !== 'nest' && action !== 'unnest')) {
    return NextResponse.json({ error: 'jobId and action (nest|unnest) required' }, { status: 400 })
  }

  const service = createServiceClient()
  type JobRow = { id: string; project_id: string | null; time_start: string | null; time_end: string | null }
  const { data: job } = await service.from('jobs')
    .select('id, project_id, time_start, time_end').eq('id', jobId).maybeSingle() as
    { data: JobRow | null; error: unknown }
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

  if (action === 'nest') {
    if (job.project_id === projectId) return NextResponse.json({ ok: true }) // idempotent
    if (job.project_id) return NextResponse.json({ error: 'Job is already in another project' }, { status: 409 })
    type ProjectRow = { time_start: string | null; time_end: string | null }
    const { data: project } = await service.from('job_projects')
      .select('time_start, time_end').eq('id', projectId).maybeSingle() as
      { data: ProjectRow | null; error: unknown }
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    const timing = timingOnNest(
      { time_start: job.time_start, time_end: job.time_end },
      { time_start: project.time_start, time_end: project.time_end },
    )
    await service.from('jobs')
      .update({ project_id: projectId, ...(timing ?? {}) } as never).eq('id', jobId)
  } else {
    if (job.project_id !== projectId) return NextResponse.json({ ok: true }) // idempotent
    await service.from('jobs')
      .update({ project_id: null, ...timingOnUnnest() } as never).eq('id', jobId)
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Verify + commit**

Run: `npm run type-check` → PASS. Run `npm run build` → PASS (routes compile).

```bash
git add src/app/api/projects
git commit -m "feat(v3): project routes — create/update/delete + nest/un-nest with timing write-through"
```

---

### Task 7: `tplProjectPushed` + push route

**Files:**
- Modify: `src/lib/telegram/templates.ts` (append one function)
- Create: `src/app/api/projects/[id]/push/route.ts`

**Interfaces:**
- Consumes: `mergeDateRanges`/`formatRanges` (Task 3), `getSchedulers` from `@/lib/supabase/queries/notifications`, `sendTelegram` from `@/lib/telegram/bot`.
- Produces:
  - `tplProjectPushed(p: { projectName: string; client: string; count: number; ranges: string; byName: string; projectUrl: string }): string`
  - `POST /api/projects/[id]/push` body `{ jobIds: string[] }` → `{ pushed: string[]; held: { id: string; reason: 'not-pending' | 'not-yours' | 'not-nested' }[] }`. The CLIENT runs the per-job clash checks first (existing `GET /api/jobs/[id]/clashes`) and only sends the clean ids — see Task 10.

- [ ] **Step 1: Append the template to `src/lib/telegram/templates.ts`** (after `tplJobAssigned`, same style)

```ts
export function tplProjectPushed(p: {
  projectName: string
  client:      string
  count:       number
  ranges:      string
  byName:      string
  projectUrl:  string
}): string {
  return (
    `📦 <b>Project Pushed — Assign Installers</b>\n` +
    `<b>${p.projectName}</b>\n` +
    `Client: ${p.client}\n` +
    `${p.count} job${p.count === 1 ? '' : 's'}${p.ranges ? ` · ${p.ranges}` : ''}\n` +
    `Pushed by: ${p.byName}\n\n` +
    `<a href="${p.projectUrl}">View project →</a>`
  )
}
```

- [ ] **Step 2: Write `src/app/api/projects/[id]/push/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getEffectiveRole } from '@/lib/utils/role-override'
import { getSchedulers } from '@/lib/supabase/queries/notifications'
import { sendTelegram } from '@/lib/telegram/bot'
import { tplProjectPushed } from '@/lib/telegram/templates'
import { mergeDateRanges, formatRanges } from '@/lib/utils/date-ranges'
import type { Role } from '@/lib/supabase/types'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://greenqubes-ops.vercel.app'
const MANAGER_ROLES: Role[] = ['sales', 'scheduler', 'coordinator', 'admin']

// Bulk push: transitions the given nested PENDING jobs to scheduled and sends
// ONE summary Telegram to schedulers (per-job tplNewJobCreated is deliberately
// NOT sent here — spec §7). The client has already run the per-job clash
// checks and only sends clean ids; this route re-verifies ownership/status.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  type ProfileRow = { id: string; name: string; role: Role }
  const { data: profile } = await supabase
    .from('users').select('id, name, role').eq('auth_id', user.id).maybeSingle() as
    { data: ProfileRow | null; error: unknown }
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = await getEffectiveRole(profile.role)
  if (!MANAGER_ROLES.includes(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { jobIds } = await req.json() as { jobIds?: string[] }
  if (!Array.isArray(jobIds) || jobIds.length === 0) {
    return NextResponse.json({ error: 'jobIds required' }, { status: 400 })
  }

  const service = createServiceClient()
  type ProjectRow = { id: string; name: string; client: string }
  const { data: project } = await service.from('job_projects')
    .select('id, name, client').eq('id', projectId).maybeSingle() as
    { data: ProjectRow | null; error: unknown }
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  type JobRow = { id: string; status: string; project_id: string | null; sales_poc_id: string | null; created_by: string | null; date: string; date_end: string | null }
  const { data: jobs } = await service.from('jobs')
    .select('id, status, project_id, sales_poc_id, created_by, date, date_end')
    .in('id', jobIds) as { data: JobRow[] | null; error: unknown }

  const pushed: string[] = []
  const held: { id: string; reason: 'not-pending' | 'not-yours' | 'not-nested' }[] = []
  for (const job of jobs ?? []) {
    if (job.project_id !== projectId)   { held.push({ id: job.id, reason: 'not-nested' });  continue }
    if (job.status !== 'pending')       { held.push({ id: job.id, reason: 'not-pending' }); continue }
    // Sales (and suggest-only coordinators) push only their own jobs — the
    // 0036 rule, mirrored here because this runs on the service client.
    if ((role === 'sales' || role === 'coordinator')
        && job.sales_poc_id !== profile.id && job.created_by !== profile.id) {
      held.push({ id: job.id, reason: 'not-yours' }); continue
    }
    const { error } = await service.from('jobs')
      .update({ status: 'scheduled' } as never).eq('id', job.id)
    if (error) held.push({ id: job.id, reason: 'not-pending' })
    else pushed.push(job.id)
  }

  if (pushed.length > 0) {
    const pushedRows = (jobs ?? []).filter(j => pushed.includes(j.id))
    const ranges = formatRanges(mergeDateRanges(pushedRows.map(j => ({ date: j.date, date_end: j.date_end }))))
    const message = tplProjectPushed({
      projectName: project.name,
      client:      project.client,
      count:       pushed.length,
      ranges,
      byName:      profile.name,
      projectUrl:  `${APP_URL}/projects/${projectId}`,
    })
    const schedulers = await getSchedulers()
    await Promise.all(
      schedulers.filter(s => s.telegram_chat_id).map(s => sendTelegram(s.telegram_chat_id!, message)),
    )
  }

  return NextResponse.json({ pushed, held })
}
```

- [ ] **Step 3: Verify + commit**

Run: `npm run type-check` and `npm run build` → PASS.

```bash
git add src/lib/telegram/templates.ts "src/app/api/projects/[id]/push/route.ts"
git commit -m "feat(v3): push-from-project route + one-summary tplProjectPushed"
```

---

### Task 8: i18n strings (project UI) + Workspaces rename

**Files:**
- Modify: `src/lib/i18n/en.ts`, `src/lib/i18n/zh.ts` (values only — key names NEVER change; `bn.ts` untouched, it falls back per-key)

**Interfaces:**
- Produces new keys later tasks call via `t(lang, key)`: `jpTitle, jpSwitchLabel, jpSwitchHint, jpDefaultPunctuality, jpDefaultPunctualityHint, jpTimingHint, jpNestedJobs, jpAddJob, jpNewJobHere, jpPickerTitle, jpPickerSearch, jpPickerMatching, jpNest, jpNested, jpInOtherProject, jpRemoveFromProject, jpSaveProject, jpPushToSchedule, jpDeleteProject, jpDeleteConfirm, jpEmptyTitle, jpEmptyBody, jpPushedCount, jpHeldCount, jpHeldNotYours, jpProjectsTitle, jpNoProjects, jpJobsDone, jpNoTeamChat, jpSaveFirstFiles`

- [ ] **Step 1: Add the new keys to `en.ts`** (new block after the assistant section; every key must also be added to the `Translations` type if `en.ts` derives it — follow the file's existing mechanism):

```ts
  // ── Job projects (Workflow V3) ────────────────────────────────────────────
  jpTitle: 'New Project',
  jpSwitchLabel: 'Multiple jobs',
  jpSwitchHint: 'A container with labels. Nothing is copied — nest jobs here and they fold under this project on the schedule.',
  jpDefaultPunctuality: 'Default punctuality for new jobs',
  jpDefaultPunctualityHint: 'Only pre-fills jobs created inside this project. Every job keeps its own punctuality.',
  jpTimingHint: 'Project timing — used for nested jobs that have no time of their own.',
  jpNestedJobs: 'Jobs in this project',
  jpAddJob: 'Add job',
  jpNewJobHere: 'New job in this project',
  jpPickerTitle: 'Add job to',
  jpPickerSearch: 'Search pending, scheduled and completed jobs…',
  jpPickerMatching: 'Matching',
  jpNest: 'Nest',
  jpNested: 'Nested',
  jpInOtherProject: 'In another project',
  jpRemoveFromProject: 'Remove from project',
  jpSaveProject: 'Save project',
  jpPushToSchedule: 'Push to schedule',
  jpDeleteProject: 'Delete project',
  jpDeleteConfirm: 'Delete this project? Its jobs are kept — they just leave the project.',
  jpEmptyTitle: 'This project has no jobs yet',
  jpEmptyBody: 'Add existing jobs with + Add job, or create one inside this project. Then push.',
  jpPushedCount: 'jobs pushed to the schedule. Schedulers notified once for the project.',
  jpHeldCount: 'jobs need a look — they stay pending:',
  jpHeldNotYours: 'Created by someone else — they push it, or a scheduler does',
  jpProjectsTitle: 'Projects',
  jpNoProjects: 'No projects yet. Flick "Multiple jobs" on the New Job form to create one.',
  jpJobsDone: 'done',
  jpNoTeamChat: 'Projects have no team or chat — each job keeps its own.',
  jpSaveFirstFiles: 'Save the project first to add shared files.',
```

- [ ] **Step 2: Add the same keys to `zh.ts`**

```ts
  // ── 任务项目（Workflow V3）───────────────────────────────────────────────
  jpTitle: '新建项目',
  jpSwitchLabel: '多个任务',
  jpSwitchHint: '这是一个带标签的容器，不会复制任何内容——把任务放进来，它们会在日程表中折叠到这个项目下。',
  jpDefaultPunctuality: '新任务的默认准时要求',
  jpDefaultPunctualityHint: '仅用于预填在此项目内新建的任务，每个任务保留自己的准时要求。',
  jpTimingHint: '项目时间——用于没有自己时间的嵌套任务。',
  jpNestedJobs: '项目内的任务',
  jpAddJob: '添加任务',
  jpNewJobHere: '在此项目中新建任务',
  jpPickerTitle: '添加任务到',
  jpPickerSearch: '搜索待定、已排期和已完成的任务…',
  jpPickerMatching: '匹配',
  jpNest: '加入',
  jpNested: '已加入',
  jpInOtherProject: '已在其他项目中',
  jpRemoveFromProject: '从项目中移除',
  jpSaveProject: '保存项目',
  jpPushToSchedule: '推送到日程',
  jpDeleteProject: '删除项目',
  jpDeleteConfirm: '删除此项目？任务会保留——它们只是离开这个项目。',
  jpEmptyTitle: '此项目还没有任务',
  jpEmptyBody: '用「添加任务」加入现有任务，或直接在项目内新建，然后再推送。',
  jpPushedCount: '个任务已推送到日程。调度员已收到一条项目通知。',
  jpHeldCount: '个任务需要处理——它们保持待定：',
  jpHeldNotYours: '由他人创建——由本人或调度员推送',
  jpProjectsTitle: '项目',
  jpNoProjects: '还没有项目。在新建任务表单中打开「多个任务」即可创建。',
  jpJobsDone: '已完成',
  jpNoTeamChat: '项目没有团队和聊天——每个任务保留自己的。',
  jpSaveFirstFiles: '先保存项目，再添加共享文件。',
```

- [ ] **Step 3: Workspaces rename — change ONLY the VALUES of the existing assistant keys** (spec §10). In `en.ts` (the block currently at ~line 207):

```ts
  projects: 'Workspaces',
  newProject: 'New workspace',
  projectName: 'Workspace name',
  projectSettings: 'Workspace settings',
  newChatInProject: 'New chat in this workspace',
  projectDelete: 'Delete workspace',
  projectDeleteConfirm: 'Delete this workspace? Its chats are kept and move back to your history.',
  projectInstructions: 'Workspace instructions',
  projectInstructionsHint: 'The assistant follows these in every chat inside this workspace.',
  projectFiles: 'Workspace files',
  projectFilesHint: 'Shared with every chat in this workspace. Images and PDF only, up to 10 files / 20 MB.',
  projectAddFile: 'Add file',
  projectFileTooMany: 'Up to 10 files per workspace.',
  projectFileTotalTooLarge: 'Workspace files can total up to 20 MB.',
  moveToProject: 'Move to workspace',
  noProject: 'No workspace',
```

In `zh.ts` (~line 106): replace `项目` with `工作区` in those same 16 values (e.g. `projects: '工作区'`, `newProject: '新建工作区'`, `moveToProject: '移至工作区'`, `noProject: '不属于任何工作区'`). Do NOT touch `projectTitle: 'Project Title'` (that's the job form) or `fcfsJobColumn`.

- [ ] **Step 4: Sweep for hardcoded "project" strings in the assistant UI**

Run: `grep -rn "roject" src/features/assistant --include=*.tsx | grep -v "projectId\|project_id\|ProjectPanel\|asst_project\|Props\|import\|type "`
Expected: any surviving user-visible literal saying "project" in assistant components gets swapped to the t() key or reworded to "workspace" (values only, no renamed identifiers). If the grep only shows identifiers/comments, nothing to change.

- [ ] **Step 5: Verify + commit**

Run: `npm run type-check` → PASS (Translations type accepts the new keys in en + zh).

```bash
git add src/lib/i18n/en.ts src/lib/i18n/zh.ts src/features/assistant
git commit -m "feat(v3): project i18n strings + assistant Projects → Workspaces rename (en/zh)"
```

---

### Task 9: AddJobPicker component

**Files:**
- Create: `src/features/projects/AddJobPicker.tsx`

**Interfaces:**
- Consumes: `searchNestableJobs`, `NestableJob` (Task 5), `extractKeywords` (Task 4), `t`/`LangCode`.
- Produces: `<AddJobPicker open projectName client lang callerRole callerId nestedIds onNest={(job: NestableJob) => void} onNewJobHere={(() => void) | null} onClose />` — a bottom sheet (`z-[60]`); parent owns what "Nest" does (API call in edit mode, local list in new mode).

- [ ] **Step 1: Write the component**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { Plus, Search, X } from 'lucide-react'
import { t } from '@/lib/i18n'
import { extractKeywords } from '@/lib/utils/project-keywords'
import { searchNestableJobs, type NestableJob } from '@/lib/supabase/queries/projects'
import type { LangCode } from '@/lib/i18n'

interface Props {
  open:         boolean
  projectName:  string
  client:       string
  lang:         LangCode
  callerRole:   string
  callerId:     string
  nestedIds:    string[]          // already nested (this project) — shown disabled
  onNest:       (job: NestableJob) => void
  onNewJobHere: (() => void) | null   // null = hidden (unsaved new project)
  onClose:      () => void
}

const fmtDate = (iso: string) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}` }

export function AddJobPicker({
  open, projectName, client, lang, callerRole, callerId, nestedIds, onNest, onNewJobHere, onClose,
}: Props) {
  const [query,   setQuery]   = useState('')
  const [rows,    setRows]    = useState<NestableJob[]>([])
  const [loading, setLoading] = useState(false)
  const keywords = extractKeywords(projectName, client)

  useEffect(() => {
    if (!open) return
    let stale = false
    setLoading(true)
    const timer = setTimeout(() => {
      searchNestableJobs({ keywords, query, callerRole, callerId })
        .then(r => { if (!stale) setRows(r) })
        .catch(() => { if (!stale) setRows([]) })
        .finally(() => { if (!stale) setLoading(false) })
    }, 250)
    return () => { stale = true; clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, query])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-end bg-ink/40" onClick={onClose}>
      <div
        className="w-full max-h-[85vh] overflow-y-auto rounded-t-2xl bg-paper p-4 pb-6"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-label={`${t(lang, 'jpPickerTitle')} ${projectName}`}
      >
        <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-line" />
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-display text-base font-medium text-ink">
            {t(lang, 'jpPickerTitle')} {projectName || '…'}
          </h3>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 text-muted hover:text-ink">
            <X size={16} />
          </button>
        </div>

        <div className="flex items-center gap-2 rounded-[10px] border border-line bg-bg px-3 py-2 mb-2">
          <Search size={14} className="text-muted shrink-0" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t(lang, 'jpPickerSearch')}
            className="w-full bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none"
          />
        </div>

        {keywords.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            <span className="text-[10px] uppercase tracking-wide text-muted">{t(lang, 'jpPickerMatching')}</span>
            {keywords.slice(0, 5).map(k => (
              <span key={k} className="rounded-full border border-terracotta bg-terracotta/10 px-2 py-0.5 text-[11px] text-terracotta">{k}</span>
            ))}
          </div>
        )}

        {loading && <p className="py-4 text-center text-sm text-muted">…</p>}
        {!loading && rows.map(job => {
          const already = nestedIds.includes(job.id)
          return (
            <div key={job.id} className="flex items-center justify-between gap-2 border-b border-line py-2.5">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-ink">{job.project_title || job.client || 'Untitled job'}</p>
                <p className="text-[11px] text-muted">
                  <span className="capitalize">{job.status}</span> · {fmtDate(job.date)} · {job.client}
                </p>
              </div>
              <button
                type="button"
                disabled={already}
                onClick={() => onNest(job)}
                className={already
                  ? 'shrink-0 rounded-full border border-line bg-bg px-3 py-1 text-xs font-medium text-muted'
                  : 'shrink-0 rounded-full border border-terracotta bg-terracotta/10 px-3 py-1 text-xs font-medium text-terracotta'}
              >
                {already ? t(lang, 'jpNested') : t(lang, 'jpNest')}
              </button>
            </div>
          )
        })}

        {onNewJobHere && (
          <button
            type="button"
            onClick={onNewJobHere}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line py-2.5 text-sm font-medium text-ink2 hover:border-ink2"
          >
            <Plus size={14} />{t(lang, 'jpNewJobHere')}
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify + commit**

Run: `npm run type-check` → PASS.

```bash
git add src/features/projects/AddJobPicker.tsx
git commit -m "feat(v3): AddJobPicker bottom sheet — keyword-seeded search, nest, new-job-here"
```

---

### Task 10: ProjectFormShell (new + edit modes)

**Files:**
- Create: `src/features/projects/ProjectFormShell.tsx`

**Interfaces:**
- Consumes: `JobFormLayout` (lockedTabs mechanism), `CollapseCard`, `Field`, `Card`, `Modal`, `Btn`, `CompanyBar`, `AddJobPicker` (Task 9), `AttachmentBuckets` (project mode arrives in Task 12 — until then the edit-mode Files tab shows the same locked placeholder as new mode; Task 12 swaps it in), `JobProject`/`ProjectJobRow`/`NestableJob` (Task 5), routes (Tasks 6–7), i18n keys (Task 8), `ClashesResponse` type from `@/app/api/jobs/[id]/clashes/route`.
- Produces: `<ProjectFormShell mode="new" | "edit" lang role userId project? initialJobs? />` used by NewJobShell (Task 11, mode="new" — NewJobShell renders it when the switch is on) and `/projects/[id]` (Task 13, mode="edit").

Behaviour contract (all from the spec/mockup):
- Details card: name ("Project title"), client, description, start/end time + `jpTimingHint`, 3-state default punctuality (Not set / Strict / Flexible) + `jpDefaultPunctualityHint`.
- `JobFormLayout` with `lockedTabs={['team', 'chat']}`; team/chat nodes are placeholder Cards with `jpNoTeamChat`; files node: locked placeholder `jpSaveFirstFiles` (both modes, until Task 12 upgrades edit mode).
- "Multiple jobs" card lists jobs: title, date (+`date_end` with –), time chip ("own time" vs dashed "project timing" via `time_inherited`), status chip, × (edit mode: calls unnest route then refreshes; new mode: removes from local list). `+ Add job` opens AddJobPicker. New mode: `onNewJobHere={null}`; edit mode: `onNewJobHere` routes to `/jobs/new?project=<id>`.
- Action bars — new mode: Cancel + `jpSaveProject` (POST `/api/projects` with `nestJobIds` from local picks → `router.push('/projects/' + id)`); edit mode: `jpDeleteProject` (confirm modal → DELETE route → `/schedule`) + `jpSaveProject` (PATCH) + `jpPushToSchedule`.
- Push flow (edit mode): if `jobs.filter(pending).length === 0` and total jobs 0 → empty modal (`jpEmptyTitle`/`jpEmptyBody`, "Add job" button opens picker). Otherwise: for each nested pending job `GET /api/jobs/${id}/clashes`; partition — clean ids → `POST /api/projects/[id]/push`; response `held` + client-side clash holds render in a result sheet ("`{pushed}` / `{total}` `jpPushedCount`", held list with reason — clash text or `jpHeldNotYours` — and an Open link to `/jobs/[id]`). Refresh jobs after.

- [ ] **Step 1: Write the component.** This is the largest file of the round (~450 lines). Skeleton with every state and handler — fill JSX per the contract above, copying visual classes from `NewJobShell.tsx` (action bar, cards) and the round-4 mockup (`public/mockups/workflow-v3-nesting/index.html`, screen 1):

```tsx
'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Lock, Plus, X } from 'lucide-react'
import { t } from '@/lib/i18n'
import { useToast } from '@/components/Toast'
import { Card } from '@/components/Card'
import { Field } from '@/components/Field'
import { Modal } from '@/components/Modal'
import { Btn } from '@/components/Btn'
import { CompanyBar } from '@/components/CompanyBar'
import { JobFormLayout } from '@/features/job-detail/JobFormLayout'
import { CollapseCard } from '@/features/job-detail/CollapseCard'
import { AddJobPicker } from './AddJobPicker'
import type { JobProject, ProjectJobRow, NestableJob } from '@/lib/supabase/queries/projects'
import type { ClashesResponse } from '@/app/api/jobs/[id]/clashes/route'
import type { LangCode } from '@/lib/i18n'
import type { Role, Punctuality } from '@/lib/supabase/types'

interface Props {
  mode:        'new' | 'edit'
  lang:        LangCode
  role:        Role
  userId:      string
  project?:    JobProject          // edit mode
  initialJobs?: ProjectJobRow[]    // edit mode
}

type Held = { id: string; title: string; reason: string }

export function ProjectFormShell({ mode, lang, role, userId, project, initialJobs = [] }: Props) {
  const router = useRouter()
  const { error: showError, success: showSuccess } = useToast()

  // ── labels ──
  const [name,        setName]        = useState(project?.name ?? '')
  const [client,      setClient]      = useState(project?.client ?? '')
  const [description, setDescription] = useState(project?.description ?? '')
  const [timeStart,   setTimeStart]   = useState(project?.time_start ?? '')
  const [timeEnd,     setTimeEnd]     = useState(project?.time_end ?? '')
  const [defPunct,    setDefPunct]    = useState<Punctuality | null>(project?.default_punctuality ?? null)

  // ── nesting ──
  const [jobs,     setJobs]     = useState<ProjectJobRow[]>(initialJobs)   // edit mode source of truth
  const [picks,    setPicks]    = useState<NestableJob[]>([])              // new mode accumulator
  const [pickerOpen, setPickerOpen] = useState(false)

  // ── flows ──
  const [saving,      setSaving]      = useState(false)
  const [emptyOpen,   setEmptyOpen]   = useState(false)
  const [deleteOpen,  setDeleteOpen]  = useState(false)
  const [pushResult,  setPushResult]  = useState<{ pushed: number; total: number; held: Held[] } | null>(null)

  const nestedIds = useMemo(
    () => (mode === 'new' ? picks.map(p => p.id) : jobs.map(j => j.id)),
    [mode, picks, jobs],
  )

  async function refreshJobs() { /* edit mode: re-fetch via browser client — same select as getProjectJobs but through createBrowserClient; setJobs(result) */ }
  async function handleNest(job: NestableJob) { /* new: setPicks([...picks, job]); edit: POST /api/projects/[id]/jobs {jobId, action:'nest'} then refreshJobs(); errors → showError */ }
  async function handleUnnest(jobId: string) { /* new: filter picks; edit: POST … action:'unnest' then refreshJobs() */ }
  async function handleSave() { /* new: POST /api/projects {…labels, nestJobIds: picks.map(id)} → router.push(`/projects/${id}`); edit: PATCH /api/projects/[id] {…labels} → showSuccess */ }
  async function handleDelete() { /* DELETE /api/projects/[id] → router.push('/schedule') */ }
  async function handlePush() {
    /* edit mode only.
       const pending = jobs.filter(j => j.status === 'pending')
       if (jobs.length === 0) { setEmptyOpen(true); return }
       if (pending.length === 0) { showError(t(lang,'jpEmptyTitle')); return }
       setSaving(true)
       const clean: string[] = []; const held: Held[] = []
       for (const job of pending) {
         const res = await fetch(`/api/jobs/${job.id}/clashes`)
         if (!res.ok) { held.push({ id: job.id, title: job.project_title ?? job.client, reason: 'check failed' }); continue }
         const c: ClashesResponse = await res.json()
         if (c.clashes.length || c.softClashes.length || c.travelWarnings.length) {
           const first = c.clashes[0] ?? c.softClashes[0] ?? c.travelWarnings[0]
           held.push({ id: job.id, title: job.project_title ?? job.client, reason: `Clash: ${(first as { installerName?: string }).installerName ?? 'see job'}` })
         } else clean.push(job.id)
       }
       let pushedCount = 0
       if (clean.length) {
         const res = await fetch(`/api/projects/${project!.id}/push`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobIds: clean }) })
         if (res.ok) {
           const out = await res.json() as { pushed: string[]; held: { id: string; reason: string }[] }
           pushedCount = out.pushed.length
           for (const h of out.held) held.push({ id: h.id, title: jobs.find(j => j.id === h.id)?.project_title ?? '', reason: h.reason === 'not-yours' ? t(lang, 'jpHeldNotYours') : h.reason })
         } else { showError(t(lang, 'saveError')); setSaving(false); return }
       }
       setPushResult({ pushed: pushedCount, total: pending.length, held })
       await refreshJobs(); setSaving(false) */
  }

  // JSX per the behaviour contract (details card / multiple-jobs card /
  // JobFormLayout lockedTabs=['team','chat'] / action bars / AddJobPicker /
  // empty + delete Modals / push-result sheet). Copy chrome classes from
  // NewJobShell; every overlay z-[60]+.
  return (/* … */)
}
```

The comment-bodied handlers above ARE the implementation contract — write them out as real code exactly as described (they are deliberately spelled out step-by-step in the comments; no behaviour is left open). Note the field-name detail inside clash objects: open `src/app/api/jobs/[id]/clashes/route.ts` and read the actual `Clash` type before writing the `reason` line — use its real installer-name property.

- [ ] **Step 2: Verify + commit**

Run: `npm run type-check` → PASS. Run `npm run lint` → no new errors in the file.

```bash
git add src/features/projects/ProjectFormShell.tsx
git commit -m "feat(v3): ProjectFormShell — details, nesting card, save/delete, push flow with result sheet"
```

---

### Task 11: NewJobShell — the "Multiple jobs" switch + project prefill

**Files:**
- Modify: `src/features/job-detail/NewJobShell.tsx`
- Modify: `src/app/jobs/new/page.tsx`

**Interfaces:**
- Consumes: `ProjectFormShell` (Task 10), `getProjectById`/`JobProject` (Task 5), `timingOnNest` (Task 2), i18n keys (Task 8).
- Produces: `NewJobShell` gains optional prop `projectPrefill?: { id: string; name: string; client: string; description: string | null; default_punctuality: Punctuality | null; time_start: string | null; time_end: string | null }`.

- [ ] **Step 1: The switch (project mode).** In `NewJobShell`, add state `const [isProject, setIsProject] = useState(false)` and, directly after the back-arrow header block (before `<JobFormLayout …>`), an early return when on:

```tsx
  if (isProject) {
    return (
      <div className="min-h-screen bg-bg pb-28">
        <CompanyBar lang={lang} />
        <div className="max-w-2xl lg:max-w-6xl mx-auto px-4 pt-5 pb-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/schedule" className="text-ink2 hover:text-ink shrink-0"><ArrowLeft size={18} /></Link>
              <h1 className="font-display text-xl font-semibold text-ink">{t(lang, 'jpTitle')}</h1>
            </div>
            <ProjectToggle on onToggle={() => setIsProject(false)} lang={lang} />
          </div>
        </div>
        <ProjectFormShell mode="new" lang={lang} role={role} userId={userId} />
      </div>
    )
  }
```

…and in the normal (off) rendering, put the same `ProjectToggle` (a small labelled switch component defined at the bottom of the file — `role="switch"`, `aria-checked`, the mockup's pill look) in the header row next to the "New job" `<h1>`. Show the toggle only when `!projectPrefill` (a job being created inside a project must not itself become a project). ProjectFormShell renders its own layout, so the switch-on path replaces the job form wholesale — exactly the mockup's behaviour.

- [ ] **Step 2: Prefill mode.** Add `projectPrefill` to `Props`. In `useForm` `defaultValues`, when `projectPrefill` is set:
  - `project_title: `${projectPrefill.name} — ``
  - `client: projectPrefill.client`
  - `description: projectPrefill.description ?? ''`
  - `punctuality: projectPrefill.default_punctuality ?? 'strict'`
  (times stay empty — inheritance is decided at insert). In `saveJob`, extend the `.insert({...})` payload:

```ts
          ...(projectPrefill ? {
            project_id: projectPrefill.id,
            ...(timingOnNest(
              { time_start: values.time_start || null, time_end: values.time_end || null },
              { time_start: projectPrefill.time_start, time_end: projectPrefill.time_end },
            ) ?? {}),
          } : {}),
```

Also show a small non-interactive line under the `<h1>` when prefilled: `<p className="text-xs text-muted">Part of {projectPrefill.name}</p>`.

- [ ] **Step 3: `src/app/jobs/new/page.tsx`** — accept `searchParams: Promise<{ project?: string }>`, and when present load the project:

```ts
  const sp = await searchParams
  const projectPrefill = sp.project ? await getProjectById(sp.project) : null
```

Pass `projectPrefill={projectPrefill ? { id: projectPrefill.id, name: projectPrefill.name, client: projectPrefill.client, description: projectPrefill.description, default_punctuality: projectPrefill.default_punctuality, time_start: projectPrefill.time_start, time_end: projectPrefill.time_end } : undefined}` into `NewJobShell` (import `getProjectById` from `@/lib/supabase/queries/projects`).

- [ ] **Step 4: Verify + commit**

Run: `npm run type-check` and `npm run build` → PASS.
Manual check (dev server): `/jobs/new` shows the switch; flicking it swaps to the New Project form and back losslessly for the switch itself (job-form typing loss on toggle is acceptable — the mockup's approved behaviour).

```bash
git add src/features/job-detail/NewJobShell.tsx src/app/jobs/new/page.tsx
git commit -m "feat(v3): Multiple-jobs switch on New Job + new-job-in-project prefill"
```

---

### Task 12: Project files — upload path + AttachmentBuckets project mode + file/bucket routes

**Files:**
- Modify: `src/lib/storage/r2.ts` (project key/upload helpers)
- Modify: `src/app/api/r2/upload-url/route.ts` (projectId branch)
- Modify: `src/app/api/files/[id]/route.ts` and `src/app/api/buckets/[id]/route.ts` (project-owned rows)
- Modify: `src/features/job-detail/AttachmentBuckets.tsx` (optional `projectId` target)
- Modify: `src/lib/supabase/queries/jobs.ts` (`getProjectBucketsQ` alongside `getJobBuckets`)
- Modify: `src/features/projects/ProjectFormShell.tsx` (edit-mode Files tab renders the real component)

**Interfaces:**
- Produces: `generateProjectKey(folder, kind, originalName)` and `getProjectFileUploadUrl(folder, kind, filename, contentType)` in r2.ts; `POST /api/r2/upload-url` accepts `{ projectId }` instead of `{ jobId }`; `AttachmentBuckets` props gain `projectId?: string` (exactly one of jobId/projectId); `getProjectBucketsQ(projectId): Promise<AttachmentBucket[]>` (browser client, mirrors `getJobBuckets` with `.eq('project_id', …)`).

- [ ] **Step 1: r2.ts** — add below `getUploadUrlForKind` (mirror it exactly, `projects/` prefix):

```ts
export function generateProjectKey(folder: string, kind: FileKind, originalName: string): string {
  const ext  = originalName.includes('.') ? originalName.split('.').pop() : undefined
  const name = ext ? `${randomUUID()}.${ext}` : randomUUID()
  return `projects/${folder}/${KIND_FOLDER[kind]}/${name}`
}

export async function getProjectFileUploadUrl(
  folder: string, kind: FileKind, filename: string, contentType: string,
): Promise<{ url: string; key: string }> {
  const key = generateProjectKey(folder, kind, filename)
  const url = await getSignedUrl(
    r2,
    new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType }),
    { expiresIn: 300 },
  )
  void logApiUsage({ service: 'r2', endpoint: 'put', estimated_cost: 0 })
  return { url, key }
}
```

- [ ] **Step 2: upload-url route** — body gains optional `projectId`; require exactly one of jobId/projectId. Project branch: look up `job_projects.r2_folder` on the SESSION client (RLS scopes it to office roles) **and** check the caller's effective role is in `['sales','scheduler','coordinator','admin']` (uploads are manager-only on projects); 404 if not found, 403 otherwise; respond via `getProjectFileUploadUrl(project.r2_folder ?? projectId, …)`. Job branch unchanged.

- [ ] **Step 3: files/buckets routes** — in `DELETE+PATCH /api/files/[id]` and `DELETE /api/buckets/[id]`: rows load `project_id` too; when `project_id` is set, replace the `canManageJobFiles(role, job.status)` check with `role in ['sales','scheduler','coordinator','admin']` (projects have no completed lock) and skip the job lookup. The bucket route's Designer-JO guard applies to project buckets exactly as job buckets. Move-file (PATCH) between buckets must stay within the same owner: destination bucket's `project_id` must equal the file's.

- [ ] **Step 4: AttachmentBuckets** — props gain `projectId?: string` (make `jobId` optional; add a dev-time `if (!jobId === !projectId) throw` guard). Everywhere the component does `.eq('job_id', jobId)`, `getJobBuckets(jobId)`, upload-url `{ jobId }`, or inserts `{ job_id: jobId }` rows, branch on the target: `projectId` uses `getProjectBucketsQ(projectId)` / `{ projectId }` / `{ project_id: projectId }`. New-bucket insert sets the matching owner column only.

- [ ] **Step 5: ProjectFormShell edit-mode Files tab** — replace the locked placeholder with:

```tsx
          <AttachmentBuckets projectId={project!.id} userId={userId} lang={lang} readOnly={!['sales','scheduler','coordinator','admin'].includes(role)} />
```

(new mode keeps the `jpSaveFirstFiles` placeholder).

- [ ] **Step 6: Verify + commit**

Run: `npm run type-check`, `npm run build`, and the existing suite `npx tsx src/lib/storage/job-file-permissions.test.ts` → all PASS.

```bash
git add src/lib/storage/r2.ts src/app/api/r2/upload-url/route.ts "src/app/api/files/[id]/route.ts" "src/app/api/buckets/[id]/route.ts" src/features/job-detail/AttachmentBuckets.tsx src/lib/supabase/queries/jobs.ts src/features/projects/ProjectFormShell.tsx
git commit -m "feat(v3): project files — R2 projects/ prefix, upload route branch, AttachmentBuckets project mode"
```

---

### Task 13: /projects pages + Projects button + job-form time-edit rule

**Files:**
- Create: `src/app/projects/page.tsx`, `src/app/projects/[id]/page.tsx`
- Create: `src/features/projects/ProjectsListShell.tsx`
- Modify: `src/features/schedule/ScheduleShell.tsx` (Projects link beside New job, office roles)
- Modify: `src/features/job-detail/JobDetailShell.tsx` + `src/lib/supabase/queries/jobs.ts` (time-edit inheritance rule)
- Modify: `src/app/jobs/[id]/page.tsx` (pass project times when nested)

**Interfaces:**
- Consumes: `getProjectsList`, `getProjectById`, `getProjectJobs` (Task 5), `mergeDateRanges`/`formatRanges` (Task 3), `timingOnJobTimeEdit` (Task 2), `ProjectFormShell` (Task 10).
- Produces: `getJobById` select adds `project_id, time_inherited` (and `JobDetail` type gains both); `CoreFieldsPatch` gains `time_inherited?: boolean`; `JobDetailShell` props gain `projectTimes?: { time_start: string | null; time_end: string | null } | null`.

- [ ] **Step 1: `/projects/[id]/page.tsx`** — copy the auth/profile/role boilerplate from `src/app/jobs/new/page.tsx`; installers redirect to `/installer`; load `getProjectById` (notFound() when null) + `getProjectJobs`; render `<ProjectFormShell mode="edit" lang role userId={profile.id} project={project} initialJobs={jobs} />`.

- [ ] **Step 2: `/projects/page.tsx` + ProjectsListShell** — same guards; `getProjectsList()`; shell renders `CompanyBar`, heading `t(lang,'jpProjectsTitle')`, and one Link card per project to `/projects/[id]`: green-ring folder card (`border-[1.5px] border-terracotta rounded-card bg-paper p-4`), name (font-display), client, `formatRanges(mergeDateRanges(p.spans))`, `${p.doneCount} / ${p.jobCount} ${t(lang,'jpJobsDone')}` pill; `jpNoProjects` empty state.

- [ ] **Step 3: Projects button** — in `ScheduleShell` next to the existing `/jobs/new` link (line ~259), add for non-installer roles:

```tsx
          <Link href="/projects" className="flex items-center gap-1.5 rounded-[10px] border border-line bg-paper px-3 py-2 text-xs font-medium text-ink2 hover:bg-bg">
            <Folder size={14} />{t(lang, 'jpProjectsTitle')}
          </Link>
```

(import `Folder` from lucide-react; match the New-job button's exact classes as found in the file).

- [ ] **Step 4: time-edit rule on the job form.** `getJobById`'s select gains `project_id, time_inherited`; add both to the `JobDetail` type. `src/app/jobs/[id]/page.tsx`: when `job.project_id`, `const proj = await getProjectById(job.project_id)` and pass `projectTimes={proj ? { time_start: proj.time_start, time_end: proj.time_end } : null}`; else `projectTimes={null}`. In `JobDetailShell`'s save path, where the core-fields patch is assembled, apply:

```ts
      const timing = timingOnJobTimeEdit(
        values.time_start || null,
        values.time_end   || null,
        !!job.project_id,
        projectTimes,
      )
      patch.time_start     = timing.time_start
      patch.time_end       = timing.time_end
      patch.time_inherited = timing.time_inherited
```

(add `time_inherited?: boolean` to `CoreFieldsPatch`; `updateJobFields` passes it through unchanged). Locate the exact assembly point by grepping `time_start` in `JobDetailShell.tsx` — there is one place the core patch object is built before `updateJobFields` is called.

- [ ] **Step 5: Verify + commit**

Run: `npm run type-check`, `npm run build` → PASS. Manual dev-server check: `/projects` renders empty state; Projects button visible on /schedule.

```bash
git add src/app/projects src/features/projects/ProjectsListShell.tsx src/features/schedule/ScheduleShell.tsx src/features/job-detail/JobDetailShell.tsx src/lib/supabase/queries/jobs.ts "src/app/jobs/[id]/page.tsx"
git commit -m "feat(v3): /projects list + edit pages, Projects button, job-form time-inheritance rule"
```

---

### Task 14: Full verification sweep

**Files:** none new.

- [ ] **Step 1: Run every standalone suite** (the 14 existing + 3 new):

```bash
for f in $(git ls-files 'src/**/*.test.ts'); do echo "== $f"; npx tsx "$f" || exit 1; done
```

Expected: every suite green (existing 232 checks + project-timing + date-ranges + project-keywords).

- [ ] **Step 2: `npm run type-check` → PASS. `npm run build` → PASS.**

- [ ] **Step 3: Grep sweeps**
- `grep -rn "feat-workflow-v2" src/` → no hits (nothing references the archive branch).
- `grep -rn "z-\[5" src/features/projects/` → no overlay below z-[60].
- `grep -rn "'Workspaces'" src/lib/i18n/en.ts` → present.

- [ ] **Step 4: Commit anything the sweep fixed, then STOP.**

Report to the controller: round 1 built; **before any preview test, migration 0051 must be applied** (`npx supabase db push` — Nic's approval, per the DB-before-code rule); then push `feat-workflow-v3` for the Vercel preview and hand Nic the smoke checklist (create project via switch → nest via picker → new-job-in-project prefill → timing inheritance on/off → project files upload/move/delete → push-from-project incl. empty prompt + held list + ONE scheduler Telegram → /projects list → assistant sidebar says Workspaces → real-installer login sees nothing new).
