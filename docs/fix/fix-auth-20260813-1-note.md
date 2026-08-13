---
session: fix-auth (Full security & integrity audit + fixes — 4 access-control findings closed)
date: 2026-08-13
branch: dev → main (all fixes live on production; migrations 0044 + 0045 applied)
---

# Security Audit + Fixes — DONE, live on production

> Nic's standing pre-go-live item ("full security + integrity audit") was run:
> a full-app review of access control (RLS), auth, every API route, exposed
> secrets, file storage, webhooks/crons and injection surfaces. It found **4 real
> access-control holes — all fixed and merged to main the same session.** The
> headline: any logged-in user could make themselves admin. Full technical
> write-up lives alongside this note at `docs/security-audit-20260813.md`.

## Scope

Whole-codebase (the working tree was clean, so this was not a diff review).
Checked: middleware/auth callback, admin gating, all 54 API routes, all 45 RLS
migrations, the public `/ext/[token]` surface, Telegram webhooks + cron
protection, R2 signed-URL handling, committed secrets, and injection surfaces
(XSS / raw SQL). Standing memory respected — audit done directly with
Grep/Read/Glob, no exploration subagents.

## Findings + fixes (all live on production)

**#1 — CRITICAL: self-service admin escalation.** The `users: own record update
only` RLS policy (migration 0002) let a user update their own row but had **no
column restriction** (Postgres RLS is row-level, not column-level), so any
authenticated user could change their own `role` straight from the browser
client: `supabase.from('users').update({ role: 'admin' }).eq('auth_id', <self>)`.
Admin became a **pure DB role** in migration 0019 (every gate checks
`role === 'admin'`; nothing checks the email any more), so this granted the full
admin panel + admin's `kb_chunks` RLS bypass. Even `scheduler` alone exposes all
jobs, `job_financials`, every user's private `asst_chats` (scheduler-reads-all),
and the `events` audit log — none of which an installer may see.
→ **Fix: migration 0044** — a `BEFORE UPDATE` trigger
(`guard_users_privileged_columns`) that rejects changes to
`role`/`auth_id`/`email`/`deleted_at`/`digest_subscriber`/`telegram_chat_id` for
non-admin end-user sessions. Allowed paths are unaffected because they carry no
end-user JWT (`auth.uid()` is null for the service-role client used by the admin
routes, the soft-delete path, and the auth callback) or are real admins; ordinary
self-edits (lang/phone via `/api/user/lang`) don't touch privileged columns.

**#2 — MEDIUM: anyone could wipe the client list.** `clients` +
`client_contacts` were created (0026) with `using(true)` / `with check(true)`
insert+delete policies, and `/api/clients/[id]` DELETE had no role gate — so any
authenticated user (installer included) could delete every client
(`ON DELETE CASCADE` takes the contacts too) or bulk-insert junk.
→ **Fix: migration 0045** restricts insert+delete to
`sales/scheduler/coordinator/admin` (SELECT stays open for the dropdowns); the
four client mutation routes gained a matching server-side role gate.

**#3 — MEDIUM: download links signed for any key.** `/api/r2/download-url` signed
a URL for whatever `key` the caller sent, checking only that they were logged in
— no object-level authorization (the upload route *does* check job access; the
download route was the asymmetric gap).
→ **Fix:** the route now looks the key up first — a `files` row is allowed only
if the caller can see the owning job (via the jobs RLS on their session); a
`bug_reports` screenshot key is scheduler/admin only; anything else 404s. Uses
`files_r2_key_idx` (0045). Bonus: authorizing on *job* visibility also closes the
prior gap where designer/coordinator/production (who have no `files` SELECT
policy) couldn't reliably download files on jobs they may see. The public
`/ext/[token]/job/[jobId]` path is unaffected (it signs server-side after token +
acceptance checks, never via this route).

**#4 — LOW–MED: cross-user assistant-chat tampering.** `assistant/rename` and
`save`→`updateChat(existingId)` wrote `asst_chats` via the **service client**
(RLS bypass) filtered only by `id`, so a foreign chat UUID could be renamed or
its messages overwritten. (Unguessable UUID + no read-back → tampering, not
disclosure.)
→ **Fix:** `rename` now uses the RLS client (the `asst_chats: own update` policy
scopes it; 404 on no match); `updateChat` takes the caller's `userId` and scopes
both its lookup and update by `user_id`, so a foreign `existingId` falls back to
inserting the caller's own new row.

## What was checked and is solid (no change needed)

- **Login / session / middleware** — redirects, soft-delete sign-out at both
  middleware and callback; the "preview as" override (`getEffectiveRole`) is
  honored **only** for real admins, so it's not an escalation path.
- **External `/ext/[token]`** — token is an unguessable UUID; every read/write is
  scoped to the contact and gated on job acceptance; deleted → 410.
- **AI assistant RAG** — `match_kb_chunks` / `match_asst_chats` are
  `SECURITY INVOKER`, so the caller's RLS visibility applies; restricted supplier
  costing + other users' private chats do not leak into the model. (The
  access-control-critical path — it holds.)
- **Secrets** — no `.env*` committed (gitignored); no hardcoded keys in tracked
  code; the service-role key is server-only, never shipped to the browser.
- **Injection** — no `dangerouslySetInnerHTML`; all DB access via the
  parameterized query builder / RPC (no raw SQL).

## Lower-priority hardening — logged, NOT fixed (Nic's call: fix whenever)

Captured in `docs/nic-checklist.md` under "Security hardening — lower priority":
1. **Fail-closed webhook/cron secrets** — the Telegram webhooks + cron routes use
   `if (secret) { check }`; if a secret env var were ever unset the endpoint would
   be open (forge digest votes → auto-promote to vault; trigger Telegram blasts).
   Should reject when the secret is missing. Inert today if secrets are set.
2. **Notification-insert spoofing** — `notifications` INSERT policy is
   `auth.uid() is not null` with no owner check, so a user can insert a fake bell
   notification into anyone's drawer. Reads/updates/deletes are owner-scoped.
3. **Telegram HTML escaping** — messages use HTML parse mode and interpolate user
   text unescaped; a crafted title could inject a fake link inside a TG message.

Also logged: the **service-outage resilience** portion of the audit item (what
happens if Vercel/Supabase/R2/Telegram goes down mid-op, recovery drill per
service) — not exercised this session; worth its own session before go-live.

## Deployment

- Migration 0044 → committed, `dev`→`main` (commit `90eebdc` / merge `e0f4ec8`),
  Nic ran `npx supabase db push`. Verified by clean apply.
- Migrations 0045 + the #2/#3/#4 code → committed (`6828f08`), `dev`→`main`
  (merge `929f1e7`), Nic ran `npx supabase db push`. Type-check + `next build`
  green before push; preview-verified the three legitimate flows (add a client,
  download a job file, rename an assistant chat).
- Docs corrected: the "admin is email-gated / can't be bypassed by editing
  public.users" note in `nic-checklist.md` was false since 0019 — rewritten;
  `context.md` access-control section now records the 0044 invariant.

## Key files

| File | Change |
|---|---|
| `supabase/migrations/0044_users_guard_privileged_columns.sql` | new — trigger blocking self-escalation |
| `supabase/migrations/0045_lock_client_tables_and_file_key_index.sql` | new — client-table role lock + `files_r2_key_idx` |
| `src/app/api/r2/download-url/route.ts` | authorize by job visibility; bug screenshots scheduler/admin |
| `src/app/api/clients/route.ts`, `clients/[id]/route.ts`, `clients/[id]/contacts/route.ts`, `clients/contacts/[id]/route.ts` | office-role gates on POST/DELETE |
| `src/app/api/assistant/rename/route.ts` | RLS client (owner-scoped) + 404 on no match |
| `src/lib/supabase/queries/assistant.ts` (`updateChat`) + `src/app/api/assistant/save/route.ts` | `userId`-scoped update |
| `docs/security-audit-20260813.md` | new — full findings write-up |
| `docs/nic-checklist.md`, `docs/context.md`, `docs/plan.md` | audit recorded; stale admin-gate note corrected |

## ⚠️ Notes for next session

- **Standing rule reinforced:** admin is a DB role — any future edit to the
  `users` update RLS/trigger must keep non-admins from changing their own `role`.
  Never re-open blanket self-update on `users`.
- The 3 hardening items + the service-outage resilience review are the remaining
  security work; all non-blocking.
- Pre-go-live test-data cleanup + backup follow-ups (from the 2026-08-12 infra
  sessions) still pending.
