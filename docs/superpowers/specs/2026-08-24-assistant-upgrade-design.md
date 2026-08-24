# Assistant Upgrade — Design Spec

**Date:** 2026-08-24
**Status:** Approved by Nic (sections reviewed in chat) — pending final spec read-through
**Scope:** The AI assistant (full page + floating bubble) — model upgrade, live-data tools, agentic KB search, real memory, chat attachments → pending-job creation.

---

## Goal

Bring the assistant up to the standard of modern AI chat products. Today it is a
Sonnet 4.6 Q&A bot with a ~750-word answer cap, one silent pre-baked knowledge-base
lookup, an outdated web-search tool, and zero awareness of live jobs. After this
build it reasons before answering, looks up the real schedule/jobs/team under the
asker's own permissions, searches the knowledge base itself, remembers past
conversations properly, and can turn attached PDFs/photos into a filled-out
**pending** job for review.

Built in **four phases**, each verified on the Vercel preview before merge to main
(Nic's pick — Option 1, 2026-08-24; Phase 4 Projects added same day).

---

## Privacy model — hard rules (all phases)

Set by Nic 2026-08-24: assistant chats are tagged and linked to the user account
and role; nothing may leak into another user's assistant chat.

1. **Conversation memory is strictly per-user.** Retrieval of past chats only ever
   returns the asking user's own conversations. Already enforced in the DB:
   migration 0030 dropped the cross-read RLS policy on `asst_chats`, and
   `match_asst_chats` is `SECURITY INVOKER`, so the user-scoped client can only
   match the caller's own rows. This stays and gains explicit tests.
2. **Live-data tools run as the asking user.** Every tool queries through the
   user-scoped Supabase server client so RLS applies — an installer's assistant
   sees only their formally assigned jobs; suggested installers see nothing;
   commercial fields follow existing app rules.
3. **KB retrieval stays visibility-filtered** by the role tags on vault notes,
   exactly as today.
4. **Team-shared conversation memory is OFF — standing rule.** The original
   CONTEXT.md vision of role-shared `asst_chats` retrieval is superseded: a
   colleague's knowledge reaches others only via digest vote → vault → KB (the
   human-approved path). Saved chats keep their user/role/visibility tags for the
   digest pipeline, but cross-user retrieval is never enabled.

---

## Phase 1 — Brain + polish

**Model & reasoning**
- `claude-sonnet-4-6` → **`claude-sonnet-5`** (exact ID, no date suffix).
  Pricing $3/$15 per MTok ($2/$10 intro through 2026-08-31).
- **Adaptive thinking**: `thinking: { type: "adaptive" }`. Note Sonnet 5 rejects
  `budget_tokens` and sampling params (`temperature` etc.) with a 400 — remove any.
- `max_tokens` 1024 → **8192** (streaming, so no HTTP-timeout concern).

**SDK & route**
- Upgrade `@anthropic-ai/sdk` from ^0.39.0 to current 1.x. The
  `web_search` cast hack in `chat/route.ts` goes away (typed in current SDK).
- Web search: `web_search_20250305` → **`web_search_20260209`** (dynamic
  filtering variant, supported on Sonnet 5).
