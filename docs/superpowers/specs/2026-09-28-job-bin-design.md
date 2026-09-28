# Pending Privacy + Job Bin — Design

_2026-09-28 · Nic · brainstormed in chat, approved section by section_

## Why

Nic's Aydan / Arnotts jobs for 2–3 October vanished. The live database showed
they were deleted, not hidden — and **nothing records who deleted a job or
when**, so the question could not be answered. Job delete today is a hard
delete: the row and every linked row cascade away and, since 2026-09-15, the
files are removed from R2 too. There is no undo short of the nightly backup
on the server PC.

While designing the bin, a second problem surfaced that the bin's rules
depend on: **every pending job in the company is visible to every sales,
coordinator, scheduler and admin user.** `getPendingJobs` has no filter and
the jobs SELECT policy (0060) lets those four roles read every row. The
"only the sales person and their coordinators see a draft" rule was designed
once, for Workflow V3 round 2, and was cancelled with it before being built.
Nic noticed he could see the scheduler's drafts.

The Aydan jobs themselves are **out of scope** (Nic: "forget aydan jobs").

## Scope

Two pieces, one spec, shipped in order:

1. **Pending privacy** — a live leak, ships first.
2. **Job bin** — reuses piece 1's "who shares this draft" rule, so the two
   can never disagree.

---

## Part 1 — Pending privacy

### The rule (Nic, 2026-09-28)

A job with status `pending` or `awaiting_approval` is visible to:

- **admin** — always ("admin is the safeguard")
- whoever **created** it (`jobs.created_by`)
- its **sales person-in-charge** (`jobs.sales_poc_id`) — this is how a
  coordinator creating a job on a salesperson's behalf shares it with them
- any **coordinator on it** (`job_coordinators`)

