---
session: feat-jobs (Workflow V2 — Phase 2 implementation + smoke test)
date: 2026-07-22
branch: feat-workflow-v2 (all code + docs)
---

# Workflow V2 Phase 2 — Role-Locked Job Form + Installer Suggestion/Assignment (PASSED)

> Phase 2 is **complete and fully smoke-tested** (all 6 sections). Phase 3 (FCFS board) is next.
> Read "Critical context for next session" before touching the job form or any `jobs` query.

## What was done

Implemented Tasks 9–15 of `docs/superpowers/plans/2026-06-05-workflow-v2.md`, plus migration 0037
and five bug fixes surfaced during Nic's testing.

### Role-locked job form (Tasks 9, 10, 11, 15)

| Role | Job details | Production ready / DO / instructions / photos | Installers | Save bar |
|---|---|---|---|---|
| Sales | edit | view | **suggest** (yellow) | Save Changes (+ Push to Schedule when pending) |
| Scheduler | edit | edit | **assign** (green) | Save & notify |
| Coordinator | edit | edit | **assign** (green) | Save & notify |
| Production | view | **edit** | view | Save Changes |
| Designer | view | view | view | **none** (chat only) |
| Installer | view | upload photos / sign DO | view | none |
| Admin | edit | edit | assign | Save & notify |

- `CoreSection` gained a `role` prop: `coreLocked` for non-editing roles, with a separate
  `flagsLocked` so **production can still tick "Production ready" / "DO issued"** even though the
  rest of core is locked for them (those two checkboxes live in CoreSection, not ProductionReadySection —
  the plan was wrong about this).
- The **Team card** in `JobDetailShell` (Person-in-Charge, Sub POC/Coordinators, Notes) is gated by the
  same `canEditCore` — it sits outside CoreSection and was initially missed.
- `ProductionReadySection` computes its own per-role rights; `JobDetailShell` stopped passing the
  blanket status-based `readOnly` that had made the whole section read-only on every non-completed job.
- **Deviation:** the plan contradicted itself on Designer (Task 10 let them edit instructions, Task 15
  gave them no Save bar). Resolved as **designer = fully view-only + chat**.
- **Deviation:** `FinancialSection.tsx` is dead code (removed from the form back in session 17.6), so
  Task 9's "hide financials" was a no-op. Left alone.
- **Deferred:** the production-photo thumbnail **lightbox** from Task 11. Existing view/download works.

### Installer suggestion → assignment (Tasks 12, 13)

- `InstallerGrid` rewritten as a **presentation-only 3-state grid** (`none` / `suggested` / `assigned`)
  taking `stateOf` / `onToggle` / `disabledOf` / `noteOf`. Parents own the state.
- **Sales suggests**: clicking an installer calls `POST /api/jobs/[id]/suggest-installer` immediately
  (no Save needed) → yellow card, "You suggested". Sales cannot touch a formally-assigned installer.
  Sales' grid is view-only once the job is `scheduled`.
- **Coordinator/scheduler assigns**: selection is local, saved on "Save & notify" via
  `POST /api/jobs/[id]/assign-installers`, which deletes all suggestions, replaces the formal set, and
  notifies **newly-added installers** (`tplJobAssigned`) + **sales POC and coordinators**
  (`tplInstallerAssigned`, new).
- `NewJobShell`: sales' picks insert as suggestions (`is_suggestion=true, suggested_by`); other roles
  insert formal. Same for clash-modal substitutions.
- **Task 14 (chat for all roles) needed no work** — `ChatSection` never had a role guard.

### Migration 0037 (applied to the shared DB by Nic)

1. Installer job-visibility RLS (`jobs: select by role or assignment`) now requires
   `is_suggestion = false` — **a suggested installer must never see the job**.
2. `assignees: installer sees own rows` likewise excludes suggestions.
3. New `jobs: coordinator and production can update` — coordinator edits job details, production saves
   its own fields. Neither could UPDATE `jobs` before, so their Save would have failed.

Backward-compatible: dev/main never set `is_suggestion=true`, so it's a no-op there.

### Suggestions stripped from every "who's on this job" read

So a tentative pick never looks confirmed or triggers messages:
`getScheduleJobs` / `getCompletedJobs` / `getPendingJobs` (calendar), `getInstallerJobs` (co-assignees),
`getJobRecipients` (chat notifications), `getOverdueJobs` (overdue alerts), `/api/workload`.
`getJobById` deliberately **keeps** them — the job form needs both states.

### Clash modal — floaters + overrides

- **Soft (non-blocking) heads-up**: a clash is only *hard* when **both** jobs have a fixed start time.
  If the overlap exists only because a job has no fixed time (a whole-day "floater" installer), it now
  shows an amber "Heads-up" and **Push stays enabled**. New `softClashes` in the clashes response;
  only firm overlaps mark substitutes "busy".
- **Notify Scheduler** — leaves the job **pending** and Telegrams all schedulers to resolve + assign
  (new `POST /api/jobs/[id]/notify-clash` + `tplClashNeedsReview`). Nic's explicit choice over
  "push it and just flag them".
- **Push Anyways** — forces the job onto the schedule despite the clash.
  Both appear only while a clash is unresolved.

## Bugs found during testing — all fixed

