# Session 15 — Crash log

> Read alongside `CONTEXT.md` and `plan.md` at session start.

_Done: 2026-05-04_

---

## What was built

### Crash capture infrastructure

**New files:**
```
supabase/migrations/0007_crash_logs.sql
src/app/api/crash/route.ts
src/components/ErrorBoundary.tsx
src/components/ErrorPage.tsx
src/app/schedule/error.tsx
src/app/jobs/[id]/error.tsx
src/app/installer/error.tsx
src/app/api/admin/crashes/route.ts
src/app/api/admin/crashes/[id]/route.ts
src/features/admin/CrashLogTab.tsx
scripts/seed-crash.ts
```

**Updated files:**
```
src/lib/supabase/types.ts          — crash_logs table type
src/features/admin/AdminShell.tsx  — 4th tab "Crashes"
src/lib/i18n/en.ts / zh.ts / bn.ts — 5 crash keys each
src/app/layout.tsx                 — wrapped with ErrorBoundary
.env.local.example                 — CRASH_LOG_DIR (commented out)
```

---

## DB migration — 0007_crash_logs.sql

`crash_logs` table:
- `id, occurred_at, route, error_message, stack_trace, component_stack`
- `user_id (nullable)`, `user_email (nullable)`, `user_agent`
- `markdown_body` — full .md text, stored and downloadable
- `resolved boolean default false` — dismissed = soft-deleted from view

**RLS:** scheduler SELECT; service role INSERT + UPDATE.

Run: `npx supabase db push`

---

## Crash capture — two paths

### 1. React render crashes (`ErrorBoundary`)
- `src/components/ErrorBoundary.tsx` — class component wrapping the entire app in `layout.tsx`
- `componentDidCatch` fires, POSTs to `/api/crash` (fire-and-forget), then shows the fallback UI
- Captures: route (`window.location.pathname`), error message, stack trace, component stack

### 2. Server component crashes (`error.tsx`)
- Next.js convention: `error.tsx` files in `/schedule`, `/jobs/[id]`, `/installer`
- Each is a thin wrapper around `src/components/ErrorPage.tsx` with a hardcoded route string
- POSTs to `/api/crash` on mount (once per error), then shows "Try again" with the `reset()` callback

---

## `/api/crash` — public POST

No auth guard (crashes happen before auth context may be available).

Accepts: `route, errorMessage, stackTrace?, componentStack?, userEmail?`

Does two things:
1. Writes row to `crash_logs` via service client
2. If `CRASH_LOG_DIR` env var is set (dev only): writes `crash-YYYY-MM-DD-HH-MM-SS.md` to that folder

Markdown format is intentionally minimal — timestamp, route, user, error, stack — so it reads quickly.

---

## Admin — Crash Log tab

`CrashLogTab.tsx` fetches `GET /api/admin/crashes` (unresolved only, newest first).

Each crash card shows:
- Timestamp (SGT) · route chip · user email (if known)
- Error message (terracotta, truncated to one line)
- ▼ expand → stack trace + component stack in scrollable `<pre>` blocks
- **Download .md** — creates a Blob from `markdown_body`, triggers browser download
- **Dismiss** — `PATCH /api/admin/crashes/[id]` sets `resolved = true`, removes from list

Empty state: green dot + "All clear — no crashes".

---

## Markdown format (stored in `markdown_body`)

```markdown
# Crash — 2026-05-04 14:32 SGT

**Route:** /schedule
**User:** ai@greenqubes.com
**UA:** Mozilla/5.0...

## Error
TypeError: Cannot read properties of undefined (reading 'map')

## Stack
\`\`\`
at ScheduleShell.tsx:142...
\`\`\`

## Component stack
\`\`\`
at ScheduleShell
at ToastProvider
\`\`\`
```

Stack truncated to 3000 chars, component stack to 1500 — enough to pinpoint the file and line without bloating the DB.

---

## What's next — before production cutover

1. Push `npx supabase db push` to apply migration 0007
2. R2 signed-URL upload helpers
3. Cloudflare Images binding
4. `backup.sh` rclone cold-archive script
5. Full design review — visual pass against `docs/greenqubes-phase0.jsx`
6. Vercel deploy preview + internal team testing
7. Production cutover
