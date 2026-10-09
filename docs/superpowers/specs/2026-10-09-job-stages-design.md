# Job stages: Drafts, Pending (date TBC) and the My Jobs panel

_Designed with Nic, 2026-10-08 → 09. Branch `feat-job-stages` (scratchpad worktree)._

## Why

A sales colleague asked: *"if i ever get a project with no confirmed date yet which is still pending, shouldnt i be able to create that job first, then assign designer to do its work first while waiting for client confirmation on the job installation date?"*

Today that is impossible, for three reasons that stack:

1. **Every job needs a date.** `jobs.date` is `NOT NULL` (0001), so "date not confirmed" means typing a fake one.
2. **Designers cannot see pending jobs** (migration 0060, 2026-09-15). Its own header says to revisit this "if designers start being booked at creation". This is that moment.
3. **The Design brief is locked until the job is scheduled**, because a brief on a job the designer cannot see is useless.

On top of that, "pending" has been doing two jobs: a private notepad (half-filled forms, made private by Nic on 2026-09-28, migration 0062) and a real, client-confirmed project waiting for a date. This design splits them.

Nic also asked, from a marked-up screenshot of the Sales view, for a **quick-link panel** of the person's own jobs down the right of the schedule. It is folded in here because it lists all three stages.

## The three stages

