# Nic's checklist — things only you can do

> Updated after each session. Claude handles the coding; this doc tracks every manual action, setup step, or decision that needs a human.

_Last updated: Session 14 / 14.5 (2026-05-04)_

---

## Right now — do these before the next session

- [ ] **Apply pending DB migrations** — run in your terminal from the project folder:
  ```
  npx supabase db push
  ```
  This applies all pending migrations:
  - `0004_assistant_search.sql` — pgvector search functions for AI memory retrieval
  - `0005_digest_votes.sql` — digest voting table
  - `0006_admin_features.sql` — `digest_subscriber` flag on users + `api_usage_logs` table

  Without 0006, the admin Health tab will error and digest subscription toggles won't save.

- [ ] **Verify admin access** — sign in as `ai@greenqubes.com`, open the top-right avatar dropdown → you should see an "Admin" option with a shield icon. Click it → `/admin`. If you see it: access control is working. Other accounts should not see this option.

- [ ] **Wire `CRASH_LOG_DIR` env var (Session 15 prep)** — decide where on your local machine to store crash `.md` files. Add to `.env.local`:
  ```
  CRASH_LOG_DIR=C:/Greenqubes_GitHub/crash-logs
  ```
  This folder will hold one `.md` file per app crash. Leave it until Session 15 is built.

---

## Obsidian sync — do this before first sync

- [ ] **Review your vault for sensitive notes** — before running the sync, any note you don't want widely visible should have YAML frontmatter:
  ```yaml
  ---
  visibility: [role:sales, role:scheduler]
  tags: [supplier, costing]
  ---
  ```
  Notes with no frontmatter default to `public-internal` (visible to all logged-in users). Check supplier pricing, client personal info, HR notes.

- [ ] **Add `OBSIDIAN_VAULT_PATH` to `.env.local`**:
  ```
  OBSIDIAN_VAULT_PATH=C:/Users/YourName/Documents/YourVault
  NEXT_PUBLIC_APP_URL=http://localhost:3001
  ```

- [ ] **Run the first sync manually** to confirm it works:
  ```
  npm run obsidian-sync
  ```
  You should see `✓ filename.md (N chunks)` for each file.

- [ ] **Schedule nightly sync** — once confirmed working, set up Windows Task Scheduler:
  - Program: `node`
  - Arguments: `--env-file=.env.local node_modules/.bin/tsx scripts/obsidian-sync.ts`
  - Start in: `C:\Greenqubes_GitHub\greenqubes-ops`
  - Trigger: daily at a low-traffic time (e.g. 2 AM)

---

## Monday digest

The digest now sends only to users with `digest_subscriber = true` AND a `telegram_chat_id` set. You control this from the Admin → Digest tab.

- [ ] **Test the digest manually** before relying on the cron:
  ```
  npm run monday-digest
  ```
  Should send to all users you've marked as digest subscribers.

- [ ] **Set up GitHub Actions cron** for the weekly digest (do this after deploying to Vercel):
  Create `.github/workflows/monday-digest.yml`:
  ```yaml
  name: Monday Digest
  on:
    schedule:
      - cron: '0 1 * * 1'   # 01:00 UTC = 09:00 SGT every Monday
  jobs:
    digest:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
          with: { node-version: '20' }
        - run: npm ci
        - run: npx tsx scripts/monday-digest.ts
          env:
            NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
            SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
            ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
            TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
            NEXT_PUBLIC_APP_URL: ${{ secrets.NEXT_PUBLIC_APP_URL }}
            CRON_SECRET: ${{ secrets.CRON_SECRET }}
  ```
  Add all those values as GitHub repository secrets (Settings → Secrets → Actions).

---

## Cloudflare

- [ ] **Get Cloudflare Images delivery URL** — Cloudflare dashboard → Images → copy the delivery URL (looks like `https://imagedelivery.net/XXXXXX`). Add to `.env.local`:
  ```
  CF_IMAGES_DELIVERY_URL=https://imagedelivery.net/XXXXXX
  ```

