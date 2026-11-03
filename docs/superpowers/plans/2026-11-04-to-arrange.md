# To arrange Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sales marks an Ongoing job "Ready to install" with a day/time guide, the scheduler offers a slot (day, time, optional crew), sales checks it with the client, and Client OK puts it on the schedule — all tracked in a new **To arrange** list in the Jobs tab, with bell + Telegram at every handover.

**Architecture:**
- **Data.** A job in To arrange stays an Ongoing job (raw status `awaiting_date`). Two new `jobs` columns carry the round trip:
  - `arrange_state` — whose turn it is
  - `arrangement` (jsonb) — the guide, the current offer, and the last "sent back" reason

  The offer's day/time are written into the job's own `date`/`time_*` columns, so there is ONE source of truth. The offer's copy is only there to detect tampering. Because these are columns on `jobs`, the Bin, pending privacy and realtime all carry them with no extra work.
- **Rules.** Every rule is a pure function in `src/lib/utils/arrange-rules.ts`. Every write goes through ONE route, `POST /api/jobs/[id]/arrange`, on the service key after the route's own checks, using conditional updates so that two people acting at once cannot both win.
- **The scheduler's offer is composed on the job page itself.** He uses the date/time fields and his green crew picks there, so the existing clash modal and save path are reused, not copied.

**Tech Stack:** Next.js 15 App Router, React 19, Supabase (Postgres + RLS) via `@supabase/ssr`, Tailwind, Telegram Bot API. Tests are standalone `npx tsx <file>.test.ts` scripts (no framework) using the repo's `check(name, actual, expected)` helper; copy the header from `src/lib/utils/job-stage-rules.test.ts`.

**Spec:** [docs/superpowers/specs/2026-11-04-to-arrange-design.md](../specs/2026-11-04-to-arrange-design.md). Read it before starting; this plan argues from it.

## Global Constraints

