# Greenqubes — Project Context

> Read this first on every Claude Code session. Holds the key decisions and aesthetic direction so we don't relitigate them.

_Last updated: 2026-08-26 (feat-assistant-4 — assistant upgrade **COMPLETE: all four phases live on production**. Phase 4 shipped same day as built: per-user Projects (folders + shared instructions + reference files 10×/20 MB as a cached prompt prefix + linked memory + Move-to-project), migration 0047 applied before the code. Health-tab usage window filter (30d/7d/Today) rode along. Deferred production security checks all PASSED 2026-08-26; false-confession guard added to the assistant prompt. Memory stays strictly per-user.)_
_Last updated: 2026-08-28 (feat-design — **Design Load (designer workflow V2.5) built on `feat-designer-load-flow`, NOT merged**: designer assignment + Design brief card + AI complexity scoring + auto-shifting due dates + Design Load board + rating slider with trust check + 3-day reminders + admin AI Scores tab; plus Nic's feedback-round changes (coordinator suggest-only for installers, sales-level coordinator access, created_by, production file access, mobile hamburger drawer, draggable floating buttons, notification upgrades). Migrations 0048/0049/0050 applied. Next: B3 Telegram fix + edits 15/16, then Nic's merge. The role lines below note the branch-only changes.)_
---

## What this is

Internal ops platform for a small Singapore-based install/build company. Phase 0 covers:

- **Schedule management** (calendar / week / month views, clash detection, approval workflow)
- **Installer-facing dashboard** (today / up next / past jobs, retroactive photo uploads)
- **AI assistant** (chatbot with web search and conversation memory)
- **Live job chat** (text + voice notes between sales, scheduler, installer)
- **Telegram notifications** (schedule changes, overdue alerts, installer activity)

Team size: ~10 (sales + scheduler + installers). Three languages: English, Simplified Chinese, Bengali.
**Bengali is frozen (boss decision, 2026-08-03 via Nic):** no new bn translations get written — new i18n keys are added to `en.ts` + `zh.ts` only and bn falls back to English automatically (`t()` falls back per-key). Existing bn strings stay. Date labels (day/month names) are always English in every language (CLAUDE.md hard rule).

## Status

Migration from the original React prototype to a feature-folder Next.js app with Supabase backend is complete. **The webapp is LAUNCHED — v1.0.0, declared by Nic 2026-08-18** (all necessary testing done; the planned alpha/beta/launch rounds were closed without being run). The webapp continues as the **desktop/office tool**.

**Next milestone: the mobile app** — a native Android + iPhone app (React Native + Expo, one codebase in `mobile/`, same Supabase/R2/Vercel backend), built in 3 stages, Android first via direct .apk; iPhone gated on the directors' Apple Developer greenlight; Telegram bots retire only when Stage 3 + iPhone rollout are both live. Spec: `docs/superpowers/specs/2026-08-18-mobile-app-design.md`. Admin screens + FCFS board stay desktop-only; external installers keep their web links.

**Second approved track: the assistant upgrade** (spec approved 2026-08-24) — four phases on the webapp. **Phase 1 shipped 2026-08-25** (Sonnet 5 + adaptive thinking + Claude-grade UI/UX). **Phase 2 shipped 2026-08-25** (agentic tool loop cap 8; six read-only live-data tools through the user-scoped client so RLS filters every lookup — schedule/jobs/job detail/workload/clashes, financials never included; agentic KB search replaces the pre-baked one-shot; per-user memory: Haiku summary + only-meaningful gate on `asst_chats.summary` (migration 0046), embedding = topic+summary, Memory manager view to edit/forget — see plan.md). **Phase 3 shipped 2026-08-25** (chat attachments on the Assistant page — images + PDF only, the formats the model can read; HEIC/Office rejected with clean errors, Office support logged as future items — uploading to an R2 scratch prefix that a daily 30-day cleanup cron sweeps; `create_pending_job` — the ONE allowed action, role-gated to sales/scheduler/coordinator/admin, confirm-in-chat first, pending status only, attachments R2-copied into model-chosen buckets, link chip in chat; plus Move-file-between-buckets on the job form; no migration). **Phase 4 shipped 2026-08-26** (Projects — per-user folders grouping assistant chats, each project carrying shared instructions + reference files (10 files / 20 MB, images+PDF) injected as a cached prompt prefix into every chat inside it, project-scoped memory recall (sibling chats first), Move-to-project; migration 0047 applied before the code deployed; deleting a project keeps its chats). **The four-phase upgrade is COMPLETE and live on production.** The deferred security checks were run on production 2026-08-26 and ALL PASSED: a real installer login finds nothing on jobs it isn't assigned to; two accounts are fully isolated (chats, memory and projects); unsupported chat files are rejected cleanly. A false-confession guard was added the same day: past-turn tool lookups aren't persisted in chat history, so the assistant is instructed never to speculate about whether an earlier answer was verified — it re-checks instead. **Standing privacy rule (Nic 2026-08-24): assistant memory never crosses users — the digest vote → vault promotion is the only bridge from one person's chat to company knowledge.** Spec: `docs/superpowers/specs/2026-08-24-assistant-upgrade-design.md`.

