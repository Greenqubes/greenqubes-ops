# fix-assistant — Assistant Delete Button Fix + Delete Modal

_Written: 2026-05-11_

---

## What was done

Fixed the non-functional delete conversation button in the assistant history sidebar. Three separate issues were diagnosed and resolved through systematic debugging.

---

## Root Cause

**`mousedown` vs `click` event ordering in `HistoryList`.**

The click-outside handler used `document.addEventListener('mousedown', handleOutside)`. `mousedown` fires before `click`. When the user clicked "Delete conversation" from the ⋮ dropdown:

1. `mousedown` fired → `handleOutside` ran → `setOpenMenuId(null)` → React re-rendered → dropdown unmounted
2. `click` fired — but the "Delete conversation" button was already gone from the DOM, so `onDeleteClick` never executed

Result: no optimistic update, no fetch, no feedback. Completely silent.

**Secondary issues found along the way:**

- `deleteChat` was returning `false` when Supabase's `count: 'exact'` returned `null` on delete, even on a successful operation. Made it idempotent (`!error` only).
- The original inline confirm UI (replace the row in-place) was invisible in the narrow sidebar, contributing to the appearance of "no feedback".

---

## Changes

### Bug fix — `src/features/assistant/HistoryList.tsx`
- Changed `document.addEventListener('mousedown', ...)` → `document.addEventListener('click', ...)` for the click-outside handler
- Removed `confirmDeleteId` state and inline confirm UI from `ChatRow` — confirm now handled by a modal in the parent
- Simplified `ChatRow` props (removed `isConfirmingDelete`, `onDeleteConfirm`, `onDeleteCancel`)
- `onDeleteClick` now calls `onDelete(id)` directly (no intermediate confirm state)

### New modal — `src/features/assistant/HistorySidebar.tsx`
- Added `pendingDeleteId` state
- `HistoryList.onDelete` = `setPendingDeleteId` (opens modal)
- `confirmDelete()` does the actual optimistic update + fetch
- Modal rendered **outside** the `<aside>` (as a fragment sibling) to escape `overflow-hidden` clipping
- Modal: "Delete Permanently?" heading, subline, No / Yes (terracotta) buttons

### Same modal — `src/app/assistant/history/MobileHistoryShell.tsx`
- Same `pendingDeleteId` pattern as sidebar
- Modal added at the bottom of the shell

### Idempotent delete — `src/lib/supabase/queries/assistant.ts`
- `deleteChat` now returns `!error` instead of `!error && (count ?? 0) > 0`
- Removes dependency on Supabase `count: 'exact'` which can return `null`

### API route — `src/app/api/assistant/delete/route.ts`
- Returns 500 (not 404) when `deleteChat` returns false — distinguishes DB error from "not found"
- Added `console.log` for Vercel function log diagnostics (kept for now)

---

## What's next

- Session 19 — Pre-alpha testing (end-to-end run through all flows on Vercel preview)
