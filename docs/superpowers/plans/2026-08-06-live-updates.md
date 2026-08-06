# Live Updates Everywhere Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the installer dashboard and job form update live, on shared realtime plumbing that the schedule page and FCFS board also move onto, with a migration that broadcasts assignment and task changes.

**Architecture:** One new client hook (`useLiveChannel`) owns the auth-token → subscribe → cleanup dance that was previously hand-copied (and once mis-copied, causing the dead-listener bug). Server-rendered pages react to events with `router.refresh()`; the job form applies the hybrid rule — clean state syncs silently, dirty state shows an amber reload banner. Migration 0041 adds `job_assignees` + `job_tasks` to the realtime publication.

**Tech Stack:** Next.js 15 App Router, Supabase realtime (`postgres_changes`), react-hook-form, Tailwind.

**Spec:** `docs/superpowers/specs/2026-08-06-live-updates-design.md`

## Global Constraints

- Branch: `feat-live-updates`. Commit after every task. **NEVER `git push` without Nic's explicit OK** (house rule).
- No test framework exists in this repo. The mechanical gate for every task is `npm run type-check` and (where stated) `npm run build`. Acceptance testing is Nic's two-window preview checklist in the spec.
- TypeScript strict: no `any`, no `@ts-ignore`.
- i18n: new keys go in `src/lib/i18n/en.ts` and `zh.ts` ONLY — Bengali is frozen; `t()` falls back to English per-key.
- Existing realtime pattern reference (known-good): `src/features/job-detail/ChatSection.tsx:461-467` — `auth.getSession()` → `realtime.setAuth(access_token)` → subscribe.
- `ChatSection` is explicitly NOT refactored in this feature.
- The job form pages have no BottomNav; the banner is a sticky bar, not an overlay, so the z-[60] overlay rule doesn't apply — it uses `z-40` under the CompanyBar.

---

### Task 1: Migration 0041 — broadcast assignments + tasks

**Files:**
- Create: `supabase/migrations/0041_realtime_assignees_tasks.sql`

**Interfaces:**
- Produces: `job_assignees` and `job_tasks` events on the `supabase_realtime` publication (consumed by Tasks 4, 5, 7). Not applied locally — Nic runs `npx supabase db push` against the shared remote DB at rollout.

- [ ] **Step 1: Write the migration** (same idempotent pattern as `0009_realtime_setup.sql`)

```sql
-- Broadcast installer assignments and task-list changes.
-- job_assignees and job_tasks were never added to the realtime publication,
-- so the FCFS board's assignee listener had no events to receive and the new
-- live features (installer dashboard, job form) need them too. Additive and
-- idempotent — safe to apply while production is live; nothing changes until
-- the UI subscribes. Delivery respects RLS per-row (0037/0039 policies), so
-- installers never receive suggestion rows.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'job_assignees'
  ) then
    alter publication supabase_realtime add table job_assignees;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'job_tasks'
  ) then
    alter publication supabase_realtime add table job_tasks;
  end if;
end $$;

-- Full old-row images so DELETE/UPDATE payloads carry all columns
-- (same as 0009 for messages/files and 0011 for jobs).
alter table job_assignees replica identity full;
alter table job_tasks     replica identity full;
```

- [ ] **Step 2: Verify numbering and pattern**

