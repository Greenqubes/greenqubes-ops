# Away (Courses & Business Trips) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** HR records staff who are away on work (one trip, several people, exact start/end times); everyone sees it on the schedule, FCFS board and installer page; scheduling a job over it raises an amber, never-blocking warning plus the same notifications leave sends.

**Architecture:** Two new tables (`away_trips`, `away_trip_people`) sit alongside leave — leave code is not modified except where a surface gains a parallel `away` list. One pure module (`src/lib/utils/away-overlap.ts`) owns every overlap decision and is reused by the routes, the FCFS board, the job-form grids, the notifier and the assistant. One shared component (`AwayStrip`) renders the amber strip and its details pop-up wherever `DayNotices` renders.

**Tech Stack:** Next.js 15 (app router), Supabase (Postgres + RLS + realtime), Tailwind 3.4 with `var()` theme tokens, standalone `npx tsx` tests (no framework), Telegram Bot API.

**Spec:** `docs/superpowers/specs/2026-10-09-away-trips-design.md`

## Global Constraints

- Scheduling over a trip is an **amber warning only** — it never blocks a save, push or assignment, and never counts toward a modal's "unresolved" total.
- One trip, several people. Exact start date + time → end date + time, stored as plain Singapore wall-clock `date` + `time` columns.
- **Touching edges do not overlap** (trip ends 14:00, job starts 14:00 → no warning). Approved by Nic 2026-10-09.
- **Edited trip:** only people/jobs *newly* affected are re-notified. Approved by Nic 2026-10-09.
- Only **formal** crew is checked (`job_assignees.is_suggestion = false`), Drivers AND Support crew.
- Visible to every role, installers included. Written only by HR + admin via `can_manage_leave()` / `guardHr()`.
- Migration: grant `select, insert, update, delete` to `authenticated` + `service_role` on both tables. **Never `anon`.** RLS enabled.
- Migration number is **claimed at build time** (Task 2, Step 1) — never guessed in advance.
- Dates/day names always English (static month/day tables, never `toLocaleDateString` on `/schedule`). New strings in `en.ts` + `zh.ts` only; nothing added to `bn.ts`.
- Overlays use `z-[60]`–`z-[99]` (above BottomNav z-50, below toasts z-[100]; `src/components/toast-layer.test.ts` enforces).
- Colours: theme tokens are bare `var()` — **no `/opacity` suffix on theme colours** (`bg-brand-amber/10` compiles to nothing). Use `bg-brand-amber-soft`, `border-brand-amber`, `text-brand-amber`, `ring-brand-amber`.
- Every write route checks it got a row back (`.select(...)` + null check) — an RLS-refused write is not an error in PostgREST.
- Notifications are best-effort and never throw into the save path.

## Review Focus

1. **A trip ending exactly at midnight** (`end_time 00:00` on the last day) must not mark that last day as covered — a reasonable person reads "Mon 9am → Wed 00:00" as away Mon–Tue. Test in Task 1.
2. **An all-day job (no start time) on a trip's first day that starts at 17:00** must warn — the person is away part of that day. Test in Task 1.
3. **Editing a trip without changing anyone/anything relevant** must not re-send a Telegram for jobs already warned about. Test (pure diff) in Task 1; wired in Task 4.
4. **Removing the last person from a trip** must be refused (a trip with nobody on it is meaningless and would render an empty strip). Validated in Task 3 route + form.
5. **A coordinator saving an edit when the ONLY issue is an away warning** must get "Save anyway / Go back", not "Alert scheduler" (an amber warning is not something to escalate). Handled in Task 7.

---

## File map

**Create**
- `src/lib/utils/away-overlap.ts` — pure overlap math, labels, pair diff
- `src/lib/utils/away-overlap.test.ts` — standalone test
- `supabase/migrations/<N>_away_trips.sql`
- `src/lib/supabase/queries/away.ts` — reads
- `src/app/api/away/route.ts` — GET list, POST create
- `src/app/api/away/[id]/route.ts` — PATCH, DELETE
- `src/lib/utils/away-notify.ts` — bell + Telegram
- `src/features/leave/AwayCard.tsx` — Leave-page card
- `src/features/leave/AwayFormModal.tsx` — create/edit form
- `src/features/schedule/AwayStrip.tsx` — amber strip + details pop-up

**Modify**
- `src/lib/supabase/types.ts` — two table types
- `src/lib/telegram/templates.ts` — `tplAwayClash`
- `src/lib/i18n/en.ts`, `src/lib/i18n/zh.ts` — strings
- `src/features/leave/LeaveShell.tsx`, `src/app/leave/page.tsx`
- `src/features/schedule/DayNotices.tsx`, `ScheduleShell.tsx`, `ListView.tsx`, `WeekView.tsx`, `DateStrip.tsx`, `MonthView.tsx`, `src/app/schedule/page.tsx`
- `src/features/installer/InstallerShell.tsx`, `src/app/installer/page.tsx`
- `src/app/api/jobs/[id]/clashes/route.ts`, `src/app/api/jobs/[id]/assign-installers/route.ts`
- `src/features/approvals/ClashResolutionModal.tsx`, `src/features/job-detail/EditClashModal.tsx`, `JobDetailShell.tsx`, `NewJobShell.tsx`, `src/features/fcfs/AssignmentPanel.tsx`, `src/features/schedule/CrewChangeModal.tsx`, `src/features/bin/BinShell.tsx`
- `src/lib/supabase/queries/fcfs.ts`, `src/app/api/fcfs/route.ts`, `src/app/fcfs/page.tsx`, `src/features/fcfs/FCFSShell.tsx`, `FCFSTimeline.tsx`, `ClashDrawer.tsx`
- `src/components/UserMetaLine.tsx` (AwayChip), `src/features/job-detail/InstallerGrid.tsx`, `SubInstallerBucket.tsx`, `src/app/jobs/[id]/page.tsx`, `src/app/jobs/new/page.tsx`
- `src/lib/supabase/queries/assistant-tools.ts`

**Running all suites** (repo convention, no framework):

```bash
for f in $(git ls-files 'src/*.test.ts' 'scripts/*.test.ts'); do npx tsx "$f" > /dev/null 2>&1 || echo "FAIL $f"; done; echo done
```

Expected: only `done` printed.

---

### Task 1: The overlap module (pure, test-first)

**Files:**
- Create: `src/lib/utils/away-overlap.ts`
- Test: `src/lib/utils/away-overlap.test.ts`

**Interfaces:**
- Produces (used by every later task):
  - `type AwayPerson = { id: string; name: string }`
  - `type AwayTrip = { id: string; title: string; business: string | null; location: string | null; start_date: string; start_time: string; end_date: string; end_time: string; note: string | null; people: AwayPerson[] }` (times may arrive `HH:MM` or `HH:MM:SS`)
  - `type AwaySpan = Pick<AwayTrip, 'start_date' | 'start_time' | 'end_date' | 'end_time'>`
  - `awayWindowOnDate(trip: AwaySpan, date: string): { start: string; end: string } | null`
  - `awayBlocksJob(trip: AwaySpan, jobDate: string, jobDateEnd: string | null, timeStart: string | null, timeEnd: string | null): boolean`
  - `awayDates(trip: AwaySpan): string[]` — every calendar date with a non-empty window
  - `type AwayConflict = { personId: string; personName: string; jobId: string; trip: AwayTrip }`
  - `awayConflictsForJobs(jobs: AwayCheckableJob[], trips: AwayTrip[]): AwayConflict[]` where `AwayCheckableJob = { id; date; date_end?: string | null; time_start; time_end; people: Array<{ id: string; name: string }> }`
  - `awayTripFor(personId: string, jobDate: string, jobDateEnd: string | null, timeStart: string | null, timeEnd: string | null, trips: AwayTrip[]): AwayTrip | null`
  - `awayWhenLabel(trip: AwaySpan): string` → `"Mon 13 Oct 2026, 2:00pm → Wed 15 Oct 2026, 12:00pm"`; same-day → `"Mon 13 Oct 2026, 2:00pm – 5:00pm"`
  - `pairKey(personId: string, jobId: string): string` and `newPairs(before: Set<string>, after: Set<string>): Set<string>`

- [ ] **Step 1: Write the failing test**

Create `src/lib/utils/away-overlap.test.ts`:

```ts
// Standalone test — run with: npx tsx src/lib/utils/away-overlap.test.ts
// Exits 1 on failure (repo convention — no test framework).
import {
  awayWindowOnDate, awayBlocksJob, awayDates, awayConflictsForJobs, awayTripFor,
  awayWhenLabel, pairKey, newPairs, type AwayTrip,
} from './away-overlap'

let failed = 0
function check(name: string, cond: boolean) {
  if (cond) { console.log(`  ✓ ${name}`) } else { failed++; console.error(`  ✗ ${name}`) }
}
function eq<T>(name: string, got: T, want: T) {
  check(`${name} (got ${JSON.stringify(got)})`, JSON.stringify(got) === JSON.stringify(want))
}

const mk = (p: Partial<AwayTrip>): AwayTrip => ({
  id: 't1', title: 'First Aid course', business: null, location: null, note: null,
  start_date: '2026-10-13', start_time: '14:00:00', end_date: '2026-10-15', end_time: '12:00:00',
  people: [{ id: 'u1', name: 'Halim' }], ...p,
})

console.log('awayWindowOnDate')
eq('before → null', awayWindowOnDate(mk({}), '2026-10-12'), null)
eq('after → null', awayWindowOnDate(mk({}), '2026-10-16'), null)
eq('first day from start', awayWindowOnDate(mk({}), '2026-10-13'), { start: '14:00', end: '24:00' })
eq('middle day whole', awayWindowOnDate(mk({}), '2026-10-14'), { start: '00:00', end: '24:00' })
eq('last day until end', awayWindowOnDate(mk({}), '2026-10-15'), { start: '00:00', end: '12:00' })
eq('one-day trip', awayWindowOnDate(mk({ end_date: '2026-10-13', end_time: '17:00' }), '2026-10-13'), { start: '14:00', end: '17:00' })
eq('ends at midnight → last day not covered', awayWindowOnDate(mk({ end_time: '00:00' }), '2026-10-15'), null)

console.log('awayBlocksJob')
check('job inside the window warns', awayBlocksJob(mk({}), '2026-10-14', null, '09:00', '11:00'))
check('job before the trip starts does not', !awayBlocksJob(mk({}), '2026-10-13', null, '09:00', '12:00'))
check('touching edge: trip ends 12:00, job starts 12:00 → no warning', !awayBlocksJob(mk({}), '2026-10-15', null, '12:00', '15:00'))
check('touching edge: job ends 14:00, trip starts 14:00 → no warning', !awayBlocksJob(mk({}), '2026-10-13', null, '10:00', '14:00'))
check('all-day job (no start) on first day warns', awayBlocksJob(mk({ start_time: '17:00' }), '2026-10-13', null, null, null))
check('open-ended job starting inside warns', awayBlocksJob(mk({}), '2026-10-13', null, '15:00', null))
check('open-ended job starting before does not', !awayBlocksJob(mk({}), '2026-10-13', null, '13:00', null))
check('multi-day job reaching into the trip warns', awayBlocksJob(mk({}), '2026-10-11', '2026-10-14', '09:00', '10:00'))
check('different day entirely does not', !awayBlocksJob(mk({}), '2026-10-20', null, null, null))

console.log('awayDates')
eq('covers three days', awayDates(mk({})), ['2026-10-13', '2026-10-14', '2026-10-15'])
eq('midnight end drops the last day', awayDates(mk({ end_time: '00:00' })), ['2026-10-13', '2026-10-14'])

console.log('awayConflictsForJobs / awayTripFor')
const trips = [mk({ people: [{ id: 'u1', name: 'Halim' }, { id: 'u2', name: 'Rintu' }] })]
const conflicts = awayConflictsForJobs([
  { id: 'j1', date: '2026-10-14', time_start: '09:00', time_end: '11:00', people: [{ id: 'u2', name: 'Rintu' }, { id: 'u3', name: 'CK' }] },
  { id: 'j2', date: '2026-10-20', time_start: '09:00', time_end: '11:00', people: [{ id: 'u1', name: 'Halim' }] },
], trips)
eq('only Rintu on j1', conflicts.map(c => `${c.personId}:${c.jobId}`), ['u2:j1'])
eq('awayTripFor hit', awayTripFor('u1', '2026-10-14', null, null, null, trips)?.id ?? null, 't1')
eq('awayTripFor miss', awayTripFor('u3', '2026-10-14', null, null, null, trips), null)

console.log('awayWhenLabel')
eq('multi-day', awayWhenLabel(mk({})), 'Tue 13 Oct 2026, 2:00pm → Thu 15 Oct 2026, 12:00pm')
eq('same day', awayWhenLabel(mk({ end_date: '2026-10-13', end_time: '17:30' })), 'Tue 13 Oct 2026, 2:00pm – 5:30pm')

console.log('newPairs — only newly affected are re-notified')
const before = new Set([pairKey('u1', 'j1')])
const after  = new Set([pairKey('u1', 'j1'), pairKey('u2', 'j1')])
eq('new pair only', [...newPairs(before, after)], [pairKey('u2', 'j1')])
eq('unchanged edit → nothing', [...newPairs(after, after)], [])

if (failed > 0) { console.error(`\n${failed} failed`); process.exit(1) }
console.log('\nall passed')
```

