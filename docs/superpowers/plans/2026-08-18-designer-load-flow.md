# Designer Load Flow (Design Load) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Designer workload board (Design Load), designer assignment + design brief on the job form, AI complexity scoring, completion flow with 3-day reminders, and an admin AI Scores tab.

**Architecture:** New `job_designers` join table (mirrors `job_coordinators`), new design columns on `jobs`, append-only `design_scores` history. AI scoring fires server-side after relevant job saves (Haiku text-only / Sonnet with attachments); urgency colour is a pure client-side function of stored complexity + deadline + relative load. New `/design-load` route with per-designer stacked bars, live via `useLiveChannel`. One new daily cron handles sweep-scoring + 3-day reminders.

**Tech Stack:** Next.js 15 App Router, Supabase (Postgres + RLS + realtime), Anthropic SDK (`@anthropic-ai/sdk`), Tailwind, lucide-react. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-18-design-load-design.md`

> **Amended 2026-08-26** (spec updated same day — the spec is authoritative):
> migration renumbered **0048** (0046/0047 taken by the assistant-upgrade
> session) · designers get FULL Files-tab access (not JO-bucket-only) ·
> Designer JO bucket protected from rename/delete · required 1–5 rating
> slider at completion (inline, no popup; also on the bell-Yes path; skipped
> on scheduler/admin override) · rating trust check + admin Flagged strip ·
> NO mid-flight score correction · designer Board | My Jobs toggle (To-do /
> Ready to install / Past) · due date auto-shifts with install-date moves
> (gap preserved, clamps at today, designers notified) · re-score only on
> real content change · Duplicate copies brief text + files only · Reopen
> design for scheduler/admin.

## Global Constraints

- **Branch:** ALL work on `feat-designer-load-flow`. Never commit to `dev` or `main` (Nic's call, 2026-08-18 — clean-cut like `feat-workflow-v2`).
- **DB is SHARED** across prod/dev/previews. Migration 0046 must be strictly additive (new tables/columns/policies only). Nic runs `npx supabase db push` — code that SELECTs new columns must not deploy before that (the 42703 lesson).
- **Never embed `users` directly onto `jobs`** in a PostgREST select (breaks with PGRST201). Fetch user names in a follow-up query.
- **Overlays layer above BottomNav:** BottomNav is `z-50`; any bubble/drawer/modal uses `z-[60]`+.
- **i18n:** all user-facing copy via `t(lang, key)` with keys in `src/lib/i18n/en.ts` + `zh.ts` (NO new `bn.ts` keys — English fallback is automatic). EXCEPTION: the admin AI Scores tab is hardcoded English (Nic-only reader).
- **Date labels always English** — use static day/month tables (see `fmtOverdueDate` in `NotificationDrawer.tsx`), NEVER `toLocaleDateString`.
- **TypeScript strict, no `any`.** Queries live in `src/lib/supabase/queries/<feature>.ts`, never inline in components. Files aim < 500 lines.
- **Tests:** no test framework in repo — pure logic gets standalone test files run with `npx tsx <file>.test.ts` that exit 1 on failure (copy the `check()` harness from `scripts/lib/chunk.test.ts`). UI is verified by `npm run type-check` + `npm run build` + the final smoke test.
- **New secret checks fail closed** (per the 2026-08-13 hardening note): the new cron route must 401 when `CRON_SECRET` is unset, not skip the check.
- **Commit after every task.** Do not push without asking Nic.

---

## Task 1: Migration 0046 + TypeScript types

**Files:**
- Create: `supabase/migrations/0048_design_load.sql`
- Modify: `src/lib/supabase/types.ts` (jobs Row/Insert/Update + two new table types)

**Interfaces:**
- Produces (DB): `job_designers(job_id, user_id, assigned_at)`, `design_scores(...)`, `jobs.design_brief / design_due_date / design_due_manual / design_complexity / design_confidence / design_score_reason / design_scored_at / design_completed_at / design_completed_by`
- Produces (TS): `Database['public']['Tables']['job_designers']`, `['design_scores']`, extended `jobs` types. Later tasks import these via the existing `Database` type.

- [ ] **Step 1: Check whether the `files` INSERT policy already covers designers**

Run: `grep -n -A6 "files" supabase/migrations/0002_rls.sql supabase/migrations/0024_realtime_rls_exists.sql supabase/migrations/0028_file_kind_enum.sql`

If the files INSERT policy is restricted to specific roles that exclude `designer`, add a policy in Step 2 extending INSERT to designers. If it allows any authenticated user (like `notifications`), add nothing.

- [ ] **Step 2: Write the migration**

```sql
-- Migration: 0048_design_load
-- Designer Load Flow: job_designers join table, design columns on jobs,
-- design_scores history, design_brief file kind, realtime for job_designers.

