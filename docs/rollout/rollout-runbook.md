# Company Rollout Runbook — Nic's Copy

_Created 2026-08-18. Everything you do before, during and after the rollout meeting, in order._

**The materials:**
- Presentation deck (present from a browser, arrow keys move slides): https://claude.ai/code/artifact/411070b7-0bf6-42d0-afc5-e1814021525d
- Role cheat sheets (print one per person, each role prints on its own page): https://claude.ai/code/artifact/1b2559f1-238e-45c6-9633-a29c9380ca44

Both pages are private to you until you share them from the page's share menu.

---

## Step 1 — Collect emails (this week)

Send this to the company group chat (edit as you like):

> Hi all — we're switching to the new Greenqubes job system soon. I need ONE thing from each of you: the Google email you'll use to sign in. **Copy it from your Google account (Gmail app → tap your photo → the address under your name) — don't type it from memory.** Reply here or PM me. If you don't have a Google account, tell me and I'll help you make one.

**Why exact matters:** the app recognises people by exact email match. A typo means they see "account not set up" on the day. Copy-paste beats typing.

## Step 2 — Fill in the roster

| Name | Google email | Role | Digest? | Language | Provisioned | Linked TG |
|---|---|---|---|---|---|---|
| | | | | | [ ] | [ ] |
| | | | | | [ ] | [ ] |
| | | | | | [ ] | [ ] |
| | | | | | [ ] | [ ] |
| | | | | | [ ] | [ ] |
| | | | | | [ ] | [ ] |
| | | | | | [ ] | [ ] |
| | | | | | [ ] | [ ] |
| | | | | | [ ] | [ ] |
| | | | | | [ ] | [ ] |

Roles: `sales` / `scheduler` / `coordinator` / `installer` / `designer` / `production`. (You stay the only `admin`.)

**Digest?** = should they get the Monday knowledge digest and vote on it? Office roles usually yes, installers usually no — your call.

## Step 3 — Provision everyone (before the meeting, ~1 min each)

For each row: **Admin → Users → Provision new user** → email + name + role. Tick **digest subscriber** where you decided yes. The row shows "Waiting for sign-in" until they first log in — that's normal.

## Step 4 — Tech checks (a few days before)

- [ ] **The Connect Telegram feature must be live on production** (main), because the bot always answers from production — the preview can't reply. Test flow: preview first, then merge, then the real test below.
- [ ] **Test it yourself end-to-end:** profile picture → Connect Telegram → START. The bot should reply "your Telegram is now connected". (Your chat ID is already set, so this just re-writes it — harmless.)
- [ ] **Remove your Telegram chat ID from Wei Qing's row** (Admin → Users) — the old testing shortcut. Otherwise you'll get the scheduler's pings forever.
- [ ] **Delete the leftover test external contacts** from any job form's External installers bucket (kills their lifetime links).
- [ ] Projector/TV + a browser signed into the deck link; cheat sheets printed (right count per role).
- [ ] Wi-Fi password ready for the room — everyone needs internet on their phones.
- [ ] (Separate but due: **2FA on GitHub / Vercel / Supabase / Anthropic / Cloudflare** before the whole team is on the system.)

## The three bots — which is which

| Bot | What it does | Who needs to Start it |
|---|---|---|
| **@GreenqubesOps_bot** (Greenqubes Ops) | Job assignments, chat pings, overdue alerts. **This is the one the Connect Telegram button opens** — pressing START here is what links the account. | Everyone |
| **@Greenqubes_digest_bot** (Greenqubes Digest) | Monday knowledge digest + Promote/Skip voting. | Digest subscribers only — Telegram blocks a bot from messaging anyone who never pressed Start on it, so each subscriber must open this bot once and press START (no code, no linking — just Start). |
| **@greenqubes_bugs_bot** (Bug Reports) | Sends bug reports to you. | Nobody — it only talks to you. |

## Meeting agenda (~30 min)

1. **Present the deck** (~15 min) — slides 1–8 are the story, slide 9 is the signup, slide 10 is house rules.
2. **Signup** (~10 min) — everyone does slide 9's three steps on their phones while you walk the room. Hand out cheat sheets while they do it. **Digest subscribers do one extra tap:** search **@Greenqubes_digest_bot** in Telegram and press START, so Monday digests can reach them.
3. **Questions** (~5 min).

## Day-of fallback playbook

| Symptom | Cause | Fix on the spot |
|---|---|---|
| "Account not set up" after Google sign-in | Their sign-in email ≠ the email you provisioned | Admin → Users: check the email on their row. Fix it (or provision fresh with the right one). Then they **sign out and sign in again** — recognition happens at sign-in. |
| Tapped Connect Telegram, bot silent after START | Telegram hiccup or old app version | Have them send any message (e.g. "hi") to the bot — it replies with their **chat ID**. Paste that into their row yourself: Admin → Users → Edit. Same result, manual route. |
| No Telegram on their phone | — | Install Telegram first, sign up with their phone number, then redo the Connect step. Or skip and do it later — the app works without it; they just miss pings until connected. |
| Person not on your roster at all | Missed the email collection | Provision them on the spot (email + name + role), then they sign in. Two minutes. |
| Someone's role is wrong | — | Admin → Users → Edit → change role. Takes effect on their next page load. |

## After the meeting

- [ ] Admin → Users: **every row shows a Telegram chat ID** — chase the gaps within a day or two while it's fresh.
- [ ] Each **digest subscriber** confirmed they pressed START on @Greenqubes_digest_bot (next Monday's digest is the proof).
- [ ] Send one test ping if you want certainty (assign someone a real upcoming job — that's the realistic test).
- [ ] Tick off the roster's "Linked TG" column.
- [ ] Keep the cheat-sheet link pinned in the company group chat for latecomers.

## Notes

- The app address is **greenqubes-ops.vercel.app** — if a custom domain arrives at launch, the deck (slide 9), cheat sheets (setup box) and this runbook all need the address swapped.
- New hires later: same three steps — provision, they sign in, Connect Telegram. Nothing about this is rollout-day-only.
