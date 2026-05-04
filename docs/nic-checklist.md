# Nic's checklist — things only you can do

> Updated after each session. Claude handles the coding; this doc tracks every manual action, setup step, or decision that needs a human.

_Last updated: Session 11 (2026-05-04)_

---

## Right now — do these before the next session

- [ ] **Apply the pgvector migration** — run this in your terminal from the project folder:
  ```
  npx supabase db push
  ```
  This applies `0004_assistant_search.sql` (adds the two search functions the AI assistant needs for memory retrieval). Without it, RAG retrieval silently skips and the assistant has no company memory. Web search still works.

---

## Cloudflare

- [ ] **Get Cloudflare Images delivery URL** — log into Cloudflare dashboard → Images → copy the "Delivery URL" (looks like `https://imagedelivery.net/XXXXXX`). Add to `.env.local`:
  ```
  CF_IMAGES_DELIVERY_URL=https://imagedelivery.net/XXXXXX
  ```
  Not needed until photo resize is built (after Session 13), but grab it now while you're in the dashboard.

---

## Vercel — deploy when ready (after Session 13)

- [ ] **Connect the repo to Vercel** — go to vercel.com → New Project → import from GitHub. Select this repo.
- [ ] **Add all environment variables** — in Vercel project settings → Environment Variables, copy every key from `.env.local`:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `CF_R2_ACCESS_KEY_ID`
  - `CF_R2_SECRET_ACCESS_KEY`
  - `CF_R2_BUCKET_NAME`
  - `CF_R2_ENDPOINT`
  - `CF_IMAGES_API_TOKEN`
  - `CF_IMAGES_DELIVERY_URL`
  - `ANTHROPIC_API_KEY`
  - `VOYAGE_API_KEY`
  - `TELEGRAM_BOT_TOKEN`
  - `TELEGRAM_WEBHOOK_SECRET`
- [ ] **Set the Telegram webhook URL** — after first deploy, run once in terminal (swap in your actual Vercel URL):
  ```
  curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
    -d "url=https://your-app.vercel.app/api/telegram/webhook" \
    -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
  ```
- [ ] **Set Supabase auth callback URL** — in Supabase dashboard → Authentication → URL Configuration, add your Vercel URL to "Redirect URLs":
  ```
  https://your-app.vercel.app/auth/callback
  ```
- [ ] **Add Vercel URL to Google OAuth** — in Google Cloud Console → OAuth 2.0 client → Authorised redirect URIs, add:
  ```
  https://<your-supabase-project>.supabase.co/auth/v1/callback
  ```
  (This is already done for the Supabase URL — only need to update if the Supabase project changes.)

---

## Server PC — backup setup (not urgent, after production cutover)

The rclone cold-archive script (`scripts/backup.sh`) hasn't been written yet (post-Session 13). But when it is, you'll need:

- [ ] **Set up the server PC** — follow steps H1 + S1–S9 from the setup guide (`docs/greenqubes-setup-guide.html`)
- [ ] **Install rclone** on the server PC and configure it to point at Cloudflare R2
- [ ] **Schedule the backup script** as a daily Windows Task Scheduler job

---

## Obsidian — when Session 12 is built

- [ ] **Review the Obsidian vault sync script** (`scripts/obsidian-sync.ts`) — confirm the vault path matches where your Obsidian vault actually lives on your machine
- [ ] **Add YAML frontmatter to any sensitive notes** in Obsidian before the first sync, so they don't get broad visibility:
  ```yaml
  ---
  visibility: [role:sales, role:scheduler]
  tags: [supplier, costing]
  ---
  ```
  Notes without frontmatter default to `public-internal`.

---

## Ongoing — after go-live

- [ ] **Provision team accounts** — for each team member, insert a row into `public.users` in Supabase with their `auth_id` (get from `auth.users` by their email), their role, and their Telegram chat ID
- [ ] **Collect Telegram chat IDs** — each team member should message your bot once; the bot logs their chat ID so you can put it in their `users` row
- [ ] **Internal test round** — run the app with the actual team for 1–2 weeks before declaring it production
- [ ] **Monday digest** (Session 12) — once built, check the first few digests manually before trusting the auto-tagger's importance scores

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
