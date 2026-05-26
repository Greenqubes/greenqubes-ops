# feat-assistant-3 — Assistant Polish: Bulk Delete, Live Rename, Markdown, Layout
_2026-05-25_

## What was built

Continued from fix-assistant-history (2026-05-20). This session added several major polish items to the AI assistant.

---

## Key changes

### Per-user history isolation
- Migration `0030_asst_chats_user_isolation.sql` — drops the scheduler cross-read RLS policy on `asst_chats`
- Each user now only sees their own conversation history
- Applied via `npx supabase db push`

### Optimistic sidebar updates
- When a user sends their first message in a new chat, "New Conversation" appears in the sidebar immediately (no waiting for save)
- `liveOptimisticIdRef` tracks the temp ID so the live entry and the save-time entry share the same slot — no duplicate flash
- `titleGeneratedRef` prevents multiple Haiku title calls per conversation session

### Live auto-rename
- New route: `POST /api/assistant/generate-title`
- Takes first user + assistant message (up to 300 chars each), calls Haiku with `max_tokens: 16`
- Returns a 3–5 word title; sidebar entry updates live after first response
- Manual rename (via ⋮ dropdown) sets the title permanently and is not overwritten

### Rename from ⋮ dropdown
- New route: `PATCH /api/assistant/rename`
- Rename modal in HistorySidebar with text input and optimistic update
- Same modal added to MobileHistoryShell
- Pencil icon in HistoryList ⋮ dropdown

### Bulk multi-select delete
- "Select" button in sidebar header enters select mode; checkboxes appear on each row
- Terracotta delete bar at bottom shows count; confirmation modal before deleting
- Parallel `DELETE /api/assistant/delete` calls; reverts on any failure
- Same pattern on mobile `/assistant/history` page (MobileHistoryShell)

### Message count + star importance removed from UI
- `msgCount()` and `stars()` helpers removed from HistoryList
- Metadata span (count + stars) removed from ChatRow render
- Data still stored in DB (`msgs[]`, `importance`) for backend/RAG use

### Markdown rendering
- New component: `src/components/MarkdownMessage.tsx`
- Handles: `#`/`##`/`###` headings, `**bold**`, `*italic*`, `---` hr, `> blockquote`, `- / *` bullet lists, empty lines, normal paragraphs
- Custom `•` bullet (not CSS list-disc) for cleaner styling
- No new npm dependencies
- Replaces raw `<p className="whitespace-pre-wrap">` in AssistantShell `MessageBubble` and FloatingChatPanel `FloatingBubble`

### Type while AI streams
- `disabled={isStreaming}` removed from textarea in both AssistantShell and FloatingChatPanel
- Send button still disabled until streaming finishes

### Full-width sub-header layout
- "← Assistant" sub-header moved out of the main content column in AssistantShell
- Now sits above the `flex-1 flex` row containing sidebar + content — spans full width like CompanyBar
- Sidebar history list starts below the sub-header on desktop

### New Chat button BottomNav fix
- Restored `pb-[72px]` on HistorySidebar New Chat button footer
- Clears the fixed `bottom-0` BottomNav on all screen sizes

---

## Files changed

| File | Change |
|---|---|
| `src/features/assistant/AssistantShell.tsx` | Optimistic states, liveOptimisticIdRef, titleGeneratedRef, finishSave(), generateLiveTitle(), sendMessage() optimistic block, full-width sub-header layout, MarkdownMessage in MessageBubble |
| `src/features/assistant/HistorySidebar.tsx` | optimisticChat prop, displayChats useMemo, bulk select/delete, rename modal, pb-[72px] fix |
| `src/features/assistant/HistoryList.tsx` | isSelecting/selectedIds/onToggleSelect/onRename props, checkboxes, Rename menu item, line-clamp-2, removed msgCount/stars |
| `src/app/assistant/history/MobileHistoryShell.tsx` | Bulk delete + rename (same pattern as sidebar) |
| `src/app/api/assistant/rename/route.ts` | NEW — PATCH endpoint for rename |
| `src/app/api/assistant/generate-title/route.ts` | NEW — POST endpoint, Haiku 3–5 word title |
| `src/components/MarkdownMessage.tsx` | NEW — lightweight markdown renderer |
| `src/components/FloatingChatPanel.tsx` | MarkdownMessage replaces whitespace-pre-wrap, textarea not disabled during stream |
| `supabase/migrations/0030_asst_chats_user_isolation.sql` | NEW — drops scheduler cross-read policy |

---

## What's next

- Pre-alpha testing (Session 19) — end-to-end solo run through all flows
- AdminRoleModal double-Yes bug still pending
- Bulk delete jobs on Schedule / Pending pages (design chosen, not built)
- Schedule page visual overhaul (waiting for Nic to share target design)
