# Security & Integrity Audit — 2026-08-13

> Full-codebase review (not a diff review — the working tree was clean).
> Scope: access control (RLS), auth, API routes, exposed secrets, file storage,
> webhooks/crons, injection surfaces. Requested by Nic as the pre-go-live
> "full security + integrity audit" standing item.

**Headline:** one **critical** privilege-escalation hole (any logged-in user can
make themselves admin) plus two **medium** broken-access-control issues. Everything
else — login, the external installer links, the AI assistant's data filtering,
secret handling, injection surfaces — held up well.

---

## Findings (most severe first)

### 1. CRITICAL — Any logged-in user can promote themselves to admin (or scheduler)

> **STATUS: FIXED in code 2026-08-13** — `supabase/migrations/0044_users_guard_privileged_columns.sql`
> adds a `BEFORE UPDATE` trigger that blocks non-admin end-user sessions from
> changing `role`, `auth_id`, `email`, `deleted_at`, `digest_subscriber`, or
> `telegram_chat_id` on any `users` row. **Pending `npx supabase db push` (Nic) +
> preview verification.** Also fixed the stale claim in `docs/nic-checklist.md`.

- **Where:** `supabase/migrations/0002_rls.sql` — policy `users: own record update only`
  (never overridden by a later migration).
- **Category:** privilege escalation / broken access control.
- **What's wrong:** the row-level-security rule lets a user update their own `users`
  row (`using auth_id = auth.uid()`), but there is **no restriction on which columns**
  they may change. Postgres RLS is row-level, not column-level. So a user can change
  their own `role` field.
- **How it's exploited:** an installer (or any authenticated account) opens the
  browser console on the live site — where the app's Supabase client and their login
  session already exist — and runs a single update:
  ```js
  await supabase.from('users').update({ role: 'admin' }).eq('auth_id', <their id>)
  ```
  RLS allows it (the row is theirs, `auth_id` is unchanged). They are now admin.
- **Why it matters:** admin was changed from an email gate to a **role** back in
  migration 0019 (feat-admin, 2026-05-14). Every admin gate now checks
  `role === 'admin'` (`src/app/api/admin/**`, `src/app/admin/page.tsx`,
  `getEffectiveRole`). Nothing checks the Google email any more. So flipping the role
  column grants the full admin panel (provision/remove users, health, crashes, digest)
  **and** admin's RLS bypass on `kb_chunks`. Even flipping to `scheduler` alone exposes
  every job, all `job_financials` (margins/costs), every user's private AI
  conversations (`asst_chats: scheduler reads all`), and the `events` audit log — none
  of which an installer is ever supposed to see.
- **Confidence:** very high (0.95). Confirmed: no later migration narrows the policy,
  and no trigger or column GRANT blocks the `role` change.
- **Stale doc that hides this:** `docs/nic-checklist.md` line 472 still claims admin is
  "hard-gated to `ai@greenqubes.com` … cannot be bypassed by editing `public.users`."
  That was true before migration 0019 and is now false. Fix the note too.
- **Fix:** stop users from changing their own `role` (and ideally `deleted_at`,
  `digest_subscriber`, `telegram_chat_id`, `email`, `auth_id`). Options:
  1. Replace the blanket update policy with a `WITH CHECK` that pins `role` to its
     current value — e.g. a `BEFORE UPDATE` trigger that rejects any change to
     privileged columns unless the caller is admin/service-role; **or**
  2. Remove the direct-update policy entirely and route the few legitimate self-edits
     (language, phone) through a server API route on the service client that only
     writes the safe columns. Given admin is now a pure DB role, option 1 (a trigger
     guarding `role`/`deleted_at`) is the tightest.

### 2. MEDIUM — Any logged-in user can delete the entire client list

> **STATUS: FIXED in code 2026-08-13** — migration `0045_lock_client_tables_and_file_key_index.sql`
> restricts `clients`/`client_contacts` insert+delete to office roles
> (sales/scheduler/coordinator/admin); SELECT stays open for the dropdowns. The
> four client mutation routes also gained a matching server-side role gate.
> **Pending `npx supabase db push` (Nic).**