(13 Oct 2026 is a Tuesday — the label test pins that the weekday is computed, not assumed.)

- [ ] **Step 2: Run it to see it fail**

Run: `npx tsx src/lib/utils/away-overlap.test.ts`
Expected: FAIL — `Cannot find module './away-overlap'`.

- [ ] **Step 3: Write the module**

Create `src/lib/utils/away-overlap.ts`:

```ts
// Pure "is this person away on work during this job?" math — the single source
// of truth for the Away list (courses + business trips). Consumed by the clash
// routes, the FCFS board, the job-form grids, the notifier and the assistant.
//
// Deliberately separate from leave-overlap.ts: leave is whole-day / AM-PM and
// RED; a trip is exact-time and AMBER (a warning, never a block — Nic,
// 2026-10-09). Times compare lexicographically on 'HH:MM', the same semantics
// as clash-detection's timesOverlap. Touching edges do NOT overlap.
// Self-contained on purpose: tests run under npx tsx and import pure modules only.

export type AwayPerson = { id: string; name: string }

export type AwayTrip = {
  id:         string
  title:      string
  business:   string | null
  location:   string | null
  start_date: string   // YYYY-MM-DD, Singapore wall-clock
  start_time: string   // HH:MM or HH:MM:SS
  end_date:   string
  end_time:   string
  note:       string | null
  people:     AwayPerson[]
}

export type AwaySpan = Pick<AwayTrip, 'start_date' | 'start_time' | 'end_date' | 'end_time'>

const DAY_START     = '00:00'
const DAY_END       = '24:00'   // exclusive; every real 'HH:MM' sorts below it
const MAX_SPAN_DAYS = 62        // same guard as leave against runaway data

const hhmm = (t: string | null) => t?.slice(0, 5) ?? null

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + n))
  const p = (x: number) => String(x).padStart(2, '0')
  return `${dt.getUTCFullYear()}-${p(dt.getUTCMonth() + 1)}-${p(dt.getUTCDate())}`
}

/** The away window on one calendar date, or null when the trip does not cover it. */
export function awayWindowOnDate(trip: AwaySpan, date: string): { start: string; end: string } | null {
  if (date < trip.start_date || date > trip.end_date) return null
  const start = date === trip.start_date ? hhmm(trip.start_time)! : DAY_START
  const end   = date === trip.end_date   ? hhmm(trip.end_time)!   : DAY_END
  // An empty window (a trip ending at exactly 00:00) covers nothing that day.
  return start < end ? { start, end } : null
}

// Same rules as leave's overlapsWindow / timesOverlap, with strict
// inequalities so touching edges never warn.
function overlapsWindow(jobStart: string | null, jobEnd: string | null, win: { start: string; end: string }): boolean {
  const a = hhmm(jobStart)
  const b = hhmm(jobEnd)
  if (!a) return true                          // no start time = whole-day job
  if (b)  return a < win.end && win.start < b
  return a >= win.start && a < win.end         // open-ended: counts if it starts inside
}

export function awayBlocksJob(
  trip: AwaySpan, jobDate: string, jobDateEnd: string | null,
  timeStart: string | null, timeEnd: string | null,
): boolean {
  const end = jobDateEnd && jobDateEnd > jobDate ? jobDateEnd : jobDate
  let cur = jobDate
  for (let i = 0; i < MAX_SPAN_DAYS && cur <= end; i++) {
    const win = awayWindowOnDate(trip, cur)
    if (win && overlapsWindow(timeStart, timeEnd, win)) return true
    cur = addDays(cur, 1)
  }
  return false
}

/** Every date the trip actually covers — for the strip and the calendar dots. */
export function awayDates(trip: AwaySpan): string[] {
  const out: string[] = []
  let cur = trip.start_date
  for (let i = 0; i < MAX_SPAN_DAYS && cur <= trip.end_date; i++) {
    if (awayWindowOnDate(trip, cur)) out.push(cur)
    cur = addDays(cur, 1)
  }
  return out
}

export type AwayConflict = { personId: string; personName: string; jobId: string; trip: AwayTrip }

export type AwayCheckableJob = {
  id:         string
  date:       string
  date_end?:  string | null
  time_start: string | null
  time_end:   string | null
  people:     Array<{ id: string; name: string }>
}

/** First trip that puts this person away during the job, or null. */
export function awayTripFor(
  personId: string, jobDate: string, jobDateEnd: string | null,
  timeStart: string | null, timeEnd: string | null, trips: AwayTrip[],
): AwayTrip | null {
  for (const trip of trips) {
    if (!trip.people.some(p => p.id === personId)) continue
    if (awayBlocksJob(trip, jobDate, jobDateEnd, timeStart, timeEnd)) return trip
  }
  return null
}

/** One conflict per (person, job) — the first trip wins. */
export function awayConflictsForJobs(jobs: AwayCheckableJob[], trips: AwayTrip[]): AwayConflict[] {
  const out: AwayConflict[] = []
  for (const job of jobs) {
    for (const p of job.people) {
      const trip = awayTripFor(p.id, job.date, job.date_end ?? null, job.time_start, job.time_end, trips)
      if (trip) out.push({ personId: p.id, personName: p.name, jobId: job.id, trip })
    }
  }
  return out
}

// Static English tables — never toLocaleDateString (hydration #418 + the
// "dates are always English" hard rule).
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAYS   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function fmtDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return `${DAYS[dow]} ${d} ${MONTHS[m - 1]} ${y}`
}

function fmtClock(t: string): string {
  const [h, m] = hhmm(t)!.split(':').map(Number)
  const suffix = h >= 12 ? 'pm' : 'am'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')}${suffix}`
}

/** "Tue 13 Oct 2026, 2:00pm → Thu 15 Oct 2026, 12:00pm" (or "…, 2:00pm – 5:30pm" same day). */
export function awayWhenLabel(trip: AwaySpan): string {
  if (trip.start_date === trip.end_date) {
    return `${fmtDay(trip.start_date)}, ${fmtClock(trip.start_time)} – ${fmtClock(trip.end_time)}`
  }
  return `${fmtDay(trip.start_date)}, ${fmtClock(trip.start_time)} → ${fmtDay(trip.end_date)}, ${fmtClock(trip.end_time)}`
}

/** Identity of one "person X is away during job Y" warning. */
export function pairKey(personId: string, jobId: string): string {
  return `${personId}:${jobId}`
}

