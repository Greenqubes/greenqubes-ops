# Installer Team box, installer All Jobs, side-panel lines — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Installers see who is on their jobs (Driver / Support Crew / External), can look at the company's confirmed jobs for any day, and the side panel shows each job's address and description on one slim line each.

**Architecture:** Pure rules live in small standalone-tested files under `src/lib/utils/`. Installers' privacy rules (RLS) stay unchanged: crew names and the All Jobs list are read on the server with the service-key client, limited to an allow-list of fields, and only plain names reach the browser. No migration.

**Tech Stack:** Next.js (app router, server components), Supabase (`@supabase/supabase-js`), Tailwind, lucide-react icons. Tests are standalone scripts run with `npx tsx <file>.test.ts` (see `src/lib/utils/job-card.test.ts` for the `check()` pattern; exit 1 on failure).

**Spec:** `docs/superpowers/specs/2026-11-10-installer-team-and-panel-lines-design.md` — read it before starting; this plan argues from it.

## Global Constraints

- **Workspace:** another Claude session works in this folder on `dev`. Do all work in a worktree on a new branch `feat-installer-team` cut from `dev` (superpowers:using-git-worktrees). Never push without Nic's go-ahead; production only on his words "push to main".
- **No migration, no new RLS policy.** Installer privacy rules 0037 (crew rows: own row only) and 0039/0040 (no access to outside contractors) stay exactly as they are.
- Service-key reads (`createServiceClient()` from `src/lib/supabase/service.ts`) run **server-side only**, select **named columns only (never `*`)**, and drop suggestion rows (`is_suggestion = true`) before anything leaves the server. Never select `external_contacts.token` or `.phone`.
- Names are **whole names**, never first names.
- Labels, verbatim: `All Jobs`, `Driver`, `Support Crew`, `External`, `No driver yet`, `You're on this`.
- New i18n keys: English in `en.ts`, Chinese in `zh.ts`, **English text in `bn.ts`** (no new Bengali translations). Day and month names are **always English** in every language.
- Icons: lucide stroke icons only, never emoji.
- Any overlay sits at `z-[60]` or above (none expected).
- "No driver yet" = no driver **and** no External — identical to the driver board's `UNASSIGNED` (`primaryBand` in `src/lib/utils/driver-board.ts`).
- Side panel titles keep "up to 2 lines, then …" (Nic, 2026-10-26).

## Review Focus

1. **A tampered `?day=`** (`2026-13-45`, `abc`, `2026-11-10,status.eq.pending`) must fall back to today and never reach a query filter string — owned by Task 4 (`parseDay` tests).
2. **Support-crew-only job** shows "No driver yet"; **contractor-only job** does not — owned by Task 2 (agreement test against `primaryBand`).
3. **A suggested installer or suggested contractor** on any job never appears in a Team box or on All Jobs — owned by Task 2 (`crewOf` test) and Task 4 (`toAllJobsCard` test).
4. **A crew row whose user was deleted** (`users: null`) or a contractor row with `external_contacts: null` is skipped without crashing — owned by Task 2.
5. **A description that is multi-line or only spaces** shows as one clean line in the side panel, or not at all — owned by Task 1 (`oneLine` tests).

---

### Task 1: Side panel — address and description lines (spec Part 3)

**Files:**
- Create: `src/lib/utils/panel-row.ts`, `src/lib/utils/panel-row.test.ts`
- Modify: `src/lib/supabase/queries/jobs.ts` (`StageJob` type ~line 518; `getStageJobs` select ~line 555)
- Modify: `src/features/schedule/MyJobsPanel.tsx` (row markup ~lines 194–199)

**Interfaces:**
- Produces: `oneLine(text: string | null | undefined): string | null` and `panelRowHead(dateLabel: string, job: { project_title: string | null; client: string }): string`; `StageJob.description: string | null`.