- **Where:** `supabase/migrations/0026_client_tables.sql` (RLS `using (true)` for
  select/insert/delete on `clients` and `client_contacts`) + `src/app/api/clients/[id]/route.ts`
  (DELETE checks only that you're logged in, no role check).
- **Category:** broken access control / unauthorized data destruction.
- **What's wrong:** the `clients` and `client_contacts` tables grant every
  authenticated user full insert/delete rights, and the delete API route has no role
  gate. `client_contacts` is `ON DELETE CASCADE`, so deleting a client also wipes its
  contacts.
- **How it's exploited:** any account (installer included) calls
  `DELETE /api/clients/{id}` or runs `supabase.from('clients').delete()` from the
  browser — removing customers from the master list, or bulk-inserting junk.
- **Why it matters:** the client master list feeds the job form's company/POC
  dropdowns. It's reconstructable from existing jobs, so this is data-integrity damage
  rather than a data breach — but an installer wiping the customer list mid-operations
  is real disruption.
- **Confidence:** high (0.9).
- **Fix:** restrict `clients`/`client_contacts` insert/delete (and probably the
  contacts routes) to office roles — e.g. `sales/scheduler/coordinator/admin` — in both
  the RLS policies and the API routes, matching the pattern already used elsewhere.

### 3. MEDIUM — File download links are minted for any key, with no access check

> **STATUS: FIXED in code 2026-08-13** — the route now looks the key up first:
> a `files` row → allowed only if the caller can see the owning job (jobs RLS);
> a `bug_reports` screenshot key → scheduler/admin only; anything else → 404.
> Uses the new `files_r2_key_idx` (migration 0045). No DB push needed for the
> route logic itself, but the index ships in 0045.

- **Where:** `src/app/api/r2/download-url/route.ts` → `getDownloadUrl(key)` in
  `src/lib/storage/r2.ts`.
- **Category:** broken object-level authorization (IDOR).
- **What's wrong:** the route signs a download URL for **whatever R2 key the caller
  sends**, after only checking they're logged in. It never verifies the key belongs to
  a job the caller may see. (The *upload* route does check job access via RLS — the
  download route is the asymmetric gap.)
- **How it's exploited:** an authenticated user who obtains a file key for a job they
  aren't on can fetch that file (permit-to-work docs, BCA files, photos) regardless of
  role or assignment.
- **Mitigation that lowers severity:** keys embed a random UUID as the object name
  (`jobs/{folder}/{kind}/{uuid}.ext`), so they can't be guessed or enumerated — an
  attacker must already have obtained a specific key through some channel (a stale
  assignment, a shared link, browser history). That makes this hard to exploit at
  scale, but the authorization check is genuinely missing.
- **Confidence:** high that the check is absent (0.85); medium on easy exploitability.
- **Fix:** before signing, look up the `files` row by `r2_key` **through the
  RLS-respecting client** and confirm it resolves for this caller (or re-check the
  job's access). If RLS returns nothing, return 404.

### 4. LOW–MEDIUM — A user can overwrite/rename another user's saved AI conversation

> **STATUS: FIXED in code 2026-08-13** — `rename` now uses the RLS client (the
> `asst_chats: own update` policy scopes it; 404 when no owned row matched);
> `updateChat` takes the caller's `userId` and scopes both its lookup and update
> by `user_id`, so a foreign `existingId` falls back to inserting the caller's
> own new row instead of overwriting someone else's. No DB change needed.

- **Where:** `src/app/api/assistant/rename/route.ts` and
  `src/app/api/assistant/save/route.ts` → `updateChat()` in
  `src/lib/supabase/queries/assistant.ts`.
- **Category:** IDOR (write/tamper).
- **What's wrong:** both use the **service-role client** (which bypasses RLS) and filter
  only by `.eq('id', chatId)` / `existingId` with no check that the conversation
  belongs to the caller. So passing another user's chat id lets you rename it (`rename`)
  or overwrite its messages/topic/tags/embedding (`save` with `existingId`).
- **Mitigation:** chat ids are UUIDs (unguessable), and nothing is *read back* — this
  is tampering with someone else's private history, not disclosure.
- **Confidence:** high that ownership scoping is missing (0.85); low impact.
- **Fix:** add `.eq('user_id', callerId)` to the update, or do the update on the
  RLS-respecting client (the `asst_chats: own update` policy already exists and would
  enforce it). `pinChat`/`deleteChat` already go through RLS and are fine — mirror them.

---

## Lower-priority / hardening notes

- **Fail-open webhook & cron auth.** `telegram/webhook`, `telegram/digest-webhook`,
  `cron/monday-digest`, `cron/digest-timeout`, `notifications/overdue` all use
  `if (secret) { check }` — if the secret env var is ever unset, the check is skipped
  and the endpoint is fully open (e.g. forging digest votes → auto-promoting a note to
  the Obsidian vault; triggering Telegram blasts). Assuming the secrets are set in
  Vercel this is inert, but it should **fail closed** (reject when the secret is
  missing) so a config slip can't silently open them.
- **Notification spoofing.** `notifications` INSERT policy is `auth.uid() is not null`
  with no `user_id` ownership check, so a user could insert a fake bell-drawer
  notification into anyone's account. Nuisance-level. Reads/updates/deletes are properly
  user-scoped.
- **Telegram HTML templates.** Messages are sent with HTML parse mode and interpolate
  user text (project titles, chat content). Not an app-XSS vector, but a crafted title
  could inject a fake link/formatting inside a Telegram notification. Low priority;
  escape interpolated values if tidying.
- **Crash route is unauthenticated** (`/api/crash`) and writes attacker-controllable
  fields (incl. `userEmail`). Content is React-escaped when shown in admin, so no stored
  XSS; the only effect is log spoofing/noise (explicitly out of scope). Consider a light
  guard if it's ever abused.

---

## What was checked and is solid

- **Login / session / middleware** (`middleware.ts`, `auth/callback`): unauthenticated
  users are redirected; soft-deleted users are signed out at both the middleware and the
  callback; the "preview as" override (`getEffectiveRole`) is honored **only** for real
  admins, so it's not an escalation path.
- **External installer links** (`/ext/[token]` + `/api/ext/**`): token is an unguessable
  UUID; every read/write is scoped to that contact and gated on job acceptance; deleted
  contacts return 410. No IDOR found.
- **AI assistant data filtering** (`retrieve.ts` + `match_kb_chunks`/`match_asst_chats`
  in migration 0004): the search functions are `SECURITY INVOKER`, so the caller's RLS
  visibility rules apply — restricted supplier costing and other users' private chats do
  **not** leak into the assistant. This is the access-control-critical path and it holds.
- **Job data routes** (assign-installers, submit, duplicate, messages, tasks, etc.):
  server-side role checks present; chat posting and job reads go through the
  RLS-respecting client.
- **Admin routes** (`/api/admin/**`): all guarded by a server-side `role === 'admin'`
  check (the weakness is finding #1 upstream, not these routes).
- **Secrets:** no `.env*` committed (gitignored); no hardcoded API keys/passwords in
  tracked code; the service-role key is used only in server routes/scripts, never shipped
  to the browser.
- **Injection:** no `dangerouslySetInnerHTML` anywhere; all DB access is through the
  parameterized query builder / RPC — no raw or string-built SQL.

---

## Recommended order of fixes

1. **#1 (critical) — lock down self-role change** before any real team member gets an
   account. This is the one that must not ship as-is.
2. **#2 (client tables) and #3 (download links)** — both are quick RLS/route tightenings.
3. **#4 + hardening notes** — batch into the same pass.

All four main fixes are small and can go in one migration + a couple of route edits,
tested on the `dev` preview before merging to `main` (and DB push before code push,
per the standing rule).