/** Warnings present after an edit that were not present before it. */
export function newPairs(before: Set<string>, after: Set<string>): Set<string> {
  return new Set([...after].filter(k => !before.has(k)))
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx tsx src/lib/utils/away-overlap.test.ts`
Expected: `all passed`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/away-overlap.ts src/lib/utils/away-overlap.test.ts
git commit -m "feat(away): pure overlap rules for courses and business trips"
```

---

### Task 2: Migration + table types

**Files:**
- Create: `supabase/migrations/<N>_away_trips.sql`
- Modify: `src/lib/supabase/types.ts` (after the `company_events` block, ~line 619)

**Interfaces:**
- Produces: tables `public.away_trips`, `public.away_trip_people` with the columns in the SQL below; `Database['public']['Tables']['away_trips' | 'away_trip_people']` types.

- [ ] **Step 1: Claim the migration number (CLAUDE.md hard rule)**

```bash
npx supabase migration list
git fetch origin
for b in $(git branch -a --format='%(refname:short)' | grep -v HEAD); do echo "== $b"; git ls-tree -r --name-only "$b" -- supabase/migrations/ | tail -2; done
```

Take the next number above the highest remote number AND the highest file on any branch (include `origin/feat-job-stages` — a parallel session works there). Write the number you took and what you checked in your report. Use it as `<N>` below (four digits, e.g. `0064`).

- [ ] **Step 2: Write the migration**

Create `supabase/migrations/<N>_away_trips.sql`:

```sql
-- Away — staff on courses and business trips (spec 2026-10-09-away-trips-design.md).
-- Sits ALONGSIDE leave, not inside it: exact times, amber warning only, and the
-- details are public (a work trip is not private, unlike a leave reason).
-- Number claimed <date> against the live DB and every branch: <record what was checked>.

create table public.away_trips (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (length(trim(title)) > 0),
  business    text,
  location    text,
  start_date  date not null,
  start_time  time not null,
  end_date    date not null,
  end_time    time not null,
  note        text,
  created_by  uuid references public.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check ((end_date, end_time) > (start_date, start_time))
);

create index away_trips_range_idx on public.away_trips (start_date, end_date);

create table public.away_trip_people (
  trip_id  uuid not null references public.away_trips(id) on delete cascade,
  user_id  uuid not null references public.users(id) on delete cascade,
  primary key (trip_id, user_id)
);

create index away_trip_people_user_idx on public.away_trip_people (user_id);

alter table public.away_trips       enable row level security;
alter table public.away_trip_people enable row level security;

-- Everyone signed in reads: who is away and why is company-wide information.
create policy "away_trips: authenticated select"
  on public.away_trips for select to authenticated using (true);
create policy "away_trip_people: authenticated select"
  on public.away_trip_people for select to authenticated using (true);

-- Written by whoever manages leave (HR + admin today). can_manage_leave() from
-- 0058, so a future hr/finance split needs no change here.
create policy "away_trips: manage insert"
  on public.away_trips for insert to authenticated with check (can_manage_leave());
create policy "away_trips: manage update"
  on public.away_trips for update to authenticated
  using (can_manage_leave()) with check (can_manage_leave());
create policy "away_trips: manage delete"
  on public.away_trips for delete to authenticated using (can_manage_leave());

create policy "away_trip_people: manage insert"
  on public.away_trip_people for insert to authenticated with check (can_manage_leave());
create policy "away_trip_people: manage delete"
  on public.away_trip_people for delete to authenticated using (can_manage_leave());

-- Data API grants (CLAUDE.md hard rule, Supabase change of 2026-10-30). Never anon.
grant select, insert, update, delete on public.away_trips       to authenticated;
grant select, insert, update, delete on public.away_trips       to service_role;
grant select, insert, update, delete on public.away_trip_people to authenticated;
grant select, insert, update, delete on public.away_trip_people to service_role;

-- Realtime, so a trip HR adds appears on open schedules without a reload.
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'away_trips') then
    alter publication supabase_realtime add table away_trips;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'away_trip_people') then
    alter publication supabase_realtime add table away_trip_people;
  end if;
end $$;

alter table public.away_trips       replica identity full;
alter table public.away_trip_people replica identity full;
```

- [ ] **Step 3: Add the table types**

In `src/lib/supabase/types.ts`, directly after the closing `}` of the `company_events` block (before the `}` that closes `Tables`), add:

```ts
      away_trips: {
        Row: {
          id:         string
          title:      string
          business:   string | null
          location:   string | null
          start_date: string
          start_time: string
          end_date:   string
          end_time:   string
          note:       string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['away_trips']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?:         string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['away_trips']['Insert']>
        Relationships: []
      }
      away_trip_people: {
        Row:    { trip_id: string; user_id: string }
        Insert: { trip_id: string; user_id: string }
        Update: Partial<{ trip_id: string; user_id: string }>
        Relationships: []
      }
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: STOP — ask Nic before applying.** The DB is shared by preview and production. Show him the file and ask for an explicit OK to run `npx supabase db push`. After his OK, run it, then confirm with `npx supabase migration list` that `<N>` shows on the remote side. (Memory rule: DB push before any code that reads the tables reaches a deploy.)

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/<N>_away_trips.sql src/lib/supabase/types.ts
git commit -m "feat(away): away_trips + away_trip_people tables, RLS, grants, realtime"
```

---

### Task 3: Reads + write routes

**Files:**
- Create: `src/lib/supabase/queries/away.ts`
- Create: `src/app/api/away/route.ts`
- Create: `src/app/api/away/[id]/route.ts`

**Interfaces:**
- Consumes: `AwayTrip` (Task 1), `guardHr()` from `@/lib/utils/leave-guard`.
- Produces:
  - `getAwayTrips(): Promise<AwayTrip[]>` — all trips, people with names, ordered by start
  - `getAwayTripsInRange(from: string, to: string): Promise<AwayTrip[]>` — trips whose date range touches `[from, to]`
  - `mapTripRows(rows: TripRow[]): AwayTrip[]` (exported for the notifier's service-client query)
  - `TRIP_SELECT` constant
  - Routes: `GET /api/away` → `{ trips: AwayTrip[] }`; `POST /api/away` body `{ user_ids: string[]; title; business?; location?; start_date; start_time; end_date; end_time; note? }` → `{ trip: AwayTrip }`; `PATCH /api/away/[id]` same body (all fields required — the form always sends the whole trip) → `{ trip }`; `DELETE /api/away/[id]` → `{ ok: true }`.
  - Task 4 hooks in via `notifyAwayCreated(trip)` and `notifyAwayEdited(before, after)` — in this task call sites are written but the import is added in Task 4. To keep this task independently buildable, create the routes WITHOUT the notify calls; Task 4 adds them.

- [ ] **Step 1: Write the queries**

Create `src/lib/supabase/queries/away.ts`:

```ts
import { createClient } from '@/lib/supabase/server'
import type { AwayTrip } from '@/lib/utils/away-overlap'

// Away trips are readable by every signed-in role (RLS) — who is away on a
// course and where is ordinary team information. Names come through the
// away_trip_people -> users embed: that table has ONE FK to users, so the
// embed is unambiguous (the PGRST201 rule is about tables with several).

export const TRIP_SELECT =
  'id, title, business, location, start_date, start_time, end_date, end_time, note, ' +
  'away_trip_people(user_id, users(name))'

export type TripRow = {
  id: string; title: string; business: string | null; location: string | null
  start_date: string; start_time: string; end_date: string; end_time: string; note: string | null
  away_trip_people: Array<{ user_id: string; users: { name: string } | null }>
}

export function mapTripRows(rows: TripRow[]): AwayTrip[] {
  return rows.map(({ away_trip_people, ...t }) => ({
    ...t,
    start_time: t.start_time.slice(0, 5),
    end_time:   t.end_time.slice(0, 5),
    people: away_trip_people
      .map(p => ({ id: p.user_id, name: p.users?.name ?? '' }))
      .filter(p => p.name)
      .sort((a, b) => a.name.localeCompare(b.name)),
  }))
}

export async function getAwayTrips(): Promise<AwayTrip[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('away_trips')
    .select(TRIP_SELECT)
    .order('start_date', { ascending: true })
    .order('start_time', { ascending: true })
  if (error) throw error
  return mapTripRows((data ?? []) as unknown as TripRow[])
}

/** Trips whose dates touch [from, to] (inclusive both ends). */
export async function getAwayTripsInRange(from: string, to: string): Promise<AwayTrip[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('away_trips')
    .select(TRIP_SELECT)
    .lte('start_date', to)
    .gte('end_date', from)
  if (error) throw error
  return mapTripRows((data ?? []) as unknown as TripRow[])
}
```

- [ ] **Step 2: Write the validator and the list/create route**

Create `src/lib/utils/away-validate.ts` (its own file: a Next.js `route.ts` may only export HTTP handlers and route config, so shared helpers there break `next build`):

```ts
// Request validation for the away routes — shared by POST and PATCH.

export const ISO_RE  = /^\d{4}-\d{2}-\d{2}$/
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

export type TripBody = {
  user_ids?: string[]; title?: string; business?: string | null; location?: string | null
  start_date?: string; start_time?: string; end_date?: string; end_time?: string; note?: string | null
}

/** Null when valid; otherwise the message to show. */
export function validateTrip(b: TripBody): string | null {
  if (!Array.isArray(b.user_ids) || b.user_ids.length === 0) return 'Pick at least one person'
  if (!b.title || !b.title.trim()) return 'Add a title'
  if (!ISO_RE.test(b.start_date ?? '') || !ISO_RE.test(b.end_date ?? '')) return 'Invalid date'
  if (!TIME_RE.test(b.start_time ?? '') || !TIME_RE.test(b.end_time ?? '')) return 'Invalid time'
  const start = `${b.start_date} ${b.start_time}`
  const end   = `${b.end_date} ${b.end_time}`
  if (end <= start) return 'The end must be after the start'
  return null
}

/** Trim; empty becomes null. */
export const cleanText = (s: string | null | undefined) => (s && s.trim() ? s.trim() : null)
```

Create `src/app/api/away/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { guardHr } from '@/lib/utils/leave-guard'
import { getAwayTrips, TRIP_SELECT, mapTripRows, type TripRow } from '@/lib/supabase/queries/away'
import { validateTrip, cleanText as clean, type TripBody } from '@/lib/utils/away-validate'

// Away trips — list (for the Leave page) and create. Writes run on the
// USER-SCOPED client so RLS is the real gate; guardHr() turns a refusal into a
// clean 403 instead of an empty result.

export async function GET() {
  const { ok } = await guardHr()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return NextResponse.json({ trips: await getAwayTrips() })
}

export async function POST(req: NextRequest) {
  const { ok, supabase, userId } = await guardHr()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json() as TripBody
  const invalid = validateTrip(body)
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

  const { data: inserted, error } = await supabase
    .from('away_trips')
    .insert({
      title:      body.title!.trim(),
      business:   clean(body.business),
      location:   clean(body.location),
      start_date: body.start_date,
      start_time: body.start_time,
      end_date:   body.end_date,
      end_time:   body.end_time,
      note:       clean(body.note),
      created_by: userId,
    } as never)
    .select('id')
    .single()
  // A row must come back — an RLS-refused INSERT returns none and no error.
  if (error || !inserted) {
    return NextResponse.json({ error: 'Save failed — you may not have permission' }, { status: 403 })
  }
  const tripId = (inserted as { id: string }).id

  const people = [...new Set(body.user_ids!)].map(user_id => ({ trip_id: tripId, user_id }))
  const { data: peopleRows, error: peopleError } = await supabase
    .from('away_trip_people').insert(people as never).select('user_id')
  if (peopleError || !peopleRows || peopleRows.length !== people.length) {
    // A trip with nobody on it is meaningless — undo rather than leave it.
    await supabase.from('away_trips').delete().eq('id', tripId)
    return NextResponse.json({ error: 'Save failed — could not add the people' }, { status: 500 })
  }

  const { data: full } = await supabase.from('away_trips').select(TRIP_SELECT).eq('id', tripId).single()
  const trip = mapTripRows([full as unknown as TripRow])[0]
  return NextResponse.json({ trip })
}
```

- [ ] **Step 3: Write the edit/delete route**

Create `src/app/api/away/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { guardHr } from '@/lib/utils/leave-guard'
import { TRIP_SELECT, mapTripRows, type TripRow } from '@/lib/supabase/queries/away'
import { validateTrip, cleanText as clean, type TripBody } from '@/lib/utils/away-validate'

// Edit / delete one trip. The form always sends the whole trip, so PATCH
// validates exactly like POST. People are replaced as a set: rows not in the
// new list are deleted, new ones inserted.

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { ok, supabase } = await guardHr()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json() as TripBody
  const invalid = validateTrip(body)
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

  const { data: beforeRaw } = await supabase.from('away_trips').select(TRIP_SELECT).eq('id', id).maybeSingle()
  if (!beforeRaw) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const before = mapTripRows([beforeRaw as unknown as TripRow])[0]

  const { data: updated, error } = await supabase
    .from('away_trips')
    .update({
      title: body.title!.trim(), business: clean(body.business), location: clean(body.location),
      start_date: body.start_date, start_time: body.start_time,
      end_date: body.end_date, end_time: body.end_time,
      note: clean(body.note), updated_at: new Date().toISOString(),
    } as never)
    .eq('id', id)
    .select('id')
    .maybeSingle()
  // .select() is the guard: an RLS-filtered UPDATE is a 204 with no error.
  if (error || !updated) {
    return NextResponse.json({ error: 'Save failed — you may not have permission' }, { status: 403 })
  }

  const wanted  = new Set(body.user_ids!)
  const current = new Set(before.people.map(p => p.id))
  const toRemove = [...current].filter(u => !wanted.has(u))
  const toAdd    = [...wanted].filter(u => !current.has(u))
  if (toAdd.length > 0) {
    const { error: addErr } = await supabase.from('away_trip_people')
      .insert(toAdd.map(user_id => ({ trip_id: id, user_id })) as never)
    if (addErr) return NextResponse.json({ error: 'Save failed — could not add people' }, { status: 500 })
  }
  if (toRemove.length > 0) {
    const { error: rmErr } = await supabase.from('away_trip_people')
      .delete().eq('trip_id', id).in('user_id', toRemove)
    if (rmErr) return NextResponse.json({ error: 'Save failed — could not remove people' }, { status: 500 })
  }

  const { data: afterRaw } = await supabase.from('away_trips').select(TRIP_SELECT).eq('id', id).single()
  const after = mapTripRows([afterRaw as unknown as TripRow])[0]
  return NextResponse.json({ trip: after })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { ok, supabase } = await guardHr()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  // People cascade. Deleting is quiet — no notification (spec §7.3).
  const { data: deleted, error } = await supabase
    .from('away_trips').delete().eq('id', id).select('id').maybeSingle()
  if (error || !deleted) {
    return NextResponse.json({ error: 'Delete failed — you may not have permission' }, { status: 403 })
  }
  return NextResponse.json({ ok: true })
}
```

Note: `before` is used in Task 4 for the notification diff — leave it in place.

- [ ] **Step 4: Type-check + build the routes**

Run: `npx tsc --noEmit && npm run build`
Expected: no type errors; build succeeds.

- [ ] **Step 5: Smoke the routes against the preview DB is deferred to Task 11.** Commit:

```bash
git add src/lib/supabase/queries/away.ts src/lib/utils/away-validate.ts src/app/api/away
git commit -m "feat(away): read queries and HR-only create/edit/delete routes"
```

---

### Task 4: Notifications

**Files:**
- Create: `src/lib/utils/away-notify.ts`
- Modify: `src/lib/telegram/templates.ts` (after `tplLeaveClash`, ~line 528)
- Modify: `src/app/api/away/route.ts`, `src/app/api/away/[id]/route.ts`

**Interfaces:**
- Consumes: `awayBlocksJob`, `awayWhenLabel`, `pairKey`, `newPairs`, `AwayTrip` (Task 1); `getSchedulers()` from `@/lib/supabase/queries/notifications`; `sendTelegram` from `@/lib/telegram/bot`; `createServiceClient` from `@/lib/supabase/service`.
- Produces: `notifyAwayCreated(trip: AwayTrip): Promise<void>`, `notifyAwayEdited(before: AwayTrip, after: AwayTrip): Promise<void>`, `tplAwayClash(p)`.

- [ ] **Step 1: Add the Telegram template**

In `src/lib/telegram/templates.ts`, after `tplLeaveClash`, add:

```ts
// Trip details are typed by HR — escape them, or a "<" in a business name makes
// Telegram reject the whole message (the unclosed-tag lesson from Phase 4).
const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function tplAwayClash(p: {
  personName:   string
  tripTitle:    string
  tripWhen:     string
  projectTitle: string | null
  jobClient:    string
  jobDate:      string
  timeStart:    string | null
  timeEnd:      string | null
  location:     string
  jobUrl:       string
}): string {
  return (
    `🧳 <b>Away — heads-up</b>\n` +
    `${escHtml(p.personName)} is away (${escHtml(p.tripTitle)}, ${escHtml(p.tripWhen)}) but is on this job:\n` +
    (p.projectTitle ? `<b>${escHtml(p.projectTitle)}</b>\n` : '') +
    `Client: ${escHtml(p.jobClient)}\n` +
    `Date: ${dateLine(p.jobDate, p.timeStart, p.timeEnd)}\n` +
    `📍 ${escHtml(p.location)}\n\n` +
    `This is a warning only — the job is unchanged.\n` +
    `<a href="${p.jobUrl}">View in app →</a>`
  )
}
```

- [ ] **Step 2: Write the notifier**

Create `src/lib/utils/away-notify.ts`:

```ts
import { createServiceClient } from '@/lib/supabase/service'
import { getSchedulers } from '@/lib/supabase/queries/notifications'
import { sendTelegram } from '@/lib/telegram/bot'
import { tplAwayClash } from '@/lib/telegram/templates'
import { awayBlocksJob, awayWhenLabel, pairKey, newPairs, type AwayTrip } from './away-overlap'

// Same two levels as leave-notify (spec §7), approved by Nic 2026-10-09:
//   1. Every new or changed trip -> bell card to schedulers. No Telegram.
//   2. A trip overlapping a job someone on it is FORMALLY on -> bell AND
//      Telegram to the schedulers, the job's PIC and its coordinators.
//      On an edit, only (person, job) pairs that are NEW are notified.
// Best-effort: never throws into the save path.

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? ''
const MAX_SPAN_DAYS = 62

type AffectedJob = {
  id: string; project_title: string | null; client: string; location: string
  date: string; date_end: string | null; time_start: string | null; time_end: string | null
  sales_poc_id: string | null
  job_assignees: Array<{ user_id: string; is_suggestion: boolean }>
}

function minusDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d - n))
  return dt.toISOString().slice(0, 10)
}

async function affectedJobs(trip: AwayTrip): Promise<{ jobs: AffectedJob[]; pairs: Map<string, { personId: string; job: AffectedJob }> }> {
  const svc = createServiceClient()
  const { data } = await svc
    .from('jobs')
    .select('id, project_title, client, location, date, date_end, time_start, time_end, sales_poc_id, job_assignees(user_id, is_suggestion)')
    .in('status', ['scheduled', 'awaiting_approval'])
    .lte('date', trip.end_date)
    .gte('date', minusDays(trip.start_date, MAX_SPAN_DAYS))
  const jobs = (data ?? []) as unknown as AffectedJob[]
  const pairs = new Map<string, { personId: string; job: AffectedJob }>()
  for (const job of jobs) {
    if (!awayBlocksJob(trip, job.date, job.date_end, job.time_start, job.time_end)) continue
    for (const p of trip.people) {
      if (job.job_assignees.some(a => a.user_id === p.id && !a.is_suggestion)) {
        pairs.set(pairKey(p.id, job.id), { personId: p.id, job })
      }
    }
  }
  return { jobs, pairs }
}

async function announce(trip: AwayTrip): Promise<string[]> {
  const svc = createServiceClient()
  const schedulers = await getSchedulers()
  if (schedulers.length > 0) {
    await svc.from('notifications').insert(schedulers.map(s => ({
      user_id: s.id,
      type:    'away_recorded',
      job_id:  null,
      title:   `Away: ${trip.people.map(p => p.name).join(', ')} — ${trip.title}`,
      body:    awayWhenLabel(trip),
    })) as never)
  }
  return schedulers.map(s => s.id)
}

async function escalate(trip: AwayTrip, schedulerIds: string[], only: Iterable<{ personId: string; job: AffectedJob }>) {
  const svc = createServiceClient()
  const when = awayWhenLabel(trip)
  for (const { personId, job } of only) {
    const personName = trip.people.find(p => p.id === personId)?.name ?? 'Someone'
    const { data: coords } = await svc.from('job_coordinators').select('user_id').eq('job_id', job.id)
    const ids = new Set<string>(schedulerIds)
    if (job.sales_poc_id) ids.add(job.sales_poc_id)
    for (const c of (coords ?? []) as Array<{ user_id: string }>) ids.add(c.user_id)

    const jobName = job.project_title || job.client
    await svc.from('notifications').insert([...ids].map(uid => ({
      user_id: uid,
      type:    'away_clash',
      job_id:  job.id,
      title:   `Away: ${personName}`,
      body:    `${personName} is away (${trip.title}, ${when}) but is on "${jobName}". Warning only.`,
    })) as never)

    const { data: chatRows } = await svc.from('users')
      .select('telegram_chat_id').in('id', [...ids]).is('deleted_at', null)
    const targets = new Set<string>()
    for (const r of (chatRows ?? []) as Array<{ telegram_chat_id: string | null }>) {
      if (r.telegram_chat_id) targets.add(r.telegram_chat_id)
    }
    if (targets.size === 0) {
      console.warn('[away/notify] nobody has a Telegram chat id', { jobId: job.id })
      continue
    }
    const msg = tplAwayClash({
      personName, tripTitle: trip.title, tripWhen: when,
      projectTitle: job.project_title, jobClient: job.client, jobDate: job.date,
      timeStart: job.time_start, timeEnd: job.time_end, location: job.location,
      jobUrl: `${APP_URL}/jobs/${job.id}`,
    })
    await Promise.all([...targets].map(chatId => sendTelegram(chatId, msg)))
  }
}

export async function notifyAwayCreated(trip: AwayTrip): Promise<void> {
  try {
    const schedulerIds = await announce(trip)
    const { pairs } = await affectedJobs(trip)
    await escalate(trip, schedulerIds, pairs.values())
  } catch (err) {
    console.error('[away/notify] create failed', err)
  }
}

export async function notifyAwayEdited(before: AwayTrip, after: AwayTrip): Promise<void> {
  try {
    const schedulerIds = await announce(after)
    const [{ pairs: oldPairs }, { pairs: nowPairs }] = await Promise.all([affectedJobs(before), affectedJobs(after)])
    const fresh = newPairs(new Set(oldPairs.keys()), new Set(nowPairs.keys()))
    await escalate(after, schedulerIds, [...fresh].map(k => nowPairs.get(k)!))
  } catch (err) {
    console.error('[away/notify] edit failed', err)
  }
}
```

Note on `before` for an edit: `before` is read BEFORE the update, so `affectedJobs(before)` re-queries jobs as they are now against the OLD trip span/people — exactly "who was already warned".

- [ ] **Step 3: Wire it into the routes**

In `src/app/api/away/route.ts` add `import { notifyAwayCreated } from '@/lib/utils/away-notify'` and, immediately before `return NextResponse.json({ trip })`, add `await notifyAwayCreated(trip)` (awaited — Vercel freezes fire-and-forget work after the response).

In `src/app/api/away/[id]/route.ts` add `import { notifyAwayEdited } from '@/lib/utils/away-notify'` and, before `return NextResponse.json({ trip: after })`, add `await notifyAwayEdited(before, after)`.

- [ ] **Step 4: Type-check + build**

Run: `npx tsc --noEmit && npm run build`
Expected: success.

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/away-notify.ts src/lib/telegram/templates.ts src/app/api/away
git commit -m "feat(away): bell + Telegram when a trip lands on an assigned job"
```

---

### Task 5: Leave page — the Away card and form

**Files:**
- Create: `src/features/leave/AwayCard.tsx`, `src/features/leave/AwayFormModal.tsx`
- Modify: `src/features/leave/LeaveShell.tsx`, `src/app/leave/page.tsx`, `src/lib/i18n/en.ts`, `src/lib/i18n/zh.ts`

**Interfaces:**
- Consumes: `getAwayTrips` (Task 3), `/api/away` routes, `AwayTrip`, `awayWhenLabel`, `LocationInput` (`value`, `onChange`, `lang`), `TimeSelect` (`value`, `onChange`), `Modal`, `Card`, `Btn`, `Field`.
- Produces: i18n keys used by Tasks 6–10: `awayLabel`, `awayChip`, `awayCardTitle`, `awayCardHint`, `awayAddShort`, `awayNone`, `awayFormNew`, `awayFormEdit`, `awayPeople`, `awayTitleField`, `awayBusiness`, `awayLocation`, `awayStarts`, `awayEnds`, `awayNote`, `awayConfirmDelete`, `awayOpenMaps`, `awayWarningOnly`, `awayPast`.

- [ ] **Step 1: Add the strings**

Append to the object in `src/lib/i18n/en.ts` (before the closing `}`):

```ts
  awayLabel: 'Away',
  awayChip: 'Away',
  awayCardTitle: 'Away — courses & business trips',
  awayCardHint: 'Staff away on work. Shown on everyone\'s schedule; jobs over it get a warning, never a block.',
  awayAddShort: 'Away',
  awayNone: 'No trips recorded',
  awayPast: 'Past trips',
  awayFormNew: 'Add trip',
  awayFormEdit: 'Edit trip',
  awayPeople: 'Staff going',
  awayTitleField: 'Title',
  awayBusiness: 'Business / organisation',
  awayLocation: 'Address',
  awayStarts: 'Starts',
  awayEnds: 'Ends',
  awayNote: 'Note',
  awayConfirmDelete: 'Delete this trip?',
  awayOpenMaps: 'Open Maps',
  awayWarningOnly: 'warning only',
```

Append to `src/lib/i18n/zh.ts`:

```ts
  awayLabel: '外出',
  awayChip: '外出',
  awayCardTitle: '外出 — 培训与出差',
  awayCardHint: '因工作外出的员工。显示在所有人的日程上；安排工作时只会提醒，不会阻止。',
  awayAddShort: '外出',
  awayNone: '暂无外出记录',
  awayPast: '过往外出',
  awayFormNew: '添加外出',
  awayFormEdit: '编辑外出',
  awayPeople: '外出员工',
  awayTitleField: '标题',
  awayBusiness: '公司 / 机构',
  awayLocation: '地址',
  awayStarts: '开始',
  awayEnds: '结束',
  awayNote: '备注',
  awayConfirmDelete: '删除此外出记录？',
  awayOpenMaps: '打开地图',
  awayWarningOnly: '仅提醒',
```

Do NOT touch `bn.ts` (bn freeze — falls back to English).

- [ ] **Step 2: Write the form modal**

Create `src/features/leave/AwayFormModal.tsx`:

```tsx
'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/Modal'
import { Btn } from '@/components/Btn'
import { Field } from '@/components/Field'
import { LocationInput } from '@/features/job-detail/LocationInput'
import { TimeSelect } from '@/features/job-detail/TimeSelect'
import { cn } from '@/lib/utils/cn'
import { t } from '@/lib/i18n'
import type { LangCode } from '@/lib/i18n'
import type { AwayTrip } from '@/lib/utils/away-overlap'
import { todayISO } from './format'

type PersonOption = { id: string; name: string; role: string }

interface Props {
  isOpen:  boolean
  onClose: () => void
  onSaved: () => void
  lang:    LangCode
  users:   PersonOption[]
  /** Null = create mode. */
  editing: AwayTrip | null
}

const INPUT_CN =
  'w-full border border-line rounded-lg px-3 py-2 text-sm text-ink bg-bg focus:outline-none'

export function AwayFormModal({ isOpen, onClose, onSaved, lang, users, editing }: Props) {
  const [userIds,   setUserIds]   = useState<string[]>([])
  const [title,     setTitle]     = useState('')
  const [business,  setBusiness]  = useState('')
  const [location,  setLocation]  = useState('')
  const [startDate, setStartDate] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endDate,   setEndDate]   = useState('')
  const [endTime,   setEndTime]   = useState('18:00')
  const [note,      setNote]      = useState('')
  const [search,    setSearch]    = useState('')
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  // Reseed on every open, like LeaveFormModal — a cancelled edit never leaks.
  useEffect(() => {
    if (!isOpen) return
    const today = todayISO()
    setUserIds(editing?.people.map(p => p.id) ?? [])
    setTitle(editing?.title ?? '')
    setBusiness(editing?.business ?? '')
    setLocation(editing?.location ?? '')
    setStartDate(editing?.start_date ?? today)
    setStartTime(editing?.start_time.slice(0, 5) ?? '09:00')
    setEndDate(editing?.end_date ?? today)
    setEndTime(editing?.end_time.slice(0, 5) ?? '18:00')
    setNote(editing?.note ?? '')
    setSearch('')
    setError(null)
  }, [isOpen, editing])

  function toggle(id: string) {
    setUserIds(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id])
  }

  function onStartDate(v: string) {
    setStartDate(v)
    if (endDate === '' || endDate < v) setEndDate(v)   // never leave the range inverted
  }

  async function handleSubmit() {
    setError(null)
    // Client-side mirror of the route's checks, so the common mistakes are
    // explained before a round trip. The route re-checks everything.
    if (userIds.length === 0) { setError('Pick at least one person'); return }
    if (!title.trim())        { setError('Add a title'); return }
    if (`${endDate} ${endTime}` <= `${startDate} ${startTime}`) {
      setError('The end must be after the start'); return
    }
    setSaving(true)
    try {
      const body = {
        user_ids: userIds, title, business, location,
        start_date: startDate, start_time: startTime, end_date: endDate, end_time: endTime, note,
      }
      const res = await fetch(editing ? `/api/away/${editing.id}` : '/api/away', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        setError(data.error ?? 'Save failed')
        return
      }
      onSaved()
      onClose()
    } catch {
      setError('Save failed — check your connection')
    } finally {
      setSaving(false)
    }
  }

  const shown = users.filter(u => u.name.toLowerCase().includes(search.trim().toLowerCase()))

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t(lang, editing ? 'awayFormEdit' : 'awayFormNew')}>
      <div className="flex flex-col gap-3">
        <Field label={`${t(lang, 'awayPeople')} *`}>
          <input className={INPUT_CN} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" />
          <div className="mt-2 max-h-40 overflow-y-auto flex flex-wrap gap-1.5">
            {shown.map(u => (
              <button
                key={u.id}
                type="button"
                onClick={() => toggle(u.id)}
                className={cn(
                  'px-2.5 py-1 rounded-full border text-xs font-medium',
                  userIds.includes(u.id)
                    ? 'bg-brand-amber-soft border-brand-amber text-ink'
                    : 'bg-paper border-line text-ink2',
                )}
              >
                {u.name}
              </button>
            ))}
          </div>
        </Field>

        <Field label={`${t(lang, 'awayTitleField')} *`}>
          <input className={INPUT_CN} value={title} onChange={e => setTitle(e.target.value)} placeholder="First Aid course" />
        </Field>

        <Field label={t(lang, 'awayBusiness')}>
          <input className={INPUT_CN} value={business} onChange={e => setBusiness(e.target.value)} />
        </Field>

        <Field label={t(lang, 'awayLocation')}>
          <LocationInput value={location} onChange={setLocation} lang={lang} />
        </Field>

        {/* Stacked, not side by side: two date+time pairs in one row overflowed
            a 360px phone on the Leave page before (2026-09-09). */}
        <Field label={`${t(lang, 'awayStarts')} *`}>
          <div className="flex flex-col gap-2">
            <input type="date" className={INPUT_CN} value={startDate} onChange={e => onStartDate(e.target.value)} />
            <TimeSelect value={startTime} onChange={setStartTime} />
          </div>
        </Field>
        <Field label={`${t(lang, 'awayEnds')} *`}>
          <div className="flex flex-col gap-2">
            <input type="date" className={INPUT_CN} value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} />
            <TimeSelect value={endTime} onChange={setEndTime} />
          </div>
        </Field>

        <Field label={t(lang, 'awayNote')}>
          <textarea className={cn(INPUT_CN, 'min-h-[64px]')} value={note} onChange={e => setNote(e.target.value)} />
        </Field>

        {error && <p className="text-xs text-bad">{error}</p>}

        <div className="flex gap-3 pt-1">
          <Btn variant="secondary" onClick={onClose} className="flex-1">Cancel</Btn>
          <Btn onClick={handleSubmit} disabled={saving} className="flex-1">{saving ? 'Saving…' : 'Save'}</Btn>
        </div>
      </div>
    </Modal>
  )
}
```

Before writing, open `src/components/Field.tsx` and confirm its props are `label` + `children`; if it takes `htmlFor`/`error` too, they are optional — adapt only the prop names, not the layout.

- [ ] **Step 3: Write the card**

Create `src/features/leave/AwayCard.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Card } from '@/components/Card'
import { Btn } from '@/components/Btn'
import { Pencil, Trash2, Plus, Check, X } from 'lucide-react'
import { t } from '@/lib/i18n'
import type { LangCode } from '@/lib/i18n'
import { awayWhenLabel, type AwayTrip } from '@/lib/utils/away-overlap'
import { AwayFormModal } from './AwayFormModal'
import { todayISO } from './format'

