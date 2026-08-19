---
session: feat-rollout (Company rollout pack + Connect Telegram + digest pipeline fixes)
date: 2026-08-18
branch: dev → main (four merges, all verified by Nic on production same evening)
---

# Company Rollout Pack + Connect Telegram + Digest Fixes — DONE

> Nic asked for the full company rollout: a presentation of the webapp, mass
> account signup, role assignment, and help with Telegram signups. Along the
> way his live testing exposed four real digest bugs — all root-caused and
> fixed the same evening. Context: the parallel chore-mobile session declared
> the webapp LAUNCHED v1.0.0 earlier today, so this rollout IS go-live prep.

## 1 — Rollout materials (docs/rollout/ + private artifacts)

- **Deck** (10 slides, scroll-snap, present from a browser):
  https://claude.ai/code/artifact/411070b7-0bf6-42d0-afc5-e1814021525d
- **Role cheat sheets** (6 printable pages — sales/scheduler/coordinator/
  installer/designer/production, each prints on its own A4 page):
  https://claude.ai/code/artifact/1b2559f1-238e-45c6-9633-a29c9380ca44
- **Nic's runbook** (email collection template, blank roster, tech checks,
  meeting agenda, fallback playbook, the three-bots table):
  https://claude.ai/code/artifact/846b7f53-074a-4d20-b687-a7af6f0c8ee9

Nic's decisions: deck + cheat sheets format; English only; **Option A** —
collect exact Google emails before the meeting (copy-pasted, not typed;
mismatch = "account not set up"). Pre-provisioning by email+name+role has
worked since feat-admin 2026-05-12 — nobody needs to sign in first; the
account links itself at first Google sign-in (auth callback matches by email;
if provisioned AFTER first sign-in, they must sign out/in once).

**Digest subscribers need one extra tap**: press START on
@Greenqubes_digest_bot — Telegram forbids a bot from messaging anyone who
never started it. Ops notifications need nothing beyond the Connect flow.

## 2 — Connect Telegram self-link (live on production)

Nic picked fully automatic linking (over bot-replies-with-ID and manual).

- **Design: signed deep link, nothing stored.** `/api/telegram/link`
  (authed) redirects to `https://t.me/GreenqubesOps_bot?start=<token>`;
  token = base64url(user uuid, 22ch) + HMAC-SHA256 signature (15 bytes,
  20ch) keyed on `TELEGRAM_BOT_TOKEN`. Fits Telegram's 64-char `A-Za-z0-9_-`
  payload rule. **No migration, no new env vars** — bot username fetched via
  `getMe` and cached in module scope.
- Webhook `/start <token>`: verify → service-client update of
  `telegram_chat_id` (deleted rows excluded) → HTML-escaped confirm reply.
  Any other DM → instructions + `Your chat ID is <code>…</code>` (the manual
  fallback in the runbook). Group chats ignored (`chat.type === 'private'`).
- UserMenu: "Connect Telegram" ↔ "Telegram connected ✓" (stays tappable —
  re-linking a new phone just overwrites the chat id).
- 15 standalone tests: `npx tsx src/lib/telegram/link-token.test.ts`.
- **Test caveat:** both bots' webhooks point at PRODUCTION — preview can
  verify the button/redirect only; bot replies and votes need main.

## 3 — Digest pipeline: four root causes, all fixed

Nic's live testing flushed these out one by one:

1. **Admin → Digest tab sent via the OPS bot** (`sendTelegramWithKeyboard`) —
   leftover from Session 14, missed in the feat-digest bot split (2026-05-20).
   Worse than flooding: `digest_vote` callbacks landed on the ops webhook,
   so Promote/Skip buttons on those messages were dead. → routed via
   `sendDigestTelegramWithKeyboard`.
2. **Voting said "Your account is not registered"** — Nic's soft-deleted
   "Nicholas (Personal)" row still shared his telegram_chat_id; the voter
   lookup `.eq(chat_id).single()` saw two rows and errored. The deleted row
   (digest_subscriber=true) also inflated the majority denominator and got
   broadcasts. → `deleted_at` filters on voter lookup (+ `maybeSingle` +
   error log), voter count, promoted broadcast, and the D-Promote recipient
   query (Monday cron `run.ts` + `timeout.ts` already filtered). **Data:**
   ghost row's chat id + digest tick cleared (verified 0 deleted rows hold a
   chat id).
