# Digest Bot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the Monday digest off the main Telegram bot onto a dedicated digest-only bot, and add a secret `D-Promote` command that force-flags any conversation for the digest.

**Architecture:** Add digest-specific send/edit/answer functions to `bot.ts` using `TELEGRAM_DIGEST_BOT_TOKEN`. Create a new `/api/telegram/digest-webhook` route that handles only `digest_vote:*` callbacks via the digest bot. Strip digest handling from the main webhook. Add D-Promote detection to `tagger.ts` before the Haiku call.

**Tech Stack:** Next.js API routes, Telegram Bot API, TypeScript

---

## File Map

| Action | File | What changes |
|---|---|---|
| Modify | `src/lib/ai/tagger.ts` | Add D-Promote early-exit before Haiku call |
| Modify | `src/lib/telegram/bot.ts` | Add 4 digest-specific functions |
| Modify | `src/lib/digest/run.ts` | Switch to digest bot functions |
| Create | `src/app/api/telegram/digest-webhook/route.ts` | New webhook for digest bot callbacks |
| Modify | `src/app/api/telegram/webhook/route.ts` | Remove digest_vote handling |

---

### Task 1: D-Promote detection in tagger

**Files:**
- Modify: `src/lib/ai/tagger.ts`

- [ ] **Step 1: Add D-Promote check before the Haiku call**

Open `src/lib/ai/tagger.ts`. The `tagConversation` function builds a `transcript` string, then calls Haiku. Add the check immediately after `transcript` is built (after line 20, before the `let text = '{}'` line):

```typescript
export async function tagConversation(
  msgs: { role: string; content: string }[],
  _userRole: Role,
): Promise<ChatTag> {
  const transcript = msgs
    .map(m => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n')
    .slice(0, 4000)

  // Secret force-promote: any message containing D-Promote bypasses scoring
  const forcePromote = msgs.some(m => m.content.includes('D-Promote'))

  let text = '{}'
  try {
    const res = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: `You classify internal business conversations for a Singapore install company.
Return ONLY valid JSON with these exact fields:
- topic: string (max 8 words, e.g. "roof waterproofing job for Jurong")
- entities: string[] (names, job IDs, client names, locations mentioned)
- tags: string[] (2–5 keyword tags)
- importance: number 1–5 (5 = critical business knowledge like supplier prices or client escalations, 1 = trivial chitchat)
- visibility: string[] — choose from: ["public-internal","role:sales","role:scheduler","role:installer"]
  Rules:
  - "public-internal" → install techniques, SOPs, how-to, general logistics
  - "role:sales" or "role:scheduler" → client costs, quotes, margins, financial info
  - "role:installer" → field-crew-only information
  - Default to ["public-internal"] unless clearly sensitive`,
      messages: [{ role: 'user', content: `Classify this conversation:\n\n${transcript}` }],
    })
    text = res.content.find(b => b.type === 'text')?.text ?? '{}'
  } catch {
    // classification is best-effort; fall back to safe defaults
  }

  try {
    const json = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? '{}') as Record<string, unknown>
    return {
      topic:      typeof json.topic === 'string'      ? json.topic : 'General',
      entities:   Array.isArray(json.entities)        ? (json.entities as string[]) : [],
      tags:       Array.isArray(json.tags)            ? (json.tags as string[])     : [],
      importance: forcePromote ? 5 : (typeof json.importance === 'number' ? Math.max(1, Math.min(5, json.importance)) : 2),
      visibility: Array.isArray(json.visibility)      ? (json.visibility as string[]) : ['public-internal'],
    }
  } catch {
    return { topic: 'General', entities: [], tags: [], importance: forcePromote ? 5 : 2, visibility: ['public-internal'] }
  }
}
```

- [ ] **Step 2: Typecheck**

```
npx tsc --noEmit
```

Expected: no errors in `tagger.ts`.

- [ ] **Step 3: Commit**

```
git add src/lib/ai/tagger.ts
git commit -m "feat(tagger): add D-Promote force-importance override"
```

---

### Task 2: Add digest bot functions to bot.ts

**Files:**
- Modify: `src/lib/telegram/bot.ts`

- [ ] **Step 1: Add four digest-specific functions**

Append the following to the bottom of `src/lib/telegram/bot.ts`, before the `// ── Internal ───` section (insert before the `export type InlineKeyboardButton` line):

