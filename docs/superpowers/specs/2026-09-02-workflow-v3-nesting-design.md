# Workflow V3 — Project Nesting (Multi-Store Jobs) — Design Spec

_Date: 2026-09-02 · Approved by Nic through five mockup rounds (artifact + comments)._
_Approved interactive mockup kept at `public/mockups/workflow-v3-nesting/index.html`._
_Branch: `feat-workflow-v3` (from dev a79ce4f). `feat-workflow-v2` stays untouched as the historical archive._

## 1. The problem and the shape of the answer

Campaign launches hit many stores with nearly identical jobs (15 today, potentially 150).
Creating them one by one means endless copy-paste, and the schedule shows an
undifferentiated wall of near-identical rows.

**A project is a container with labels — it copies nothing.** Jobs stay ordinary jobs
with their own forms. The container groups them: on the schedule they fold under one
header, the project carries a handful of shared labels (title, client, description,
default timing, default punctuality, files), and jobs are *nested into* or *created
inside* it. Removing a job from a project leaves the job untouched.

Origin: nic-checklist "Sub-jobs under a main job" (2026-08-05, ux-jobs).

## 2. Data model (migration 0051)

**New table `job_projects`** — office-only container:

| column | type | notes |
|---|---|---|
| id | uuid pk default gen_random_uuid() | |
| name | text not null | e.g. "ABC Project — Visual Refresh" |
| client | text default '' | |
| description | text null | |
| time_start / time_end | text null | project timing, HH:MM, both optional |
| default_punctuality | punctuality null | **null by default** — pre-fill only, see §4 |
| created_by | uuid null | stamped like jobs.created_by |
| r2_folder | text | stamped on insert: `{YYYY-MM-DD}_{name-slug}_{8-char-code}` (creation date; 0042 pattern, app-side is fine — no trigger needed) |
| created_at / updated_at | timestamptz | |

**`jobs` gains two columns:**
- `project_id uuid null references job_projects(id) on delete set null` + index.
  Deleting a project can never delete a job.
- `time_inherited boolean not null default false` — see §5.

**Files on the container** (Files tab stays enabled): `attachment_buckets.project_id uuid null`
and `files.project_id uuid null` (each row belongs to exactly one of job_id / project_id —
CHECK constraint). Project buckets get the same 4 defaults on creation. Objects live under
`projects/{r2_folder}/…` in R2.

**RLS:** `job_projects` + project-scoped buckets/files — SELECT for every office role
(sales, scheduler, coordinator, designer, production, admin); INSERT/UPDATE/DELETE for
sales, scheduler, coordinator, admin. Installers get nothing (their queries never touch
these tables; the job title carries the project name). Upload/download/delete routes for
project files mirror the job-file routes' role checks (installers never; no completed-lock —
projects have no status).

**No status on projects.** Progress is derived: x of N nested jobs completed.

## 3. Creating and editing a project (the job form's project mode)

- `/jobs/new`: a **"Multiple jobs"** switch card (roles: sales, scheduler, coordinator,
  admin). Switching ON: heading becomes **"New Project"**, Team and Chat tabs disable
  (struck in the tab bar, not hidden), Details keeps: Project title, Client, Description,
  Start/End time (labelled as project timing), **Default punctuality for new jobs**
  (3-state: Not set / Strict / Flexible, default Not set), Files tab holds project buckets.
  Fields irrelevant to a container (location, dates, installer grid, brief card, production
  card, financials) are hidden in project mode. Switching OFF returns the untouched job form.
- The "Multiple jobs" card lists nested jobs (title, address, date(s), own-time vs
  project-timing chip, punctuality chip, status chip) with an **×** to un-nest, and
  **+ Add job**.
- **Editing later:** `/projects/[id]` renders the same shell pre-filled. Reached from the
  folder header's open icon (§6) and the /projects list (§9).
- **Delete project** (same roles): confirm modal; un-nests all jobs, deletes project rows +
  its R2 files. Jobs are never deleted.

## 4. The + Add job picker

Bottom sheet (z-[60]+):
- **Search** over pending, scheduled AND completed jobs the caller can see (RLS does the
  filtering); seeded with keyword chips from the project's name + client (tokenised,
  stop-words dropped); results ranked by keyword overlap, then free-text search.
- Jobs already in another project don't appear at all (only nestable jobs are listed);
  rows picked in this session show as "Nested" and disabled. One job → at most one project.
- **Nest** sets `jobs.project_id` (+ timing write-through, §5). No notifications fire.
- **New job in this project** → `/jobs/new?project=<id>`: the normal New Job form
  pre-filled with title `"{project.name} — "` (cursor at end), client, description, and
  punctuality (only if the project's default is set); `project_id` stamped on save; timing
  inheritance applies if the user leaves times empty. Everything else — brief rules, clash
  checks, buckets, suggestions — is the stock form, untouched.

## 5. Timing inheritance (write-through)

The project's time is **written onto** nested jobs so every existing surface (FCFS bars,
clash detection, Telegram templates, installer cards, external pages) just sees a normal
job time. `time_inherited = true` marks where it came from.

