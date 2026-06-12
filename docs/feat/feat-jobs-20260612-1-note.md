---
session: feat-jobs (Workflow V2 — Phase 1 implementation)
date: 2026-06-12
branch: feat-workflow-v2 (all code) — session docs mirrored to dev
---

# Workflow V2 Phase 1 — Roles + Approval Removal + Live Hotfixes

> **HANDOVER NOTE — next session continues a smoke test in progress.**
> Nic is mid-way through testing Phase 1 on the Vercel preview (from another device).
> Read "Smoke test status" and "Critical context for the next agent" below before doing anything.

## What was done

### Phase 1 of the Workflow V2 plan — fully implemented

Master plan: `docs/superpowers/plans/2026-06-05-workflow-v2.md` (Tasks 1–8 all ticked, with an
implementation-notes block added under the PHASE 1 heading listing every deviation).

1. **Migrations 0033 + 0034** — `designer` / `coordinator` / `production` added to `user_role` enum;
   `is_suggestion`, `suggested_by`, `is_sub_installer` columns on `job_assignees`; RLS widened so all
   office roles can read jobs/assignees/coordinators and coordinator can insert/delete assignees.
   Split into two files because new enum values can't be used in the same transaction (0018/0019 precedent).
2. **Role routing** — `src/app/page.tsx` (NOT the auth callback — plan was wrong) routes
   designer/coordinator/production → `/schedule`.
3. **Admin dropdown** — all 7 roles in `UsersTab.tsx` `ROLES` array; Pill.tsx got styles/labels for the 3 new roles.
4. **Approval workflow removed (API)** — deleted `approve` + `send-back` routes; `submit` route now sets
   `status='scheduled'` directly and sends `tplNewJobCreated` ("📋 New Job — Assign Installer") to all
   active schedulers with a Telegram ID. Orphaned templates (submitted-for-approval/approved/sent-back) deleted.
5. **Approval workflow removed (UI)** — deleted `ApprovalCard`, `SendBackModal`, **and `ApprovalsShell`**
   (plan said keep the shell, but it imported the deleted pieces — build broke). `JobDetailShell`: sales
   pending bar = "Save Changes" + **"Push to Schedule"**; Recall + awaiting_approval lock + scheduler
   Send-Back/Approve bars all removed. `NewJobShell`: inserts as `pending`, push calls submit route.
   `queries/approvals.ts` + approval i18n strings left as dead code — clean up in Phase 3.
6. **BottomNav** — FCFS tab for **every role** (Nic's standing decision — overrides the plan's
   scheduler/coordinator-only text); Approvals tab removed. `/fcfs` 404s until Phase 3 — expected.
7. **`/approvals`** → plain `redirect('/schedule')`.

### Three live bugs found during Nic's smoke test, all fixed

| # | Symptom | Root cause | Fix |
|---|---|---|---|
| 1 | **/schedule crashed on ALL deployments** (incl. production) | 0033's `suggested_by` FK gave `job_assignees` TWO FKs to `users` → PostgREST **PGRST201** "ambiguous embed" on every `job_assignees ( users (...) )` query | **Migration 0035** drops the FK (column kept, app-level validation). ⚠️ NEVER re-add a second FK from job_assignees to users unless every embed is first rewritten as `users!job_assignees_user_id_fkey (...)` |
| 2 | Push to Schedule → "Save failed", job stuck pending | (a) RLS policy "jobs: sales can update own pending jobs" had no WITH CHECK, so the USING clause blocked the pending→**scheduled** transition; (b) submit + clashes routes were sales-only → 403 for Nic (admin) | **Migration 0036** splits USING/WITH CHECK (sales may set own pending job to scheduled); both routes now allow `sales / scheduler / admin` |
| 3 | No "Pushed to Schedule!" popup from the **new job** form | Popup only ever existed on the edit form; new-job form silently routed to the edit page, and ignored submit failures | NewJobShell now shows the same success modal (OK → /schedule) and surfaces a failed push with the error toast + lands on the edit form for retry |

### Docs mystery from session start — resolved
The "missing" plan.md/checklist updates from the 6/05 + 6/11 sessions had been committed to
`feat-workflow-v2` instead of `dev`. Merging dev into the branch reunited everything. Session-end docs
are now mirrored to both branches to prevent a repeat.

