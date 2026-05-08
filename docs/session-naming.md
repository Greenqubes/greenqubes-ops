# Session Note Naming Convention

Format: `{prefix}-{topic}-note.md`

Example: `fix-chat-note.md`, `feat-installer-note.md`, `visual-schedule-note.md`

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
| Fixed job chat lock behaviour | `fix-chat-note.md` |
| Added installer sign-off flow | `feat-installer-note.md` |
| Schedule page visual pass | `visual-schedule-note.md` |
| Optimised Supabase queries | `backend-perf-note.md` |
| Added project_title migration | `db-jobs-note.md` |
| Cleaned up docs and tooling | `chore-note.md` |
