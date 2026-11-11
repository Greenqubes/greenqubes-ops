# Bulk Move Back Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the Jobs tab, tick several jobs and move them back one stage together: To arrange → Ongoing (sales side) and Ongoing → Drafts. The rules are those for one job at a time, and failures stay ticked with a reason.

**Architecture:**
- Pure rules (reason mapping, result splitting, which actions a list offers, the batch bell text, body parsing) live in one tested file.
- To arrange → Ongoing uses a new bulk route. It runs the existing per-job checks and the existing `pull_back` write with its bell silenced, then sends ONE bell card per scheduler.
- Ongoing → Drafts calls the existing per-job stage route once per job, from the browser, as bulk delete already does. That move sends no notifications.

**Tech Stack:** Next.js 15 app router, Supabase (session client + service key), TypeScript, standalone `npx tsx` tests.

**Spec:** `docs/superpowers/specs/2026-11-11-gallery-groups-bulk-sheet-design.md`, Part 1 (mockup: https://claude.ai/artifact/CWJsUZBEiF3kvSmcAzr9qs, section 2).

## Global Constraints

- The rules are exactly those for one job at a time. No change to who may move which job (`canArrange` / `isArrangeSalesSide`, `canMoveStage`, `stageMoveBlocked`).
- A bulk "Back to Ongoing" sends **one** bell card per scheduler, never one per job. A single-job pull back keeps its own card exactly as today.
- No Telegram from either bulk move.
- No new way to move a job forward in bulk.
- i18n: every new string goes in `src/lib/i18n/en.ts` and `zh.ts`. `bn.ts` gets the English text, with the file's existing English-fallback comment style.
- No emoji. Overlays (none expected here) at `z-[60]`+.
- No migration in this plan.
- Tests: standalone `npx tsx <file>.test.ts` with the repo's `check()` helper; exit 1 on failure.
- Full suite command, used by every task's last step:
  `bash -c 'fails=0; for f in $(git ls-files "*.test.ts"); do npx tsx "$f" >/dev/null 2>&1 || { echo "FAIL $f"; fails=$((fails+1)); }; done; echo "fails=$fails"'`

## Review Focus

1. **A stale screen:** someone else moved or re-offered the job after the list loaded. The job must stay ticked with "This job changed. Refresh and try again", and must never move. The per-job `seen` check gives this; the mapping test pins `state_changed`, `invalid_move` and `not_ongoing`.
2. **Network drops mid-batch:** the jobs that went through leave the list; the rest stay ticked with "No connection". Test: status `0` → `no_connection`.
3. **A bad bulk body:** empty list, more than 200 jobs, duplicate ids, non-string ids, or a missing `seen`. Expect a 400 for an unusable body, duplicates collapsed, and a missing `seen` treated as a stale screen (not a crash). Test: `parseBulkBody` cases.
4. **A batch of one:** the bell must read exactly like a single pull back ("Back to Ongoing: <title>") and open the job. Test: `batchBellText` with one title, plus the route's `job_id` rule.
5. **Admin:** `role` reads `'scheduler'` for a plain admin, but admin is sales side for To arrange. Admin must get Back to Ongoing. Test: `bulkActionsFor('arrange', 'scheduler', true)`.

---

### Task 1: Bulk-move rules (pure)

**Files:**
- Create: `src/lib/utils/bulk-move.ts`
- Test: `src/lib/utils/bulk-move.test.ts`

**Interfaces:**
- Consumes: `StageView` from `src/features/stages/stage-view.ts` (`'drafts' | 'ongoing' | 'arrange'`), `Role` from `src/lib/supabase/types`.
- Produces:
  - `type BulkFailReason = 'designer_on_job' | 'not_yours' | 'changed' | 'no_connection' | 'other'`
  - `type BulkOutcome = { id: string; ok: boolean; reason?: BulkFailReason }`
  - `bulkFailReason(status: number, error: string | undefined): BulkFailReason`
  - `splitBulk(outcomes: BulkOutcome[]): { moved: string[]; failed: Array<{ id: string; reason: BulkFailReason }> }`, keeping input order
  - `bulkActionsFor(view: StageView, role: Role, isAdmin: boolean): { toOngoing: boolean; toDraft: boolean }`
  - `batchBellText(titles: string[], salesName: string): { title: string; body: string }`
  - `parseBulkBody(raw: unknown): Array<{ id: string; seen: unknown }> | null`
  - `BULK_MAX = 200`
  - `BULK_REASON_KEY: Record<BulkFailReason, TranslationKey>`, mapping each reason to the i18n keys added in Task 3:
    - `designer_on_job` → `bulkWhyDesigner`
    - `not_yours` → `bulkWhyNotYours`
    - `changed` → `bulkWhyChanged`
    - `no_connection` → `bulkWhyOffline`
    - `other` → `bulkWhyOther`

    (Type it as `keyof Translations` from `src/lib/i18n/en.ts`. Add the five keys to `en.ts` in this task so it compiles; Task 3 adds zh/bn.)

- [ ] **Step 1: Write the failing test** `src/lib/utils/bulk-move.test.ts`

```ts
import { bulkFailReason, splitBulk, bulkActionsFor, batchBellText, parseBulkBody, BULK_MAX } from './bulk-move'
// check() helper exactly as in src/lib/utils/installer-crew.test.ts

check('designers block → designer_on_job', bulkFailReason(409, 'designers_assigned'), 'designer_on_job')
check('403 not_permitted → not_yours',      bulkFailReason(403, 'not_permitted'), 'not_yours')
check('stale seen → changed',               bulkFailReason(409, 'state_changed'), 'changed')
check('invalid_move → changed',             bulkFailReason(409, 'invalid_move'), 'changed')
check('not_ongoing → changed',              bulkFailReason(409, 'not_ongoing'), 'changed')
check('404 → changed',                      bulkFailReason(404, 'Not found'), 'changed')
check('network (status 0) → no_connection', bulkFailReason(0, undefined), 'no_connection')
check('500 → other',                        bulkFailReason(500, 'boom'), 'other')

check('split keeps order', splitBulk([
  { id: 'a', ok: true }, { id: 'b', ok: false, reason: 'changed' }, { id: 'c', ok: true },
]), { moved: ['a', 'c'], failed: [{ id: 'b', reason: 'changed' }] })
check('split: failure without reason → other', splitBulk([{ id: 'x', ok: false }]),
  { moved: [], failed: [{ id: 'x', reason: 'other' }] })

check('arrange: sales → toOngoing',              bulkActionsFor('arrange', 'sales', false), { toOngoing: true, toDraft: false })
check('arrange: coordinator → toOngoing',        bulkActionsFor('arrange', 'coordinator', false), { toOngoing: true, toDraft: false })
check('arrange: scheduler → nothing',            bulkActionsFor('arrange', 'scheduler', false), { toOngoing: false, toDraft: false })
check('arrange: admin (reads scheduler) → toOngoing', bulkActionsFor('arrange', 'scheduler', true), { toOngoing: true, toDraft: false })
check('ongoing: sales → toDraft',                bulkActionsFor('ongoing', 'sales', false), { toOngoing: false, toDraft: true })
check('ongoing: scheduler → toDraft',            bulkActionsFor('ongoing', 'scheduler', false), { toOngoing: false, toDraft: true })
check('ongoing: designer → nothing',             bulkActionsFor('ongoing', 'designer', false), { toOngoing: false, toDraft: false })
check('drafts: nothing',                         bulkActionsFor('drafts', 'sales', false), { toOngoing: false, toDraft: false })

check('bell for one = single pull back', batchBellText(['Owl Optics - Visual Refresh'], 'Nicholas'),
  { title: 'Back to Ongoing: Owl Optics - Visual Refresh', body: 'Not ready yet — Nicholas' })
check('bell for many', batchBellText(['Deliver Oakley - Eyechamp NEX', 'B', 'C'], 'Nicholas'),
  { title: 'Back to Ongoing: 3 jobs', body: 'Deliver Oakley - Eyechamp NEX and 2 more · Not ready yet — Nicholas' })

check('body ok', parseBulkBody({ jobs: [{ id: 'j1', seen: { state: 'needs_date', readyAt: 'r', offerAt: null } }] }),
  [{ id: 'j1', seen: { state: 'needs_date', readyAt: 'r', offerAt: null } }])
check('body dedupes ids (first wins)', parseBulkBody({ jobs: [{ id: 'j1', seen: 1 }, { id: 'j1', seen: 2 }] }), [{ id: 'j1', seen: 1 }])
check('body missing seen kept as undefined', parseBulkBody({ jobs: [{ id: 'j1' }] }), [{ id: 'j1' }])
check('body empty → null',     parseBulkBody({ jobs: [] }), null)
check('body non-string id → null', parseBulkBody({ jobs: [{ id: 5 }] }), null)
check('body not object → null', parseBulkBody('nope'), null)
check('body over max → null', parseBulkBody({ jobs: Array.from({ length: BULK_MAX + 1 }, (_, i) => ({ id: `j${i}` })) }), null)
```

(`[{ id: 'j1' }]` compares equal to `{ id, seen: undefined }` under `JSON.stringify`. That is intended: the route then fails that job's `seen` check as `state_changed`.)

- [ ] **Step 2: Run it and watch it fail**

Run: `npx tsx src/lib/utils/bulk-move.test.ts`
Expected: FAIL, cannot find module `./bulk-move`.

- [ ] **Step 3: Implement `src/lib/utils/bulk-move.ts`** with the signatures above. Mapping rules:
  - `designers_assigned` → `designer_on_job`
  - status `403` or `not_permitted` → `not_yours`
  - `state_changed` / `invalid_move` / `not_ongoing` / status `404` → `changed`
  - status `0` → `no_connection`
  - anything else → `other`

  `bulkActionsFor`:
  - `toOngoing` = `view === 'arrange' && (isAdmin || role === 'sales' || role === 'coordinator')`
  - `toDraft` = `view === 'ongoing' && (isAdmin || role === 'sales' || role === 'coordinator' || role === 'scheduler')`

  Also add the five `bulkWhy*` keys to `en.ts` (values in Task 3, Step 1).

- [ ] **Step 4: Run it and watch it pass**

Run: `npx tsx src/lib/utils/bulk-move.test.ts`
Expected: every line ✓, exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/bulk-move.ts src/lib/utils/bulk-move.test.ts src/lib/i18n/en.ts
git commit -m "feat(jobs): bulk move-back rules (pure)"
```

---

### Task 2: Server: shared arrange checks, a quiet pull back, the bulk route

**Files:**
- Create: `src/lib/arrange/check-request.ts`
- Modify: `src/app/api/jobs/[id]/arrange/route.ts` (move its checks into the helper; behaviour unchanged)
- Modify: `src/lib/arrange/actions.ts` (`runArrangeAction` gains `opts`; `pullBack` honours `quiet`)
- Modify: `src/lib/arrange/notify.ts` (`alertSchedulers` and `deliver` accept `jobId: string | null`)
- Create: `src/app/api/arrange/pull-back-bulk/route.ts`

**Interfaces:**
- Consumes: `parseBulkBody`, `batchBellText`, `BULK_MAX` (Task 1); `ARRANGE_JOB_SELECT`, `ArrangeJobRow`, `ArrangeCtx`, `runArrangeAction` (existing).
- Produces:
  - `loadArrangeRequest(supabase: SupabaseClient, profile: { id: string; name: string; role: Role }, jobId: string, action: ArrangeAction, body: Record<string, unknown>): Promise<{ ok: true; ctx: ArrangeCtx } | { ok: false; status: number; error: string }>`
    - `profile.role` is the REAL role. The helper calls `getEffectiveRole` itself, as the route does today.
    - It runs, in today's order: job visible on the session client (404 `Not found`) → Ongoing (409 `not_ongoing`) → `canArrange` (403 `not_permitted`) → `nextArrangeState` (409 `invalid_move`) → `seenMatches` (409 `state_changed`).
  - `runArrangeAction(ctx, action, body, opts?: { quiet?: boolean }): Promise<ArrangeResult>`. Only `pull_back` reads `quiet`; when true it skips `alertSchedulers`.
  - `POST /api/arrange/pull-back-bulk`
    - body: `{ jobs: Array<{ id: string; seen: ArrangeSeen }> }`
    - 200: `{ results: Array<{ id: string; ok: boolean; status: number; error?: string }> }`
    - 400: `{ error: 'bad_request' }`
    - 401: unauthorised

- [ ] **Step 1: Extract `loadArrangeRequest`** and make the single route call it. Its responses must be byte-for-byte what they were. The route keeps parsing `action`, then calls the helper, then `runArrangeAction(ctx, action, body)`.

- [ ] **Step 2: Add `opts.quiet` to `runArrangeAction` → `pullBack(ctx, quiet)`.** Widen `alertSchedulers` / `deliver` to `jobId: string | null` (the `notifications.job_id` column is nullable, 0022; a null card simply doesn't open a job).

- [ ] **Step 3: Write `POST /api/arrange/pull-back-bulk`.**
  1. Sign in and load the profile, as the single route does.
  2. `parseBulkBody` → 400 `bad_request` on null.
  3. For each job **sequentially**:
     - call `loadArrangeRequest(..., 'pull_back', { seen })`
     - on success, call `runArrangeAction(ctx, 'pull_back', {}, { quiet: true })`
     - record `{ id, ok, status, error }`
  4. After the loop, if at least one moved, call `alertSchedulers(movedIds.length === 1 ? movedIds[0] : null, { type: 'arrange_pulled_back', ...batchBellText(movedTitles, profile.name) }, null)`.
     - Titles use the same `project_title || client` rule as `titleOf` in `actions.ts`; export `titleOf` and reuse it.
  5. Return 200 with `results`.

- [ ] **Step 4: Type-check and build**

Run: `npx tsc --noEmit` → no output. Run: `npm run build` → completes, and the route list includes `/api/arrange/pull-back-bulk`.

- [ ] **Step 5: Run the full suite** (Global Constraints command)
Expected: `fails=0`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/arrange/check-request.ts "src/app/api/jobs/[id]/arrange/route.ts" src/lib/arrange/actions.ts src/lib/arrange/notify.ts src/app/api/arrange/pull-back-bulk/route.ts
git commit -m "feat(jobs): bulk Back to Ongoing route — same per-job checks, one bell card per batch"
```

---

### Task 3: The Jobs tab: tick, act, see why

**Files:**
- Modify: `src/features/stages/StageListShell.tsx`
- Modify: `src/features/stages/ArrangeList.tsx` (optional tick box per card)
- Modify: `src/lib/i18n/en.ts`, `src/lib/i18n/zh.ts`, `src/lib/i18n/bn.ts`

**Interfaces:**
- Consumes: Task 1 (`bulkActionsFor`, `bulkFailReason`, `splitBulk`, `BULK_REASON_KEY`), Task 2 (`POST /api/arrange/pull-back-bulk`), `arrangeSeen` from `arrange-rules.ts`, the existing `POST /api/jobs/[id]/stage` with `{ to: 'draft' }`.
- Produces:
  - `ArrangeList` gains optional props `selectable?: boolean; selected?: Set<string>; onToggle?: (id: string) => void; reasons?: Map<string, BulkFailReason>`
  - with `selectable`, each card renders a checkbox to the left of its `Link`, with `aria-label="Select"`; without it, cards render exactly as today

- [ ] **Step 1: Add the strings** (en exact; zh as given; bn = English):

| key | en | zh |
|---|---|---|
| `bulkSelected` | `{n} selected` | `已选 {n} 项` |
| `bulkBackToOngoing` | `Back to Ongoing` | `退回进行中` |
| `bulkBackToDrafts` | `Back to Drafts` | `退回草稿` |
| `bulkMovedOngoing` | `{n} job(s) moved back to Ongoing.` | `{n} 份工作已退回进行中。` |
| `bulkMovedDrafts` | `{n} job(s) moved back to Drafts.` | `{n} 份工作已退回草稿。` |
| `bulkMoveFailed` | `{n} couldn't move. The reason is under each one.` | `{n} 份无法移动，原因写在每份下面。` |
| `bulkWhyDesigner` | `A designer is still on this job` | `这份工作还有设计师` |
| `bulkWhyNotYours` | `Not yours to move` | `你不能移动这份工作` |
| `bulkWhyChanged` | `This job changed. Refresh and try again` | `这份工作已有变动，请刷新再试` |
| `bulkWhyOffline` | `No connection. Try again` | `没有网络，请再试` |
| `bulkWhyOther` | `Couldn't move this one` | `这份无法移动` |

- [ ] **Step 2: Wire the shell.**
  - `const acts = bulkActionsFor(view, role, isAdmin)`.
  - Tick boxes show when `canBulkDelete || acts.toOngoing || acts.toDraft`. The Ongoing/Drafts rows use the existing checkbox; To arrange passes `selectable` to `ArrangeList`.
  - New state: `reasons: Map<string, BulkFailReason>`. Clear it in the existing `[view]` effect, alongside `selected`, and drop a job's reason when it is unticked.
  - Under a row or card whose id is in `reasons`, show one line `text-[11px] text-bad` with `tr(lang, BULK_REASON_KEY[reason])`.
  - When `selected.size > 0`, a bar replaces today's lone Delete button. It holds `bulkSelected`, then:
    - `bulkBackToOngoing` if `acts.toOngoing`
    - `bulkBackToDrafts` if `acts.toDraft`
    - the existing red `Delete {n}` if `canBulkDelete`

    All buttons are disabled while `busy`.
  - **Back to Ongoing:**
    1. Send one POST to `/api/arrange/pull-back-bulk` with `jobs: [...selected].map(id => ({ id, seen: arrangeSeen(job.arrange_state, job.arrangement) }))`.
    2. Map each result with `bulkFailReason(status, error)`. A rejected fetch makes every selected job `no_connection`.
    3. `splitBulk`.
    4. Selected = failed ids; reasons = failed.
    5. Success toast `bulkMovedOngoing` if any moved; error toast `bulkMoveFailed` if any failed.
    6. `router.refresh()`.
  - **Back to Drafts:** `Promise.all` over selected, each `POST /api/jobs/${id}/stage` `{ to: 'draft' }`. Read `status` and the JSON `error` (a rejected fetch → status `0`). Then the same split, toasts (`bulkMovedDrafts` / `bulkMoveFailed`) and refresh.

- [ ] **Step 3: Type-check and build**

Run: `npx tsc --noEmit` → no output. Run: `npm run build` → completes.

- [ ] **Step 4: Run the full suite** → `fails=0`.

- [ ] **Step 5: Commit**

```bash
git add src/features/stages/StageListShell.tsx src/features/stages/ArrangeList.tsx src/lib/i18n/en.ts src/lib/i18n/zh.ts src/lib/i18n/bn.ts
git commit -m "feat(jobs): tick several jobs and send them back to Ongoing or Drafts in one go (Nic)"
```

---

### Task 4: Real-data check on the preview (after push, with Nic's go-ahead)

No code. This is the "real file, not fixtures" check, done by Nic, or by me with his login, on the dev preview once he says push:

- [ ] On To arrange, as sales, tick 2+ of his own jobs and press Back to Ongoing.
  - They land in Ongoing.
  - A scheduler's bell shows ONE "Back to Ongoing: N jobs" card.
- [ ] On Ongoing, tick a job that has a designer, plus one that doesn't, and press Back to Drafts.
  - The plain one moves.
  - The designer one stays ticked with "A designer is still on this job".
- [ ] Switching lists clears ticks and reasons.