-- 1. job_designers (mirrors 0029 job_coordinators)
create table job_designers (
  job_id      uuid not null references jobs(id) on delete cascade,
  user_id     uuid not null references users(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (job_id, user_id)
);

alter table job_designers enable row level security;

-- Office roles + designers can read (Design Load is a shared view)
create policy "designers_select_office" on job_designers
  for select using (
    exists (
      select 1 from users
      where users.auth_id = auth.uid()
        and users.role in ('sales','scheduler','coordinator','designer','production','admin')
    )
  );

-- sales / scheduler / coordinator / admin manage the list
create policy "designers_insert_managers" on job_designers
  for insert with check (
    exists (
      select 1 from users
      where users.auth_id = auth.uid()
        and users.role in ('sales','scheduler','coordinator','admin')
    )
  );

create policy "designers_delete_managers" on job_designers
  for delete using (
    exists (
      select 1 from users
      where users.auth_id = auth.uid()
        and users.role in ('sales','scheduler','coordinator','admin')
    )
  );

-- 2. design columns on jobs (all nullable — old rows unaffected)
alter table jobs
  add column design_brief        text,
  add column design_due_date     date,
  add column design_due_manual   boolean not null default false,
  add column design_complexity   int check (design_complexity between 1 and 5),
  add column design_confidence   text check (design_confidence in ('ok','low')),
  add column design_score_reason text,
  add column design_scored_at    timestamptz,
  add column design_completed_at timestamptz,
  add column design_completed_by uuid,  -- plain uuid, NO users FK (the 0035 lesson)
  add column design_rated_complexity int check (design_rated_complexity between 1 and 5),
  add column design_rating_suspect boolean not null default false,
  add column design_rating_resolution text check (design_rating_resolution in ('kept','discarded'));

-- 3. design_scores append-only history (admin AI Scores tab)
create table design_scores (
  id           uuid primary key default gen_random_uuid(),
  job_id       uuid not null references jobs(id) on delete cascade,
  trigger_kind text not null check (trigger_kind in ('brief_change','assign','date_change','nightly')),
  model        text not null,
  complexity   int not null check (complexity between 1 and 5),
  proposed_due date,
  reason       text not null,
  confidence   text not null check (confidence in ('ok','low')),
  created_at   timestamptz not null default now()
);

alter table design_scores enable row level security;

-- admin read-only; rows are written by the service client (bypasses RLS)
create policy "design_scores_select_admin" on design_scores
  for select using (
    exists (
      select 1 from users
      where users.auth_id = auth.uid() and users.role = 'admin'
    )
  );

create index design_scores_job_idx on design_scores (job_id, created_at desc);

-- 4. design_brief file kind (0028 pattern)
alter type file_kind add value if not exists 'design_brief';

-- 5. realtime for job_designers (0043 pattern)
alter table job_designers replica identity full;
alter publication supabase_realtime add table job_designers;
```

(If Step 1 found a role-restricted files INSERT policy, append the extra policy here.)

- [ ] **Step 3: Add TypeScript types**

In `src/lib/supabase/types.ts`, extend the `jobs` Row with (all `| null` except the boolean):

```typescript
design_brief:        string | null
design_due_date:     string | null
design_due_manual:   boolean
design_complexity:   number | null
design_confidence:   'ok' | 'low' | null
design_score_reason: string | null
design_scored_at:    string | null
design_completed_at: string | null
design_completed_by: string | null
design_rated_complexity: number | null
design_rating_suspect: boolean
design_rating_resolution: 'kept' | 'discarded' | null
```

Add the same keys as optional to the jobs `Insert`/`Update` types (match how `r2_folder` is declared). Add two new table blocks following the shape of existing tables:

```typescript
job_designers: {
  Row:    { job_id: string; user_id: string; assigned_at: string }
  Insert: { job_id: string; user_id: string; assigned_at?: string }
  Update: { job_id?: string; user_id?: string; assigned_at?: string }
}
design_scores: {
  Row: {
    id: string; job_id: string; trigger_kind: string; model: string
    complexity: number; proposed_due: string | null; reason: string
    confidence: 'ok' | 'low'; created_at: string
  }
  Insert: {
    id?: string; job_id: string; trigger_kind: string; model: string
    complexity: number; proposed_due?: string | null; reason: string
    confidence: 'ok' | 'low'; created_at?: string
  }
  Update: Record<string, never>
}
```

- [ ] **Step 4: Type-check**

Run: `npm run type-check` — Expected: PASS (nothing consumes the new types yet).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0048_design_load.sql src/lib/supabase/types.ts
git commit -m "feat: migration 0048 - job_designers, jobs design columns, design_scores"
```

- [ ] **Step 6: Tell Nic to run `npx supabase db push`**

The migration is additive and safe while production runs. Nothing later in this plan works on the preview until it's applied. STOP and confirm with Nic before continuing.

---

## Task 2: Urgency + bar-height calculator (pure logic, TDD)

**Files:**
- Create: `src/lib/utils/design-urgency.ts`
- Test: `src/lib/utils/design-urgency.test.ts`

**Interfaces:**
- Produces:
  - `computeUrgency(input: { complexity: number | null; daysToDue: number | null; openCount: number; maxOpenCount: number }): 0 | 1 | 2 | 3 | 4 | 5` — 0 = unscored/grey
  - `URGENCY_META: Record<0|1|2|3|4|5, { label: string; barClass: string }>` — level → Tailwind class (`bg-muted/40`, `bg-blue`, `bg-green`, `bg-yellow-500`, `bg-amber`, `bg-bad`)
  - `segmentHeightPx(daysToDue: number | null): number`
  - `daysBetween(fromISO: string, toISO: string): number` — whole days, date-only strings

- [ ] **Step 1: Write the failing test**

Copy the `check()` harness from `scripts/lib/chunk.test.ts` into `src/lib/utils/design-urgency.test.ts`, then:

```typescript
import { computeUrgency, segmentHeightPx, daysBetween } from './design-urgency'

// unscored → 0 (grey)
check('null complexity is unscored', computeUrgency({ complexity: null, daysToDue: 5, openCount: 1, maxOpenCount: 3 }), 0)
check('null due date is unscored',   computeUrgency({ complexity: 3, daysToDue: null, openCount: 1, maxOpenCount: 3 }), 0)
// base = complexity, clamped 1..5
check('relaxed job stays at base',   computeUrgency({ complexity: 2, daysToDue: 8, openCount: 1, maxOpenCount: 4 }), 2)
// due pressure: <=1 day +2, <=3 days +1, >=10 days -1
check('due tomorrow bumps +2',       computeUrgency({ complexity: 3, daysToDue: 1, openCount: 1, maxOpenCount: 4 }), 5)
check('due in 3 days bumps +1',      computeUrgency({ complexity: 3, daysToDue: 3, openCount: 1, maxOpenCount: 4 }), 4)
check('far-off due relaxes -1',      computeUrgency({ complexity: 3, daysToDue: 12, openCount: 1, maxOpenCount: 4 }), 2)
// load: busiest designer (>=75% of max, >=3 open) +1
check('overloaded designer bumps +1', computeUrgency({ complexity: 2, daysToDue: 8, openCount: 3, maxOpenCount: 4 }), 3)
// clamping
check('clamps at 5', computeUrgency({ complexity: 5, daysToDue: 0, openCount: 4, maxOpenCount: 4 }), 5)
check('clamps at 1', computeUrgency({ complexity: 1, daysToDue: 30, openCount: 0, maxOpenCount: 4 }), 1)
// heights: closer due = taller
check('height overdue/today', segmentHeightPx(0), 96)
check('height 3 days',        segmentHeightPx(3), 76)
check('height 7 days',        segmentHeightPx(7), 56)
check('height 14 days',       segmentHeightPx(14), 44)
check('height far',           segmentHeightPx(30), 32)
check('height unscored',      segmentHeightPx(null), 32)
// day maths (date-only, no TZ drift)
check('daysBetween', daysBetween('2026-08-18', '2026-08-21'), 3)
check('daysBetween negative when past', daysBetween('2026-08-18', '2026-08-16'), -2)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx src/lib/utils/design-urgency.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```typescript
// Urgency + bar geometry for the Design Load board. Pure functions — the AI
// stores complexity once; everything time-sensitive is recomputed here so a
// job reddens as its due date nears with zero AI calls (spec: scoring engine).

export type UrgencyLevel = 0 | 1 | 2 | 3 | 4 | 5

export function daysBetween(fromISO: string, toISO: string): number {
  const from = Date.UTC(+fromISO.slice(0, 4), +fromISO.slice(5, 7) - 1, +fromISO.slice(8, 10))
  const to   = Date.UTC(+toISO.slice(0, 4),   +toISO.slice(5, 7) - 1,   +toISO.slice(8, 10))
  return Math.round((to - from) / 86_400_000)
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
  1: { label: 'Relaxed',    barClass: 'bg-blue' },
  2: { label: 'Low',        barClass: 'bg-green' },
  3: { label: 'Medium',     barClass: 'bg-yellow-500' },
  4: { label: 'High',       barClass: 'bg-amber' },
  5: { label: 'Urgent',     barClass: 'bg-bad' },
}
```

(Check `tailwind.config` / `globals.css` for the exact token classes — `bg-bad`, `bg-amber`, `bg-green`, `bg-blue` exist as design tokens; use what the FCFS bars use if the names differ.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx src/lib/utils/design-urgency.test.ts` — Expected: all ✓, exit 0. Also `npm run type-check` — PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/design-urgency.ts src/lib/utils/design-urgency.test.ts
git commit -m "feat: design urgency + bar height calculator with standalone tests"
```

---

## Task 3: Brief-required rule (pure logic, TDD)

**Files:**
- Create: `src/lib/utils/design-brief-rules.ts`
- Test: `src/lib/utils/design-brief-rules.test.ts`

**Interfaces:**
- Produces: `briefRequiredError(input: { isNewJob: boolean; status: string; designerCount: number; briefText: string }): boolean` — `true` = block the save. Consumed by JobDetailShell save handler (Task 6).

- [ ] **Step 1: Write the failing test** (same harness)

```typescript
import { briefRequiredError } from './design-brief-rules'

// pre-booking exempt: the New Job form NEVER requires a brief
check('new job, designer, no brief → allowed', briefRequiredError({ isNewJob: true, status: 'pending', designerCount: 1, briefText: '' }), false)
// edit form: scheduled + designer + empty text → blocked
check('edit scheduled + designer + empty → blocked', briefRequiredError({ isNewJob: false, status: 'scheduled', designerCount: 1, briefText: '' }), true)
check('whitespace does not count as text', briefRequiredError({ isNewJob: false, status: 'scheduled', designerCount: 1, briefText: '   ' }), true)
// any brief text satisfies it
check('brief text present → allowed', briefRequiredError({ isNewJob: false, status: 'scheduled', designerCount: 2, briefText: 'L3 atrium decals only' }), false)
// no designer → never required
check('no designer → allowed', briefRequiredError({ isNewJob: false, status: 'scheduled', designerCount: 0, briefText: '' }), false)
// pending edit (not yet scheduled) → not required
check('pending job → allowed', briefRequiredError({ isNewJob: false, status: 'pending', designerCount: 1, briefText: '' }), false)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx src/lib/utils/design-brief-rules.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement**

```typescript
// Two-stage brief requirement (spec, Nic 2026-08-18): first push / pre-booking
// is exempt; after that, every edit-save on a scheduled job with a designer
// assigned requires brief TEXT (attachments never satisfy or trigger it).
export function briefRequiredError(input: {
  isNewJob:      boolean
  status:        string
  designerCount: number
  briefText:     string
}): boolean {
  if (input.isNewJob) return false
  if (input.status !== 'scheduled') return false
  if (input.designerCount === 0) return false
  return input.briefText.trim().length === 0
}
```

- [ ] **Step 4: Run test to verify it passes** — `npx tsx src/lib/utils/design-brief-rules.test.ts` → all ✓.

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/design-brief-rules.ts src/lib/utils/design-brief-rules.test.ts
git commit -m "feat: two-stage design brief requirement rule"
```

---

## Task 4: Designer queries + assignment API route + Telegram template

**Files:**
- Create: `src/lib/supabase/queries/designers.ts`
- Create: `src/app/api/jobs/[id]/designers/route.ts`
- Modify: `src/lib/telegram/templates.ts` (add `tplDesignAssigned`)
- Modify: `src/lib/i18n/en.ts`, `src/lib/i18n/zh.ts` (notification strings)

**Interfaces:**
- Produces:
  - `getJobDesigners(jobId: string): Promise<Array<{ id: string; name: string }>>`
  - `setJobDesigners(jobId: string, userIds: string[]): Promise<{ added: string[] }>`
  - `getDesignerUsers(): Promise<Array<{ id: string; name: string }>>` — all non-deleted `role='designer'` users
  - `POST /api/jobs/[id]/designers` body `{ userIds: string[] }` → `{ ok: true; added: string[] }`; role-gated to sales/scheduler/coordinator/admin; bell + Telegram to newly added designers; fires scoring (wired in Task 7 — leave a `// scoring hook (Task 7)` comment landmark)
  - `tplDesignAssigned(p: { projectTitle: string; client: string; date: string; jobUrl: string }): string`

- [ ] **Step 1: Write `designers.ts`**

Copy `src/lib/supabase/queries/coordinators.ts` wholesale, rename coordinator→designer, table `job_designers`. Add:

```typescript
export async function getDesignerUsers(): Promise<Array<{ id: string; name: string }>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('users')
    .select('id, name')
    .eq('role', 'designer')
    .is('deleted_at', null)
    .order('name', { ascending: true })
  if (error) throw error
  return ((data ?? []) as unknown as Array<{ id: string; name: string }>)
}
```

`setJobDesigners` mirrors `setJobCoordinators` (service client, diff added/removed, delete removed, insert added, return `{ added }`).

- [ ] **Step 2: Add the Telegram template**

In `src/lib/telegram/templates.ts`, next to `tplJobAssigned` (line ~52), following its exact HTML style:

```typescript
export function tplDesignAssigned(p: {
  projectTitle: string
  client: string
  date: string
  jobUrl: string
}): string {
  return [
    '🎨 <b>New Design Job Assigned</b>',
    '',
    `<b>Project:</b> ${p.projectTitle}`,
    `<b>Client:</b> ${p.client}`,
    `<b>Install date:</b> ${p.date}`,
  ].join('\n')
}
```

Match the surrounding templates for how `jobUrl` is attached (inline keyboard `url` button in the caller, like `tplJobChatBatch` — copy that caller pattern).

- [ ] **Step 3: Write the API route**

Model on `src/app/api/jobs/[id]/assign-installers/route.ts` (read it first — auth, role gate, notification fan-out). Skeleton:

```typescript
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { setJobDesigners } from '@/lib/supabase/queries/designers'
import { sendTelegram } from '@/lib/telegram/bot'   // ← confirm exact helper name in assign-installers
import { tplDesignAssigned } from '@/lib/telegram/templates'

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: jobId } = await ctx.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  type Profile = { id: string; role: string }
  const { data: profile } = await supabase
    .from('users').select('id, role').eq('auth_id', user.id).maybeSingle() as { data: Profile | null; error: unknown }
  if (!profile || !['sales', 'scheduler', 'coordinator', 'admin'].includes(profile.role))
    return new Response('Forbidden', { status: 403 })

  const { userIds } = await req.json() as { userIds?: string[] }
  if (!Array.isArray(userIds)) return Response.json({ error: 'userIds required' }, { status: 400 })

  const { added } = await setJobDesigners(jobId, userIds)

  if (added.length > 0) {
    const svc = createServiceClient()
    const { data: job } = await svc.from('jobs')
      .select('project_title, client, date').eq('id', jobId).maybeSingle()
    const { data: designers } = await svc.from('users')
      .select('id, telegram_chat_id').in('id', added)
    // bell notifications (type 'design_assigned')
    await svc.from('notifications').insert(added.map(uid => ({
      user_id: uid, type: 'design_assigned', job_id: jobId,
      title: 'New design job assigned',
      body:  job?.project_title ?? 'Untitled job',
    })) as never)
    // Telegram, fire-and-forget, only users with a chat id
    // (copy the sendTelegram + inline "View in app" button pattern from assign-installers)
  }

  // scoring hook (Task 7)

  return Response.json({ ok: true, added })
}
```

- [ ] **Step 4: i18n keys**

`en.ts`: `designAssignedTitle: 'New design job assigned'`. `zh.ts`: `designAssignedTitle: '新设计任务已分配'`. (The bell drawer renders notification `title` from the DB — check how `sent_back` titles are shown in `NotificationDrawer.tsx`; if titles come straight from the DB row, keys are only needed where the drawer adds its own labels.)

- [ ] **Step 5: Verify** — `npm run type-check` → PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/supabase/queries/designers.ts src/app/api/jobs/[id]/designers/route.ts src/lib/telegram/templates.ts src/lib/i18n/en.ts src/lib/i18n/zh.ts
git commit -m "feat: designer assignment - queries, API route, bell + Telegram notify"
```

---

## Task 5: Job form — Designers picker in the Team card

**Files:**
- Modify: `src/features/job-detail/JobDetailShell.tsx` (Team group)
- Modify: `src/features/job-detail/NewJobShell.tsx` (Team card)
- Modify: `src/lib/i18n/en.ts`, `src/lib/i18n/zh.ts`

**Interfaces:**
- Consumes: `getJobDesigners`, `getDesignerUsers` (Task 4), `POST /api/jobs/[id]/designers`
- Produces: `selectedDesignerIds: string[]` state inside both shells — Task 6's brief validation reads its `.length`, Task 6's save handler POSTs it.

- [ ] **Step 1: Read how the Coordinators picker works**

Read the Team-card region of `JobDetailShell.tsx` and `NewJobShell.tsx` (search `Coordinator`). Note: how options load, how selections render as removable chips, when the save fires (on Save Changes via `/api/jobs/[id]/notify-assigned` + `setJobCoordinators` — see `docs/superpowers/specs/2026-05-21-sub-poc-coordinators-design.md`).

- [ ] **Step 2: Add the Designers picker**

Duplicate the Coordinators picker block directly beneath it, renamed Designers: options from `getDesignerUsers()` (designer-role users only), selections in `selectedDesignerIds`, same chip UI. Label keys: `designersLabel` — en `'Designers'`, zh `'设计师'`. Edit form saves via `POST /api/jobs/[id]/designers` inside the existing save handler (alongside the coordinators call). New Job form: carry `selectedDesignerIds` through the submit flow and call the same route right after the job is created (the created job id is in the submit response — mirror how coordinators/installer suggestions are attached post-create).

- [ ] **Step 3: Role visibility**

The picker is editable for sales/scheduler/coordinator/admin, read-only chips for designer/production (match how the Team card gates other fields by `role`).

- [ ] **Step 4: Verify** — `npm run type-check` → PASS; `npm run dev`, open an existing job as admin, assign a designer, confirm: chip renders, save fires the route, `job_designers` row exists (check via the app: reload keeps the chip), assigned designer receives a bell notification.

- [ ] **Step 5: Commit**

```bash
git add src/features/job-detail/JobDetailShell.tsx src/features/job-detail/NewJobShell.tsx src/lib/i18n/en.ts src/lib/i18n/zh.ts
git commit -m "feat: Designers picker in job form Team card"
```

---

## Task 6: Job form — Design brief card, due date, required rule, leave guard

**Files:**
- Create: `src/features/job-detail/DesignBriefSection.tsx`
- Modify: `src/features/job-detail/JobDetailShell.tsx` (mount card in details column; save handler validation)
- Modify: `src/features/job-detail/NewJobShell.tsx` (mount card, no validation)
- Modify: `src/app/api/jobs/[id]/route.ts` (accept the new jobs fields in PATCH)
- Modify: `src/lib/i18n/en.ts`, `src/lib/i18n/zh.ts`

**Interfaces:**
- Consumes: `briefRequiredError` (Task 3), `selectedDesignerIds` (Task 5), existing R2 upload flow (`/api/r2/upload-url` + `files` insert — copy from `AttachmentBuckets.tsx`), file kind `'design_brief'` (Task 1)
- Produces: `DesignBriefSection` props: `{ jobId: string | null; lang: LangCode; readOnly: boolean; briefText: string; onBriefText: (v: string) => void; dueDate: string | null; dueManual: boolean; onDueDate: (v: string | null) => void; briefError: boolean }` — parent owns state so the save handler and validation see it.

- [ ] **Step 1: Build `DesignBriefSection`**

A `CollapseCard` (same wrapper the other cards use) titled with key `designBriefTitle` (en `'Design brief'`, zh `'设计简报'`), containing:
1. Textarea bound to `briefText`, placeholder key `designBriefPlaceholder` — en `'What exactly does the designer need to produce? Which area / items?'`, zh `'设计师具体需要做什么？哪个区域/哪些项目？'`. When `briefError`, red border + error line `designBriefRequired` — en `'Design brief is required once a designer is assigned'`, zh `'已分配设计师后，必须填写设计简报'`.
2. Attachment strip: reuse the upload pattern from `AttachmentBuckets.tsx` (signed URL → PUT → `files` insert) with `kind: 'design_brief'`, `bucket_id: null`. List existing `design_brief` files for the job with name + delete (uploader or manager). On the New Job form pre-save (`jobId === null`), hide the strip behind the same lock treatment the Files tab uses.
3. Due date row: date input bound to `dueDate`. When `dueManual === false` and a date exists, show an `'AI suggested'` pill (en) / `'AI 建议'` (zh) beside it; user editing the field calls `onDueDate` and the parent sets `dueManual = true`.
4. Whiteboard placeholder: disabled dashed-border button, key `whiteboardSoon` — en `'Whiteboard — coming soon'`, zh `'白板 — 即将推出'` (mirror the old "Duplicate (WIP)" placeholder styling).

- [ ] **Step 2: Mount + PATCH plumbing (incl. due-date auto-shift + Duplicate)**

JobDetailShell: state `briefText/dueDate/dueManual` seeded from the job row; include `design_brief`, `design_due_date`, `design_due_manual` in the PATCH body of Save Changes; add them to the allowed-fields handling in `src/app/api/jobs/[id]/route.ts` (read the route first — extend whatever whitelist/passthrough pattern it uses). NewJobShell: same card, brief text passed into the create payload (`design_brief` on insert), attachments unlocked after save like Files/Chat.

**Due-date auto-shift (server-side, in the PATCH route):** when the incoming body changes `date` (install date) on a job that has a `design_due_date`, shift the due date by the same delta — the lead-time gap is preserved regardless of `design_due_manual` (spec, Nic 2026-08-26). Clamp at today. Use `daysBetween` from Task 2:

```typescript
// inside the PATCH handler, before writing, when body.date && body.date !== job.date
if (job.design_due_date) {
  const delta = daysBetween(job.date, body.date)          // signed days moved
  const shifted = addDaysISO(job.design_due_date, delta)  // add helper below
  const todayISO = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10) // SGT, same as fcfs page
  updates.design_due_date = shifted < todayISO ? todayISO : shifted
  // notify each assigned designer: bell always; Telegram only when delta < 0
  // (insert notifications type 'design_due_shift', title = project title,
  //  body = `${oldDue} → ${newDue}`; Telegram via a small tplDesignDueShift
  //  template next to tplDesignAssigned — same style, "⏰ Design Due Date Moved")
}
```

Add `addDaysISO(iso: string, days: number): string` to `design-urgency.ts` with a test in its test file (`check('addDaysISO', addDaysISO('2026-09-15', -8), '2026-09-07')` — Nic's own example). The AI still never re-proposes over a manual date; the shift is mechanical.

**Duplicate:** in `src/app/api/jobs/[id]/duplicate/route.ts`, copy `design_brief` (text) into the new job and copy `design_brief`-kind files as true R2 copies (the route already does this for buckets/production photos — reuse its `copyObject` loop). Never copy: designers, `design_due_date`, `design_due_manual`, any `design_*` score/completion/rating column (they stay at column defaults).

- [ ] **Step 3: Wire the required rule into Save**

At the top of the edit-form save handler:

```typescript
const briefBlocked = briefRequiredError({
  isNewJob: false,
  status: job.status,
  designerCount: selectedDesignerIds.length,
  briefText,
})
if (briefBlocked) {
  setBriefError(true)
  toast(t(lang, 'designBriefRequired'))   // use the shell's existing toast/error helper
  return
}
```

Also switch the phone view to the Details tab when blocked so the error is visible (call the same tab-switch state `JobFormLayout` uses via its `initialTab` — if there's no imperative switch, scroll the card into view with `ref.scrollIntoView()`).

- [ ] **Step 4: Leave guard**

In JobDetailShell, register `beforeunload` while the form is dirty (the shell already tracks dirty state for the realtime amber banner — reuse that flag):

```typescript
useEffect(() => {
  if (!isDirty) return
  const handler = (e: BeforeUnloadEvent) => { e.preventDefault() }
  window.addEventListener('beforeunload', handler)
  return () => window.removeEventListener('beforeunload', handler)
}, [isDirty])
```

(Browser shows its native "Leave page?" prompt on refresh/close; the in-app back arrow already goes through `router.back()` — leave it, the native prompt covers refresh/close which is what Nic asked for.)

- [ ] **Step 5: Verify** — type-check; dev server: scheduled job + designer + empty brief → Save blocks with red field + toast; fill text → saves; due date edit flips to manual (pill disappears, survives reload); brief file uploads and lists; pending job with designer saves fine without brief.

- [ ] **Step 6: Commit**

```bash
git add src/features/job-detail/DesignBriefSection.tsx src/features/job-detail/JobDetailShell.tsx src/features/job-detail/NewJobShell.tsx src/app/api/jobs/[id]/route.ts src/lib/i18n/en.ts src/lib/i18n/zh.ts
git commit -m "feat: Design brief card - text + attachments + due date + required rule + leave guard"
```

---

## Task 7: AI scoring engine

**Files:**
- Create: `src/lib/ai/design-score.ts`
- Test: `src/lib/ai/design-score.test.ts` (prompt builder + model routing only — no live API in tests)
- Modify: `src/app/api/jobs/[id]/route.ts` (fire scoring after PATCH when design inputs changed)
- Modify: `src/app/api/jobs/[id]/designers/route.ts` (replace the `// scoring hook (Task 7)` landmark)

