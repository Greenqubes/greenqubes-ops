# fix-assistant-20260520-1 — Assistant History Bugs + New Chat Alignment

**Date:** 2026-05-20
**Branch:** dev

---

## What was fixed

### Bug 1 — Sidebar doesn't refresh after new chat is saved
`HistorySidebar` fetched once on mount and never re-fetched. Newly saved conversations required a full page reload to appear.

Fix:
- Added `refreshTrigger?: number` prop to `HistorySidebar`
- `useEffect` re-fetches when `refreshTrigger` changes
- `AssistantShell` holds `sidebarKey` state and increments it via `.then()` after each `saveConversation` resolves

### Bug 2 — Clicking a history item creates duplicate conversation entries
`loadFromHistory` called `saveConversation` unconditionally before loading the new chat — even when the displayed messages were already loaded from history unchanged. Every click re-saved the same conversation as a brand new row.

Fix:
- Added `isDirtyRef` (boolean ref, starts `false`)
- Set to `true` when user sends a message (`sendMessage`)
- Reset to `false` in `loadFromHistory` and `startNewChat`
- `saveConversation` is only called when `isDirtyRef.current === true`
- Unmount cleanup also gated by `isDirtyRef`

### Bug 3 (user-reported continuation) — Continuing an old chat still creates a duplicate
Even with the `isDirty` fix, loading a history chat, adding messages, then refreshing created a new row instead of updating the original.

Fix:
- Added `activeChatIdRef` to track the current chat's DB id for the unmount path
- `saveConversation` now accepts `existingId?: string`
- When `existingId` is set, the API calls `updateChat()` instead of `saveChat()`
- `updateChat()` fetches the original `topic` from DB and preserves it; updates `msgs`, `embedding`, `tags`, `importance`, `ts`
- Falls back to `saveChat()` insert if the row was deleted

### Visual bug — New Chat button overlaps BottomNav
The "New Chat" button at the bottom of the history sidebar was sitting behind the fixed `BottomNav` (~60px tall).

Fix:
- Changed button container from `p-3` to `px-3 pt-3 pb-[72px]`
- The 72px padding below the button pushes it above the nav
- Toast position updated from `bottom-16` to `bottom-[120px]` to stay above the button

---

## Key files changed

| File | Change |
|---|---|
| `src/features/assistant/AssistantShell.tsx` | `sidebarKey`, `isDirtyRef`, `activeChatIdRef`; `saveConversation` accepts `existingId`; all call sites updated |
| `src/features/assistant/HistorySidebar.tsx` | `refreshTrigger` prop; button `pb-[72px]`; toast `bottom-[120px]` |
| `src/app/api/assistant/save/route.ts` | Accepts `existingId`; routes to `updateChat` or `saveChat` |
| `src/lib/supabase/queries/assistant.ts` | New `updateChat()` function |

---

## Pending polish

- **Sidebar refresh delay** — the re-fetch happens after the save API resolves (which includes an AI tagging call). There's a 1–2 second lag. Needs optimistic update on the sidebar for instant feel. Deferred until after pre-alpha.

---

## Git notes

The job form redesign agent was actively committing to local `dev` during this session, causing a branch divergence. My commits were cherry-picked onto `dev` and pushed cleanly. All changes are in `src/features/assistant/` and `src/lib/supabase/queries/assistant.ts` — no overlap with job form files.