- **Branch `feat-to-arrange`, in a scratchpad worktree** (a second Claude window may hold the main folder). Never push without asking Nic. Never push to `main` without his words "push to main".
- **Migration number:** claim it at Task 1 per CLAUDE.md. Run `npx supabase migration list`, then check every branch (`git branch -a` + `git ls-tree -r --name-only <branch> -- supabase/migrations/`) and take the next number above both. On 2026-11-04 the highest file on `dev` was `0067`. Written below as `<N>`.
- **DB first.** The migration is applied (with Nic's OK — previews share the production DB) BEFORE any code that selects the new columns reaches a deployment.
- **No new table** → no new grants, no 0062 restrictive policy, no `BIN_CHILD_TABLES` entry. If you find yourself creating a table, stop: the plan assumes columns.
- **The status ↔ stage mapping lives only in `src/lib/utils/job-stage.ts`.** Compare raw statuses only in SQL, query filters and the new route (marked `// raw status — see job-stage.ts`).
- **Every write checks it came back** (`.select('id')` and a row count), because an RLS-filtered UPDATE returns 204 with no error. Every Telegram/bell send is **awaited**, never fire-and-forget (Vercel freezes the function), and its failures are logged, not thrown.
- **Never trust preview-as for permissions.** `isAdmin` = the REAL role (`profile.role === 'admin'`); `getEffectiveRole` never returns `'admin'`.
- **Crew offered is never written to `job_assignees` before Client OK** (0037 would let an installer see the job). `formalCrewAllowed` stays the backstop.
- **UI rules:**
  - Overlays `z-[60]`–`z-[99]`; tall dialogs use `Modal`'s `scrollBody`; time inputs use `TimeSelect` (it portals).
  - Theme colours are bare `var()`: no `/opacity` variants. Tokens are `brand-*`, errors `bad`.
  - Date labels always English: use the static `MONTHS`/`DAYS` tables, never locale calls.
- **i18n:** every new key in `src/lib/i18n/en.ts` **and** `zh.ts` (write the Chinese yourself); never `bn.ts`. Telegram and bell text are English prose, not i18n.
- **Run all suites:** `for f in $(git ls-files '*.test.ts'); do npx tsx "$f" > /dev/null || echo "FAIL $f"; done` (silent = all pass). Also `npm run type-check` and `npm run build`.
- **JobDetailShell.tsx is already 2,222 lines.** Add only wiring there (≈80 lines). Everything else goes in new files.

## Review Focus

1. **Two people act at once** (sales presses Client OK while the scheduler presses Withdraw). The second press must get `409 state_changed` and a "this job just changed — reload" toast, never a double transition. Pinned by `nextArrangeState` tests (Task 2) and by the conditional updates in Tasks 5–6. Check by hand in Task 10.
2. **The job's date/time changed after the offer**, from a stale tab or an old bundle without the lock. Client OK must refuse with `offer_changed`, not schedule the wrong day. Pinned by `offerMatchesJob` tests (Task 3).
3. **Time strings arrive as `22:00:00` from Postgres but `22:00` from the form.** Locks and comparisons must treat them as equal. Pinned in `validateOffer` and `offerMatchesJob` tests (Tasks 2–3).
4. **A To arrange job pushed by the old Push to Schedule path** (an old tab, or the scheduler bypassing). The new check constraint would refuse the UPDATE unless `/submit` and the stage route clear the arrangement in the same write. Pinned by `arrangeClearPatch` test (Task 3) and its use in Task 7.
5. **Sales types `<b>` or `&` into the note or the reason.** The Telegram (HTML mode) must still send, with the text escaped. Pinned by a template test (Task 4).

---

### Task 1: Migration + types

**Files:**
- Create: `supabase/migrations/<N>_job_arrange.sql`
- Modify: `src/lib/supabase/types.ts` (jobs Row / Insert / Update)

**Interfaces:**
- Produces: `jobs.arrange_state text null` (one of `'needs_date' | 'offered' | 'no_fit' | 'clash'`), `jobs.arrangement jsonb null`; check constraint `jobs_arrange_only_ongoing`.

- [ ] **Step 1: Claim the number** as in Global Constraints. Write the number you took, and what you checked, in the commit message.
- [ ] **Step 2: Write the migration**

```sql
-- To arrange (spec 2026-11-04-to-arrange-design.md). Columns on jobs, not a
-- table: the Bin snapshot, pending privacy (0062) and realtime all cover them
-- with no extra work. Additive only — previews share the production DB.
alter table public.jobs
  add column arrange_state text
    constraint jobs_arrange_state_valid
    check (arrange_state in ('needs_date', 'offered', 'no_fit', 'clash')),
  add column arrangement jsonb;

-- Only an Ongoing job (raw awaiting_date) can be in To arrange. Every path
-- that moves a job out of Ongoing must clear both columns in the SAME update
-- (/submit and /stage do, from this release on).
alter table public.jobs
  add constraint jobs_arrange_only_ongoing
  check (arrange_state is null or status = 'awaiting_date');
```

- [ ] **Step 3: Add the columns to `types.ts`.** Row: `arrange_state: string | null; arrangement: Json | null`. Insert/Update: both optional.
- [ ] **Step 4:** `npm run type-check`. Expected: clean.
- [ ] **Step 5: Commit** — do NOT `db push` yet; that happens in Task 10 with Nic's OK.

---

### Task 2: Pure rules — state, permissions, validation

**Files:**
- Create: `src/lib/utils/arrange-rules.ts`
- Create: `src/lib/utils/arrange-rules.test.ts`
- Modify: `src/lib/utils/job-stage-rules.ts` (export `isSharer`)

**Interfaces:**
- Consumes: `StageViewer`, `StageJob4Rules`, `isSharer` from `job-stage-rules.ts`; `Punctuality` from `@/lib/supabase/types`; `punctualityFor` from `job-form-rules.ts`.
- Produces (all exported from `arrange-rules.ts`):

```ts
export type ArrangeState = 'needs_date' | 'offered' | 'no_fit' | 'clash'
export type DayGuide =
  | { mode: 'any' }
  | { mode: 'between'; from: string; to: string }   // ISO dates, inclusive
  | { mode: 'fixed'; day: string }
export type ArrangeOffer = {
  by: string; byName: string; at: string            // at = ISO timestamp
  date: string; dateEnd: string | null; timeStart: string | null; timeEnd: string | null
  driverIds: string[]; supportIds: string[]; contactIds: string[]
  crewNames: string[]                               // drivers, then support, then contractors
  acceptedClashKeys: string[]
}
export type ArrangeReturn = {
  kind: 'client_no' | 'no_fit' | 'withdrawn' | 'clash'
  text: string | null; by: string; byName: string; at: string
}
export type Arrangement = {
  readyBy: string; readyByName: string; readyAt: string
  day: DayGuide; timeStart: string | null; timeEnd: string | null; note: string | null
  offer: ArrangeOffer | null; lastReturn: ArrangeReturn | null
}
export type ArrangeAction = 'ready' | 'offer' | 'send_back' | 'withdraw' | 'client_no' | 'client_ok' | 'pull_back'
export type GuideInput = { day: DayGuide; timeStart: string | null; timeEnd: string | null; note: string | null }
export type Slot = { date: string | null; dateEnd: string | null; timeStart: string | null; timeEnd: string | null }

export function parseArrangeState(v: unknown): ArrangeState | null
export function parseArrangement(v: unknown): Arrangement | null        // defensive: wrong shape → null
export function nextArrangeState(from: ArrangeState | null, action: ArrangeAction): ArrangeState | null | 'invalid'
export function arrangeTurn(state: ArrangeState): 'scheduler' | 'sales'
export function isArrangeSalesSide(v: StageViewer, j: StageJob4Rules): boolean
export function isArrangeSchedulerSide(v: StageViewer): boolean
export function canArrange(v: StageViewer, j: StageJob4Rules, action: ArrangeAction): boolean
export function hhmm(t: string | null | undefined): string | null
export function validateGuide(g: GuideInput): 'bad_range' | 'bad_day' | 'end_without_start' | 'end_before_start' | null
export function guideJobPatch(g: GuideInput, punctuality: Punctuality): Record<string, unknown>
export function validateOffer(a: Pick<Arrangement, 'day' | 'timeStart' | 'timeEnd'>, slot: Slot, todayISO: string):
  'date_required' | 'in_past' | 'outside_range' | 'not_fixed_day' | 'time_locked' | null
```

Decisions the tests pin:
- **`nextArrangeState`** transitions:
  - `ready`: from `null | needs_date | offered | no_fit` → `needs_date`. Editing the guide while offered withdraws the offer.
  - `offer`: `needs_date → offered`
  - `send_back`: `needs_date → no_fit`
  - `withdraw`: `offered → needs_date`
  - `client_no`: `offered → needs_date`
  - `client_ok`: `offered → null`. The route may instead write `clash`.
  - `pull_back`: any non-null → `null`
  - Everything else, and every action from `clash` except `pull_back`, is `'invalid'`. In `clash` the scheduler finishes with the normal Push to Schedule.
- **`arrangeTurn`:** `needs_date`, `clash` → scheduler; `offered`, `no_fit` → sales.
- **Sides:**
  - Sales side = `v.isAdmin || (['sales','coordinator'].includes(v.role) && isSharer(v, j))`.
  - Scheduler side = `v.role === 'scheduler' || !!v.isAdmin`.
  - `canArrange`: `ready / client_no / client_ok / pull_back` need the sales side; `offer / send_back / withdraw` need the scheduler side.
- **`validateGuide`:**
  - A `between` range needs valid ISO dates and `from <= to`; otherwise `bad_range`.
  - `fixed` needs a valid ISO `day`; otherwise `bad_day`.
  - `timeEnd` without `timeStart` → `end_without_start`.
  - `hhmm(timeEnd) <= hhmm(timeStart)` → `end_before_start`.
  - Night jobs ending after midnight are entered without an end time. This matches the job form, which has no overnight end either.
- **`guideJobPatch`:**
  - `fixed` → `{ date: day }` (leave `date_end` alone)
  - `any` / `between` → `{ date: null, date_end: null }`
  - Always `{ time_start: timeStart, time_end: timeEnd, punctuality: punctualityFor(timeStart, punctuality) }`. A cleared start time drops strict to flexible, exactly as the form does.
- **`validateOffer`**, checked in this order:
  1. no `slot.date` → `date_required`
  2. `slot.date < todayISO` → `in_past`
  3. `between` and the date is outside `[from, to]` → `outside_range`
  4. `fixed` and `date !== day` → `not_fixed_day`
  5. the guide has a `timeStart` and `hhmm(slot.timeStart) !== hhmm(a.timeStart)`, or the guide has a `timeEnd` and the ends differ → `time_locked`

- [ ] **Step 1: Write the failing tests** in `arrange-rules.test.ts`. One `check` per bullet above, plus:
  - `check('a coordinator NOT on the job is not sales side', isArrangeSalesSide({id:'c2',role:'coordinator'}, {status:'awaiting_date',created_by:'s1',sales_poc_id:'s1',coordinatorIds:['c1']}), false)`
  - `check('admin previewing as sales is still scheduler side', isArrangeSchedulerSide({id:'a',role:'sales',isAdmin:true}), true)`
  - `check('a plain scheduler cannot press Client OK', canArrange({id:'x',role:'scheduler'}, job, 'client_ok'), false)`
  - `check('DB time vs form time are the same lock', validateOffer({day:{mode:'any'},timeStart:'22:00:00',timeEnd:null}, {date:'2026-11-12',dateEnd:null,timeStart:'22:00',timeEnd:null}, '2026-11-04'), null)`
  - `check('Client OK twice is invalid the second time', nextArrangeState(null, 'client_ok'), 'invalid')`
  - `check('withdraw after Client OK is invalid', nextArrangeState(null, 'withdraw'), 'invalid')`
  - `check('nothing but pull_back leaves clash', ['ready','offer','send_back','withdraw','client_no','client_ok'].map(a => nextArrangeState('clash', a as ArrangeAction)), Array(6).fill('invalid'))`
- [ ] **Step 2:** `npx tsx src/lib/utils/arrange-rules.test.ts`. Expected: fails (module missing).
- [ ] **Step 3: Implement** the functions above. Export `isSharer` from `job-stage-rules.ts`; it is currently file-private.
- [ ] **Step 4:** re-run. Expected: `all arrange-rules checks passed`. Run all suites too (job-stage-rules must still pass).
- [ ] **Step 5: Commit.**

---

### Task 3: Pure rules — clashes, crew, locks, list, labels

**Files:**
- Modify: `src/lib/utils/arrange-rules.ts` + its test
- Create: `src/lib/utils/arrange-labels.ts` + `arrange-labels.test.ts`

**Interfaces:**
- Produces (from `arrange-rules.ts`):

```ts
export function clashKeys(r: {
  clashes: Array<{ installerId: string; conflict: { jobId: string } }>
  leaveClashes: Array<{ installerId: string }>
}): string[]                                        // 'b:<installerId>:<jobId>' and 'l:<installerId>', sorted, unique
export function newClashKeys(current: string[], accepted: string[]): string[]
export function offerMatchesJob(o: ArrangeOffer, slot: Slot): boolean
export function offerHasCrew(o: ArrangeOffer): boolean
export function clientOkSchedulerMessage(o: ArrangeOffer): 'arranged' | 'assign_crew'
export function arrangeFieldLocks(state: ArrangeState | null, a: Arrangement | null,
  side: { sales: boolean; scheduler: boolean }): { date: boolean; time: boolean }
export function seedCrewFromOffer(state: ArrangeState | null, a: Arrangement | null, canAssign: boolean):
  { driverIds: string[]; supportIds: string[] } | null
export function blocksPush(state: ArrangeState | null): boolean
export function arrangeClearPatch(): { arrange_state: null; arrangement: null }
export function groupArrangeJobs<T extends { arrange_state: ArrangeState | null; arrangement: Arrangement | null }>(
  jobs: T[]): { needsDate: T[]; withSales: T[] }
```

- Produces (from `arrange-labels.ts`; English only, static tables):

```ts
export function shortDay(iso: string): string                         // '2026-11-12' → 'Thu 12 Nov'
export function timeLabel(t: string | null): string | null            // '22:00:00' → '10:00 PM'
export function guideLabel(a: Pick<Arrangement, 'day' | 'timeStart' | 'timeEnd'>): string
  // 'Any day · any time' | 'Between Tue 10 Nov and Fri 20 Nov · 10:00 PM' | 'Sat 14 Nov only · 10:00 PM – 2:00 AM'
export function slotLabel(s: Slot): string                            // 'Thu 12 Nov · 10:00 PM' (time part omitted when null)
export function daysWaiting(sinceISO: string, todayISO: string): number
```

Decisions the tests pin:
- **`newClashKeys`**: keys in `current` but not in `accepted`. This is Nic's "only NEW clashes send it back".
- **`offerMatchesJob`**: `date`, `dateEnd`, `hhmm(timeStart)`, `hhmm(timeEnd)` all equal.
- **Crew messages:**
  - `offerHasCrew`: any id in any of the three lists.
  - `clientOkSchedulerMessage`: `'arranged'` when `driverIds.length > 0`, else `'assign_crew'`. A crew with no driver still needs the normal "Assign Installer" message.
- **`arrangeFieldLocks`:**
  - `null` → both false.
  - `offered` → both true for everyone.
  - `clash` → both true for everyone (the client agreed the slot).
  - `needs_date` / `no_fit`:
    - scheduler side → `date` locked iff `day.mode === 'fixed'`, `time` locked iff `a.timeStart`
    - anyone else → both true (sales change the slot through the guide)
  - Scheduler side wins when someone is both (admin).
- **`seedCrewFromOffer`**: `canAssign && a?.offer && (state === 'needs_date' || state === 'clash')` → the offer's driver and support ids; else `null`.
- **`blocksPush`**: true only for `offered`.
- **`groupArrangeJobs`**:
  - `needsDate` = `clash` jobs first (client already agreed), then `needs_date` by `readyAt` oldest first.
  - `withSales` = `offered` then `no_fit`, each by `offer.at` / `lastReturn.at` oldest first.
  - A job with a null or unparseable `arrangement` goes to the end of its group, never dropped.

- [ ] **Step 1: Write the failing tests**, one per bullet, plus:
  - `check('an accepted clash is not new', newClashKeys(['b:r:j1'], ['b:r:j1']), [])`
  - `check('a fresh clash is new', newClashKeys(['b:r:j1','l:a'], ['b:r:j1']), ['l:a'])`
  - `check('stale DB seconds still match the offer', offerMatchesJob({...offer, timeStart:'22:00'}, {date:offer.date, dateEnd:null, timeStart:'22:00:00', timeEnd:null}), true)`
  - `check('moved date does not match', offerMatchesJob(offer, {...slot, date:'2026-11-13'}), false)`
  - `check('arrangeClearPatch clears both', arrangeClearPatch(), {arrange_state:null, arrangement:null})`
  - `check('Thu 12 Nov', shortDay('2026-11-12'), 'Thu 12 Nov')`
  - `check('midnight', timeLabel('00:00:00'), '12:00 AM')`
  - `check('noon', timeLabel('12:00'), '12:00 PM')`
- [ ] **Step 2:** run both test files. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** run them. Expected: pass. Then run all suites.
- [ ] **Step 5: Commit.**

---

### Task 4: Telegram templates + the alert helper

**Files:**
- Modify: `src/lib/telegram/templates.ts` (four templates; reuse the file's `escHtml`)
- Create: `src/lib/telegram/arrange-templates.test.ts`
- Create: `src/lib/arrange/notify.ts`

**Interfaces:**
- Produces:

```ts
// templates.ts — every free-text field (note, text) goes through escHtml
export function tplArrangeReady(p: { projectTitle: string | null; jobClient: string; salesName: string;
  guide: string; note: string | null; location: string; jobUrl: string }): string
export function tplArrangeOffered(p: { projectTitle: string | null; jobClient: string; schedulerName: string;
  slot: string; crewNames: string[]; jobUrl: string }): string
export function tplArrangeReturned(p: { kind: ArrangeReturn['kind']; projectTitle: string | null; jobClient: string;
  byName: string; text: string | null; slot: string | null; jobUrl: string }): string
export function tplArrangeClientOk(p: { projectTitle: string | null; jobClient: string; slot: string;
  crewNames: string[]; awayNames: string[]; jobUrl: string }): string
  // awayNames non-empty → an extra line "<b>Away (warning only):</b> names" — away never blocks (spec)

// src/lib/arrange/notify.ts — never throws; logs every failure
export type ArrangeBell = { type: 'arrange_ready' | 'arrange_offered' | 'arrange_returned' | 'arrange_client_ok' | 'arrange_pulled_back'
  title: string; body: string }
export async function alertSchedulers(jobId: string, bell: ArrangeBell, telegram: string | null): Promise<void>
export async function alertSalesSide(job: { id: string; sales_poc_id: string | null; coordinatorIds: string[] },
  bell: ArrangeBell, telegram: string | null): Promise<void>
```

**Headline lines (exact copy):**

| Template / kind | First line |
|---|---|
| ready | `📋 <b>Ready to arrange</b>` |
| offered | `📅 <b>Install date offered</b>`, ending `Check with the client, then press Client OK or Client said no.` |
| client_no | `↩️ <b>Client said no</b>` |
| no_fit | `↩️ <b>Scheduler couldn't fit it</b>` |
| withdrawn | `↩️ <b>Offer withdrawn — don't confirm with the client</b>` |
| clash | `⚠️ <b>Client agreed — crew now clashes</b>` |
| client_ok | `✅ <b>Client agreed — on the schedule</b>` |

The rest of each message follows the `<b>Label:</b> value` lines of `tplJobPostponed`, ending `<a href="${jobUrl}">View in app →</a>`.

**`notify.ts`** follows `src/lib/utils/away-notify.ts`:
- **Bell rows:** insert one per recipient through the service client, with `job_id` set. The drawer's generic card already renders `title` / `body` and links to the job.
- **Telegram:** send to each recipient's `telegram_chat_id` (`deleted_at is null`). If nobody has one, `console.warn('[arrange/notify] nobody has a Telegram chat id', …)`.
- **Recipients:**
  - Schedulers = `getSchedulers()`.
  - Sales side = `sales_poc_id` + `coordinatorIds`, de-duplicated.
- `telegram === null` means bell only.

- [ ] **Step 1: Failing test**:
  - `check('reason is escaped', tplArrangeReturned({kind:'client_no', projectTitle:'Fossil', jobClient:'Fossil SG', byName:'Charles', text:'away <b>& back', slot:null, jobUrl:'u'}).includes('away &lt;b&gt;&amp; back'), true)`
  - plus one check per headline line in the table above.
- [ ] **Step 2:** run. Expected: FAIL.
- [ ] **Step 3: Implement the templates and `notify.ts`.**
- [ ] **Step 4:** run. Expected: PASS. Then run `type-check`.
- [ ] **Step 5: Commit.**

---

### Task 5: One crew-clash check for everyone

**Files:**
- Create: `src/lib/supabase/queries/crew-clash.ts`
- Modify: `src/app/api/jobs/[id]/assign-installers/route.ts` (the `checkOnly` branch only)

**Interfaces:**
- Consumes: `CheckClash`, `LeaveCheckClash`, `AwayCheckClash` from `@/features/job-detail/EditClashModal`; the existing leave/away helpers the route already imports.
- Produces:

```ts
export type CrewClashInput = { jobId: string; date: string; dateEnd: string | null; timeStart: string | null
  timeEnd: string | null; punctuality: string; driverIds: string[]; supportIds: string[] }
export type CrewClashResult = { clashes: CheckClash[]; leaveClashes: LeaveCheckClash[]; awayClashes: AwayCheckClash[] }
export async function computeCrewClashes(db: SupabaseClient<Database>, input: CrewClashInput): Promise<CrewClashResult>
```

**The move:**
- **Lift lines 97–187** of the `checkOnly` branch (the same-day booking check, leave, away) into `computeCrewClashes`, unchanged in logic, with one widening:
  - booking clashes are checked for `driverIds` only (support crew stay clash-exempt)
  - leave and away are checked for `driverIds ∪ supportIds`
- **The route then calls it** with `driverIds: installerIds, supportIds: []`, so its JSON response is byte-for-byte what it was. That is the regression check.
- **The client is passed in**, so the arrange route can pass the service client: a sales caller's session cannot see every crew row.

- [ ] **Step 1: Move the code**, then make the route call the new function. The route keeps `hasClash: clashes.length > 0 || leaveClashes.length > 0`.
- [ ] **Step 2:** `npm run type-check`. Expected: clean.
- [ ] **Step 3: Read the diff of the route.** The only change inside `checkOnly` must be the call. The response keys and the `hasClash` rule are unchanged.
- [ ] **Step 4: Commit.**

---

### Task 6: The arrange route

**Files:**
- Create: `src/app/api/jobs/[id]/arrange/route.ts` (auth, load, dispatch — keep under ~120 lines)
- Create: `src/lib/arrange/actions.ts` (one function per action)

**Interfaces:**
- Consumes: Task 2–5 exports; `missingForStage` from `job-stage-rules.ts`; `getJobNotifData`, `getSchedulers` from `queries/notifications.ts`; `tplJobAssigned`, `tplSubInstallerAssigned`, `tplNewJobCreated` from `templates.ts`.
- Produces: `POST /api/jobs/[id]/arrange` taking these bodies:

| `action` | Other fields |
|---|---|
| `'ready'` | `day: DayGuide; timeStart: string \| null; timeEnd: string \| null; note: string \| null` |
| `'offer'` | `driverIds: string[]; supportIds: string[]` |
| `'send_back'` | `text: string` (required, trimmed, non-empty) |
| `'withdraw'` | `text?: string` |
| `'client_no'` | `text: string` (required) |
| `'client_ok'` | — |
| `'pull_back'` | — |

  Responses:

  | Status | Body |
  |---|---|
  | 200 | `{ ok: true, state: ArrangeState \| null, outcome?: 'scheduled' \| 'clash', clashNames?: string[] }` |
  | 400 | `bad_request`, `bad_guide:<code>`, `bad_offer:<code>` |
  | 403 | `not_permitted` |
  | 404 | — |
  | 409 | `not_ongoing`, `invalid_move`, `state_changed`, `offer_changed` |
  | 422 | `{ error:'missing_fields', fields }` |
  | 500 | `crew_not_saved` |

**Route skeleton:**
1. Auth and profile, as in `stage/route.ts`, but select `id, name, role`. The viewer is `{ id, role: getEffectiveRole(role), isAdmin: role === 'admin' }`, and `name` feeds every `byName`.
2. Read the job on the caller's SESSION client. If it is not visible, return 404. This keeps 0062 privacy.
3. Load the job row including `arrange_state, arrangement, job_coordinators(user_id)`.
4. Run the checks in this order:
   1. `stageOf(status) === 'ongoing'`, else `not_ongoing`
   2. `canArrange`, else 403
   3. `nextArrangeState(current, action) !== 'invalid'`, else `invalid_move`
5. Hand over to the action.

**Every action:**
- Writes on `createServiceClient()` with a conditional update: `.eq('status','awaiting_date')`, plus `.eq('arrange_state', current)` (or `.is('arrange_state', null)` when null), plus `.select('id')`. Zero rows → `409 state_changed`.
- Builds the new `arrangement` from the parsed old one (`parseArrangement`).
- Uses `viewer.name` for `byName`, `readyByName` and the offer's `byName`.

**The actions:**
- **ready**
  - `validateGuide` must pass, and `missingForStage('ongoing', job)` must be empty.
  - Write `guideJobPatch(...)` plus `arrange_state: 'needs_date'` plus an arrangement with `{ readyBy, readyByName, readyAt: now, day, timeStart, timeEnd, note, offer: null, lastReturn: null }`.
  - Alert schedulers: `tplArrangeReady`, plus a bell `Ready to arrange: <title>`.
- **offer**
  - `missingForStage('scheduled', job)` must be empty.
  - Check `validateOffer(arrangement, jobSlot, todaySG)` against the job's SAVED date/time. The page saves first.
  - Clean the crew lists: de-duplicate both; support = support minus drivers.
  - `contactIds` = every `job_external_contacts.contact_id` on the job.
  - `acceptedClashKeys = clashKeys(await computeCrewClashes(svc, …))`. Computed here, never sent by the browser.
  - `crewNames`: user names for drivers then support, then `external_contacts.name` for contractors.
  - Write `arrange_state: 'offered'` and `arrangement.offer = {...}`, `lastReturn: null`.
  - Alert the sales side: `tplArrangeOffered`.
- **send_back**
  - `arrange_state: 'no_fit'`, `lastReturn: { kind:'no_fit', text }`.
  - Alert the sales side: `tplArrangeReturned`.
- **withdraw**
  - `arrange_state: 'needs_date'`, `lastReturn: { kind:'withdrawn', text }`.
  - Keep `offer`, so the scheduler's crew stays seeded.
  - Alert the sales side.
- **client_no**
  - `arrange_state: 'needs_date'`, `lastReturn: { kind:'client_no', text }`, keep `offer`.
  - Alert schedulers.
- **pull_back**
  - `arrangeClearPatch()`. The job's date/time are left as they are; an Ongoing job may hold a date.
  - Bell only to schedulers: `Pulled back to Ongoing: <title>`.
- **client_ok** — the heart:
  1. If `!offer` or `!offerMatchesJob(offer, jobSlot)` → `409 offer_changed`.
  2. If `missingForStage('scheduled', job)` is not empty → 422.
  3. Work out `fresh = newClashKeys(clashKeys(await computeCrewClashes(svc, {…job slot, driverIds: offer.driverIds, supportIds: offer.supportIds})), offer.acceptedClashKeys)`.
  4. **If `fresh` is not empty:**
     - Conditional write: `arrange_state: 'clash'`, `lastReturn: { kind:'clash', text: <names of people with fresh clashes, joined ', '> }`.
     - Alert schedulers with `tplArrangeReturned` kind `clash`.
     - Return `{ outcome:'clash', clashNames }`.
  5. **Otherwise:**
     - Conditional write: `{ status: 'scheduled', ...arrangeClearPatch() }`. The 0038 trigger stamps `scheduled_at`.
     - **If `offerHasCrew(offer)`:**
       - Delete ALL `job_assignees` for the job, then insert drivers (`is_sub_installer:false`) and support (`true`), all `is_suggestion:false`.
       - Delete `job_external_contacts` rows whose `contact_id` is not in `offer.contactIds`, and update the rest to `is_suggestion:false`.
       - Check every row count.
     - **If any crew write fails:**
       - Undo, following `stage/route.ts` lines 120–127: write back `status:'awaiting_date', arrange_state:'offered', arrangement: <old>, scheduled_at: <old>`.
       - Return `500 crew_not_saved`.
     - **Alerts after it lands:**
       - `tplJobAssigned` to each driver and `tplSubInstallerAssigned` to each support person (`mainInstallers` = driver names), using `getJobNotifData`. Contractors are not messaged; their page shows the job.
       - Schedulers: `'arranged'` → `tplArrangeClientOk` + bell, with `awayNames` taken from the same `computeCrewClashes` result's `awayClashes`; `'assign_crew'` → `tplNewJobCreated` (exactly as `/submit` builds it) + bell.
     - Return `{ outcome:'scheduled' }`.

- [ ] **Step 1: Write `actions.ts` and the route.**
- [ ] **Step 2:** `npm run type-check` and run all suites. Expected: clean and silent.
- [ ] **Step 3: Read the code against Review Focus 1–2.** Every write must carry the expected-state condition and `.select('id')`. `client_ok` must check `offerMatchesJob` before anything else.
- [ ] **Step 4: Commit.**

---

### Task 7: Existing paths clear or respect the arrangement

**Files:**
- Modify:
  - `src/app/api/jobs/[id]/submit/route.ts` (patch at line 70)
  - `src/app/api/jobs/[id]/stage/route.ts` (patch at line 73)
  - `src/lib/utils/job-stage-rules.ts` + test (`externalLinkMode`)
  - `src/app/api/jobs/[id]/external-contacts/route.ts` (POST manager branch)
  - `src/features/schedule/MyJobsPanel.tsx:167`
- Check: `src/app/api/jobs/[id]/duplicate/route.ts`

**Interfaces:**
- Produces: `export function externalLinkMode(role: string, status: string): 'link' | 'suggest' | 'forbidden'` in `job-stage-rules.ts`.

**Changes:**
- **`/submit`**: `patch` gains `...arrangeClearPatch()`. Any push out of Ongoing ends the round trip, including the scheduler finishing a `clash` job.
- **Stage route**: `patch` gains `...arrangeClearPatch()` for every move. Its rollback (line 124) also writes back the old `arrange_state` / `arrangement`, so add both to its `select`.
- **`externalLinkMode`:**
  - scheduler / coordinator / admin on a job where `formalCrewAllowed(status)` → `'link'`
  - the same roles on an Ongoing job → `'suggest'`. Previously this was a 409. Now it writes `is_suggestion: true, suggested_by`, invisible to the contractor, so the scheduler can put contractors into an offer.
  - sales → `'suggest'`
  - everyone else → `'forbidden'`
  - The route's POST uses it in place of its two role branches.
- **`MyJobsPanel`**: an Ongoing job with `arrange_state` jumps to `jobListHref('arrange', id)`. This needs Task 8's `StageView`; do this line in Task 8 if executing in order.
- **Duplicate route**: confirm it copies an explicit field list that excludes `arrange_state` / `arrangement`. If it copies `*`, strip both.

- [ ] **Step 1: Failing tests** for `externalLinkMode`:
  - `check('scheduler on Ongoing suggests', externalLinkMode('scheduler','awaiting_date'), 'suggest')`
  - `check('scheduler on Scheduled links', externalLinkMode('scheduler','scheduled'), 'link')`
  - `check('designer forbidden', externalLinkMode('designer','scheduled'), 'forbidden')`
- [ ] **Step 2:** run. Expected: FAIL.
- [ ] **Step 3: Implement all bullets.**
- [ ] **Step 4:** run all suites + `type-check`. Expected: clean.
- [ ] **Step 5: Commit.**

---

### Task 8: Jobs tab — Drafts · Ongoing · To arrange

**Files:**
- Modify:
  - `src/features/stages/stage-view.ts` + `stage-view.test.ts`
  - `src/lib/supabase/queries/jobs.ts` (`StageJob`, `getStageJobs`)
  - `src/app/job-list/page.tsx`
  - `src/features/stages/StageListShell.tsx`
  - `src/lib/i18n/en.ts`, `zh.ts`
- Create: `src/features/stages/ArrangeList.tsx`

**Interfaces:**
- Produces:

```ts
export type StageView = 'drafts' | 'ongoing' | 'arrange'
export function defaultStageView(role: string): StageView            // 'scheduler' → 'arrange', else 'ongoing'
export function resolveStageView(param: string | null | undefined, canSeeDrafts: boolean, fallback: StageView): StageView
export function jobListHref(view: StageView, highlightId?: string): string   // ALWAYS carries ?view=
// StageJob gains:
arrange_state: ArrangeState | null; arrangement: Arrangement | null; salesName: string | null
```

**Decisions:**
- **Switch order** is `Drafts · Ongoing · To arrange` (Nic). Roles without drafts get `Ongoing · To arrange`.
- **`/job-list` with no `?view=` opens the role default.** That is why `jobListHref('ongoing')` now carries `?view=ongoing`. The old test "Ongoing is the plain address" is replaced by:
  - `check('Ongoing carries its view', jobListHref('ongoing'), '/job-list?view=ongoing')`
  - `check('no choice → the role default', resolveStageView(null, true, 'arrange'), 'arrange')`
- **Lists:** `ongoing` = awaiting_date jobs with no `arrange_state`; `arrange` = those with one. One query, split in the page.
- **`getStageJobs`** selects `arrange_state, arrangement` (parsed with `parseArrangeState` / `parseArrangement`). `salesName` comes from one follow-up `users` query on `sales_poc_id`s, the way designer names already do. Never embed users on jobs.
- **Search** covers the new list (same filter as now).
- **`ArrangeList`** renders `groupArrangeJobs` as two groups. Headings: `arrangeGroupNeedsDate` "Needs a date" and `arrangeGroupWithSales` "Waiting on sales". Each card is a `Link` to `/jobs/[id]`, styled like the current rows, and shows:
  - title
  - `Sales: <salesName>` · `ready <n> days` (`daysWaiting`; "ready today" at 0)
  - The guide label (`guideLabel`) in a grey chip.
  - The offered slot (`slotLabel`) + `crewNames` when `offer` exists and state is `offered`.
  - A state chip:

    | State | Chip | Style |
    |---|---|---|
    | `needs_date` | "Needs a date" | sand: `bg-brand-amber-soft` if it exists, else an rgba literal |
    | `needs_date` after a client no | "Client said no" + the reason | `bg-bad-soft text-bad` |
    | `clash` | "Client agreed — crew clashes" | `bg-bad-soft text-bad` |
    | `offered` | "Waiting on client" | slate |
    | `no_fit` | "Couldn't fit" + the note | sand |

  - "Waiting on sales" cards are visibly quieter (`opacity-70`).
  - A trailing action word when the viewer can act on that card: scheduler side on a scheduler-turn card → "Offer a date →"; sales side (`isArrangeSalesSide` from the row's ids) on `offered` / `no_fit` → "Answer →".
  - The page passes `userId` and `isAdmin` (`profile.role === 'admin'`) to the shell, so it can build a `StageViewer` per row. `role` alone cannot tell an admin from a scheduler.
- **Every new label** goes in `en.ts` + `zh.ts`.

- [ ] **Step 1: Update `stage-view.test.ts`** with the new checks; add `check('?view=arrange', resolveStageView('arrange', false, 'ongoing'), 'arrange')`. Run it. Expected: FAIL.
- [ ] **Step 2: Implement `stage-view.ts`**, then run. Expected: PASS.
- [ ] **Step 3: Query + page + shell + `ArrangeList` + the `MyJobsPanel` line from Task 7.**
- [ ] **Step 4:** run all suites, `type-check`, `build`. Expected: clean.
- [ ] **Step 5: Commit.**

---

### Task 9: Job page — the To arrange card and the scheduler's offer

**Files:**
- Create:
  - `src/features/arrange/ArrangeCard.tsx`
  - `src/features/arrange/ArrangeReadyDialog.tsx`
  - `src/features/arrange/ArrangeReasonDialog.tsx`
- Modify:
  - `src/lib/supabase/queries/jobs.ts` (`JobDetail` + `getJobById` select: `arrange_state, arrangement`)
  - `src/features/job-detail/CoreSection.tsx` (two optional props)
  - `src/features/job-detail/JobDetailShell.tsx` (wiring only)
  - `en.ts`, `zh.ts`

**Interfaces:**
- Consumes: Tasks 2–3 rules and labels; `POST /api/jobs/[id]/arrange` (Task 6).
- Produces:

```ts
// CoreSection — new optional props; when true the inputs are disabled with a muted hint
dateLocked?: boolean   // date + date_end
timeLocked?: boolean   // both TimeSelects

// ArrangeCard
export function ArrangeCard(props: {
  jobId: string; lang: LangCode
  state: ArrangeState | null; arrangement: Arrangement | null
  salesSide: boolean; schedulerSide: boolean
  canStart: boolean               // stage === 'ongoing' && salesSide && state === null
  beforeAction: () => Promise<boolean>   // the shell's beforeStageMove('ongoing'): unsaved edits block
  onOffer: () => void             // the shell's handleOffer
  busy: boolean
  onChanged: () => void           // router.refresh()
}): JSX.Element | null
```

**What the card shows** (top of the Details tab, above the Job details card; renders nothing when `state === null && !canStart`):

| State | Everyone sees | Sales side buttons | Scheduler side buttons |
|---|---|---|---|
| `null` | — | slim card "Ready to install?" + **Ready to install** → `ArrangeReadyDialog` | — |
| `needs_date` | guide (`guideLabel`), note, `lastReturn` banner (client said no: reason / offer withdrawn) | **Edit** (dialog prefilled), **Not ready — back to Ongoing** | hint "Set the date, time and crew on this page, then offer it to sales." + **Offer to sales** (`onOffer`) + **Can't fit — send back** (reason dialog, required) |
| `offered` | offer: `slotLabel`, `crewNames`, "offered by X" | **Client OK — put on schedule**, **Client said no** (reason, required), **Edit**, **Back to Ongoing** | **Withdraw offer** (reason dialog, optional) |
| `no_fit` | scheduler's note (sand banner) | **Edit** (re-send), **Back to Ongoing** | — |
| `clash` | "Client agreed {slot}. Crew now clashes: {text}." | **Back to Ongoing** | "Change the crew, then Push to Schedule. Confirm any outside contractors after it is on the schedule." |

- **Read-only viewers** (designer, production, hr) see the summary row only.
- **Every button except "Offer to sales":**
  1. Calls `beforeAction()`. "Offer to sales" calls `onOffer` instead, which saves the form itself.
  2. POSTs to the route.
  3. Maps errors to toasts:
     - `state_changed` / `offer_changed` → "This job just changed — reload to see the latest."
     - `missing_fields` → the existing `requiredFieldsMissingOngoing` / `requiredFieldsMissing`
     - `bad_offer:<code>` → one key per code
  4. Calls `onChanged()` on success.
- **Client OK with `outcome:'clash'`** shows a toast: "Sent back to the scheduler — {names} now clash."

**`ArrangeReadyDialog`** (`Modal` with `scrollBody`, z per Global Constraints):
- **Day:** radio (Any day / Between [date][date] / Fixed [date]), native `type="date"` inputs.
- **Time:** start `TimeSelect` + optional end `TimeSelect`.
- **Note:** a textarea.
- **Prefill:** from the current `arrangement` when editing; otherwise from the job's saved date/time (a job with a date prefills Fixed).
- **Validation:** `validateGuide` before sending, with one i18n key per error code.
- **Button:** "Send to scheduler".

**JobDetailShell wiring (the only logic added there):**
- **Parse once:**
  - `const arrangeState = parseArrangeState(job.arrange_state)`
  - `const arrangement = parseArrangement(job.arrangement)`
  - `salesSide = isArrangeSalesSide(stageViewer, stageRulesJob)`
  - `schedulerSide = isArrangeSchedulerSide(stageViewer)`
- **Seed:** `const seed = seedCrewFromOffer(arrangeState, arrangement, canAssign)`. Use `seed?.driverIds ?? initialAssigneeIds` and `seed?.supportIds ?? initialSubAssignedIds` as the `useState` initial values only.
  - Leave the `initial*` baselines alone, so the seeded picks count as dirty and Push to Schedule (in `clash`) writes them through the existing `pushCrewPlan` path.
  - `canAssign` must be declared before the crew `useState`s. Move the `status` / `stage` / `canAssign` lines above them, or compute the seed from `job.status` directly.
- **Locks:** `const locks = arrangeFieldLocks(arrangeState, arrangement, { sales: salesSide, scheduler: schedulerSide })`, passed as `dateLocked={locks.date} timeLocked={locks.time}` to `CoreSection`.
- **Push buttons:** every Push to Schedule button (lines ~1993, ~2030, ~2041) gains `&& !blocksPush(arrangeState)`.
- **`handleOffer`**, modelled on `handlePushToSchedule`:
  1. Run `checkForStage('scheduled', getValues())`, then `validateOffer(arrangement, <form values>, todaySG)`, and toast on error.
  2. `keepManualDue = await resolveDueConflict(date)`.
  3. If `selectedInstallerIds.length > 0`, run `showCrewClashes(getValues())`. If it shows, set `pendingOfferRef.current = { keepManualDue }` and return.
  4. Otherwise `runOffer(keepManualDue)`.
- **`runOffer`:**
  1. Save as `runPush` does: `saveDesignBriefFields` when the date or brief changed, `saveValues` if dirty.
  2. POST `{ action:'offer', driverIds: selectedInstallerIds, supportIds: selectedSubIds }`.
  3. Toast, then `router.refresh()`.
- **`resumeSaveAfterClash`:** checks `pendingOfferRef` before `pendingPushRef` and resumes `runOffer`.
- **`todaySG`** = `new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' })`, read inside the handler, never during render (#418 does not apply to `/jobs`, but keep render pure).

- [ ] **Step 1: Build `CoreSection`'s two props**, then `type-check`.
- [ ] **Step 2: Build the three components and their i18n keys** (en + zh).
- [ ] **Step 3: Wire `JobDetailShell` + `getJobById`.**
- [ ] **Step 4:** all suites, `type-check`, `build`. Expected: clean. `wc -l JobDetailShell.tsx`: report the growth (target ≤ ~90 lines).
- [ ] **Step 5: Commit.**

---

### Task 10: Apply, walk it through, hand to Nic

**Files:** none new, except a session note at session end (CLAUDE.md).

- [ ] **Step 1: Ask Nic for the OK** to apply `<N>` to the shared DB ("additive, two columns + two checks, nothing reads them until this code ships"). Re-run `npx supabase migration list` first: if `<N>` is taken now, renumber the file before pushing. Then `npx supabase db push`. Expected: `<N>` shows remote.
- [ ] **Step 2: Local walkthrough on `npm run dev`** against the real DB, with a job titled **TEST arrange**, as admin (both sides):
  1. Ready (Between dates + fixed 10 PM).
  2. Offer with a driver.
  3. Client said no.
  4. Offer again.
  5. Client OK. Expected: the job is on the schedule with the driver confirmed and the Telegrams sent.

  Then a second TEST job:
  - Offer **without** crew → Client OK → on the schedule with no crew, plus the "New Job — Assign Installer" message.
  - Withdraw, then pull back.
  - Two tabs pressing Client OK and Withdraw together: one wins, the other toasts "this job just changed".

  Delete both TEST jobs (they go to the Bin). Restore one and confirm To arrange shows it as it was, then delete it again.
- [ ] **Step 3: Ask Nic before pushing `feat-to-arrange`.** Give him the branch preview URL (`greenqubes-ops-git-feat-to-arrange-greenqubes-projects.vercel.app`) and a short test list:
  - Sales: Ready to install.
  - Scheduler: Offer.
  - Sales: Client said no / Client OK.
  - Scheduler: "can't fit".
- [ ] **Step 4:** After his check: merge to `dev` → preview → his "push to main" → production. Verify each with `/api/version` against the commit. Write the changelog entry at session end per CLAUDE.md (time from the production `x-vercel-id`).