| Stage | Meaning | Date | Who sees it | Who edits it |
|---|---|---|---|---|
| **Draft** | Private notepad. Might never become a job. | optional | creator, sales PIC, coordinators on it, admin (today's 0062 rule, unchanged) | same people |
| **Pending** | Client has confirmed the project; install date not confirmed. Design work can start. | optional | the whole office: sales, coordinator, scheduler, designer, production, hr, admin. **Not installers.** | creator, sales PIC, coordinators on it, schedulers, admin. Designers keep their usual design rights (brief, files, design-complete tick). Everyone else read-only. |
| **Scheduled** | Date confirmed, on the schedule. | **required** | as today | as today |

Completed is unchanged.

### Moving between stages

| From → To | Button | Needs |
|---|---|---|
| Draft → Pending | Save as Pending | title, company, client, contact no., location (date optional) |
| Draft → Scheduled | Push to Schedule | all six, as today (title, date, company, client, contact no., location) |
| Pending → Scheduled | Push to Schedule | all six, as today |
| Pending → Draft | Move back to Drafts | nothing (hides it from the office again) |
| Scheduled → Pending | Move back to Pending | a confirm prompt. Clears the date, takes the crew off, the designer keeps working |

Who may press each: the people in the "Who edits it" column for the job's current stage.

The required-field messages are the existing "\* This field is required" ones (2026-09-11). The rule for each button lives in `job-form-rules.ts` next to the existing push rule.

## Data

### Storage: a new `draft` status (chosen)

Add `draft` to the `job_status` enum. The 0062 privacy rule moves from `pending` onto `draft`; `pending` becomes office-visible.

The rejected alternative was keeping one `pending` status plus an `is_draft` flag. Every permission check would then have to test two things, and the 0062 privacy rule is exactly the kind of check that breaks silently when one test is forgotten.

`awaiting_approval` is a pre-Workflow-V2 leftover. Any row still carrying it becomes `draft`, and it is treated as `draft` everywhere it is still read.

### Migrations

Numbers are claimed at implementation time per the CLAUDE.md rule. Written here as `<N>` / `<N+1>`.

- **`<N>`: enum value only.** `alter type job_status add value 'draft'`. It must be its own migration: Postgres cannot use a new enum value inside the transaction that adds it (the 0018/0019 and 0057 rule).
- **`<N+1>`: everything else.**
  1. `jobs.date` drops `NOT NULL`. A check constraint keeps it required for `scheduled` and `completed`: `check (date is not null or status in ('draft','pending','awaiting_approval'))`.
  2. Column default for `jobs.status` changes from `'pending'` to `'draft'`, so any insert that forgets to set a status lands private.
  3. **Every existing `pending` and `awaiting_approval` job becomes `draft`** (Nic: nothing saved privately becomes office-visible overnight; sales promote the real ones themselves).
  4. `pending_job_hidden()` tests `p_status in ('draft','awaiting_approval')` instead of `('pending','awaiting_approval')`. The 12 restrictive policies that call it, and `job_hidden_from_me()`, need no change. The TypeScript mirror `src/lib/auth/pending-privacy.ts` changes in the same commit.
  5. The 0060 policy "jobs: designer and production see non-pending" becomes "see non-draft". Designers and production see Pending again.
  6. HR's read-only job access (`can_view_jobs_readonly()`) is checked to include `pending`. It must still exclude `draft`.
  7. Installers: confirm that no installer policy reaches a `draft` or `pending` job. Installers see only formally assigned or completed jobs, and pushing to Pending never formally assigns crew. The real-DB test below proves it rather than assuming it.
  8. Edit rights on `pending`: the jobs UPDATE policies get the "Who edits it" set above. The exact policy edits are worked out against the live policy list at plan time, because jobs UPDATE has been widened four times (0036, 0037, 0055, 0056).
  9. No new tables, so the 2026-10-30 grants rule does not come into play.

Both migrations are applied **immediately before** the code merges to `main`, back to back, at a quiet hour, on Nic's word. See Release.

## Screens

### Tabs (`src/lib/navTabs.ts`)

| Role | Drafts (new) | Pending |
|---|---|---|
| sales, coordinator, scheduler, admin | yes | yes |
| designer, production, hr | no | **yes, new for them** |
| installer | no | no |

On a phone the tabs live in the hamburger drawer (below `lg`), so a seventh tab costs nothing there. Nic's choice of a separate Drafts tab over a toggle inside Pending.

### Drafts tab (`/drafts`, new)

A plain list of the viewer's visible drafts, newest first: title, client, and the date if one is set. No calendar: it is a notepad. Search works as on the other tabs.

### Pending tab (`/pending`, reworked)

A list, not the date strip, because many Pending jobs have no date:
- dated jobs first, soonest first;
- then a **"Date to be confirmed"** heading with undated jobs, newest first.

Each row shows title, client, date or "TBC", and the assigned designer if any. Search works as today. The date-remembering for `/pending` (`gq-schedule-date:pending`) is retired along with its date strip.

### Job form (same form; buttons by stage)

- **Draft:** Save draft · Save as Pending · Push to Schedule
- **Pending:** Save · Push to Schedule · Move back to Drafts
- **Scheduled:** as today, plus **Move back to Pending** (confirm prompt: "This clears the install date and takes the crew off. The designer keeps working.")

The Date box is optional except for Push to Schedule. The New Job form gets the same three-way choice.

### Design brief

Unlocks on Pending. Stays locked on Drafts (designers cannot see drafts). `design-brief-rules.ts` changes from "scheduled only" to "pending or scheduled".

### Design tab (Design Load board)

Pending jobs with a designer appear like any other job, with a small **Pending** tag. Undated ones show "Install date TBC" where the install date sits. The board already copes with a null install date (`installDate: string | null`, `daysToDue` null → urgency 0); this is display only.

### My Jobs quick-link panel (from Nic's screenshot)

- **Where:** the Schedule page, for sales, coordinator and scheduler (admin too, since a plain admin is treated as a scheduler there).
- **Which jobs:** the viewer's draft, pending and scheduled jobs, where they are the creator, the sales PIC, or a coordinator on the job. Completed jobs drop off by themselves.
- **Layout:** three groups (Drafts, Pending, Scheduled), each sorted by date, soonest first, undated last. Each row: date (e.g. "Thu 15 Oct", or "TBC"), title, client.
- **Tapping a row:**
  - Scheduled: the schedule moves to that date, in whichever view is open (List, Drivers, Week, Month). The job does not open.
  - Draft or Pending: goes to that tab with the row highlighted. The job does not open.
- **PC:** a right-hand column with an arrow tab to hide or show it. Open/closed is remembered per device in localStorage, **read after mount** (`/schedule` is hydration-sensitive, #418, and the first render must match the server's).
- **Phone:** hidden by default. The arrow opens it as a slide-in panel at `z-[60]` or above, over the bottom nav (overlay hard rule), and below the toast layer (z-[100], `toast-layer.test.ts`).
- **Data:** already loaded on `/schedule`, since `getScheduleJobs()` reads every job the caller may see, so drafts are already privacy-filtered by RLS. The select gains `created_by` and the coordinator's `id`, and the page passes the signed-in user's `users.id` to the shell. No new query.
- **Rule:** a pure `myJobs(jobs, userId)` in its own file with a standalone test.

## Messages (Telegram)

- **Into Pending:** no message. The tab is where people look.
- **Designer assigned on a Pending job:** the existing `tplDesignAssigned`, unchanged.
- **Install date first set on a job that had none:** the designer gets `tplDesignInstallShift`, reworded to "Install date set: Thu 15 Oct". **Date cleared:** "Install date removed". The design due date does **not** shift in either case, because there is no old date to measure from. The server-side auto-shift in `PATCH /api/jobs/[id]` skips when the old or new date is null.
- **Push to Schedule:** the existing scheduler message, unchanged.
- **Scheduled → Pending:** crew removal rides the existing `crew_change` queue. It goes in the 6pm summary, or immediately if the job was dated today, exactly like a Drivers-board drag.

## Things that must not break

Each is checked against the code in the plan, not assumed. "Code that reads as though a feature exists" has cost this app four times (2026-09-15).

- **AI assistant `create_pending_job`:** today it inserts `pending`. Under the new meaning that would put an AI-made job in front of the whole office, so it inserts **`draft`**. Tool name and wording updated to say "draft".
- **Duplicate:** the copy always starts as `draft`, whatever the source was.
- **The Bin:** `restore_job_snapshot` must restore a null date and the `draft` status. Verified with a real throwaway job, as on 2026-09-28. Bin visibility rules (`bin-rules.ts`) follow the new split: deleted drafts private, deleted pending office-visible.
- **Handover route** (`/api/jobs/[id]/handover`): exists because a draft's PIC change could hide the row from its editor. Re-checked for `draft`, and confirmed unnecessary-but-harmless for `pending`.
- **Scheduled-only consumers:** schedule list, Drivers board, Week/Month, FCFS, workload, clashes, the 4pm gaps check, the 6pm summary, overdue alerts. Each must filter to `scheduled` (or `completed`) before reading `date`. Any that does not gets a filter, not a null check.
- **The 31 files that mention `'pending'` or `awaiting_approval`** (list taken 2026-10-09) are each read and classified in the plan: means draft, means pending, or means "not scheduled".
- **Guided tour** steps for sales and coordinator mention Pending. Copy updated. A Drafts anchor is added only if a step points at it.
- **Status pill** gains a `draft` style.

## Testing

- Pure rule modules, each test **run against the wrong answer first** so it demonstrably catches the bug:
  - `job-stage-rules`: which button needs which fields; who may move a job between which stages.
  - `pending-privacy`: draft hidden from a colleague; pending visible to the office; neither visible to an installer.
  - `myJobs`: creator, PIC and coordinator included; completed and other people's jobs excluded; sort order with undated last.
  - `design-brief-rules`: unlocked on pending, locked on draft.
- **Real database, throwaway rows, from each role** (as for the Bin): a draft is invisible to another sales person, a pending job is visible to a designer and to HR, neither is visible to an installer, a scheduled job without a date is refused by the check constraint, and Bin delete → restore round-trips a dateless pending job. Cleaned up afterwards.
- Type-check, production build, and new CSS utilities confirmed in the built stylesheet.

## Release

1. Build on `feat-job-stages` in the scratchpad worktree. Its own preview → Nic checks.
2. Merge to `dev` → dev preview → Nic checks.
3. **Timing risk.** Preview and production share one database. Applying the migrations moves today's pending jobs to `draft`. Until the new code is live, production's old Pending tab will not find them, and a job saved as "pending" from the old screen would be visible to the office. So `<N>`, `<N+1>` and the `main` merge happen back to back, at a quiet hour, on Nic's explicit "push to main".
4. Changelog: a **headsUp**, because this changes how people work: "Unfinished jobs now live in a new Drafts tab, private to you. Pending is for confirmed projects waiting for a date, and the whole office can see it." Plus "added" lines for the Drafts tab, designers on Pending jobs, and the My Jobs panel.
5. Nic tells the team in the group chat. Their existing pending jobs have moved to Drafts and need promoting by hand.

## Out of scope

- Telegram to the office when a job enters Pending.
- Pending jobs on the FCFS board (Nic clarified he meant the Design tab).
- Reminders for Pending jobs that sit without a date.
- Any change to the Completed tab.