```typescript
// ── Digest bot ─────────────────────────────────────────────────────────────────
// Mirror of main-bot functions but reads TELEGRAM_DIGEST_BOT_TOKEN.
// Used exclusively by the Monday digest and its webhook.

export async function sendDigestTelegram(chatId: string, text: string): Promise<void> {
  await digestPost(chatId, text)
}

export async function sendDigestTelegramWithKeyboard(
  chatId:   string,
  text:     string,
  keyboard: InlineKeyboardButton[][],
): Promise<number | null> {
  const res = await digestPost(chatId, text, keyboard)
  if (!res) return null
  try {
    const body = await res.json() as { ok: boolean; result?: { message_id: number } }
    return body.result?.message_id ?? null
  } catch {
    return null
  }
}

export async function editDigestTelegramMessage(
  chatId:    string,
  messageId: number,
  text:      string,
  keyboard?: InlineKeyboardButton[][],
): Promise<void> {
  const token = process.env.TELEGRAM_DIGEST_BOT_TOKEN
  if (!token || !chatId?.trim()) return

  const body: Record<string, unknown> = {
    chat_id:    chatId,
    message_id: messageId,
    text,
    parse_mode: 'HTML',
  }
  if (keyboard !== undefined) {
    body.reply_markup = { inline_keyboard: keyboard }
  }

  const res = await fetch(`${TELEGRAM_API}/bot${token}/editMessageText`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.text()
    if (!err.includes('message is not modified')) {
      console.error('[telegram-digest] editMessageText failed', res.status, err)
    }
  }
}

export async function answerDigestCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
  const token = process.env.TELEGRAM_DIGEST_BOT_TOKEN
  if (!token) return

  const res = await fetch(`${TELEGRAM_API}/bot${token}/answerCallbackQuery`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ callback_query_id: callbackQueryId, text }),
  })
  if (!res.ok) {
    console.error('[telegram-digest] answerCallbackQuery failed', res.status, await res.text())
  }
}

async function digestPost(
  chatId:   string,
  text:     string,
  keyboard?: InlineKeyboardButton[][],
): Promise<Response | null> {
  const token = process.env.TELEGRAM_DIGEST_BOT_TOKEN
  if (!token) {
    console.warn('[telegram-digest] TELEGRAM_DIGEST_BOT_TOKEN not set — skipping send')
    return null
  }
  if (!chatId?.trim()) return null

  const body: Record<string, unknown> = { chat_id: chatId, text, parse_mode: 'HTML' }
  if (keyboard) body.reply_markup = { inline_keyboard: keyboard }

  const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })

  if (!res.ok) {
    console.error('[telegram-digest] sendMessage failed', res.status, await res.text())
    return null
  }
  return res
}
```

- [ ] **Step 2: Typecheck**

```
npx tsc --noEmit
```

Expected: no errors in `bot.ts`.

- [ ] **Step 3: Commit**

```
git add src/lib/telegram/bot.ts
git commit -m "feat(telegram): add digest bot send/edit/answer functions"
```

---

### Task 3: Update digest runner to use digest bot

**Files:**
- Modify: `src/lib/digest/run.ts`

- [ ] **Step 1: Swap the import and the two send calls**

In `src/lib/digest/run.ts`, change the import line:

```typescript
// Before
import { sendTelegramWithKeyboard } from '@/lib/telegram/bot'

// After
import { sendDigestTelegramWithKeyboard } from '@/lib/telegram/bot'
```

Then replace both occurrences of `sendTelegramWithKeyboard` with `sendDigestTelegramWithKeyboard`. There are exactly two:

1. The header send (around line 84):
```typescript
// Before
await sendTelegramWithKeyboard(voter.telegram_chat_id, tplDigestHeader({ weekOf, count: toSend.length }), [])
// After
await sendDigestTelegramWithKeyboard(voter.telegram_chat_id, tplDigestHeader({ weekOf, count: toSend.length }), [])
```

2. The per-item send with keyboard (around line 104):
```typescript
// Before
await sendTelegramWithKeyboard(voter.telegram_chat_id, text, keyboard)
// After
await sendDigestTelegramWithKeyboard(voter.telegram_chat_id, text, keyboard)
```

- [ ] **Step 2: Typecheck**

```
npx tsc --noEmit
```

Expected: no errors in `run.ts`.

- [ ] **Step 3: Commit**

```
git add src/lib/digest/run.ts
git commit -m "feat(digest): route digest messages through digest bot"
```

---

### Task 4: Create digest webhook route

**Files:**
- Create: `src/app/api/telegram/digest-webhook/route.ts`

- [ ] **Step 1: Create the file**

Create `src/app/api/telegram/digest-webhook/route.ts` with this content:

