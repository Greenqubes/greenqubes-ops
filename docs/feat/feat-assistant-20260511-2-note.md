# feat-assistant-2 — Assistant History Sidebar Implementation

_Written: 2026-05-11_

---

## What was done

Full implementation of the assistant history sidebar, as specced in the previous session. All 8 tasks executed via subagent-driven development with two-stage review (spec + code quality) after each task.

---

## Changes

### Database

- **Migration 0015** (`supabase/migrations/0015_asst_chats_pinned.sql`) — `pinned boolean NOT NULL DEFAULT false` column + composite index `(user_id, pinned DESC, ts DESC)` on `asst_chats`
- **Migration 0016** (`supabase/migrations/0016_asst_chats_delete_policy.sql`) — RLS DELETE policy `"asst_chats: own delete"` using `get_my_id()` (was missing, causing silent no-ops on delete)

### Query layer

- `src/lib/supabase/queries/assistant.ts` — added `pinned: boolean` to `AsstChatRow`, updated `getRecentChats` to ORDER BY `pinned DESC, ts DESC`, added `pinChat(id, pinned): Promise<boolean>` and `deleteChat(id): Promise<boolean>` (return boolean = rows affected > 0)
- `src/lib/supabase/types.ts` — added `pinned` to `asst_chats` Row/Insert/Update types

### API routes (new)

- `src/app/api/assistant/history/route.ts` — GET, returns last 30 chats for the authenticated user
- `src/app/api/assistant/pin/route.ts` — PATCH `{ id, pinned }`, resolves `auth_id → profile.id`, enforces 5-pin cap per user, returns `{ ok: false, reason: 'pin_cap' }` on 422
- `src/app/api/assistant/delete/route.ts` — DELETE `{ id }`, returns 404 if no rows affected

### New components

- `src/features/assistant/HistoryList.tsx` — shared grouped list (Pinned / Today / This Week / Earlier), desktop hover interactions (pin icon + ⋮), mobile always-visible ⋮ dropdown, inline delete confirmation, click-outside menu dismiss
- `src/features/assistant/HistorySidebar.tsx` — desktop-only (`hidden md:flex`) persistent sidebar, fetches history on mount, optimistic pin/delete, toast on pin cap, timer cleanup on unmount

### New pages

- `src/app/assistant/history/page.tsx` — server component, auth + redirect
- `src/app/assistant/history/MobileHistoryShell.tsx` — client shell, same optimistic logic as sidebar, navigates to `/assistant?chat=<id>` on row tap

### Modified

- `src/features/assistant/AssistantShell.tsx` — outer layout changed to `flex` (sidebar + content), added `activeChatId` state, `loadFromHistory(chat)`, `handleSidebarDelete(id)`, mobile History icon link (`md:hidden`), `useSearchParams()` to handle `?chat=<id>` on mount
- `src/app/assistant/page.tsx` — wrapped `<AssistantShell>` in `<Suspense>` (required by Next.js 15 for `useSearchParams`)

---

## Known bug — do not touch without a new lead

**Delete conversation button not working in Vercel preview**

The "Delete Permanently? → Confirm" flow completes (no error shown) but the row reappears on next load, suggesting the actual DB delete is not executing. Possible causes:

1. Migration 0016 (RLS DELETE policy) may not have been applied to the Vercel-linked Supabase project — verify via `npx supabase migration list`
2. The `deleteChat` function returns `false` (0 rows affected) but the API route still returns `{ ok: true }` — check `delete/route.ts` logic
3. Optimistic update in `HistorySidebar.handleDelete` or `MobileHistoryShell.handleDelete` may be reverting incorrectly

Do not attempt to fix without confirming which of the above is the root cause first.

---

## What's next

1. Fix delete conversation button (investigate migration 0016 application first)
2. Verify all other sidebar interactions on Vercel preview (pin, load, New Chat, mobile history route)
3. Proceed to Session 19 pre-alpha testing once sidebar is confirmed working