- **Nest / create-inside with empty times** → job gets project's time_start/time_end,
  `time_inherited = true`. (Project has no time either → stays empty, flag false.)
- **Project time edited** → all its `time_inherited` jobs get the new time (service-client
  update in the project PATCH route). Clash re-checks are NOT run on this fan-out; the
  next per-job save/push checks as usual (documented behaviour).
- **User edits a nested job's time** → `time_inherited = false`; the job stops following.
  Clearing a job's time re-inherits (back to true) if the project has a time.
- **Un-nest** → times stay as they are, `time_inherited = false`.
- Display: schedule cards label the time "Project time" (muted) when `time_inherited`,
  "Job time" otherwise. Installer cards just say Job time — installers never need to know.

Same write-through does NOT apply to punctuality: `default_punctuality` only pre-fills the
new-job form (§4). Every job keeps its own; folders display the mix (§6).

## 6. Schedule page — one page, filter chips, folders

**Tabs retired.** `/pending` and `/completed` redirect to `/schedule` with the matching
filter; their nav entries go away. The Schedule list gains **filter chips** (All default).

**Pending is personal (hard rule — a leak here causes hysteria):** the **Pending chip
renders only for sales and coordinator**. It shows sales their **own** pending jobs;
a coordinator sees their own **plus the pending jobs they're assigned to via
`job_coordinators`** — a pending job is shared between its sales person and their
assigned coordinators (Nic, 2026-09-02). Every other role sees no Pending chip and no pending rows on the
schedule — installers above all (their views already load scheduled/completed only).
**Admin keeps the chip** (Nic confirmed 2026-09-02) — admin is full-access everywhere in
the app by design. Enforcement is not UI-only: round 2 verifies the `jobs`
RLS actually denies other roles' pending rows to every non-privileged role and tightens it
if any gap exists; the UI hiding is on top. Folder counts ("15 in this project",
"4 / 15 done") are computed from rows the viewer can see, so a scheduler who cannot see
3 pending stores simply sees "4 / 12 done" — RLS truth, never a leak.
Chips: **All / Scheduled / Pending / Completed** for sales + coordinator (+ admin);
**All / Scheduled / Completed** for everyone else. Completed jobs no longer vanish
from the day — every finished job stays in its day's list under a **"Completed" veil**
(dotted border, 75% grey overlay, the word centred; hover or tap reveals the card
beneath). Bulk-action bars follow the active chip: Delete N (pending, roles as today),
Complete N (scheduled, scheduler), Revert N (completed, scheduler). Selection checkboxes
work on visible rows; a folder header's checkbox selects its visible children.

**Folding (office roles; designers/production read-only):** within the selected day,
jobs sharing a `project_id` fold under a folder header:
- **Green ring** (1.5px accent border) + folder icon marks a project.
- Side **punctuality stripe** under the fold arrow — strict red / flex blue /
  **split half-red-half-blue** when that day's nested jobs mix.
- Lines: name · client + project timing · "3 jobs today · 15 in this project" ·
  **date ranges** across the whole project · "4 / 15 done" pill · an open icon → `/projects/[id]`.
- Date ranges: collect nested jobs' date…date_end spans, merge overlapping/adjacent,
  format `d/m/yy – d/m/yy` (single day: one date); one range when all concurrent.
- Fold state per device per project (localStorage), default collapsed; a non-All filter
  chip auto-expands folders with matches and hides folders with none.

**Installers: no folding, ever.** InstallerShell keeps flat lists; the project name sits
in the job title. No installer query touches job_projects.

**Sort & filter dropdown** (list view, office roles) — a small dropdown beside the view
toggle:
- Sorts: start time (default) · created date ↑/↓ · alphabetical A–Z / Z–A.
- Filters: client · date range · job-time window (AM / PM / all-day) · installer
  (matches **suggested and assigned** alike — sales/coordinator can only suggest, so both
  count; suggestions are office-visible anyway and this page is office-only) ·
  **no installer yet**. ("My jobs only" was dropped — pending is personal already, Nic.)
- Combines with the status chips; active count badge on the dropdown button; Clear all.

**"Day x / y" label:** rename "Job Day: 1/3" → "Day 1 / 3" and add it to installer cards
(InstallerJobCard) and folded children. Multi-day expansion across days already exists.

## 7. Push to schedule from the project

Project form's bar: **Save project** + **Push to schedule** (sales, scheduler,
coordinator, admin — same as today's per-job push rights).
- **No nested jobs** → modal: "This project has no jobs yet — add existing jobs with
  + Add job, or create one inside this project." Nothing else happens.
- Otherwise `POST /api/projects/[id]/push`: for each nested **pending** job run the stock
  clash check; clean jobs transition to scheduled via the existing submit logic with
  per-job scheduler Telegrams suppressed; clashing/warning jobs stay pending.
