# chore-git-cleanup — Git Branch Cleanup

_Session date: 2026-05-20_

---

## What was done

Cleaned up the git branch state after several sessions had left `main`, `dev`, and `feat-job-form-redesign` out of sync.

---

## Branch state before

- `main` — most up to date; had all recent work (feat-jobs, feat-notifications-2, etc.) but was missing 3 fix-assistant code patches that were sitting on `dev`
- `dev` — 5 commits ahead of its diverge point from `main`; missing all the newer `main` work
- `feat-job-form-redesign` — fully contained in `main` (0 unique commits); stale

## What was done

1. **Merged `dev` into `main`** — picked up the 3 fix-assistant code patches (`AssistantShell.tsx`, `HistorySidebar.tsx`, `save/route.ts`, `queries/assistant.ts`) and 2 doc commits; resolved conflicts in `docs/plan.md` and `docs/nic-checklist.md` (kept `main`'s newer content)
2. **Reset `dev` to `main`** — force-pushed so both branches point to the same commit
3. **Deleted `feat-job-form-redesign`** — locally and from remote; all its work was already in `main`

## State after

`main`, `dev`, and `origin` all at the same commit. Only two branches remain: `main` (production) and `dev` (working branch).
