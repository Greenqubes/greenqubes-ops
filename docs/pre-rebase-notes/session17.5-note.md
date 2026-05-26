# Session 17.5 — Persistent Floating AI Chatbot

_Written: 2026-05-07. All changes on `dev` branch._

---

## What was done

Added a persistent floating AI chat bubble visible on every page except `/assistant`. Tapping the bubble opens a compact inline panel with full RAG + web search via the existing `/api/assistant/chat` SSE endpoint. State resets on close; conversations are auto-saved to `asst_chats` on close or after each exchange.

---

## New files

| File | Purpose |
|---|---|
| `src/components/FloatingChatPanel.tsx` | Client component — bubble trigger + floating panel, streaming chat, message bubbles, sources |
| `src/components/FloatingChatWrapper.tsx` | Async server component — auth check + user lang fetch; renders `FloatingChatPanel` or null |

---

## Changes

### src/app/layout.tsx

- Imported `Suspense`, `FloatingChatWrapper`
- Added `<Suspense fallback={null}><FloatingChatWrapper /></Suspense>` inside `<ErrorBoundary>`, outside `<ToastProvider>` — renders on every page

---

## Design decisions

- **Bubble position:** `bottom-20 right-4` (80px from bottom) — clears the ~64px fixed bottom nav
- **Panel position:** `bottom-36 right-4` (144px from bottom) — 16px above bubble top, opens upward
- **Panel width:** `min(340px, calc(100vw - 2rem))` — compact on desktop, full-width on small mobile
- **Hidden on `/assistant`:** `usePathname()` check returns null — avoids duplication with the full assistant page
- **Unauthenticated:** `FloatingChatWrapper` returns null if no user or no profile (login page shows nothing)
- **Chat reset on close:** no cross-page state persistence needed; close saves conversation and clears
- **No new i18n keys needed:** reuses `assistant`, `assistantEmpty`, `assistantError`, `newChat`, `askPlaceholder`, `sendMessage`
- **Suspense boundary in layout:** prevents the auth fetch from blocking page render

---

## TypeScript

`npx tsc --noEmit` — clean, no errors.

---

## What's next

- Session 17.6 remainder — Pending tab sales-only, 15-min time picker, production ready instructions attachment
- Session 19 — Pre-Alpha testing
