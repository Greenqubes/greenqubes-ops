---
session: feat-jobs (Workflow V2 — Phase 3 FCFS Board + smoke test)
date: 2026-07-22
branch: feat-workflow-v2 (all code + docs)
---

# Workflow V2 Phase 3 — FCFS Board + Clash-on-Edit (PASSED)

> Phase 3 is **complete and fully smoke-tested** (all 6 sections green; Nic's feedback fixed and
> re-verified on the preview). **Phase 4** (external installer links, sub-installers, task list,
> external POC bucket) is next — the last phase before the clean-cut switchover.

## What was done

Tasks 16–19 of `docs/superpowers/plans/2026-06-05-workflow-v2.md`, plus migration 0038, one
production-relevant bug fix, and five smoke-test feedback fixes.

**The plan's Task 18 UI sketch (installer × weekday table) was outdated** — the board was built to
the **approved mockups** instead: `public/mockups/workflow-v2/fcfs-timeline-v2.html` (day-view
Gantt) + `installer-panel.html` (slide-in assignment panel). Both are tagged "Approved" in the
mockup index; the plan predates them in fidelity.

### FCFS Board (Tasks 16–18, redesigned to the mockup)

- **`/api/fcfs?date=`** + `getFCFSDay()` (`queries/fcfs.ts`): scheduled jobs for one day, ranked by
  `scheduled_at` (fallback `created_at` pre-0038). **Suggestions are kept** — the board shows them
  as amber bars. Suggester names fetched in a follow-up query (`suggested_by` has no FK since 0035).
  Every office role allowed; installer → 403 (page bounces them to `/installer`).
- **`clash-detection.ts`**: hard = strict+strict with **both start times fixed**; soft = one side
  flexible, or a strict pair where a job has no fixed time (same floater rule as the Phase 2
  push-time check); flexible+flexible = no clash. Suggestion-involved clashes are flagged, not
  painted. Sub-installers excluded (Phase 4).
- **`FCFSTimeline`**: job rows by rank, percentage-positioned installer bars, hour columns
  **flex-1** (fixed widths drifted on wide screens — smoke-test bug), 15-min gridlines, "All day"
  bars for floaters, "No installer yet" for unassigned jobs.
- **`FCFSShell`**: prev/next/Today day nav (SGT), AM / PM / AM-PM / 9am–6pm zoom persisted in
  localStorage, per-installer clash chips (scrollable when many), legend, realtime refresh on
  jobs/job_assignees + 2-min poll (same pattern as ScheduleShell).
- **`AssignmentPanel`**: tap a job → slide-in panel. Confirm/Remove suggestions, Add from roster,
  **Save & Notify** → clash checkOnly first, then the Phase 2 `assign-installers` route (clears
  suggestions, replaces formal set, Telegrams installer + sales POC + coordinators). View-only for
  sales / designer / production.
- **`ClashDrawer`**: side-by-side job cards, earlier rank marked "Created first (priority)" (bold,
  colour-coded), re-assign shortcut to the later job's panel, session-local Dismiss.
- `/approvals` now redirects to `/fcfs`. i18n added for all board strings (en/zh/bn).

### Clash check when editing a scheduled job (Task 19, extended)

The gap deferred since Phase 1. **Extended beyond the plan**: the plan covered coordinator-on-assign
only; per the checklist item's real scope it now fires for **scheduler + coordinator + admin**, on
**time/date/punctuality changes as well as installer changes**.

- `assign-installers?checkOnly=true` — reports clashes without saving; accepts **unsaved**
  date/time/punctuality overrides so the form checks its pending values before anything writes.
- `EditClashModal` (role-aware): coordinator → **Alert Scheduler & Save** (Telegram via
  `notify-clash`, which now allows coordinator) / **Re-assign a Different Installer**;
  scheduler/admin → **Save Anyway** / **Go Back**. A failed check never blocks a save.

### Migration 0038 (applied by Nic)

`jobs.scheduled_at` + trigger stamping **every transition into `scheduled`** (INSERT or UPDATE OF
status) — covers the V2 push route, status edits, and any old code still deployed on dev/main.
Backfill sets existing scheduled/completed jobs to `created_at` so their order didn't jump.
Re-pushing a recalled job takes a fresh slot at the back.

## Bugs found during testing — all fixed