- [ ] **Step 1: Write the failing test** `src/lib/utils/panel-row.test.ts` (standalone `check()` pattern):
  - `oneLine('Install 2 bays\n\nbring ladder')` → `'Install 2 bays bring ladder'`
  - `oneLine('   ')` → `null`; `oneLine(null)` → `null`; `oneLine('  a  b ')` → `'a b'`
  - `panelRowHead('Mon 9 Nov', { project_title: 'Fossil Westgate Bay Swap', client: 'Fossil' })` → `'Mon 9 Nov · Fossil'`
  - `panelRowHead('Mon 9 Nov', { project_title: null, client: 'Fossil' })` → `'Mon 9 Nov'` (title already falls back to the client — don't print it twice)
  - `panelRowHead('Mon 9 Nov', { project_title: 'X', client: '' })` → `'Mon 9 Nov'`
- [ ] **Step 2:** Run `npx tsx src/lib/utils/panel-row.test.ts` — expect failure (module missing).
- [ ] **Step 3:** Implement both functions in `src/lib/utils/panel-row.ts` (collapse all whitespace runs to one space, trim).
- [ ] **Step 4:** Run the test — expect all ✓.
- [ ] **Step 5:** Add `description: string | null` to `StageJob` and `description` to the `getStageJobs` select string. Run `npm run type-check`; fix any `StageJob` fixtures it flags by adding `description: null`.
- [ ] **Step 6:** Change the row in `MyJobsPanel.tsx` to, top to bottom:
  1. `panelRowHead(label(j.date, …), j)` — `text-[11px] text-ink2`, `truncate`.
  2. Title — unchanged (`line-clamp-2 text-sm font-medium text-ink`).
  3. Address, only when `oneLine(j.location)` — `MapPin` size 11, `text-xs text-ink2`, one line `truncate`, `title={j.location}`.
  4. Description, only when `oneLine(j.description)` — `AlignLeft` (lucide) size 11, `text-xs text-muted`, one line `truncate`, `title={j.description}`.
  The old separate client line goes away (it moved into line 1). Search is unchanged.
- [ ] **Step 7:** `npm run type-check` passes; run the app (`npm run dev`), open Schedule as a scheduler and as sales, check the panel against mockup section 3 option A.
- [ ] **Step 8: Commit** — `feat(my-jobs-panel): address + description lines, client beside the date (Nic)`

---

### Task 2: Crew rules (pure)

**Files:**
- Create: `src/lib/utils/installer-crew.ts`, `src/lib/utils/installer-crew.test.ts`

**Interfaces:**
- Consumes: `splitCrew`-style row shape (`CardAssignee` in `src/lib/utils/job-card.ts`); for the agreement test, `primaryBand`, `UNASSIGNED`, `BoardJob` from `driver-board.ts`.
- Produces:
  ```ts
  export type CrewSource = {
    job_assignees: Array<{ is_suggestion?: boolean; is_sub_installer?: boolean; users?: { id: string; name: string } | null }>
    job_external_contacts: Array<{ is_suggestion?: boolean; external_contacts?: { name: string } | null }>
  }
  export type CrewPerson = { name: string; you: boolean }
  export type Crew = { drivers: CrewPerson[]; support: CrewPerson[]; externals: CrewPerson[] }
  export const EMPTY_CREW: Crew
  export function crewOf(src: CrewSource, viewerId: string | null): Crew
  export function noDriverYet(crew: Crew): boolean
  ```

- [ ] **Step 1: Write the failing test** `installer-crew.test.ts`:
  - drivers vs support split by `is_sub_installer`; whole names kept (`'Xiao Yi'` stays `'Xiao Yi'`).
  - a row with `is_suggestion: true` (assignee **and** external) is absent from the result.
  - rows with `users: null` / `external_contacts: null` are skipped, no throw.
  - `you` is `true` only for the row whose `users.id === viewerId`; `viewerId: null` → all `false`; externals are always `you: false`.
  - `noDriverYet`: no drivers + no externals → `true`; support only → `true`; external only → `false`; one driver → `false`.
  - **Agreement with the driver board:** for each fixture above, build the matching `BoardJob` (give externals an `id`) and assert `noDriverYet(crewOf(src, null)) === (primaryBand(boardJob) === UNASSIGNED)`.
- [ ] **Step 2:** Run `npx tsx src/lib/utils/installer-crew.test.ts` — expect failure.
- [ ] **Step 3:** Implement in `installer-crew.ts`.
- [ ] **Step 4:** Run the test — all ✓.
- [ ] **Step 5: Commit** — `feat(installer): crew rules for the Team box (pure)`

---

### Task 3: Team box on the installer's own cards (spec Part 1)

**Files:**
- Create: `src/lib/supabase/queries/crew-names.ts`
- Create: `src/features/installer/TeamBox.tsx`
- Modify: `src/lib/supabase/queries/installer.ts` (`InstallerJob` type + `getInstallerJobs`)
- Modify: `src/features/installer/InstallerJobCard.tsx`, `src/features/installer/NowCard.tsx`
- Modify: `src/lib/i18n/en.ts`, `zh.ts`, `bn.ts`

**Interfaces:**
- Consumes: `crewOf`, `noDriverYet`, `Crew`, `EMPTY_CREW` (Task 2).
- Produces:
  - `getCrewForJobs(jobIds: string[], viewerId: string | null): Promise<Map<string, Crew>>` — server-only, service key.
  - `InstallerJob.crew: Crew`
  - `<TeamBox crew={Crew} lang={LangCode} size?: 'big' | 'compact' />` (default `'big'`)
  - i18n keys: `teamSupportCrew`, `teamExternal`, `noDriverYet` (Driver reuses the existing `metaDriver`).

- [ ] **Step 1:** Implement `getCrewForJobs` in `crew-names.ts`: return an empty map for no ids; otherwise two service-key queries filtered `.in('job_id', jobIds)`:
  - `job_assignees` select `'job_id, is_suggestion, is_sub_installer, users ( id, name )'`
  - `job_external_contacts` select `'job_id, is_suggestion, external_contacts ( name )'`
  Group by `job_id` and run each group through `crewOf(…, viewerId)`; ids with no rows get `EMPTY_CREW`. Throw on query error (same as the other query files).
- [ ] **Step 2:** In `getInstallerJobs`, after the existing signed-in query (which still decides **which** jobs), call `getCrewForJobs(rows.map(r => r.id), null)` and add `crew` to each returned job. Leave `job_assignees` on the type (the week/month views still read it).
- [ ] **Step 3:** Add i18n keys — en: `teamSupportCrew: 'Support Crew'`, `teamExternal: 'External'`, `noDriverYet: 'No driver yet'`; zh: `'协助人员'`, `'外包'`, `'暂无司机'`; bn: the English text.
- [ ] **Step 4:** Build `TeamBox.tsx` (mockup section 1, option B): inset box `bg-bg border border-line rounded-[10px] px-2.5 py-2`, up to three rows, each a fixed-width label then wrapping pills:
  - Driver row: when `noDriverYet(crew)` show muted italic `t('noDriverYet')`; else if `drivers.length` show green pills (driver colour, as the mockup's `np drv`); else leave the row out.
  - Support Crew row only if `support.length`; neutral pills.
  - External row only if `externals.length`; dashed-outline pills.
  - Any person with `you: true` gets a black pill (`bg-ink text-paper`) whatever their row.
  - `size='big'`: pills `text-[13px] px-2.5 py-0.5`; `'compact'`: `text-[11px] px-2 py-[1px]` (the office card's `NamePill` size).
- [ ] **Step 5:** `InstallerJobCard`: top row = date label + time (left), status `Pill` (right); then title, client line (as today), description (as today), full address with `MapPin` **wrapping** (remove `truncate`), then `<TeamBox crew={job.crew} lang={lang} />`; footer unchanged.
- [ ] **Step 6:** `NowCard`: replace the `Users` crew line (and the `assignees` variable) with `<TeamBox crew={job.crew} lang={lang} />`.
- [ ] **Step 7:** `npm run type-check` passes; re-run `npx tsx src/lib/utils/installer-crew.test.ts` and `npx tsx src/lib/utils/job-card.test.ts`.
- [ ] **Step 8: Commit** — `feat(installer): Team box with Driver / Support Crew / External on the installer's cards (Nic)`

---

### Task 4: All Jobs rules (pure)

**Files:**
- Create: `src/lib/utils/all-jobs.ts`, `src/lib/utils/all-jobs.test.ts`

**Interfaces:**
- Consumes: `Crew`, `noDriverYet` (Task 2).
- Produces:
  ```ts
  export type AllJobsRow = { id: string; date: string; date_end: string | null; time_start: string | null; time_end: string | null
                             project_title: string | null; client: string; location: string; punctuality: Punctuality }
  export type AllJobsCard = { id: string; date: string; date_end: string | null; time_start: string | null; time_end: string | null
                              title: string; location: string; punctuality: Punctuality; crew: Crew; mine: boolean; noDriver: boolean }
  export const ALL_JOBS_CARD_KEYS: readonly (keyof AllJobsCard)[]
  export function parseDay(param: string | string[] | undefined, today: string): string
  export function jobCoversDay(job: { date: string; date_end: string | null }, day: string): boolean
  export function weekOf(day: string): string[]          // Monday..Sunday, 7 ISO dates
  export function shiftDay(day: string, days: number): string
  export function toAllJobsCard(row: AllJobsRow, crew: Crew): AllJobsCard
  export function sortAllJobs(cards: AllJobsCard[]): AllJobsCard[]
  ```

- [ ] **Step 1: Write the failing test** `all-jobs.test.ts`:
  - `parseDay('2026-11-10', T)` → `'2026-11-10'`; `parseDay(undefined, T)`, `parseDay('2026-13-45', T)`, `parseDay('abc', T)`, `parseDay('2026-11-10,status.eq.pending', T)`, `parseDay(['2026-11-10','x'], T)` → `T`. (Valid = exactly `YYYY-MM-DD` **and** a real calendar date.)
  - `jobCoversDay`: single-day on the day → true; single-day other day → false; multi-day `2026-11-09..2026-11-11` on `2026-11-10` → true, on `2026-11-12` → false; `date_end: null` treated as `date`.
  - `weekOf('2026-11-10')` (a Tuesday) → `['2026-11-09', …, '2026-11-15']`; `weekOf('2026-11-15')` (Sunday) → same week; month/year rollover `weekOf('2026-12-31')` → `['2026-12-28', …, '2027-01-03']`. `shiftDay('2026-11-10', 7)` → `'2026-11-17'`.
  - `toAllJobsCard`: `title` = `project_title` or falls back to `client`; `mine` true when any crew person has `you: true`; `noDriver` = `noDriverYet(crew)`; **`Object.keys(card).sort()` equals `[...ALL_JOBS_CARD_KEYS].sort()` even when the input row carries extra fields** (`description`, `client_poc_phone`, `client` — cast in the test).
  - `sortAllJobs`: by `time_start` ascending, jobs with no `time_start` last (matches My Jobs).
- [ ] **Step 2:** Run `npx tsx src/lib/utils/all-jobs.test.ts` — expect failure.
- [ ] **Step 3:** Implement. Date maths on UTC (`Date.UTC` from the parts) so the server's timezone can't shift a day. `toAllJobsCard` builds the object field by field — never spreads the row.
- [ ] **Step 4:** Run the test — all ✓.
- [ ] **Step 5: Commit** — `feat(installer): All Jobs rules (pure)`

---

### Task 5: All Jobs page and the third switch segment (spec Part 2)

**Files:**
- Create: `src/lib/supabase/queries/all-jobs.ts`
- Create: `src/app/installer/all/page.tsx`
- Create: `src/features/installer/AllJobsShell.tsx` (client)
- Modify: `src/lib/utils/completed-switch.ts`, `src/lib/utils/completed-switch.test.ts`, `src/components/CompletedSwitch.tsx`, `src/features/installer/InstallerShell.tsx` (only if the switch's props change)
- Modify: `src/lib/i18n/en.ts`, `zh.ts`, `bn.ts`

**Interfaces:**
- Consumes: `getCrewForJobs` (Task 3), `TeamBox` (Task 3), everything in Task 4, `todaySGT()` from `src/lib/utils/design-urgency.ts`.
- Produces:
  - `getAllJobsForDay(day: string, viewerId: string): Promise<AllJobsCard[]>` — server-only, service key.
  - `switchSegments(role: Role): Array<{ key: 'live' | 'all' | 'completed'; href: string; labelKey: keyof Translations }>`
  - `CompletedSwitch` prop `current: 'live' | 'all' | 'completed'`.
  - i18n keys: `allJobs`, `youreOnThis`, `allJobsOne`, `allJobsMany`, `allJobsNone`.

- [ ] **Step 1: Write the failing test** — extend `completed-switch.test.ts`:
  - `switchSegments('installer')` → keys `['live','all','completed']`, hrefs `['/installer','/installer/all','/completed']`.
  - `switchSegments('sales')` and `switchSegments('scheduler')` → keys `['live','completed']` only, hrefs `['/schedule','/completed']`.
  - `navTabActive('/installer', '/installer/all')` → `true` (My Jobs stays lit in the menu).
- [ ] **Step 2:** Run `npx tsx src/lib/utils/completed-switch.test.ts` — expect failure.
- [ ] **Step 3:** Implement `switchSegments` in `completed-switch.ts`; make `CompletedSwitch` render from it with `current` widened to include `'all'`. Existing callers (`InstallerShell` → `'live'`, `ScheduleShell` → `'live' | 'completed'`) keep working unchanged.
- [ ] **Step 4:** Run the test — all ✓.
- [ ] **Step 5:** Implement `getAllJobsForDay(day, viewerId)`. `day` must already be the output of `parseDay`. Service-key query on `jobs`:
  select `'id, date, date_end, time_start, time_end, project_title, client, location, punctuality'`, `.eq('status', 'scheduled')`, `.lte('date', day)`, `.or(\`date_end.gte.${day},date.eq.${day}\`)`. Then keep rows where `jobCoversDay` is true (belt and braces), get crew with `getCrewForJobs(ids, viewerId)`, map through `toAllJobsCard`, return `sortAllJobs(...)`.
- [ ] **Step 6:** Add i18n keys — en: `allJobs: 'All Jobs'`, `youreOnThis: "You're on this"`, `allJobsOne: '1 job'`, `allJobsMany: 'jobs'`, `allJobsNone: 'No confirmed jobs on this day.'`; zh: `'全部工作'`, `'你在这份工作上'`, `'1 份工作'`, `'份工作'`, `'这天没有已确认的工作。'`; bn: the English text.
- [ ] **Step 7:** `src/app/installer/all/page.tsx` (server component): copy the sign-in + profile + `getEffectiveRole` guard from `src/app/installer/page.tsx` (non-installers → `redirect('/schedule')`). Then `day = parseDay((await searchParams).day, todaySGT())` (Next 15: `searchParams` is a Promise — see `src/app/(auth)/login/page.tsx`), `cards = await getAllJobsForDay(day, profile.id)`, render `<AllJobsShell cards day today={todaySGT()} lang userName />`.
- [ ] **Step 8:** `AllJobsShell.tsx` (mockup section 2), top to bottom:
  - `CompanyBar` and `<CompletedSwitch role="installer" current="all" lang />`, as `InstallerShell` lays them out (desktop `BottomNav` the same way too).
  - Day strip: `weekOf(day)` as 7 links to `?day=…` (English short weekday + day number; chosen day dark, today marked), `‹` / `›` links to `shiftDay(day, ∓7)`, and a "Today" link when `today` isn't in the week.
  - Heading: English long date for `day` + count (`allJobsOne` / `n allJobsMany`).
  - Cards: time (or the existing `fcfsAllDay` "All day" when there is no `time_start`), punctuality colour bar as on the office card, title, address with `MapPin` (wrapping), `<TeamBox crew size="compact" />`. `mine` → card outlined `border-2 border-ink` with a `youreOnThis` tag, wrapped in `Link` to `/jobs/{id}?from=installer`. Not `mine` → plain `div`, no link, no hover state.
  - Empty list → `allJobsNone`.
  - `useLiveChannel({ name: 'installer-all-jobs-live', tables: [{ table: 'jobs' }, { table: 'job_assignees' }], onEvent: () => router.refresh(), poll: { ms: 2 * 60 * 1000, fn: () => router.refresh() } })` — others' changes arrive on the poll (spec: accepted).
- [ ] **Step 9:** In `InstallerShell` the switch now shows three segments automatically; check nothing else there needs changing.
- [ ] **Step 10:** `npm run type-check` passes; re-run all four new/changed test files.
- [ ] **Step 11: Commit** — `feat(installer): All Jobs — every confirmed job for a day, look-only (Nic)`

---

### Task 6: Whole-branch check and hand-over

**Files:** none new.

- [ ] **Step 1:** Run every standalone test: `for f in $(git ls-files 'src/**/*.test.ts'); do npx tsx "$f" > /dev/null || echo "FAIL $f"; done` — expect no `FAIL` lines.
- [ ] **Step 2:** `npm run type-check`, `npm run lint`, `npm run build` — all succeed.
- [ ] **Step 3:** Merge `feat-installer-team` into `dev` locally (fetch first; `dev` moves under parallel sessions). **Ask Nic before pushing.** After he says yes, push `dev` and give him the preview URL; confirm the deploy by matching the commit against `/api/version` (preview requests need the `x-vercel-protection-bypass` header from `VERCEL_AUTOMATION_BYPASS_SECRET` — never print it).
- [ ] **Step 4: Preview check with a REAL installer account** (admin "view as installer" can read every crew row and hides the bug this fixes). Confirm:
  - The installer's own card and the Now card show co-workers, with Driver / Support Crew / External rows.
  - A job with only support crew says "No driver yet"; a contractor-only job doesn't.
  - All Jobs lists other people's confirmed jobs for today and tomorrow; tapping someone else's job does nothing; their own is outlined and opens.
  - No pending / awaiting-approval / completed job appears; no description, phone or sales name on other people's jobs.
  - `?day=garbage` shows today.
  - Side panel (as scheduler and as sales): date · client, title, address line, description line; long lines end in "…".
- [ ] **Step 5:** Production only on Nic's words "push to main" (push the exact SHA he checked). Changelog entry at session end per CLAUDE.md, e.g. *added:* "Installers see who's on each job: driver, support crew and outside contractors." / "Installers have an All Jobs view of every confirmed job that day." *improved:* "The side panel now shows each job's address and description."
