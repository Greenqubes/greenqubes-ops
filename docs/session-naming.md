# Session Note Naming Convention

Format: `docs/{prefix}/{prefix}-{topic}-{YYYYMMDD}-{n}-note.md`

Where `{n}` starts at 1 and increments if a same-prefix+topic session already exists on the same date.

Example: `docs/fix/fix-chat-20260509-1-note.md`, `docs/feat/feat-installer-20260601-1-note.md`, `docs/chore/chore-docs-20260509-2-note.md`

## Folders

| Folder | Prefix |
|---|---|
| `docs/fix/` | `fix` |
| `docs/feat/` | `feat` |
| `docs/visual/` | `visual` |
| `docs/ux/` | `ux` |
| `docs/backend/` | `backend` |
| `docs/db/` | `db` |
| `docs/infra/` | `infra` |
| `docs/chore/` | `chore` |

---

## Prefixes

| Prefix | Use when the session was about... |
|---|---|
| `fix` | Bug fixes |
| `feat` | New feature or major addition |
| `visual` | UI/design edits — colours, spacing, typography, layout |
| `ux` | Flow or behaviour changes (not just looks) |
| `backend` | API routes, queries, performance |
| `db` | Migrations, schema changes |
| `infra` | Vercel, Supabase config, cron, env vars |
| `chore` | Cleanup, refactoring, docs, tooling |

## Topics

One word. Pick the closest match to what was touched:

`schedule` `jobs` `installer` `approvals` `chat` `assistant` `notifications` `admin` `auth` `bugs` `backup` `digest` `files` `nav` `design` `perf` `db` `config`

---

## Examples

| Session | File path |
|---|---|
| Fixed job chat lock behaviour | `docs/fix/fix-chat-20260509-1-note.md` |
| Added installer sign-off flow | `docs/feat/feat-installer-20260601-1-note.md` |
| Schedule page visual pass | `docs/visual/visual-schedule-20260615-1-note.md` |
| Optimised Supabase queries | `docs/backend/backend-perf-20260620-1-note.md` |
| Added project_title migration | `docs/db/db-jobs-20260622-1-note.md` |
| Cleaned up docs and tooling | `docs/chore/chore-docs-20260509-1-note.md` |