| # | Symptom | Root cause | Fix |
|---|---|---|---|
| 1 | Sales suggestion "pushed straight to installer" | `/jobs/new` passed the **real** DB role, not the effective (preview) role, so admin-previewing-as-sales inserted **formal** assignments | `/jobs/new` now uses `getEffectiveRole`, matching `/jobs/[id]` (`f697021`) |
| 2 | Designer/Coordinator/Production couldn't be previewed | `role-override.ts` `VALID_ROLES` only allowed sales/scheduler/installer | All 6 roles allowed; UserMenu switcher is now a 3-col grid (`f697021`) |
| 3 | Attachment buckets: "Upload failed" on every file/URL | `AttachmentBuckets` set `files.uploader_id` to the **Supabase auth id** instead of the app `users.id` the FK targets → `files_uploader_id_fkey` violation | Takes `userId` (app id) as a prop, matching ChatSection/ProductionReadySection. **Was broken in production too** (`4ba9121`) |
| 4 | Installer's "My Jobs" card had a **blank title** (detail page fine) | `getInstallerJobs` was the only job query with a direct `jobs→users` embed (`sales_poc:users!jobs_sales_poc_id_fkey`) next to the nested `job_assignees→users` embed; on a real installer login the row returned with empty `project_title`/`client` | Sales POC fetched in a **separate query**; `getInstallerJobs` now matches the shape of the two working queries (`c716c33`) |
| 5 | Generic "Upload failed" gave no diagnosis | One message for all 3 upload steps | Per-step messages + console logging (`c1efe3b`) — this is what pinpointed #3 |

## Key decisions

- **FCFS tab dropped for installers** (Nic, 2026-07-22). Installers only need their own jobs; the board
  is a scheduler/coordinator planning tool. Overrides the Phase 1 "FCFS for every role" decision.
  Still shown to scheduler / sales / coordinator / designer / production / admin.
- **Designer = view-only + chat** (resolved the plan's internal contradiction).
- **Suggestions live in `job_assignees` with `is_suggestion`** (not a separate table), so they still
  participate in push-time clash detection — a tentative pick shouldn't double-book someone.

## ⚠️ Critical context for next session

- **NEVER embed `users` directly onto `jobs`** in a PostgREST select. `jobs` has several FKs to `users`
  (`sales_poc_id`, `approved_by`) and this has now broken **twice**: PGRST201 crashes on every
  deployment (fixed by migration 0035) and bug #4 above. Fetch the user in a follow-up query.
- **The "preview as" role switcher only changes the UI role** — the database still sees you as admin,
  who can read every job. Anything gated by row-level security (suggestion-hiding, installer job
  visibility) **must be tested with a real non-admin login**. This cost a round-trip during testing;
  Nic confirmed Section 2 with a real installer account in the end.
- **Phase 3 next (Tasks 16–19):** FCFS board at `/fcfs` (currently 404s) — weekly timeline grid per
  installer, punctuality-aware hard/soft clash grading (strict+strict = hard, flex+strict = soft,
  flex+flex = none), clash drawer. Also inherits the **deferred clash-check-on-edit** of an already-
  scheduled job (today the check only fires at push).
- **Shared DB** — migrations 0033–0037 applied; any new migration must stay backward-compatible with
  the code deployed on dev/main.
- **Clean-cut switchover still stands** — nothing merges to `dev` until all of V2 is done.
- Test jobs/accounts from Phase 1 + 2 are still in the DB; Nic wipes them right before go-live.

## Key files changed

| File | Change |
|---|---|
| `supabase/migrations/0037_installer_visibility_excludes_suggestions.sql` | installer RLS excludes suggestions; coordinator+production jobs UPDATE |
| `src/features/job-detail/CoreSection.tsx` | `role` prop, `coreLocked` / `flagsLocked` gating |
| `src/features/job-detail/ProductionReadySection.tsx` | per-role edit/upload rights; designer view-only |
| `src/features/job-detail/InstallerGrid.tsx` | rewritten as 3-state presentation grid |
| `src/features/job-detail/JobDetailShell.tsx` | suggestion/assign state, grid wiring, assign-installers on save, Team-card gating, per-role action bars, notify-clash |
| `src/features/job-detail/NewJobShell.tsx` | sales picks insert as suggestions; grid + notify-clash wiring |
| `src/features/job-detail/AttachmentBuckets.tsx` | `userId` prop (FK fix) + per-step upload errors |
| `src/app/api/jobs/[id]/suggest-installer/route.ts` | **new** — sales toggles a suggestion |
| `src/app/api/jobs/[id]/assign-installers/route.ts` | **new** — formal assignment, clears suggestions, notifies |
| `src/app/api/jobs/[id]/notify-clash/route.ts` | **new** — holds job pending, flags schedulers |
| `src/app/api/jobs/[id]/clashes/route.ts` | hard vs soft (floater) clash split |
| `src/features/approvals/ClashResolutionModal.tsx` | soft heads-up banner + Notify Scheduler / Push Anyways |
| `src/lib/supabase/queries/{jobs,installer,notifications}.ts` | suggestion stripping; installer sales-POC fetched separately |
| `src/lib/telegram/templates.ts` | +`tplInstallerAssigned`, +`tplClashNeedsReview` |
| `src/lib/utils/role-override.ts`, `src/components/UserMenu.tsx` | preview-as all 6 roles |
| `src/app/jobs/new/page.tsx` | effective role (suggestion bug) |
| `src/components/BottomNav.tsx` | FCFS removed from installer nav |
| `docs/workflow-v2-phase2-smoke-test.md` | **new** — tick-through checklist with Nic's results |
