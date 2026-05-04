# Session 12 Notes — Obsidian Sync + Monday Digest (Voting)

> Read at the start of Session 13 alongside CONTEXT.md and plan.md.

_Done: 2026-05-04_

---

## What was built

The knowledge-base loop: a nightly Obsidian sync that populates `kb_chunks` for RAG retrieval, and a weekly Monday digest with a Telegram-native **majority voting system** that decides what gets promoted to Obsidian.

| File | Purpose |
|---|---|
| `scripts/obsidian-sync.ts` | Walks the Obsidian vault, chunks each `.md` into ~500-token pieces, embeds via Voyage AI, upserts to `kb_chunks` (idempotent on `source_path,chunk_index`). Removes stale chunks for deleted files. |
| `scripts/monday-digest.ts` | Pulls high-importance `asst_chats` (importance ≥ 4). Sends each to all schedulers via Telegram with ✅/❌ inline keyboard buttons. Includes new items this week + any old items with zero votes (re-prompt). |
| `src/app/api/digest/promote/[id]/route.ts` | HMAC-verified GET route. Re-summarises the conversation via Claude Haiku. Returns an HTML page with a formatted Obsidian note ready to copy-paste. |
| `src/app/api/telegram/webhook/route.ts` | Handles `digest_vote` callback queries: records vote, checks majority, edits the original Telegram message in-place, sends the promote link to all voters on YES majority. |
| `supabase/migrations/0005_digest_votes.sql` | `digest_votes` table — `(chat_id, voter_id, vote, ts)`, unique per voter per chat, RLS enabled. |
| `src/lib/supabase/types.ts` | Added `digest_votes` Row/Insert/Update types. |
| `src/lib/telegram/bot.ts` | Extended with `sendTelegramWithKeyboard`, `editTelegramMessage`, `answerCallbackQuery`. Refactored `sendTelegram` to share an internal `telegramPost` helper. |
| `src/lib/telegram/templates.ts` | Added `tplDigestHeader`, `tplDigestItem` (no promote link — voting handles that), `tplVoteStatus` (pending / promoted / dismissed). |
| `package.json` | Added `tsx` devDependency. Added `npm run obsidian-sync` + `npm run monday-digest` scripts. |
| `.env.local.example` | Added `OBSIDIAN_VAULT_PATH` + `NEXT_PUBLIC_APP_URL`. |

---

## Architecture

### Obsidian sync

```
npm run obsidian-sync
  → walkVault(OBSIDIAN_VAULT_PATH)         skips dotfiles, recurses all subdirs
  → for each .md file:
      parseFrontmatter(raw)                regex YAML → visibility[], tags[]
      chunkText(body)                      split by paragraphs, ≤2000 chars/chunk
      for each chunk:
        embed(chunk)                       Voyage API, voyage-3, 1024 dims
        db.from('kb_chunks').upsert(...)   onConflict: source_path,chunk_index
  → select all kb_chunks source_paths
  → delete rows whose source_path no longer exists in the vault
```

Notes with no frontmatter default to `visibility: ['public-internal']`. More restricted notes set `visibility: [role:scheduler]` etc. in their YAML.

KB is now live — the assistant's RAG retrieval (Session 11) starts returning real company knowledge on the next query.

### Monday digest + voting

```
npm run monday-digest
  → fetch all schedulers with telegram_chat_id      (these are the voters)
  → fetch asst_chats with importance >= 4
  → fetch all digest_votes
  → filter to: new items this week OR zero votes cast
  → sendTelegramWithKeyboard(voters, tplDigestHeader)
  → for each item:
      summarise(msgs) via Claude Haiku
      sendTelegramWithKeyboard(voters, tplDigestItem, [✅ Promote, ❌ Skip])
        callback_data: "digest_vote:yes|no:<chatId>"
```

### Vote handling (Telegram webhook)

