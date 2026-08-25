---
session: feat-assistant-2 (Assistant upgrade Phase 2 — live-data tools + agentic KB search + memory)
date: 2026-08-25
branch: dev → main (smoke test passed, merged same day — live on production)
---

# Assistant Upgrade Phase 2 — SHIPPED

> Spec: [../superpowers/specs/2026-08-24-assistant-upgrade-design.md](../superpowers/specs/2026-08-24-assistant-upgrade-design.md)
> Plan: [../superpowers/plans/2026-08-25-assistant-upgrade-phase2.md](../superpowers/plans/2026-08-25-assistant-upgrade-phase2.md)
> Migration **0046** applied by Nic BEFORE any code push (the feat-files lesson). Phases 3–4 remain.

## What shipped

**Agentic tool loop (`src/app/api/assistant/chat/route.ts`)**
- The route is now a manual tool-use loop: stream → on `stop_reason: "tool_use"`
  execute tools → append `tool_result` blocks in ONE user message → continue.
  **Cap 8 rounds** (`MAX_TOOL_ROUNDS`); the final round forces a text answer via
  `tool_choice: none` + a budget note appended after the tool_results.
- Parallel tool calls execute concurrently (`Promise.all`); failures return
  `is_error: true` tool_results, never dropped. Thinking blocks ride back
  unmodified inside `final.content`.
- Usage + web sources accumulate across rounds — one `logApiUsage` row per
  question; sources sent once before `done`.
- The pre-baked KB retrieval is **removed** — `search_knowledge` replaces it.
  Automatic retrieval now feeds only the user's own past-chat memory.
- SYSTEM_PREFIX rewrote the "no live access" bullet into tool guidance
  (still frozen/byte-stable; grew well past the ~1024-token cache floor).

**Six read-only tools — RLS is the privacy mechanism**
- `src/lib/ai/tool-schemas.ts` (pure: definitions, status keys, validators),
  `src/lib/ai/tool-runner.ts` (dispatch, never throws),
  `src/lib/supabase/queries/assistant-tools.ts` (lookups on the
  **user-scoped** client — an installer's assistant only sees their own jobs).
- `search_knowledge` (repeatable, rephrasable) · `get_schedule` (range ≤62
  days, 100-row cap, suggestions stripped like the Schedule tab) · `find_jobs`
  (ilike over title/client/location, PostgREST-safe sanitising) · `get_job`
  (details + team incl. suggestion/sub flags + task list — **`job_financials`
  never selected**) · `get_team_workload` (formal non-sub bookings per
  installer; free installers show empty) · `check_clashes` (name-resolved with
  candidate disambiguation, reuses `timesOverlap` — floaters overlap all day).
- Sales POC names via follow-up query (never embed users on jobs — standing rule).

**Memory (migration 0046)**
- `asst_chats.summary` + `match_asst_chats` returns it (function dropped +
  recreated — return-type changes need that).
- Tagger (Haiku) additionally emits `summary` (2–3 sentences) + `meaningful`;
  parsing extracted to pure `parseChatTag` (D-Promote forces importance only,
  never meaningful).
- `saveChat`/`updateChat`: meaningful → store summary + embed
  `topic\nsummary` (`input_type: 'document'`); trivial → summary+embedding
  NULL, so they never match retrieval (`WHERE embedding IS NOT NULL`) and never
  appear in the Memory view. Old rows fall back to first-message truncation
  (`pastChatSummary`).
- **Memory manager**: Brain button under New chat (sidebar + phone drawer) →
  `MemoryView` overlay at `z-[70]` (above the drawer's z-[60]); list / edit
  (re-embeds) / forget (clears summary+embedding, chat stays in history) via
  `/api/assistant/memory` — all statements on the RLS client, own rows only.

**Status lines**
- New SSE keys per tool (`kb`/`schedule`/`jobs`/`job`/`workload`/`clashes`);
  shared `statusLabels.ts` maps key → i18n label in BOTH AssistantShell and
  FloatingChatPanel; unknown keys fall back to "Thinking…" so new server tools
  never need a client release. en + zh strings (bn frozen).

**Tests** — 3 new standalone suites (tagger parse, past-chat-summary fallback,
tool schemas/validators); all 7 repo suites green (103 checks), type-check +
production build green.

## Nic's decisions this session

- Session start: AI importance tagger — skipped, no changes.
- Inline execution of the plan (no subagents).
- **Deferred to PRODUCTION after ALL phases ship:** the real-installer-login
  test (unassigned job → nothing found) and the two-account memory-isolation
  test — tracked as a pending item in nic-checklist.md.
- Ran `npx supabase db push` (0046) before the push to dev; approved the push
  and the merge to main after the preview smoke test passed.

## Facts worth keeping

- **This clone's `node_modules` still had SDK 0.39** — Phase 1 ran in a
  parallel window and `npm install` was never run here after pulling its
  package.json. Symptom: type-check errors in code that was green on CI.
  After any pull that touches package.json, run `npm install` first.
- Supabase-js infers `never` on some `.select().maybeSingle()` chains — use
  the explicit `as { data: … | null; error: unknown }` cast pattern the repo
  already uses.
- `tool_choice: { type: 'none' }` is valid alongside adaptive thinking and
  server tools — used for the budget-exhausted final round.
- `tool_result` blocks must LEAD the user message; extra text blocks go after.
- The `asst_chats` own-UPDATE RLS policy (rename/pin precedent) is what lets
  the Memory routes run on the user-scoped client with no service client.
- Continuing a conversation regenerates its summary — a manual Memory edit is
  overwritten if that same chat continues afterwards (accepted, documented).
- `match_asst_chats` stays `SECURITY INVOKER` — that plus migration 0030 IS
  the per-user memory isolation; never convert it to SECURITY DEFINER.

## ⚠️ Next session

- **Phase 3**: chat attachments (images + PDF, Assistant page only) → scratch
  R2 prefix `asst-chat/{userId}/…` (never `files` rows) → conversational
  confirm → `create_pending_job` (the ONE action; role-gated via
  `getEffectiveRole`: sales/scheduler/coordinator/admin) with bucket
  auto-filing (R2 copyObject) + link chip; Move-file-between-buckets on the
  job form. **No migration.** Open offer: build the 30-day scratch cleanup in
  the same session instead of deferring.
- Phase 4 (Projects) needs **migration 0047 — db push before code push**.
