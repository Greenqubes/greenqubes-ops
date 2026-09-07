---
session: chore-config (Workflow V3 branch killed + session close)
date: 2026-09-07
branch: dev (001af52) — docs only; feat-workflow-v3 DELETED local + origin (was 5ea130b)
---

# Workflow V3 branch killed — cancellation closed out

> Follows the 2026-09-04 cancellation. Nic: "end session and kill this v3
> branch." That reverses the same-week decision to keep the branch forever as
> a V2-style archive, so round 1's code is **not** retained.

## 1 — What was deleted

`feat-workflow-v3`, from this machine **and** from GitHub (verified afterwards
with `git ls-remote --heads origin` → 0 matches). Tip was **`5ea130b`**;
`git diff dev...feat-workflow-v3 --stat` measured the loss at **39 files /
~3,725 insertions** — the whole round-1 container core plus the never-executed
round-2 plan.

Recovery window, if it is ever wanted: GitHub's deleted-branch grace period, or
a local reflog. **Neither is durable** — treat the code as gone.

## 2 — Pre-flight checks (the reason nothing broke)

- **Migration history:** `0051_job_projects.sql` was confirmed present on BOTH
  `dev` and `main` before deleting (it was copied across during the 2026-09-04
  renumbering). Deleting the branch therefore orphans nothing — 0052/0053 still
  sit on a chain whose every file exists on the main line.
- **The branch was checked out in this session's own worktree**, so it could not
  be deleted directly: `git checkout --detach` first, then `git branch -D`, then
  `git push origin --delete`. The worktree now sits on a detached `5ea130b`.
- Working tree was clean (0 uncommitted files) before detaching.

## 3 — DB consequence worth remembering

`job_projects` + `jobs.project_id` / `time_inherited` remain applied to the
shared DB, but **no code anywhere reads them any more** — the only reader lived
on the deleted branch. `job_projects` is a permanently empty table (its two
smoke-test rows were wiped 2026-09-04). The migration file must never be
renumbered or dropped: it is already applied and later migrations count on it.

## 4 — Also settled this session

- **Health tab: no work needed.** The 2026-09-03 fix (new Design cron row +
  correcting the overdue cron's stale "expected every 2h" expectation, which
  false-warned every afternoon) was found **already live on production** — it
  rode along in another session's go-live merge. Verified by reading
  `origin/main`'s route file and probing the endpoint (403 = guarded, serving),
  not assumed. An earlier claim in this session that it was still pending was
  wrong and was corrected to Nic.
- **`dev` → `main` sync** was pushed as `dev:main` (fast-forward) rather than
  switching branches, because another session had uncommitted work in the
  shared main folder. Docs-only delta; no behaviour change.
- **Smoke-test projects wiped 2026-09-04** (recorded here for continuity):
  dry-run-first one-off `.mts` with an id+name allowlist that aborts on any
  nested job; R2 object deleted before rows; verified 0/0/0 by an independent
  REST probe with all jobs untouched; script deleted after use.

## 5 — Docs squared

`CLAUDE.md` (branch rules + the V3 paragraph), `docs/plan.md` (headline,
migrations paragraph, sessions-table row), `docs/CONTEXT.md` (migration-plan
checkbox) and `docs/nic-checklist.md` (cancellation item, folder item, new
Done-This-Session block) all now read **deleted**, not archived — so no future
session hunts for a branch that no longer exists. Dated historical log lines
from 2026-09-02 were deliberately left intact; they were true when written.

Bryan's checklist has no V3 references — nothing to update.

## Facts worth keeping

- **The main folder is not reliably on `dev`.** It was on `main` at session
  start. Check `git rev-parse --abbrev-ref HEAD` before editing or merging.
  (Left on `dev` at session end, per the session-start convention.)
- **No Python on this PC** — `python` hits the Microsoft Store shim. Use
  `node` with a heredoc'd `.mjs` for scripted multi-file doc edits.
- A worktree cannot be removed from inside itself, and `git worktree remove` on
  Windows can fail on file locks — `git worktree prune` + manual delete
  finishes it.
- Four worktrees now exist (main, hr-leave, voice-pa, workflow-v3); parallel
  sessions are normal, so fetch and re-check before every push.

## ⚠️ Next session

- **Leftover:** the V3 folder `C:\Greenqubes_GitHub\greenqubes-ops-workflow-v3`
  is now a detached checkout of deleted commits — i.e. the last copy of that
  code on this machine. Safe to delete; cannot be deleted from inside a running
  session. The `feat-voice-pa` folder is in the same position (branch alive).
- Backlog unchanged: HR/Finance role + leave (designed, planned, not built —
  awaiting Nic's go); realtime agentic voice (needs Nic's stack unlock for a
  voice vendor); mobile app spec review; drop `users.years_experience`/`skills`;
  tour zh/bn corrections from the demo.
