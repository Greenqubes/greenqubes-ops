# Session Note — chore-onboarding — 2026-05-25

**Branch:** dev  
**Session type:** Chore — developer onboarding + workflow configuration  
**Status:** Complete

---

## What was built

### Bryan's onboarding folder — `docs-bryan/`

New dedicated folder for all Bryan-specific files. Three files created and moved here:

- `docs-bryan/assistant-onboarding.md` — step-by-step setup guide (Node, Git, VS Code, GitHub, clone, .env.local, npm install, run app, branch setup, Claude Code install, skills install)
- `docs-bryan/bryan-checklist.md` — Bryan's personal task tracker with onboarding setup ticks, active tasks, waiting for review, and completed sections
- `docs-bryan/CLAUDE-bryan.md` — Bryan's Claude Code instructions file

---

### `dev-bryan` branch

Created off `dev` and pushed to remote. Bryan's dedicated working branch — he never touches `dev` or `main` directly. Merge flow: Bryan pushes to `dev-bryan` → Nic reviews and merges to `dev` → Nic merges `dev` to `main`.

---

### CLAUDE.md updates (Nic's)

**Session start:**
- Step 1: auto-pulls latest `dev`
- Step 2: checks `dev-bryan` for unmerged commits; diffs changed files against `dev`; auto-merges if no clashes; flags conflicts and asks Nic if clashes found

**Session end:**
- `plan.md` items tagged `[Nic]`
- `bryan-checklist.md` updated with Bryan's confirmed completions tagged `[Bryan]`; Bryan's unfinished items read silently — never surfaced to Nic

---

### CLAUDE-bryan.md updates (Bryan's)

**Session start:** auto-pulls latest `dev-bryan`

**Session end:**
- Auto-commits and pushes to `dev-bryan`
- Updates `docs/plan.md` with `[Bryan]` tag on completed items
- Updates `docs/context.md` "Last updated" line
- Updates `docs-bryan/bryan-checklist.md`
- Updates `docs/nic-checklist.md` for any overlapping completed items tagged `[Bryan]`; Nic's unfinished items read silently — never surfaced to Bryan

**Branch rules:**
- "push to dev" always means `dev-bryan`
- Pushing to `main` fully disabled
- Merging is Nic's job only

---

### Skills added to onboarding (Step 12)

Bryan's onboarding guide includes instructions to install two Claude Code marketplace skills:
- **Superpowers** — structured planning and debugging workflows
- **UI/UX Pro Max** — design system for the project's UI work

Both added as tick items in `bryan-checklist.md`.

---

## Key decisions

- `docs-bryan/` keeps Bryan's personal files completely separate from `docs/` — no risk of Nic accidentally reading stale Bryan-only content
- Shared files (`plan.md`, `context.md`, `nic-checklist.md`) stay in `docs/` — both Claude instances read and write them with name tagging
- Auto-merge on session start (Nic's side) keeps `dev` up to date without manual steps, but only when safe (no file clashes)
- Neither Claude nags the other person about their unfinished work

---

## What's next

- Nic: add Bryan as GitHub collaborator, send `.env.local`, add Bryan's Google account to Supabase
- Bryan: complete onboarding checklist in `docs-bryan/bryan-checklist.md`
- Assign Bryan his first active task once onboarding is confirmed done
