# Monday Digest Bot — Design Spec

_Date: 2026-05-20_

---

## Goal

Move the Monday digest off the main Telegram bot onto a dedicated bot. The main bot handles operational noise (job approvals, overdue alerts, send-backs, messages). The digest bot handles only the weekly digest and its Promote/Skip voting. The two bots are completely independent.

---

## New env vars

| Var | Purpose |
|---|---|
| `TELEGRAM_DIGEST_BOT_TOKEN` | Token for the new digest-only bot (from BotFather) |
| `TELEGRAM_DIGEST_WEBHOOK_SECRET` | Random secret to authenticate Telegram → server webhook calls |

Both are already added to Vercel (all 3 environments) and `.env.local`.

---

## Architecture

### 1. `src/lib/telegram/bot.ts` — three new functions

Add digest-specific equivalents of the existing keyboard/edit/answer functions, reading from `TELEGRAM_DIGEST_BOT_TOKEN` instead of `TELEGRAM_BOT_TOKEN`:

- `sendDigestTelegram(chatId, text)` — sends a plain text message via the digest bot (used for promote link notification)
- `sendDigestTelegramWithKeyboard(chatId, text, keyboard)` — sends digest items with inline buttons
- `editDigestTelegramMessage(chatId, messageId, text, keyboard?)` — edits a digest message after a vote
- `answerDigestCallbackQuery(callbackQueryId, text?)` — dismisses the loading spinner on a button tap

No changes to the existing main-bot functions.

### 2. `src/lib/digest/run.ts` — switch to digest bot

Replace `sendTelegramWithKeyboard` calls with `sendDigestTelegramWithKeyboard`. The promote link notification at the end of a majority-yes vote also switches to `sendDigestTelegramWithKeyboard` (via a plain send inside the new webhook — see below). The rest of the logic (DB queries, summarisation, vote filtering) is unchanged.

### 3. `/api/telegram/digest-webhook/route.ts` — new route

New POST handler for callbacks from the digest bot. Identical structure to the existing main webhook but:
- Validates against `TELEGRAM_DIGEST_WEBHOOK_SECRET`
- Only handles `digest_vote:*` callback data
- Uses `answerDigestCallbackQuery`, `editDigestTelegramMessage`, and a plain `sendDigestTelegram` for the promote link notification
- No message text handler needed (digest bot receives no free-text commands)

### 4. `/api/telegram/webhook/route.ts` — clean up

Remove the `digest_vote:*` branch from `handleCallbackQuery`. After this change the main webhook only handles future work commands (the existing `// TODO: route commands` stub stays).

---

## Data flow — voting (after change)

1. Digest runs → `sendDigestTelegramWithKeyboard` → digest bot sends item to each scheduler's DM
2. Scheduler taps Promote or Skip → Telegram sends callback to `/api/telegram/digest-webhook`
3. Webhook validates secret, calls `answerDigestCallbackQuery` (dismisses spinner)
4. Webhook upserts vote to `digest_votes`, recalculates outcome
5. `editDigestTelegramMessage` updates the message with current vote counts
6. If majority yes → `sendDigestTelegram` sends promote link to all schedulers via digest bot

---

## One-time manual setup (after deploy)

Steps must be done in this order:

1. **Message the new digest bot first** — open Telegram, find your new bot, send "hi". This opens the DM so the bot is allowed to send you messages.

2. **Register the webhook** — run this once after the new route is deployed:

```
curl -X POST "https://api.telegram.org/bot<TELEGRAM_DIGEST_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://greenqubes-ops.vercel.app/api/telegram/digest-webhook",
    "secret_token": "<TELEGRAM_DIGEST_WEBHOOK_SECRET>"
  }'
```

---

## Secret force-promote command — D-Promote

Any conversation where a user message contains the exact string `D-Promote` (case-sensitive) bypasses Haiku's importance scoring entirely and is force-set to importance 5 before saving.

This happens in `tagger.ts` before the Haiku call: if any message in the transcript contains `D-Promote`, return early with `importance: 5` and let Haiku classify the rest of the fields (topic, tags, visibility) normally.

The `D-Promote` text is not stripped from the conversation — it stays in the transcript so the summary Haiku writes on Monday will include the full context.

Only Nic knows this command. It is not documented in the UI or any user-facing surface.

---

## What does NOT change

- Database schema — no new tables, no migrations
- `digest_votes` table and its upsert logic
- Scheduler `telegram_chat_id` values — same Telegram user ID, just a different bot contacting them
- Promote link generation and `/api/digest/promote/[chatId]` route
- All main-bot notification routes (approve, send-back, overdue, messages, bugs)

---

## Files changed

| File | Change |
|---|---|
| `src/lib/telegram/bot.ts` | Add 3 digest-specific functions |
| `src/lib/digest/run.ts` | Switch to `sendDigestTelegramWithKeyboard` |
| `src/app/api/telegram/digest-webhook/route.ts` | New file — digest webhook handler |
| `src/app/api/telegram/webhook/route.ts` | Remove `digest_vote:*` branch |
