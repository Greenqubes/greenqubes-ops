# Greenqubes — Project Context

> Read this first on every Claude Code session. Holds the key decisions and aesthetic direction so we don't relitigate them.

_Last updated: 2026-05-11 (feat-notifications — Telegram templates finalised, Obsidian sync wired, pre-alpha testing done, bugs + features logged for next session)_

---

## What this is

Internal ops platform for a small Singapore-based install/build company. Phase 0 covers:

- **Schedule management** (calendar / week / month views, clash detection, approval workflow)
- **Installer-facing dashboard** (today / up next / past jobs, retroactive photo uploads)
- **AI assistant** (chatbot with web search and conversation memory)
- **Live job chat** (text + voice notes between sales, scheduler, installer)
- **Telegram notifications** (schedule changes, overdue alerts, installer activity)

Team size: ~10 (sales + scheduler + installers). Three languages: English, Simplified Chinese, Bengali.

## Status

Migration from the original React prototype to a feature-folder Next.js app with Supabase backend is complete. App is in pre-production on Vercel preview. Next milestone: Session 19 pre-alpha testing.

---

## The stack (locked in for Phase 0)

| Layer | Service | Why this one |
|---|---|---|
| Hosting | **Vercel** | Free tier covers small teams; serverless functions for API routes; Telegram bot webhooks land here |
| Database / auth / realtime | **Supabase** | Postgres + magic-link auth + websockets + pgvector all in one. RLS enforces access control at DB layer. |
| File storage | **Cloudflare R2** | S3-compatible, **zero egress fees** — critical for installers downloading photos on mobile data |
| Image processing | **Cloudflare Images** | Auto-resize phone photos (8MB → thumbnails). $5/mo flat for 100k images. |
| AI assistant | **Anthropic Claude (Sonnet 4.6)** | Pay-per-use API. Web search tool enabled. |
| Embeddings | **Voyage AI** | Anthropic's recommended embedding partner. Pairs cleanly with Claude. Single AI ecosystem rather than mixing vendors. ~$0.05–$0.12/M tokens. |
| Notifications | **Telegram Bot API** | Team already uses Telegram. Free. |
| Knowledge base | **Obsidian vault** | Markdown ownership, no vendor lock-in. Synced to Supabase nightly. |
| Cold archive | **Local PC + external drive** (rclone) | Permanent backup mirror. ~S$150 one-time hardware cost. |

**Total monthly cost at small scale: ~$36–63 USD (~S$48–84).** Scales to ~$110–160/mo at 3× the team without changing architecture.

---

## Three roles (strict access control)

- **Sales** — creates pending jobs, sends to scheduler for approval. Sees all jobs, all clients, all costs and quotes.
- **Scheduler** — approves/rejects sales submissions. Manages company-wide schedule. Override powers (e.g. complete a job without photos).
- **Installer** — signs in via magic link, sees only jobs they're assigned. Can update completion photos, sign DOs, post chat messages and voice notes. **Cannot see commercial info** (quotes, supplier costs, margins).

Role is bound to the user's authenticated Supabase session, not a UI toggle. Row-level security policies in the DB enforce this — there is no path where the client can lie about their role and get sensitive data.

---

## Built features (in prototype, awaiting migration)

The prototype covers six rounds of "boss feedback":

1. **Three-role link system** — sales / scheduler / installer, each with role-appropriate tabs and permissions.
2. **Approval workflow** — sales draft → workload preview → scheduler approves → schedule. Either side can send back.
3. **Workload preview before push** — sales sees per-day team load before sending to scheduler. Can switch dates inline.
4. **Overdue alerts** — automatic at 2-hour checkpoints, 6 PM end-of-day, and past `timeEnd`. Bell icon + drawer.
5. **Photo-required completion** — can't mark job done without completion photos; scheduler can override.
6. **Installer features (latest round)**:
    - Live job chat thread (text + voice notes via `MediaRecorder`)
    - Installer dashboard (Today/Now + Up next + This week)
    - Past jobs view for retroactive uploads (DO, photos, comments)
    - All installer additions notify the sales POC via Telegram

