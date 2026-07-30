---
session: fix-jobs (Workflow V2 — Phase 1 smoke test fixes)
date: 2026-06-24
branch: feat-workflow-v2 (all code + docs)
---

# Workflow V2 Phase 1 — Smoke Test Fixes (PASSED)

> Phase 1 smoke test is now **fully passed** (all 5 sections). Phase 2 starts next session.
> Read "Critical context for next session" before touching the job form.

## What was done

Continued Nic's Phase 1 smoke test from the 2026-06-12 handover (sections 3–5 were
outstanding). All sections now pass; four issues surfaced and were fixed live on
`feat-workflow-v2`.

### Section results
- [x] **Section 1 — sign-in & nav** — passed earlier session
- [x] **Section 2 — push flow** — passed earlier session
- [x] **Section 3 — clash detection** — fixed (see #1 + #2 below), now passes
- [x] **Section 4 — new roles** — passed (7 roles in admin dropdown)
- [x] **Section 5 — regression** — fixed (see #3 + #4), now passes; old dev preview confirmed working

### Fixes (3 commits)

| # | Issue | Root cause | Fix | Commit |
|---|-------|-----------|-----|--------|
| 1 | **New Job screen never ran the clash check** — two jobs, same installer, overlapping time both pushed to schedule silently | `NewJobShell.saveJob('push_to_schedule')` called `/api/jobs/[id]/submit` directly; only the *edit* form (`JobDetailShell.handlePushToSchedule`) fetched `/clashes` first | New Job push now fetches `/clashes` after insert; pushes straight through if clear, else shows `ClashResolutionModal` and holds the push (job stays pending, nothing lost). Added `handleSendToScheduler` + modal wiring to `NewJobShell`. | `91ae2c9` |
| 2 | In the clash modal, **shifting the job time to a non-overlapping slot didn't clear the clash** — still "1 unresolved", button locked; "Send to scheduler" was stale wording | The modal only treated a clash as resolved via substitute/"keep anyway"; time pickers were ignored by `unresolvedCount`. Wording left over from the old approval flow. | Modal re-evaluates each clash live against the shifted time using the server's exact `timesOverlap` logic; a green "Resolved — new time no longer overlaps" note shows on the card and the button enables. Renamed button + keep-anyway popup to V2's "Push to Schedule". | `4907924` |
| 3 | **Chat photo attachments showed "Unknown" / "?"** sender on the live (realtime) message | Realtime `files` INSERT payloads carry only the row's own columns (no joined `users.name`); the files handler appended the raw row, unlike the messages handler which resolves the name | Files realtime handler now mirrors the messages one: own upload → name from props; else name cache; else async fetch + patch. (Only affected the live bubble — a refresh already showed the name from the server load.) | `09097e4` |
| 4 | **Installer "My Jobs" cards showed blank titles** — titled jobs looked empty | `InstallerJobCard` rendered only `job.client`, never `project_title`. The office schedule (`JobRow`) uses `project_title || client`. | Installer card now shows `project_title || client` as the heading, with client beneath when both exist; also hides the location row when empty (no orphan map-pin). | `09097e4` |

## Key decisions this session

- **CLEAN-CUT switchover (important).** Do NOT merge `feat-workflow-v2` into `dev` incrementally.
  Build all of V2 (Phases 1–4) on the branch, test fully, then replace the old workflow in one
  shot — no half-migrated state on dev/main. This overrides the older "feat-workflow-v2 → dev → main"
  incremental note. (Captured in plan.md, context.md, and memory.)
- **Clash-on-edit deferred to Phase 3.** Editing an already-scheduled job's time/installer to overlap
  another scheduled job runs NO clash check — "Save Changes" (`JobDetailShell.onSubmit`) never calls
  `/clashes`; the check only fires at push (pending→scheduled). This is the FCFS board's job
  (punctuality-aware hard/soft grading, Tasks 17–19). Nic chose to defer.
- **Push-time clash modal stays a plain overlap check** for now (not punctuality-aware). The hard/soft
  (strict+strict=hard, flex+strict=soft, flex+flex=none) grading lands in Phase 3 per the plan.

## Critical context for next session

- **Phase 2 next (Tasks 9–15):** role-locked job form sections, production photos upload, installer
  suggestion UI (yellow) vs formal assignment (green), chat for all roles, per-role action bars.
  ⚠️ **Phase 2 touches `suggested_by`** — re-read the PGRST201 warning in the plan's Phase 1 notes
  first: never add a second FK from `job_assignees` to `users` unless every embed is rewritten as
  `users!job_assignees_user_id_fkey (...)`. Migration 0035 dropped that FK precisely because it
  crashed every `job_assignees(users(...))` embed on all deployments.
- **All V2 work stays on `feat-workflow-v2`** (Vercel preview URL contains `git-feat-workflow-v2`).
- **Shared DB** — migrations 0033–0036 applied; any new migration must stay backward-compatible with
  the code deployed on dev/main.
- **Test jobs left in place** (e.g. "123", "test123smoke345", "Test Job"). Nic will wipe all test data
  right before go-live — leave them for now.

## Key files changed

| File | Change |
|---|---|
| `src/features/job-detail/NewJobShell.tsx` | clash check + ClashResolutionModal + handleSendToScheduler on push |
| `src/features/approvals/ClashResolutionModal.tsx` | time-shift resolves clash (live overlap re-eval); "Push to Schedule" wording |
| `src/features/job-detail/ChatSection.tsx` | realtime files handler resolves uploader name |
| `src/features/installer/InstallerJobCard.tsx` | heading = project_title \|\| client; client subtitle; guarded location |