type PersonOption = { id: string; name: string; role: string }

interface Props {
  trips:     AwayTrip[]
  users:     PersonOption[]
  lang:      LangCode
  onChanged: () => void
}

// Away — staff on courses and business trips. Unlike leave the details are
// public and scheduling over it only warns (Nic, 2026-10-09).
export function AwayCard({ trips, users, lang, onChanged }: Props) {
  const [modalOpen, setModalOpen] = useState(false)
  const [editing,   setEditing]   = useState<AwayTrip | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [showPast,  setShowPast]  = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  const today    = todayISO()
  const upcoming = trips.filter(tr => tr.end_date >= today)
  const past     = trips.filter(tr => tr.end_date <  today).reverse()

  async function remove(id: string) {
    setError(null)
    const res = await fetch(`/api/away/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { error?: string }
      setError(data.error ?? 'Delete failed')
      return
    }
    setConfirmId(null)
    onChanged()
  }

  function row(tr: AwayTrip) {
    return (
      <li key={tr.id} className="py-2.5 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink truncate">{tr.people.map(p => p.name).join(', ')}</p>
          <p className="text-xs text-ink2 mt-0.5 truncate">{tr.title}{tr.business ? ` · ${tr.business}` : ''}</p>
          <p className="text-xs text-muted mt-0.5">{awayWhenLabel(tr)}</p>
        </div>
        {confirmId === tr.id ? (
          <>
            <button aria-label={t(lang, 'awayConfirmDelete')} onClick={() => remove(tr.id)} className="p-1.5 text-bad"><Check size={14} /></button>
            <button aria-label="Cancel" onClick={() => setConfirmId(null)} className="p-1.5 text-muted"><X size={14} /></button>
          </>
        ) : (
          <>
            <button aria-label={t(lang, 'awayFormEdit')} onClick={() => { setEditing(tr); setModalOpen(true) }} className="p-1.5 text-muted hover:text-ink"><Pencil size={14} /></button>
            <button aria-label={t(lang, 'awayConfirmDelete')} onClick={() => setConfirmId(tr.id)} className="p-1.5 text-muted hover:text-bad"><Trash2 size={14} /></button>
          </>
        )}
      </li>
    )
  }

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-ink">{t(lang, 'awayCardTitle')}</h2>
          <p className="text-[11px] text-muted mt-0.5">{t(lang, 'awayCardHint')}</p>
        </div>
        <Btn variant="accent" size="sm" onClick={() => { setEditing(null); setModalOpen(true) }} className="shrink-0">
          <span className="flex items-center gap-1.5"><Plus size={12} />{t(lang, 'awayAddShort')}</span>
        </Btn>
      </div>

      {error && <p className="text-xs text-bad mt-2">{error}</p>}

      {upcoming.length === 0
        ? <p className="text-xs text-muted mt-3">{t(lang, 'awayNone')}</p>
        : <ul className="divide-y divide-line mt-1">{upcoming.map(row)}</ul>}

      {past.length > 0 && (
        <button type="button" onClick={() => setShowPast(s => !s)} className="text-xs text-terracotta hover:underline mt-3">
          {t(lang, 'awayPast')} ({past.length})
        </button>
      )}
      {showPast && <ul className="divide-y divide-line mt-1">{past.slice(0, 20).map(row)}</ul>}

      <AwayFormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={onChanged}
        lang={lang}
        users={users}
        editing={editing}
      />
    </Card>
  )
}
```

- [ ] **Step 4: Wire it into the Leave page**

In `src/app/leave/page.tsx`: import `getAwayTrips` from `@/lib/supabase/queries/away`; change the `Promise.all` to also fetch it:

```ts
  const [leave, holidays, events, users, trips] = await Promise.all([
    getLeave(), getHolidays(), getCompanyEvents(), getActiveUsers(), getAwayTrips(),
  ])
```

and pass `initialTrips={trips}` to `LeaveShell`.

In `src/features/leave/LeaveShell.tsx`:
- import `AwayCard` and `type AwayTrip` from `@/lib/utils/away-overlap`;
- add `initialTrips: AwayTrip[]` to `Props` and the destructure; add `const [trips, setTrips] = useState(initialTrips)`;
- in `refresh()`, after the existing `/api/leave` fetch succeeds, also fetch `/api/away` and `setTrips(data.trips)` when `res.ok`;
- add `{ table: 'away_trips' }, { table: 'away_trip_people' }` to the `useLiveChannel` `tables` list (line ~106);
- render `<AwayCard trips={trips} users={users} lang={lang} onChanged={refresh} />` directly after `<EventsCard … />` (line ~248).

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npm run build` — expected success. Then `npm run dev`, sign in as admin, open `/leave`: the card shows under Company events; Add a trip with two people → it appears under the card; Edit removes one person → list updates; at 360px wide (DevTools) the form has no sideways scroll (check `document.documentElement.scrollWidth <= innerWidth` in the console while the modal is open).

- [ ] **Step 6: Commit**

```bash
git add src/features/leave src/app/leave/page.tsx src/lib/i18n/en.ts src/lib/i18n/zh.ts
git commit -m "feat(away): Away card and trip form on the Leave page"
```

---

### Task 6: The amber strip everywhere notices show

**Files:**
- Create: `src/features/schedule/AwayStrip.tsx`
- Modify: `src/features/schedule/DayNotices.tsx`, `ScheduleShell.tsx`, `ListView.tsx`, `WeekView.tsx`, `DateStrip.tsx`, `MonthView.tsx`, `src/app/schedule/page.tsx`, `src/features/installer/InstallerShell.tsx`, `src/app/installer/page.tsx`

**Interfaces:**
- Consumes: `AwayTrip`, `awayDates`, `awayWhenLabel` (Task 1); `getAwayTrips` (Task 3); `mapsSearchUrl` from `@/lib/utils/job-form-rules`; `Modal`.
- Produces: `AwayStrip({ trips, label, lang })`; `DayNotices` gains optional `awayTrips?: AwayTrip[]` + `awayLabel?: string` + `lang?: LangCode`; `buildAwayByDate(trips: AwayTrip[]): Record<string, AwayTrip[]>` exported from `AwayStrip.tsx` (used by FCFS in Task 9).

- [ ] **Step 1: Write the strip + pop-up**

Create `src/features/schedule/AwayStrip.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Briefcase, MapPin } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { t } from '@/lib/i18n'
import type { LangCode } from '@/lib/i18n'
import { mapsSearchUrl } from '@/lib/utils/job-form-rules'
import { awayDates, awayWhenLabel, type AwayTrip } from '@/lib/utils/away-overlap'

/** date -> trips covering it. A trip shows on every day it actually covers. */
export function buildAwayByDate(trips: AwayTrip[]): Record<string, AwayTrip[]> {
  const acc: Record<string, AwayTrip[]> = {}
  for (const trip of trips) for (const d of awayDates(trip)) (acc[d] ??= []).push(trip)
  return acc
}

interface Props {
  trips: AwayTrip[]
  label: string
  lang:  LangCode
}

// Amber "Away" notice, directly under On leave. Each line is tappable and opens
// the trip's details — shown to EVERY role (Nic, 2026-10-09): a work trip is
// not private, unlike a leave reason, which never reaches this component.
export function AwayStrip({ trips, label, lang }: Props) {
  const [open, setOpen] = useState<AwayTrip | null>(null)
  if (trips.length === 0) return null
  const maps = open ? mapsSearchUrl(open.location) : null

  return (
    <>
      <div className="flex items-start gap-2.5 rounded-[10px] border border-brand-amber bg-brand-amber-soft px-3 py-2.5">
        <Briefcase size={16} className="text-brand-amber shrink-0 mt-0.5" strokeWidth={1.8} />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-amber leading-none">{label}</p>
          <div className="mt-1 flex flex-col gap-0.5">
            {trips.map(trip => (
              <button
                key={trip.id}
                type="button"
                onClick={() => setOpen(trip)}
                className="text-left text-sm font-semibold text-ink hover:underline min-w-0 truncate"
              >
                {trip.people.map(p => p.name).join(', ')}
                <span className="font-normal text-ink2"> · {trip.title}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <Modal isOpen={open !== null} onClose={() => setOpen(null)} title={open?.title ?? ''}>
        {open && (
          <div className="flex flex-col gap-3 text-sm">
            <p className="font-semibold text-ink">{open.people.map(p => p.name).join(', ')}</p>
            {open.business && <p className="text-ink2">{open.business}</p>}
            <p className="text-ink2">{awayWhenLabel(open)}</p>
            {open.location && (
              <p className="flex items-start gap-1.5 text-ink2">
                <MapPin size={14} className="shrink-0 mt-0.5" />
                <span className="min-w-0">{open.location}</span>
              </p>
            )}
            {maps && (
              <a href={maps} target="_blank" rel="noreferrer" className="text-terracotta text-sm font-medium hover:underline">
                {t(lang, 'awayOpenMaps')}
              </a>
            )}
            {open.note && <p className="text-ink2 whitespace-pre-wrap">{open.note}</p>}
          </div>
        )}
      </Modal>
    </>
  )
}
```

Before writing, open `src/components/Modal.tsx` and confirm its overlay z-index is `z-[60]` or higher (hard rule); if it is lower, stop and report.

- [ ] **Step 2: Render it from DayNotices**

In `src/features/schedule/DayNotices.tsx`:
- add `'use client'` as the first line (it now renders a stateful child);
- import `{ AwayStrip }` from `./AwayStrip`, `type { AwayTrip }` from `@/lib/utils/away-overlap`, `type { LangCode }` from `@/lib/i18n`;
- add props `awayTrips?: AwayTrip[]`, `awayLabel?: string`, `lang?: LangCode`; default `awayTrips = []`, `awayLabel = 'Away'`, `lang = 'en'`;
- change the early return to `if (!holiday && leaveNames.length === 0 && events.length === 0 && awayTrips.length === 0) return null`;
- directly after the `leaveNames` block (the last child), add `<AwayStrip trips={awayTrips} label={awayLabel} lang={lang} />`.

- [ ] **Step 3: Feed it on the schedule**

`src/app/schedule/page.tsx`: import `getAwayTrips`; add it to the `Promise.all` (destructure `trips`) and pass `awayTrips={trips}` to `ScheduleShell`.

`src/features/schedule/ScheduleShell.tsx`:
- props: `awayTrips?: AwayTrip[]` (default `[]`); import `type AwayTrip` and `{ buildAwayByDate }` from `./AwayStrip`;
- `useLiveChannel` tables: add `{ table: 'away_trips' }, { table: 'away_trip_people' }`;
- after `eventsByDate`, add `const awayByDate = useMemo(() => buildAwayByDate(awayTrips), [awayTrips])`;
- `listStrings`: add `away: tr(lang, 'awayLabel')`;
- pass `awayByDate={awayByDate}` to `ListView`, `WeekView`, `DateStrip` (board view) and `MonthView`;
- board-view `DayNotices`: add `awayTrips={awayByDate[selectedDate] ?? []} awayLabel={listStrings.away} lang={lang}`.

`ListView.tsx`: add prop `awayByDate?: Record<string, AwayTrip[]>` (default `{}`), extend its `strings` type with `away: string`; pass `awayByDate` on to its `DateStrip`; on its `DayNotices` add `awayTrips={awayByDate[selectedDate] ?? []} awayLabel={strings.away} lang={lang}`.

`WeekView.tsx`: add prop `awayByDate` (default `{}`) and `awayLabel?: string`; on its `DayNotices` add `awayTrips={awayByDate[d] ?? []} awayLabel={awayLabel} lang={lang}`. In ScheduleShell pass `awayLabel={listStrings.away}`.

`DateStrip.tsx`: add prop `awayByDate?: Record<string, AwayTrip[]>` (default `{}`); after the holiday marker add the amber dot in the free bottom-RIGHT corner:

```tsx
              {(awayByDate[d] ?? []).length > 0 && (
                <span className={cn(
                  'absolute bottom-1.5 right-1.5 w-1.5 h-1.5 rounded-full',
                  active ? 'bg-white' : 'bg-brand-amber',
                )} />
              )}
```

and update the comment above the markers to read `blue = on leave, green = holiday, amber (bottom-right) = away on work`.

`MonthView.tsx`: add prop `awayByDate` (default `{}`); add a marker in the free bottom-right corner:

```tsx
              {(awayByDate[d] ?? []).length > 0 && (
                <span className={cn(
                  'absolute bottom-0.5 right-0.5 w-1 h-1 rounded-full',
                  isSelected ? 'bg-white' : 'bg-brand-amber',
                )} />
              )}
```

- [ ] **Step 4: Feed it on the installer page**

`src/app/installer/page.tsx`: fetch `getAwayTrips()` in the `Promise.all`, pass `awayTrips={trips}`.

`src/features/installer/InstallerShell.tsx`: prop `awayTrips?: AwayTrip[]` (default `[]`); live-channel tables gain `away_trips` + `away_trip_people`; `const awayByDate = useMemo(() => buildAwayByDate(awayTrips), [awayTrips])`; on its `DayNotices` (~line 324) add `awayTrips={awayByDate[today] ?? []} awayLabel={t(lang, 'awayLabel')} lang={lang}`.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npm run build` — success. Then confirm the classes compiled (the bare-`var()` lesson):

```bash
grep -o 'bg-brand-amber-soft{[^}]*}' .next/static/css/*.css | head -1
grep -o 'border-brand-amber{[^}]*}' .next/static/css/*.css | head -1
```

Expected: one rule each. With `npm run dev`, a trip from Task 5 shows as an amber strip under On leave in List, Drivers, Week views and the installer page; tapping a name opens the pop-up; the date strip and month grid show an amber dot; at 360px wide nothing scrolls sideways.

- [ ] **Step 6: Commit**

```bash
git add src/features/schedule src/features/installer src/app/schedule/page.tsx src/app/installer/page.tsx
git commit -m "feat(away): amber Away strip, details pop-up and calendar dots"
```

---

### Task 7: Warnings in the clash checks (server + job-form pop-ups)

**Files:**
- Modify: `src/app/api/jobs/[id]/clashes/route.ts`, `src/app/api/jobs/[id]/assign-installers/route.ts`
- Modify: `src/features/approvals/ClashResolutionModal.tsx`, `src/features/job-detail/EditClashModal.tsx`, `JobDetailShell.tsx`, `NewJobShell.tsx`, `src/features/fcfs/AssignmentPanel.tsx`, `src/features/schedule/CrewChangeModal.tsx`, `src/features/bin/BinShell.tsx`

**Interfaces:**
- Consumes: `awayTripFor`, `awayWhenLabel`, `AwayTrip` (Task 1); `getAwayTripsInRange` (Task 3).
- Produces:
  - `export interface AwayClashEntry { person: ClashInstaller; title: string; when: string }` in the clashes route; `ClashesResponse.awayClashes: AwayClashEntry[]`.
  - checkOnly response gains `awayClashes: AwayCheckClash[]`, where `export interface AwayCheckClash { installerId: string; installerName: string; title: string; when: string }` lives in `EditClashModal.tsx`. `hasClash` is UNCHANGED (blocking issues only).

- [ ] **Step 1: Clashes route**

In `src/app/api/jobs/[id]/clashes/route.ts`:
- import `{ getAwayTripsInRange }` from `@/lib/supabase/queries/away` and `{ awayTripFor, awayWhenLabel }` from `@/lib/utils/away-overlap`;
- add the interface after `LeaveClashEntry`:

```ts
/** Away on work — an AMBER warning, never a blocker (Nic, 2026-10-09). */
export interface AwayClashEntry {
  person: ClashInstaller
  title:  string
  /** Pre-formatted, e.g. "Tue 13 Oct 2026, 2:00pm → Thu 15 Oct 2026, 12:00pm". */
  when:   string
}
```

- add `awayClashes: AwayClashEntry[]` to `ClashesResponse`;
- the job select must know suggestions: change the job query's embed to `job_assignees(user_id, is_sub_installer, is_suggestion, users(id, name))` and add `is_suggestion: boolean` to `JobRow['job_assignees']`;
- directly after the `leaveClashes` block add:

```ts
  // ── Away (courses / business trips) ─────────────────────────────────────
  // Formal crew only — drivers AND support crew — never suggestions (spec §5).
  const formalPeople = job.job_assignees
    .filter(a => !a.is_suggestion)
    .map(a => ({ id: a.user_id, name: a.users?.name ?? '' }))
    .filter(p => p.name)
  const awayTrips = formalPeople.length === 0 ? [] : await getAwayTripsInRange(job.date, jobEndDate)
  const awayClashes: AwayClashEntry[] = formalPeople.flatMap(p => {
    const trip = awayTripFor(p.id, job.date, job.date_end ?? null, job.time_start, job.time_end, awayTrips)
    return trip ? [{ person: p, title: trip.title, when: awayWhenLabel(trip) }] : []
  })
```

- add `awayClashes` to the final `NextResponse.json({ … })`.

- [ ] **Step 2: checkOnly branch**

In `src/app/api/jobs/[id]/assign-installers/route.ts`, inside the checkOnly branch, after `leaveClashes` is built and before the return, add:

```ts
    // Away on work — amber, never part of hasClash (spec §6). The ids sent are
    // the crew the user is about to save, so they are formal by definition.
    const awayTrips = installerIds.length === 0 ? [] : await getAwayTripsInRange(date, jobEndDate)
    const awayClashes = installerIds.flatMap(id => {
      const trip = awayTripFor(id, date, dateEnd, timeStart, timeEnd, awayTrips)
      return trip ? [{ installerId: id, installerName: names.get(id) ?? '', title: trip.title, when: awayWhenLabel(trip) }] : []
    })
```

and change the return to `{ hasClash: clashes.length > 0 || leaveClashes.length > 0, clashes, leaveClashes, awayClashes }`. Add the two imports.

- [ ] **Step 3: Push-to-Schedule modal**

In `src/features/approvals/ClashResolutionModal.tsx`:
- import `AwayClashEntry` alongside the other route types; add `awayClashes: AwayClashEntry[]` to `Props` and the destructure;
- after the soft heads-up block (`{softClashes.length > 0 && (…)}`), add — note `bg-brand-amber-soft`, NOT `bg-brand-amber/10`:

```tsx
            {/* Away on work — amber, non-blocking: never counted in
                unresolvedCount, so Push stays available (Nic, 2026-10-09). */}
            {awayClashes.length > 0 && (
              <div className="rounded-lg border border-brand-amber bg-brand-amber-soft px-4 py-3 space-y-1">
                <p className="text-xs font-semibold uppercase tracking-widest text-brand-amber">Away</p>
                {awayClashes.map(a => (
                  <p key={a.person.id} className="text-sm text-ink">
                    <span className="font-semibold">{a.person.name}</span>
                    {' is away — '}
                    <span className="font-semibold">{a.title}</span>
                    {`, ${a.when}.`}
                  </p>
                ))}
              </div>
            )}
```

Leave `unresolvedCount` untouched.

Find every place this modal is rendered (`grep -rn "<ClashResolutionModal" src`) and pass `awayClashes={clashData.awayClashes ?? []}` (the `?? []` guards a tab running the old bundle against the new route, or vice versa).

- [ ] **Step 4: Make an away-only result still open the modal**

`JobDetailShell.tsx` (~line 935): extend the "nothing to show" condition with `&& (data.awayClashes ?? []).length === 0`.
`NewJobShell.tsx` (~line 304): extend the "something to show" condition with `|| (clash.awayClashes ?? []).length > 0`.
`BinShell.tsx` `clashLines`: add `...(c.awayClashes ?? []).map(x => \`${x.person.name} — away (${x.title}, ${x.when})\`),` as the last spread.

- [ ] **Step 5: Edit-save modal**

In `src/features/job-detail/EditClashModal.tsx`:
- add after `LeaveCheckClash`:

```ts
// Away on work — a warning, not a clash (Nic, 2026-10-09).
export interface AwayCheckClash {
  installerId:   string
  installerName: string
  title:         string
  when:          string
}
```

- props: `awayClashes?: AwayCheckClash[]` (default `[]`);
- after the `clashes.map(…)` block, inside the same list container, add:

```tsx
        {awayClashes.map((a, i) => (
          <div key={`away-${a.installerId}-${i}`} className="border border-line rounded-[10px] p-3">
            <div className="flex items-center gap-2">
              <AlertTriangle size={13} className="text-brand-amber" />
              <p className="text-sm font-semibold text-ink">{a.installerName}</p>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full ml-auto bg-brand-amber-soft text-brand-amber">
                {t(lang, 'awayChip')}
              </span>
            </div>
            <p className="text-xs text-ink2 mt-1.5">{a.title} · {a.when}</p>
          </div>
        ))}
```

- Review Focus #5: change `const isCoordinator = role === 'coordinator'` to:

```ts
  // An away-only result is a warning, not something to escalate — every role
  // gets Save anyway / Go back for it (Review Focus #5).
  const warningOnly   = clashes.length === 0 && leaveClashes.length === 0
  const isCoordinator = role === 'coordinator' && !warningOnly
```

- [ ] **Step 6: Callers of checkOnly**

`JobDetailShell.tsx` (~line 670): type the response as `{ hasClash: boolean; clashes: CheckClash[]; leaveClashes?: LeaveCheckClash[]; awayClashes?: AwayCheckClash[] }`; change `if (data.hasClash)` to `if (data.hasClash || (data.awayClashes ?? []).length > 0)`; add state `const [editAwayClashes, setEditAwayClashes] = useState<AwayCheckClash[]>([])` next to `editLeaveClashes`, set it inside that branch, clear it wherever `setEditLeaveClashes([])` is called, and pass `awayClashes={editAwayClashes}` to its `<EditClashModal>`.

`AssignmentPanel.tsx` (~line 192): same response type; condition `data.hasClash || (data.awayClashes ?? []).length > 0`; new state `awayPrompt` set before `setClashPrompt`, cleared in both `onProceed` and `onClose`; pass `awayClashes={awayPrompt}`.

`CrewChangeModal.tsx`: extend `ClashReport` with `awayClashes?: Array<{ installerName: string; title: string; when: string }>`; condition `data.hasClash || (data.awayClashes ?? []).length > 0`; render the report box red only when there is a real conflict, amber otherwise:

```tsx
        {report && (() => {
          const blocking = report.clashes.length > 0 || report.leaveClashes.length > 0
          return (
            <div className={cn('rounded-xl border p-3 space-y-1',
              blocking ? 'border-bad bg-bad-soft' : 'border-brand-amber bg-brand-amber-soft')}>
              <p className={cn('flex items-center gap-1.5 text-[13px] font-semibold', blocking ? 'text-bad' : 'text-brand-amber')}>
                <AlertTriangle size={14} /> {blocking ? 'Conflicts found' : 'Heads-up'}
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
              {(report.awayClashes ?? []).map((a, i) => (
                <p key={`a${i}`} className="text-[12px] text-ink2">{a.installerName} is away then — {a.title} ({a.when}).</p>
              ))}
              <p className="text-[12px] text-ink2 pt-1">Save anyway, or go back and pick someone else.</p>
            </div>
          )
        })()}
```

(import `cn` from `@/lib/utils/cn` if not already imported). Note: this modal checks drivers only, exactly as it does for leave today — unchanged scope.

- [ ] **Step 7: Verify**

Run: `npx tsc --noEmit && npm run build` — success. `grep -rn "awayClashes" src | wc -l` — every file listed in this task appears.

- [ ] **Step 8: Commit**

```bash
git add src/app/api/jobs src/features/approvals src/features/job-detail src/features/fcfs/AssignmentPanel.tsx src/features/schedule/CrewChangeModal.tsx src/features/bin/BinShell.tsx
git commit -m "feat(away): amber away warnings in push, edit, assign and drag checks"
```

---

### Task 8: Assistant clash tool

**Files:**
- Modify: `src/lib/supabase/queries/assistant-tools.ts` (~lines 183–260)

**Interfaces:**
- Consumes: `getAwayTripsInRange`, `awayTripFor`, `awayWhenLabel`.
- Produces: `ClashCheck` success shape gains `away: { title: string; when: string; warning_only: true } | null`.

- [ ] **Step 1: Extend the type and the query**

Add to the success branch of `ClashCheck` after `on_leave`:

```ts
      /** Away on a course / business trip — a WARNING only, never a clash. */
      away: { title: string; when: string; warning_only: true } | null
```

In `checkInstallerClashes`, after `blocking` is computed:

```ts
  const trips = await getAwayTripsInRange(date, date)
  const trip  = awayTripFor(person.id, date, null, timeStart, timeEnd, trips)
```

and add to the returned object: `away: trip ? { title: trip.title, when: awayWhenLabel(trip), warning_only: true } : null,`.

- [ ] **Step 2: Tell the model what it means**

Find the `check_clashes` tool description in `src/lib/ai/tool-schemas.ts` (`grep -n "check_clashes" src/lib/ai/tool-schemas.ts`) and append to its description string: ` The result's "away" field means the person is away on a course or business trip: report it as "X is away (title) — warning only", never as a clash.` Do NOT edit `SYSTEM_PREFIX` (it must stay byte-identical for the prompt cache).

- [ ] **Step 3: Verify + commit**

Run: `npx tsc --noEmit` and every suite (the tool-schemas suite must stay green).

```bash
git add src/lib/supabase/queries/assistant-tools.ts src/lib/ai/tool-schemas.ts
git commit -m "feat(away): assistant clash check reports away trips as a warning"
```

---

### Task 9: FCFS board

**Files:**
- Modify: `src/lib/supabase/queries/fcfs.ts`, `src/app/api/fcfs/route.ts`, `src/app/fcfs/page.tsx`, `src/features/fcfs/FCFSShell.tsx`, `FCFSTimeline.tsx`, `ClashDrawer.tsx`

**Interfaces:**
- Consumes: `getAwayTripsInRange`, `awayConflictsForJobs`, `AwayConflict`, `awayWhenLabel`, `AwayStrip`, `buildAwayByDate`.
- Produces: `/api/fcfs` → `{ jobs, leaves, away: AwayTrip[] }`; `FCFSTimeline` + `ClashDrawer` gain `awayClashes: AwayConflict[]`.

- [ ] **Step 1: Data**

`src/lib/supabase/queries/fcfs.ts`: add

```ts
// Away trips covering the board's one day — readable by every role.
export async function getAwayForDate(date: string): Promise<AwayTrip[]> {
  return getAwayTripsInRange(date, date)
}
```

(importing `getAwayTripsInRange` and `type AwayTrip`).

`src/app/api/fcfs/route.ts`: `const [jobs, leaves, away] = await Promise.all([getFCFSDay(date), getLeaveForDate(date), getAwayForDate(date)])` and return `{ jobs, leaves, away }`.

`src/app/fcfs/page.tsx`: fetch `getAwayForDate(date)` in the same `Promise.all`, pass `initialAway={away}`.

- [ ] **Step 2: Shell**

`FCFSShell.tsx`:
- prop `initialAway: AwayTrip[]`; state `const [away, setAway] = useState<AwayTrip[]>(initialAway)`;
- `refetch`: type response `{ jobs: FCFSJob[]; leaves: LeaveRecord[]; away?: AwayTrip[] }`, and `setAway(data.away ?? [])` beside `setLeaves`;
- live channel tables: add `away_trips`, `away_trip_people`;
- after `leaveClashes`:

```ts
  // Away on work — formal crew only (suggestions excluded), amber, warning only.
  const awayClashes = useMemo<AwayConflict[]>(() => awayConflictsForJobs(
    jobs.map(j => ({
      id: j.id, date: j.date, date_end: null,
      time_start: j.time_start, time_end: j.time_end,
      people: j.assignees.filter(a => !a.is_suggestion).map(a => ({ id: a.user_id, name: a.name })),
    })), away), [jobs, away])
```

- `clashChips`: add `away: boolean` to the entry type (initialise `away: false` in both places), then after the leave loop:

```ts
    for (const a of awayClashes) {
      const entry = byInstaller.get(a.personId) ?? { name: a.personName, count: 0, hard: false, leave: false, away: false }
      entry.away = true
      byInstaller.set(a.personId, entry)
    }
```

and in the chip label, when `!chip.leave && chip.count === 0 && chip.away`, render `${t(lang, 'awayChip')}` (an away-only chip stays amber because `hard` is false). Keep the existing leave/count text otherwise, appending ` · ${t(lang, 'awayChip')}` when `chip.away` and the chip already has other text.
- above `<FCFSTimeline`, inside `<main>` before the loading ternary, add:

```tsx
        <div className="px-4 pt-3">
          <AwayStrip trips={buildAwayByDate(away)[date] ?? []} label={t(lang, 'awayLabel')} lang={lang} />
        </div>
```

- pass `awayClashes={awayClashes}` to `FCFSTimeline` and `ClashDrawer`.

- [ ] **Step 3: Timeline outline**

`FCFSTimeline.tsx`: add prop `awayClashes: AwayConflict[]`; in the bar render, compute `const isAway = variant !== 'leave' && awayClashes.some(x => x.personId === a.user_id && x.jobId === job.id)` and add `isAway && 'ring-2 ring-brand-amber'` to the bar's `cn(…)`. Add a legend entry in `FCFSShell`'s legend array: `['bg-punct-flex ring-2 ring-brand-amber', 'awayLabel']`.

- [ ] **Step 4: Drawer**

`ClashDrawer.tsx`: add prop `awayClashes: AwayConflict[]`; include it in the empty check (`… && awayClashes.length === 0`); after the leave entries render:

```tsx
          {awayClashes.map(a => {
            const job = jobs.find(j => j.id === a.jobId)
            return (
              <div key={`away-${a.personId}-${a.jobId}`}>
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={13} className="text-brand-amber" />
                  <p className="text-sm font-semibold text-brand-amber">
                    {a.personName} — {t(lang, 'awayChip')} ({t(lang, 'awayWarningOnly')})
                  </p>
                </div>
                {job && (
                  <div className="flex gap-3 mb-3">
                    <JobCard job={job} label={`#${job.fcfs_rank}`} first={false} lang={lang} />
                  </div>
                )}
                <div className="rounded-[10px] border border-brand-amber bg-brand-amber-soft px-3 py-2 mb-3">
                  <p className="text-xs text-ink">{a.trip.title} · {awayWhenLabel(a.trip)}</p>
                </div>
              </div>
            )
          })}
