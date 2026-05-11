# Session 14 — Admin page

> Read alongside `CONTEXT.md` and `plan.md` at session start.

_Done: 2026-05-04_

---

## What was built

### `/admin` page — scheduler-only, three tabs

**New files:**
```
supabase/migrations/0006_admin_features.sql
src/lib/supabase/queries/admin.ts
src/app/api/admin/users/route.ts
src/app/api/admin/users/[id]/route.ts
src/app/api/admin/health/route.ts
src/app/api/admin/digest/route.ts
src/app/admin/page.tsx
src/features/admin/AdminShell.tsx
src/features/admin/UsersTab.tsx
src/features/admin/DigestTab.tsx
src/features/admin/HealthTab.tsx
```

**Updated files:**
```
src/lib/supabase/types.ts            — digest_subscriber + api_usage_logs types
src/components/BottomNav.tsx         — Admin tab (ShieldCheck icon) for scheduler
src/app/api/assistant/chat/route.ts  — logs each Claude call to api_usage_logs
src/lib/i18n/en.ts / zh.ts / bn.ts  — 13 admin keys
```

---

## DB migration — 0006_admin_features.sql

Two changes:
1. `users.digest_subscriber boolean not null default false` — replaces the implicit "all schedulers with telegram_chat_id receive digest" assumption; now explicit per-user opt-in.
2. `api_usage_logs` table — tracks every outbound AI/storage/Telegram call with service, endpoint, called_by (user id), tokens, cost, IP, user-agent.

**RLS:**
- `api_usage_logs`: schedulers SELECT all rows; service role INSERTs.

Run: `npx supabase db push`

---

## Tab: Users

- Provision form: enter email (must match an existing Google auth account), display name, role, lang → calls `auth.admin.listUsers()` via service role to match, then inserts into `public.users`.
- User list: all users ordered by name. Each row shows name (Fraunces), role Pill, Telegram chat ID (mono), digest subscriber badge.
- Inline edit: click "Edit" on any row → in-place form for role, Telegram chat ID, digest subscriber checkbox. Save calls `PATCH /api/admin/users/[id]`.

---

## Tab: Digest

Two panels:

**Subscriber panel** — all users with a `telegram_chat_id` listed; checkbox toggles `digest_subscriber`. Only subscribed users receive the Monday digest cron.

**Digest queue** — all `asst_chats` with `importance >= 4`, sorted by importance then date. Each card shows:
- Topic (Fraunces), date, importance ★★★★☆ stars
- Vote counts (yes / no from `digest_votes`)
- Status pill: pending / promoted / dismissed
- "Send to subscribers…" expander with per-subscriber checkboxes (only subscribed users shown)
- "Send now" button → `POST /api/admin/digest` → re-summarises via Claude Haiku → sends to selected subscribers via Telegram inline keyboard

This gives the scheduler fine-grained control: can re-send any item to any subset of subscribers at any time without waiting for Monday.

---

## Tab: Health

**System checks** (run live on page load):
| Check | How |
|---|---|
| Supabase | Simple `users.select` — any DB error = red |
| Telegram bot | `getMe` API call — validates token, returns `@username` |
| Obsidian sync | Last `events.kind = 'obsidian_sync'` timestamp; warns if > 2 days old |
| Overdue cron | Last `events.kind = 'overdue_check'` timestamp; warns if > 4h old |

**API usage tracker** — last 30 days from `api_usage_logs`:
- Per-service card (Anthropic, Voyage, R2, Telegram): call count, total tokens in/out, estimated cost
- Direct link to each provider's dashboard for manual billing comparison
- Discrepancy note: if our calculated cost from token counts drifts from our logged `estimated_cost`, flags it
- Placeholders shown for services with no calls yet

**Unusual activity feed** — last 7 days: flags any API calls made outside 7 AM–10 PM SGT (potential off-hours misuse)

**Key rotation shortcuts** — one-click links to each provider's key management page (Anthropic, Voyage AI, Cloudflare, Supabase)

---

## API usage logging

First service wired: `POST /api/assistant/chat` now logs every Claude Sonnet 4.6 call:
- `tokens_in`, `tokens_out` from `finalMessage().usage`
- `estimated_cost` = `(in/1M × $3) + (out/1M × $15)` (Sonnet 4.6 pricing)
- `called_by` = `public.users.id` of the requesting user
- `ip_address` from `x-forwarded-for` / `x-real-ip` headers

Future: wire the same `logApiUsage()` helper into the Voyage embed calls, R2 upload/download routes, Telegram `sendTelegram()`.

---

## BottomNav

Scheduler now has 4 tabs: Schedule · Approvals · Assistant · Admin (ShieldCheck icon).

---

## What's next — before production cutover

1. Push `npx supabase db push` to apply migration 0006
2. **Full design review** — visual pass against `docs/greenqubes-phase0.jsx` (expect many changes; prototype not fully matched yet)
3. R2 signed-URL upload helpers
4. Cloudflare Images binding
5. `backup.sh` rclone cold-archive script
6. Vercel deploy preview + internal team testing
7. Production cutover