---

## The stack (locked in for Phase 0)

| Layer | Service | Why this one |
|---|---|---|
| Hosting | **Vercel** | Free tier covers small teams; serverless functions for API routes; Telegram bot webhooks land here |
| Database / auth / realtime | **Supabase** | Postgres + magic-link auth + websockets + pgvector all in one. RLS enforces access control at DB layer. |
| File storage | **Cloudflare R2** | S3-compatible, **zero egress fees** — critical for installers downloading photos on mobile data |
| Image processing | **Cloudflare Images** | Auto-resize phone photos (8MB → thumbnails). $5/mo flat for 100k images. |
| AI assistant | **Anthropic Claude (Sonnet 5)** | Pay-per-use API. Adaptive thinking + web search + prompt caching (since Phase 1, 2026-08-25). Haiku 4.5 for tagger/titles/suggest. |
| Embeddings | **Voyage AI** | Anthropic's recommended embedding partner. Pairs cleanly with Claude. Single AI ecosystem rather than mixing vendors. ~$0.05–$0.12/M tokens. |
| Notifications | **Telegram Bot API** | Team already uses Telegram. Free. |
| Knowledge base | **Obsidian vault** | Markdown ownership, no vendor lock-in. Synced to Supabase nightly. |
| Cold archive | **Local PC + external drive** (rclone) | Permanent backup mirror. ~S$150 one-time hardware cost. |

**Total monthly cost at small scale: ~$36–63 USD (~S$48–84).** Scales to ~$110–160/mo at 3× the team without changing architecture.

---

## Seven roles (strict access control)

> Workflow V2 replaced the original three-role model. There is **no approval step** — sales pushes
> jobs straight onto the schedule and the scheduler/coordinator assigns the installer.

- **Sales** — creates jobs and pushes them to the schedule. *Suggests* installers (yellow) but cannot formally assign. Sees all jobs and clients.
- **Scheduler** — manages the company-wide schedule, *formally assigns* installers (green), override powers (e.g. complete a job without photos).
- **Coordinator** — same job-form rights as scheduler, including formal installer assignment. Multiple coordinators per job via `job_coordinators`. _(On `feat-designer-load-flow`, not yet on production — Nic 2026-08-27: coordinators become **suggest-only for installers everywhere** like sales (only the scheduler formally assigns), gain **sales-level job access** (create, push to schedule, delete, duplicate, set the Person-in-Charge at creation), and can complete/reopen designs.)_
- **Installer** — sees only jobs they are **formally assigned** to (a suggestion must never surface). Uploads completion photos, signs DOs, posts chat + voice notes. **Cannot see commercial info.**
- **Designer** — view-only on the job form (no Save bar); chat only. _(On `feat-designer-load-flow`: full Files-tab access, "Design completed" tick with a required 1–5 rating, Reopen design, Design Load tab with Board | My Jobs.)_
- **Production** — edits only its own fields: "Production ready", "DO issued", production instructions and production photos. Everything else view-only. _(On `feat-designer-load-flow`: can read files — their photo uploads had been silently broken by RLS since V2, fixed by migration 0050; attachment buckets stay view-only.)_
- **Admin** — full access; hard-gated to `ai@greenqubes.com`. Can "preview as" any of the other roles.

Role is bound to the user's authenticated Supabase session, not a UI toggle. Row-level security policies in the DB enforce this — there is no path where the client can lie about their role and get sensitive data.

