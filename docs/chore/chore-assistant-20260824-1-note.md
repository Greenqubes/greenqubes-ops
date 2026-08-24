---
session: chore-assistant (Assistant upgrade design spec)
date: 2026-08-24
branch: dev (docs only — no app code touched)
---

# Assistant Upgrade Design Spec — APPROVED

> Nic's ask: recent AI chat products are much smarter and more intuitive than
> our assistant; propose improvements. A full brainstorming session produced an
> approved 4-phase spec. **No code this session.** Spec:
> [../superpowers/specs/2026-08-24-assistant-upgrade-design.md](../superpowers/specs/2026-08-24-assistant-upgrade-design.md)
> (approved via summary — Nic skipped the full read).

## Where the assistant stands today (findings)

- `claude-sonnet-4-6`, `max_tokens: 1024` (answers truncate mid-sentence),
  SDK `^0.39.0`, old `web_search_20250305` tool, no thinking, no caching.
- One pre-baked KB lookup per question; past-chat "memory" is the first user
  message truncated to 200 chars; zero access to live jobs/schedule.
- UI: `sources` field on the Message interface exists but was never wired;
  chat force-scrolls to bottom on every streamed chunk (the "choppy" feel);
  `HistoryList` uses a 📌 emoji (no-emoji rule violation).
- Per-user chat isolation already solid: migration 0030 + `SECURITY INVOKER`
  on `match_asst_chats` — memory retrieval physically can't cross users.

## The four phases (each: dev → preview → main)

1. **Brain + Claude-grade UI/UX** — Sonnet 5, adaptive thinking, 8192
   max_tokens, SDK 1.x, `web_search_20260209`, prompt caching, status lines,
   Stop, web sources; Claude-style sidebar (New/Pinned/Chats) + two-row
   composer (+ attach placeholder, mic = Web Speech dictation, **no model
   picker**); smooth buffered streaming + sticky-bottom-only scroll; mobile
   app-like layout — top-RIGHT hamburger → left drawer (GreenQubes branding,
   New chat, history), greeting empty state, CompanyBar dropped on the phone
   assistant screen. Brand rule: Claude's layout, Greenqubes tokens.
2. **Live data + memory** — manual agentic tool loop (cap 8 rounds), read-only
   tools: `search_knowledge`, `get_schedule`, `find_jobs`, `get_job`,
   `get_team_workload`, `check_clashes` — all via the user-scoped client (RLS).
   **Migration 0046** `asst_chats.summary`; tagger writes a 2–3 sentence
   summary **only for meaningful chats** (Nic's pick); Memory manager view
   (see/edit/remove own memories).
3. **Attachments → pending job** — paperclip on the Assistant page (PDF +
   photos, R2 scratch prefix, base64 blocks); extraction summary → **quick
   confirm in chat** (Nic's pick) → `create_pending_job` (the ONLY action;
   sales/scheduler/coordinator/admin via effective role); files R2-copied into
   auto-classified buckets (default Others); link card to the job. Companion:
   **Move file between buckets** on the job form (bucket = `bucket_id` column
   only — no re-upload; server route if RLS blocks, per the fix-files pattern).
4. **Projects** — **migration 0047**: `asst_projects` + `asst_chats.project_id`
   (ON DELETE SET NULL) + `asst_project_files`; sidebar folders with nested
   chats, per-project files + standing instructions in the cached prefix,
   project-scoped linked memory. Full depth incl. linked memory (Nic's pick).

## Nic's decisions this session

- Model **Sonnet 5** (same tier price as today; intro pricing ~⅓ cheaper
  through 2026-08-31). Phased build (Option 1).
- **Privacy hard rule:** assistant memory never crosses users; digest vote →
  vault promotion is the ONLY bridge from one person's chat to company
  knowledge. Team-shared conversation memory permanently off.
- Job creation is the only assistant action; quiet-review via pending status
  plus a quick confirm in chat before creating.
- Only meaningful chats enter memory (tagger judges "reusable later?").
- Mic = free browser dictation; no model picker; mobile drawer hamburger
  top-right; **incognito skipped** (memory view covers the real need).
- AI importance-scoring question: no changes (session start).

## Also this session

- Vault submodule pointer committed (`2d46c1e`) — repo now records the vault
  at its 18 Aug state (digest promotions); `M vault` noise gone. Two small
  uncommitted files remain inside the vault (workspace.json + a Table of
  Content edit) — the next `vault backup:` auto-commit sweeps them.

## Facts worth keeping

- Sonnet 5 rejects `budget_tokens` and sampling params (400) — adaptive
  thinking only. No assistant prefill on 4.6+ models.
- A file's bucket is only `files.bucket_id` — moving between buckets is a
  one-column update, R2 object untouched.
- Pinning already exists (5-pin cap, `pin` route, Pinned/Today/Week groups) —
  Phase 1 restyles it, doesn't build it.

## ⚠️ Next session

- **Start with `superpowers:writing-plans` for Phase 1** — spec is approved;
  do not re-brainstorm. Phase 1 needs no migration.
- Phase 2 → migration 0046, Phase 4 → 0047: **db push before code push**.
