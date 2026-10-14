# Job stages: Drafts, Pending (date TBC) and the My Jobs panel

_Designed with Nic, 2026-10-08 → 09. Branch `feat-job-stages`._

> **Renamed 2026-10-14 (Nic): the office stage this spec calls "Pending" is shown as `Ongoing`** — tab, address (`/ongoing`, with `/pending` redirecting), buttons, pill, tour and assistant. In code the stage is `ongoing` (`job-stage.ts`); the database status stays `awaiting_date`, and raw `pending` is still a Draft. Read "Pending" below as "Ongoing".

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

**A Draft is the full job form with no field restrictions** (Nic, 2026-10-09). Every field is there, and nothing is required to save one, not even the date. "Notepad" describes how the Drafts tab behaves (private, a plain list), not a different or smaller form. The same form serves all three stages. Only the buttons and their required fields change.

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

### Storage: today's private `pending` stays as it is; the office stage gets a NEW status `awaiting_date` (chosen 2026-10-09)

| On screen | In the database (`job_status`) | Privacy |
|---|---|---|
| **Draft** | `pending` (and the legacy `awaiting_approval`) — **unchanged** | private, by the existing 0062 rule, untouched |
| **Pending** | `awaiting_date` — **new** | office-visible |
| **Scheduled** / **Completed** | `scheduled` / `completed` | unchanged |