**Admin is a DB role, not an email gate** (since migration 0019, feat-admin 2026-05-14) — `role = 'admin'` on the user's `public.users` row grants it; every gate checks `role === 'admin'`. Because admin is now a pure DB field, users must never be able to change their own `role`: the security audit (2026-08-13) found the self-update RLS had no column restriction and any user could escalate to admin/scheduler from the browser. **Migration 0044** now blocks non-admins from changing role (and auth_id/email/deleted_at/digest_subscriber/telegram_chat_id) on their own row. Any future change to the `users` update policy must preserve this.

**Note on "preview as":** the admin role switcher changes the *UI role only* — the database still sees you as admin (who can read everything). Anything gated by row-level security (e.g. suggestion-hiding from installers) must be tested with a **real non-admin login**.

---

## Built features (in prototype, awaiting migration)

The prototype covers six rounds of "boss feedback":

1. **Three-role link system** — sales / scheduler / installer, each with role-appropriate tabs and permissions.
2. **Approval workflow** — sales draft → workload preview → scheduler approves → schedule. Either side can send back.
3. **Workload preview before push** — sales sees per-day team load before sending to scheduler. Can switch dates inline.
4. **Overdue alerts** — automatic at 2-hour checkpoints, 6 PM end-of-day, and past `timeEnd`. Bell icon + drawer. _(Prototype behaviour. As shipped 2026-08-06: twice daily 9am + 6pm SGT, jobs older than 3 days ignored. Bell drawer 2026-08-17: alerts team-scoped — POC/coordinators/assigned installers; scheduler+admin see all — with per-device Mark as read. See plan.md.)_
5. **Photo-required completion** — can't mark job done without completion photos; scheduler can override.
6. **Installer features (latest round)**:
    - Live job chat thread (text + voice notes via `MediaRecorder`)
    - Installer dashboard (Today/Now + Up next + This week)
    - Past jobs view for retroactive uploads (DO, photos, comments)
    - All installer additions notify the sales POC via Telegram

Plus: i18n in EN/ZH/BN, AI smart textarea (suggest from attachments / improve text), photo galleries, expiring file links, ad-hoc client + sales addition.

---

## Design tokens (preserve these — they are the brand)