Nobody else — **schedulers included** ("scheduler shouldn't even see any
sales job ahead"). Once a job is scheduled or completed, visibility is
exactly as today.

Call this set of people the job's **sharers**.

### Enforcement: in the database

- A `SECURITY DEFINER` helper, `can_see_pending_job(job_id)` (or an
  equivalent taking the row's columns), answers "is the caller admin or a
  sharer". It must be `SECURITY DEFINER` for the same reason as
  `job_is_completed()` (0053): the check reads `job_coordinators`, whose own
  policies read `jobs`, and a plain subquery recurses.
- The jobs SELECT policy for sales / scheduler / coordinator / admin becomes:
  non-pending → as today; pending → `can_see_pending_job`.
- **Every job-linked table follows the job** while it is pending: files,
  messages, attachment_buckets, job_tasks, job_financials,
  job_external_contacts, job_assignees, job_coordinators, job_designers,
  design_scores, job_chat_state. Most of these are readable by role alone
  today, so locking only `jobs` would leave a draft's files and chat
  reachable by id.
- **UPDATE and DELETE on a pending job** are limited to sharers + admin.
  Today a scheduler can edit or delete anyone's draft (0019 + the DELETE
  route's scheduler branch).
- The DELETE route (`src/app/api/jobs/[id]/route.ts`) runs on the service
  client, so RLS does not protect it — it must check sharer/admin itself
  for pending jobs.
- Every other **service-client** reader of jobs must be checked for pending
  leakage during planning (crons, summaries, digest, ext routes, assistant
  `create_pending_job`). User-scoped readers — the Pending tab, the
  assistant's lookup tools, realtime — inherit the policy automatically.

### What changes for people today

Live data 2026-09-28: 4 pending jobs. 3 are Wei Qing's (scheduler, creator +
PIC), 1 is GreenqubesAI's (admin, PIC). After the change Nic and the other
sales users stop seeing Wei Qing's three. No draft becomes invisible to its
own owner. Jobs with `created_by` null (pre-0048) still resolve through
`sales_poc_id`.

### Verification

From a **real sales login**, not preview-as (preview-as keeps the admin DB
identity, so it cannot test RLS):

- Wei Qing's drafts are absent from Pending
- opening one by URL shows nothing
- a direct REST read of that job id, its files and its messages returns `[]`

And from Wei Qing's side, her own drafts are all still there.

---

## Part 2 — Job bin

### Approach: sealed copy (Nic chose over flag-in-place)

On delete, the job and every linked row are copied into a bin record as one
snapshot, then the job is deleted exactly as today (cascade), **except the
R2 files are kept**. Restore re-inserts the snapshot with the original ids.

Chosen because a binned job then **cannot appear anywhere by accident** —
the schedule, Drivers board, FCFS, clash checks, the 4pm and 6pm summaries,
overdue alerts, the assistant, installer and external pages all keep
reading `jobs` unchanged. The rejected alternative (a `deleted_at` flag)
needs every one of ~34 readers plus the service-client crons to learn to
skip it, and one miss nags a scheduler about a deleted job or puts it on an
installer's phone.

### What a bin record holds

- the full `jobs` row
- rows from: job_assignees, job_coordinators, job_designers,
  job_external_contacts, job_tasks, job_financials, attachment_buckets,
  files, messages, design_scores, job_chat_state
- **not** notifications (the bell) — they are not restored
- `deleted_by`, `deleted_at`, and the job's status at deletion
- the sharer set **as it was at deletion** — so pending-bin visibility does
  not depend on rows that no longer exist

Storage is a new table (e.g. `job_bin`) with the snapshot as `jsonb`,
RLS-enabled with no direct client access; all reads and writes go through
API routes that apply the rules below.

### Who sees and who restores (Nic, 2026-09-28)

| Deleted job was | Visible in the bin to | Can restore |
|---|---|---|
| **Pending** | its sharers + the deleter + admin | its sharers + the deleter + admin |
| **Scheduled** (or completed) | sales, coordinator, scheduler, admin | scheduler, admin, the deleter |

Schedulers do **not** see other people's deleted drafts — same rule as live
drafts. Installer, designer, production and hr have no bin.

Who may *delete* is unchanged: sales and coordinators delete pending jobs
only (and after Part 1, only drafts they share); schedulers and admins
delete anything they can see.

### Deleting

- Same buttons as today: the job page's Delete and tick-and-delete on the
  schedule. Both already call `DELETE /api/jobs/[id]`, the single path.
- The confirm now reads **"Move to bin — it can be restored until
  {date}."**
- The route writes the bin record **before** deleting the job. If the
  snapshot write fails, the delete does not happen.
- R2 objects are **not** deleted at this point.
- An `events` row is written: `kind: 'job_deleted'`, `actor_id`,
  `target_id` = job id, payload with title / client / date / status. This is
  the permanent audit trail — it survives the bin emptying, so "who deleted
  my jobs" is always answerable.

### Where the bin lives

- A **Bin** item in the profile-picture menu for sales, coordinator,
  scheduler and admin.
- Each entry: title, client, date, a pending/scheduled pill, deleted by +
  when, and the date it will be emptied.
- Restore button where the viewer may restore; otherwise greyed with a note
  naming who can.

### Restoring

- The job returns **exactly as it was** — same id, status, date, crew,
  `scheduled_at` (so its FCFS place is kept), files, buckets, chat, tasks,
  prices, design brief. (Nic chose this over restore-as-pending and over
  restore-and-notify.)
- **Scheduled jobs run the existing clash check before the restore is
  confirmed**, same modal as Push to Schedule, so a driver booked elsewhere
  in the meantime is caught there.
- **No Telegram** on restore — symmetrical with delete, which notifies
  nobody.
- A linked person who has since been removed (hard-deleted user row, so an
  FK would fail) is left off, and the restore result says who.
- Restore is all-or-nothing: one transaction (an RPC), so a failure part-way
  never leaves half a job on the schedule.
- An `events` row: `kind: 'job_restored'`.
- The bin record is removed after a successful restore.

### Emptying

- **Admin → Settings** (new tab — no settings store exists yet; add a small
  key/value settings table) with one dropdown: **1 month / 3 months / 6
  months / 1 year / 2 years**. Default **3 months**. One setting for
  everyone.
- The empty date is computed from `deleted_at` + the current setting, so
  changing it applies to what is already in the bin.
- Shortening it first warns how many jobs will be emptied at the next run.
- A **nightly cron** removes expired records and deletes their R2 objects,
  logging an `events` row that the Health tab shows like the other crons.
  An R2 failure leaves the object behind (logged), never the record
  half-removed.
- **Delete forever** from the bin: **admin only**.

### Edge cases to handle in the plan

- Deleting a job whose snapshot is large (long chat, many files) — the
  snapshot holds rows, not file contents, so size is bounded by row count.
- A schema change between delete and restore (column dropped or added):
  restore inserts only columns that exist now and lets new ones default.
- Restoring while a job with the same id exists — impossible with UUIDs
  unless restored twice; the bin record is removed on restore, and restore
  checks it still exists.
- Bulk delete of N jobs produces N bin records and N events.
- The New Job holding-area sweep and the scratch cleanups must never touch
  a binned job's R2 keys (they live under the job folder, not the scratch
  prefixes — confirm in planning).

## Testing

- Pure, tested rules module for bin visibility and restore permission
  (table above), and for the empty date from `deleted_at` + setting. Keep
  the OLD behaviour as the first checks where there is one (e.g. "a
  scheduler can see another user's draft" must fail).
- Pending privacy verified with real logins as described in Part 1.
- Round trip against the real schema on a throwaway job: delete → bin →
  restore → every linked table row count identical, files still openable.
- Nightly cron exercised with a backdated record.

## Migrations

Numbers are **not** reserved here (CLAUDE.md rule). Expect roughly:
`<N>` pending privacy policies + helper, `<N+1>` bin table + settings table +
restore RPC. Claim numbers at implementation time after
`npx supabase migration list` and a check of every branch. Apply each
migration **before** the code that depends on it deploys.

## Out of scope

- Recovering the Aydan / Arnotts jobs (deleted before the bin existed).
- Notifying anyone on delete or restore.
- A bin for anything other than jobs (files, users, messages).
- Changing who may delete a scheduled job.
