---
session: chore-db (Brand logo swap + full production test-data wipe)
date: 2026-08-13
branch: dev → main (logo live on production; wipe ran directly against production DB + R2)
---

# Brand Logo + Test-Data Wipe — DONE

> Two jobs this session: (1) Nic's GreenQubes logo PNG replaced the text
> wordmark in the top bar and on the login page, live on production; (2) all
> test data was wiped from the production database and R2 — every job, all job
> files, bug reports, in-app notifications and crash logs — leaving a clean
> slate for Session 19 pre-alpha testing. User accounts, clients, the external
> contact pool, assistant chats and the knowledge base were kept.

## 1 — Brand logo swap (commit `debeca2`, dev → main merge `99ebb23`)

- Source file: `GQ logo.png` from Nic's Desktop (found by search, confirmed
  against the chat attachment) → committed as `public/greenqubes-logo.png`
  (51 KB, 4314×487).
- **CompanyBar** (`src/components/CompanyBar.tsx`) — text wordmark replaced
  with the logo at `h-5`; the "Pre-Alpha" tag was **removed** (Nic's call).
- **Login page** (`src/app/(auth)/login/page.tsx`) — typed GREENQUBES wordmark
  replaced with the centred logo at `h-7`.
- **Dark mode** — Tailwind's `dark:` variant is NOT wired up in this app
  (next-themes flips CSS variables via a `.dark` class; `tailwind.config.ts`
  has no `darkMode: 'class'`), so the brightness lift is a plain CSS rule in
  `globals.css`: `.dark .brand-logo { filter: brightness(1.4); }`. Light mode
  shows the original colours untouched.
- Type-check + production build green; Nic verified the preview, then
  dev → main.

## 2 — Test-data wipe (production DB + R2)

Scope set by Nic across two refinements: all jobs + their attachments, plus
bug reports (with screenshots), in-app notifications, and crash logs. Keep
everything needed for logins and reference data.

**Deleted (all verified zero afterwards):**

| What | Count |
|---|---|
| `jobs` (35 scheduled / 10 pending / 1 completed — incl. the ~27 stale backlog) | 46 |
| `files` / `messages` / `attachment_buckets` (cascade) | 20 / 12 / 183 |
| `job_assignees` / `job_tasks` / `job_external_contacts` (cascade) | 30 / 1 / 3 |
| `bug_reports` / `notifications` / `crash_logs` | 1 / 0 / 27 |
| R2 `jobs/` objects | 41 (15.6 MB) |
| R2 `bug-reports/` objects | 3 |

**Kept:** `users` (all logins), `clients` + `client_contacts`,
`external_contacts` pool (lifetime links still open, show no jobs),
`asst_chats`, `kb_chunks`, `events`, `api_usage`.

**Method:** one-off script `scripts/wipe-test-data.ts` — dry-run by default,
deletion only behind `--execute`. Dry-run counts were shown to Nic and
approved before execution. DB deletes used the service-role client; a single
`DELETE` on `jobs` cascaded every child table (all job-child FKs are
`ON DELETE CASCADE` — checked in migrations first). R2 wiped by prefix:
**all** job files live under `jobs/` (both the old `jobs/{id}/` and new
readable-folder styles — `generateKey` always prefixes `jobs/`), bug
screenshots under `bug-reports/`. Cloudflare Images checked: not wired into
any upload flow, nothing to clean. **The script was deleted after use**
(Nic's call — "probably won't use it anymore"); it is not in the repo.

## Facts worth keeping

- **Archive mirror is sync, not history:** the deleted R2 objects survive in
  `E:\Greenqubes-Archive\r2` on the server PC only until the next 02:00
  rclone sync mirrors the deletion. The 02:00 DB dumps DO keep history — the
  pre-wipe database is recoverable from the 2026-08-13 dump.
- This dev PC is **not** the server PC — no `E:` drive, no rclone. R2 access
  from here goes through the repo's `@aws-sdk/client-s3` + `.env.local` creds
  (same client as `src/lib/storage/r2.ts`).
- Script invocation pattern for one-offs in this repo:
  `node --use-system-ca --import tsx --env-file=.env.local scripts/<file>.ts`.
- All job-child tables cascade from `jobs`; `api_usage.job_id` and
  `events` references are `set null` / plain — deleting jobs never blocks.

## Key files

| File | Change |
|---|---|
| `public/greenqubes-logo.png` | new — brand logo asset |
| `src/components/CompanyBar.tsx` | logo replaces wordmark; Pre-Alpha tag removed |
| `src/app/(auth)/login/page.tsx` | logo replaces wordmark |
| `src/app/globals.css` | `.brand-logo` dark-mode brightness rule |
| `scripts/wipe-test-data.ts` | created, executed, **deleted** — not in repo |

## ⚠️ Notes for next session

- Production is a clean slate — Session 19 pre-alpha testing can start on
  fresh data (versioning V.0.0.0.1 per plan.md).
- Test external contacts: their pool entries + lifetime links still exist
  (links open, show no jobs). Delete from any job form's External installers
  bucket if the links should die — still an open checklist item.
- The checklist's backup follow-ups (backup health event, Telegram watchdog
  decision, old-password sweep) remain open.