> **Rebranded 2026-08-18 to the company logo palette** (Nic's call — logo lime `#91C740` + slate `#6C747C` are the anchor colors). Token NAMES were kept for compatibility (`--terracotta` etc. appear throughout the code), only the VALUES changed. Red (`--bad`) and all neutrals unchanged.

```css
--bg: #F4F1EC;        /* warm bone */
--paper: #FFFFFF;
--ink: #1A1815;       /* near-black warm */
--ink2: #5C564E;
--muted: #8B8478;
--line: #E8E2D7;
--terracotta: #5A801F;  /* primary accent — brand moss green (logo lime darkened for white-text contrast) */
--lime: #91C740;        /* TRUE logo green — small non-text highlights only (live dots, favicon) */
--green: #3E7F7B;       /* installer / success — teal (NOT green: company green stays unique, Nic 2026-08-18) */
--blue: #6C747C;        /* secondary / info — logo slate */
--amber: #A9852F;       /* warning — sand gold */
--punct-strict: #D14545; /* SCHEDULING SIGNAL — strict on-time. Fixed company indicator, never rebrand */
--punct-flex: #3D6FB5;   /* SCHEDULING SIGNAL — flexible window. Fixed company indicator, never rebrand */
```

**Punctuality red/blue are signal colors, not brand colors** (Nic, 2026-08-18): strict = red, flexible = blue is a company scheduling convention. They live in their own `--punct-*` tokens precisely so a future palette change can't touch them.

**Fonts:** Fraunces (display, weights 400–600, optical sizing) + IBM Plex Sans (body, 400–600). Bengali fallback: Noto Sans Bengali. Chinese fallback: Noto Sans SC.

**Aesthetic:** warm editorial. Cards with 14px radius. 1px borders in `--line`. No drop shadows except on toasts and modals. Pills, not badges. Lowercase weight-500 buttons. Generous whitespace — never cramped.

---

## Data model (high-level)

```
users          — id, name, role, telegram_chat_id, lang, phone
jobs           — id, status, date, time_start, time_end, client, location, ...
job_assignees  — job_id, user_id (M:N installers ↔ jobs)
files          — id, job_id, kind (photo|voice|do|attachment|completion), r2_key, name, uploader_id, ts
messages       — id, job_id, author_id, kind (text|voice), content/voice_url, ts
asst_chats     — id, user_id, msgs[], embedding, visibility[], tags[], importance, ts
kb_chunks      — id, source_path, content, embedding, visibility[], tags[], updated_at
events         — id, actor_id, kind, target_id, ts (audit log)
```

**Job statuses:** `scheduled | pending | awaiting_approval | completed`.

**Visibility model:** every retrievable record carries a `visibility text[]` column with tokens like `["role:sales", "role:scheduler", "project:job_123", "private:user_42", "public-internal"]`. RLS policies + retrieval queries filter on intersection with the calling user's permission set.

---

## Access control — the rule that's non-negotiable

The retrieval layer (Supabase RLS + pgvector queries) filters records **before** they reach Claude. Claude never has access-restricted data in its context window in the first place — so jailbreak attempts can't extract what was never there.

Default for new records: most restrictive (`private:user_id`). An auto-classifier (small Claude prompt) widens visibility on creation based on content:
- Install techniques / how-to → `public-internal`
- Supplier costing, quotes, margins → `role:sales,role:scheduler`
- Personnel / HR matters → `role:scheduler` (or stricter)
- Project logistics → `project:<id>` (anyone on that project)

False positives (over-restriction) are cheap; false negatives (data leakage) are expensive. When in doubt, lock down.

---

## Knowledge base — two parallel sources

### Curated knowledge (Obsidian → Supabase, nightly sync)

Team writes in Obsidian (markdown vault, lives on the user's machine, optionally synced via Obsidian Sync or git). Each note has YAML frontmatter:

```yaml
---
visibility: [role:sales, role:scheduler]
tags: [supplier, costing]
---
```

A nightly script:
1. Walks the vault
2. Splits each `.md` file into ~500-token chunks
3. Embeds each chunk via Voyage AI
4. Upserts to `kb_chunks` with the file's frontmatter visibility/tags

What goes here:
- Install SOPs and playbooks
- Client profiles (preferences, contacts, gotchas)
- Supplier list with prices, lead times (sales-only via frontmatter)
- Post-job notes ("what went wrong, what to remember")
- Templates (quote, PTW, onboarding checklist masters)
- Internal contacts (venue managers, BCA contact, etc.)

### Conversation memory (born in Supabase)

Every assistant chat is auto-saved with metadata:
- `topic`, `entities[]`, `tags[]`, `importance` (1–5), `visibility[]`, and since Phase 2 (2026-08-25) a `summary` (2–3 sentences) + a `meaningful` gate
- Generated by a classifier Claude prompt running at conversation end

Stored in `asst_chats`. **Only meaningful chats get a summary + embedding** (input = topic + summary); trivial chats save with both NULL so they never surface in recall or the Memory view. Retrieval is **strictly per-user** (RLS, migration 0030) — the Memory manager in the assistant sidebar lets each user edit (re-embeds) or forget their own memories.

### Retrieval (since Phase 2, 2026-08-25)

When a user asks the assistant something:
1. The user's own past-chat memory is retrieved automatically (embed question → `match_asst_chats`, summaries preferred, old rows fall back to first-message truncation) and passed as context
2. The model itself decides the rest through its tools: `search_knowledge` (pgvector over `kb_chunks`, visibility-filtered by RLS, repeatable with rephrased queries) plus the live-data tools (schedule, jobs, job detail, team workload, clash check) — every tool runs on the user-scoped client so RLS filters what the asker may see
3. Claude answers, looping through tools as needed (cap 8 rounds)
4. The conversation saves back through the auto-tagger (summary + meaningful gate + digest importance)

The KB + per-user memories = the company's institutional brain, growing organically as conversations happen and curated by the Monday digest.

---

## Monday digest pattern

Every Monday at 9 AM SGT, a Vercel cron (`/api/cron/monday-digest`) runs:

1. Pull conversations with `importance >= 4` that are new or unvoted
2. Generate one-paragraph summaries for each via Claude Haiku
3. Send to all `digest_subscriber` users via the **dedicated digest Telegram bot** (`TELEGRAM_DIGEST_BOT_TOKEN`) with Promote / Skip inline buttons
4. Votes are recorded in `digest_votes`; message edits show live poll count (`📊 X Yes · Y No · Z Pending`)
5. Once strict majority (>50%) votes Promote → sends all subscribers a link to generate the Obsidian note
6. A 5-day timeout cron (`/api/cron/digest-timeout`) auto-resolves stalled votes: strict majority yes → promoted, otherwise dismissed

**D-Promote secret command:** typing `D-Promote` anywhere in an assistant conversation forces `importance = 5` and immediately sends the conversation to all digest subscribers outside the Monday schedule. The word is stripped from the Telegram summary so recipients don't see it.

The loop: organic conversations → flagged on Monday (or immediately via D-Promote) → human majority approves → curated Obsidian note → syncs back into the searchable index → answers smarter next time.

**Promoted notes land in `Table of Content/Digest/`** in greenqubes-kb (the vault was reorganised under `Table of Content/`, 2026-08-18) — the original root `digest/` folder is retired. **Vercel lesson (2026-08-18): never fire-and-forget async work in an API route** — Vercel freezes the function once the response returns, killing unfinished promises; the vault write and D-Promote send are awaited for this reason.

This is the system's main learning mechanism. **Auto-promotion is forbidden** — the human-in-the-loop majority vote is the safety mechanism against the AI mis-classifying something as broadly shareable.

---

## Things NOT to suggest (don't relitigate)

- **Don't suggest Firebase.** We picked Supabase for SQL + RLS + pgvector in one place.
- **Don't suggest AWS S3.** R2's free egress is the whole point for mobile-heavy installer use.
- **Don't suggest replacing Telegram with email/SMS.** Team already uses Telegram.
- **Don't suggest swapping Voyage AI for OpenAI embeddings.** We picked Voyage to stay in the Anthropic-aligned ecosystem and avoid mixing AI vendors. Cost is a wash.
- **Don't suggest a separate vector DB** (Pinecone, Weaviate). pgvector in Supabase shares auth with the main DB — one less access-control layer to maintain.
- **Don't suggest abandoning Obsidian for a CMS.** Markdown ownership and offline-first matter.
- **Don't add an eighth role.** The model is settled at seven (sales / scheduler / coordinator / installer / designer / production / admin). Claude may suggest new roles but must never add or remove one without explicit confirmation.
- **Don't embed `users` directly onto `jobs`** in a PostgREST select — `jobs` has several FKs to `users` and this has broken twice (PGRST201 crashes → migration 0035; installer blank titles → Phase 2). Fetch the user in a follow-up query.
- **Don't store sensitive info in the AI system prompt** as a safeguard. RLS at the retrieval layer is the actual access-control mechanism.
- **Don't auto-promote conversations to Obsidian.** Human-in-the-loop on every promotion.

---

## Coding conventions

- **File size:** aim < 500 lines per file. Hard cap 2,000.
- **One concept per file.** A "feature" is a folder, not a file.
- **Components are server components by default**, client only when interactive.
- **Styling:** Tailwind for new code. The prototype's inline styles get migrated to Tailwind classes that map to the design tokens above. CSS variables for the token values.
- **Prefer composition over props explosion.** If a component takes >7 props, split it.
- **TypeScript strict.** No `any`, no `@ts-ignore` without an issue link.
- **i18n strings live in `src/lib/i18n/{en,zh,bn}.ts`** — never hardcode user-facing copy in components.
- **Database queries go through `src/lib/supabase/queries/<feature>.ts`** — never write raw queries inline in components.

## File structure

```
greenqubes/
├── src/
│   ├── app/                      # Next.js routes + layouts
│   ├── features/
│   │   ├── schedule/             # calendar, list/week/month
│   │   ├── job-detail/           # the big edit form
│   │   ├── installer/            # dashboard, history, job view
│   │   ├── chat-thread/          # job chat + voice notes
│   │   ├── assistant/            # AI chatbot panel
│   │   ├── notifications/        # alerts, toasts, telegram routing
│   │   ├── approvals/            # sales→scheduler workflow
│   │   ├── completion/           # photo-required completion modal
│   │   └── admin/                # user management, role assignment, Telegram chat ID, system health, crash log
│   ├── components/               # shared: Card, Pill, Btn, Field
│   ├── lib/
│   │   ├── i18n/
│   │   ├── supabase/
│   │   │   ├── client.ts
│   │   │   ├── queries/
│   │   │   └── types.ts
│   │   ├── storage/              # R2 signed-URL helpers
│   │   ├── telegram/
│   │   ├── ai/                   # Claude API + retrieval + auto-tagger
│   │   └── utils/                # time, clash detection, formatting
│   └── types/
├── supabase/
│   ├── migrations/               # SQL schema files (numbered)
│   └── seed.sql                  # demo data
├── scripts/
│   ├── obsidian-sync.ts          # nightly KB sync
│   ├── monday-digest.ts          # weekly importance digest
│   └── backup.sh                 # rclone cold archive
├── docs/
│   ├── plan.md                   # session build plan
│   ├── CONTEXT.md                # you are here
│   ├── greenqubes-phase0.jsx     # design reference (active — used in CLAUDE.md)
│   ├── session*-note.md          # per-session notes
│   └── nic-checklist.md          # owner checklist
└── CLAUDE.md                     # Claude Code session instructions
```

---

## Migration plan

All sessions up to and including 18.3 are complete. Full detail in `docs/plan.md` (completed sessions table) and `docs/pre-rebase-notes/` (individual session notes).

**Workflow V2 — clean-cut switchover (decided 2026-06-24, EXECUTED 2026-08-03):** All of Workflow V2 (the 3 new roles, approval removal, FCFS board, installer suggestion/assignment, external links, etc.) was built on the `feat-workflow-v2` branch across Phases 1–4 and merged to `dev` + `main` in one shot on 2026-08-03 after Nic's full regression test passed. V2 is live on production. `feat-workflow-v2` is kept for historical record only — do not push new changes to it.

- [x] **Phase 1** — roles + approval removal (smoke test passed 2026-06-24)
- [x] **Phase 2** — role-locked job form + installer suggestion/assignment (smoke test passed 2026-07-22)
- [x] **Phase 3** — FCFS board + clash-on-edit (smoke test passed 2026-07-22; Day view only — Week/Month/By-Project/By-Installer toggles deferred)
- [x] **Phase 4** — external installer links, sub-installers, task list, external POC bucket (smoke test passed 2026-07-30; live chat on the external page deferred)
- [x] **Full V2 regression test → clean-cut switchover** — regression test passed [Nic]; switchover done 2026-08-03: feat-workflow-v2 → dev → main, production verified live on V2

- [x] **Session 19** — Pre-Alpha testing (Myself) — PASSED clean 2026-08-17 [Nic]; no issues found, version stays V.0.0.0.1
- [x] **Session 20** — Pre-Alpha feedback + hotfix — skipped 2026-08-17: clean pass left nothing to fix; green light to alpha
- [x] **Sessions 21–23** — Alpha / Beta / Launch — CLOSED 2026-08-18 [Nic]: webapp declared launched **v1.0.0**, all necessary testing done; current production deployment is the launched product (no prod-tier promotion or custom domain wired — future infra tasks if ever wanted)
- [ ] **Mobile app build** — the new roadmap (replaces "Session 24 post-launch features"): Stage 1 communication core → Stage 2 installer field work + offline → Stage 3 office on the go + AI; spec at `docs/superpowers/specs/2026-08-18-mobile-app-design.md`, awaiting Nic's spec review → implementation plan → build sessions
- [ ] **Design Load — designer workflow V2.5** — BUILT + reviewed on `feat-designer-load-flow` (2026-08-26 → 28); migrations 0048/0049/0050 applied; Nic's round-2 re-test cleared 13/14. Pending: B3 Telegram-on-due-shift fix + edits 15/16 → Nic merges `feat-designer-load-flow` → `dev` → `main`. Spec `docs/superpowers/specs/2026-08-18-design-load-design.md` (+ Addendum); feedback log `2026-08-27-design-load-smoke-feedback.md`. Parked: live whiteboard in the brief card.

---

## How to work with me in this repo

When I ask you to update something:

1. Read this `CONTEXT.md` first (you are here).
2. Read the relevant feature folder's `README.md` if it exists.
3. Make the smallest possible change that satisfies the request.
4. Show me the diff. Explain what you changed and why.
5. Run typecheck/build before suggesting a commit.

**At the end of every session:** create `docs/session{N}-note.md` summarising what was built, key files, architecture decisions, and what's next. Then update the migration plan checkboxes in this file and in `docs/plan.md`.

When you're unsure between options, **ask**. Don't guess on architecture-level decisions — refer back to the "Things NOT to suggest" list and the stack table.

When something in this file is wrong or out of date, **flag it** in your response and propose an edit. This document should evolve with the project.

---

## Layman analogies

See `docs/stack-explainer.md`.