3. **Promoted notes landed in the retired root `digest/` folder** — Nic
   reorganised the vault under `Table of Content/`. → `VAULT_DIGEST_DIR =
   'Table of Content/Digest'` in autoPromote; `commitVaultFile` now
   URL-encodes path segments (spaces). Recorded in CONTEXT.md.
4. **Vault writes died silently** — `autoPromoteToVault` was fire-and-forget
   in the digest webhook, and **Vercel freezes a function the moment its
   response returns**, killing unfinished promises (the Sonnet summary takes
   seconds). The 19:55 success was luck; the 20:14 "Plywood" promotion
   recorded the vote but never wrote. Same class: the D-Promote send in
   /api/assistant/save. → both awaited with try/catch. **Verified live:
   vote 20:24:09 → GitHub commit 20:24:17 (8 s).** The stranded Plywood note
   was rescued by running autoPromoteToVault locally, then all three test
   notes deleted from the vault at Nic's request (before the 2:30 AM sync
   could embed them).

Also: assistant replies "I see what you did there 😏" to any message
containing `D-Promote` (exact case, same match as tagger/save) — short-
circuits before the model call, so tests cost nothing; promotion unchanged.

## Digest rules (restated for Nic during the session)

Strict majority (>50%) of ALL subscribers-with-Telegram for either outcome,
resolved instantly at the deciding vote; daily 8 AM SGT timeout cron
dismisses anything unresolved 5 days after its first vote (timeout can only
dismiss — yes-majorities already resolved live). Currently Nic is the sole
voter → his single Promote/Skip resolves instantly.

## Facts worth keeping

- **Never fire-and-forget async work in a Vercel API route** — await it.
  Lesson recorded in CONTEXT.md next to the digest section.
- **`.single()` treats duplicates as errors** — a reverse lookup on a
  non-unique column (telegram_chat_id) needs `deleted_at` filters and
  `maybeSingle`, or it reports "not found" for the wrong reason.
- Telegram: private-chat `from.id` == chat id; a bot can only message users
  who STARTed it; deep-link payload ≤64 chars of `A-Za-z0-9_-`.
- PS 5.1 gotcha: double quotes inside `git commit -m @'…'@` here-strings
  break native arg passing — keep commit messages quote-free.
- Obsidian: Nic's vault Git plugin auto-pulls every 11 min + on boot
  (`.obsidian/plugins/obsidian-git/data.json` in greenqubes-kb), so vault
  changes reach his Obsidian in minutes; the server 2:30 AM job is only for
  the assistant's KB.
- Bots: @GreenqubesOps_bot (ops + Connect link), @Greenqubes_digest_bot
  (digest), @greenqubes_bugs_bot (bug reports → TELEGRAM_BUG_CHAT_ID env,
  not tied to users).

## Key files

| File | Change |
|---|---|
| `src/lib/telegram/link-token.ts` (+ `.test.ts`) | signed /start tokens (15 tests) |
| `src/app/api/telegram/link/route.ts` | authed redirect to bot deep link (getMe cached) |
| `src/app/api/telegram/webhook/route.ts` | /start link handler, help reply with chat ID |
| `src/components/UserMenu.tsx` | Connect Telegram / connected item |
| `src/app/api/admin/digest/route.ts` | send via digest bot |
| `src/app/api/telegram/digest-webhook/route.ts` | deleted_at filters; awaited vault write |
| `src/app/api/assistant/save/route.ts` | deleted_at filter; awaited D-Promote send |
| `src/app/api/assistant/chat/route.ts` | D-Promote canned smirk reply |
| `src/lib/digest/autoPromote.ts` | VAULT_DIGEST_DIR = Table of Content/Digest |
| `src/lib/github/vault.ts` | URL-encoded path segments |
| `docs/rollout/` | deck, cheat sheets, runbook (sources) |

## ⚠️ Notes for next session

- **Rollout to-dos are on Nic's checklist** (Team onboarding section):
  collect emails → pre-provision → meeting → verify chat IDs. Runbook has
  every step and fallback.
- **Future item added:** instant promotion into the assistant's KB at vote
  time (skip the 2:30 AM wait) — needs a small session.
- The parallel chore-mobile session (same day) declared v1.0.0 launched and
  set the mobile app as the roadmap — read its note + spec first.
- If the app ever gets a custom domain, swap the address in deck slide 9,
  the cheat-sheet setup boxes, and the runbook.
