# Session 17.9 — Report a Bug Feature (Implementation)

_Written: 2026-05-08. Full implementation completed this session._

---

## What was built

Full end-to-end bug reporting feature. Design was agreed in the previous session; all code written and deployed to dev this session.

---

## Files created

| File | Purpose |
|---|---|
| `supabase/migrations/0014_bug_reports.sql` | `bug_reports` table with priority/status checks, RLS enabled (service client only) |
| `src/lib/supabase/queries/bugs.ts` | DB helpers: `insertBugReport`, `getBugReports`, `countBugReportsForDate`, `markBugFixed`, `getBugMarkdownFile` |
| `src/app/api/bugs/route.ts` | POST (submit report) + GET (admin list, scheduler only) |
| `src/app/api/bugs/[id]/route.ts` | PATCH (mark fixed — updates DB + moves markdown file) |
| `src/app/api/bugs/upload-url/route.ts` | Presigned R2 URL for screenshot upload |
| `src/components/BugReportButton.tsx` | Floating bug button + modal (message, priority, screenshot) |
| `src/features/admin/BugReportsTab.tsx` | Admin tab: open/fixed list, priority pills, view screenshot, Mark Fixed |
| `bugs_reported/pre-alpha/.gitkeep` | Version folder scaffold |
| `bugs_reported/pre-alpha/fixed/.gitkeep` | Fixed subfolder scaffold |

## Files modified

| File | Change |
|---|---|
| `src/lib/supabase/types.ts` | Added `bug_reports` Row/Insert/Update types |
| `src/lib/storage/r2.ts` | Added `getBugScreenshotUploadUrl()` (no jobId, uses `bug-reports/` prefix) |
| `src/lib/telegram/bot.ts` | Added `sendBugTelegram()` using `TELEGRAM_BUG_BOT_TOKEN` |
| `src/lib/telegram/templates.ts` | Added `tplBugReport()` with full diagnostic formatting |
| `src/features/admin/AdminShell.tsx` | Added "Bugs" tab (5th tab) |
| `src/app/layout.tsx` | Mounted `<BugReportButton />` inside `<ToastProvider>` |

---

## Architecture decisions

### Floating button position
Bug button sits **above** the AI chat bubble: `bottom-[136px]`, `w-10 h-10` (slightly smaller than AI's `w-12 h-12` at `bottom-20`). This gives the AI button visual priority and avoids collision with the bottom nav.

### Version-scoped folder structure
`APP_VERSION` env var (default `pre-alpha`) scopes all markdown files:
- Open: `bugs_reported/{version}/bugs_{role}_{YYYY-MM-DD}_{N}.md`
- Fixed: `bugs_reported/{version}/fixed/bugs_{role}_{YYYY-MM-DD}_{N}.md`

When moving to V.0.0.0.1 (Session 19), update `APP_VERSION` in `.env.local` and Vercel — new folder is created automatically on first report.

### Markdown files (local dev only)
`BUG_LOG_DIR` env var must be set for file writes. On Vercel it is not set; DB + Telegram still work. Files are written/moved by the API route using `fs/promises`.

### Screenshot upload flow
Client calls `/api/bugs/upload-url` → gets presigned PUT URL → uploads directly to R2 → passes the R2 key in the `/api/bugs` POST body. The API generates a short-lived download URL for Telegram.

### Telegram bug bot
Separate from the main notification bot. Uses `TELEGRAM_BUG_BOT_TOKEN` + `TELEGRAM_BUG_CHAT_ID`. Silently no-ops if either env var is missing. Message format includes priority emoji, all diagnostics, and a screenshot link if present.

### Auto-captured diagnostics
- Server-side: IP (`x-forwarded-for`), user-agent parse (platform/browser/OS), email/role from session
- Client-side: `window.location.pathname`, `window.screen.width × height`

---

## Bug fixed this session

**Vercel build error** — `BugReportButton` was mounted outside `<ToastProvider>` in layout.tsx, causing `useToast()` to throw during prerendering of `/_not-found`. Fixed by moving `<BugReportButton />` inside `<ToastProvider>`.

---

## Env vars added

| Var | Where | Value |
|---|---|---|
| `BUG_LOG_DIR` | `.env.local` only | `C:/Greenqubes_GitHub/greenqubes-ops/bugs_reported` |
| `APP_VERSION` | `.env.local` + Vercel | `pre-alpha` |
| `TELEGRAM_BUG_BOT_TOKEN` | `.env.local` + Vercel | _(set by owner before session)_ |
| `TELEGRAM_BUG_CHAT_ID` | `.env.local` + Vercel | _(set by owner before session)_ |

---

## What's next — Session 17.10

**Backend performance review.** Every page navigation currently takes a few seconds. Goal: identify and fix the root causes of slow load times across the app.

Likely investigation areas:
- Supabase query patterns (N+1 queries, missing indexes, over-fetching columns)
- Next.js caching strategy (`force-dynamic` vs `cache: 'no-store'` vs static generation)
- Server component waterfall — sequential `await` calls that could be parallelised with `Promise.all`
- Bundle size / code splitting — large client components loading on every route
- Vercel cold starts on API routes (especially the AI assistant route with heavy imports)
- Realtime subscription overhead on schedule page (polling interval + WebSocket setup cost)

Approach: profile each main page (schedule, job detail, installer, approvals, admin), measure server response times, identify the biggest wins, fix in priority order.
