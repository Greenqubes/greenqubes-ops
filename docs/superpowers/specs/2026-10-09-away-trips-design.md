# Away — courses and business trips

_Design approved in conversation with Nic, 2026-10-09. Branch `feat-away`._

> Nic: "Add another box which allows HR to insert staff that goes on course or away for whatever business / work related trips." On the schedule it "appears below On Leave — shows employee name + title as 'Away'. Clicking it will open a pop up and show more details of the event (Name, Title of Business, address, when? (if it's a few days of business))."

## 1 — What it is

A fourth list on the Leave page, beside leave, public holidays and company events: **staff who are away on work** — a course, a site survey, a supplier visit. HR records it; everyone sees it; scheduling a job over it raises an **amber warning, never a block**.

It sits **alongside** leave, not inside it (Nic's pick of three approaches). Leave is whole-day/AM-PM, red, and its reason is HR-locked; a trip is exact-time, amber, and public. Folding one into the other would bend both.

## 2 — Decisions (Nic, 2026-10-09)

| Question | Answer |
|---|---|
| Scheduling over a trip | **Amber warning only** — the scheduler may still assign |
| Several staff on one trip | **One trip, several people** — entered once |
| Timing | **Exact start date + time → end date + time** |
| Who is told when a trip lands on an assigned job | **Same as leave** — bell + Telegram to schedulers, the job's PIC and coordinators |
| Where it shows | **Everywhere leave shows, to every role** (installers included) |
| Build shape | **Own list sitting alongside leave** |

## 3 — The form (HR + admin)

| Field | Required |
|---|---|
| Staff going — tick one or more active users | Yes |
| Title, e.g. "First Aid course" | Yes |
| Business / organisation | No |
| Address — the job form's Google address search (`LocationInput`) | No |
| Start date + time | Yes |
| End date + time (after the start) | Yes |
| Note | No |

The Leave page gets an **"Away — courses & business trips"** card under Company events, with a **+ Away** button, Upcoming / Past folding like the leave list, and edit / delete per trip. Editing can remove one person from a trip.

## 4 — What everyone sees

- **Schedule (List, Drivers, Week, Month), FCFS board, installer page:** an amber **Away** strip directly under On Leave on any date a trip covers — `Halim · First Aid course`, one entry per person per trip.
- **Tapping an entry** opens a pop-up (`z-[60]`+, above the bottom nav): people, title, business, address with Open Maps, `Mon 13 Oct 2:00pm → Wed 15 Oct 12:00pm`, note.
- **Date strip:** an amber dot on days with a trip (leave is blue, holidays green).
- Dates and day names in English in every language (hard rule); new strings in en + zh only (bn freeze).

## 5 — The overlap rule

A new pure module `src/lib/utils/away-overlap.ts`, separate from `leave-overlap.ts` and standalone-tested.

- A trip covers `[start_date start_time, end_date end_time)` as Singapore wall-clock. Per calendar date its window is: first day from `start_time`, last day until `end_time`, days between whole, a one-day trip `start_time`–`end_time`.
- A job is affected when, on any of its days (`date` → `date_end`), its time range overlaps that day's window — the same per-day semantics `leaveBlocksJob` uses:
  - a job with **no start time** is all-day and overlaps any window that day;
  - a job with a start but no end counts if it starts inside the window;
  - **touching edges do not overlap** (trip ends 14:00, job starts 14:00 → no warning).
- Only **formal** crew are checked — Drivers and Support crew rows with `is_suggestion = false`. Suggestions are ignored, as with leave.
- The same 62-day guard as leave against runaway data.

## 6 — Where the warning appears

Every surface that carries leave today gets an `away` list **next to** its leave list — never inside `InstallerClash` / `Clash` / `CheckClash`, for the same reason leave is not (those shapes need two jobs).

| Surface | Away shows as |
|---|---|
| Push-to-Schedule clash modal (`ClashResolutionModal`) | Amber card in the existing soft heads-up section; does not count toward the blocking total |
| Edit-save clash modal (`EditClashModal`) | Same amber card; Save proceeds |
| FCFS board (`FCFSTimeline`, `ClashDrawer`, `AssignmentPanel`) | Amber outline on the person's bar + amber chip in the drawer; leave stays red |
| Driver + Support crew pickers (`InstallerGrid`, `SubInstallerBucket`) | Amber "Away" tag on the tile; "On leave" keeps priority when both apply |
| Drivers-board drag prompt (`CrewChangeModal`) | Amber line: "X is away then — First Aid course" |
| Assistant `check_clashes` | "X is away (First Aid course) — warning only" |

Data reaches these through the routes and queries that already carry leave: `/api/jobs/[id]/clashes`, `assign-installers` `checkOnly`, `/api/fcfs` + `queries/fcfs.ts`, `/api/jobs/[id]/crew`, `assistant-tools.ts`.

## 7 — Notifications

`src/lib/utils/away-notify.ts`, modelled on `leave-notify.ts`, best-effort (never throws into the save):

1. **Every new or changed trip** → bell card to schedulers: `Away: Halim, Rintu — First Aid course` / `Mon 13 Oct 2:00pm → Wed 15 Oct 12:00pm`. No Telegram.
2. **A trip that overlaps a job someone on it is formally assigned to** → bell **and** Telegram to the schedulers, that job's Person-in-Charge and its coordinators (new `tplAwayClash`, HTML-escaped). On an edit, only people/jobs newly affected are re-notified.
3. **Deleted trip** → nothing.

## 8 — Data

Two tables, one migration. **Number claimed at build time** after `npx supabase migration list` and every branch's `supabase/migrations/`, including `feat-job-stages` (a parallel session is working there).

```sql
create table public.away_trips (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
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

create table public.away_trip_people (
  trip_id  uuid not null references public.away_trips(id) on delete cascade,
  user_id  uuid not null references public.users(id) on delete cascade,
  primary key (trip_id, user_id)
);
```

- Plain date + time, Singapore wall-clock — the same as `jobs.date` / `time_start`, so the overlap compares like with like and nothing drifts by 8 hours (this machine's shell is not SGT; the server's UTC is not either).
- RLS on both: `select` to every authenticated user; `insert` / `update` / `delete` only when `can_manage_leave()` (HR + admin today; a future hr/finance split needs no change here).
- **Grants** (CLAUDE.md hard rule): `select, insert, update, delete` to `authenticated` and `service_role` on both tables. **No `anon`.**
- Both tables added to the `supabase_realtime` publication so a new trip appears on open schedules, as `company_events` does.
- Not job-linked, so the Job Bin's `BIN_CHILD_TABLES` and pending-privacy policies are untouched.
- Written through `/api/away` (POST, GET) and `/api/away/[id]` (PATCH, DELETE), guarded like `/api/leave` — the real role must pass `canManageLeave`, never preview-as.

## 9 — Testing

- `away-overlap.test.ts` written first and watched failing: multi-day trip vs single-day job; job inside the middle day; all-day (no start time) job; open-ended job; touching edges (no clash); trip and job on different days; multi-day job vs one-day trip; suggestions excluded.
- The full suite, type-check and production build green; new amber classes checked in the built CSS (the bare-`var()` token lesson — no `/opacity` on theme colours).
- Branch / dev preview: Nic records a trip as HR, then as a scheduler pushes a job onto it (amber, not blocked), opens the FCFS board, the Drivers board and the pop-up, and reads the bell + Telegram.

## 10 — Not in this version

Repeating trips, files on a trip, a trip appearing in the What's new popup beyond the release note, and any change to how leave works.
