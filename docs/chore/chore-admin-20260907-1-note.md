# chore-admin — HR / Finance Role + Leave Tracking: Design + Plan

**Date:** 2026-09-04 (brainstorm + spec + plan) → 2026-09-07 (corrections, session close)
**Branch:** `feat-hr-leave` (worktree `c:\Greenqubes_GitHub\greenqubes-ops-hr-leave`)
**Outcome:** design spec + 14-task implementation plan committed. **No code written, no migration applied, nothing deployed.**

---

## What this session produced

| Artefact | Path |
|---|---|
| Design spec | [superpowers/specs/2026-09-04-hr-leave-design.md](../superpowers/specs/2026-09-04-hr-leave-design.md) |
| Implementation plan (14 tasks) | [superpowers/plans/2026-09-04-hr-leave.md](../superpowers/plans/2026-09-04-hr-leave.md) |

Nothing else. The branch contains documents only — no `.sql`, no `.ts`, no UI.

---

## The ask

Nic: *"I need a new role called HR. My HR needs to input who's on leave on schedule from when to when and should be visible across for everyone."* Later in the session: *"our hr is also finance role so she should be able to see all prices as well."*

That is an **explicit request for an eighth role**, which is exactly what the CLAUDE.md hard rule requires before one can be added. `docs/context.md`'s "don't add an eighth role" line was amended to record the approval (and re-pointed at a ninth).

---

## Decisions (Nic, 2026-09-04)

1. **Leave is a hard red clash**, not a soft warning — same weight as a double-booking, surfaced in the clash modal / FCFS / edit checks. (He was offered warn-but-allow as the recommendation and overrode it.)
2. **Whole team**, not just installers — every internal user, any role. External contacts excluded.
3. **Visible on** schedule views, installer pickers + FCFS, plus bell/Telegram when leave is recorded. He explicitly did **not** want a separate everyone-facing leave calendar page.
4. **HR-only `/leave` tab** for input and management (HR + admin).
5. **HR access:** schedule view-only + read-only job form + assistant, **plus visibility of all prices** (view only — sales still enters them).
6. **Full days + AM/PM half days** at either end of a range.
7. **Type + note (annual / medical / emergency / other) are HR-and-admin-only**, enforced in the database — everyone else sees only "On leave". His reasoning accepted the point that medical leave especially must not broadcast.
8. Build approach: put the leave rule in **one place** rather than copying it per screen.
9. **Singapore public holidays in scope** — label-only (no scheduling warning, because the team does work holidays), maintained yearly by HR in our own table. No external service; stack stays locked.
10. **Schedule visibility built now**, not deferred behind Workflow V3's schedule rebuild. This aged well — V3 was cancelled on 2026-09-04, making the work permanent rather than a stopgap.
11. **Deferred by his instruction:** leave balances, entitlement counting, self-service leave requests.

---

## What the codebase exploration changed

Four read-only agents ran in parallel before the plan was written (role plumbing / clash engine + consumers / schedule views + pickers / notifications + migrations + tests). Their findings **corrected the approved spec twice** and pre-empted several bugs:

**1. There is no single clash engine.** The spec's approach ("teach the one clash engine about leave") was built on a false premise. Reality:

| Site | `timesOverlap` source | Payload type |
|---|---|---|
| `src/lib/utils/clash-detection.ts` | canonical | `InstallerClash` |
| `src/app/api/jobs/[id]/clashes/route.ts:67-77` | **inline copy** | `Clash` |
| `src/features/approvals/ClashResolutionModal.tsx:51-63` | **inline copy** | — |
| `src/app/api/jobs/[id]/assign-installers/route.ts` | imports canonical, re-derives severity inline | `CheckClash` |
| `src/lib/supabase/queries/assistant-tools.ts` | imports canonical | own shape |

Four near-copies, three incompatible payload shapes, nothing converting between them. Worse, all three clash types **require two jobs** (`jobA`/`jobB`, or `conflictingJob`), and consumers filter on `c.jobA.id === job.id || c.jobB.id === job.id` — a leave conflict has one job and one absence, so it cannot be expressed inside them.

**Resolution in the plan:** a new pure `src/lib/utils/leave-overlap.ts` owns all leave math, and leave rides **alongside** each surface's existing payload as a new `leaveClashes` field. Two API routes (`clashes` GET, `assign-installers?checkOnly`) plus the FCFS board and the assistant tool cover every surface between them.