Run: `ls supabase/migrations/ | tail -3`
Expected: `0040_external_suggestions.sql` is the previous highest; the new file sorts after it. Compare structure against `0009_realtime_setup.sql` — same DO-block idempotency.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0041_realtime_assignees_tasks.sql
git commit -m "feat: migration 0041 — broadcast job_assignees + job_tasks changes"
```

---

### Task 2: `useLiveChannel` shared hook

**Files:**
- Create: `src/lib/supabase/useLiveChannel.ts`

**Interfaces:**
- Consumes: `createClient` from `@/lib/supabase/client`.
- Produces (used verbatim by Tasks 3–5, 7):
  - `type LiveTableSpec = { table: string; event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*'; filter?: string }`
  - `type LivePayload = { table: string; eventType: 'INSERT' | 'UPDATE' | 'DELETE'; new: Record<string, unknown> | null; old: Record<string, unknown> | null }`
  - `function useLiveChannel(opts: { name: string; tables: LiveTableSpec[]; onEvent: (p: LivePayload) => void; poll?: { ms: number; fn: () => void } }): void`

- [ ] **Step 1: Write the hook**

```ts
import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

export type LiveTableSpec = {
  table:   string
  event?:  'INSERT' | 'UPDATE' | 'DELETE' | '*'
  filter?: string
}

export type LivePayload = {
  table:     string
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  new:       Record<string, unknown> | null
  old:       Record<string, unknown> | null
}

type Options = {
  name:    string
  tables:  LiveTableSpec[]
  onEvent: (payload: LivePayload) => void
  poll?:   { ms: number; fn: () => void }
}

// One place for the realtime subscribe dance. The setAuth step is load-bearing:
// RLS delivers postgres_changes events to authenticated listeners only, and
// omitting it (as two hand-copies of this code once did) silently kills the
// channel — no error, no events.
export function useLiveChannel({ name, tables, onEvent, poll }: Options) {
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent
  const pollFnRef = useRef(poll?.fn)
  pollFnRef.current = poll?.fn

  // Callers pass `tables` as an inline literal; key on its content, not its
  // identity, so the channel doesn't tear down every render.
  const tablesKey = JSON.stringify(tables)
  const pollMs = poll?.ms

  useEffect(() => {
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null
    let active = true

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return
      if (session?.access_token) supabase.realtime.setAuth(session.access_token)

      let ch = supabase.channel(name)
      for (const spec of JSON.parse(tablesKey) as LiveTableSpec[]) {
        ch = ch.on(
          'postgres_changes',
          { event: spec.event ?? '*', schema: 'public', table: spec.table, filter: spec.filter },
          payload => onEventRef.current({
            table:     payload.table,
            eventType: payload.eventType,
            new:       (payload.new ?? null) as LivePayload['new'],
            old:       (payload.old ?? null) as LivePayload['old'],
          }),
        )
      }
      channel = ch.subscribe()
    })

    const timer = pollMs ? setInterval(() => pollFnRef.current?.(), pollMs) : null
    return () => {
      active = false
      if (channel) supabase.removeChannel(channel)
      if (timer) clearInterval(timer)
    }
  }, [name, tablesKey, pollMs])
}
```

Note: if `payload.table` / `payload.eventType` typing from supabase-js disagrees, the payload callback parameter can be typed as the supabase `RealtimePostgresChangesPayload<Record<string, unknown>>` and narrowed — but try the direct form first; supabase-js exposes both fields.

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: clean exit, no output.

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase/useLiveChannel.ts
git commit -m "feat: useLiveChannel hook — shared authenticated realtime subscribe"
```

---

### Task 3: ScheduleShell onto the hook

**Files:**
- Modify: `src/features/schedule/ScheduleShell.tsx` (the realtime `useEffect` near the top of the component — currently the getSession/setAuth version from commit d64f6bb)

**Interfaces:**
- Consumes: `useLiveChannel` from Task 2. Behavior must be identical to today: any `jobs` event → `router.refresh()`; 2-min poll fallback.

- [ ] **Step 1: Replace the effect**

Delete the whole realtime `useEffect(() => { const supabase = createClient() … }, [router])` block (it starts under the comment "Refresh server data on job changes"). Keep the comment. Replace with:

```tsx
  // Refresh server data on job changes (realtime) + every 2 min as fallback.
  // router.refresh() re-fetches server data while preserving all React state
  // (selected date, view mode, filters) — no visible disruption to the user.
  useLiveChannel({
    name:    'schedule-jobs-live',
    tables:  [{ table: 'jobs' }],
    onEvent: () => router.refresh(),
    poll:    { ms: 2 * 60 * 1000, fn: () => router.refresh() },
  })
```

Add the import: `import { useLiveChannel } from '@/lib/supabase/useLiveChannel'`.
Remove now-unused imports: `createClient` (was only used in the deleted effect) and `useEffect` if nothing else in the file uses it (search first — as of writing, this was the only `useEffect` in the file).

- [ ] **Step 2: Type-check + build**

Run: `npm run type-check` then `npm run build`
Expected: both clean. Build failure on unused imports means Step 1's import cleanup missed one.

- [ ] **Step 3: Commit**

```bash
git add src/features/schedule/ScheduleShell.tsx
git commit -m "refactor: ScheduleShell live refresh via useLiveChannel"
```

---

### Task 4: FCFSShell onto the hook

**Files:**
- Modify: `src/features/fcfs/FCFSShell.tsx` (the realtime `useEffect` under the comment "Live refresh on job / assignment changes")

**Interfaces:**
- Consumes: `useLiveChannel` (Task 2); events for `job_assignees` start flowing once migration 0041 (Task 1) is applied.

- [ ] **Step 1: Replace the effect**

Delete the whole realtime `useEffect` block (getSession/setAuth version, channel `'fcfs-live'`). Replace with:

```tsx
  // Live refresh on job / assignment changes + 2-min polling fallback,
  // mirroring the schedule page. job_assignees events flow once migration
  // 0041 adds the table to the realtime publication.
  useLiveChannel({
    name:    'fcfs-live',
    tables:  [{ table: 'jobs' }, { table: 'job_assignees' }],
    onEvent: () => refetch(dateRef.current, false),
    poll:    { ms: 2 * 60 * 1000, fn: () => refetch(dateRef.current, false) },
  })
```

Add the `useLiveChannel` import; remove `createClient` from imports if the deleted effect was its only use (check — `FCFSShell` has other `useEffect`s, keep that import).

- [ ] **Step 2: Type-check + build**

Run: `npm run type-check` then `npm run build`
Expected: both clean.

- [ ] **Step 3: Commit**

```bash
git add src/features/fcfs/FCFSShell.tsx
git commit -m "refactor: FCFSShell live refresh via useLiveChannel"
```

---

### Task 5: Installer dashboard goes live

**Files:**
- Modify: `src/features/installer/InstallerShell.tsx`

**Interfaces:**
- Consumes: `useLiveChannel` (Task 2), `job_assignees` broadcasts (Task 1). The page `src/app/installer/page.tsx` is already a server component fetching via `getInstallerJobs()` — `router.refresh()` re-runs it.

- [ ] **Step 1: Add the live channel**

In `InstallerShell` (`'use client'` component, props `{ jobs, lang, userName }`):

Add imports:
```tsx
import { useRouter } from 'next/navigation'
import { useLiveChannel } from '@/lib/supabase/useLiveChannel'
```

Inside the component body, before the existing `useState` lines:

```tsx
  const router = useRouter()

  // A newly assigned job appears on its own. RLS scopes events to this
  // installer's own rows — suggestion inserts don't match their policy
  // (migration 0037), so suggested jobs stay hidden until formally assigned.
  useLiveChannel({
    name:    'installer-jobs-live',
    tables:  [{ table: 'jobs' }, { table: 'job_assignees' }],
    onEvent: () => router.refresh(),
    poll:    { ms: 2 * 60 * 1000, fn: () => router.refresh() },
  })
```

- [ ] **Step 2: Type-check + build**

Run: `npm run type-check` then `npm run build`
Expected: both clean.

- [ ] **Step 3: Commit**

```bash
git add src/features/installer/InstallerShell.tsx
git commit -m "feat: installer dashboard live refresh (jobs + assignments)"
```

---

### Task 6: Self-fetching sections accept a `refreshKey`

**Files:**
- Modify: `src/features/job-detail/AttachmentBuckets.tsx`
- Modify: `src/features/job-detail/TaskListSection.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: optional `refreshKey?: number` prop on both components — bumping it re-runs their data fetch. Task 7 passes it from `JobDetailShell`. Existing callers (`NewJobShell`) omit it and behave exactly as before.

- [ ] **Step 1: AttachmentBuckets accepts `refreshKey`**

Add `refreshKey?: number` to its `Props` interface and destructure it. Change the load effect (currently `useEffect(() => { load() }, [jobId])`) to:

```tsx
  useEffect(() => { load() }, [jobId, refreshKey])  // eslint-disable-line react-hooks/exhaustive-deps
```

Rename-in-progress safety: `BucketCard`'s `name` state lives in the child keyed by `bucket.id`, so a reload that replaces the `buckets` array does not remount cards or clobber a rename mid-typing. Verify the map uses `key={bucket.id}` (it does as of writing; if not, make it so).

- [ ] **Step 2: TaskListSection accepts `refreshKey`**

Add `refreshKey?: number` to `Props` and destructure. Change its fetch effect to re-run on the key and to never yank the list mid-drag:

```tsx
  useEffect(() => {
    if (dragId.current) return   // mid-drag — skip; the next event or reload catches up
    let cancelled = false
    fetch(`/api/jobs/${jobId}/tasks`)
      .then(r => r.ok ? r.json() : [])
      .then((data: Task[]) => { if (!cancelled) { setTasks(data); setLoaded(true) } })
      .catch(() => { if (!cancelled) setLoaded(true) })
    return () => { cancelled = true }
  }, [jobId, refreshKey])
```

- [ ] **Step 3: Type-check + build**

Run: `npm run type-check` then `npm run build`
Expected: both clean (the prop is optional; no caller changes yet).

- [ ] **Step 4: Commit**

```bash
git add src/features/job-detail/AttachmentBuckets.tsx src/features/job-detail/TaskListSection.tsx
git commit -m "feat: attachments + task list re-pull on refreshKey bump"
```

---

### Task 7: Job form hybrid — live channel, clean-sync, amber banner

**Files:**
- Modify: `src/features/job-detail/JobDetailShell.tsx`
- Modify: `src/lib/i18n/en.ts`, `src/lib/i18n/zh.ts` (two keys each; NOT `bn.ts`)

**Interfaces:**
- Consumes: `useLiveChannel` + `LivePayload` (Task 2); `refreshKey` props (Task 6); `jobs`/`job_assignees`/`job_tasks`/`files` broadcasts (Task 1).

- [ ] **Step 1: i18n keys**

`en.ts` (near the other job-form keys, e.g. below `duplicateSuccess`):
```ts
  jobUpdatedBanner: 'This job was updated by someone else',
  jobUpdatedReload: 'Tap to reload',
```
`zh.ts` (same neighborhood):
```ts
  jobUpdatedBanner: '此工作已被他人更新',
  jobUpdatedReload: '点击重新载入',
```

- [ ] **Step 2: Extract `formValuesFromJob`**

In `JobDetailShell.tsx`, above the component, add a mapper mirroring the current `useForm` `defaultValues` literal exactly (note the `.slice(0, 5)` on times):

```tsx
const formValuesFromJob = (job: JobDetail): FormValues => ({
  project_title:           job.project_title ?? '',
  date:                    job.date ?? '',
  date_end:                job.date_end ?? '',
  time_start:              job.time_start?.slice(0, 5) ?? '',
  time_end:                job.time_end?.slice(0, 5) ?? '',
  client:                  job.client ?? '',
  location:                job.location ?? '',
  description:             job.description ?? '',
  client_poc_name:         job.client_poc_name ?? '',
  client_poc_phone:        job.client_poc_phone ?? '',
  production_ready:        job.production_ready,
  do_issued:               job.do_issued,
  punctuality:             job.punctuality,
  production_instructions: job.production_instructions ?? '',
  notes:                   job.notes ?? '',
  sales_poc_id:            job.sales_poc_id ?? '',
  quote_amount:            job.job_financials?.quote_amount?.toString() ?? '',
  supplier_cost:           job.job_financials?.supplier_cost?.toString() ?? '',
  margin_notes:            job.job_financials?.margin_notes ?? '',
})
```

Then change `useForm<FormValues>({ defaultValues: { …literal… } })` to `useForm<FormValues>({ defaultValues: formValuesFromJob(job) })`.

- [ ] **Step 3: Dirty tracking + refs**

After the existing `isSubDirty` memo, add a coordinator dirty memo (same shape as `isInstallerDirty`):

```tsx
  const isCoordDirty = useMemo(() => {
    const a = new Set(selectedCoordinatorIds)
    const b = new Set(initialCoordinatorIds)
    if (a.size !== b.size) return true
    for (const id of a) if (!b.has(id)) return true
    return false
  }, [selectedCoordinatorIds, initialCoordinatorIds])
```

Near the other refs/state at the top of the component, add:

```tsx
  const [staleBanner,       setStaleBanner]       = useState(false)
  const [bucketsRefreshKey, setBucketsRefreshKey] = useState(0)
  const [tasksRefreshKey,   setTasksRefreshKey]   = useState(0)
  const suppressUntilRef = useRef(0)
  const forceApplyRef    = useRef(false)
  const dirtyRef         = useRef(false)
```

After all four dirty values exist (i.e. below `isCoordDirty`), keep the ref current:

```tsx
  dirtyRef.current = isDirty || isInstallerDirty || isSubDirty || isCoordDirty
```

And a helper (own writes echo back as events; a short window swallows them):

```tsx
  const bumpSuppression = () => { suppressUntilRef.current = Date.now() + 5000 }
```

Call `bumpSuppression()` as the first line of every handler in this file that writes to `jobs` or assignment routes. As of writing these are: `performSave`, `toggleSuggestionFor`, and the Mark Complete handler (find it via `status: 'completed'`). Grep `supabase.from('jobs').update` and `fetch(\`/api/jobs/${job.id}/` within this file to confirm none were added since.

- [ ] **Step 4: The live channel + event routing**

Below the dirty refs, add:

```tsx
  // Live updates for this job. Hybrid rule ("clean syncs, dirty warns"):
  // section data (files, tasks, team) applies silently — it never collides
  // with typing; a jobs-row change only applies silently when the form has
  // no unsaved edits, otherwise the amber banner offers an explicit reload.
  const handleLiveEvent = (payload: LivePayload) => {
    if (Date.now() < suppressUntilRef.current) return
    const row = (payload.new ?? payload.old) as { kind?: string; bucket_id?: string | null } | null
    if (payload.table === 'files') {
      if (row?.kind === 'attachment' && !row?.bucket_id) return   // chat's domain (ChatSection handles)
      if (row?.bucket_id) { setBucketsRefreshKey(k => k + 1); return }
      router.refresh()                                            // production / DO / completion photos (prop-driven)
      return
    }
    if (payload.table === 'job_tasks')     { setTasksRefreshKey(k => k + 1); return }
    if (payload.table === 'job_assignees') { router.refresh(); return }
    // jobs row — typed fields + status
    if (dirtyRef.current) setStaleBanner(true)
    else router.refresh()
  }

  useLiveChannel({
    name:   `job-form-live-${job.id}`,
    tables: [
      { table: 'jobs',          event: 'UPDATE', filter: `id=eq.${job.id}` },
      { table: 'job_assignees',                  filter: `job_id=eq.${job.id}` },
      { table: 'job_tasks',                      filter: `job_id=eq.${job.id}` },
      { table: 'files',                          filter: `job_id=eq.${job.id}` },
    ],
    onEvent: handleLiveEvent,
  })
```

Imports to add: `useLiveChannel`, `type LivePayload` from `@/lib/supabase/useLiveChannel`; add `useEffect` to the existing react import (Step 5 uses it).

- [ ] **Step 5: Apply-fresh-server-values effect**

`router.refresh()` gives the component a fresh `job` prop, but react-hook-form and the selection `useState`s only read it at mount. This effect re-baselines them whenever fresh data arrives AND nothing is dirty (or the banner tap forced it). It also runs after the user's own save (form is clean then) — which keeps the assignment baselines honest:

```tsx
  const firstJobApply = useRef(true)
  useEffect(() => {
    if (firstJobApply.current) { firstJobApply.current = false; return }
    if (dirtyRef.current && !forceApplyRef.current) return
    forceApplyRef.current = false
    reset(formValuesFromJob(job))
    setStatus(job.status)
    setSelectedInstallerIds(job.job_assignees.filter(a => !a.is_suggestion && !a.is_sub_installer).map(a => a.user_id))
    setSuggestedInstallerIds(job.job_assignees.filter(a => a.is_suggestion && !a.is_sub_installer).map(a => a.user_id))
    setSelectedSubIds(job.job_assignees.filter(a => !a.is_suggestion && a.is_sub_installer).map(a => a.user_id))
    setSuggestedSubIds(job.job_assignees.filter(a => a.is_suggestion && a.is_sub_installer).map(a => a.user_id))
    setSelectedCoordinatorIds(initialCoordinatorIds)
    setStaleBanner(false)
  }, [job])  // eslint-disable-line react-hooks/exhaustive-deps
```

And the banner's reload action (explicit discard — the only path that overrides dirty state):

```tsx
  const reloadFresh = () => {
    forceApplyRef.current = true
    router.refresh()
  }
```

- [ ] **Step 6: Banner UI + section refresh props**

In the JSX, immediately after the `<CompanyBar lang={lang} />` element at the top of the returned tree, add (Bell is already imported; amber classes match the FCFS clash chips):

```tsx
      {staleBanner && (
        <button
          type="button"
          onClick={reloadFresh}
          className="sticky top-[45px] z-40 w-full flex items-center justify-center gap-2 px-4 py-2 bg-brand-amber-soft border-b border-brand-amber/40 text-xs font-semibold text-brand-amber"
        >
          <Bell size={12} />
          {t(lang, 'jobUpdatedBanner')} — {t(lang, 'jobUpdatedReload')}
        </button>
      )}
```

Then find the `<AttachmentBuckets` and `<TaskListSection` JSX in this file and add `refreshKey={bucketsRefreshKey}` / `refreshKey={tasksRefreshKey}` respectively. Do NOT touch their usage in `NewJobShell.tsx`.

- [ ] **Step 7: Type-check + build**

Run: `npm run type-check` then `npm run build`
Expected: both clean.

- [ ] **Step 8: Commit**

```bash
git add src/features/job-detail/JobDetailShell.tsx src/lib/i18n/en.ts src/lib/i18n/zh.ts
git commit -m "feat: job form live updates — hybrid clean-sync + amber reload banner"
```

---

### Task 8: Final verification + handoff

**Files:** none (verification only)

- [ ] **Step 1: Full gate**

Run: `npm run type-check` then `npm run build`
Expected: both clean.

- [ ] **Step 2: Review the diff as a whole**

Run: `git log --oneline main..HEAD` and `git diff main --stat`
Expected: the cherry-picked auth fix + spec + plan + Tasks 1–7 commits; only the files named in this plan (plus docs) changed.

- [ ] **Step 3: STOP — ask Nic before pushing** (house rule: no push without explicit OK)

Then the rollout sequence from the spec, in order:
1. Nic runs `npx supabase db push` (applies 0041 — safe while production is live).
2. Push `feat-live-updates` → Vercel builds the branch preview.
3. Nic runs the spec's two-window test checklist (schedule, FCFS assign, installer dashboard incl. suggestion-stays-hidden, job form clean-sync, dirty-banner, chat regression).
4. On green: merge `feat-live-updates → dev` (preview check) `→ main`.
