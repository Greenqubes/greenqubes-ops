# chore-assistant — Permissions Audit + Assistant Codebase Review

_Written: 2026-05-09_

---

## What was done

No code features added. Session focused on tooling audit, file cleanup, and tracing the assistant chatbot architecture end to end.

---

## Changes

### Deleted
- 11 orphaned `.gitkeep` files from `src/features/` and `src/lib/` folders that already had real files in them

### Docs updated
- `docs/plan.md` — added this session to completed sessions table
- `docs/CONTEXT.md` — updated last-updated line
- `docs/nic-checklist.md` — added 5 pending code fixes

---

## Findings

### Permissions (settings.local.json)
- Ran `fewer-permission-prompts` skill across 50 transcripts — nothing new to add
- All top commands (`grep`, `ls`, `find`, `cat`, etc.) are auto-allowed by Claude Code natively
- `claude plugin *` already covered in `settings.local.json`
- Flagged two broad existing entries: `Bash(npm run *)` and `Bash(git push *)` — optional tighten

### File structure
- `src/features/chat-thread/` — empty (only `.gitkeep`). Chat lives in `job-detail/ChatSection.tsx`
- `src/features/completion/` — empty (only `.gitkeep`). Completion location unclear
- `docs/infra`, `docs/feat`, `docs/backend`, `docs/ux`, `docs/visual`, `docs/fix`, `docs/db` — all empty prefix folders

### Chat thread
- Job chat messages persist correctly in Supabase `messages` table
- Voice notes upload to Cloudflare R2, key saved to `messages`
- File attachments upload to R2, key saved to `files`
- Realtime via Supabase websockets, 2-min polling fallback

### Assistant chatbot (full flow traced)
1. Floating bubble on all pages → full `/assistant` page (handoff via `sessionStorage`)
2. On send: Voyage AI embeds query → pgvector similarity search against `kb_chunks` + `asst_chats`
3. Claude Sonnet 4.6 streams reply with web search enabled
4. After every reply: full conversation auto-saved to `asst_chats` (best-effort, `keepalive`)
5. Claude Haiku tags: `topic`, `entities`, `tags`, `importance` 1–5, `visibility`
6. Voyage AI embeds conversation text, stored in `asst_chats.embedding`
7. Conversations with `importance >= 4` appear in Admin → Digest tab + Monday Telegram digest
8. Scheduler votes ✅/❌ via Telegram inline buttons
9. Majority YES → signed promote link → web page with formatted Obsidian `.md` note to copy-paste

**Bug found:** `saveConversation` fires after every assistant reply, not just at session end. A 3-turn chat creates 3 rows in `asst_chats` (each a growing snapshot). Pollutes digest queue with duplicates.

**Current RAG state:** `kb_chunks` is empty until first Obsidian sync is run (`npm run obsidian-sync`). Past conversations accumulate automatically but are duplicated due to the bug above.

---

## Pending fixes (all in nic-checklist.md)

1. Fix duplicate `asst_chats` saves — save only on "New Chat" click
2. Delete or build out `features/chat-thread/`
3. Delete or build out `features/completion/`
4. Clean up empty `docs/` prefix folders
5. Optionally tighten `settings.local.json` broad permissions

---

## What's next

Fix the `asst_chats` duplicate save bug, then proceed to Session 19 pre-alpha testing.