- The route only pushes jobs the caller could push individually (RLS rule 0036: sales
  transition their **own** pending jobs only). A sales push over a mixed project holds
  other people's jobs with the reason "created by {name} — they push it, or a scheduler
  does". A **coordinator pushes only jobs they created or are assigned to via
  `job_coordinators`** — a pending job is shared between its sales person and their
  assigned coordinators (Nic, 2026-09-02). Scheduler/admin push all.
- Result sheet: "13 / 15 jobs pushed" + the hold-outs listed with their reason and an
  Open link each; resolution happens on the job as today (Notify Scheduler / Push Anyways).
- **One** Telegram to all schedulers per push — new template `tplProjectPushed`
  (project name, client, N jobs, date ranges) replaces N individual "New Job" messages.
  Jobs pushed individually from their own form keep today's per-job message.
- Design brief / JO rules unchanged: first push allowed without brief/JO; later saves of a
  scheduled job with a designer require the brief; Design completed still needs a JO file.

## 8. Month view — Notion-style calendar (shared: office + installer)

MonthView is rebuilt (same component, both shells):
- Cells become content rows (min-height ~7rem on lg, compact on phone), not dots.
  Day number top-left (today = sand circle; selected = accent outline).
- **Entries as pills** in punctuality colour (left colour bar + soft tint):
  a project = **one pill** per day — folder icon, name, ×count, green ring, split bar when
  mixed; a standalone job = title + time (or Day x/y for multi-day). Completed = grey,
  colour stripped, no strike-through. Overflow → "+N more".
- **Project pill tap** → floating pop-out (Design Load bubble style): that day's nested
  jobs one line each (colour dot, name, time · installers, completed greyed), tap a row →
  that job; "Open in list" → the day's list with the folder expanded. **PC/tablet:**
  anchored to the pill, flips upward on the bottom rows and shifts inward at edge columns
  so it always sits fully on screen; z-[60]+ so it layers above the bottom nav and the
  floating assistant/bug buttons. **Phone:** a centred modal over a darkened scrim.
- Single job pill tap → the job. Day-number tap → that day in list view (existing drill).
- Installer month: same look, flat entries only.
- Week view: unchanged layout, except a day's nested jobs render as one project chip
  ("ABC ×3"); tapping it drills to the day's list.

## 9. /projects — finding a project later

A minimal list page (office roles): every project as a folder card (ring, name, client,
date ranges, x / N done, open). Reached from a "Projects" button beside the schedule
view toggle. This is also the only place an **empty** project (0 jobs) is visible —
without it a saved-empty project would be unreachable.

## 10. Assistant folders → Workspaces

The assistant's chat folders ("Projects", Phase 4) are renamed **Workspaces** in the UI to
free the word Project for jobs. i18n label changes only (en + zh; bn frozen — falls back);
`asst_projects` tables, routes and code identifiers keep their names.

## 11. What does NOT change

FCFS board (nested jobs appear as normal rows) · clash logic · all existing Telegram
templates (one new one, §7) · design scoring, due-date shifting, Design Load board ·
Duplicate · external installer pages · installer RLS/visibility · assistant tools ·
mobile-app spec (jobs stay jobs; title carries the project name) · overdue alerts
(nested jobs alert as normal; projects never alert).

## 12. Testing

- Standalone suites: date-range merger · picker keyword matcher · timing-inheritance
  transitions (nest, project-time edit, own-time edit, clear, un-nest) · list sort/filter
  reducer · project-push partitioning (clean vs held).
- Type-check + build + all 14 existing suites green before every push.
- Preview smoke checklist per build round; real-installer login check that a nested job
  looks 100% ordinary (title, time, files) and no project artefact leaks.
- **Pending-leak test (round 2 gate):** real non-admin logins — an installer and a
  scheduler each confirm they see no Pending chip and no pending rows (including inside
  folded projects and folder counts); a second sales login confirms it cannot see the
  first sales user's pending jobs. Verified at the DB layer (RLS), not just the UI.

## 13. Build rounds (each: dev-preview smoke test by Nic before the next)

1. **Container core:** migration 0051 · project mode on the job form · picker + nest/un-nest ·
   new-job-in-project · timing write-through · project files · /projects page ·
   push-from-project + `tplProjectPushed` · Workspaces rename.
2. **Schedule list:** folding + folder header (ring/stripe/ranges/progress) · completed
   veil everywhere · filter chips + tab retirement + redirects · sort & filter dropdown ·
   Day 1 / 3 labels · bulk-bar adaptation.
3. **Calendar:** Notion-style month (office + installer) · project pop-outs (PC anchored /
   phone centred) · week-view project chips.

Deploy order per round: `npx supabase db push` BEFORE code (round 1 only — 0051);
dev → preview → Nic's smoke → next round; merge to main only when Nic calls it.