```typescript
import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  answerDigestCallbackQuery,
  editDigestTelegramMessage,
  sendDigestTelegram,
  type InlineKeyboardButton,
} from '@/lib/telegram/bot'
import { tplVoteStatus } from '@/lib/telegram/templates'

export async function POST(req: NextRequest) {
  const secret = process.env.TELEGRAM_DIGEST_WEBHOOK_SECRET
  if (secret) {
    const incoming = req.headers.get('x-telegram-bot-api-secret-token')
    if (incoming !== secret) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const update = await req.json() as TelegramUpdate

  if (update.callback_query) {
    handleCallbackQuery(update.callback_query).catch(err =>
      console.error('[digest webhook] callback_query handler error:', (err as Error).message)
    )
  }

  return NextResponse.json({ ok: true })
}

async function handleCallbackQuery(cq: CallbackQuery) {
  const data = cq.data ?? ''
  if (data.startsWith('digest_vote:')) {
    await handleDigestVote(cq, data)
  }
}

async function handleDigestVote(cq: CallbackQuery, data: string) {
  const parts = data.split(':')
  if (parts.length !== 3) {
    await answerDigestCallbackQuery(cq.id, 'Invalid vote data')
    return
  }
  const [, rawVote, chatId] = parts
  const vote = rawVote as 'yes' | 'no'

  if (vote !== 'yes' && vote !== 'no') {
    await answerDigestCallbackQuery(cq.id, 'Invalid vote')
    return
  }

  const db = createServiceClient()
  const telegramUserId = String(cq.from.id)

  const { data: voterRow } = await db
    .from('users')
    .select('id, name')
    .eq('telegram_chat_id', telegramUserId)
    .single()

  if (!voterRow) {
    await answerDigestCallbackQuery(cq.id, 'Your account is not registered in the system.')
    return
  }

  const { data: chat } = await db
    .from('asst_chats')
    .select('id, topic, tags, importance, ts, msgs')
    .eq('id', chatId)
    .single()

  if (!chat) {
    await answerDigestCallbackQuery(cq.id, 'Conversation not found.')
    return
  }

  const { error: voteErr } = await db
    .from('digest_votes')
    .upsert(
      { chat_id: chatId, voter_id: voterRow.id, vote },
      { onConflict: 'chat_id,voter_id' },
    )

  if (voteErr) {
    console.error('[digest webhook] vote upsert failed:', voteErr.message)
    await answerDigestCallbackQuery(cq.id, 'Failed to record vote — please try again.')
    return
  }

  await answerDigestCallbackQuery(cq.id, vote === 'yes' ? '✅ Vote recorded' : '❌ Vote recorded')

  const { data: votes } = await db
    .from('digest_votes')
    .select('vote')
    .eq('chat_id', chatId)

  const yesCount = (votes ?? []).filter(v => v.vote === 'yes').length
  const noCount  = (votes ?? []).filter(v => v.vote === 'no').length

  const { count: totalVoters } = await db
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'scheduler')
    .not('telegram_chat_id', 'is', null)

  const total = totalVoters ?? 1

  const promoted  = yesCount / total > 0.5
  const dismissed = noCount / total >= 0.5
  const outcome   = promoted ? 'promoted' : dismissed ? 'dismissed' : 'pending'

  const chatDate = new Date(chat.ts).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })
  const statusText = tplVoteStatus({
    index:       1,
    topic:       chat.topic ?? 'Untitled conversation',
    date:        chatDate,
    importance:  chat.importance ?? 4,
    summary:     '',
    yesCount,
    noCount,
    totalVoters: total,
    outcome,
  })

  const keyboard: InlineKeyboardButton[][] = outcome === 'pending'
    ? [[
        { text: '✅ Promote', callback_data: `digest_vote:yes:${chatId}` },
        { text: '❌ Skip',    callback_data: `digest_vote:no:${chatId}`  },
      ]]
    : []

  if (cq.message) {
    await editDigestTelegramMessage(
      String(cq.message.chat.id),
      cq.message.message_id,
      statusText,
      keyboard,
    )
  }

  if (promoted) {
    const promoteUrl = buildPromoteUrl(chatId)
    const { data: schedulers } = await db
      .from('users')
      .select('telegram_chat_id')
      .eq('role', 'scheduler')
      .not('telegram_chat_id', 'is', null)

    for (const s of schedulers ?? []) {
      if (s.telegram_chat_id) {
        await sendDigestTelegram(
          s.telegram_chat_id,
          `📝 <b>${chat.topic ?? 'Conversation'}</b> reached majority — tap to get your Obsidian note:\n${promoteUrl}`,
        )
      }
    }
  }
}

function buildPromoteUrl(chatId: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? `https://${process.env.VERCEL_URL ?? 'localhost:3001'}`
  const sig = crypto
    .createHmac('sha256', process.env.CRON_SECRET!)
    .update(chatId)
    .digest('hex')
    .slice(0, 16)
  return `${appUrl}/api/digest/promote/${chatId}?sig=${sig}`
}