---

## Vercel — deploy when ready (after design review + Session 15)

- [ ] **Connect the repo to Vercel** — vercel.com → New Project → import from GitHub.
- [ ] **Add all environment variables** in Vercel project settings → Environment Variables:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `R2_ACCOUNT_ID`
  - `R2_ACCESS_KEY_ID`
  - `R2_SECRET_ACCESS_KEY`
  - `R2_BUCKET_NAME`
  - `R2_PUBLIC_URL`
  - `CF_IMAGES_ACCOUNT_ID`
  - `CF_IMAGES_API_TOKEN`
  - `CF_IMAGES_DELIVERY_URL`
  - `ANTHROPIC_API_KEY`
  - `VOYAGE_API_KEY`
  - `TELEGRAM_BOT_TOKEN`
  - `TELEGRAM_WEBHOOK_SECRET`
  - `CRON_SECRET`
  - `NEXT_PUBLIC_APP_URL` ← set to your actual Vercel URL
  - **Do NOT add** `OBSIDIAN_VAULT_PATH` (runs locally only)
  - **Do NOT add** `CRASH_LOG_DIR` (crash logs go to Supabase in production; local `.md` files are a dev-mode bonus)
- [ ] **Set the Telegram webhook URL** — after first deploy, run once:
  ```
  curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
    -d "url=https://your-app.vercel.app/api/telegram/webhook" \
    -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
  ```
- [ ] **Set Supabase auth callback URL** — Supabase dashboard → Authentication → URL Configuration → Redirect URLs:
  ```
  https://your-app.vercel.app/auth/callback
  ```
- [ ] **Add Vercel URL to Google OAuth** — Google Cloud Console → OAuth 2.0 client → Authorised redirect URIs.

---

## Server PC — backup setup (after production cutover)

- [ ] **Set up the server PC** — follow steps H1 + S1–S9 in `docs/greenqubes-setup-guide.html`
- [ ] **Install rclone** and configure it to point at Cloudflare R2
- [ ] **Schedule `scripts/backup.sh`** as a daily Windows Task Scheduler job (script not yet written — final stretch)

---

## Ongoing — after go-live

- [ ] **Provision team accounts** — use the Admin → Users tab (sign in as `ai@greenqubes.com`, open avatar dropdown → Admin). Each person must have signed in via Google at least once before you can provision them.
- [ ] **Collect Telegram chat IDs** — each team member messages your bot once; you copy their chat ID into their user row from the Admin → Users tab.
- [ ] **Set digest subscribers** — Admin → Digest tab → Subscriber panel → check the box for each person who should receive the Monday digest.
- [ ] **Internal test round** — run the app with the actual team for 1–2 weeks before declaring production.
- [ ] **Check first few Monday digests manually** — review the first 2–3 digests to see if what surfaces is worth promoting.
- [ ] **Turn on 2FA** on every service account — GitHub, Vercel, Supabase, Anthropic, Cloudflare. Takes 10 minutes. Eliminates majority of account-compromise risk.

---

## Admin security note

Admin access is **hard-gated to `ai@greenqubes.com` only** at both the page and API level. No other account — not even other scheduler accounts — can reach `/admin` or any `/api/admin/*` endpoint. The check is against the Google-authenticated email, not a role field, so it cannot be bypassed by editing `public.users`.

---

## Done ✓

- [x] Supabase project created + env keys in `.env.local`
- [x] Cloudflare R2 bucket created + keys in `.env.local`
- [x] Cloudflare Images API token added
- [x] Anthropic API key added
- [x] Voyage AI API key added
- [x] Telegram bot created + token added
- [x] Google OAuth client created + Supabase callback wired
- [x] Supabase DB schema applied (migrations 0001–0003)
- [x] Seed data applied (Sarah/Kai/Ravi/Ali + 4 demo jobs)
- [x] Vercel account created
- [x] GreenqubesAI scheduler account provisioned + tested
