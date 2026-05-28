# Session Note — feat-admin — 2026-05-28

**Session type:** Feature + Fix — Admin panel improvements  
**Status:** Complete

---

## What was done

### Bug fixes

- **Admin Bugs tab "Forbidden" error** — `GET /api/bugs` and `PATCH /api/bugs/[id]` were gated to `scheduler` only; `admin` role was added later and never included. Fixed both routes to allow `scheduler || admin`.
- **Bug bot missing from Vercel** — `TELEGRAM_BUG_BOT_TOKEN` and `TELEGRAM_BUG_CHAT_ID` were not set in Vercel environment variables. Nic added both; bug report Telegram notifications now fire correctly.

### Screenshot modal

- "View screenshot" in bug cards now opens an inline modal overlay instead of a new browser tab. ESC or backdrop click to dismiss; "Open in new tab" fallback link for full-size view.

### Health tab — system checks

- **Three Telegram bots** — health check refactored from a single `checkTelegram()` to `checkTelegramBot(label, envVar)`. Now checks all three bots: ops (`TELEGRAM_BOT_TOKEN`), digest (`TELEGRAM_DIGEST_BOT_TOKEN`), bugs (`TELEGRAM_BUG_BOT_TOKEN`).
- **Obsidian sync + Overdue cron** — both now insert a row into the `events` table on each successful run (`kind: 'obsidian_sync'` / `kind: 'overdue_check'`). Health tab now shows last-run time instead of "unknown".

### Health tab — API usage logging

- **Voyage** — `embed.ts` now calls `logApiUsage` after each embedding call, capturing `usage.total_tokens` from the Voyage response. Cost calculated at $0.06/1M tokens.
- **Telegram** — `telegramPost()` and `digestPost()` in `bot.ts` now call `logApiUsage` after each successful send (cost: $0).
- **R2** — `getUploadUrlForKind`, `getDownloadUrl`, `getBugScreenshotUploadUrl` in `r2.ts` now call `logApiUsage` after each URL generation (cost: $0, tracked for operation count anomaly detection).

### Health tab — IP geolocation & unusual activity

- **New rule: non-Singapore IP** — any API call from outside Singapore is flagged as unusual. One event per unique non-SG IP (deduplicated across 7-day window).
- **Geolocation lookup** — all unique IPs in the 7-day log are looked up in parallel via `ipinfo.io` (free, HTTPS, no key). Private/loopback IPs skipped.
- **Location display** — both off-hours and non-SG events now show `📍 City, Country · ISP` and raw IP in the unusual activity feed.

### Bug tab — delete & multi-select

- **Single delete** — each fixed bug card has a "Delete" button (terracotta, right-aligned). Hidden in select mode.
- **Multi-select** — "Select" button appears in the fixed section header when expanded. Checkboxes on each card; selected cards get a terracotta tint.
- **Bulk delete bar** — fixed to bottom of screen showing count + "Delete X" button when anything selected. "Cancel" exits select mode.
- **API** — `DELETE /api/bugs/[id]` route added; `deleteBugReport()` query added to `bugs.ts`.

### Bug tab — sorting

- **Open bugs** — sort dropdown (Newest first / Oldest first by received date). Only shows when >1 bug.
- **Fixed bugs** — sort dropdown with 4 options: Recently fixed / Oldest fixed / Newest received / Oldest received. Default: Recently fixed.
- `SortDropdown<T>` generic component added — click to open, click outside to dismiss.

---

## Files changed

- `src/app/api/bugs/route.ts` — admin role added to GET guard
- `src/app/api/bugs/[id]/route.ts` — admin role added to PATCH guard; DELETE handler added
- `src/app/api/admin/health/route.ts` — three-bot check; overdue cron event insert
- `src/app/api/notifications/overdue/route.ts` — event insert on completion
- `src/features/admin/BugReportsTab.tsx` — screenshot modal; delete + multi-select + sort
- `src/features/admin/HealthTab.tsx` — location display in unusual activity feed
- `src/lib/ai/embed.ts` — Voyage API usage logging
- `src/lib/storage/r2.ts` — R2 API usage logging
- `src/lib/supabase/queries/admin.ts` — `UnusualEvent.location`; `geolocate()`; non-SG IP rule
- `src/lib/supabase/queries/bugs.ts` — `deleteBugReport()`
- `src/lib/telegram/bot.ts` — Telegram API usage logging
- `scripts/obsidian-sync.ts` — event insert on completion
- `docs/nic-checklist.md` — Bryan onboarding items ticked off

---

## Next

- Pre-alpha testing (Session 19)
- Pending bugs: AdminRoleModal double-Yes, Scheduler "Send Back" + "Delete Job" on scheduled jobs, Bulk delete jobs on Schedule/Pending pages
