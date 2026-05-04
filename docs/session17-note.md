# Session 17 — Vercel deploy preview

> Read alongside `CONTEXT.md` and `plan.md` at session start.

_Done: 2026-05-04_

---

## What was built

### Cron infrastructure (pre-deploy code changes)

**New files:**
```
src/lib/digest/run.ts
src/app/api/cron/monday-digest/route.ts
```

**Updated files:**
```
scripts/monday-digest.ts   — thin wrapper around runDigest()
vercel.json                — added monday-digest cron
```

### `src/lib/digest/run.ts`

Extracted the monday-digest script logic into a shared `runDigest()` function.
- Uses `createServiceClient()` from `@/lib/supabase/service` (not the raw Supabase JS constructor)
- Returns `{ sent: number, skipped: string }`
- Used by both the manual script and the Vercel cron API route

### `/api/cron/monday-digest`

Wraps `runDigest()` with the same `CRON_SECRET` bearer-token guard as the overdue cron.
Schedule in vercel.json: `0 1 * * 1` = 01:00 UTC every Monday = 09:00 SGT.

### `vercel.json`

Now has two crons:
```json
{ "path": "/api/notifications/overdue",   "schedule": "0 */2 * * *" }
{ "path": "/api/cron/monday-digest",      "schedule": "0 1 * * 1"   }
```

---

## Deployment steps (done manually)

### 1. Commit + push
```bash
git add -A
git commit -m "Sessions 12–17: obsidian-sync, monday-digest, design cleanup, admin, crash log, R2 helpers, CF Images, backup.sh, Vercel crons"
git push origin main
```

### 2. Deploy to Vercel
```bash
vercel          # first-time: prompts login + project setup
vercel --prod   # subsequent: deploy to production
```

Or via Vercel dashboard: Import Project → select GitHub repo → framework auto-detected as Next.js.

### 3. Environment variables in Vercel dashboard

Set all of these under Project → Settings → Environment Variables:

| Variable | Source |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase dashboard |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard (secret) |
| `R2_ACCOUNT_ID` | Cloudflare dashboard |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 API tokens |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 API tokens |
| `R2_BUCKET_NAME` | `greenqubes-files` |
| `R2_PUBLIC_URL` | Cloudflare R2 bucket public URL |
| `CF_IMAGES_ACCOUNT_ID` | Cloudflare dashboard |
| `CF_IMAGES_API_TOKEN` | Cloudflare API tokens |
| `CF_IMAGES_DELIVERY_URL` | Cloudflare Images dashboard |
| `ANTHROPIC_API_KEY` | Anthropic console |
| `VOYAGE_API_KEY` | Voyage AI dashboard |
| `TELEGRAM_BOT_TOKEN` | BotFather |
| `TELEGRAM_WEBHOOK_SECRET` | any 32-char random string |
| `CRON_SECRET` | Vercel auto-injects; set manually for local testing |
| `NEXT_PUBLIC_APP_URL` | your Vercel deployment URL (e.g. `https://greenqubes.vercel.app`) |

**Do NOT set** `CRASH_LOG_DIR` or `OBSIDIAN_VAULT_PATH` on Vercel — these are local-only.

### 4. Re-point Telegram webhook

After deploy, run once:
```
https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<your-vercel-url>/api/telegram/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>
```

Or via curl:
```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://<vercel-url>/api/telegram/webhook" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

### 5. Supabase allowed redirect URLs

In Supabase dashboard → Authentication → URL Configuration, add:
```
https://<your-vercel-url>/auth/callback
```
(Google OAuth callback must be whitelisted or sign-in will fail.)

---

## What's next

- Session 18: Full design review — visual pass against `docs/greenqubes-phase0.jsx`
