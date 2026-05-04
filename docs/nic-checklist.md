# Nic's checklist — things only you can do

> Updated after each session. Claude handles the coding; this doc tracks every manual action, setup step, or decision that needs a human.

_Last updated: Session 17 (2026-05-04)_

---

## Right now — known bug to fix in Session 18

- [ ] **Job chat realtime not working** — messages save and Telegram fires, but the chat UI requires a page refresh to show new messages. WebSocket connects but Supabase drops realtime events (suspected RLS custom-function issue). Fix planned for Session 18 — see `docs/session17(live-chat)-note.md` for full diagnosis and two fix options.

---

## Server PC — backup setup

- [ ] **Install rclone** and configure the `greenqubes-r2` remote (see `scripts/backup.sh` header for exact config steps)
- [ ] **Set `SUPABASE_DB_URL`** as a system environment variable (Supabase dashboard → Settings → Database → Direct connection URI)
- [ ] **Schedule `scripts/backup.sh`** as a daily Windows Task Scheduler job at 03:00 SGT (see script header for exact schtasks command)

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
  - Trigger: daily at 2 AM

---

## Monday digest

- [ ] **Test the digest manually** before relying on the cron:
  ```
  npm run monday-digest
  ```
  Should send to all users marked as digest subscribers with a Telegram Chat ID set.

---

## Ongoing — after go-live

- [ ] **Provision team accounts** — Admin → Users tab → Provision new user. Each person must have signed in via Google at least once first.
- [ ] **Collect Telegram chat IDs** — each team member messages your bot once; copy their chat ID into their user row from Admin → Users tab → Edit.
- [ ] **Set digest subscribers** — Admin → Digest tab → Subscriber panel → check the box for each person who should receive the Monday digest.
- [ ] **Add Google OAuth redirect URI for production** — Google Cloud Console → your OAuth client → Authorised redirect URIs → add `https://greenqubes-ops.vercel.app/auth/callback`
- [ ] **Turn on 2FA** on every service account — GitHub, Vercel, Supabase, Anthropic, Cloudflare. Takes 10 minutes.
- [ ] **Check first few Monday digests manually** — review the first 2–3 digests to confirm what surfaces is worth promoting to Obsidian.

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
- [x] Supabase DB schema applied (migrations 0001–0007)
- [x] Seed data applied (Sarah/Kai/Ravi/Ali + 4 demo jobs)
- [x] Vercel deployed — https://greenqubes-ops.vercel.app
- [x] All env vars set in Vercel dashboard
- [x] Telegram webhook pointed at Vercel URL
- [x] Supabase auth callback URL added for Vercel
- [x] Your Telegram Chat ID added to your user record
- [x] `messages` + `files` tables added to `supabase_realtime` publication
- [x] `REPLICA IDENTITY FULL` set on `messages` + `files`
- [x] GreenqubesAI scheduler account provisioned + tested
- [x] Supabase project linked via CLI (`npx supabase link`)
