# Session 17.9 — Report a Bug Feature (Design Only — Implementation Pending)

_Written: 2026-05-08. No code committed this session — design agreed, implementation deferred to next chat._

---

## What was designed

A user-facing bug reporting feature. Full design agreed with owner. Ready to implement next session.

---

## Feature overview

### Floating button
- Small terracotta/red circle button with a `Bug` icon (lucide-react)
- Positioned bottom-right, stacked **below** the existing AI chat floating bubble
- Visible on all pages (same exclusion logic as AI bubble — hidden on `/assistant`)
- Clicking opens a modal

### Report modal
- **Message** — required free-text textarea (describe the bug)
- **Priority** — selector: Low / Medium / High / Urgent
- **Screenshot** — optional image attachment (uploaded to R2 under `bug-reports/` prefix)
- Submit button → success toast on completion

### Auto-captured diagnostics (no user input needed)
Captured at client side and sent in the POST payload:

| Field | Source |
|---|---|
| Timestamp (SGT) | Server-side |
| IP address | `x-forwarded-for` header (Vercel) |
| Platform | User-Agent parse |
| Browser + version | User-Agent parse |
| OS | User-Agent parse |
| Screen resolution | `window.screen.width × height` (client) |
| Current page/route | `window.location.pathname` (client) |
| User email + role | From authenticated session |

---

## Architecture

### Database — migration `0014_bug_reports.sql`

New `bug_reports` table (not reusing `crash_logs`):

```sql
create table bug_reports (
  id            uuid primary key default gen_random_uuid(),
  user_email    text,
  user_role     text,
  route         text,
  message       text not null,
  priority      text not null,   -- 'low' | 'medium' | 'high' | 'urgent'
  status        text not null default 'open',  -- 'open' | 'fixed'
  screenshot_url text,           -- R2 presigned or public URL
  markdown_file text,            -- filename for cross-reference
  ip_address    text,
  platform      text,
  browser       text,
  os            text,
  screen        text,
  created_at    timestamptz default now(),
  resolved_at   timestamptz
);
```

RLS: service client only (all reads/writes via API routes, not direct from browser).

### API routes

- **`POST /api/bugs`** — receive report, save to DB, write markdown file, send Telegram
- **`GET /api/bugs`** — admin only, list all reports (open + fixed)
- **`PATCH /api/bugs/[id]`** — admin only, mark fixed → set `status = 'fixed'`, `resolved_at = now()`, move markdown file to `bugs_fixed/`

### Markdown files

**Naming:** `bugs_[role]_[YYYY-MM-DD]_[N].md` where N = count of reports that calendar day + 1 (e.g. `bugs_scheduler_2026-05-08_1.md`)

**Open bugs folder:** `C:\Greenqubes_GitHub\greenqubes-ops\bugs_reported\`  
**Fixed bugs folder:** `C:\Greenqubes_GitHub\greenqubes-ops\bugs_reported\bugs_fixed\`

**File content template:**
```md
# Bug Report — [PRIORITY] — [date SGT]

**Time:** 08 May 2026, 3:42 PM SGT
**User:** email (role)
**Page:** /route
**Priority:** urgent
**IP:** 123.456.789.0
**Platform:** Mobile · iPhone · Safari 17
**OS:** iOS 17.4
**Screen:** 390×844
**Screenshot:** [link or "none"]

## Description

[message]
```

### Telegram — separate bug-only bot

New bot separate from the main notification bot. Requires two new env vars:
- `TELEGRAM_BUG_BOT_TOKEN`
- `TELEGRAM_BUG_CHAT_ID`

**Bot setup steps (do before next session):**
1. Open Telegram → message `@BotFather` → send `/newbot`
2. Give it a name e.g. "GreenQubes Bug Reports" and a username e.g. `greenqubes_bugs_bot`
3. Copy the token → add to `.env.local` as `TELEGRAM_BUG_BOT_TOKEN`
4. Either start a private chat with the bot or add it to a group
5. Visit `https://api.telegram.org/bot<TOKEN>/getUpdates` after sending it a message to get the `chat_id`
6. Add to `.env.local` as `TELEGRAM_BUG_CHAT_ID`
7. Add both vars to Vercel environment variables

**Telegram message format:**
```
🐛 Bug Report — URGENT
Time: 08 May 2026, 3:42 PM SGT
Platform: Mobile · iPhone · Safari 17
OS: iOS 17.4
Screen: 390×844
IP: 123.456.789.0
User: nicholas@greenqubes.com (scheduler)
Page: /schedule
Screenshot: [View ↗] (R2 link)
---
[message text]
```

### Admin panel — new "Bug Reports" tab

5th tab in AdminShell (`src/features/admin/`). New file: `BugReportsTab.tsx`.

- Lists open reports: priority pill (colour-coded), user/role, page, timestamp, message preview
- "Mark Fixed" button per row → calls `PATCH /api/bugs/[id]` → moves to fixed section
- Collapsible "Fixed" section below open reports showing resolved bugs with resolved timestamp

---

## Files to create / modify

| File | Action |
|---|---|
| `supabase/migrations/0014_bug_reports.sql` | New — bug_reports table |
| `src/app/api/bugs/route.ts` | New — POST (submit) + GET (admin list) |
| `src/app/api/bugs/[id]/route.ts` | New — PATCH (mark fixed) |
| `src/lib/supabase/queries/bugs.ts` | New — DB query helpers |
| `src/lib/telegram/bot.ts` | Extend — add `sendBugTelegram()` using bug bot token |
| `src/lib/telegram/templates.ts` | Extend — add `tplBugReport()` template |
| `src/lib/supabase/types.ts` | Extend — add bug_reports types |
| `src/components/BugReportButton.tsx` | New — floating button + modal |
| `src/features/admin/BugReportsTab.tsx` | New — admin tab UI |
| `src/features/admin/AdminShell.tsx` | Modify — add Bug Reports tab |
| `src/app/layout.tsx` | Modify — mount `<BugReportButton />` |
| `.env.local` | Add `TELEGRAM_BUG_BOT_TOKEN` + `TELEGRAM_BUG_CHAT_ID` |

---

## Pre-implementation checklist (owner to do before next session)

- [ ] Create the bug Telegram bot via `@BotFather`, get token + chat ID
- [ ] Add `TELEGRAM_BUG_BOT_TOKEN` and `TELEGRAM_BUG_CHAT_ID` to `.env.local`
- [ ] Add both vars to Vercel environment variables dashboard

---

## What's next

- Next session: implement everything above end-to-end
- Run `npx supabase db push` after migration is applied
- Test: submit a bug report as each role, confirm markdown file written, Telegram received, admin tab shows it, mark fixed moves the file