| # | Symptom | Root cause | Fix |
|---|---|---|---|
| 1 | 9am–6pm view: bars ran off to the far right on full-width desktop | Bars positioned by % of row width but hour columns fixed 88px — the two disagree once the viewport is wider than the grid | Hour columns `flex-1 min-w-[88px]` in header + gridline layer (`01efaae`) |
| 2 | Clash drawer + assignment panel hidden behind the bottom nav | Overlays at `z-40`, BottomNav at `z-50` | All overlays (incl. shared `Modal`) → `z-[60]`; **new hard rule in CLAUDE.md** (`01efaae`) |
| 3 | Newly provisioned users missing from Person-in-Charge + Sub POC | Edit form queried `role='sales'` only; new-job form only sales/scheduler/admin — predates the 7-role model | Both forms share `getAllProvisionedUsers()`: every office role, never installers (`d4992f5`) |
| 4 | FCFS rank felt wrong (creation order) | Rank was `created_at` — but sales can't see each other's pending jobs, so that order is opaque | Migration 0038: rank by `scheduled_at` (push-to-schedule) (`277bf0d`) |
| 5 | Untimed jobs showed a blank where the time goes on the schedule tab | No fallback label | "All day" on JobRow, matching the board (`01efaae`) |

## Key decisions

- **Day view only** (Nic). The mockup's Week / Month / By Project / By Installer toggles are NOT
  built — they need designs first. Deferred item is on the checklist; don't render dead toggles.
- **FCFS rank counts from push-to-schedule**, not job creation (Nic). Confirming an installer never
  changes rank; re-pushing a recalled job does.
- **HARD RULE (in CLAUDE.md): overlays layer above the BottomNav** — nav is `z-50`, overlays
  `z-[60]`+. Nothing interactive may ever sit behind the nav.
- **Person-in-Charge + Sub POC/Coordinators list every office role** on both forms (Nic).
- **Board visible to every office role; installers excluded entirely** (nav, page, and API).

## ⚠️ Critical context for next session

- **Phase 4 is next** (external installer persistent links, sub-installer relationship, task list
  bucket, external POC bucket) — the remaining tasks of the V2 plan (Tasks 20+). After it: full V2
  regression test, then the one-shot switchover. **Clean-cut still stands** — nothing merges to
  `dev` until all of V2 is done.
- `is_sub_installer` exists on `job_assignees` since 0033 (always false today). The board and clash
  detection already exclude sub-installers — Phase 4 gives the column life.
- **0038's trigger stamps `scheduled_at` automatically** — new code paths that schedule jobs need
  no extra work; don't set the column manually.
- Standing rules that keep biting: **never embed `users` directly onto `jobs`** in PostgREST
  selects; **"preview as" changes the UI role only** — RLS behaviour needs a real non-admin login.
- Future-planning items Nic logged this session (in nic-checklist): schedule-tab list scroll UX,
  Android/iOS ports (directors' request), Windows/macOS desktop packaging, and a full security +
  integrity audit before go-live ("downtime = company stops").
- Test jobs/accounts from Phases 1–3 are still in the DB; Nic wipes them right before go-live.

## Key files

| File | Change |
|---|---|
| `supabase/migrations/0038_fcfs_scheduled_at.sql` | `scheduled_at` + stamp trigger + backfill |
| `src/lib/utils/clash-detection.ts` | **new** — punctuality grading + floater rules |
| `src/lib/supabase/queries/fcfs.ts` | **new** — `getFCFSDay`, rank by `scheduled_at` |
| `src/app/api/fcfs/route.ts` | **new** — day query, office roles only |
| `src/features/fcfs/FCFSShell.tsx` | **new** — toolbar, ranges, chips, legend, realtime |
| `src/features/fcfs/FCFSTimeline.tsx` | **new** — day Gantt, bar variants |
| `src/features/fcfs/AssignmentPanel.tsx` | **new** — slide-in assign/confirm panel |
| `src/features/fcfs/ClashDrawer.tsx` | **new** — clash bottom sheet |
| `src/features/job-detail/EditClashModal.tsx` | **new** — role-aware clash-on-edit prompt |
| `src/app/fcfs/page.tsx` | **new** — role gate + initial day fetch |
| `src/app/api/jobs/[id]/assign-installers/route.ts` | `?checkOnly=true` clash reporting |
| `src/app/api/jobs/[id]/notify-clash/route.ts` | coordinator allowed |
| `src/features/job-detail/JobDetailShell.tsx` | clash gate on Save & notify for scheduled jobs |
| `src/app/jobs/[id]/page.tsx`, `src/app/jobs/new/page.tsx` | dropdowns → all office roles |
| `src/components/Modal.tsx`, `src/features/schedule/JobRow.tsx` | z-[60] rule; "All day" label |
| `src/app/approvals/page.tsx` | redirect → `/fcfs` |
| `src/lib/i18n/{en,zh,bn}.ts` | `fcfs*` strings |
| `docs/workflow-v2-phase3-smoke-test.md` | **new** — Nic's tick-through, all green |
| `CLAUDE.md` | **new hard rule** — overlays above BottomNav |
