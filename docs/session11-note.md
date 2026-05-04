# Session 11 Notes — AI Assistant

> Read at the start of Session 12 alongside CONTEXT.md and plan.md.

_Done: 2026-05-04_

---

## What was built

Full AI assistant feature: RAG retrieval, Claude streaming chat with web search, auto-tagger, and the chat UI.

| File | Purpose |
|---|---|
| `supabase/migrations/0004_assistant_search.sql` | Two pgvector RPC functions: `match_kb_chunks` and `match_asst_chats`. Both `SECURITY INVOKER` so RLS applies automatically. |
| `src/lib/ai/embed.ts` | Voyage AI embedding helper — `voyage-3` model, 1024 dims, matches DB schema. |
| `src/lib/ai/retrieve.ts` | `retrieveContext()` — embeds the user's question, queries both KB and past chats via pgvector RPC. Gracefully returns empty if Voyage fails. `formatContext()` formats retrieved chunks into a system-prompt block. |
| `src/lib/ai/tagger.ts` | `tagConversation()` — uses Claude Haiku to classify a completed conversation into topic/entities/tags/importance/visibility. Falls back to safe defaults on failure. |
| `src/lib/supabase/queries/assistant.ts` | `getRecentChats()` + `saveChat()` — insert into `asst_chats` with embedding via service client. |
| `src/app/api/assistant/chat/route.ts` | POST — auth check, RAG retrieval, builds system prompt, streams Claude response via SSE. Includes `web_search_20250305` built-in tool. |
| `src/app/api/assistant/save/route.ts` | POST — auth check, tags conversation with Haiku, saves to `asst_chats`. |
| `src/app/assistant/page.tsx` | Server page — gets user profile, sets `backHref` per role, renders `AssistantShell`. |
| `src/features/assistant/AssistantShell.tsx` | Client chat UI — streaming SSE reader, user/assistant message bubbles, source chips, "New chat" button with auto-save on trigger. |
| `src/lib/supabase/types.ts` | Added `match_kb_chunks` + `match_asst_chats` to `Functions`. Added `Relationships: []` to ALL tables (required for `GenericTable` contract so `createServiceClient` resolves `Schema` correctly, not `never`). Rewrote `asst_chats.Insert`/`Update` as flat explicit types (not `Omit<Database[...]>` — self-reference resolved to `never` for the service client). |
| i18n | Added `assistantEmpty`, `assistantSources`, `assistantError`, `newChat` to en/zh/bn. |
| `src/features/schedule/ScheduleShell.tsx` | Added Bot icon nav link to `/assistant` in header. |
| `src/features/installer/InstallerShell.tsx` | Added Bot icon nav link to `/assistant` beside sign-out button. |

---

## Architecture

### Streaming chat flow

```
POST /api/assistant/chat  { messages }
  → auth check
  → retrieveContext(lastUserMsg)
      → embed(query) [Voyage API]
      → supabase.rpc('match_kb_chunks', ...)   [RLS-filtered]
      → supabase.rpc('match_asst_chats', ...)  [RLS-filtered]
  → build systemPrompt (identity + date + user + context block)
  → anthropic.messages.stream(model, system, messages, web_search tool)
      → stream.on('text') → SSE data: { type: 'text', text }
  → SSE data: { type: 'done' }
  → Response(ReadableStream, text/event-stream)

AssistantShell (client):
  fetch('/api/assistant/chat', { body: messages })
  → ReadableStream reader → SSE line parser
  → append text chunks to current message in state
  → on 'done' → finalise message → saveConversation() [fire-and-forget]
```

### Auto-save and tagging

```
POST /api/assistant/save  { messages }
  → tagConversation(messages, role) [Claude Haiku classify]
      → topic, entities, tags, importance, visibility
  → saveChat(userId, messages, tag)
      → embed(conversation summary) [Voyage API]
      → supabase (service client).from('asst_chats').insert(...)
```

Save is triggered:
1. After each complete assistant response (fire-and-forget fetch)
2. When user clicks "New chat" (before clearing messages)

### RAG context — graceful degradation

The Obsidian sync (Session 12) hasn't run yet, so `kb_chunks` is empty. The system works fine with zero context — Claude answers from its training + web search. When KB is populated after Session 12, retrieval automatically enriches responses.

---

## Key decisions

| Decision | Why |
|---|---|
| SSE (Server-Sent Events) for streaming | Native browser support, trivial to parse, works well with Next.js `ReadableStream` response |
| `web_search_20250305` built-in tool | Anthropic handles search server-side — no tool loop required in app code. Types not yet in ToolUnion for SDK 0.39.x, so `as unknown as Anthropic.Messages.ToolUnion` cast used. |
| Save after each response, not just on "New chat" | Prevents data loss if user closes tab without clicking New Chat |
| Claude Haiku for tagging | 5-10× cheaper than Sonnet; classification doesn't need reasoning depth |
| `Relationships: []` added to all tables in types.ts | `createServiceClient` uses base `createClient` which resolves `Schema = never` when tables don't match `GenericTable` contract. SSR client falls back to `any`; base client falls back to `never`. Adding `Relationships: []` makes all tables conform to `GenericTable` and fixes service client type resolution. |
| `as never` cast for rpc() args in retrieve.ts | Supabase rpc() generic inference for `number[]` args falls back to default `Args = never`, typing `args` as `undefined`. Same pattern as existing `as never` casts in jobs.ts. Runtime values are correct. |

---

## TODOs for later sessions

- Source citation extraction: built-in web_search tool sources are server-side; extracting URLs for display requires parsing intermediate stream messages — deferred to polish session
- `fieldSizing: 'content'` CSS property for textarea auto-grow is non-standard; test cross-browser (works on Chrome/Safari)
- The `match_kb_chunks` + `match_asst_chats` migrations must be applied before RAG retrieval works: `npx supabase db push`

---

## What's next — Session 12

`obsidian-sync` + `monday-digest` cron scripts:
- `scripts/obsidian-sync.ts` — walks Obsidian vault, chunks markdown files, embeds via Voyage, upserts to `kb_chunks`
- `scripts/monday-digest.ts` — pulls `asst_chats` with `importance >= 4` from the past week, summarises via Claude, Telegrams the digest to scheduler/owner