type CallbackQuery = {
  id:       string
  data?:    string
  from:     { id: number }
  message?: { message_id: number; chat: { id: number } }
}

type TelegramUpdate = {
  update_id:       number
  callback_query?: CallbackQuery
}
```

- [ ] **Step 2: Typecheck**

```
npx tsc --noEmit
```

Expected: no errors in the new file.

- [ ] **Step 3: Commit**

```
git add src/app/api/telegram/digest-webhook/route.ts
git commit -m "feat(telegram): add digest-only webhook route"
```

---

### Task 5: Strip digest handling from main webhook

**Files:**
- Modify: `src/app/api/telegram/webhook/route.ts`

- [ ] **Step 1: Replace the entire file contents**

All imports except `NextRequest`/`NextResponse` were only used by the digest vote handler. Replace `src/app/api/telegram/webhook/route.ts` in its entirety with:

```typescript
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (secret) {
    const incoming = req.headers.get('x-telegram-bot-api-secret-token')
    if (incoming !== secret) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const update = await req.json() as TelegramUpdate

  if (update.message?.text) {
    const chatId = String(update.message.chat.id)
    const text   = update.message.text.trim()
    console.log(`[telegram webhook] message chat=${chatId} text="${text}"`)
    // TODO: route commands — e.g. /jobs, /status <job-id>
  }

  if (update.callback_query) {
    handleCallbackQuery(update.callback_query).catch(err =>
      console.error('[telegram webhook] callback_query handler error:', (err as Error).message)
    )
  }

  return NextResponse.json({ ok: true })
}

async function handleCallbackQuery(cq: CallbackQuery) {
  const data = cq.data ?? ''
  console.log(`[telegram webhook] unhandled callback: ${data}`)
  // Future work callback types go here
}

type CallbackQuery = {
  id:       string
  data?:    string
  from:     { id: number }
  message?: { message_id: number; chat: { id: number } }
}

type TelegramUpdate = {
  update_id: number
  message?: {
    message_id: number
    chat:  { id: number; type: string }
    from?: { id: number; username?: string; first_name: string }
    text?: string
  }
  callback_query?: CallbackQuery
}
```

- [ ] **Step 2: Typecheck**

```
npx tsc --noEmit
```

Expected: no errors. Confirm no remaining references to `digest_vote`, `handleDigestVote`, `tplVoteStatus`, or `editTelegramMessage` in this file.

- [ ] **Step 3: Commit**

```
git add src/app/api/telegram/webhook/route.ts
git commit -m "chore(telegram): strip digest handling from main webhook"
```

---

### Task 6: Push and register webhook

- [ ] **Step 1: Push to dev**

```
git push origin dev
```

Wait for Vercel preview deploy to complete (check https://vercel.com dashboard).

- [ ] **Step 2: Register the digest webhook with Telegram**

Replace `<TELEGRAM_DIGEST_BOT_TOKEN>` and `<TELEGRAM_DIGEST_WEBHOOK_SECRET>` with the actual values from `.env.local`:

```
curl -X POST "https://api.telegram.org/bot<TELEGRAM_DIGEST_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"https://greenqubes-ops.vercel.app/api/telegram/digest-webhook\", \"secret_token\": \"<TELEGRAM_DIGEST_WEBHOOK_SECRET>\"}"
```

Expected response: `{"ok":true,"result":true,"description":"Webhook was set"}`

- [ ] **Step 3: Message the digest bot on Telegram**

Open Telegram, find the new digest bot by its username, send it any message (e.g. "hi"). This opens the DM so the bot is allowed to send you messages.

- [ ] **Step 4: Manual smoke test — D-Promote**

Open the AI assistant in the app. Type a message that includes `D-Promote` (e.g. "We agreed to use supplier X for all future jobs. D-Promote"). End the conversation. Check the `asst_chats` table in Supabase — the new row should have `importance: 5`.

- [ ] **Step 5: Manual smoke test — digest send**

Run the digest manually:

```
npm run monday-digest
```

Expected: console logs show `[monday-digest] done — sent X items` and the digest items arrive in the **digest bot** DM, not the main ops bot DM. Promote/Skip buttons appear on each item.

- [ ] **Step 6: Manual smoke test — vote buttons**

Tap **Promote** or **Skip** on a digest item. Expected: spinner dismisses, message updates with vote counts. If majority yes, a promote link message follows from the digest bot.
