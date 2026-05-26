# feat-assistant — Assistant Fixes + History Sidebar Spec

_Written: 2026-05-11_

---

## What was done

Bug fixes to the AI assistant chat flow, minor UX additions to the floating chat panel, codebase cleanup, and a full design spec for the upcoming history sidebar feature.

---

## Changes

### Bug fixes

- **Duplicate `asst_chats` saves** — `saveConversation` was firing inside `sendMessage` after every completed stream, creating one row per reply in `asst_chats`. Removed the call from `sendMessage` in both `AssistantShell.tsx` and `FloatingChatPanel.tsx`. Added a `messagesRef` + `useEffect` unmount cleanup to `AssistantShell` so navigating away without clicking New Chat still saves the conversation once. `FloatingChatPanel` saves on close/new-chat as before.

- **Streaming expand bug** — clicking the expand-to-full-page button mid-stream navigated to `/assistant` before the stream finished, leaving the conversation stuck at a partial snapshot. Fixed by adding `pendingExpand` state — clicking during streaming sets the flag, a `useEffect` watches for `isStreaming` to become false, then navigates. Button shows a spinner while waiting.

### New features (floating panel)

- **Expand button** — `Maximize2` icon beside the "Assistant" label in the floating panel header. Navigates to `/assistant`, carrying the conversation over via the existing `sessionStorage` handoff.

### Cleanup

- Deleted `src/features/chat-thread/` (empty — chat lives in `job-detail/ChatSection.tsx`)
- Deleted `src/features/completion/` (empty — completion logic in `job-detail/StatusSection.tsx`)
- Tightened `.claude/settings.local.json`: `git push *` → `git push origin dev`, removed ~12 stale one-off permission entries from past sessions

---

## Design spec — Assistant History Sidebar

Full brainstorm + design completed. Spec at:
`docs/superpowers/specs/2026-05-11-assistant-history-sidebar-design.md`

### Summary

- Persistent left sidebar (~260px) on desktop — scrollable, grouped Today / This Week / Earlier, no search
- Last 30 chats, each row: topic (from `asst_chats.topic`), message count, importance stars
- Pinned section at top — max 5, stored in new `pinned boolean` column (migration 0015)
- Desktop: hover → pin icon + ⋮. Click pin to toggle. Click ⋮ → Delete Conversation
- Mobile: sidebar hidden, History button in header → `/assistant/history` full-screen route. Each row has ⋮ → Pin / Delete Conversation
- "Delete Permanently?" confirmation, then hard delete
- Loading a past chat: msgs load into chat area, user can continue. Saves as new row on close
- New Chat button pinned to bottom of sidebar

### New files needed (next session)

- `src/features/assistant/HistorySidebar.tsx`
- `src/features/assistant/HistoryList.tsx`
- `src/app/assistant/history/page.tsx`
- `src/app/api/assistant/history/route.ts`
- `src/app/api/assistant/pin/route.ts`
- `src/app/api/assistant/delete/route.ts`
- `supabase/migrations/0015_asst_chats_pinned.sql`

### Files to modify (next session)

- `src/features/assistant/AssistantShell.tsx`
- `src/lib/supabase/queries/assistant.ts` — add `pinned` to `AsstChatRow`, `pinChat()`, `deleteChat()`, update ORDER BY to `pinned DESC, ts DESC`

---

## What's next

1. Read spec at `docs/superpowers/specs/2026-05-11-assistant-history-sidebar-design.md`
2. Invoke `writing-plans` skill to create implementation plan
3. Implement history sidebar
4. Then proceed to Session 19 pre-alpha testing
