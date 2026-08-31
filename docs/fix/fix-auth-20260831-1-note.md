---
session: fix-auth (Google first-login bounce + the middleware that never ran)
date: 2026-08-31
branch: dev → main (preview checked by Nic, merged same day — live on production; production probed afterwards)
---

# Google first-login bounce — root-caused, fixed; gatekeeper switched on

> Nic's report: the first "Sign in with Google" bounced back to
> `/login?error=auth`; the second attempt went through; logout/login fine after.
> Commits: `38c1d1b` (callback + login page), `f28f6db` (middleware), merged to
> main as `338ae2d`.

## Root cause (reproduced, not guessed)

1. **A stale session cookie** — an old login whose refresh key is no longer
   valid — was sitting in the browser and nothing cleaned it up on normal page
   loads. It survived `/` → `/login` → the Google round-trip untouched (proven
   with a crafted stale cookie against production: no `Set-Cookie` deletions
   on either response).
2. **The OAuth callback tripped over it.** Creating the callback's Supabase
   client makes `@supabase/ssr` emit an initial-session load
   (`_emitInitialSession → _useSession → __loadSession → _callRefreshToken`).
   The refresh fails (`Refresh token is not valid`) and the library's clean-up
   `_removeSession()` deletes the session cookie **and the one-time PKCE
   code-verifier cookie** — concurrently with `exchangeCodeForSession`. When
   the clean-up lands first the exchange throws
   `AuthPKCECodeVerifierMissingError` (`pkce_code_verifier_not_found`) →
   `?error=auth`. Forced locally with a 400 ms delay before the exchange.
3. **Why the retry works:** the callback is a Route Handler, so its cookie
   deletions reach the browser — the stale cookie is finally gone and attempt
   two starts clean.
4. **Underneath it all: the middleware never ran.** `middleware.ts` sat at the
   repo root, but with the app under `src/` Next.js only reads
   `src/middleware.ts`. Build manifest: `"middleware": {}`; unknown pages
   404'd instead of bouncing; API routes answered 403 instead of redirecting —
   identical locally and on production. Pages/routes self-guard so nobody
   noticed, but the middleware is the only place a server-side token refresh
   can be *saved* (Server Components swallow `cookies().set`), so refreshed
   sessions were lost → dead cookies → the stale cookie in step 1.

## What shipped

- **`src/app/auth/callback/route.ts`** — deletes any `sb-*-auth-token*`
  cookie (never the code-verifier) before creating its client, so there is
  nothing stale to refresh; logs the exact failure reason on any failed
  exchange (`[auth/callback] code exchange failed: {name, message, code,
  verifierCookie}`) and the `error`/`error_description` params when Supabase
  sends back no code. Verified: with the stale cookie present the callback
  makes no refresh attempt and the exchange reaches Supabase with the
  verifier intact.
- **`src/middleware.ts`** (moved from the root) — `classifyPath()` skips
  `/api/*` (every route self-guards; crons, Telegram webhooks and the signed
  digest link carry their own secrets — `/api/notifications/overdue` is a cron
  *not* under `/api/cron/`), `/ext/*`, `/auth/*` (never touch the callback:
  a refresh-failure there would wipe the verifier from the forwarded
  request), `/mockups/*`. Every redirect copies `supabaseResponse.cookies`
  onto the new response (the documented `NextResponse.redirect` pitfall —
  before, a cleared or refreshed session was dropped on every bounce).
  Login page: signed-in users → `/`. Soft-deleted users → sign out →
  `/login?error=account_removed`.
- **Login page** split into a server `page.tsx` (reads `searchParams`) +
  client `LoginCard.tsx`; shows `en.authError` for `?error=auth` and the new
  `en.authAccountRemoved` for `?error=account_removed` (the red line existed
  but was never fed).
- **Tests** (standalone, `npx tsx …`): `src/lib/auth/session-cookies.test.ts`
  (9) and `src/lib/auth/middleware-scope.test.ts` (20). All 11 repo suites
  green (190 checks). Type-check + production build green; build manifest now
  lists the middleware.

## Verification

- Local dev replays with a crafted stale cookie + verifier (curl): gatekeeper
  alive (unknown page → 307 `/login`), API passthrough (403), stale cookie
  deleted on the first redirect and on `/login`, both error messages render,
  mockups + `/ext/*` public, callback → `flow_state_not_found` with the
  verifier present (fake code) and **no** refresh error in the log.
- Dev preview: Nic's five-point checklist passed; then the same curl probes
  through the new bypass secret.
- Production after the merge: all probes pass; login-less paths answer with
  their own codes (overdue/digest crons 403, Telegram webhook 405, signed
  digest link 401, mockups 200) — nothing newly redirected.

## Nic's decisions

- Tagger: skipped, no changes (session start).
- Fix order approved as proposed: callback hardening + login message first,
  middleware switch-on as its own commit.
- Preview checked → merge to main, same day.
- **Vercel Protection Bypass for Automation: dashboard only** (the
  admin-page "Open dev preview" button was offered and declined). Secret in
  `.env.local` as `VERCEL_AUTOMATION_BYPASS_SECRET` (git-ignored); sent as
  the `x-vercel-protection-bypass` header; verified on the dev preview.

## Facts worth keeping

- Vercel previews SSO-gate **every** non-browser request (pages, API,
  callbacks). Production is public and can be curled directly.
- `@supabase/ssr` 0.5.2 + auth-js 2.105.1: `_removeSession()` deletes the
  code-verifier too; a `getUser()`/initial-session load on a request that
  carries a stale session cookie will trigger it. Keep the callback free of
  any stale session, and keep the middleware away from `/auth/*`.
- The auto-mode permission checker blocks chained git one-liners
  (`checkout && pull`, `merge; log`) and even a piped `checkout | tail` —
  run git commands one per call.
- The Design Load session (other window, worktree
  `../greenqubes-ops-design-load`) committed its session-end docs to `dev` at
  13:03 today, after this session's start-of-day read — re-read docs before
  editing at session end when two windows are active.
- A `node -e '…'` one-liner mangles `\n`/`\r` escapes through the shell; write
  helper scripts to the scratchpad with the Write tool and run them instead.

## ⚠️ Next session

- **Design Load** (`feat-designer-load-flow`, NOT merged): B3 Telegram on
  every due-date shift, edge-snap FABs (edit 15), override modal copy
  (edit 16), then Nic's merge call. It inherits today's fix on merge; only
  `src/lib/i18n/en.ts` overlaps (both add strings) — expect at most a
  one-line nudge. Its own preview keeps the old bounce until then.
- If `?error=auth` ever recurs, the reason is in Vercel → Logs
  (`[auth/callback] …`).
- Backlog unchanged: mobile app spec review; filing-only Office attachments;
  Office-file reading (dependency OK needed); instant vault→KB promotion;
  Telegram watchdog; backup event logging; lower-priority security hardening.
