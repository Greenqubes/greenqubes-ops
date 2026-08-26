# Assistant Upgrade — Phase 1 Implementation Plan

**Date:** 2026-08-24
**Spec:** [../specs/2026-08-24-assistant-upgrade-design.md](../specs/2026-08-24-assistant-upgrade-design.md) (approved)
**Scope:** Phase 1 only — brain + Claude-grade UI/UX. No migration, no new tools, no retrieval changes.
**Deploy:** `dev` → Vercel preview smoke test by Nic → merge `main`.

---

## 1. SDK upgrade

- `@anthropic-ai/sdk` `^0.39.0` → current latest, **0.120.0** (`npm install @anthropic-ai/sdk@latest`).
  Spec said "1.x" — that major version only exists for the *Python* SDK; 0.120.0 IS the
  current TypeScript SDK, with everything Phase 1 needs typed (adaptive thinking,
  `web_search_20260209`, cache usage fields).
- Blast radius beyond the chat route: `ai/suggest`, `admin/digest`, `assistant/generate-title`,
  `suggest-grammar`, `lib/ai/tagger`, `lib/digest/run`, `lib/digest/autoPromote` — all plain
  `anthropic.messages.create` calls that keep working on 1.x unchanged. Type-check confirms.

## 2. Chat route (`src/app/api/assistant/chat/route.ts`)

- Model `claude-sonnet-4-6` → **`claude-sonnet-5`** (exact ID, no date suffix).
- `max_tokens: 1024` → **8192**. Add `thinking: { type: 'adaptive' }`.
  No `budget_tokens`, no sampling params (Sonnet 5 rejects both with a 400).
- Web search tool: `web_search_20250305` cast hack → typed `{ type: 'web_search_20260209', name: 'web_search' }`.
- **System prompt restructured for prompt caching** — `system` becomes an array of two text blocks:
  1. Frozen block (persona + guidelines, byte-stable across every request) with
     `cache_control: { type: 'ephemeral' }`.
  2. Volatile block AFTER it: today's date, user name/role, retrieved KB context.
  Verify in dev via `usage.cache_read_input_tokens` (logged with usage).
- **SSE vocabulary extended** (additive — old clients unaffected):
  - `{type:'status', key}` — emitted on `content_block_start` for `thinking` blocks
    (`key: 'thinking'`) and `server_tool_use` blocks (`key: 'searching'`). The route
    sends a machine key; the client translates it (en/zh, bn falls back) since the
    route doesn't know the UI language.
  - `{type:'sources', items:[{url,title}]}` — extracted from `web_search_tool_result`
    blocks on the final message, deduped by URL, sent once before `done`.
  - Existing `text` / `done` / `error` unchanged.
- **Abort:** pass the request's `AbortSignal` into the SDK stream so a client Stop
  actually cancels the upstream call; treat abort as a quiet end (no error event).
- **Cost logging:** Sonnet 5 rates — input $3/M, output $15/M, cache write $3.75/M,
  cache read $0.30/M (intro pricing through 2026-08-31 is lower; we log at standard
  rates so the numbers don't need touching in a week). `tokens_in` logs the full
  context (input + cache read + cache write).
- D-Promote canned wink: unchanged.

## 3. AssistantShell (`src/features/assistant/AssistantShell.tsx`)

**Streaming smoothness**
- Incoming `text` chunks append to a ref buffer; a `requestAnimationFrame` loop flushes
  to state — one steady re-render per frame instead of per network chunk.
- Progressive markdown keeps rendering via the existing `MarkdownMessage`.

**Scroll behaviour**
- Track `isAtBottom` (≤ ~80px from bottom). Auto-follow only while at bottom;
  scrolling up pauses follow; the scroll-down button (now shown on all sizes) resumes it.
- The unconditional `scrollIntoView` on every message update is removed.

**Status line + Stop**
- `status` SSE events render as a subtle italic line in the streaming bubble
  (fade transition, no layout jump); cleared when the reply finishes.
- `AbortController` on the fetch; Send swaps to Stop while streaming. A stopped
  partial answer is kept, marked non-streaming, and saveable as usual.

**Composer (two-row card, desktop + phone)**
- Row 1: auto-growing textarea, "Write a message…" placeholder (new i18n key).
- Row 2: left — `+` attach button, disabled placeholder until Phase 3 (tooltip
  "Attachments coming soon", i18n); right — mic + send/stop.
- **Mic = Web Speech dictation**: feature-detected (`SpeechRecognition` /
  `webkitSpeechRecognition`), quietly absent when unsupported; interim results stream
  into the textarea; tap again to stop. No audio recording.
- No model picker, no effort selector.

**Desktop layout**
- CompanyBar + sub-header stay; History link removed (sidebar is there).
- Sidebar restructure (see §5).

**Phone layout (< md)**
- CompanyBar + "← Assistant" sub-header are NOT rendered; instead a slim top bar:
  assistant title left, **hamburger (Menu icon) top-RIGHT** opening a **left slide-in
  drawer** at `z-[70]` (above BottomNav `z-50`, hard rule): GreenQubes branding at
  top, New chat, then Pinned/Recents (HistoryList mobile mode with pin/rename/delete).
- Empty state: centred Fraunces greeting with the user's first name (en/zh; bn → en).
- BottomNav stays.

## 4. FloatingChatPanel (`src/components/FloatingChatPanel.tsx`)

- Same SSE handling upgrades: status line, Stop (abort), rAF-buffered text,
  sticky-bottom-only scroll. Layout stays compact — no paperclip, no mic.

## 5. Sidebar + history

- `HistorySidebar`: **New chat action moves to the top**; groups render as
  Pinned → Chats (Today / This Week / Earlier stay as sub-groups); skeleton rows
  while loading instead of a spinner; Select/bulk-delete kept.
- `HistoryList`: `📌` emoji → stroke `Pin` icon (no-emoji rule).
- `/assistant/history` becomes a `redirect('/assistant')` (drawer replaces it);
  `MobileHistoryShell` deleted.

## 6. i18n (en + zh only — bn frozen, falls back to en)

New keys: composer placeholder, stop, attach-coming-soon, dictation start/stop labels,
status labels (thinking / searching the web), greeting, drawer/menu labels as needed.
Date/day labels: none added (hydration rule untouched).

## 7. Verification (before push)

- `npm run type-check` + `npm run build` green.
- Manual checklist for Nic on the preview (from the spec): long answer no longer
  truncates; status line + Stop work on page and bubble; sources render after a
  web-search answer; Admin → API usage shows new pricing rows; cache-read tokens
  non-zero on second turn; phone layout: hamburger drawer above BottomNav, greeting,
  dictation on a supported browser.