```
Voter taps ✅ or ❌ on Telegram
  → POST /api/telegram/webhook  (Telegram callback_query event)
  → parse "digest_vote:yes|no:<chatId>"
  → lookup voter by telegram_chat_id → users.id
  → db.from('digest_votes').upsert(...)   onConflict: chat_id,voter_id
  → answerCallbackQuery()                 dismiss Telegram loading spinner
  → fetch updated vote counts
  → fetch total voter count (schedulers with telegram_chat_id)
  → determine outcome:
      yes / total > 0.5  → 'promoted'
      no  / total >= 0.5 → 'dismissed'
      otherwise          → 'pending'
  → editTelegramMessage(original message, tplVoteStatus, keyboard if pending)
  → if promoted:
      buildPromoteUrl(chatId)             HMAC-SHA256(CRON_SECRET, chatId).slice(0,16)
      sendTelegram(all voters, promote link)
```

### Promote page

```
Voter taps promote link → GET /api/digest/promote/[id]?sig=<sig>
  → verifySignature(id, sig)
  → fetch asst_chats row
  → summarise(msgs) via Claude Haiku     (optimised for Obsidian note style)
  → return HTML page with <pre> note + copy button
```

---

## Voting rules

| Condition | Outcome |
|---|---|
| yes votes / total voters > 50% | Promoted — promote link sent to all voters |
| no votes / total voters ≥ 50% | Dismissed — never re-prompted |
| Zero votes cast | Re-prompted in next Monday digest |
| Some votes, no majority | Dismissed (not re-prompted) |

Voters can change their vote — the upsert on `(chat_id, voter_id)` updates the existing row and re-evaluates the majority.

"Who votes" = all schedulers with `telegram_chat_id` for now. Admin page (Session 14) adds per-user digest voter configuration.

---

## Key decisions

| Decision | Why |
|---|---|
| Telegram inline keyboard for voting | One-tap on mobile, no separate web login. Native to Telegram which the team already uses. |
| Edit-in-place on vote | Keeps vote count visible in the same message thread; voters see each other's votes building up. |
| Webhook fire-and-forget | Vote handler is kicked off async; webhook returns 200 to Telegram immediately to avoid retries. |
| Votes can be changed | Small team — if someone taps wrong, they can correct it. Upsert handles naturally. |
| HMAC-SHA256 16-char prefix for promote URL | Tamper protection without a full session flow. `CRON_SECRET` reused — no new env var. |
| Re-summarise in promote route | Avoids storing the summary. Haiku call is < $0.001. |
| `tsx --env-file=.env.local` | No dotenv dependency; Node 20.6+ flag passed through by tsx. |
| Stale chunk cleanup via select + delete | No `DELETE WHERE NOT IN` shorthand in Supabase JS — select then delete is readable. |
| Default visibility `public-internal` for notes without frontmatter | Notes missing frontmatter are assumed broadly shareable internally. Restrictive notes must opt in via YAML. |

---

## How to run

```bash
# Add to .env.local first:
# OBSIDIAN_VAULT_PATH=C:/Users/YourName/Documents/YourVault
# NEXT_PUBLIC_APP_URL=http://localhost:3001

npm run obsidian-sync      # nightly — Windows Task Scheduler or GitHub Actions
npm run monday-digest      # weekly — GitHub Actions cron (see below)
```

**Apply DB migration before running:**
```bash
npx supabase db push       # applies 0005_digest_votes.sql
```

**GitHub Actions cron for monday-digest:**
```yaml
on:
  schedule:
    - cron: '0 1 * * 1'   # 01:00 UTC = 09:00 SGT every Monday
```

---

## TODOs for later sessions

- Admin page (Session 14): replace "all schedulers" with a configurable per-user `receives_digest` flag
- Promote route re-summarises on every load — negligible for small teams; cache if needed
- `tplVoteStatus` shows `index: 1` in all webhook edits (position unknown at vote time) — cosmetic only

---

## What's next — Session 13

Design cleanup: audit every page and feature for visual consistency with the prototype.
- Typography: Fraunces for display headings, IBM Plex Sans for body — verify consistent application
- Spacing: generous whitespace, never cramped
- Colour tokens: all colours via CSS variables, no hardcoded hex
- Component reuse: `Card`, `Btn`, `Pill`, `Field` used everywhere they should be
- Mobile layout: installer dashboard, job detail, chat thread
