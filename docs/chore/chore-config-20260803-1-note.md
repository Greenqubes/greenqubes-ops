---
session: chore-config (Workflow V2 — clean-cut switchover)
date: 2026-08-03
branch: dev + main (merged from feat-workflow-v2)
---

# Workflow V2 Clean-Cut Switchover — DONE

> V2 is **live on production**. `feat-workflow-v2` (Phases 1–4, 53 commits) was merged
> `feat-workflow-v2` → `dev` → `main` in one shot after Nic confirmed the full V2 regression
> test passed on the preview. No code was written this session — this was the merge, its
> verification, and the doc updates.

## What was done

1. **Session start per CLAUDE.md** — dev pulled (up to date), nothing to merge from `dev-bryan`,
   docs read from both `dev` and the branch (branch versions were the fresh ones). Nic confirmed:
   regression test **passed**, merge path **branch → dev → main**, no tagger scoring changes.
2. **Merge `feat-workflow-v2` → `dev`** (`45a5112`, --no-ff). Three doc files conflicted
   (`docs/CONTEXT.md`, `docs/plan.md`, `docs/nic-checklist.md`) because dev carried a June
   "mirror" snapshot of them (`6d00995`); resolved by taking the branch's newer versions.
3. **Verification on the merged tree** — `npm run type-check` clean; `npm run build` clean
   (46 routes incl. the new `/ext/[token]`, `/fcfs`, and all external/task API routes);
   `git diff feat-workflow-v2 dev` **empty** — the merged tree is byte-identical to the
   regression-tested branch. Pushed dev.
4. **Merge `dev` → `main`** (`2c19dd0`, --no-ff, no conflicts) — main's tree also verified
   byte-identical to the branch. Pushed main.
5. **Production verified live on V2** — polled `greenqubes-ops.vercel.app`: `/ext/<invalid-token>`
   flipped 404 → 200 (the V2 "link no longer valid" screen) about a minute after the push;
   `/fcfs` and `/approvals` no longer 404; login/schedule resolve normally.
6. **Docs updated** — plan.md (Current State + session row), CONTEXT.md (switchover checkbox +
   clean-cut paragraph marked executed), nic-checklist.md (regression/switchover items ticked),
   CLAUDE.md (`feat-workflow-v2` added to the kept-for-record branches line).

## Verification summary

| Check | Result |
|---|---|
| `dev` tree vs regression-tested branch | byte-identical (`git diff` empty) |
| `main` tree vs regression-tested branch | byte-identical (`git diff` empty) |
| `npm run type-check` on merged tree | clean |
| `npm run build` on merged tree | clean, 46 routes |
| Production `/ext/<invalid-token>` | 404 (old) → 200 (V2 live) |
| Production `/fcfs`, `/approvals`, `/login`, `/schedule` | all resolve, no 404s |

No database work — migrations 0001–0040 were already applied to the shared remote DB before
this session.

## Key decisions

- **`feat-workflow-v2` is KEPT for historical record** (Nic) — do not push new changes to it.
  Recorded in CLAUDE.md next to `feat-job-form-redesign`.
- **Normal deployment workflow resumes** — the clean-cut exception is over; everything goes
  `dev` first → preview → `main` from now on.
- Dev-preview content couldn't be probed anonymously (Vercel SSO deployment protection on
  preview URLs); the byte-identical-tree + local-build evidence stood in. Production has no
  such protection, so the V2 flip was verified there directly.

## ⚠️ Notes for next session

- **Next milestone: Session 19 — pre-alpha testing on V2** (versioning starts V.0.0.0.1).
- A Vercel CLI device login mid-session landed on a personal account (`nicholaswong-7832`)
  that does NOT own this project — the CLI is signed into the wrong account. Harmless (nothing
  was changed), but `vercel` CLI commands won't see greenqubes-ops until Nic logs it into the
  right account. The repo's `.vercel/` link file was left untouched.
- Pre-go-live cleanup still pending on the checklist: wipe test jobs, test external contacts,
  test installer account; remove Nic's Telegram ID from Wei Qing's row.
- The hydration #418 known issue on `/schedule` remains off-limits without a new hypothesis.

## Key files

| File | Change |
|---|---|
| (merge) `45a5112` | feat-workflow-v2 → dev |
| (merge) `2c19dd0` | dev → main — V2 live on production |
| `docs/plan.md` | Current State rewrite + chore-config session row |
| `docs/CONTEXT.md` | switchover checkbox ticked, clean-cut marked executed |
| `docs/nic-checklist.md` | regression + switchover items ticked `[Nic]` |
| `CLAUDE.md` | feat-workflow-v2 added to kept-for-record branches |
