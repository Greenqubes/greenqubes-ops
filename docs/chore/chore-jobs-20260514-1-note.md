# chore-jobs — Session Note
_2026-05-14_

---

## What was done

Short session. Resolved leftover git rebase conflict from previous session, opened a PR to merge dev into main, and designed the bulk delete feature (brainstorm only — no code written).

---

## Git rebase resolved

Previous session ended mid-rebase. Conflicts in `docs/plan.md`, `docs/nic-checklist.md`, and `docs/CONTEXT.md` were resolved:
- Kept remote (feat-design) Last updated lines in all three files
- Inserted `fix-prealphabugs` row in the correct chronological position in `docs/plan.md`
- Removed `.git/rebase-merge/` manually after git's `--continue` loop failed (no-op editor workaround)
- `docs/CONTEXT.md` came out of stash pop with a conflict — resolved, stash dropped
- Pushed: `c2c1ef1` → `origin/dev`

---

## PR opened: dev → main

Type-check (`npm run type-check`) passed after running `npm install` (next-themes was in package.json but not installed locally).

PR created at: `https://github.com/Greenqubes/greenqubes-ops/compare/main...dev`

Title: `feat: admin role, AI suggest, dark mode, pre-alpha hotfixes`

Covers: admin role (migrations 0018–0020), AI suggest button (SuggestField + /api/ai/suggest), dark mode (next-themes, Claude Warm palette), pre-alpha hotfixes (R2 CORS, overdue cron, voice mic, attachment notifications, optional fields, form reset).

---

## Bulk delete — design decided

Feature: allow scheduler and sales to select multiple jobs and hard-delete them from the DB.

**Design A chosen** — always-on checkboxes:
- Checkboxes are always visible on every job row in list view (no mode toggle needed)
- Ticking any checkbox reveals a delete bar at the bottom of the page showing count + red Delete button
- Applies to **list view only** (week and month views unchanged)

**Schedule page (scheduler role):**
- Shows scheduled jobs only
- All visible jobs can be selected and deleted

**Pending tab (sales role):**
- Shows pending + awaiting_approval jobs
- Sales can delete **both** statuses

**Still to design next session:**
- Confirmation modal (wording, single vs multi)
- API route (`DELETE /api/jobs` bulk or per-ID)
- What happens to related data (messages, files, assignees) on delete — cascade or explicit cleanup

---

## What's next

- Finish brainstorm → write spec → write plan → implement bulk delete
- Merge PR on GitHub (manual step for Nic)