- **Prompt caching**: `cache_control: { type: "ephemeral" }` on the stable system
  prefix. Keep volatile content (today's date, retrieved context) AFTER the cached
  block — restructure the system prompt so the frozen part (persona + guidelines)
  comes first. Verify with `usage.cache_read_input_tokens` in dev.
- **Cost logging**: update the hardcoded Sonnet 4.6 math in `chat/route.ts` to
  Sonnet 5 pricing and account for cache-read/cache-write token rates.

**SSE protocol & UI**
- Extend the SSE event vocabulary: `{type:'status', label}` (e.g. "Thinking…",
  "Searching the web…"), `{type:'sources', items:[{url,title}]}`, plus existing
  `text` / `done` / `error`.
- **Status lines**: emitted on thinking-block start and each server-tool start;
  rendered as a subtle italic line in the streaming bubble (both AssistantShell
  and FloatingChatPanel).
- **Stop button**: client `AbortController` on the fetch; UI swaps Send → Stop
  while streaming. Partial answer is kept and saveable.
- **Web sources**: surface `web_search_tool_result` citations into the existing
  (never-populated) `sources` field on the Message interface; render as link
  chips under the answer.
- D-Promote canned wink behaviour unchanged.
- New UI strings in `en.ts` + `zh.ts` only (Bengali frozen).

**Out of Phase 1:** no tools beyond web search, no retrieval changes.

---

## Phase 2 — Live-data tools + agentic KB search + memory

**Agentic loop.** The chat route becomes a manual tool-use loop (stream → on
`stop_reason: "tool_use"` execute tools → append `tool_result` blocks in ONE user
message → continue), streaming SSE events throughout. **Cap: 8 tool rounds** per
question; on hitting the cap the model is told to answer with what it has.
Parallel tool calls in one turn are executed concurrently and returned together.
Failed tools return `tool_result` with `is_error: true` (never dropped).

**Tools (all read-only, all via the user-scoped client / existing query modules):**

| Tool | Purpose | Backing code |
|---|---|---|
| `search_knowledge` | KB vector search, callable repeatedly with rephrased queries | `retrieveContext`/`match_kb_chunks` (KB half) |
| `get_schedule` | jobs in a date range, optional status filter | `queries/jobs.ts` schedule select (respect the never-embed-users-on-jobs rule — follow-up query for names) |
| `find_jobs` | search jobs by title/client text | new thin query |
| `get_job` | one job's details, team, tasks, status | existing job-detail queries |
| `get_team_workload` | installers + assignments over a range ("who's free Friday?") | existing workload/assignee queries |
| `check_clashes` | would installer X on date/time Y clash? | existing clash-detection util (checkOnly path) |

- Pre-baked one-shot retrieval is **removed**; `search_knowledge` replaces it.
  (The per-user past-chat retrieval below stays automatic — cheap and always
  relevant.)
- Status line per tool call: "Checking the schedule…", "Searching the knowledge
  base…" etc.

**Memory upgrade**
- **Migration 0046: `asst_chats.summary text`.** At save time the tagger
  (already a Haiku call) additionally produces a 2–3 sentence summary of the
  conversation; stored on the row and embedded (embedding input becomes
  topic + summary instead of raw first-message).
- `match_asst_chats` returns `summary`; the automatic past-chat context block
  feeds summaries instead of `first user msg.slice(0,200)`.
- Old rows without summaries fall back to the current truncation.
- Per-user isolation as per Privacy model — covered by RLS; add a two-account
  test to the smoke checklist.
- **DB push before code push** (standing lesson) — the summary column must exist
  before code that selects it deploys.

---

## Phase 3 — Chat attachments → pending job

**Attachments in chat (Assistant page only).**
- Paperclip on the composer: images (jpg/png/webp/heic per current app support)
  and PDF, multiple per message. Uploaded via the existing R2 signed-URL helpers
  to a scratch prefix `asst-chat/{userId}/{chatId or session}/…` — NOT rows in
  `files` (they belong to no job yet). Shown as chips in the sent message.
- Model input: images as base64 image blocks, PDFs as base64 document blocks
  (no Files API dependency; mind the 32 MB request cap — per-file size limits
  mirror the app's existing upload caps).
- The floating bubble gets no paperclip; it keeps handing off to the full page.
- Any role may attach files for **questions** ("what does this permit say?").

**`create_pending_job` tool (the one action).**
- **Role gate:** sales / scheduler / coordinator / admin — via `getEffectiveRole`
  (preview-as applies), mirroring the app's job-creation rights. Installer /
  designer / production get a polite refusal string from the tool.
- **Conversational confirm (Nic's pick):** the assistant first presents an
  extraction summary in chat — title, client, location, date/time, description,
  bucket assignment per file — and calls the tool only after the user agrees.
  System-prompt enforced; the pending status is the second safety net.
- **What it creates:** a `pending` job with Details-tab fields (project title,
  client company/contact, location, date, date_end, time_start, time_end,
  description, notes, production instructions if clearly present). POC = the
  requesting user. Team/coordinators/tasks/chat empty. **Never scheduled** —
  the tool cannot set any other status.
- **Attachments → buckets:** each chat attachment used in the request is copied
  (R2 `copyObject`, like Duplicate) into the new job's folder and inserted as
  `files` rows in the right bucket — Permit-to-Work / BCA / Designer JO /
  Others — chosen by the model per file, defaulting to Others. Original chat
  copies remain in the scratch prefix; scratch files are never `files` rows, so
  nothing can leak into job chat (see the bucket-leak lessons). Scratch cleanup
  is deferred — logged as a follow-up checklist item, not built this round.
- **Missing required fields:** the assistant asks in chat rather than guessing;
  optional fields stay blank (existing form rules — title falls back to
  "Untitled" convention, description/time_end optional).
- **Result in chat:** a link card (new SSE event `{type:'job_created', id,
  title}`) rendered as a tappable chip → `/jobs/{id}`; the job's readable R2
  folder is stamped by the existing 0042 trigger.
- Creation runs through a dedicated server path reusing the New Job submit
  logic/validation (not raw inserts), so future form-rule changes stay in one
  place. No Telegram fires on assistant-created pending jobs (same as manual
  pending creation — notifications fire on push-to-schedule as today).

**Move file between buckets (job form — companion feature, Nic 2026-08-24).**
- Needed so a wrong AI bucket assignment (or any wrong manual filing) is fixable
  without re-uploading. A file's bucket is only the `bucket_id` column on its
  `files` row — the R2 object never moves — so a move is a one-field update.
- UI: a "Move to…" control on each file tile in `AttachmentBuckets` (⋮ menu or
  equivalent), listing the job's other buckets; any picker overlay layers
  `z-[60]`+.
- Permissions: same as file management today — `canManageJobFiles` rules (office
  roles, never installers, completed jobs locked). If the `files` UPDATE RLS
  blocks the client-side write, use a small server route mirroring the
  delete-fix pattern (`fix-files` 2026-08-19); UI updates only on server
  success, error toast on failure.
- URL-link entries move the same way (they are `files` rows too).

---

## Phase 4 — Projects (folders + shared files + instructions + linked memory)

Nic's pick 2026-08-24: full projects **with linked memory** and folder grouping,
like modern AI chat products. Strictly per-user, per the Privacy model — a
project, its files, its instructions and its memory belong to one account and
are invisible to every other user.

**Data model (migration 0047):**
- `asst_projects` — id, user_id (owner), name, instructions (free text),
  created/updated timestamps. RLS: owner-only for select/insert/update/delete.
- `asst_chats.project_id uuid NULL` → FK to `asst_projects`,
  `ON DELETE SET NULL` (deleting a project releases its chats back to the
  general history list — never deletes conversations).
- `asst_project_files` — id, project_id, name, r2_key, mime, size, created_at.
  Objects live under `asst-projects/{userId}/{projectId}/…` in R2 (not `files`
  rows — they belong to no job). Owner-only RLS.

**Folder grouping (sidebar + mobile history page):**
- Projects render as collapsible folders in `HistorySidebar` above the flat
  history list; chats inside a project appear under its folder.
- Create / rename / delete project; move a chat into or out of a project via
  the existing ⋮ row menu ("Move to project…"). Delete keeps chats (released
  to the main list) — stated in the confirm modal.
- The mobile `/assistant/history` route gets the same grouping.
- Any picker/confirm overlay layers `z-[60]`+ (hard rule).

**Shared project context (every chat inside the project):**
- **Instructions**: the project's free-text instructions are appended to the
  system prompt ("always answer in bullet points", "this is about the Changi
  site").
- **Files**: project files (PDF/images, uploaded via the Phase 3 paperclip
  infra but stored at project level, managed from a small project header
  panel — list / add / remove) are included as document/image blocks.
- **Linked memory**: past-chat retrieval inside a project is scoped to the
  project's own chats first (summaries from Phase 2), so sibling chats
  remember each other; general per-user memory still applies beneath it.
- Project context (instructions + files) is a stable block — placed inside the
  cached prefix so repeat turns in a project stay cheap (caching matters here:
  files ride along on every message).
- Starting a **new chat from inside a project** files it there automatically;
  the create-pending-job flow works normally within project chats.

**Testing (preview):** two accounts cannot see each other's projects; a chat
moved into a project picks up its instructions + files on the next message;
sibling-chat recall works; deleting a project releases its chats intact;
folder UI usable on phone.

---

## Guardrails & constraints

- Tool-round cap 8; per-file and per-message attachment size caps; `max_tokens`
  8192.
- Streaming keeps the Vercel function alive; loop cap bounds worst-case runtime.
- Any new overlay (paperclip sheet etc.) layers `z-[60]`+ above BottomNav (hard
  rule).
- All user-facing strings i18n'd en + zh; bn falls back (frozen).
- Per-question cost continues to log to `api_usage` (all loop iterations summed).
- Hydration lesson: no locale-dependent date rendering in new UI.

## Out of scope (this build)

- Any action beyond `create_pending_job` (no edits, no suggestions, no
  scheduling, no completion).
- Paperclip in the floating bubble.
- Team-shared conversation memory (standing rule — off).
- Voice input; read receipts; assistant on the external `/ext` pages.

---

## Testing per phase (preview, before merge)

**Phase 1:** long answer no longer truncates; status line + Stop work on page and
bubble; sources render after a web-search answer; Admin → API usage shows new
pricing rows; cache-read tokens non-zero on second turn.

**Phase 2:** scheduler asks schedule/workload/clash questions → correct answers;
**real installer login** asks about an unassigned job → assistant finds nothing;
two accounts cannot surface each other's chat memory; KB questions that used to
miss now resolve via multi-search; summary column populated on save.

**Phase 3:** permit PDF + photos → extraction summary → confirm → pending job
with correct buckets + link chip; installer/designer refused creation but can ask
about attached files; oversized file rejected cleanly; job appears on the sales
pending tab and pushes to schedule normally.

## Deployment

Per phase: migration first (`npx supabase db push` — 0046 in Phase 2, 0047 in
Phase 4) → `dev` → Vercel preview smoke test by Nic → merge `main`. Type-check
+ production build green before each push.
