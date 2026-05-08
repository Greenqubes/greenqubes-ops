# Nic's Checklist — Things Only You Can Do

> Claude handles the coding. This file tracks every manual action, setup step, or decision that needs a human. Read this at the start of every session.

_Last updated: 2026-05-09 (post Session 18.3 cleanup)_

---

## Before Pre-Alpha Testing (Session 19) — Must Complete First

- [ ] **Run pending DB migrations** — `npx supabase db push` to apply migrations 0012 (project_title) and 0013 (date_end) and 0014 (bug_reports). Run from the project directory on any machine with Supabase CLI linked.
- [ ] **Test Monday digest manually** — run `npm run monday-digest` and confirm it sends to all digest subscribers via Telegram.
- [ ] **Obsidian sync — first run** — add `OBSIDIAN_VAULT_PATH` to `.env.local`, review vault for sensitive notes (add YAML frontmatter for anything with supplier pricing, client personal info, HR matters), then run `npm run obsidian-sync` and confirm output shows `✓ filename.md (N chunks)` for each file.
- [ ] **Add production OAuth redirect URI** — Google Cloud Console → your OAuth client → Authorised redirect URIs → confirm `https://greenqubes-ops.vercel.app/auth/callback` is present (may already be done).

---

## Before Go-Live (Session 23) — Set Up With Team

- [ ] **Provision team accounts** — Admin → Users tab → Provision new user. Each person must sign in via Google at least once first before you can provision them.
- [ ] **Collect Telegram chat IDs** — each team member messages your bot once; copy their chat ID into their user row from Admin → Users tab → Edit.
- [ ] **Set digest subscribers** — Admin → Digest tab → Subscriber panel → check the box for each person who should receive the Monday digest.
- [ ] **Schedule Obsidian nightly sync** — once manual sync is confirmed working, set up Windows Task Scheduler on the server PC:
  - Program: `node`
  - Arguments: `--env-file=.env.local node_modules/.bin/tsx scripts/obsidian-sync.ts`
  - Start in: `C:\Greenqubes_GitHub\greenqubes-ops`
  - Trigger: daily at 2 AM

---

## Security — Do Before Bringing in Any Team Members

- [ ] **Turn on 2FA** on every service account — GitHub, Vercel, Supabase, Anthropic, Cloudflare. Takes 10 minutes. Do this before any team member gets access.

---

## Ongoing — After Go-Live

- [ ] **Review first few Monday digests manually** — confirm what surfaces is worth promoting to Obsidian before trusting the process.

---

## Server PC — Already Set Up ✓

- [x] rclone installed and `greenqubes-r2` remote configured
- [x] `SUPABASE_DB_URL` set as system environment variable (using Supabase Connection Pooler — IPv4)
- [x] Nightly backup scheduled in Task Scheduler at 02:00 — syncs R2 → `E:\Greenqubes-Archive\r2` and dumps DB → `E:\Greenqubes-Archive\db\`
- [x] Git Bash path confirmed: `C:\Git\bin\bash.exe`

---

## Done ✓

- [x] Supabase project created + env keys in `.env.local`
- [x] Cloudflare R2 bucket created + keys in `.env.local`
- [x] Cloudflare Images API token added
- [x] Anthropic API key added
- [x] Voyage AI API key added
- [x] Telegram bot created + token added
- [x] Google OAuth client created + Supabase callback wired
- [x] All DB migrations applied (0001–0011; 0012–0014 pending — see above)
- [x] Seed data applied (Sarah/Kai/Ravi/Ali + 4 demo jobs)
- [x] Vercel deployed — https://greenqubes-ops.vercel.app
- [x] All env vars set in Vercel dashboard
- [x] Telegram webhook pointed at Vercel URL
- [x] Supabase auth callback URL added for Vercel preview + production
- [x] Your Telegram Chat ID added to your user record
- [x] `messages` + `files` + `jobs` tables added to `supabase_realtime` publication
- [x] `REPLICA IDENTITY FULL` set on `messages`, `files`, `jobs`
- [x] GreenqubesAI scheduler account provisioned + tested
- [x] Supabase project linked via CLI (`npx supabase link`)
- [x] Job chat realtime fixed (Session 17.1 — simplified RLS policies)
- [x] DB password rotated (Session 17.11 — old password invalidated)

---

## Admin Security Note

Admin access is hard-gated to `ai@greenqubes.com` only at both the page and API level. No other account — not even other scheduler accounts — can reach `/admin` or any `/api/admin/*` endpoint. The check is against the Google-authenticated email, not a role field, so it cannot be bypassed by editing `public.users`.
