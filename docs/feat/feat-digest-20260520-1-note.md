# feat-digest-20260520-1 — Dedicated Digest Bot + D-Promote + Voting Polish

**Date:** 2026-05-20
**Branch:** dev → main

---

## What was built

### Dedicated digest Telegram bot
Separated the Monday digest entirely from the main ops notification bot. All digest messages, votes, and timeout notifications now go through a second bot using `TELEGRAM_DIGEST_BOT_TOKEN` and `TELEGRAM_DIGEST_WEBHOOK_SECRET`. The main ops bot is untouched.

New files:
- `src/app/api/telegram/digest-webhook/route.ts` — handles `digest_vote:yes/no:<chatId>` callback queries from inline buttons
- `src/lib/digest/run.ts` — updated to use digest bot functions for Monday sends

New bot functions in `src/lib/telegram/bot.ts`:
- `sendDigestTelegram`, `sendDigestTelegramWithKeyboard`, `editDigestTelegramMessage`, `answerDigestCallbackQuery`
- Private `digestPost()` helper

Middleware (`middleware.ts`) updated to exclude `/api/telegram/` and `/api/cron/` from auth redirect.

### D-Promote secret command
Typing `D-Promote` anywhere in an assistant conversation:
1. Forces `importance = 5` in the auto-tagger (`src/lib/ai/tagger.ts`)
2. Triggers an immediate digest send to all `digest_subscriber` users outside the Monday schedule (`src/app/api/assistant/save/route.ts` — `sendDigestNow()`)
3. Strips the word from the Telegram summary so recipients don't see it (`src/lib/digest/run.ts` — `summariseChatForDigest()`)

Only Nic knows this command. Not documented in any user-facing surface.

### Voting logic fixes
- **Fire-and-forget bug** — Vercel kills serverless functions after HTTP response; changed webhook handler from fire-and-forget to `await` so `answerCallbackQuery` and `editMessageText` actually run.
- **totalVoters bug** — was counting only `role = 'scheduler'` users; changed to count all `digest_subscriber = true` users with `telegram_chat_id` set. This matches the actual send list.
- **Threshold fix** — both Promote and Dismiss now require strict `> 50%` majority. Previously Dismiss used `>= 50%` which caused a single skip out of 2 voters to immediately dismiss.

### Live poll count display
`tplVoteStatus` in `src/lib/telegram/templates.ts` updated:
- Always shows `📊 X Yes · Y No · Z Pending` on every vote edit
- Appends outcome line below when resolved: `Information Promoted to Vault!` or `Information Dismissed!`
- Buttons removed from voter's own message copy immediately after they vote (other subscribers keep their buttons)

### 5-day timeout cron
New files:
- `src/lib/digest/timeout.ts` — `runDigestTimeout()`: finds importance ≥ 4 chats still pending after 5 days, auto-resolves (strict majority yes → promoted, else dismissed; ties → dismissed), fills remaining votes in DB to prevent re-triggering
- `src/app/api/cron/digest-timeout/route.ts` — GET handler with CRON_SECRET auth
- `vercel.json` — added `digest-timeout` cron at `0 0 * * *` (08:00 SGT daily)

Timeout message format uses new `tplVoteStatusTimeout` template:
```
<b>Topic</b>
★★★★★
19 May
——————————————————
Majority Vote Shows (Time Out):
📊 2 Yes · 0 No · 0 Pending
Information Promoted to Vault!
```

### digest_subscriber flag respected everywhere
All 5 digest recipient queries updated to filter `digest_subscriber = true` in addition to `telegram_chat_id IS NOT NULL`:
- `src/app/api/assistant/save/route.ts` (D-Promote send)
- `src/app/api/telegram/digest-webhook/route.ts` (totalVoters count + promote notification)
- `src/lib/digest/run.ts` (Monday digest send)
- `src/lib/digest/timeout.ts` (timeout recipients + voter count)

### CLAUDE.md update
Added step 5 to the session start protocol: ask Nic about any updates to the importance scoring categories (1–5 scale in `src/lib/ai/tagger.ts`).

---

## Key files changed

| File | Change |
|---|---|
| `src/app/api/telegram/digest-webhook/route.ts` | New — digest vote webhook |
| `src/app/api/cron/digest-timeout/route.ts` | New — timeout cron handler |
| `src/lib/digest/timeout.ts` | New — timeout logic |
| `src/lib/telegram/bot.ts` | Added 4 digest bot functions |
| `src/lib/telegram/templates.ts` | Updated `tplVoteStatus`; added `tplVoteStatusTimeout` |
| `src/lib/digest/run.ts` | Switched to digest bot; added `summariseChatForDigest` |
| `src/lib/ai/tagger.ts` | D-Promote force-sets importance = 5 |
| `src/app/api/assistant/save/route.ts` | D-Promote triggers immediate digest send |
| `middleware.ts` | Excludes webhook + cron routes from auth redirect |
| `vercel.json` | Added digest-timeout daily cron |
| `CLAUDE.md` | Session start: ask about importance scoring |

---

## Bugs fixed this session

1. **Promote/Skip buttons did nothing** — fire-and-forget killed by Vercel before async work ran → changed to `await`
2. **Poll count never showed** — `totalVoters` defaulted to 1 (only counted schedulers) → single vote hit 100% immediately → changed to count all digest subscribers
3. **Skip immediately dismissed** — `>=` threshold meant 1 skip out of 2 = 50% → dismissed → changed to `>` (strict)
4. **Pending count wrong** — unchecked user still counted because only `telegram_chat_id IS NOT NULL` was checked → added `digest_subscriber = true` filter
5. **Buttons stayed active after voting** — voter's message always re-rendered with buttons if outcome was pending → now always passes empty keyboard on voter's message edit

---

## Pending (not done this session)

- **[MAJOR] History sidebar doesn't refresh** — sidebar fetches once on mount; new saves don't appear until page reload
- **[MAJOR] Clicking history item creates duplicate** — `loadFromHistory` re-saves already-saved conversations; no `isDirty` flag
- **AdminRoleModal double-Yes bug** — confirm modal requires two presses; likely state race condition
- **Schedule page visual overhaul** — Nic to share target design screenshot
- **Bulk delete jobs** — Design A chosen, no API route yet
- **Scheduler: send scheduled job back to sales**
- **Scheduler: delete job button**
- **Sales: recall job (rename Send Back)**
