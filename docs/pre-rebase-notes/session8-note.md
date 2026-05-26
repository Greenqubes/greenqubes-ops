# Session 8 Notes — Notifications + Telegram

> Read at the start of Session 9 alongside CONTEXT.md and plan.md.

_Done: 2026-05-02_

---

## What was built

Telegram notification infrastructure, overdue alert cron, in-app bell/drawer, and a refactor of the approvals flow to go through server-side API routes.

### Files created

| File | Purpose |
|---|---|
| `src/lib/supabase/service.ts` | Service-role Supabase client (bypasses RLS) — used only in server-side routes and cron jobs |
| `src/lib/telegram/bot.ts` | `sendTelegram(chatId, text)` — fire-and-forget POST to Telegram Bot API, no-ops gracefully if token missing |
| `src/lib/telegram/templates.ts` | All Telegram message templates — **PLACEHOLDER copy**, clearly marked for customisation. One named function per trigger event |
| `src/lib/supabase/queries/notifications.ts` | `getJobRecipients()` — sales POC + installers with telegram_chat_ids; `getOverdueJobs()` — scheduled jobs past their end time; `wasRecentlyNotified()` + `recordOverdueNotification()` — deduplication via events table |
| `src/app/api/telegram/webhook/route.ts` | Receives Telegram updates, validates `X-Telegram-Bot-Api-Secret-Token`, logs incoming messages — routing is a TODO stub |
| `src/app/api/notifications/overdue/route.ts` | Cron handler (GET); filters truly-overdue jobs, deduplicates via events, sends Telegram to sales POC + assignees |
| `src/app/api/jobs/[id]/approve/route.ts` | POST — scheduler-only; updates status + `approved_by`/`approved_at`; notifies sales POC via Telegram |
| `src/app/api/jobs/[id]/send-back/route.ts` | POST — scheduler-only; updates status to `pending`; optionally inserts message; notifies sales POC via Telegram |
| `src/features/notifications/NotificationDrawer.tsx` | Bell icon + sliding drawer; shows overdue scheduled jobs (past date or past time_end today); all roles see it; no extra API call — derived from jobs already loaded |
| `vercel.json` | Cron config: `/api/notifications/overdue` runs every 2 hours (`0 */2 * * *` UTC) |

### Files modified

| File | Change |
|---|---|
| `src/app/api/jobs/[id]/messages/route.ts` | Profile query now fetches `name`; after insert, sends `tplJobMessage` to all job participants except the author |
| `src/features/approvals/ApprovalsShell.tsx` | Replaced direct Supabase updates with `fetch` to `/api/jobs/[id]/approve` and `/api/jobs/[id]/send-back`; removed `createClient` import |
| `src/features/schedule/ScheduleShell.tsx` | Imports and renders `NotificationDrawer` between approvals button and search button |
| `src/lib/i18n/en.ts` | Added `notificationsNone`, `overdueCount` |
| `src/lib/i18n/zh.ts` | Same 2 keys |
| `src/lib/i18n/bn.ts` | Same 2 keys |
| `.env.local.example` | Added `CRON_SECRET` with instructions |

---

## Architecture

```
Telegram notification paths:

1. Job chat message posted
   POST /api/jobs/[id]/messages
     → insertMessage()
     → getJobRecipients()  (service client)
     → sendTelegram() to each participant except author
     → template: tplJobMessage

2. Scheduler approves job
   POST /api/jobs/[id]/approve
     → jobs.update(status='scheduled', approved_by, approved_at)
     → getJobRecipients()
     → sendTelegram() to sales POC
     → template: tplJobApproved

3. Scheduler sends back job
   POST /api/jobs/[id]/send-back
     → jobs.update(status='pending')
     → insertMessage() if note provided
     → getJobRecipients()
     → sendTelegram() to sales POC
     → template: tplJobSentBack

4. Overdue alert (cron, every 2h)
   GET /api/notifications/overdue
     → getOverdueJobs()  (service client, lte today)
     → filter: past time_end for today; all past-date jobs
     → wasRecentlyNotified() to dedup (2h window via events table)
     → sendTelegram() to sales POC + all assignees
     → recordOverdueNotification() → events insert

In-app bell (NotificationDrawer):
   ScheduleShell passes jobs[] → NotificationDrawer
     → isOverdueNow() filter (past date OR today past time_end)
     → amber badge count
     → sliding drawer with links to job detail
```

---

## Key decisions

| Decision | Why |
|---|---|
| Service client in `notifications.ts` | These queries run from API routes with varied auth contexts (cron = no user session, approve/send-back = scheduler session). Service client is the safest common denominator; all data fetched is notification metadata only |
| Overdue deduplication via `events` table | Already exists in schema for this purpose; inserting via service client bypasses the "no authenticated writes" RLS policy intentionally |
| Approve and send-back moved to API routes | Previously direct Supabase in ApprovalsShell client — moving to server routes lets us fire Telegram notifications in the same transaction without exposing service-level logic to the client |
| `tplJobSentBack` fires even without a note | Sales always gets a Telegram ping when their job is sent back, not only when the scheduler adds a note |
| `NotificationDrawer` derived from existing jobs prop | No extra server round-trip; the schedule page already loads all visible jobs. Overdue jobs are a computed subset |
| `[PLACEHOLDER]` tag in all template strings | Makes them easy to find and grep before going live |

---

## Customising Telegram messages

All copy lives in `src/lib/telegram/templates.ts`. Each function takes typed params and returns a string. Edit the return value — Telegram supports `<b>`, `<i>`, `<code>`, `<a href>`. The `[PLACEHOLDER]` prefix can be removed once copy is finalised.

To register the webhook once deployed:
```
POST https://api.telegram.org/bot<TOKEN>/setWebhook
body: { "url": "https://<your-domain>/api/telegram/webhook", "secret_token": "<TELEGRAM_WEBHOOK_SECRET>" }
```

---

## TODOs left for later sessions

- `tplJobSubmittedForApproval` template exists but is not yet fired — would need to be wired in `JobDetailShell.tsx` when sales submits for approval (the status change currently goes direct Supabase)
- `src/app/api/telegram/webhook/route.ts` — command routing (`/jobs`, `/status <id>`) is a TODO stub
- Approvals badge on schedule page still does not auto-refresh in real-time — noted in Session 7, deferred to Session 10 (realtime subscriptions)

---

## What's next — Session 9

`installer` features:
- Installer dashboard (Today's run / Up next / This week)
- Past jobs view for retroactive uploads
- Installer-facing job view (limited fields, no financials)
