# Job Groups on the Jobs Tab — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fold near-identical jobs (one campaign, many stores) into one shared, named group row on the Jobs tab: everyone sees the same folding; sales, coordinator, scheduler and admin can make, rename, ungroup, add to and take out of groups (tick + buttons everywhere, drag on a computer).

**Architecture:** A new `job_groups` table plus a nullable `jobs.group_id` (on delete set null). The Jobs tab loads each job's `group_id` and the names of the groups in view, then a pure `foldGroups` turns each list section into job rows and group rows. Every change goes through one server route that checks the role and that the caller can see every job involved (session client), then writes with the service key. Nothing else (schedule, My Jobs panel, job page) changes.

**Tech Stack:** Next.js 15 app router, Supabase (RLS, session vs service client), Tailwind, lucide-react icons, native HTML5 drag and drop (as `src/features/schedule/DriverBoard.tsx`), standalone `npx tsx` tests with a `check()` helper.

**Spec:** `docs/superpowers/specs/2026-11-11-gallery-groups-bulk-sheet-design.md` — Part 4 only. Mockup Nic approved: https://claude.ai/artifact/CWJsUZBEiF3kvSmcAzr9qs (sections 1, 2 "Make a group", 3).

## Global Constraints

- **Do not build from the cancelled Workflow V3 spec, and do not reuse `job_projects` / `jobs.project_id` (migration 0051).** 0051 stays applied and untouched.
- **Migration number:** claim at implementation time — `npx -y supabase@2 migration list` (highest remote) AND `git ls-tree -r --name-only <branch> -- supabase/migrations/` for every branch in `git branch -a`; take the next above both; ledger it. This plan names none (`<N>`).
- **New public table:** in the same file `grant select, insert, update, delete on public.job_groups to authenticated;` and `... to service_role;` — never `anon`; RLS enabled with policies.
- **Database before code:** migration `<N>` is applied (Nic says "apply") before any code that selects `group_id` is pushed — selecting a missing column crashes the Jobs tab (42703).
- **Only the Jobs tab changes.** Schedule, My Jobs panel, job page: untouched (the duplicate route and the Bin restore are the only server changes outside the new route).
- **Grouping changes no other job field** — the route updates `group_id` only.
- **One job, one group. No nesting. No shared details/files/timings on a group. A group never changes who can see a job.**
- **Who can change groups:** sales, coordinator, scheduler, admin (real admin via `isAdmin`; a plain admin's effective role reads `scheduler`). Designer, production, hr see groups, cannot change them. Installers never reach the Jobs tab.
- **Drafts stay private:** a group row shows only jobs the viewer can already see (0062); its count is of those; a group whose visible jobs are none shows nowhere, and its name must not be readable by that person.
- **i18n:** every new string in `en.ts` and `zh.ts`; `bn.ts` gets the English text. Dates/day names always English.
- **Overlays:** dialogs at `z-[60]` or above (the shared `Modal` already is).
- **No emoji** in UI or icons (lucide stroke icons: `Folder`, `ChevronRight`, `ChevronDown`).
- **Tests:** standalone `npx tsx <file>.test.ts` with a `check()` helper; full suite:
  `bash -c 'fails=0; n=0; for f in $(git ls-files "*.test.ts"); do n=$((n+1)); npx tsx "$f" >/dev/null 2>&1 || { echo "FAIL $f"; fails=$((fails+1)); }; done; echo "files=$n fails=$fails"'`

## Review Focus

1. **A job opened from the My Jobs panel (`?highlight=<id>`) that sits inside a closed group** — the group must open so the row scrolls into view and blinks; a closed group would swallow it. Test: `openOnLoad` in Task 1.
2. **A group made only of someone else's private drafts** — no row for anyone else, and its name not readable through the API. Test: the role check in Task 2.
3. **Restoring a job from the Bin after its group was ungrouped** — the restore must succeed with no group, not fail on the missing group. Test: `prepareRestore` in Task 2.
4. **The last job taken out of a group, or moved to another group** — the emptied group is deleted, and the "existing group" picker never offers a group with 0 visible jobs. Tests: `pickerGroups` in Task 1; emptied-group check in Task 6.
5. **Search** — a typed word matching a job inside a group shows that group opened with only the matching jobs; a word matching the group's NAME shows the whole group. Test: `filterWithGroups` in Task 1.

---

### Task 1: Group rules (pure)

**Files:**
- Create: `src/lib/utils/job-groups.ts`
- Test: `src/lib/utils/job-groups.test.ts`

**Interfaces:**
- Produces (all exported from `src/lib/utils/job-groups.ts`):
  - `type JobGroup = { id: string; name: string }`
  - `type FoldItem<T> = { kind: 'job'; job: T } | { kind: 'group'; group: JobGroup; jobs: T[] }`
  - `const GROUP_NAME_MAX = 120`
  - `canChangeGroups(role: Role, isAdmin: boolean): boolean`
  - `suggestGroupName(titles: string[]): string`
  - `titleInGroup(title: string, groupName: string): string`
  - `foldGroups<T extends { id: string; group_id: string | null }>(jobs: T[], groups: Map<string, JobGroup>): FoldItem<T>[]`
  - `groupSummary(jobs: Array<{ client: string; salesName: string | null }>): { client: string | null; salesName: string | null }`
  - `filterWithGroups<T extends { project_title: string | null; client: string; location: string; group_id: string | null }>(jobs: T[], groups: Map<string, JobGroup>, query: string): T[]`
  - `pickerGroups(jobs: Array<{ group_id: string | null }>, groups: Map<string, JobGroup>): Array<JobGroup & { count: number }>`
  - `tickState(selected: Set<string>, ids: string[]): 'all' | 'some' | 'none'`
  - `tickAll(selected: Set<string>, ids: string[]): Set<string>`
  - `openOnLoad(highlightId: string | null, jobs: Array<{ id: string; group_id: string | null }>): string | null`
  - `type GroupBody = { action: 'create'; name: string; jobIds: string[] } | { action: 'add'; groupId: string; jobIds: string[] } | { action: 'remove'; jobIds: string[] } | { action: 'rename'; groupId: string; name: string } | { action: 'ungroup'; groupId: string }`
  - `parseGroupBody(raw: unknown): GroupBody | null`

- [ ] **Step 1: Write the failing tests** — one `check()` each:

```ts
const T1 = 'Deliver Oakley & RB A4 Tentcard - Eyechamp NEX'
const T2 = 'Deliver Oakley & RB A4 Tentcard - J Glasses (PLQ)'
check('name from shared start, cut at " - "', suggestGroupName([T1, T2]) === 'Deliver Oakley & RB A4 Tentcard')
check('name cut back to a word boundary', suggestGroupName(['Fossil window change - CCP', 'Fossil window cleaning']) === 'Fossil window')
check('nothing shared → empty', suggestGroupName(['Alpha', 'Beta']) === '')
check('trailing separator trimmed', suggestGroupName(['Daikin - A', 'Daikin - B']) === 'Daikin')
check('one title → that title', suggestGroupName(['Daikin AOMM']) === 'Daikin AOMM')
check('capped at GROUP_NAME_MAX', suggestGroupName(['x'.repeat(300)]).length === 120)

check('inside a group: rest of the title', titleInGroup(T1, 'Deliver Oakley & RB A4 Tentcard') === 'Eyechamp NEX')
check('case-insensitive start', titleInGroup(T1, 'deliver oakley & rb a4 tentcard') === 'Eyechamp NEX')
check('title not starting with the name → whole title', titleInGroup('Fossil window', 'Deliver Oakley') === 'Fossil window')
check('title equal to the name → whole title', titleInGroup('Daikin', 'Daikin') === 'Daikin')
check('separators ":" "–" "," "|" "/" stripped too', titleInGroup('Daikin: Jem', 'Daikin') === 'Jem' && titleInGroup('Daikin – Jem', 'Daikin') === 'Jem')

// foldGroups: a = job in g1, b = plain, c = job in g1, d = in g2, e = in unknown group
const G = new Map([['g1', { id: 'g1', name: 'One' }], ['g2', { id: 'g2', name: 'Two' }]])
const fold = foldGroups([a, b, c, d, e], G)
check('group sits where its first job sits', fold.map(f => f.kind === 'job' ? f.job.id : f.group.id).join() === 'g1,b,g2,e')
check('group holds its jobs in list order', (fold[0] as any).jobs.map((j: any) => j.id).join() === 'a,c')
check('unknown group id → plain row', fold[3].kind === 'job')
check('empty in, empty out', foldGroups([], G).length === 0)

check('summary: shared company and sales', JSON.stringify(groupSummary([{ client: 'Luxottica', salesName: 'Nicholas' }, { client: 'Luxottica', salesName: 'Nicholas' }])) === JSON.stringify({ client: 'Luxottica', salesName: 'Nicholas' }))
check('summary: mixed → null', groupSummary([{ client: 'A', salesName: 'N' }, { client: 'B', salesName: null }]).client === null && groupSummary([{ client: 'A', salesName: 'N' }, { client: 'A', salesName: null }]).salesName === null)

check('editors', ['sales', 'coordinator', 'scheduler'].every(r => canChangeGroups(r as Role, false)))
check('viewers only', ['designer', 'production', 'hr', 'installer'].every(r => !canChangeGroups(r as Role, false)))
check('real admin always', canChangeGroups('designer', true))

check('search: job word → only matching jobs of the group', filterWithGroups(jobsInG1, G, 'eyechamp').map(j => j.id).join() === 'o1')
check('search: group name → every job of the group', filterWithGroups(jobsInG1, G, 'one').length === jobsInG1.length)
check('search: empty → all', filterWithGroups(jobsInG1, G, '  ').length === jobsInG1.length)

check('picker: only groups with a visible job, by name, counted', JSON.stringify(pickerGroups([{ group_id: 'g2' }, { group_id: 'g2' }, { group_id: null }], G)) === JSON.stringify([{ id: 'g2', name: 'Two', count: 2 }]))

check('tick state', tickState(new Set(['a']), ['a', 'c']) === 'some' && tickState(new Set(['a', 'c']), ['a', 'c']) === 'all' && tickState(new Set(), ['a']) === 'none')
check('tick group: some → all', [...tickAll(new Set(['a', 'x']), ['a', 'c'])].sort().join() === 'a,c,x')
check('tick group: all → none of them', [...tickAll(new Set(['a', 'c', 'x']), ['a', 'c'])].join() === 'x')

check('highlighted job inside a group opens it', openOnLoad('c', [a, b, c]) === 'g1')
check('highlighted plain job / none → null', openOnLoad('b', [a, b]) === null && openOnLoad(null, [a]) === null)

check('body: create trims, dedupes', JSON.stringify(parseGroupBody({ action: 'create', name: '  Oakley ', jobIds: ['a', 'a', 'b'] })) === JSON.stringify({ action: 'create', name: 'Oakley', jobIds: ['a', 'b'] }))
check('body: add / remove / rename / ungroup accepted', parseGroupBody({ action: 'add', groupId: 'g', jobIds: ['a'] }) !== null && parseGroupBody({ action: 'remove', jobIds: ['a'] }) !== null && parseGroupBody({ action: 'rename', groupId: 'g', name: 'N' }) !== null && parseGroupBody({ action: 'ungroup', groupId: 'g' }) !== null)
check('body: refused', [
  { action: 'create', name: '   ', jobIds: ['a'] }, { action: 'create', name: 'x'.repeat(121), jobIds: ['a'] },
  { action: 'add', groupId: 'g', jobIds: [] }, { action: 'add', groupId: 'g', jobIds: Array(201).fill(0).map((_, i) => 'j' + i) },
  { action: 'remove', jobIds: [5] }, { action: 'rename', groupId: '', name: 'N' }, { action: 'explode' }, null, 'x',
].every(b => parseGroupBody(b) === null))
```

Fixtures at the top of the test: `a = { id: 'a', group_id: 'g1' }`, `b = { id: 'b', group_id: null }`, `c = { id: 'c', group_id: 'g1' }`, `d = { id: 'd', group_id: 'g2' }`, `e = { id: 'e', group_id: 'gX' }` (plus the title/client/location fields the types need); `jobsInG1` = `o1` (T1), `o2` (T2), `o3` ("Deliver Oakley & RB A4 Tentcard - Owndays Jem"), all `group_id: 'g1'`, client `'Luxottica'`, location `'Singapore'`.

- [ ] **Step 2: Run to verify it fails**
Run: `npx tsx src/lib/utils/job-groups.test.ts`
Expected: FAIL — cannot find module `./job-groups`.

- [ ] **Step 3: Implement `src/lib/utils/job-groups.ts`**
  - `suggestGroupName`: longest common prefix of the trimmed titles (case-sensitive). If no title continues past it, it is the name. Otherwise: if it contains `" - "`, cut at the LAST `" - "`; else, if any title continues past it with a non-space character, cut back to the last whitespace. Then trim trailing spaces and `-–:,|/`; cap at `GROUP_NAME_MAX`.
  - `titleInGroup`: case-insensitive `startsWith`; strip leading whitespace and `-–:,|/`; empty remainder → whole title.
  - `filterWithGroups`: an empty/blank query returns `jobs`; otherwise a job matches when `[project_title ?? '', client, location]` OR its group's name contains the lower-cased query.
  - `parseGroupBody`: names trimmed, 1..`GROUP_NAME_MAX` chars; `jobIds` 1..`BULK_MAX` (import from `@/lib/utils/bulk-move`, = 200) non-empty strings, de-duplicated in order; ids non-empty strings.

- [ ] **Step 4: Run to verify it passes**
Run: `npx tsx src/lib/utils/job-groups.test.ts`
Expected: every check passes.

- [ ] **Step 5: Commit**
`git add src/lib/utils/job-groups.ts src/lib/utils/job-groups.test.ts && git commit -m "feat(groups): group rules — name fill, folding, search, ticks, request shape (pure)"`

---

### Task 2: Database, loading, duplicate and Bin

**Files:**
- Create: `supabase/migrations/<N>_job_groups.sql`
- Create: `src/lib/supabase/queries/job-groups.ts`
- Modify: `src/lib/supabase/queries/jobs.ts` (`StageJob` + `getStageJobs` select)
- Modify: `src/app/job-list/page.tsx`
- Modify: `src/app/api/jobs/[id]/duplicate/route.ts`
- Modify: `src/lib/utils/bin-snapshot.ts`, `src/app/api/bin/[id]/restore/route.ts`
- Test: `src/lib/utils/bin-snapshot.test.ts`; live role check (scratchpad SQL)

**Interfaces:**
- Consumes: `JobGroup` (Task 1).
- Produces:
  - `StageJob.group_id: string | null`
  - `getJobGroups(ids: string[]): Promise<JobGroup[]>` (session client; `[]` for no ids)
  - `StageListShell` gains prop `groups: JobGroup[]`
  - `prepareRestore(s, existingUserIds, existingContactIds, existingGroupIds: Set<string>)`

- [ ] **Step 1: Claim the migration number** (Global Constraints) and ledger which number and what was checked.

- [ ] **Step 2: Write `<N>_job_groups.sql`**
  - `job_groups(id uuid pk default gen_random_uuid(), name text not null check (char_length(btrim(name)) between 1 and 120), created_by uuid references users(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now())`; `before update` trigger using the existing `touch_updated_at()`.
  - `alter table jobs add column group_id uuid references job_groups(id) on delete set null;` + partial index `jobs_group_id_idx on jobs(group_id) where group_id is not null`.
  - RLS on; ONE policy, select to authenticated: `exists (select 1 from public.jobs j where j.group_id = job_groups.id)` — runs under the caller's own jobs RLS, so a group made only of drafts they can't see is unreadable (Review Focus 2). No write policies: only the route's service client writes.
  - The two grant lines (Global Constraints). Header comment: why, spec link, number claim, "do not reuse job_projects (0051)".

- [ ] **Step 3: Write the failing Bin test** in `bin-snapshot.test.ts`:
```ts
check('restore keeps a group that still exists', prepareRestore(snapWith({ group_id: 'g1' }), users, contacts, new Set(['g1'])).snapshot.job.group_id === 'g1')
check('restore drops a group that is gone', prepareRestore(snapWith({ group_id: 'g9' }), users, contacts, new Set(['g1'])).snapshot.job.group_id === null)
```
Run `npx tsx src/lib/utils/bin-snapshot.test.ts` → FAIL (group_id kept as 'g9'). Then add the 4th parameter to `prepareRestore` (blank `job.group_id` when it is set and not in the set; not added to `leftOff` — it is not a person), and pass it from the restore route: `svc.from('job_groups').select('id').eq('id', <snapshot group_id>)` when the snapshot has one, else an empty set. Re-run → PASS.

- [ ] **Step 4: Loading and duplicate**
  - `getStageJobs`: add `group_id` to the select and to `StageJob` (doc line: "Jobs tab groups (<N>) — null when not grouped").
  - `getJobGroups(ids)` in the new queries file: `select id, name from job_groups where id in ids`.
  - `job-list/page.tsx`: collect distinct `group_id`s from `allOngoing` and `drafts` (not the panel's scheduled jobs) → `getJobGroups` → pass `groups`. (Add `groups: JobGroup[]` to `StageListShell`'s props now, unused until Task 4.)
  - Duplicate route: add `group_id` to the source select and to the insert (Nic: a duplicate joins the same group; it starts as the duplicator's private draft as always).

- [ ] **Step 5: Type-check and suite**
Run: `npx tsc --noEmit` then the full suite. Expected: clean; `fails=0`.

- [ ] **Step 6: Commit** — `feat(groups): job_groups table, group_id on jobs, loading, duplicate keeps the group, Bin restore drops a gone group`

- [ ] **Step 7: STOP — ask Nic for "apply".** Then: `npx -y supabase@2 db push --linked --dry-run` (expect only `<N>`), apply, `migration list` shows `<N>` remote. Ledger it.

- [ ] **Step 8: Live role check (saves nothing)** — the rolled-back DO-block pattern (memory `reference-db-query-role-check`; template `chat-rule-check.sql` from 2026-11-12): as postgres insert a group G and set `group_id = G` on one real Draft (status `pending`) created by sales person S — if S has none, insert a throwaway pending job for S inside the block; then as a DIFFERENT sales account: `select count(*) from job_groups where id = G` → 0; as S → 1; raise with the counts. Expected: `other=0 owner=1`. Confirm afterwards no test group exists.

---

### Task 3: The group-change route

**Files:**
- Create: `src/app/api/job-groups/route.ts`
- Create: `src/features/stages/group-api.ts`

**Interfaces:**
- Consumes: `parseGroupBody`, `canChangeGroups`, `GroupBody` (Task 1); `getEffectiveRole` (`@/lib/utils/role-override`).
- Produces:
  - `POST /api/job-groups` with a `GroupBody` → `200 { ok: true, groupId?: string }` | `400 { error: 'bad_request' }` | `401` | `403 { error: 'forbidden' }` | `404 { error: 'not_found' }` | `500 { error: 'failed' }`
  - `postGroupChange(body: GroupBody): Promise<{ ok: boolean; groupId?: string }>` (client helper; network failure → `{ ok: false }`)

- [ ] **Step 1: Write the route**, in this order:
  1. session user + `users` row (`id, role`) → 401;
  2. `canChangeGroups(await getEffectiveRole(profile.role), profile.role === 'admin')` → else 403;
  3. `parseGroupBody` → 400;
  4. **visibility, on the session client:** every `jobIds` must come back from `jobs.select('id').in('id', jobIds)` (count equal) → else 404; for `add`/`rename`/`ungroup` the group must be readable on the session client (`job_groups.select('id').eq('id', groupId)` — Task 2's policy makes that "has a job you can see") → else 404;
  5. **writes, on the service client**, touching `group_id` / `job_groups` only:
     - `create`: insert `{ name, created_by: profile.id }` → id; set `group_id` on `jobIds`; return `groupId`.
     - `add`: set `group_id = groupId` on `jobIds`.
     - `remove`: set `group_id = null` on `jobIds`.
     - `rename`: update `name`.
     - `ungroup`: delete the group (the FK un-sets every job's `group_id`, including jobs this person can't see — Ungroup unfolds the group for everyone).
     - After `create`/`add`/`remove`: for each group the moved jobs were in BEFORE (read on the service client before writing), delete it if no job has it any more (Review Focus 4).
  Any write error → 500, logged with `[job-groups]`.

- [ ] **Step 2: Write `group-api.ts`** — `postGroupChange` posts JSON and maps `res.ok` / `data.groupId`.

- [ ] **Step 3: Type-check and suite** — `npx tsc --noEmit`; full suite. Expected: clean, `fails=0`. (The route's rules are Task 1's tested functions; its writes are proven in Task 6 on the preview.)

- [ ] **Step 4: Commit** — `feat(groups): one route to make, add to, take out of, rename and ungroup — checks the role and that every job is visible, then writes only group_id`

---

### Task 4: Folded groups on the Jobs tab

**Files:**
- Create: `src/features/stages/GroupBlock.tsx`
- Modify: `src/features/stages/StageListShell.tsx`, `src/features/stages/ArrangeList.tsx`
- Modify: `src/lib/i18n/en.ts`, `zh.ts`, `bn.ts`

**Interfaces:**
- Consumes: `foldGroups`, `titleInGroup`, `groupSummary`, `filterWithGroups`, `tickState`, `tickAll`, `openOnLoad`, `canChangeGroups` (Task 1); `groups` prop (Task 2).
- Produces:
  - `GroupBlock({ group, jobs, open, onToggleOpen, tick, onTickAll, canChange, onRename, onUngroup, renderJob, drop, lang })` where `tick: 'all' | 'some' | 'none' | null` (null = no tick box), `renderJob: (job: StageJob, shortTitle: string) => ReactNode`, `drop?: { active: boolean; props: React.HTMLAttributes<HTMLDivElement> }` (Task 5 fills it).
  - `ArrangeList` gains `groups: Map<string, JobGroup>` and `renderGroup: (group: JobGroup, sectionJobs: StageJob[], renderCard: (job: StageJob, shortTitle: string) => ReactNode) => ReactNode`. ArrangeList only folds each of its sections and hands over its own card renderer; the shell owns open state, ticks and the dialog, and renders the `GroupBlock` for both lists.

- [ ] **Step 1: `GroupBlock`** — as the approved mockup: one `rounded-[14px] border border-line bg-paper` card; head = tick box (when `tick` not null; `indeterminate` for `'some'`), `Folder` icon on a soft-green square, name (`font-display text-sm font-semibold`), a line `client · Sales: name` from `groupSummary` (each part only when shared; `arrangeSales` key for "Sales"), a dark count pill (`jobs.length`), `ChevronRight`/`ChevronDown`. Tapping the head (not the tick box) toggles open. When open: if `canChange`, a line of two text buttons **Rename** and **Ungroup** (Ungroup in `text-bad`); then the jobs, each via `renderJob(job, titleInGroup(title, group.name))`, on a slightly darker band with a thin green left rule. Show every job when open (no "N more" — the person opened it on purpose).

- [ ] **Step 2: Shell and ArrangeList**
  - Filter with `filterWithGroups` (replaces the inline filter).
  - Fold **each section separately** — Ongoing's dated and "Date to be confirmed" lists, Drafts, and each To arrange sub-section — so a group appears in every section holding only that section's jobs (spec: "in each sub-section … with only that section's jobs"; Ongoing's two sections follow the same rule — ledger this as a ruling).
  - Open state: `useState<Set<string>>` seeded from `openOnLoad(highlight, jobs)` and re-seeded when `highlight` changes (before `blinkJobCards` runs, so the row exists — Review Focus 1). While the search box has text, every group renders open.
  - `renderJob` = the existing row / card with the short title and `text-[13px]` title size; its tick box, link, reasons line unchanged.
  - Tick box on a group head when the list shows tick boxes; `onTickAll` = `setSelected(s => tickAll(s, sectionJobIds))`. Ticks on To arrange now show when `acts.toOngoing || canGroup` (was `acts.toOngoing`); `canTick` gains `|| canGroup`, where `canGroup = canChangeGroups(role, isAdmin)`.
  - Rename/Ungroup open Task 5's dialog — in this task, wire them to a no-op prop so the task stands alone.

- [ ] **Step 3: i18n** — en (zh translated, bn = en):
  `groupRename: "Rename"`, `groupUngroup: "Ungroup"`, `groupJobsCount: "{n} jobs"`.

- [ ] **Step 4: Type-check, suite, build** — `npx tsc --noEmit`; full suite; `npm run build`. Expected: clean; `fails=0`; build passes.

- [ ] **Step 5: Commit** — `feat(groups): grouped jobs fold into one row on every Jobs tab list — open, tick the lot, search opens them`

---

### Task 5: Making and changing groups (buttons, dialog, drag)

**Files:**
- Create: `src/features/stages/GroupDialog.tsx`
- Create: `src/features/stages/useJobDrag.ts`
- Modify: `src/features/stages/StageListShell.tsx`, `ArrangeList.tsx`, `GroupBlock.tsx` (drop props)
- Modify: `src/lib/i18n/en.ts`, `zh.ts`, `bn.ts`

**Interfaces:**
- Consumes: `postGroupChange` (Task 3); `suggestGroupName`, `pickerGroups`, `GROUP_NAME_MAX` (Task 1); `GroupBlock` (Task 4).
- Produces:
  - `GroupDialog({ mode, count, initialName, existing, onClose, onCreate, onAdd, onRename, onUngroup, busy, lang })` with `mode: 'create' | 'add' | 'rename' | 'ungroup'`, `existing: Array<JobGroup & { count: number }>`.
  - `useJobDrag({ enabled, onAdd, onRemove })` → `{ dragProps(job: StageJob), groupDrop(groupId: string), listDrop, draggingId }`; `ArrangeList` gains optional `dragProps?: (job: StageJob) => React.HTMLAttributes<HTMLLIElement>` for its cards.

- [ ] **Step 1: Selection bar** (only when `canGroup`), after the existing buttons, same styling as the mockup's light buttons:
  - **Group** when 2 or more are ticked → dialog `create` (name pre-filled with `suggestGroupName` of the ticked jobs' shown titles `project_title || client`, plus "or add them to an existing group" list from `pickerGroups(all visible jobs on the tab, groups)`).
  - **Add to group** when 1 or more are ticked and `pickerGroups(...)` is not empty → dialog `add` (the list only).
  - **Remove from group** when any ticked job has a `group_id`.
  - After a success: clear ticks and reasons, success toast, `router.refresh()`. Failure: error toast; ticks stay.

- [ ] **Step 2: `GroupDialog`** on the shared `Modal` (`z-[60]`):
  - `create`: title "Group {n} jobs"; name input (maxLength `GROUP_NAME_MAX`, hint "Filled in from the start the titles share. Change it if you like."); "or add them to an existing group" then one tappable row per existing group (`Folder` icon, name, "{n} jobs") → `onAdd(groupId)`; buttons Cancel / **Group** (disabled while the trimmed name is empty or `busy`).
  - `add`: title "Add {n} jobs to a group"; the list only; Cancel.
  - `rename`: title "Rename group"; name input; Cancel / **Save**.
  - `ungroup`: title "Ungroup?"; "The {n} jobs stay as they are. Only the group goes."; Cancel / **Ungroup** (red). (A confirm because regrouping 20 jobs by hand is the cost of a slip — ledger as a ruling.)

- [ ] **Step 3: Drag on a computer (`useJobDrag`)** — native drag and drop, enabled only when `canGroup` and `window.matchMedia('(pointer: fine)').matches` (read after mount):
  - every job row/card is `draggable`; `onDragStart` stores the job id;
  - a group head accepts the drop when the dragged job is not already in it: dashed green border, soft-green fill, hint "Let go to add to this group" → `add` with that one job;
  - while a job that IS in a group is dragged, the list area outside groups accepts the drop (hint at the top of the list: "Let go to take it out of the group") → `remove`;
  - `dragend` always clears the state.

- [ ] **Step 4: i18n** — en (zh translated, bn = en):
  `groupAction: "Group"`, `groupAddTo: "Add to group"`, `groupRemoveFrom: "Remove from group"`,
  `groupCreateTitle: "Group {n} jobs"`, `groupNameHint: "Filled in from the start the titles share. Change it if you like."`,
  `groupOrExisting: "or add them to an existing group"`, `groupAddTitle: "Add {n} jobs to a group"`,
  `groupRenameTitle: "Rename group"`, `groupUngroupTitle: "Ungroup?"`, `groupUngroupBody: "The {n} jobs stay as they are. Only the group goes."`,
  `groupDropIn: "Let go to add to this group"`, `groupDropOut: "Let go to take it out of the group"`,
  `groupMade: "Grouped {n} jobs"`, `groupAdded: "Added {n} jobs to the group"`, `groupRemoved: "Took {n} jobs out of their group"`,
  `groupRenamed: "Group renamed"`, `groupUngrouped: "Group removed — the jobs are back in the list"`, `groupFailed: "Couldn't change the group. Try again."`

- [ ] **Step 5: Type-check, suite, build** — as Task 4. Expected: clean; `fails=0`; build passes. Also `toast-layer.test.ts` stays green (no new z-index above the toast layer).

- [ ] **Step 6: Commit** — `feat(groups): tick then Group / Add to group / Remove from group, rename and ungroup, drag in and out on a computer`

---

### Task 6: Real-data check on the preview (after merge + Nic's "push")

The preview shares the live database: every group made here is real, so finish by ungrouping everything this check made.

- [ ] **Step 1:** As a sales account on the preview's Jobs tab: tick 2+ real Oakley-style jobs on To arrange → **Group** → the name fills itself → Group. Expect one folded row in "Needs a date" with the shared company/sales line and the right count; open it → short titles.
- [ ] **Step 2:** Duplicate one grouped job → the copy shows in the same group in YOUR Drafts only; signed in as another sales person (or by the Task 2 role check), the group row in their Drafts does not show it.
- [ ] **Step 3:** Drag a plain job onto the group (computer) → it joins; drag it out → it leaves. Tick the last remaining jobs → **Remove from group** → the group is gone from every list AND from the `job_groups` table (`db query` count) — Review Focus 4.
- [ ] **Step 4:** Open a grouped job from the My Jobs panel → the group opens and the row blinks. Search a store name → only that job, group opened.
- [ ] **Step 5:** Rename, then Ungroup → jobs back as plain rows; `job_groups` has no row left from this check. Ledger the results.

---

## Rulings already made in this plan (for Nic to check)

- Ongoing's two sections (dated / "Date to be confirmed") each show the group with their own jobs, like To arrange's sub-sections.
- An open group shows all its jobs (the mockup's "16 more" was a mockup shortcut).
- **Group** needs at least 2 ticked jobs; **Add to group** works for 1.
- Ungroup asks once to confirm.
- Search also matches the group's name (shows the whole group).
- A group left with no jobs is deleted by the route; the Jobs tab has no live refresh today and gets none here — other people see a group change on their next load or refresh.
