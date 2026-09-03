---
session: feat-workflow-v3 (Workflow V3 round 1 — project containers)
date: 2026-09-02
branch: feat-workflow-v3 (NOT merged — Nic's rule: one clean-cut merge only when V3 is fully built; worktree kept at ../greenqubes-ops-workflow-v3)
---

# Workflow V3 round 1 — project containers built, smoke cleared, merge deferred

> From Nic's "bulk job order" idea (15–150 near-identical store jobs per
> campaign) through five mockup rounds to a settled model: a **project is a
> container with labels — nothing is copied**. Jobs stay ordinary jobs; the
> container groups them. Round 1 built the container itself; rounds 2
> (schedule folding) and 3 (month calendar) remain before any merge.

## 1 — What was built (14 tasks, subagent-driven)

- **Migration 0051** (applied by Nic from the worktree): `job_projects`
  (name, client, description, project timing, nullable default punctuality,
  r2_folder) + `jobs.project_id` (SET NULL — a project delete can never
  delete a job) + `jobs.time_inherited` + project-owned buckets/files with
  one-owner CHECKs and office-role RLS.
- **Three pure helpers with standalone suites** (19 suites now, all green):
  timing inheritance (`timingOnNest` / prev-state-aware `timingOnJobTimeEdit`
  / `timingOnUnnest`), date-range merging (`15/9/26 – 19/9/26, 23/9/26`),
  picker keyword extraction/scoring.
- **Five routes**: create (default buckets + slug folder + nest loop), PATCH
  (label save + timing fan-out to `time_inherited` jobs only), DELETE
  (un-nests, never deletes jobs), nest/un-nest (idempotent, 409 cross-project),
  bulk push (atomic `.eq('status','pending')` transition, sales own-only,
  coordinator shared-only, ONE `tplProjectPushed` Telegram to schedulers).
- **UI**: the **Multiple jobs** switch turns New Job into New Project
  (Team/Chat struck out); `ProjectFormShell` (new/edit, read-only for
  designer/production, `modeSwitch` slot so chrome renders once);
  `AddJobPicker` bottom sheet (keyword chips, sanitised free-text search,
  pending-is-personal filter); new-job-in-project prefill; project Files via
  `AttachmentBuckets` project mode (R2 `projects/` prefix; download route
  covered); `/projects` list + Projects button; assistant folders renamed
  **Workspaces** (en/zh values only — `asst_projects` internals unchanged).

## 2 — Review machinery results

Fresh implementer + reviewer per task, scoped re-review per fix round, then
a whole-branch final review on the strongest model. ~12 real defects fixed
before Nic tested. Final review's criticals: **project files uploaded but
could never be opened** (download-url only knew job files) and **any routine
save of a nested job silently severed timing inheritance** (form initialises
times non-empty; fixed with the helper's `prev` parameter + 3 new checks).
Also fixed: the same missed-helper bug on NewJobShell's clash path, unchecked
primary writes in three routes, and an editable-but-403 project UI for
designer/production.

## 3 — Nic's smoke round — CLEARED, 5 fixes same day

1. Project **autosaves** before "+ New job in this project" (edits were lost).
2. *(Round-2 expectation logged, not a bug: folders don't fold on the schedule yet.)*
3. **Amber notice** on new-job-in-project explaining pending-in-folder vs
   push-through — shown only while the project has nothing scheduled.
4. Project push **reuses the job form's ClashResolutionModal** per clashing
   job (Nic was soft-locked with hold-only) — clean + resolved jobs still
   push in ONE route call → one scheduler Telegram; modal time shifts go
   through `timingOnJobTimeEdit`.
5. **"(Untitled X)" title guard** for empty-after-prefix titles.

Plus the ruling Nic corrected: **a pending job is shared between its sales
person and the coordinators assigned on it via `job_coordinators`** —
coordinators see/push only those (push route + picker filter; round 2's
Pending chip follows the same rule).

## 4 — Facts worth keeping

- **Merge rule (Nic): nothing merges until V3 is fully built** — rounds 2+3,
  full smoke, then `feat-workflow-v3` → `dev` → preview check → `main`.
- 0051 must be pushed **from the worktree** — the main folder's `dev` has no
  migration file until the merge ("Remote database is up to date" from the
  main folder is the tell, not an error).
- Worktree sessions: the harness refuses compound Bash near git — plain
  single commands, or a script file.
- `queries/projects.ts` mixes the server client (`next/headers`) — browser
  consumers import from `projects-search.ts`; value-importing the mixed
  module into a client component breaks the build only once it's wired in.
- Round-2 carry-overs (from review triage): bucket INSERT/UPDATE RLS role
  predicates (now also covers project buckets), pending-privacy RLS + chip +
  two-login leak test, zh literals on the new screens, picker tie-break
  newest-first, shared Telegram HTML-escape helper, duplicate-project row on
  a retried failed create, dead `getProjectBucketsQ`/`updateJobFields` exports.
- Artifacts: approved mockup (5 rounds) `public/mockups/workflow-v3-nesting/`
  + https://claude.ai/code/artifact/bdada306-4947-4c1e-931f-4167f3928ba0 ;
  round-1 tickable smoke checklist
  https://claude.ai/code/artifact/91a9f0e5-a9f2-4b3f-9d01-9d83ae187246 .

## ⚠️ Next session — round 2

Write the round-2 plan from spec §6/§8-adjacent scope: schedule folding
(green-ring folder headers, split punctuality stripe, date ranges, "x / N
done"), completed-in-day veil for ALL jobs, All/Scheduled/Pending/Completed
chips replacing the Pending + Completed tabs (routes redirect), pending-
privacy enforced at the DB layer with the two-login leak test, sort & filter
dropdown, "Day 1 / 3" labels. Build on `feat-workflow-v3` in the kept
worktree, same subagent-driven process. Round 3 (Notion month view) after.
