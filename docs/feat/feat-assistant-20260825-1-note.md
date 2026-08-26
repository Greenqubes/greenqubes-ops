---
session: feat-assistant (Assistant upgrade Phase 1 — Sonnet 5 brain + Claude-grade UI)
date: 2026-08-25
branch: dev → main (smoke test passed, merged same day — live on production)
---

# Assistant Upgrade Phase 1 — SHIPPED

> Spec: [../superpowers/specs/2026-08-24-assistant-upgrade-design.md](../superpowers/specs/2026-08-24-assistant-upgrade-design.md)
> Plan: [../superpowers/plans/2026-08-24-assistant-upgrade-phase1.md](../superpowers/plans/2026-08-24-assistant-upgrade-phase1.md)
> No migration needed (as planned). Phases 2–4 remain.

## What shipped

**Chat route (`src/app/api/assistant/chat/route.ts`)**
- `claude-sonnet-4-6` → **`claude-sonnet-5`**, `thinking: { type: 'adaptive' }`,
  `max_tokens` 1024 → **8192** (long answers no longer truncate).
- SDK `@anthropic-ai/sdk` `^0.39.0` → **`^0.120.0`**; the `web_search` cast hack
  replaced by the typed `web_search_20260209` tool. All other SDK call sites
  (tagger, titles, suggest, digest — Haiku) work unchanged on the new SDK.
- **Prompt caching**: system prompt split into a frozen prefix (persona +
  guidelines + an app glossary: FCFS, buckets, PTW, suggestion vs assignment,
  punctuality, digest…) marked `cache_control: ephemeral`, with everything
  volatile (date, user, retrieved KB context) in a second block after it.
- **SSE vocabulary extended**: `{type:'status', key}` (thinking / searching,
  client translates) + `{type:'sources', sources}` from `web_search_tool_result`
  blocks; `text`/`done`/`error` unchanged. D-Promote wink unchanged.
- Client aborts propagate to the upstream Anthropic stream (quiet end, no error).
- Cost logging: Sonnet 5 rates + cache write/read rates + $0.01 per web search;
  `tokens_in` now logs the full context incl. cache tokens.

**AssistantShell + FloatingChatPanel**
- The "choppy" fix: streamed chunks buffer and flush at most once per animation
  frame; auto-scroll only while the reader is at the bottom (scrolling up pauses
  follow, the round button resumes); status lines render as a subtle italic line
  in the streaming bubble; **Stop button** (Send ↔ Stop swap; partial answers
  kept and saveable); **web source chips** finally populated (the `sources`
  field existed since Session 17.5 but was never wired).
- **Two-row composer**: auto-growing textarea ("Write a message…"), controls row
  with disabled **+ attach** placeholder (Phase 3), **mic = Web Speech
  dictation** (feature-detected — Chrome/Safari yes, Firefox quietly absent;
  interim results stream into the box), send/stop. No model picker (Nic's rule).
- **Desktop sidebar**: New chat on top, Pinned/Chats groups, skeleton loading
  rows, 📌 emoji → stroke `Pin` icon (no-emoji rule).
- **Phone chat-first layout**: CompanyBar + "← Assistant" sub-header shed; slim
  bar with **hamburger LEFT** → left slide-in drawer at `z-[60]` (GreenQubes
  logo, New chat, chats with pin/rename/delete), **Home icon RIGHT** →
  /schedule (installers → /installer). Fraunces first-name greeting on a fresh
  chat. BottomNav stays (visible under the drawer backdrop — accepted by Nic).
- `/assistant/history` → `redirect('/assistant')`; `MobileHistoryShell` deleted.
- New i18n strings en + zh only (bn frozen, falls back).

**HealthTab**
- The flat-rate Anthropic cost recompute ("Internal cost estimate drift"
  warning) removed — anthropic rows now mix models, cache discounts and
  per-search fees, so a token-based recompute can only false-alarm (Nic hit it
  on production within hours). The Voyage check and the provider-dashboard
  comparison stay.

## Nic's decisions this session

- Session start: AI importance tagger — skipped, no changes. Push always to dev.
- Mobile bar feedback (from his phone test): hamburger LEFT, drop the assistant
  icon + title, Home icon right → schedule. Bottom nav under the drawer: fine
  as-is.
- Smoke test passed → approved merge to main same day.
- Phase 3 scratch question answered (see below); open offer to build a 30-day
  scratch auto-cleanup during the Phase 3 session instead of deferring it.

## Facts worth keeping

- **The TS SDK has no 1.x** — the spec's "upgrade to 1.x" referred to a major
  that only exists for the Python SDK. `0.120.0` is the current TypeScript SDK.
- **The cached prefix must stay byte-identical AND ≥ ~1024 tokens** or caching
  silently never engages. The frozen block was deliberately grown (glossary) to
  ~1.4k tokens; don't put dates/user/context before the breakpoint.
- Sonnet 5 rejects `budget_tokens` and sampling params (400) — adaptive only.
- Thinking deltas are never forwarded to the client — only the status line.
- Cost logs use standard Sonnet 5 rates ($3/$15, cache $3.75/$0.30, $0.01 per
  search); intro pricing until 2026-08-31 means real bills run lower till then.
- API usage lives at **Admin → Health → API Usage Tracker** (30-day totals per
  service — there is no per-message row view).
- Phase 3 attachments (when built) live in `asst-chat/{user}/{chat}/…` scratch
  in R2 — never `files` rows, so they can't leak into job chat; without a job
  they just stay there until the deferred scratch cleanup exists. The nightly
  backup mirrors them to the server-PC archive like everything else.

## ⚠️ Next session

- **Phase 2**: agentic tool loop (cap 8), read-only live-data tools under the
  asker's RLS, agentic KB search, memory summaries + Memory manager.
  **Run `npx supabase db push` for migration 0046 BEFORE pushing code** that
  selects `asst_chats.summary` (the feat-files lesson).
- Smoke test must include a **real installer login** (unassigned job → nothing
  found) and a two-account memory-isolation check.
