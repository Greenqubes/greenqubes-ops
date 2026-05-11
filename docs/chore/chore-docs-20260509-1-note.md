# chore-docs — Session Cleanup + Workflow Reset

_Written: 2026-05-09_

---

## What was done

Full docs cleanup and workflow reset. No code changes — all changes are to documentation and Claude session instructions.

---

## Changes

### Archived
- All pre-rebase session notes (35 files) moved to `docs/pre-rebase-notes/`
- `docs/backup-setup-complete.md` and `docs/session18(summary).md` moved to `docs/pre-rebase-notes/`
- Backup copies of plan.md and CONTEXT.md saved to `docs/pre-rebase-notes/`

### Rewritten
- `docs/nic-checklist.md` — fully rewritten with current state; ticked off completed items, organised into Pre-Alpha blockers / Go-Live prep / Security / Done
- `docs/plan.md` — squashed 400-line session detail into compact completed-sessions table with TOC; planned sessions (19–24) kept in full
- `docs/CONTEXT.md` — squashed migration plan from ~50 lines to 8; layman analogies moved to stack-explainer.md

### New files
- `docs/stack-explainer.md` — plain-English stack descriptions (moved out of CONTEXT.md)
- `docs/session-naming.md` — naming convention for session note files (`{prefix}-{topic}-note.md`)

### CLAUDE.md updates
- Session start: reads nic-checklist.md and lists unchecked items as bullets; asks Nic which session note to read (no more auto-search)
- Session end: reads session-naming.md, picks filename, confirms with Nic before writing
- Removed stale 17.X / 18.X session naming hard rules
- Fixed `docs/context.md` reference to `docs/CONTEXT.md`

---

## What's next

- Run `npx supabase db push` to apply migrations 0012–0014
- Session 19 — Pre-Alpha testing (Myself)
