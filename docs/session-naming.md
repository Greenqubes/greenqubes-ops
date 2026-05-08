# Session Note Naming Convention

Format: `{prefix}-{topic}-{YYYYMMDD}-{n}-note.md`

Where `{n}` starts at 1 and increments if a same-prefix+topic session already exists on the same date.

Example: `fix-chat-20260509-1-note.md`, `feat-installer-20260601-1-note.md`, `chore-docs-20260509-2-note.md`

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

| Session | Filename |
|---|---|
| Fixed job chat lock behaviour | `fix-chat-20260509-1-note.md` |
| Added installer sign-off flow | `feat-installer-20260601-1-note.md` |
| Schedule page visual pass | `visual-schedule-20260615-1-note.md` |
| Optimised Supabase queries | `backend-perf-20260620-1-note.md` |
| Added project_title migration | `db-jobs-20260622-1-note.md` |
| Cleaned up docs and tooling | `chore-docs-20260509-1-note.md` |
