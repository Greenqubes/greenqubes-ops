---
session: feat-assistant-4 (Assistant upgrade Phase 4 — Projects; upgrade COMPLETE)
date: 2026-08-26
branch: dev → main (smoke test passed, merged same day — live on production; second same-day merge for the confession guard)
---

# Assistant Upgrade Phase 4 — SHIPPED (upgrade COMPLETE)

> Spec: [../superpowers/specs/2026-08-24-assistant-upgrade-design.md](../superpowers/specs/2026-08-24-assistant-upgrade-design.md)
> Plan: [../superpowers/plans/2026-08-26-assistant-upgrade-phase4.md](../superpowers/plans/2026-08-26-assistant-upgrade-phase4.md)
> **Migration 0047 applied BEFORE the code push** — Claude ran `npx supabase db push`
> at Nic's request (away from PC): dry-run → apply → verified up to date.
> **All four phases of the assistant upgrade are now live on production.**

## What shipped

**Migration 0047**
- `asst_projects` (owner-only RLS via `get_my_id()`), `asst_project_files`
  (owner via EXISTS on the project), `asst_chats.project_id` FK
  **ON DELETE SET NULL** — deleting a project releases its chats, never
  deletes them (spec).
- `match_asst_chats` dropped/recreated with an optional `project_filter uuid`
  param (signature change — CREATE OR REPLACE can't; the 0046 lesson).
  Named-args callers unaffected → deploy-order safe.

**Projects (per-user, RLS = the enforcement everywhere)**
- Sidebar + phone drawer: Projects section above Chats — collapsible folders,
  nested chat rows (`ChatRow` exported from `HistoryList` and reused), chat
  count, ⋮ menu (New chat in project / Project settings / Delete with a
  "chats are kept" confirm). Project chats are filtered OUT of the main list.
- `ProjectPanel` (z-[70], MemoryView pattern): name, instructions, reference
  files — **10 files / 20 MB per project, images+PDF only** (reuses the
  Phase 3 `validateAttachment`); upload = signed PUT to
  `asst-projects/{userId}/{projectId}/…` then a register row; caps re-checked
  server-side at register time (upload races). R2 objects deleted before rows
  (fix-files lesson); project delete sweeps its R2 files first.
- **Move to project…** on every chat ⋮ (main list needs ≥1 project; nested
  rows always) → picker modal with "No project"; optimistic re-home; moving
  the OPEN chat updates the composer chip + the next send/save.
- Composer **project chip** (Folder icon + name) when chatting inside a
  project → opens the panel. New chat from a folder files itself there;
  save route verifies project ownership and degrades to no-project.

**Cached project prefix (the load-bearing design)**
- Instructions ride as a SECOND cached system block; project files as blocks
  at the FRONT of the first user message with a `cache_control` breakpoint.
- Volatile context (date / user / past-chat recall) moves to the END of the
  last user message — **project chats only** — because a changing system
  block before the messages would invalidate the message breakpoint every
  turn. Non-project chats keep the pre-Phase-4 request shape exactly.
- 3 cache breakpoints total (limit 4). Repeat turns in a project re-read the
  files at the ~0.1× cache rate instead of full input price.
- Recall inside a project: `match_asst_chats` called twice (project-filtered
  first, general second), deduped by id, cap 4 — siblings first.

**Request-file budget guard**
- `REQUEST_FILE_BUDGET` = 22 MB raw (32 MB API cap ÷ 4/3 base64, minus
  headroom). Message attachments across the WHOLE history draw down one
  budget (minus project bytes); past-budget files degrade to a
  "[not included — file size limit]" text note instead of a rejected request.
  Oldest-first, deterministic → cache-stable. Also closes a latent Phase 3
  gap (long chats with many 20 MB messages could exceed the cap).

**Health tab (Nic's request, same session)**
- API usage tracker window filter: **30 days / 7 days / Today** chips
  (Today = SGT midnight, computed server-side); `?window=` param on
  `/api/admin/health`; `getUsageSummary(sinceIso)`; card labels follow; old
  data stays visible (dimmed) while switching — no page flash.

**False-confession guard (post-ship, same day)**
- During the installer security test the assistant "apologised" for
  supposedly answering unverified — the answer WAS tool-checked (the
  "through 25 Sep" range is get_schedule's 30-day window), but past-turn
  tool_use blocks aren't persisted in saved history, so on the next turn the
  model couldn't see its own check and confabulated. One SYSTEM_PREFIX line
  added: past lookups aren't visible — never speculate, just re-check.
  Nic: "false confession erodes trust". Cache prefix rewritten once (pennies).

**Verification** — 2 new standalone suites (attachments project rules,
project-context builders); all 9 repo suites green; type-check + production
build green before every push.

## Nic's decisions this session

- Tagger: skipped, no changes (session start).
- **Caps: 10 files / 20 MB per project** — asked for 10 files or 100 MB;
  100 MB ruled out (32 MB API request cap, ~100 PDF pages/request, context
  window; files re-read every message). Big libraries belong in the KB/vault.
- Claude ran the 0047 db push (Nic away from PC) — explicit request.
- Inline execution (no subagents) — same as Phases 2/3.
- Straight dev→main for the one-line confession guard (green build, no
  preview round).
- **Deferred production security checks — ALL PASSED 2026-08-26**: installer
  sees nothing on unassigned jobs; two-account isolation (chats, memory,
  projects); unsupported-file rejection on PC (Phase 3 smoke test 4).

## Facts worth keeping

- The prompt-cache prefix is tools → system → messages, byte-checked. ANY
  volatile system block placed before a message-level breakpoint kills it —
  hence the volatile relocation for project chats.
- Anthropic messages must alternate roles — project files can't be their own
  user turn; they merge into the first user message's block array.
- `git checkout` between dev/main mid-session triggers "file changed on
  disk" notices for every touched file — it's the branch switch, not edits.
- `echo y | npx supabase db push` works non-interactively; `--dry-run`
  before and after is a cheap sanity bracket.
- `npm run lint` (`next lint`) is unconfigured in this repo and prompts
  interactively — the production build's lint pass is the real gate.
- The auto-mode permission classifier blocked a chained
  checkout/pull/merge/push one-liner; individual git commands went through.
- HealthTab's retry/refresh buttons must pass the window param — a bare
  `onClick={load}` would pass the click event as the window.

## ⚠️ Next session

- **The assistant upgrade track is closed.** Next big thing: the mobile app
  (spec at `superpowers/specs/2026-08-18-mobile-app-design.md`, awaiting
  Nic's review → implementation plan → build sessions).
- Watch item: cache-read tokens on project chats (Admin → Health, now
  filterable to Today) — confirm the cached prefix is paying off in practice.
- Backlog stands: filing-only Office attachments; Office-file reading
  (dependency OK needed); instant vault→KB promotion; Telegram watchdog;
  backup event logging.