**Interfaces:**
- Consumes: jobs design columns + `design_scores` (Task 1), `logApiUsage` from `@/lib/supabase/queries/admin`
- Produces:
  - `scoreDesignJob(jobId: string, trigger: 'brief_change' | 'assign' | 'date_change' | 'nightly'): Promise<void>` — silent no-op when brief text empty, no designer assigned, or already design-completed; never throws (catches + `console.error`; failed jobs stay unscored for the nightly sweep)
  - `pickModel(hasAttachments: boolean): string`
  - `buildScorePrompt(input: PromptInput): string` where `PromptInput = { briefText: string; installDate: string | null; todayISO: string; attachmentNames: string[]; history: Array<{ brief: string; complexity: number | null; daysTaken: number }> }`
  - `BASELINE_TABLE: string` — the launch complexity rulebook (Nic's team ratings replace the draft numbers later; structure stays)

- [ ] **Step 1: Write the failing test** (prompt/routing only)

```typescript
import { pickModel, buildScorePrompt, BASELINE_TABLE } from './design-score'

check('text-only uses Haiku', pickModel(false).includes('haiku'), true)
check('attachments use Sonnet', pickModel(true).includes('sonnet'), true)
const prompt = buildScorePrompt({
  briefText: 'L3 atrium decals only', installDate: '2026-09-01', todayISO: '2026-08-18',
  attachmentNames: ['floorplan.pdf'],
  history: [{ brief: 'window frosting for NEX unit', complexity: 2, daysTaken: 1 }],
})
check('prompt carries the brief', prompt.includes('L3 atrium decals only'), true)
check('prompt carries the baseline', prompt.includes('BASELINE'), true)
check('prompt carries history', prompt.includes('window frosting'), true)
check('prompt names unreadable attachments', prompt.includes('floorplan.pdf'), true)
check('baseline mentions hoarding', BASELINE_TABLE.toLowerCase().includes('hoarding'), true)
```

- [ ] **Step 2: Run test to verify it fails** — `npx tsx src/lib/ai/design-score.test.ts` → FAIL.

- [ ] **Step 3: Implement `design-score.ts`**

Key parts (follow `src/app/api/ai/suggest/route.ts` for the Anthropic call + `logApiUsage` shape; follow `src/lib/ai/tagger.ts` for repo AI-module style):

```typescript
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/service'
import { logApiUsage } from '@/lib/supabase/queries/admin'

const HAIKU  = 'claude-haiku-4-5-20251001'
// Use the exact Sonnet model id the assistant chat route uses — read it from
// src/app/api/assistant/chat/route.ts and paste the same string here.
const SONNET = 'claude-sonnet-4-6'

export function pickModel(hasAttachments: boolean): string {
  return hasAttachments ? SONNET : HAIKU
}

// Draft numbers 2026-08-18 — Nic's team will re-rate; keep the format stable.
export const BASELINE_TABLE = `BASELINE complexity guide (1 = <1h prep work, 2 = 1-3h layout,
3 = half-full day real design, 4 = 1-3 day drawing package, 5 = 3+ days / revisions expected):
1 - simple decal/sticker prep; resize or adapt existing artwork
2 - poster/standee/single-panel graphic; window/frosted/floor graphics; acrylic sign from supplied vector
3 - backlit lightbox graphic; multi-panel hoarding wrap; in-store campaign change-out;
    3D acrylic/metal lettering with mockup; simple carpentry drawing; mall landlord submission set
4 - full store campaign package; LED illuminated signage with construction drawings;
    custom mixed-material display fixture
5 - booth / pop-up / exhibition set with full package
Bump one level when: no vector files supplied; landlord/BCA submission required;
photo-real mockups wanted; client known for many revision rounds; site measurement needed.`
```

`buildScorePrompt` returns one string containing: today, install date, the brief text, `BASELINE_TABLE`, attachment file names (for context even when the file content is attached separately), and a `PAST JOBS:` block (each history line: brief excerpt ≤200 chars, complexity, actual days taken). Instruction footer: respond with ONLY a JSON object `{"complexity": 1-5, "proposed_due": "YYYY-MM-DD", "reason": "<one line>", "confidence": "ok"|"low"}`; set `confidence` to `"low"` when the brief does not narrow a broad attachment; `proposed_due` must leave realistic production lead time before the install date.

`scoreDesignJob(jobId, trigger)` (service client throughout):
1. Load job (`design_brief, design_due_manual, design_due_date, date, design_completed_at, status`); bail silently if brief text empty/whitespace, `design_completed_at` set, or no `job_designers` rows.
2. Load `design_brief` files for the job. For up to 3 files with `content-type` pdf/image and size ≤ 10MB: fetch bytes server-side via the existing R2 GET helper (see how `/api/r2/download-url` builds signed URLs — sign, fetch, base64) and attach as `document`/`image` content blocks; remaining files are named in the prompt only.
3. History: last 5 jobs with `design_completed_at not null and design_brief not null`, computing `daysTaken` from earliest `job_designers.assigned_at` to `design_completed_at`. The `complexity` fed into each history line is the **designer's rating when trusted** (`design_rated_complexity` where `design_rating_suspect = false` OR `design_rating_resolution = 'kept'`), else the AI's `design_complexity` — quarantined ratings never teach (spec trust check).
4. Call `anthropic.messages.create` with `pickModel(files.length > 0)`, `max_tokens: 400`; parse the JSON (strip anything outside the outermost braces before `JSON.parse`; on parse failure log + return, leaving the job unscored).
5. Write `jobs`: `design_complexity, design_confidence, design_score_reason, design_scored_at = now`; plus `design_due_date = proposed_due` ONLY when `design_due_manual === false`. Insert the `design_scores` row (`trigger_kind: trigger`). `void logApiUsage({ service: 'anthropic', endpoint: 'design-score', ... })` with the Haiku rates from the suggest route or Sonnet rates (~$3/M in, ~$15/M out).

- [ ] **Step 4: Run test to verify it passes** — `npx tsx src/lib/ai/design-score.test.ts` → all ✓; `npm run type-check` → PASS.

- [ ] **Step 5: Wire the triggers**

- `designers/route.ts`: replace the landmark with `void scoreDesignJob(jobId, 'assign')` after a successful set with `added.length > 0`.
- `jobs/[id]/route.ts` PATCH: after a successful update, fire scoring ONLY when content **actually changed** (spec: a save resubmitting the same values must not re-score — diff the pre-update row against the incoming body): `const briefChanged = body.design_brief !== undefined && body.design_brief !== job.design_brief; const dateChanged = body.date !== undefined && body.date !== job.date;` then `if (briefChanged || dateChanged) void scoreDesignJob(id, briefChanged ? 'brief_change' : 'date_change')`. A brief-file upload also re-scores: add the same fire-and-forget call in the `files` insert path used by the brief card IF that path is a server route; if the insert is client-side, POST a lightweight `{ rescore: true }` PATCH after upload instead (the rescore flag bypasses the diff, nothing else).

- [ ] **Step 6: Verify live** — dev server with real env: fill a brief on a designer-assigned job, save, then reload after ~10s: complexity/reason populated, `design_scores` row exists (visible later in Task 10's tab; for now check via the due-date pill appearing). Confirm an api_usage row appears in Admin → Health.

- [ ] **Step 7: Commit**

```bash
git add src/lib/ai/design-score.ts src/lib/ai/design-score.test.ts src/app/api/jobs/[id]/route.ts src/app/api/jobs/[id]/designers/route.ts
git commit -m "feat: AI design scoring engine - Haiku/Sonnet routing, baseline table, triggers"
```

---

## Task 8: Design completed flow (tick + override + reminders eligibility)

**Files:**
- Create: `src/app/api/jobs/[id]/design-complete/route.ts`
- Create: `src/app/api/jobs/[id]/design-reopen/route.ts`
- Create: `src/lib/utils/design-reminder.ts` + Test: `src/lib/utils/design-reminder.test.ts`
- Create: `src/lib/utils/design-rating-trust.ts` + Test: `src/lib/utils/design-rating-trust.test.ts`
- Modify: `src/features/job-detail/JobDetailShell.tsx` (designer action bar with inline rating slider)
- Modify: `src/features/job-detail/AttachmentBuckets.tsx` (designers get FULL access; Designer JO bucket protected from rename/delete for everyone)
- Modify: `src/lib/i18n/en.ts`, `src/lib/i18n/zh.ts`

**Interfaces:**
- Consumes: jobs design columns (Task 1)
- Produces:
  - `POST /api/jobs/[id]/design-complete` body `{ rating?: number }` → `{ ok: true }`. Allowed: an assigned designer of the job, scheduler, admin. **Designer path requires `rating` 1–5** (400 `{ error: 'rating-required' }` without it); scheduler/admin override path ignores any rating (no fake data). 409 `{ error: 'no-jo-file' }` when the job has no file in its DESIGNER JO bucket (server-checked: `attachment_buckets` row for the job whose name matches `DESIGNER JO` case-insensitively, with ≥1 `files` row). Sets `design_completed_at = now()`, `design_completed_by = <users.id>`, and on the designer path `design_rated_complexity` + `design_rating_suspect` (from `ratingSuspect`, below) via service client.
  - `POST /api/jobs/[id]/design-reopen` → `{ ok: true }`. Scheduler/admin only (mirror the role gate of the existing `revert-complete` route — read it first, it's the same shape). Clears `design_completed_at/by`, `design_rated_complexity`, `design_rating_suspect` → false, `design_rating_resolution` → null. The job reappears on the board (it derives from `design_completed_at is null`).
  - `reminderDue(input: { joUploadedAtISO: string | null; completedAtISO: string | null; lastReminderAtISO: string | null; nowISO: string }): boolean` — consumed by the Task 9 cron.
  - `ratingSuspect(input: { rating: number; aiComplexity: number | null; daysTaken: number }): boolean` — consumed by design-complete and shown in Task 11's Flagged strip.

- [ ] **Step 1: TDD the reminder rule**

```typescript
import { reminderDue } from './design-reminder'

const now = '2026-08-18T02:00:00Z'
check('no JO file → no reminder', reminderDue({ joUploadedAtISO: null, completedAtISO: null, lastReminderAtISO: null, nowISO: now }), false)
check('completed → no reminder', reminderDue({ joUploadedAtISO: '2026-08-10T02:00:00Z', completedAtISO: '2026-08-11T02:00:00Z', lastReminderAtISO: null, nowISO: now }), false)
check('JO fresh (2 days) → wait', reminderDue({ joUploadedAtISO: '2026-08-16T08:00:00Z', completedAtISO: null, lastReminderAtISO: null, nowISO: now }), false)
check('JO 3+ days, never reminded → remind', reminderDue({ joUploadedAtISO: '2026-08-14T02:00:00Z', completedAtISO: null, lastReminderAtISO: null, nowISO: now }), true)
check('reminded 1 day ago → snoozed', reminderDue({ joUploadedAtISO: '2026-08-10T02:00:00Z', completedAtISO: null, lastReminderAtISO: '2026-08-17T02:00:00Z', nowISO: now }), false)
check('reminded 3+ days ago → remind again', reminderDue({ joUploadedAtISO: '2026-08-10T02:00:00Z', completedAtISO: null, lastReminderAtISO: '2026-08-15T02:00:00Z', nowISO: now }), true)
```

Run `npx tsx src/lib/utils/design-reminder.test.ts` → FAIL, then implement:

```typescript
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000

// 3-day nudge (spec): JO uploaded but unticked for 3+ days → ask; answering
// "No" just stamps a reminder, so the next nudge is 3 days later. Never daily.
export function reminderDue(input: {
  joUploadedAtISO:   string | null
  completedAtISO:    string | null
  lastReminderAtISO: string | null
  nowISO:            string
}): boolean {
  if (!input.joUploadedAtISO || input.completedAtISO) return false
  const now = Date.parse(input.nowISO)
  if (now - Date.parse(input.joUploadedAtISO) < THREE_DAYS_MS) return false
  if (input.lastReminderAtISO && now - Date.parse(input.lastReminderAtISO) < THREE_DAYS_MS) return false
  return true
}
```

Re-run → all ✓. Commit: `git add src/lib/utils/design-reminder.* && git commit -m "feat: 3-day design reminder eligibility rule"`

Then TDD the trust check the same way (`design-rating-trust.test.ts`):

```typescript
import { ratingSuspect, impliedComplexityFromDays } from './design-rating-trust'

// time evidence: days taken → implied complexity band
check('half day implies 1', impliedComplexityFromDays(0.5), 1)
check('one day implies 2',  impliedComplexityFromDays(1), 2)
check('two days implies 3', impliedComplexityFromDays(2), 3)
check('four days implies 4', impliedComplexityFromDays(4), 4)
check('six days implies 5', impliedComplexityFromDays(6), 5)
// suspect only when the rating disagrees >=2 with BOTH witnesses
check('agrees with AI → trusted', ratingSuspect({ rating: 4, aiComplexity: 4, daysTaken: 0.5 }), false)
check('agrees with time → trusted', ratingSuspect({ rating: 4, aiComplexity: 2, daysTaken: 4 }), false)
check('disagrees with both (inflated) → suspect', ratingSuspect({ rating: 5, aiComplexity: 2, daysTaken: 0.5 }), true)
check('disagrees with both (sandbagged) → suspect', ratingSuspect({ rating: 1, aiComplexity: 4, daysTaken: 6 }), true)
check('no AI score → time is the only witness', ratingSuspect({ rating: 5, aiComplexity: null, daysTaken: 0.5 }), true)
check('no AI score but time agrees → trusted', ratingSuspect({ rating: 5, aiComplexity: null, daysTaken: 6 }), false)
```

Run → FAIL, then implement:

```typescript
// Trust check (spec 2026-08-26): a completion rating is quarantined when it
// disagrees by >=2 levels with BOTH independent witnesses — the AI's own
// prediction from the brief, and the actual time taken. Quarantined ratings
// are stored but never teach; admin can Keep/Discard in the AI Scores tab.
export function impliedComplexityFromDays(days: number): number {
  if (days <= 0.5) return 1
  if (days <= 1) return 2
  if (days <= 3) return 3
  if (days <= 5) return 4
  return 5
}

export function ratingSuspect(input: {
  rating: number
  aiComplexity: number | null
  daysTaken: number
}): boolean {
  const timeGap = Math.abs(input.rating - impliedComplexityFromDays(input.daysTaken))
  const aiGap = input.aiComplexity == null ? null : Math.abs(input.rating - input.aiComplexity)
  if (aiGap == null) return timeGap >= 2
  return aiGap >= 2 && timeGap >= 2
}
```

Re-run → all ✓. Commit: `git add src/lib/utils/design-rating-trust.* && git commit -m "feat: completion rating trust check"`

- [ ] **Step 2: The design-complete route**

Auth + profile lookup (same opening as Task 4's route). Permission: `profile.role` in `['scheduler','admin']` OR a `job_designers` row for `(jobId, profile.id)` exists. JO-file check with the service client:

```typescript
const { data: joBucket } = await svc.from('attachment_buckets')
  .select('id, name').eq('job_id', jobId).ilike('name', '%designer jo%').maybeSingle()
let hasJoFile = false
if (joBucket) {
  const { count } = await svc.from('files')
    .select('id', { count: 'exact', head: true }).eq('bucket_id', joBucket.id)
  hasJoFile = (count ?? 0) > 0
}
if (!hasJoFile) return Response.json({ error: 'no-jo-file' }, { status: 409 })
```

Then branch on role. **Override path** (`scheduler`/`admin` who is NOT an assigned designer of this job): update `jobs` set `design_completed_at: new Date().toISOString(), design_completed_by: profile.id` only. **Designer path**: require `rating` (integer 1–5; else 400 `{ error: 'rating-required' }`), compute `daysTaken` (earliest `job_designers.assigned_at` → now, in fractional days) and the job's `design_complexity`, then:

```typescript
const suspect = ratingSuspect({ rating, aiComplexity: job.design_complexity, daysTaken })
await svc.from('jobs').update({
  design_completed_at: new Date().toISOString(),
  design_completed_by: profile.id,
  design_rated_complexity: rating,
  design_rating_suspect: suspect,
} as never).eq('id', jobId)
```

Return `{ ok: true }`. Also write the `design-reopen` route per its Interfaces entry (read `src/app/api/jobs/[id]/revert-complete/route.ts` first and mirror its gate + shape).

- [ ] **Step 3: Designer action bar with inline rating slider + full bucket access**

JobDetailShell: designers currently get no Save bar. Give the designer role (effective role) a single-button bar: **Design completed** (green `Btn`, key `designCompletedBtn` — en `'Design completed'`, zh `'设计完成'`), disabled with a muted hint (`designCompletedNeedsJo` — en `'Upload the Job Order PDF first'`, zh `'请先上传 Job Order PDF'`) until the DESIGNER JO bucket has ≥1 file (the shell already loads buckets/files for AttachmentBuckets — derive from that data).

**No popup (Nic, 2026-08-26):** clicking does NOT open a modal — an inline panel slides open directly above the action bar (height-animated div, still within the sticky bar container so it layers above BottomNav):
- Question line: `designRatingQ` — en `'How heavy was this design work?'`, zh `'这项设计工作有多重？'`
- `<input type="range" min={1} max={5} step={1}>` styled to the token palette, end labels `designRatingLight` — en `'1 · quick prep'`, zh `'1 · 简单处理'` and `designRatingHeavy` — en `'5 · multi-day'`, zh `'5 · 多天工作'`; the selected value shows as a bold number above the thumb. Track `touched` state — start untouched with no default shown.
- **Confirm** button (`designRatingConfirm` — en `'Confirm — design done'`, zh `'确认 — 设计完成'`) disabled until `touched`; POSTs `design-complete` with `{ rating }` → success toast → panel closes; the button area then shows a completed state (`designCompletedDone` — en `'Design completed ✓'`, zh `'设计已完成 ✓'` — reuse the pill styling of other done-states). A Cancel (X) collapses the panel without submitting.

For scheduler/admin: the same tick as a secondary button in their existing bars (no slider — straight confirm, the route's override path), only when ≥1 designer is assigned and not yet completed; and on design-completed jobs a **Reopen design** secondary button (`designReopenBtn` — en `'Reopen design'`, zh `'重新打开设计'`) POSTing `design-reopen` with a confirm modal.

AttachmentBuckets — two changes (2026-08-26):
1. **Designers get FULL access** — no designer-specific restriction props; the shell simply stops passing designers a read-only flag for the Files group (uploads, URL links, add bucket — identical to sales). Designers still cannot edit non-Files fields; that gating lives outside this component.
2. **The Designer JO bucket is protected for everyone:** where the rename and delete controls render, skip them when the bucket name matches `/designer\s*jo/i` (tooltip via title attr, key `designJoProtected` — en `'This bucket is required for design completion'`, zh `'设计完成需要此文件夹'`). The completion tick and 3-day reminder key off this bucket by name — an unprotected rename silently breaks both.

- [ ] **Step 4: Verify** — type-check; dev server as preview-designer (UI gating) AND confirm the route's real role check by calling design-complete as a designer login if available: tick disabled without JO file, enabled after upload → slider panel opens, Confirm disabled until the slider is touched, confirm with a wildly-off rating (e.g. 5 on a job scored 2 that took minutes) → job completes AND `design_rating_suspect` is true; scheduler tick skips the slider; Reopen returns the job to an uncompleted state with the rating cleared; Designer JO bucket shows no rename/delete controls on any role.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/jobs/[id]/design-complete src/app/api/jobs/[id]/design-reopen src/lib/utils/design-rating-trust.ts src/lib/utils/design-rating-trust.test.ts src/features/job-detail/JobDetailShell.tsx src/features/job-detail/AttachmentBuckets.tsx src/lib/i18n/en.ts src/lib/i18n/zh.ts
git commit -m "feat: design completed - rating slider, trust check, reopen, protected JO bucket"
```

---

## Task 9: Daily cron — sweep scoring + 3-day reminders

**Files:**
- Create: `src/app/api/cron/design-daily/route.ts`
- Modify: `vercel.json`
- Modify: `src/features/notifications/NotificationDrawer.tsx` (render `design_reminder` with Yes/No)
- Modify: `src/lib/i18n/en.ts`, `src/lib/i18n/zh.ts`

**Interfaces:**
- Consumes: `scoreDesignJob` (Task 7), `reminderDue` (Task 8), `POST /api/jobs/[id]/design-complete` (Task 8), notifications table
- Produces: `GET /api/cron/design-daily` guarded by `Authorization: Bearer <CRON_SECRET>` — **fail closed**: if `CRON_SECRET` is unset return 401.

- [ ] **Step 1: The cron route**

Copy the auth guard shape from `src/app/api/notifications/overdue/route.ts`, but fail-closed:

```typescript
const secret = process.env.CRON_SECRET
const auth = req.headers.get('authorization')
if (!secret || auth !== `Bearer ${secret}`) return new Response('Unauthorized', { status: 401 })
```

Part A — sweep: service client, jobs where `design_brief is not null`, `design_scored_at is null`, `design_completed_at is null`, `status != 'completed'`, having ≥1 `job_designers` row → `await scoreDesignJob(job.id, 'nightly')` sequentially (small volumes; sequential keeps rate limits calm).

Part B — reminders: jobs `design_completed_at is null`, `status != 'completed'`, with ≥1 `job_designers` row. Per job: earliest JO-bucket file `ts` (bucket matched `ilike '%designer jo%'` as in Task 8); per assigned designer: latest `notifications` row `type='design_reminder'` for `(user_id, job_id)`. Feed `reminderDue(...)`; when true, insert a notification: `type: 'design_reminder', job_id, user_id, title: <job project_title ?? 'Untitled job'>, body: 'design_reminder'`. Log one `events` row (`kind: 'design_daily_cron'`) like the obsidian sync does, so Health can show the last run later.

Add to `vercel.json` crons: `{ "path": "/api/cron/design-daily", "schedule": "30 0 * * *" }` (08:30 SGT).

- [ ] **Step 2: Yes/No card in NotificationDrawer**

Read how the drawer renders `sent_back`/overdue cards first. Add a branch for `type === 'design_reminder'`: card text key `designReminderQ` — en `'Is your design work on “{title}” finished?'`, zh `'“{title}”的设计工作完成了吗？'` (interpolate like existing drawer strings; check the repo's interpolation helper — if `t()` has none, build the string in code around the translated fragments). Two buttons:
- **Yes** (`yesBtn` en `'Yes'` / zh `'是'`): does NOT complete immediately — it expands the same inline 1–5 slider used in Task 8's action bar **inside the notification card** (extract the slider+confirm into a small shared component `src/features/job-detail/DesignRatingSlider.tsx` used by both; same keys, Confirm disabled until touched). Confirm POSTs `design-complete` with `{ rating }`; on ok → mark this notification read (existing mark-read helper) + success toast. On 409 no-jo-file → toast `designReminderNoJo` — en `'No Job Order PDF uploaded yet — open the job to finish up'`, zh `'尚未上传 Job Order PDF——请打开项目完成上传'`.
- **No** (`noBtn` en `'No'` / zh `'否'`): mark the notification read. (The cron's `reminderDue` uses the notification's `created_at` as `lastReminderAtISO`, so the next nudge is automatically ≥3 days later — no extra state.)

Also add a plain card branch for `type === 'design_due_shift'` (from Task 6's auto-shift): title + the `old → new` body line, click navigates to the job, no buttons.

Card click elsewhere navigates to the job (`/jobs/{job_id}`) like other job-linked notifications.

- [ ] **Step 3: Verify** — type-check; local: `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/design-daily` twice — second run inserts no duplicate reminders (3-day snooze); with the secret env commented out the route 401s; drawer shows the Yes/No card, Yes ticks the job, No greys the card.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/cron/design-daily vercel.json src/features/notifications/NotificationDrawer.tsx src/lib/i18n/en.ts src/lib/i18n/zh.ts
git commit -m "feat: design daily cron - sweep scoring + 3-day Yes/No reminders"
```

---

## Task 10: Design Load board

**Files:**
- Create: `src/app/design-load/page.tsx`
- Create: `src/features/design-load/DesignLoadShell.tsx`
- Create: `src/features/design-load/DesignerBar.tsx`
- Create: `src/features/design-load/MyJobsView.tsx`
- Create: `src/lib/supabase/queries/design-load.ts`
- Modify: `src/components/BottomNav.tsx`
- Modify: `src/lib/i18n/en.ts`, `src/lib/i18n/zh.ts`

**Interfaces:**
- Consumes: `computeUrgency`, `segmentHeightPx`, `daysBetween`, `URGENCY_META` (Task 2), `getDesignerUsers` (Task 4), `useLiveChannel`
- Produces:
  - `getDesignLoad(): Promise<DesignLoadData>` where

```typescript
export type DesignLoadJob = {
  jobId: string; projectTitle: string; client: string; location: string
  installDate: string | null; createdAt: string; assignedAt: string
  pocName: string; complexity: number | null; confidence: 'ok' | 'low' | null
  reason: string | null; dueDate: string | null
}
export type DesignLoadData = { designers: Array<{ id: string; name: string; jobs: DesignLoadJob[] }> }
```

  - `getMyDesignJobs(designerUserId: string): Promise<Array<DesignLoadJob & { designCompletedAt: string | null; status: string }>>` — ALL of one designer's design jobs including completed ones (the board query excludes those); feeds the My Jobs view, which buckets client-side: **To-do** = `designCompletedAt === null` · **Ready to install** = completed, `status !== 'completed'`, install date ≥ today · **Past** = completed and (job `status === 'completed'` or install date < today).

- [ ] **Step 1: The query**

`getDesignLoad()` in `design-load.ts`:
1. `getDesignerUsers()` for the designer list (empty bars included).
2. `from('job_designers').select('user_id, assigned_at, jobs(id, project_title, client, location, date, created_at, sales_poc_id, status, design_complexity, design_confidence, design_score_reason, design_due_date, design_completed_at)')` — embedding `jobs` onto `job_designers` is safe (single FK); filter in JS: keep rows where `jobs.design_completed_at === null && jobs.status !== 'completed'`.
3. POC names: collect distinct `sales_poc_id`, one `from('users').select('id, name').in('id', ids)` follow-up (NEVER embed users on jobs).
4. Group by designer, sort each designer's jobs by `assigned_at` DESC (newest first = top of bar).
5. `getMyDesignJobs(designerUserId)`: same embed shape but `eq('user_id', designerUserId)` and NO completed-filter — keep all rows, also select `design_completed_at` + `status`, sort by `assigned_at` DESC. POC names via the same follow-up-query helper.

- [ ] **Step 2: Page + role gate**

`page.tsx`: copy `src/app/fcfs/page.tsx` wholesale — auth, profile, `getEffectiveRole`; `if (effectiveRole === 'installer') redirect('/installer')`; `if (effectiveRole === 'production') redirect('/schedule')`; load `getDesignLoad()`, render `<DesignLoadShell initialData={...} role lang />`, `export const dynamic = 'force-dynamic'`.

- [ ] **Step 3: The shell + bars**

`DesignLoadShell` ('use client'): `CompanyBar` + page header (title key `designLoadTitle` — en `'Design Load'`, zh `'设计负载'`) + horizontally scrollable row of `DesignerBar`s + legend (6 swatches from `URGENCY_META` incl. grey `'Not scored'` — labels via keys `urgency0..urgency5`, zh: 未评分/宽松/较低/中等/较高/紧急) + `BottomNav`. Today = the FCFS `todaySGT()` helper (copy it). Live: `useLiveChannel({ name: 'design-load', tables: [{ table: 'jobs' }, { table: 'job_designers' }, { table: 'files' }], onEvent: refetch, poll: { ms: 120_000, fn: refetch } })` where `refetch` re-runs `getDesignLoad` through a client-callable path (mirror how FCFSShell refetches — likely a browser-client query module call).

Per designer, before rendering, compute `openCount = jobs.length`, `maxOpenCount = max across designers`; per job: `daysToDue = dueDate ? daysBetween(todayISO, dueDate) : null`, `level = computeUrgency(...)`, `height = segmentHeightPx(daysToDue)`.

`DesignerBar`: name label under a bottom-aligned vertical stack (`flex flex-col-reverse` so oldest sits at the bottom, array already newest-first → render reversed accordingly — verify visually); each segment a `button` with `URGENCY_META[level].barClass`, `style={{ height }}`, rounded, 2px gap, low-confidence dot marker (small white ring) when `confidence === 'low'`. Selected segment opens the bubble: absolutely positioned card (`z-[60]`, above BottomNav) anchored to the bar — desktop shows it on hover (`onMouseEnter/Leave`), phone on tap (state), tap-away closes (backdrop div). Bubble contents (all labels via i18n keys, values raw): project title (fallback `'Untitled job'` key `untitledJob` if not already present in i18n — search first), POC name, client (`'Untitled'` fallback), install date + due date formatted with a static-English `fmtDate` (copy `fmtOverdueDate` from NotificationDrawer), sales input date, AI reason line + `'Low confidence'` badge (`lowConfidence` — zh `'置信度低'`) when flagged. Desktop click / bubble button (`openJobBtn` — en `'Open job'`, zh `'打开项目'`) → `router.push('/jobs/' + jobId)`.

Empty designer → muted dashed placeholder slot + name. Empty state when no designers exist: centered muted text (`noDesigners` — en `'No designers provisioned yet'`, zh `'尚未添加设计师'`).

**Board | My Jobs toggle (designer role only — spec 2026-08-26):** when the effective role is `designer` (or admin previewing as designer), render a two-option segmented control under the page header (same styling as the AdminShell mobile tab strip): `boardTab` — en `'Board'`, zh `'看板'` · `myJobsTab` — en `'My Jobs'`, zh `'我的任务'`. Board = the shared bars, unchanged. My Jobs = `MyJobsView`: fetches `getMyDesignJobs(profile.id)`, three filter chips (`myJobsTodo` en `'To-do'` zh `'待办'` · `myJobsReady` en `'Ready to install'` zh `'待安装'` · `myJobsPast` en `'Past'` zh `'已过往'`) with counts, defaulting to To-do; each job renders as a row card (reuse the bubble's content layout: title, client, POC, install + due dates via the static-English formatter, urgency swatch for To-do rows) → tap opens the job. Other roles never see the toggle. The live-channel refetch also refreshes `getMyDesignJobs` when the toggle is on My Jobs.

- [ ] **Step 4: Nav tab**

In `BottomNav.tsx` add `{ href: '/design-load', label: 'Design', Icon: PenTool }` (import `PenTool` from lucide) to `scheduler`, `sales`, `admin`, `coordinator`, `designer` arrays — NOT `installer`, NOT `production`. Keep the label `'Design'` (one word — six tabs must fit on a phone; the page header carries the full name).

- [ ] **Step 5: Verify** — type-check + build; dev server: assign 2 designers jobs with mixed scored/unscored briefs → bars stack newest-top, grey unscored, hover bubble on desktop, tap bubble on mobile viewport sits above the nav, click-through opens the job, second browser window assigning a job updates the first without refresh. As preview-designer: Board | My Jobs toggle appears, chips bucket correctly (tick one job done → it moves To-do → Ready; set its install date to yesterday → Ready → Past); as admin/sales the toggle is absent.

- [ ] **Step 6: Commit**

```bash
git add src/app/design-load src/features/design-load src/lib/supabase/queries/design-load.ts src/components/BottomNav.tsx src/lib/i18n/en.ts src/lib/i18n/zh.ts
git commit -m "feat: Design Load board - stacked urgency bars, bubble, live updates, nav tab"
```

---

## Task 11: Admin AI Scores tab

**Files:**
- Create: `src/features/admin/AIScoresTab.tsx`
- Create: `src/app/api/admin/design-scores/route.ts`
- Modify: `src/features/admin/AdminShell.tsx`

**Interfaces:**
- Consumes: `design_scores` + jobs design columns (Task 1), `getDesignLoad` aggregates (Task 10)
- Produces: `GET /api/admin/design-scores` → `{ scores: ScoreRow[]; summary: Summary }` where

```typescript
type ScoreRow = {
  id: string; jobId: string; jobTitle: string; createdAt: string; trigger: string
  model: string; complexity: number; proposedDue: string | null; reason: string
  confidence: 'ok' | 'low'
}
type Summary = {
  urgencyCounts: Record<1 | 2 | 3 | 4 | 5, number>       // open design jobs by live urgency
  loadPerDesigner: Array<{ name: string; count: number }>
  accuracy: Array<{ jobTitle: string; estimatedDays: number; actualDays: number }>  // completed jobs
  ratingAccuracy: Array<{ jobTitle: string; aiComplexity: number | null; ratedComplexity: number }>  // trusted ratings only
  perDesigner: Array<{ name: string; avgDeviation: number; flaggedRecent: string }> // e.g. flaggedRecent "2 of last 10"
  flagged: Array<{ jobId: string; jobTitle: string; designerName: string; rating: number; aiComplexity: number | null; daysTaken: number }>  // suspect + unresolved
  activity: { last30dCalls: number; haiku: number; sonnet: number }
}
```

Plus `PATCH /api/admin/design-scores` body `{ jobId: string; resolution: 'kept' | 'discarded' }` → `{ ok: true }` — admin-gated like the GET; sets `design_rating_resolution` on that job (Keep/Discard for the Flagged strip).

- [ ] **Step 1: The API route**

Admin gate exactly like `src/app/api/admin/health/route.ts` (read it — role check pattern). Service client: latest 200 `design_scores` joined with job titles (two queries — scores, then `jobs in (ids)` for titles). Summary: reuse `getDesignLoad()` + `computeUrgency` for urgencyCounts/loadPerDesigner; accuracy from completed design jobs (estimated = `proposed_due` of the job's last score vs assigned date; actual = assigned→`design_completed_at`); `ratingAccuracy` pairs `design_complexity` with `design_rated_complexity` on completed jobs whose rating is trusted (`design_rating_suspect = false` OR resolution `'kept'`); `flagged` = jobs with `design_rating_suspect = true` and `design_rating_resolution is null` (designer name = `design_completed_by` → one users lookup; `daysTaken` recomputed assigned→completed); `perDesigner` = per completing designer over their last 10 rated jobs: `avgDeviation` = mean |rating − (aiComplexity ?? implied-from-days)| via `impliedComplexityFromDays`, `flaggedRecent` = `"N of last 10"`; activity from counting `design_scores` in the last 30 days grouped by model. Same file exports the `PATCH` handler per the Interfaces entry (validate resolution value, admin gate, update the job row).

- [ ] **Step 2: The tab (hardcoded English — no i18n)**

AdminShell: extend `type Tab` union with `'ai-scores'`, add `{ id: 'ai-scores', label: 'AI Scores' }` to `TABS`, render `<AIScoresTab />`. The tab component fetches the route on mount (match how `HealthTab` fetches). Layout, Google-Forms-responses feel:
- Top row of summary cards: five urgency count chips (colour swatches from `URGENCY_META`); load-per-designer mini bars (styled divs, width proportional — same technique as `WeekWorkloadChart`); accuracy list (`estimated Xd vs actual Yd` per job, green when |diff| ≤ 1 day, amber otherwise); rating-accuracy list (`AI 3 vs rated 4` per job, green when equal, amber when 1 off, red beyond); per-designer line (`{name} · avg deviation 0.8 · flagged 2 of last 10`); activity line (`N calls last 30 days — H Haiku / S Sonnet`).
- **Flagged ratings strip** (only renders when `flagged.length > 0`, amber-bordered card above the feed): one row per flagged rating — `"{job} — AI said {n} · took {d} days · {designer} rated {r}"` with **Keep** / **Discard** buttons → `PATCH` with the resolution → row disappears (optimistic). Keep admits the rating to learning; Discard drops it; untouched rows stay excluded from learning either way.
- Detail feed: one card per score — job title, date, trigger pill, model pill, complexity badge, proposed due, reason line, amber `LOW CONFIDENCE` pill when low. Text filter input matching job title; read-only apart from the Flagged strip.

- [ ] **Step 3: Verify** — type-check; dev as admin: tab renders, feed lists the scores created during Tasks 7–10 testing, filter narrows, the wildly-off rating from Task 8's verify appears in the Flagged strip, Keep and Discard both resolve it (and it stays gone on reload), non-admin fetch of the route returns 403 (curl without admin session).

- [ ] **Step 4: Commit**

```bash
git add src/features/admin/AIScoresTab.tsx src/app/api/admin/design-scores src/features/admin/AdminShell.tsx
git commit -m "feat: admin AI Scores tab - summary charts + scoring history feed"
```

---

## Task 12: Full verification pass

**Files:** none new — fixes only.

- [ ] **Step 1: All standalone tests**

Run: `npx tsx src/lib/utils/design-urgency.test.ts && npx tsx src/lib/utils/design-brief-rules.test.ts && npx tsx src/lib/utils/design-reminder.test.ts && npx tsx src/lib/utils/design-rating-trust.test.ts && npx tsx src/lib/ai/design-score.test.ts && npx tsx scripts/lib/frontmatter.test.ts && npx tsx scripts/lib/chunk.test.ts`
Expected: every suite ✓, exit 0. The assistant-upgrade session added more standalone suites (`src/lib/ai/*.test.ts`, `src/lib/storage/*.test.ts`, `src/lib/telegram/*.test.ts`) — run any of those whose module this work touched.

- [ ] **Step 2: Type-check + production build**

Run: `npm run type-check && npm run build` — Expected: both green. Fix anything that isn't.

- [ ] **Step 3: File-size check**

Run: `git diff dev --stat` and confirm no new file exceeds ~500 lines (`JobDetailShell.tsx` was already large — if this work pushed it far past its prior size, extract the designer action-bar block into `src/features/job-detail/DesignerActionBar.tsx`).

- [ ] **Step 4: Commit any fixes**

```bash
git add -A && git commit -m "chore: verification fixes - tests, type-check, build green"
```

- [ ] **Step 5: Hand to Nic — preview smoke test**

Ask Nic to push `feat-designer-load-flow` (never push unasked) so Vercel builds the branch preview, then run the smoke checklist from the spec (`docs/superpowers/specs/2026-08-18-design-load-design.md`, "Build order & testing") — including a **real designer login** (preview-as exercises neither RLS nor real role checks). Merging anywhere is Nic's call only.