```

- [ ] **Step 5: Verify + commit**

Run: `npx tsc --noEmit && npm run build`; confirm `grep -o 'ring-brand-amber{[^}]*}' .next/static/css/*.css | head -1` returns a rule. In `npm run dev`, a job crewed with someone on a trip shows an amber-outlined bar, an amber chip and an amber drawer entry; the strip shows above the board.

```bash
git add src/lib/supabase/queries/fcfs.ts src/app/api/fcfs/route.ts src/app/fcfs/page.tsx src/features/fcfs
git commit -m "feat(away): FCFS board strip, amber bar outline, chip and drawer entry"
```

---

### Task 10: Crew pickers on the job form

**Files:**
- Modify: `src/components/UserMetaLine.tsx`, `src/features/job-detail/InstallerGrid.tsx`, `SubInstallerBucket.tsx`, `JobDetailShell.tsx`, `NewJobShell.tsx`, `src/app/jobs/[id]/page.tsx`, `src/app/jobs/new/page.tsx`

**Interfaces:**
- Consumes: `getAwayTrips`, `awayTripFor`, `AwayTrip`.
- Produces: `AwayChip({ label })`; grids gain optional `awayOf?: (id: string) => boolean`.

- [ ] **Step 1: Chip**

In `src/components/UserMetaLine.tsx`, after `LeaveChip`:

```tsx
export function AwayChip({ label }: { label: string }) {
  return (
    <span className="text-[10px] font-medium bg-brand-amber-soft text-brand-amber border border-brand-amber rounded-full px-1.5 py-px shrink-0">
      {label}
    </span>
  )
}
```

- [ ] **Step 2: Grids**

`InstallerGrid.tsx`: import `AwayChip`; prop `awayOf?: (id: string) => boolean`; after the `LeaveChip` line: `{!onLeaveOf?.(inst.id) && awayOf?.(inst.id) && <AwayChip label={t(lang, 'awayChip')} />}` (On leave keeps priority when both apply — spec §6).
`SubInstallerBucket.tsx`: prop `awayOf?` and pass `awayOf={awayOf}` to its `InstallerGrid`.

- [ ] **Step 3: Data + shells**

`src/app/jobs/[id]/page.tsx` and `src/app/jobs/new/page.tsx`: add `role === 'installer' ? Promise.resolve([]) : getAwayTrips()` (edit page) / `getAwayTrips()` (new page) to the `Promise.all`, pass `awayTrips={…}`.

`JobDetailShell.tsx` and `NewJobShell.tsx`: prop `awayTrips?: AwayTrip[]` (default `[]`); next to `onLeaveSet`:

```ts
  // Re-evaluated as the date/time fields move, exactly like onLeaveSet — the
  // grids are date-blind, so the whole (small) trip list is held client-side.
  const awaySet = useMemo(() => {
    const out = new Set<string>()
    if (!watchedDate) return out
    for (const trip of awayTrips) for (const p of trip.people) {
      if (!out.has(p.id) && awayTripFor(p.id, watchedDate, watchedDateEnd || null, watchedStart || null, watchedEnd || null, [trip])) out.add(p.id)
    }
    return out
  }, [awayTrips, watchedDate, watchedDateEnd, watchedStart, watchedEnd])
```

and pass `awayOf={id => awaySet.has(id)}` beside every `onLeaveOf=` (JobDetailShell lines ~1539 and ~1575; NewJobShell ~545 and ~562).

- [ ] **Step 4: Verify + commit**

`npx tsc --noEmit && npm run build`; in dev, set a job's date onto a trip day → the person's tile shows an amber "Away" chip; move the time outside the trip → chip disappears.

```bash
git add src/components/UserMetaLine.tsx src/features/job-detail src/app/jobs
git commit -m "feat(away): amber Away chip on the Drivers and Support crew pickers"
```

---

### Task 11: Whole-branch verification and preview

**Files:** none new.

- [ ] **Step 1: Everything green**

```bash
for f in $(git ls-files 'src/*.test.ts' 'scripts/*.test.ts'); do npx tsx "$f" > /dev/null 2>&1 || echo "FAIL $f"; done; echo done
npx tsc --noEmit
npm run build
```

Expected: `done` only; no type errors; build succeeds. `src/components/toast-layer.test.ts` must pass (no overlay at z-[100]+).

- [ ] **Step 2: Real-data check (read-only)**

With `.env.local` copied into the worktree, write a throwaway script in the scratchpad (NOT in the repo) that loads every trip via the service client, every scheduled job in the trips' ranges, and prints `awayConflictsForJobs` — compare by eye against the schedule. Delete the script after.

- [ ] **Step 3: STOP — ask Nic before pushing.** Push the branch only on his word (`git push -u origin feat-away`), then give him the branch preview URL `https://greenqubes-ops-git-feat-away-greenqubes-projects.vercel.app` and verify the deploy by matching `/api/version` against the commit (bypass header from `.env.local`, never printed).

- [ ] **Step 4: Nic's preview checklist** (hand to him as written):
  1. As HR: add a trip for two people with an address → it shows on the Leave page.
  2. As a scheduler: the trip shows in amber under On leave on List, Drivers, Week; tap it → details + Open Maps.
  3. Push a job onto one of them during the trip → amber "Away" card, Push still works.
  4. Edit a scheduled job's time into the trip → amber warning, Save anyway works (also as a coordinator).
  5. FCFS board that day: amber outline + amber chip + drawer entry.
  6. Bell shows "Away: …"; the PIC gets a Telegram for the job they're on.
  7. Edit the trip's note only → no second Telegram.
  8. Installer login: sees the strip, can open the pop-up.

- [ ] **Step 5: Merge path** (after Nic's OK, each step on his explicit words): branch → `dev` (local merge, `git push origin HEAD:dev` style per memory) → dev preview check → `main` on "push to main". Changelog entry at session end per CLAUDE.md (time from the production `x-vercel-id`).