Plus: i18n in EN/ZH/BN, AI smart textarea (suggest from attachments / improve text), photo galleries, expiring file links, ad-hoc client + sales addition.

---

## Design tokens (preserve these — they are the brand)

```css
--bg: #F4F1EC;        /* warm bone */
--paper: #FFFFFF;
--ink: #1A1815;       /* near-black warm */
--ink2: #5C564E;
--muted: #8B8478;
--line: #E8E2D7;
--terracotta: #B5523D;  /* primary accent */
--green: #3F7D5C;       /* installer / success */
--blue: #3D6FB5;        /* secondary / info */
--amber: #C8893D;       /* warning */
```

**Fonts:** Fraunces (display, weights 400–600, optical sizing) + IBM Plex Sans (body, 400–600). Bengali fallback: Noto Sans Bengali. Chinese fallback: Noto Sans SC.

**Aesthetic:** warm editorial. Cards with 14px radius. 1px borders in `--line`. No drop shadows except on toasts and modals. Pills, not badges. Lowercase weight-500 buttons. Generous whitespace — never cramped.

---

## Data model (high-level)

```
users          — id, name, role, telegram_chat_id, lang, phone
jobs           — id, status, date, time_start, time_end, client, location, ...
job_assignees  — job_id, user_id (M:N installers ↔ jobs)
files          — id, job_id, kind (photo|voice|do|attachment|completion), r2_key, uploader_id, ts
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
- `topic`, `entities[]`, `tags[]`, `importance` (1–5), `visibility[]`
- Generated by a classifier Claude prompt running at conversation end

Stored in `asst_chats` with embedding. Same pgvector retrieval as `kb_chunks`.

### Combined retrieval

When user asks the assistant something:
1. Embed the question
2. Query both `kb_chunks` AND `asst_chats` filtered by user permissions, top-K by similarity
3. Merge, dedupe, pass to Claude as context
4. Claude generates answer
5. Save the new conversation back through the auto-tagger

The combined index = the company's institutional brain, growing organically as conversations happen and curated by the Monday digest.

---

## Monday digest pattern

Every Monday at 9 AM SGT, a cron job runs `scripts/monday-digest.ts`:

1. Pull last week's conversations with `importance >= 4`
2. Generate one-paragraph summaries for each
3. Telegram (or email) to scheduler/owner with one-tap "promote to Obsidian" links
4. On promote → write a new note to the Obsidian vault with the summary + source link, default `visibility: [public-internal]`, queue for human review of visibility before next sync

The loop: organic conversations → flagged on Monday → human approves → curated Obsidian note → syncs back into the searchable index → answers smarter next time.

This is the system's main learning mechanism. **Auto-promotion is forbidden** — the human-in-the-loop is the safety mechanism against the AI mis-classifying something as broadly shareable.

---

## Things NOT to suggest (don't relitigate)

- **Don't suggest Firebase.** We picked Supabase for SQL + RLS + pgvector in one place.
- **Don't suggest AWS S3.** R2's free egress is the whole point for mobile-heavy installer use.
- **Don't suggest replacing Telegram with email/SMS.** Team already uses Telegram.
- **Don't suggest swapping Voyage AI for OpenAI embeddings.** We picked Voyage to stay in the Anthropic-aligned ecosystem and avoid mixing AI vendors. Cost is a wash.
- **Don't suggest a separate vector DB** (Pinecone, Weaviate). pgvector in Supabase shares auth with the main DB — one less access-control layer to maintain.
- **Don't suggest abandoning Obsidian for a CMS.** Markdown ownership and offline-first matter.
- **Don't add a fourth role.** Sales / scheduler / installer is the model.
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

- [ ] **Session 19** — Pre-Alpha testing (Myself); versioning starts V.0.0.0.1
- [ ] **Session 20** — Pre-Alpha feedback + hotfix; iterate V.0.0.0.X until green light
- [ ] **Session 21** — Alpha testing (Me + Scheduler); iterate V.0.0.X.0 until green light
- [ ] **Session 22** — Beta testing (Me + Scheduler + Sales); iterate V.0.X.0.0 until green light
- [ ] **Session 23** — Launch; production cutover → V.1.0.0.0
- [ ] **Session 24** — Post-launch features (to be defined)

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