## Smoke test status (Nic's checklist — CONTINUE FROM HERE)

- [x] **Section 1 — sign-in & nav**: v2 preview loads, new BottomNav confirmed (initial confusion: Nic was
  on the dev URL, where the old nav is correct/expected)
- [x] **Section 2 — push flow**: job pushed to scheduled ✓, popup ✓ (after fix), Telegram fired ✓
  (verified in `api_usage_logs` — 4 sendMessage calls during the test window, delivered to **Benny Teo**,
  the only scheduler-role user with a Telegram ID)
- [ ] **Section 3 — clash detection**: same installer, same date, overlapping time → clash modal should
  appear before push (route now allows admin, untested since)
- [ ] **Section 4 — new roles**: 7 roles in Admin → Users dropdown; optionally sign a test account in as
  coordinator/designer → lands on /schedule
- [ ] **Section 5 — regression**: dev preview (greenqubes-ops.vercel.app) still works (informally confirmed
  after hotfix 0035 — worth one more look); job chat works on v2 preview; installer sign-in → My Jobs

## Critical context for the next agent

- **All Phase 1 code is on `feat-workflow-v2`** — branch pushed, Vercel preview at the deployment URL
  containing `git-feat-workflow-v2` (find via Vercel dashboard → greenqubes-ops → Deployments).
  Merge path when Nic green-lights: feat-workflow-v2 → dev → confirm → main.
- **The Supabase DB is shared by ALL deployments** (prod/dev/v2). Migrations 0033–0036 are applied and live.
  Any future migration must stay backward-compatible with the deployed dev/main code (bug #1 above is the
  cautionary tale).
- **"Test Job"** created by Nic during testing is now `scheduled` — delete or ignore.
- **Installer Telegram on push = expected absence.** Push notifies schedulers only. Installer notification
  fires on formal assignment — existing path: scheduler adds installer to a scheduled job + saves
  (`notify-assigned` route). The full suggestion→assignment flow is **Phase 2 (Tasks 12–13)**.
- To let Nic see push notifications himself: paste his Telegram chat ID into scheduler **Wei Qing's** row
  (Admin → Users) — and remove it before go-live. (Not done yet — Nic may ask.)
- Nic signs in as **admin**; for faithful sales-flow tests use the role switcher (UserMenu).
- `vault` submodule shows modified in `git status` — untouched by this session, leave it.

## Next session

1. Finish smoke test sections 3–5 (above); fix whatever it surfaces on `feat-workflow-v2`.
2. Then **Phase 2** (Tasks 9–15): role-locked job form sections, production photos upload,
   installer suggestion UI (yellow) vs formal assignment (green), chat for all roles, per-role action bars.
   ⚠️ Phase 2 touches `suggested_by` — re-read the PGRST201 warning in the plan's Phase 1 notes first.

## Key files changed

| File | Change |
|---|---|
| `supabase/migrations/0033…0036` | roles enum, columns, RLS widening, FK hotfix, push RLS fix |
| `src/lib/supabase/types.ts` | Role union (7), job_assignees Row/Insert columns |
| `src/app/page.tsx` | new roles → /schedule |
| `src/features/admin/UsersTab.tsx` | 7-role dropdown |
| `src/components/BottomNav.tsx` | FCFS for all roles, Approvals removed |
| `src/components/Pill.tsx` | styles/labels for 3 new roles |
| `src/app/api/jobs/[id]/submit/route.ts` | direct-to-scheduled + tplNewJobCreated + role gate |
| `src/app/api/jobs/[id]/clashes/route.ts` | role gate sales/scheduler/admin |
| `src/lib/telegram/templates.ts` | +tplNewJobCreated, −3 orphaned templates |
| `src/features/job-detail/JobDetailShell.tsx` | Push to Schedule bar, approval UI removed |
| `src/features/job-detail/NewJobShell.tsx` | pending insert + push mode + success modal |
| `src/app/approvals/page.tsx` | redirect to /schedule |
| deleted | approve + send-back routes; ApprovalCard, SendBackModal, ApprovalsShell |