**Why this way round (changed from the first draft of this spec, with Nic's OK).** The first draft renamed every existing `pending` job to a new `draft` value. But preview and production share one database, and Nic's preview check needs the migration applied first. For that whole window, production's old code would run against the new rules: its Pending tab would go empty, and **any job it saved as `pending` would be office-visible**, a privacy leak lasting as long as the preview check. With the new value going on the *office* stage instead:

- **No existing row moves.** Today's private drafts are already `pending` and simply appear under the new Drafts tab.
- **No leak window.** Old code never writes `awaiting_date`, so nothing can become office-visible by accident.
- **Large parts are untouched:** the 0062 privacy rule and its TypeScript mirror, the Bin's rules and snapshots, Duplicate, the handover route, and the AI assistant's `create_pending_job`. All of them already treat `pending` as a private draft, which is still exactly right.
- 0060 ("designer and production see non-pending") and 0058's HR policy ("non-pending") **already** let those roles see `awaiting_date` once it exists. No edit is needed.

The cost is naming: in code, `pending` means Draft. **This translation lives in ONE module, `src/lib/utils/job-stage.ts`** (`stageOf(status)` → `'draft' | 'pending' | 'scheduled' | 'completed'`, plus the inverse `STAGE_STATUS`). Every screen and every new rule speaks in stages, never raw status strings. Each place that reads the raw value carries a comment pointing at that module.

The rejected alternatives: a `draft` enum value replacing `pending` (the leak window above), and one status plus an `is_draft` flag (every permission check would test two things).

### Migrations

Numbers are claimed at implementation time per the CLAUDE.md rule. Written here as `<N>` / `<N+1>`.

- **`<N>`: enum value only.** `alter type job_status add value 'awaiting_date'`. It must be its own migration: Postgres cannot use a new enum value inside the transaction that adds it (the 0018/0019 and 0057 rule).
- **`<N+1>`: everything else.**
  1. `jobs.date` drops `NOT NULL`. A check constraint keeps it required for `scheduled` and `completed`: `check (date is not null or status in ('pending','awaiting_approval','awaiting_date'))`. Old code always writes a date, so it is unaffected.
  2. Sales edit rights: the sales UPDATE policy (0056) gains `awaiting_date` in both USING and WITH CHECK. Scheduler/admin (0019) and coordinator/production (0037) already hold blanket UPDATE. The finer "who edits a Pending job" rule (creator, PIC, coordinators on it, schedulers, admin) is enforced in the form, exactly as coordinator scope already is (0037's own comment).
  3. Installers: no policy grants them `awaiting_date`. 0037 shows them formally assigned jobs, and **formal crew assignment is refused on an `awaiting_date` job** (crew is assigned once it is on the schedule; suggestions stay allowed and are invisible to installers). 0053 shows them completed jobs only. The real-DB check below proves it.
  4. No new tables, so the 2026-10-30 grants rule does not come into play.

**Both migrations are safe to apply before Nic's preview check.** They change nothing old code can observe. Production keeps running unchanged until the `main` merge.

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

Unlocks on Pending. Stays locked on Drafts (designers cannot see drafts). `designBriefEditable` in `job-form-rules.ts` changes from "scheduled only" to "Pending or Scheduled".

**Designers cannot be put on a Draft.** They could not see it, and would get a Telegram about a job they cannot open. The Designers picker is disabled on a Draft with the note "Designers can be added once the job is Pending". The New Job form refuses "Save draft" while designers are picked, saying the same. `/api/jobs/[id]/designers` refuses a Draft (409) as the server-side guard.

**Crew on a Pending job: suggestions only.** Formal driver / support crew / outside-contractor assignment is refused on a Pending job by the server (`assign-installers`, `sub-installers`, `crew`, `external-contacts`). The form shows those pickers in suggest mode with the note "Crew is confirmed once the job is on the schedule". An installer can therefore never see a Pending job.

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
- **Data:** one light query, `getStageJobs(['pending','awaiting_approval','awaiting_date','scheduled'])`, which returns `StageJob` rows (date may be null). RLS already hides other people's drafts. `getScheduleJobs()` is narrowed to `status = 'scheduled'` so `ScheduleJob.date` stays a non-null string and the schedule views need no null handling. That is safe: the schedule page already drops every other status in its own filter.
- **Rule:** a pure `myJobs(jobs, userId)` in its own file with a standalone test.

## Messages (Telegram)

- **Into Pending:** no message. The tab is where people look.
- **Designer assigned on a Pending job:** the existing `tplDesignAssigned`, unchanged.
- **Install date first set on a job that had none:** the designer gets `tplDesignInstallShift`, reworded to "Install date set: Thu 15 Oct". **Date cleared:** "Install date removed". The design due date does **not** shift in either case, because there is no old date to measure from. The server-side auto-shift in `PATCH /api/jobs/[id]` skips when the old or new date is null.
- **Push to Schedule:** the existing scheduler message, unchanged.
- **Scheduled → Pending:** each removed crew member is recorded on the existing `crew_change` queue, so the 6pm summary tells them. Their line reads "Postponed, date to be confirmed", because the job no longer has a date to print. If the job was dated **today**, they are also told immediately by a new short message, `tplJobPostponed`, and the change is marked `notified_now` so the summary does not repeat it.
- **All templates that print a job date** accept a missing one and print "To be confirmed" instead of crashing.

## Things that must not break

Each is checked against the code in the plan, not assumed. "Code that reads as though a feature exists" has cost this app four times (2026-09-15).

- **AI assistant `create_pending_job`:** inserts `pending`, which is now a private Draft. That is already correct and unchanged. Only its user-facing wording changes from "pending job" to "draft". The internal tool name is kept, to avoid disturbing the cached prompt.
- **Duplicate:** inserts `pending`, so the copy is a Draft. Already correct, unchanged.
- **The Bin:** snapshots of existing jobs are untouched. A deleted Pending (`awaiting_date`) job is treated like a scheduled one for who sees and restores it (`bin-rules.ts` keys off `isPendingStatus`, which stays "private draft"). `restore_job_snapshot` must restore a null date. Verified with a real throwaway job, as on 2026-09-28.
- **Handover route:** unchanged. It still guards Draft PIC changes, and a Pending job is office-visible, so it never needs it.
- **Date-reading consumers:** schedule list, Drivers board, Week/Month, FCFS, workload, clashes, the 4pm gaps check, the 6pm summary, overdue alerts, leave notifications. Each must filter to `scheduled` (or `completed`) before reading `date`. Any that does not gets a filter, not a null check. Changing `jobs.date` to `string | null` in `types.ts` makes the type-checker list every reader, and each one is classified.
- **The 31 files that mention `'pending'` or `awaiting_approval`** (list taken 2026-10-09) are each classified: means Draft (most, unchanged), means "not yet scheduled" (must now include `awaiting_date`), or unrelated (digest votes, user link status).
- **Guided tour** steps for sales and coordinator describe the Pending tab. Copy updated in en + zh + bn (the tour is the scoped bn exception). A Drafts tab step is added for both, anchored on `nav-drafts`.
- **Status pill:** `pending` reads "Draft", `awaiting_date` reads "Pending".
- **Job chat** stays locked on Drafts and on Pending (`preScheduleLocked`), as today for not-yet-scheduled jobs.

## Testing

- Pure rule modules, each test **run against the wrong answer first** so it demonstrably catches the bug:
  - `job-stage`: `stageOf` maps every status (including the legacy one) to the right stage.
  - `job-stage-rules`: which button needs which fields; who may move a job between which stages; which required fields may not be emptied at each stage.
  - `myJobs`: creator, PIC and coordinator included; completed and other people's jobs excluded; sort order with undated last.
  - `designBriefEditable`: unlocked on Pending, locked on Draft.
  - `designDateChange`: set / cleared / moved / none, so the design due date never shifts from or to a missing date.
- **Real database, throwaway rows** (service-key script, as for the Bin): an `awaiting_date` job with no date is accepted; a `scheduled` job with no date is refused by the check constraint; Bin delete → restore round-trips a dateless Pending job; existing `pending` rows are untouched (count before = after). Cleaned up afterwards.
- **Real logins, on the preview** (Nic, as for 0062): a draft is still invisible to another sales person; a Pending job is visible to a designer and to HR; an installer sees neither.
- Type-check, production build, every suite green, and new CSS utilities confirmed in the built stylesheet.

## Release

1. Build on `feat-job-stages` (main folder; the company is closed, so no parallel session to isolate from).
2. Claim the migration numbers. **Apply `<N>` and `<N+1>` on Nic's go.** They are safe before the preview, because old code cannot observe them.
3. Branch preview → Nic checks, including the real-login checks above.
4. Merge to `dev` → dev preview → Nic checks.
5. `main` on Nic's explicit "push to main". Production probes; release time from the deployment's `x-vercel-id`.
6. Changelog: a **headsUp**, because this changes how people work: "Your unfinished jobs are now in a new Drafts tab, private to you. Pending is now for confirmed projects waiting for a date, and the whole office can see it." Plus "added" lines for the Drafts tab, designers starting on Pending jobs, and the My Jobs panel.
7. Nic tells the team in the group chat: everything they had in Pending is now under Drafts, and they move the confirmed ones to Pending themselves.

## Out of scope

- Telegram to the office when a job enters Pending.
- Pending jobs on the FCFS board (Nic clarified he meant the Design tab).
- Reminders for Pending jobs that sit without a date.
- Any change to the Completed tab.