**2. The role enum needs its own migration.** Postgres cannot use an enum value in the transaction that adds it — the repo already learned this (0018→0019 for `admin`, 0033→0034 for the V2 roles). The spec's "one migration" became two.

**3. Migration numbering slipped twice more.** Pencilled in as 0053; `0053_installer_completed_visibility.sql` took it days later. Now **0054 + 0055**, and the plan instructs the next session to re-check the live DB first. **Third consecutive cross-branch collision** (0051 by unmerged V3, 0052 renumbered by feat-provision, now this) — the trap is that unmerged branches can already have applied a number, and `db push` skips duplicates silently.

**4. Bugs pre-empted, not discovered later:**
- `getEffectiveRole` **never returns `'admin'`** (a plain admin resolves to `'scheduler'`), so every HR/admin gate must test the **real** role — otherwise the Leave tab would 403 for Nic himself.
- `getAllProvisionedUsers` (coordinators.ts:77) and `getSupportUsers` (jobs.ts:313) exclude only `installer`, so HR would silently have appeared as a **Person-in-Charge and support-crew candidate**.
- `user_leaves` carries **two FKs to `users`** (`user_id`, `created_by`) — embedding `users` onto it would hit PGRST201, the mistake this repo has made twice.
- The prices card (`FinancialSection.tsx`) is **dead code**, removed from the job form in session 17.6. "HR sees prices" therefore means reviving that card read-only for `hr` alone, not merely widening a permission — a materially different task than the spec implied.
- Adding `'hr'` to the `Role` union **breaks the build** in two exhaustive maps (`NAV_TABS`, `Pill`'s style/label records). That's a safety net, and the plan sequences it deliberately: widen the type, run type-check, fix what it flags.

---

## Design summary (as planned)

**Data:** `user_leaves` (person + dates + AM/PM portions; readable by all authenticated users, writable by hr/admin) · `user_leave_details` (type + note; **all operations hr/admin only** — the privacy split lives in RLS, not the UI, so no screen can leak it) · `public_holidays` (SG list, seeded 2026, all-read / hr-write). Both leave tables join the realtime publication.

**Half-day semantics:** `start_portion='pm'` means the first day is afternoon-only; `end_portion='am'` means the last day is morning-only; a single-day half is `date_start = date_end`. The AM/PM boundary is **12:00**, matching the FCFS board's existing zoom split (`RANGES`, FCFSShell.tsx:27-34). The pass-case that defines correctness: **AM leave + a 14:00 job = no flag anywhere.**

**Surfaces:** push-flow clash modal · edit-flow `EditClashModal` · FCFS bars (`'leave'` variant, red like a hard clash) + chips + drawer + assignment panel · installer grid + support-crew bucket badges · schedule list/week/month/date-strip markers · assistant `check_clashes` (reports leave, never the type).

**Notifications:** bell to schedulers on every entry; **bell + Telegram** to scheduler + POC + coordinators when leave lands on a job the person is formally assigned to. Type never appears. Deletes/shortenings are quiet (the revert-completed-job precedent).

**Deliberate divergence:** leave applies to **sub-installers / support crew**, unlike booking clashes which exclude them at five sites. A person on leave is away regardless of their role on the job.

---

## Session mechanics

- Session start ran with the AI-importance-tagger question and the `dev-bryan` check **skipped** on Nic's instruction.
- The V3 worktree (`greenqubes-ops-workflow-v3`) was this session's working directory. Nic asked whether an agent was inside it; it was this one. State was verified before removal — clean tree, everything pushed, stashes live in the shared repo — and he removed it mid-session. `feat-workflow-v3` is untouched on GitHub.
- Execution was offered subagent-driven or inline; Nic chose **inline**, then said **"do not start"** before Task 1. Nothing was implemented.
- On 2026-09-07 the branch was **merged up to current `dev`** (installer completion flow, mobile viewport fixes, `sin1` region, loading skeletons, V3 cancellation) so every file/line reference in the plan points at live code, and all cancelled-V3 coordination was stripped from both documents.

---

## Next action

**Task 1 of the plan** — migrations 0054 + 0055 and the table types — after re-checking the live DB for the next free migration number. Nothing is blocked on Nic first; his approvals come at the `db push` step and the preview smoke test.
