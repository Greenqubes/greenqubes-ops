# Assistant Upgrade Phase 4 — Projects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Per-user Projects in the assistant — collapsible folders in the sidebar/drawer that group chats, with shared instructions + reference files (images/PDF) injected into every chat in the project, and project-scoped memory recall — the last phase of the assistant upgrade.

**Architecture:** Migration 0047 adds `asst_projects`, `asst_chats.project_id` (ON DELETE SET NULL — deleting a project releases chats, never deletes them) and `asst_project_files`, all owner-only RLS. Project files live in R2 under `asst-projects/{userId}/{projectId}/…` (never `files` rows; the 30-day scratch cron only sweeps `asst-chat/`, so project files are permanent). Caps: **10 files / 20 MB total per project** (Nic 2026-08-26 — count raised from 5; the byte total is bounded by the API's 32 MB per-request ceiling, since project files ride on every message as base64 at ~4/3 inflation). A request-file budget guard degrades message attachments to text notes before a full project + full message could ever exceed that ceiling. Also in this phase (Nic 2026-08-26): the Admin → Health API usage tracker gains a 30 days / 7 days / Today window filter (Task 12). The chat route injects the project as a **cached prefix**: instructions as a second cached system block, files as blocks at the front of the first user message with a cache breakpoint — and for project chats the volatile context (date/user/past-chat recall) moves out of `system` into the last user message, because a changing system block before the messages would invalidate the message-level breakpoint every turn. `match_asst_chats` gains an optional `project_filter` param so sibling chats recall each other first.

**Tech Stack:** Next.js 15 App Router, Supabase (RLS = the enforcement mechanism), Cloudflare R2 (`@aws-sdk/client-s3`), `@anthropic-ai/sdk` ^0.120 (`claude-sonnet-5`, prompt caching), Tailwind + design tokens, standalone `tsx` test suites.

**Spec:** `docs/superpowers/specs/2026-08-24-assistant-upgrade-design.md` — section "Phase 4 — Projects". Read it before executing.

## Global Constraints

- **Migration 0047 must be applied by Nic (`npx supabase db push`) BEFORE any code that selects the new columns is pushed to `origin/dev`** — Vercel auto-deploys previews against the shared DB (42703 crash otherwise). Commit locally; do not push until the gate in Task 1 is confirmed.
- **Never push to origin without asking Nic first** (standing rule) — commits are fine, pushes are gated.
- Privacy hard rule: projects, files, instructions and memory are strictly per-user; every read/write runs on the **user-scoped client** (`createClient` from `@/lib/supabase/server`) so RLS filters it. The service client is not used anywhere in this phase.
- The frozen `SYSTEM_PREFIX` in `chat/route.ts` must stay **byte-identical** — do not touch it. All new cached blocks must be deterministic for a given project state.
- Overlays layer `z-[60]`+ above BottomNav (hard rule); the phone drawer is `z-[60]`, panels above it use `z-[70]` (MemoryView pattern).
- i18n: new strings in `en.ts` + `zh.ts` only (Bengali frozen). No duplicate keys — `en.ts` type-checks against duplicates (Phase 3 lesson).
- No emoji in UI — stroke lucide icons only.
- Dates in UI: static English tables only, no locale calls (hydration lesson).
- TypeScript strict — no `any`; `chat.msgs` (Json) needs `as unknown as T[]`.
- DB queries live in `src/lib/supabase/queries/<feature>.ts`, never inline in components.
- Attachment formats: images jpg/png/webp/gif + PDF only (the formats the model reads); reuse `validateAttachment` — HEIC/Office rejected.
- Out of scope: floating bubble untouched (no projects there — it always saves project-less chats); no new tools; team-shared memory stays off.

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `supabase/migrations/0047_asst_projects.sql` | Create | Tables + RLS + `project_id` column + `match_asst_chats` v3 |
| `src/lib/supabase/types.ts` | Modify | New table types, `project_id`, RPC args |
| `src/lib/ai/attachments.ts` (+`.test.ts`) | Modify | Project file caps + `isOwnProjectKey` + `validateProjectFile` |
| `src/lib/ai/project-context.ts` (+`.test.ts`) | Create | Pure builders for the cached project prompt blocks |
| `src/lib/storage/r2.ts` | Modify | `getProjectUploadUrl` |
| `src/lib/supabase/queries/assistant-projects.ts` | Create | All project DB access (RLS client) |
| `src/lib/supabase/queries/assistant.ts` | Modify | `AsstChatRow.project_id`, save/update carry `projectId` |
| `src/app/api/assistant/projects/route.ts` | Create | GET list / POST create / PATCH edit / DELETE (R2 cleanup) |
| `src/app/api/assistant/projects/upload-url/route.ts` | Create | Signed PUT for a project file |
| `src/app/api/assistant/projects/files/route.ts` | Create | POST register / DELETE remove a project file |
| `src/app/api/assistant/move/route.ts` | Create | PATCH — move a chat into/out of a project |
| `src/app/api/assistant/save/route.ts` | Modify | `projectId` rides through to save/update |
| `src/app/api/assistant/chat/route.ts` | Modify | Project context in the cached prefix; volatile relocation |
| `src/lib/ai/retrieve.ts` | Modify | Project-scoped recall first, general beneath |
| `src/features/assistant/ProjectsSection.tsx` | Create | Sidebar folders: create/expand/menu/nested chats |
| `src/features/assistant/ProjectPanel.tsx` | Create | z-[70] settings panel: name, instructions, files |
| `src/features/assistant/HistorySidebar.tsx` | Modify | Render ProjectsSection, filter project chats, move modal |
| `src/features/assistant/HistoryList.tsx` | Modify | Export `ChatRow`; "Move to project…" menu item |
| `src/features/assistant/AssistantShell.tsx` | Modify | Projects state, active project, chip, send/save wiring |
| `src/lib/i18n/en.ts`, `src/lib/i18n/zh.ts` | Modify | New strings (folded into UI tasks) |
| `src/lib/supabase/queries/admin.ts` | Modify | `getUsageSummary` takes a `since` ISO instead of days |
| `src/app/api/admin/health/route.ts` | Modify | `?window=30d\|7d\|today` param |
| `src/features/admin/HealthTab.tsx` | Modify | Usage window chips + dynamic labels |

---

### Task 1: Migration 0047 + DB types + db-push gate

**Files:**
- Create: `supabase/migrations/0047_asst_projects.sql`
- Modify: `src/lib/supabase/types.ts` (asst_chats block at ~line 159; Functions block at ~line 450)

**Interfaces:**
- Produces: tables `asst_projects` (id, user_id, name, instructions, created_at, updated_at), `asst_project_files` (id, project_id, name, r2_key, mime, size, created_at), column `asst_chats.project_id uuid NULL`, and `match_asst_chats(query_embedding, match_threshold, match_count, project_filter uuid DEFAULT NULL)` — same return columns as 0046. Later tasks' queries and RPC calls depend on these exact names.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0047_asst_projects.sql` (RLS style follows 0002/0016 — `get_my_id()` helper; function drop/recreate follows 0046):

```sql
-- 0047: assistant projects (assistant upgrade Phase 4)
-- Apply BEFORE deploying code that selects asst_chats.project_id
-- (standing lesson: db push before code push).

create table asst_projects (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references users(id) on delete cascade,
  name         text        not null,
  instructions text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table asst_projects enable row level security;

create policy "asst_projects: own select" on asst_projects
  for select to authenticated using (user_id = get_my_id());
create policy "asst_projects: own insert" on asst_projects
  for insert to authenticated with check (user_id = get_my_id());
create policy "asst_projects: own update" on asst_projects
  for update to authenticated using (user_id = get_my_id());
create policy "asst_projects: own delete" on asst_projects
  for delete to authenticated using (user_id = get_my_id());

-- Deleting a project releases its chats back to the general history list —
-- it never deletes conversations (spec).
alter table asst_chats
  add column if not exists project_id uuid references asst_projects(id) on delete set null;

create index asst_chats_project_idx on asst_chats(project_id)
  where project_id is not null;

-- Project reference files: R2 objects under asst-projects/{userId}/{projectId}/
-- tracked here — never `files` rows (they belong to no job).
create table asst_project_files (
  id         uuid        primary key default gen_random_uuid(),
  project_id uuid        not null references asst_projects(id) on delete cascade,
  name       text        not null,
  r2_key     text        not null,
  mime       text        not null,
  size       bigint      not null,
  created_at timestamptz not null default now()
);

create index asst_project_files_project_idx on asst_project_files(project_id);

alter table asst_project_files enable row level security;

create policy "asst_project_files: own via project" on asst_project_files
  for all to authenticated
  using (exists (
    select 1 from asst_projects p
    where p.id = project_id and p.user_id = get_my_id()
  ))
  with check (exists (
    select 1 from asst_projects p
    where p.id = project_id and p.user_id = get_my_id()
  ));

-- match_asst_chats gains an optional project filter (linked memory: sibling
-- chats in a project recall each other first). The parameter list changes, so
-- the old function must be dropped first (0046 lesson: CREATE OR REPLACE
-- cannot change a signature). Callers pass named args, so the deployed code
-- (which omits project_filter) keeps working — deploy-order safe.
drop function if exists match_asst_chats(extensions.vector, float, int);

CREATE FUNCTION match_asst_chats(
  query_embedding extensions.vector(1024),
  match_threshold float DEFAULT 0.5,
  match_count      int   DEFAULT 3,
  project_filter   uuid  DEFAULT NULL
)
RETURNS TABLE (
  id         text,
  topic      text,
  summary    text,
  msgs       jsonb,
  tags       text[],
  importance int,
  similarity float
)
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = public, extensions
AS $$
  SELECT
    id::text,
    topic,
    summary,
    msgs::jsonb,
    tags,
    importance::int,
    1 - (embedding <=> query_embedding) AS similarity
  FROM asst_chats
  WHERE embedding IS NOT NULL
    AND (project_filter IS NULL OR project_id = project_filter)
    AND 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;
```

- [ ] **Step 2: Update `src/lib/supabase/types.ts`**

In the `asst_chats` block, add to `Row`: `project_id: string | null` and to `Insert`/`Update`: `project_id?: string | null` (keep field alignment style).

After the `asst_chats` table block, add two new table blocks (same indentation as neighbours):

```ts
      asst_projects: {
        Row: {
          id:           string
          user_id:      string
          name:         string
          instructions: string | null
          created_at:   string
          updated_at:   string
        }
        Insert: {
          id?:           string
          user_id:       string
          name:          string
          instructions?: string | null
          created_at?:   string
          updated_at?:   string
        }
        Update: {
          id?:           string
          user_id?:      string
          name?:         string
          instructions?: string | null
          created_at?:   string
          updated_at?:   string
        }
        Relationships: []
      }

      asst_project_files: {
        Row: {
          id:         string
          project_id: string
          name:       string
          r2_key:     string
          mime:       string
          size:       number
          created_at: string
        }
        Insert: {
          id?:         string
          project_id:  string
          name:        string
          r2_key:      string
          mime:        string
          size:        number
          created_at?: string
        }
        Update: {
          id?:         string
          project_id?: string
          name?:       string
          r2_key?:     string
          mime?:       string
          size?:       number
          created_at?: string
        }
        Relationships: []
      }
```

In `Functions.match_asst_chats.Args` add `project_filter?: string | null`.

- [ ] **Step 3: Type-check**

Run: `npm run type-check`
Expected: PASS (no code selects the new columns yet).

- [ ] **Step 4: Commit (local only)**

```bash
git add supabase/migrations/0047_asst_projects.sql src/lib/supabase/types.ts
git commit -m "feat: migration 0047 — asst_projects + project_id + project files + scoped match_asst_chats"
```

- [ ] **Step 5: 🛑 GATE — Nic runs the migration NOW**

Tell Nic (plain language): "Migration 0047 is ready. Please run `npx supabase db push` in this folder now — it creates the project tables. Nothing deploys until you confirm it succeeded." **Do not push any commit to `origin/dev` until Nic confirms.** Execution of the remaining tasks may continue locally while waiting, but the gate must be confirmed before the final push in Task 13.

---

### Task 2: Project file rules (pure module, TDD)

**Files:**
- Modify: `src/lib/ai/attachments.ts`
- Test: `src/lib/ai/attachments.test.ts`

**Interfaces:**
- Consumes: existing `validateAttachment(name, mime, size): 'type' | 'size' | null`.
- Produces: `MAX_PROJECT_FILES = 10`, `MAX_PROJECT_BYTES = 20 MB`, `REQUEST_FILE_BUDGET = 22 MB`, `isOwnProjectKey(key: string, userId: string, projectId: string): boolean`, `validateProjectFile(name: string, mime: string, size: number, existingCount: number, existingBytes: number): 'count' | 'type' | 'size' | 'total' | null`. Tasks 6 (routes) and 10 (panel) call the validators; Task 8 (chat route) uses `REQUEST_FILE_BUDGET`.

- [ ] **Step 1: Write the failing tests** — append to `src/lib/ai/attachments.test.ts` (before the final failure-count exit), and extend the import:

```ts
import {
  MAX_FILES_PER_MESSAGE, MAX_IMAGE_BYTES, MAX_PDF_BYTES, MAX_MESSAGE_BYTES,
  MAX_PROJECT_FILES, MAX_PROJECT_BYTES, REQUEST_FILE_BUDGET,
  validateAttachment, isOwnScratchKey, attachmentNote,
  isOwnProjectKey, validateProjectFile,
} from './attachments'
```

```ts
// 6. Project file rules (Phase 4) — count is cheap, bytes are the physics:
// files ride on every message, so the total is bounded by the API request cap
check('10 files per project', MAX_PROJECT_FILES, 10)
check('20 MB per project', MAX_PROJECT_BYTES, 20 * 1024 * 1024)
check('22 MB request budget', REQUEST_FILE_BUDGET, 22 * 1024 * 1024)

// 7. Project-key ownership guard
check('own project key ok',       isOwnProjectKey('asst-projects/u1/p1/a.pdf', 'u1', 'p1'), true)
check('other user key rejected',  isOwnProjectKey('asst-projects/u2/p1/a.pdf', 'u1', 'p1'), false)
check('other project rejected',   isOwnProjectKey('asst-projects/u1/p2/a.pdf', 'u1', 'p1'), false)
check('scratch key not a project key', isOwnProjectKey('asst-chat/u1/a.pdf', 'u1', 'p1'), false)
check('dotdot rejected',          isOwnProjectKey('asst-projects/u1/p1/../../x', 'u1', 'p1'), false)

// 8. Project file validation (count → per-file type/size → running total)
check('project file ok',        validateProjectFile('a.pdf', 'application/pdf', 1000, 0, 0), null)
check('project count cap',      validateProjectFile('a.pdf', 'application/pdf', 1000, 10, 0), 'count')
check('9 existing still ok',    validateProjectFile('a.pdf', 'application/pdf', 1000, 9, 0), null)
check('project type rejected',  validateProjectFile('a.docx', 'application/msword', 1000, 0, 0), 'type')
check('project per-file size',  validateProjectFile('a.jpg', 'image/jpeg', 6 * 1024 * 1024, 0, 0), 'size')
check('project total cap',      validateProjectFile('a.pdf', 'application/pdf', 6 * 1024 * 1024, 1, 15 * 1024 * 1024), 'total')
check('project total at cap ok', validateProjectFile('a.pdf', 'application/pdf', 5 * 1024 * 1024, 1, 15 * 1024 * 1024), null)
```

- [ ] **Step 2: Run to verify failure**

Run: `npx tsx src/lib/ai/attachments.test.ts`
Expected: FAIL — `isOwnProjectKey` not exported (tsx errors on the import).

- [ ] **Step 3: Implement** — append to `src/lib/ai/attachments.ts`:

```ts
// ── Project files (Phase 4) ─────────────────────────────────────────────────
// Count is cheap; bytes are the physics. Project files ride on EVERY message
// in the project as base64 (~4/3 inflation) under the API's 32 MB request
// cap, so the per-project byte total mirrors the per-message total. The
// request budget below is the raw-bytes ceiling for ONE request (project
// files + all message attachments combined) with headroom for text, history
// and tool definitions — the chat route degrades attachments past it to text
// notes instead of letting the API reject the request.

export const MAX_PROJECT_FILES  = 10
export const MAX_PROJECT_BYTES  = 20 * 1024 * 1024
export const REQUEST_FILE_BUDGET = 22 * 1024 * 1024

/** A request may only reference the caller's own project objects. */
export function isOwnProjectKey(key: string, userId: string, projectId: string): boolean {
  return key.startsWith(`asst-projects/${userId}/${projectId}/`) && !key.includes('..')
}

/** null = accepted; 'count' = project already holds MAX_PROJECT_FILES;
 *  'type'/'size' = per-file rule (validateAttachment); 'total' = would push
 *  the project past MAX_PROJECT_BYTES. */
export function validateProjectFile(
  name: string, mime: string, size: number,
  existingCount: number, existingBytes: number,
): 'count' | 'type' | 'size' | 'total' | null {
  if (existingCount >= MAX_PROJECT_FILES) return 'count'
  const perFile = validateAttachment(name, mime, size)
  if (perFile) return perFile
  if (existingBytes + size > MAX_PROJECT_BYTES) return 'total'
  return null
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx tsx src/lib/ai/attachments.test.ts`
Expected: PASS, exit 0, all checks ✓ (old + new).

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/attachments.ts src/lib/ai/attachments.test.ts
git commit -m "feat: project-file caps + ownership guard (assistant Phase 4)"
```

---

### Task 3: Project prompt-context builders (pure module, TDD)

**Files:**
- Create: `src/lib/ai/project-context.ts`
- Test: `src/lib/ai/project-context.test.ts`

**Interfaces:**
- Produces: `projectSystemBlock(name: string, instructions: string | null): string` and `projectFilesLeadText(files: readonly { name: string; mime: string }[]): string` — Task 8 (chat route) builds cached blocks from these. Both must be deterministic (they sit inside the prompt-cache prefix).

- [ ] **Step 1: Write the failing test** — create `src/lib/ai/project-context.test.ts`:

```ts
/**
 * Standalone test for the project prompt-context builders.
 * Run: npx tsx src/lib/ai/project-context.test.ts
 * Exits 1 on any failure.
 */

import { projectSystemBlock, projectFilesLeadText } from './project-context'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) { console.log(`  ✓ ${name}`) }
  else { console.error(`  ✗ ${name}\n      expected: ${JSON.stringify(expected)}\n      actual:   ${JSON.stringify(actual)}`); failures++ }
}

// 1. System block always names the project
check('names the project',
  projectSystemBlock('Changi Site', null).includes('"Changi Site"'), true)
check('no instructions → single paragraph',
  projectSystemBlock('Changi Site', null).includes('Project instructions'), false)
check('blank instructions treated as none',
  projectSystemBlock('Changi Site', '   ').includes('Project instructions'), false)

// 2. Instructions included verbatim (trimmed)
const withIns = projectSystemBlock('Changi Site', '  Always answer in bullet points.  ')
check('instructions header present', withIns.includes('Project instructions from the user'), true)
check('instructions text verbatim', withIns.includes('Always answer in bullet points.'), true)
check('instructions trimmed', withIns.includes('  Always answer'), false)

// 3. Determinism — same input, byte-identical output (prompt-cache prefix)
check('deterministic', projectSystemBlock('A', 'B') === projectSystemBlock('A', 'B'), true)

// 4. Files lead text
check('no files → empty string', projectFilesLeadText([]), '')
const lead = projectFilesLeadText([
  { name: 'permit.pdf', mime: 'application/pdf' },
  { name: 'site.jpg',   mime: 'image/jpeg' },
])
check('lists names in order', lead.indexOf('permit.pdf') < lead.indexOf('site.jpg'), true)
check('pdf labelled', lead.includes('(pdf)'), true)
check('image labelled', lead.includes('(image)'), true)

process.exit(failures > 0 ? 1 : 0)
```

- [ ] **Step 2: Run to verify failure**

Run: `npx tsx src/lib/ai/project-context.test.ts`
Expected: FAIL — module `./project-context` not found.

- [ ] **Step 3: Implement** — create `src/lib/ai/project-context.ts`:

```ts
// Pure module — builds the stable project-context strings for the chat route
// (assistant upgrade Phase 4). No Supabase/Next imports so the standalone test
// runs under plain tsx. These strings sit inside the prompt-cache prefix: they
// must be DETERMINISTIC for a given project state (same input → byte-identical
// output), so repeat turns inside a project hit the cache.

export interface ProjectFileMeta { name: string; mime: string }

/** Second (cached) system block for a chat inside a project. */
export function projectSystemBlock(name: string, instructions: string | null): string {
  const parts = [
    `This conversation is inside the user's project "${name}". Chats in a project share the project's instructions and reference files below — treat them as standing context for every answer in this conversation.`,
  ]
  const trimmed = instructions?.trim()
  if (trimmed) {
    parts.push(`Project instructions from the user — follow them in every answer:\n${trimmed}`)
  }
  return parts.join('\n\n')
}

/** Leading text for the project-files blocks at the front of the first user
 *  message. Empty string when the project has no files. */
export function projectFilesLeadText(files: readonly ProjectFileMeta[]): string {
  if (files.length === 0) return ''
  const items = files.map((f, i) =>
    `${i + 1}. "${f.name}" (${f.mime === 'application/pdf' ? 'pdf' : 'image'})`)
  return `Project reference files, shared with every chat in this project:\n${items.join('\n')}`
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx tsx src/lib/ai/project-context.test.ts`
Expected: PASS, exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/project-context.ts src/lib/ai/project-context.test.ts
git commit -m "feat: pure project prompt-context builders (assistant Phase 4)"
```

---

### Task 4: R2 helper + project queries + chat-row plumbing

**Files:**
- Modify: `src/lib/storage/r2.ts` (after the scratch-file section, ~line 154)
- Create: `src/lib/supabase/queries/assistant-projects.ts`
- Modify: `src/lib/supabase/queries/assistant.ts`

**Interfaces:**
- Consumes: Task 1 tables/types.
- Produces (Tasks 5–11 depend on these exact signatures):
  - r2: `getProjectUploadUrl(userId: string, projectId: string, filename: string, contentType: string): Promise<{ url: string; key: string }>`
  - queries: `ProjectRow { id; name; instructions: string | null; created_at }`, `ProjectFileRow { id; project_id; name; r2_key; mime; size: number; created_at }`, `ProjectWithFiles = ProjectRow & { files: ProjectFileRow[] }`, `listProjects(): Promise<ProjectRow[]>`, `listProjectFiles(projectIds: string[]): Promise<ProjectFileRow[]>`, `getOwnProject(id): Promise<ProjectRow | null>`, `createProject(userId, name): Promise<ProjectRow | null>`, `updateProject(id, fields: { name?: string; instructions?: string | null }): Promise<boolean>`, `deleteProject(id): Promise<boolean>`, `addProjectFile(row: { project_id; name; r2_key; mime; size }): Promise<ProjectFileRow | null>`, `getProjectFileRow(id): Promise<ProjectFileRow | null>`, `deleteProjectFileRow(id): Promise<boolean>`, `moveChatToProject(chatId, projectId: string | null): Promise<boolean>`
  - assistant.ts: `AsstChatRow` gains `project_id: string | null`; `saveChat(userId, msgs, tag, projectId?: string | null)`; `updateChat(id, userId, msgs, tag, projectId?: string | null)` — `undefined` leaves `project_id` untouched (floating panel never sends it), `null` clears it.

- [ ] **Step 1: r2.ts** — append after the scratch-file section:

```ts
// ── Assistant project files (Phase 4) ───────────────────────────────────────
// Project objects live under asst-projects/{userId}/{projectId}/ — tracked in
// asst_project_files rows, never `files` rows. The 30-day scratch-cleanup cron
// only sweeps asst-chat/, so project files are permanent until removed.

export async function getProjectUploadUrl(
  userId: string,
  projectId: string,
  filename: string,
  contentType: string,
): Promise<{ url: string; key: string }> {
  const ext = filename.includes('.') ? filename.split('.').pop() : undefined
  const key = `asst-projects/${userId}/${projectId}/${randomUUID()}${ext ? `.${ext}` : ''}`
  const url = await getSignedUrl(
    r2,
    new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType }),
    { expiresIn: 300 },
  )
  void logApiUsage({ service: 'r2', endpoint: 'put', estimated_cost: 0 })
  return { url, key }
}
```

- [ ] **Step 2: Create `src/lib/supabase/queries/assistant-projects.ts`**

Everything on the user-scoped client — RLS is the ownership check (owner-only policies from 0047), so a non-owner id simply reads/updates/deletes 0 rows.

```ts
import { createClient } from '@/lib/supabase/server'

// All project access runs on the user-scoped client: the owner-only RLS
// policies (migration 0047) are the enforcement — a foreign id reads or
// touches zero rows, which callers surface as not-found.

export interface ProjectRow {
  id:           string
  name:         string
  instructions: string | null
  created_at:   string
}

export interface ProjectFileRow {
  id:         string
  project_id: string
  name:       string
  r2_key:     string
  mime:       string
  size:       number
  created_at: string
}

export type ProjectWithFiles = ProjectRow & { files: ProjectFileRow[] }

export async function listProjects(): Promise<ProjectRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('asst_projects')
    .select('id, name, instructions, created_at')
    .order('created_at', { ascending: false })
  return (data ?? []) as ProjectRow[]
}

export async function listProjectFiles(projectIds: string[]): Promise<ProjectFileRow[]> {
  if (projectIds.length === 0) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from('asst_project_files')
    .select('id, project_id, name, r2_key, mime, size, created_at')
    .in('project_id', projectIds)
    .order('created_at', { ascending: true })
  return (data ?? []) as ProjectFileRow[]
}

export async function getOwnProject(id: string): Promise<ProjectRow | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('asst_projects')
    .select('id, name, instructions, created_at')
    .eq('id', id)
    .maybeSingle()
  return (data as ProjectRow | null) ?? null
}

export async function createProject(userId: string, name: string): Promise<ProjectRow | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('asst_projects')
    .insert({ user_id: userId, name } as never)
    .select('id, name, instructions, created_at')
    .single()
  if (error) { console.error('[createProject] error', error); return null }
  return data as ProjectRow
}

export async function updateProject(
  id: string,
  fields: { name?: string; instructions?: string | null },
): Promise<boolean> {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from('asst_projects')
    .update({ ...fields, updated_at: new Date().toISOString() } as never, { count: 'exact' })
    .eq('id', id)
  return !error && (count ?? 0) > 0
}

export async function deleteProject(id: string): Promise<boolean> {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from('asst_projects')
    .delete({ count: 'exact' })
    .eq('id', id)
  if (error) console.error('[deleteProject] error', error)
  return !error && (count ?? 0) > 0
}

export async function addProjectFile(
  row: { project_id: string; name: string; r2_key: string; mime: string; size: number },
): Promise<ProjectFileRow | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('asst_project_files')
    .insert(row as never)
    .select('id, project_id, name, r2_key, mime, size, created_at')
    .single()
  if (error) { console.error('[addProjectFile] error', error); return null }
  return data as ProjectFileRow
}

export async function getProjectFileRow(id: string): Promise<ProjectFileRow | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('asst_project_files')
    .select('id, project_id, name, r2_key, mime, size, created_at')
    .eq('id', id)
    .maybeSingle()
  return (data as ProjectFileRow | null) ?? null
}

export async function deleteProjectFileRow(id: string): Promise<boolean> {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from('asst_project_files')
    .delete({ count: 'exact' })
    .eq('id', id)
  return !error && (count ?? 0) > 0
}

export async function moveChatToProject(chatId: string, projectId: string | null): Promise<boolean> {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from('asst_chats')
    .update({ project_id: projectId } as never, { count: 'exact' })
    .eq('id', chatId)
  return !error && (count ?? 0) > 0
}
```

- [ ] **Step 3: Modify `src/lib/supabase/queries/assistant.ts`**

1. `AsstChatRow` gains `project_id: string | null` (after `pinned`).
2. `getRecentChats` select becomes `'id, topic, msgs, tags, importance, pinned, project_id, ts'`.
3. `saveChat` signature gains a 4th param `projectId?: string | null`; the insert object gains `project_id: projectId ?? null`.
4. `updateChat` signature gains a 5th param `projectId?: string | null`; the update object gains `...(projectId !== undefined ? { project_id: projectId } : {})` — `undefined` means "leave as-is" (the floating panel never sends it), `null` explicitly clears.

- [ ] **Step 4: Type-check**

Run: `npm run type-check`
Expected: PASS. (Existing callers of saveChat/updateChat pass 3–4 args — the new params are optional. `AsstChatRow` literals in `AssistantShell.tsx` will fail here — if they do, note it and fix them in Task 9; to keep this task green you may add `project_id: null` to the two optimistic literals in `AssistantShell.tsx` now.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage/r2.ts src/lib/supabase/queries/assistant-projects.ts src/lib/supabase/queries/assistant.ts src/features/assistant/AssistantShell.tsx
git commit -m "feat: project R2 helper + queries module + chat-row project_id"
```

---

### Task 5: Projects CRUD API route

**Files:**
- Create: `src/app/api/assistant/projects/route.ts`

**Interfaces:**
- Consumes: Task 4 queries, `deleteObject` from `@/lib/storage/r2`.
- Produces: `GET /api/assistant/projects` → `ProjectWithFiles[]`; `POST {name}` → project row (201); `PATCH {id, name?, instructions?}` → `{ok:true}`; `DELETE {id}` → `{ok:true}` (R2 objects deleted first — the fix-files lesson). The UI (Tasks 9–10) calls these.

- [ ] **Step 1: Implement** — create `src/app/api/assistant/projects/route.ts`:

```ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  listProjects, listProjectFiles, createProject, updateProject, deleteProject,
} from '@/lib/supabase/queries/assistant-projects'
import { deleteObject } from '@/lib/storage/r2'

// Assistant Projects (Phase 4). Every statement runs on the RLS client —
// owner-only policies (0047) are the enforcement, so a foreign id is a 404.

const MAX_NAME_LEN = 60

async function requireProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .maybeSingle() as { data: { id: string } | null; error: unknown }
  return profile
}

export async function GET() {
  const profile = await requireProfile()
  if (!profile) return new Response('Unauthorized', { status: 401 })

  const projects = await listProjects()
  const files    = await listProjectFiles(projects.map(p => p.id))
  return Response.json(projects.map(p => ({
    ...p,
    files: files.filter(f => f.project_id === p.id),
  })))
}

export async function POST(req: NextRequest) {
  const profile = await requireProfile()
  if (!profile) return new Response('Unauthorized', { status: 401 })

  let body: { name?: string }
  try { body = await req.json() } catch { return new Response('Bad request', { status: 400 }) }
  const name = body.name?.trim()
  if (!name || name.length > MAX_NAME_LEN) return new Response('Bad request', { status: 400 })

  const project = await createProject(profile.id, name)
  if (!project) return new Response('Create failed', { status: 500 })
  return Response.json(project, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const profile = await requireProfile()
  if (!profile) return new Response('Unauthorized', { status: 401 })

  let body: { id?: string; name?: string; instructions?: string | null }
  try { body = await req.json() } catch { return new Response('Bad request', { status: 400 }) }
  if (!body.id) return new Response('Bad request', { status: 400 })

  const fields: { name?: string; instructions?: string | null } = {}
  if (body.name !== undefined) {
    const name = body.name.trim()
    if (!name || name.length > MAX_NAME_LEN) return new Response('Bad request', { status: 400 })
    fields.name = name
  }
  if (body.instructions !== undefined) {
    fields.instructions = body.instructions?.trim() || null
  }
  if (Object.keys(fields).length === 0) return new Response('Bad request', { status: 400 })

  const ok = await updateProject(body.id, fields)
  if (!ok) return new Response('Not found', { status: 404 })
  return Response.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const profile = await requireProfile()
  if (!profile) return new Response('Unauthorized', { status: 401 })

  let body: { id?: string }
  try { body = await req.json() } catch { return new Response('Bad request', { status: 400 }) }
  if (!body.id) return new Response('Bad request', { status: 400 })

  // R2 objects first, then the row (delete-fix lesson, 2026-08-19). The RLS
  // read returns rows only for the owner, so a foreign id deletes nothing.
  // Chats are released by the ON DELETE SET NULL FK — never deleted.
  const files = await listProjectFiles([body.id])
  for (const f of files) {
    try { await deleteObject(f.r2_key) } catch { /* idempotent; row cascade still applies */ }
  }
  const ok = await deleteProject(body.id)
  if (!ok) return new Response('Not found', { status: 404 })
  return Response.json({ ok: true })
}
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/assistant/projects/route.ts
git commit -m "feat: assistant projects CRUD route"
```

---

### Task 6: Project file API routes

**Files:**
- Create: `src/app/api/assistant/projects/upload-url/route.ts`
- Create: `src/app/api/assistant/projects/files/route.ts`

**Interfaces:**
- Consumes: Task 2 (`validateAttachment`, `validateProjectFile`, `isOwnProjectKey`), Task 4 (`getProjectUploadUrl`, queries).
- Produces: `POST /api/assistant/projects/upload-url {projectId, filename, contentType, size}` → `{url, key}`; `POST /api/assistant/projects/files {projectId, key, name, mime, size}` → `ProjectFileRow`; `DELETE /api/assistant/projects/files {id}` → `{ok:true}`. Error bodies carry `{ error: 'count' | 'type' | 'size' | 'total' }` codes the panel maps to i18n strings. Task 10 calls these.

- [ ] **Step 1: Create `src/app/api/assistant/projects/upload-url/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getProjectUploadUrl } from '@/lib/storage/r2'
import { validateProjectFile } from '@/lib/ai/attachments'
import { getOwnProject, listProjectFiles } from '@/lib/supabase/queries/assistant-projects'

// Signed PUT URL for a project reference file (Phase 4). Objects land under
// asst-projects/{userId}/{projectId}/ — never job folders, never `files` rows,
// and outside the scratch-cleanup cron's asst-chat/ sweep.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .maybeSingle() as { data: { id: string } | null; error: unknown }
  if (!profile) return NextResponse.json({ error: 'Not provisioned' }, { status: 403 })

  const body = await req.json() as {
    projectId?: string; filename?: string; contentType?: string; size?: number
  }
  const { projectId, filename, contentType, size } = body
  if (!projectId || !filename || !contentType || typeof size !== 'number') {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  // RLS: only the owner sees the project
  const project = await getOwnProject(projectId)
  if (!project) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const existing = await listProjectFiles([projectId])
  const problem  = validateProjectFile(
    filename, contentType, size,
    existing.length,
    existing.reduce((s, f) => s + f.size, 0),
  )
  if (problem) return NextResponse.json({ error: problem }, { status: 400 })

  const { url, key } = await getProjectUploadUrl(profile.id, projectId, filename, contentType)
  return NextResponse.json({ url, key })
}
```

- [ ] **Step 2: Create `src/app/api/assistant/projects/files/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { deleteObject } from '@/lib/storage/r2'
import { validateProjectFile, isOwnProjectKey } from '@/lib/ai/attachments'
import {
  getOwnProject, listProjectFiles, addProjectFile,
  getProjectFileRow, deleteProjectFileRow,
} from '@/lib/supabase/queries/assistant-projects'

async function requireProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .maybeSingle() as { data: { id: string } | null; error: unknown }
  return profile
}

// Register an uploaded project file. The key must sit in the caller's own
// prefix for this project — a forged key is rejected, so a row can never
// point at another user's object (or a job folder).
export async function POST(req: NextRequest) {
  const profile = await requireProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    projectId?: string; key?: string; name?: string; mime?: string; size?: number
  }
  const { projectId, key, name, mime, size } = body
  if (!projectId || !key || !name || !mime || typeof size !== 'number') {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  const project = await getOwnProject(projectId)
  if (!project) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (!isOwnProjectKey(key, profile.id, projectId)) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  // Caps re-checked at register time (upload-url checked too, but two uploads
  // could race past a single check).
  const existing = await listProjectFiles([projectId])
  const problem  = validateProjectFile(
    name, mime, size,
    existing.length,
    existing.reduce((s, f) => s + f.size, 0),
  )
  if (problem) return NextResponse.json({ error: problem }, { status: 400 })

  const row = await addProjectFile({ project_id: projectId, name, r2_key: key, mime, size })
  if (!row) return NextResponse.json({ error: 'insert_failed' }, { status: 500 })
  return NextResponse.json(row, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const profile = await requireProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as { id?: string }
  if (!body.id) return NextResponse.json({ error: 'bad_request' }, { status: 400 })

  // RLS read: null for anyone but the owner. R2 object first, then the row.
  const row = await getProjectFileRow(body.id)
  if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  await deleteObject(row.r2_key)
  const ok = await deleteProjectFileRow(body.id)
  if (!ok) return NextResponse.json({ error: 'delete_failed' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Type-check**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/assistant/projects/upload-url/route.ts src/app/api/assistant/projects/files/route.ts
git commit -m "feat: project file upload + register + delete routes"
```

---

### Task 7: Move-chat route + save route carries projectId

**Files:**
- Create: `src/app/api/assistant/move/route.ts`
- Modify: `src/app/api/assistant/save/route.ts`

**Interfaces:**
- Consumes: Task 4 (`getOwnProject`, `moveChatToProject`, saveChat/updateChat 5th param).
- Produces: `PATCH /api/assistant/move {id, projectId: string | null}` → `{ok:true}`; `POST /api/assistant/save` body accepts optional `projectId?: string | null` (absent = leave untouched on update, null on insert). Tasks 9/11 call these.

- [ ] **Step 1: Create `src/app/api/assistant/move/route.ts`** (mirrors the pin/rename route shape):

```ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOwnProject, moveChatToProject } from '@/lib/supabase/queries/assistant-projects'

// Move a conversation into (or out of) a project. RLS scopes both sides:
// the chat update touches only the caller's own row, and getOwnProject
// returns null for a project the caller does not own.
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  let body: { id?: string; projectId?: string | null }
  try { body = await req.json() } catch { return new Response('Bad request', { status: 400 }) }
  if (!body.id || body.projectId === undefined) return new Response('Bad request', { status: 400 })

  if (body.projectId !== null) {
    const project = await getOwnProject(body.projectId)
    if (!project) return new Response('Not found', { status: 404 })
  }

  const ok = await moveChatToProject(body.id, body.projectId)
  if (!ok) return new Response('Not found', { status: 404 })
  return Response.json({ ok: true })
}
```

- [ ] **Step 2: Modify `src/app/api/assistant/save/route.ts`**

Add the import:

```ts
import { getOwnProject } from '@/lib/supabase/queries/assistant-projects'
```

Extend the body parse (currently `const { messages, existingId } = await req.json() as {...}`):

```ts
  const { messages, existingId, projectId } = await req.json() as {
    messages:   { role: string; content: string }[]
    existingId?: string
    projectId?:  string | null
  }
```

After the `messages.length < 2` early return, validate ownership (an invalid or foreign id degrades to no-project — never an error, saving must stay best-effort):

```ts
  // Project filing (Phase 4): a foreign or stale project id degrades to
  // no-project rather than failing the save. undefined = leave as-is on
  // update (the floating panel never sends the field).
  let projectIdChecked = projectId
  if (typeof projectIdChecked === 'string' && !(await getOwnProject(projectIdChecked))) {
    projectIdChecked = null
  }
```

And thread it through the save calls:

```ts
  let id: string | null
  if (existingId) {
    id = await updateChat(existingId, profile.id, messages, tag, projectIdChecked)
    if (!id) id = await saveChat(profile.id, messages, tag, projectIdChecked ?? null)  // fallback if row was deleted or not owned
  } else {
    id = await saveChat(profile.id, messages, tag, projectIdChecked ?? null)
  }
```

- [ ] **Step 3: Type-check**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/assistant/move/route.ts src/app/api/assistant/save/route.ts
git commit -m "feat: move-chat route + projectId through the save path"
```

---

### Task 8: Chat route — project context in the cached prefix + scoped recall

**Files:**
- Modify: `src/lib/ai/retrieve.ts`
- Modify: `src/app/api/assistant/chat/route.ts`

**Interfaces:**
- Consumes: Task 1 RPC (`project_filter`), Task 3 builders, Task 4 queries, existing `getObjectBase64` + `MAX_PDF_BYTES`.
- Produces: chat body accepts `projectId?: string`; `retrievePastChats(query: string, projectId?: string)` — Task 9's shell sends `projectId`.

**The caching design (the load-bearing decision — do not deviate):**
The prompt-cache prefix is `tools → system → messages`, checked byte-for-byte. Today the volatile block (date, user, past-chat recall) is system block 2 — it changes every turn, which is fine while nothing after it is cached. Project files must be cached (they ride on every message), and image/document blocks cannot go in `system` (text only) — so they go at the front of the **first user message** with a `cache_control` breakpoint. That only works if nothing volatile precedes them: for **project chats only**, the volatile text moves out of `system` and is **appended to the last user message** (which is new every turn anyway, so the stable prefix stays byte-identical). Non-project chats keep today's exact request shape — zero regression. Breakpoints used: 2 in system + 1 in messages = 3 (limit 4).

- [ ] **Step 1: Modify `src/lib/ai/retrieve.ts`** — replace `retrievePastChats` with:

```ts
/** Automatic per-user memory: the caller's own past chats (RLS via
 *  SECURITY INVOKER match_asst_chats — migration 0030 isolation).
 *  Inside a project (Phase 4): sibling chats in the same project match
 *  first, general per-user memory beneath. */
export async function retrievePastChats(query: string, projectId?: string): Promise<PastChat[]> {
  let embedding: number[]
  try { embedding = await embed(query, 'query') } catch { return [] }

  const supabase = await createClient()
  type Row = { id: string; topic: string | null; summary: string | null; msgs: unknown; similarity: number }
  const rows: Row[] = []

  if (projectId) {
    const { data } = await supabase.rpc('match_asst_chats',
      args({ query_embedding: embedding, match_threshold: 0.5, match_count: 3, project_filter: projectId }))
    rows.push(...((data ?? []) as Row[]))
  }

  const { data } = await supabase.rpc('match_asst_chats',
    args({ query_embedding: embedding, match_threshold: 0.5, match_count: 3 }))
  for (const r of (data ?? []) as Row[]) {
    if (!rows.some(x => x.id === r.id)) rows.push(r)
  }

  return rows.slice(0, projectId ? 4 : 3)
    .map(r => ({ topic: r.topic, summary: pastChatSummary(r), similarity: r.similarity }))
    .filter(r => r.summary !== '')
}
```

- [ ] **Step 2: Modify `src/app/api/assistant/chat/route.ts`**

2a. Add imports:

```ts
import { getOwnProject, listProjectFiles } from '@/lib/supabase/queries/assistant-projects'
import { projectSystemBlock, projectFilesLeadText } from '@/lib/ai/project-context'
```

2b. Extend the body type:

```ts
  const body = await req.json() as {
    messages: { role: 'user' | 'assistant'; content: string; attachments?: ChatAttachment[] }[]
    projectId?: string
  }
```

2c. After the `attachmentIndex` loop, resolve the project (RLS: a foreign id resolves to null → the chat simply runs project-less):

```ts
  // Project context (Phase 4) — RLS returns null for any project the caller
  // does not own, so a forged id silently degrades to a normal chat.
  const project      = body.projectId ? await getOwnProject(body.projectId) : null
  const projectFiles = project ? await listProjectFiles([project.id]) : []
```

2d. Change the recall call to `const pastChats = await retrievePastChats(lastUserMsg, project?.id)`.

2e. Replace the inline `system:` array construction. Before `const encoder = ...` build:

```ts
  // System blocks. SYSTEM_PREFIX is the shared frozen prefix (byte-stable).
  // Project chats add a second CACHED block (instructions — stable per
  // project); the volatile block then must NOT sit in system, because the
  // project-file breakpoint in the messages would be invalidated by it —
  // it rides at the end of the last user message instead. Non-project chats
  // keep today's exact shape (volatile as system block 2) — zero regression.
  const systemBlocks: Anthropic.Messages.TextBlockParam[] = [
    { type: 'text', text: SYSTEM_PREFIX, cache_control: { type: 'ephemeral' } },
  ]
  if (project) {
    systemBlocks.push({
      type: 'text',
      text: projectSystemBlock(project.name, project.instructions),
      cache_control: { type: 'ephemeral' },
    })
  } else {
    systemBlocks.push({ type: 'text', text: volatileParts.join('\n') })
  }
```

and in the `anthropic.messages.stream({ ... })` call replace the `system: [...]` array with `system: systemBlocks,`.

2f. Inside the stream `start()`, after the existing `for (const m of messages)` convo-building loop, add the project injection (before `const sources: ...`):

```ts
        if (project) {
          // Project reference files ride at the very front of the FIRST user
          // message with a cache breakpoint on the last block — together with
          // the system breakpoints the whole project prefix (tools + system +
          // files) is cached, so repeat turns re-read it at the cache rate
          // instead of resending every file.
          const projectBlocks: Anthropic.ContentBlockParam[] = []
          const lead = projectFilesLeadText(projectFiles)
          if (lead) projectBlocks.push({ type: 'text', text: lead })
          for (const f of projectFiles) {
            const data = await getObjectBase64(f.r2_key, MAX_PDF_BYTES)
            if (!data) {
              projectBlocks.push({ type: 'text', text: `[Project file "${f.name}" is no longer available]` })
              continue
            }
            if (f.mime === 'application/pdf') {
              projectBlocks.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } })
            } else {
              projectBlocks.push({
                type: 'image',
                source: { type: 'base64', media_type: f.mime as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif', data },
              })
            }
          }
          if (projectBlocks.length > 0) {
            const last = projectBlocks[projectBlocks.length - 1] as { cache_control?: { type: 'ephemeral' } }
            last.cache_control = { type: 'ephemeral' }
            const firstIdx = convo.findIndex(m => m.role === 'user')
            if (firstIdx !== -1) {
              const orig = convo[firstIdx].content
              const origBlocks: Anthropic.ContentBlockParam[] =
                typeof orig === 'string'
                  ? (orig ? [{ type: 'text', text: orig }] : [])
                  : [...orig]
              convo[firstIdx] = { role: 'user', content: [...projectBlocks, ...origBlocks] }
            }
          }

          // Volatile context (date / user / past-chat recall) — appended to the
          // LAST user message so the stable prefix above stays byte-identical
          // across turns (it would break the cache if it sat in system).
          const lastIdx = convo.map(m => m.role).lastIndexOf('user')
          if (lastIdx !== -1) {
            const orig = convo[lastIdx].content
            const blocks: Anthropic.ContentBlockParam[] =
              typeof orig === 'string'
                ? (orig ? [{ type: 'text', text: orig }] : [])
                : [...orig]
            blocks.push({ type: 'text', text: `---\n${volatileParts.join('\n')}` })
            convo[lastIdx] = { role: 'user', content: blocks }
          }
        }
```

2g. **Request-file budget guard** — the existing message-attachment loop (`for (const m of messages)` … `getObjectBase64(a.key, MAX_PDF_BYTES)`) must respect the combined budget: a full project (20 MB) plus a full message (20 MB) would exceed the API's 32 MB request cap. Extend the `attachments.ts` import in this route with `REQUEST_FILE_BUDGET`, declare before the loop (inside `start()`, `projectFiles` is already resolved):

```ts
        // Combined request budget: project files + every attachment in the
        // history ride on each request. Attachments past the budget degrade
        // to a text note (oldest first wins — deterministic, so the cached
        // prefix stays byte-stable across turns) instead of letting the API
        // reject the whole request. Non-project chats get the full budget.
        let fileBudget = REQUEST_FILE_BUDGET - projectFiles.reduce((s, f) => s + f.size, 0)
```

and inside the per-attachment loop, before the `getObjectBase64` call:

```ts
            if (a.size > fileBudget) {
              blocks.push({ type: 'text', text: `[Attachment "${a.name}" not included — file size limit for this conversation]` })
              continue
            }
```

and after a successful load (the non-null `data` branch, once the image/document block is pushed): `fileBudget -= a.size`.

Notes for the implementer:
- `getObjectBase64` and `MAX_PDF_BYTES` are already imported (Phase 3).
- Do NOT touch `SYSTEM_PREFIX`, the D-Promote early return, the tool loop, or usage/cost logging — they are unchanged.
- The first user message can equal the last (first turn): project blocks land first, volatile lands after the user's text — deterministic order either way.
- Project files are never budget-degraded — they are the stable cached prefix and their own total is already capped at `MAX_PROJECT_BYTES` (20 MB < 22 MB budget); only message attachments degrade.

- [ ] **Step 3: Type-check + build**

Run: `npm run type-check` then `npm run build`
Expected: both PASS.

- [ ] **Step 4: Manual dev check (if a dev server is practical)**

`npm run dev` → assistant page → send a normal (non-project) message: must stream exactly as before (regression). Project-path verification happens on the preview smoke test (Task 13) since projects need the UI.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/retrieve.ts src/app/api/assistant/chat/route.ts
git commit -m "feat: project context in the cached prefix + project-scoped recall"
```

---

### Task 9: Sidebar Projects section + shell project state

**Files:**
- Create: `src/features/assistant/ProjectsSection.tsx`
- Modify: `src/features/assistant/HistoryList.tsx` (export `ChatRow` + its `RowProps`)
- Modify: `src/features/assistant/HistorySidebar.tsx`
- Modify: `src/features/assistant/AssistantShell.tsx`
- Modify: `src/lib/i18n/en.ts`, `src/lib/i18n/zh.ts`

**Interfaces:**
- Consumes: Task 5 routes, Task 4 `ProjectWithFiles`, `AsstChatRow.project_id`.
- Produces:
  - `ProjectsSection` props: `{ projects: ProjectWithFiles[]; chats: AsstChatRow[]; activeChatId?: string; lang: LangCode; onLoad: (chat: AsstChatRow) => void; onOpenPanel: (id: string) => void; onNewChatInProject: (id: string) => void; onChanged: () => void; onPin: (id: string, pinned: boolean) => void; onDelete: (id: string) => void; onRename: (id: string, topic: string) => void; onMove: (id: string) => void; mobile?: boolean }`
  - `HistorySidebar` new props: `{ projects: ProjectWithFiles[]; projectsLoading: boolean; onProjectsChanged: () => void; onNewChatInProject: (id: string) => void; onOpenProjectPanel: (id: string) => void }`
  - `AssistantShell` gains state `projects`, `activeProjectId` (+`activeProjectIdRef`), `panelProjectId` (used by Task 10), function `startNewChatInProject(id)`; `sendMessage` posts `projectId`; saves post `projectId`.
  - `HistoryList` exports `ChatRow` and adds optional `onMove?: (id: string) => void` threading (menu item rendered only when provided — Task 11 provides it).

- [ ] **Step 1: i18n keys** — add to the assistant section of `en.ts`:

```ts
  projects: 'Projects',
  newProject: 'New project',
  projectName: 'Project name',
  projectSettings: 'Project settings',
  newChatInProject: 'New chat in this project',
  projectDelete: 'Delete project',
  projectDeleteConfirm: 'Delete this project? Its chats are kept and move back to your history.',
```

and to `zh.ts` (same keys):

```ts
  projects: '项目',
  newProject: '新建项目',
  projectName: '项目名称',
  projectSettings: '项目设置',
  newChatInProject: '在此项目中新建对话',
  projectDelete: '删除项目',
  projectDeleteConfirm: '删除此项目？其中的对话会保留并移回历史列表。',
```

(Check neither file already defines these keys — the Phase 3 `attachFiles` duplicate-key lesson.)

- [ ] **Step 2: Export `ChatRow` from `HistoryList.tsx`**

Change `interface RowProps` → `export interface RowProps` and `function ChatRow(` → `export function ChatRow(`. Add to `RowProps`: `onMoveClick?: () => void` and to `Props`: `onMove?: (id: string) => void`; thread it: `<ChatRow ... onMoveClick={onMove ? () => { setOpenMenuId(null); onMove(chat.id) } : undefined} />`. In the ⋮ dropdown, before the Rename button, render (import `FolderInput` from lucide, `t`/`LangCode` are NOT imported here — the menu items are currently hardcoded English like "Rename"; keep consistency and hardcode `Move to project…` the same way):

```tsx
          {onMoveClick && (
            <button
              onClick={e => { e.stopPropagation(); onMoveClick() }}
              className="w-full text-left px-3 py-2 text-sm text-ink hover:bg-bg transition-colors flex items-center gap-2"
            >
              <FolderInput size={13} className="text-muted" />
              Move to project…
            </button>
          )}
```

(`onMoveClick` reaches the dropdown via `RowProps`; the item renders only when the prop is set — Task 11 sets it. This step just prepares the plumbing so `ChatRow` is reusable now.)

- [ ] **Step 3: Create `src/features/assistant/ProjectsSection.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { Plus, Folder, FolderOpen, ChevronRight, MoreVertical, Settings2, MessageSquarePlus, Trash2 } from 'lucide-react'
import { ChatRow } from './HistoryList'
import { Modal } from '@/components/Modal'
import { cn } from '@/lib/utils/cn'
import { t } from '@/lib/i18n'
import type { LangCode } from '@/lib/i18n'
import type { AsstChatRow } from '@/lib/supabase/queries/assistant'
import type { ProjectWithFiles } from '@/lib/supabase/queries/assistant-projects'

interface Props {
  projects:           ProjectWithFiles[]
  chats:              AsstChatRow[]
  activeChatId?:      string
  lang:               LangCode
  onLoad:             (chat: AsstChatRow) => void
  onOpenPanel:        (id: string) => void
  onNewChatInProject: (id: string) => void
  onChanged:          () => void
  onPin:              (id: string, pinned: boolean) => void
  onDelete:           (id: string) => void
  onRename:           (id: string, topic: string) => void
  onMove:             (id: string) => void
  mobile?:            boolean
}

export function ProjectsSection({
  projects, chats, activeChatId, lang,
  onLoad, onOpenPanel, onNewChatInProject, onChanged,
  onPin, onDelete, onRename, onMove, mobile,
}: Props) {
  const [expanded,        setExpanded]        = useState<Set<string>>(new Set())
  const [openMenuId,      setOpenMenuId]      = useState<string | null>(null)
  const [openChatMenuId,  setOpenChatMenuId]  = useState<string | null>(null)
  const [createOpen,      setCreateOpen]      = useState(false)
  const [nameInput,       setNameInput]       = useState('')
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [busy,            setBusy]            = useState(false)

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function confirmCreate() {
    const name = nameInput.trim()
    if (!name || busy) return
    setBusy(true)
    const res = await fetch('/api/assistant/projects', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name }),
    })
    setBusy(false)
    if (res.ok) {
      setCreateOpen(false)
      setNameInput('')
      onChanged()
    }
  }

  async function confirmDelete() {
    const id = pendingDeleteId
    if (!id || busy) return
    setBusy(true)
    const res = await fetch('/api/assistant/projects', {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id }),
    })
    setBusy(false)
    setPendingDeleteId(null)
    if (res.ok) onChanged()
  }

  return (
    <div className="mb-1">
      {/* Header */}
      <div className="px-4 pt-2 pb-1 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">{t(lang, 'projects')}</p>
        <button
          onClick={() => { setNameInput(''); setCreateOpen(true) }}
          title={t(lang, 'newProject')}
          aria-label={t(lang, 'newProject')}
          className="p-1 rounded-md text-muted hover:text-ink hover:bg-line transition-colors"
        >
          <Plus size={13} />
        </button>
      </div>

      {/* Folders */}
      {projects.map(p => {
        const projectChats = chats.filter(c => c.project_id === p.id)
        const isOpen       = expanded.has(p.id)
        return (
          <div key={p.id} className="px-1">
            <div className="relative group">
              <button
                onClick={() => toggleExpand(p.id)}
                className="w-full text-left px-2 py-2 rounded-lg hover:bg-bg transition-colors flex items-center gap-2"
              >
                <ChevronRight size={12} className={cn('shrink-0 text-muted transition-transform', isOpen && 'rotate-90')} />
                {isOpen
                  ? <FolderOpen size={14} className="shrink-0 text-terracotta" />
                  : <Folder size={14} className="shrink-0 text-muted" />}
                <span className="text-sm font-medium text-ink truncate flex-1 pr-6">{p.name}</span>
                <span className="text-[10px] text-muted shrink-0">{projectChats.length}</span>
              </button>
              <button
                onClick={e => { e.stopPropagation(); setOpenMenuId(openMenuId === p.id ? null : p.id) }}
                className={cn(
                  'absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted hover:text-ink hover:bg-line transition-colors',
                  !mobile && 'opacity-0 group-hover:opacity-100',
                )}
              >
                <MoreVertical size={13} />
              </button>

              {openMenuId === p.id && (
                <div className="absolute right-2 top-full mt-1 z-20 min-w-[190px] bg-paper border border-line rounded-xl shadow-md py-1">
                  <button
                    onClick={e => { e.stopPropagation(); setOpenMenuId(null); onNewChatInProject(p.id) }}
                    className="w-full text-left px-3 py-2 text-sm text-ink hover:bg-bg transition-colors flex items-center gap-2"
                  >
                    <MessageSquarePlus size={13} className="text-muted" />
                    {t(lang, 'newChatInProject')}
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); setOpenMenuId(null); onOpenPanel(p.id) }}
                    className="w-full text-left px-3 py-2 text-sm text-ink hover:bg-bg transition-colors flex items-center gap-2"
                  >
                    <Settings2 size={13} className="text-muted" />
                    {t(lang, 'projectSettings')}
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); setOpenMenuId(null); setPendingDeleteId(p.id) }}
                    className="w-full text-left px-3 py-2 text-sm text-terracotta hover:bg-bg transition-colors flex items-center gap-2"
                  >
                    <Trash2 size={13} />
                    {t(lang, 'projectDelete')}
                  </button>
                </div>
              )}
            </div>

            {/* Nested chats */}
            {isOpen && projectChats.length > 0 && (
              <div className="ml-5 border-l border-line pl-1">
                {projectChats.map(chat => (
                  <ChatRow
                    key={chat.id}
                    chat={chat}
                    isActive={chat.id === activeChatId}
                    isMenuOpen={openChatMenuId === chat.id}
                    mobile={mobile}
                    onLoad={() => onLoad(chat)}
                    onToggleMenu={() => setOpenChatMenuId(openChatMenuId === chat.id ? null : chat.id)}
                    onPin={() => { setOpenChatMenuId(null); onPin(chat.id, !chat.pinned) }}
                    onDeleteClick={() => { setOpenChatMenuId(null); onDelete(chat.id) }}
                    onRenameClick={() => { setOpenChatMenuId(null); onRename(chat.id, chat.topic ?? '') }}
                    onMoveClick={() => { setOpenChatMenuId(null); onMove(chat.id) }}
                    onToggleSelect={() => {}}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}

      {/* Create modal */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)}>
        <p className="font-display text-base font-medium text-ink mb-3">{t(lang, 'newProject')}</p>
        <input
          value={nameInput}
          onChange={e => setNameInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') confirmCreate() }}
          placeholder={t(lang, 'projectName')}
          maxLength={60}
          className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-terracotta/40 focus:border-terracotta/60 mb-4"
          autoFocus
        />
        <div className="flex gap-3 justify-end">
          <button
            onClick={() => setCreateOpen(false)}
            className="px-4 py-2 rounded-xl border border-line text-ink2 text-sm font-medium hover:border-ink2 transition-colors"
          >
            {t(lang, 'memoryCancel')}
          </button>
          <button
            onClick={confirmCreate}
            disabled={!nameInput.trim() || busy}
            className="px-4 py-2 rounded-xl bg-terracotta text-white text-sm font-medium hover:bg-terracotta/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {t(lang, 'memorySave')}
          </button>
        </div>
      </Modal>

      {/* Delete confirm — chats are kept (spec: stated in the modal) */}
      <Modal isOpen={pendingDeleteId !== null} onClose={() => setPendingDeleteId(null)}>
        <p className="font-display text-base font-medium text-ink mb-1">{t(lang, 'projectDelete')}</p>
        <p className="text-sm text-ink2 mb-5">{t(lang, 'projectDeleteConfirm')}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={() => setPendingDeleteId(null)}
            className="px-4 py-2 rounded-xl border border-line text-ink2 text-sm font-medium hover:border-ink2 transition-colors"
          >
            {t(lang, 'memoryCancel')}
          </button>
          <button
            onClick={confirmDelete}
            disabled={busy}
            className="px-4 py-2 rounded-xl bg-terracotta text-white text-sm font-medium hover:bg-terracotta/90 disabled:opacity-50 transition-colors"
          >
            {t(lang, 'projectDelete')}
          </button>
        </div>
      </Modal>
    </div>
  )
}
```

(Menu outside-click closing: the folder menus close on the next toggle; add the same `document.addEventListener('click', …)` effect pattern as `HistoryList` for `openMenuId`/`openChatMenuId` — copy that `useEffect` verbatim, one per state.)

- [ ] **Step 4: `HistorySidebar.tsx`** — wire the section into BOTH surfaces:

1. Extend `Props`:

```ts
  projects:           ProjectWithFiles[]
  projectsLoading:    boolean
  onProjectsChanged:  () => void
  onNewChatInProject: (id: string) => void
  onOpenProjectPanel: (id: string) => void
```

with `import type { ProjectWithFiles } from '@/lib/supabase/queries/assistant-projects'` and `import { ProjectsSection } from './ProjectsSection'`.

2. Filter project chats out of the main list (they live in folders — including pinned ones):

```ts
  const projectIds = useMemo(() => new Set(projects.map(p => p.id)), [projects])
  const mainChats  = useMemo(
    () => displayChats.filter(c => !c.project_id || !projectIds.has(c.project_id)),
    [displayChats, projectIds],
  )
```

Use `mainChats` everywhere `displayChats` currently feeds `HistoryList` and the empty-state check (both desktop and drawer).

3. Render `<ProjectsSection …/>` in the desktop sidebar between the New chat/Memory block and the "Chats" header, and in the drawer between the New chat/Memory block and the "Chats" label:

```tsx
          {!projectsLoading || projects.length > 0 ? (
            <ProjectsSection
              projects={projects}
              chats={displayChats}
              activeChatId={activeChatId}
              lang={lang}
              onLoad={onLoad}
              onOpenPanel={id => { onOpenProjectPanel(id); onDrawerClose?.() }}
              onNewChatInProject={onNewChatInProject}
              onChanged={onProjectsChanged}
              onPin={handlePin}
              onDelete={setPendingDeleteId}
              onRename={handleRename}
              onMove={handleMoveRequest}
              mobile={/* false on desktop, true in the drawer */ false}
            />
          ) : null}
```

(the drawer copy passes `mobile`; `handleMoveRequest` is a stub `() => {}` until Task 11 — declare `function handleMoveRequest(_id: string) {}` now with a `// Task 11 wires the move modal` comment, or inline `() => {}`).

Note: the section must live INSIDE the scrollable list container so long folder lists scroll — place it as the first child of the existing `overflow-y-auto` div on both surfaces.

- [ ] **Step 5: `AssistantShell.tsx`** — project state + wiring:

1. Imports: `import type { ProjectWithFiles } from '@/lib/supabase/queries/assistant-projects'`.
2. State + refs:

```ts
  const [projects,        setProjects]        = useState<ProjectWithFiles[]>([])
  const [projectsLoading, setProjectsLoading] = useState(true)
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [panelProjectId,  setPanelProjectId]  = useState<string | null>(null)
  const activeProjectIdRef = useRef<string | null>(null)
```

```ts
  useEffect(() => { activeProjectIdRef.current = activeProjectId }, [activeProjectId])

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/assistant/projects')
      if (res.ok) {
        const list = await res.json() as ProjectWithFiles[]
        setProjects(list)
        // Active/panel project may have been deleted elsewhere
        setActiveProjectId(prev => prev && !list.some(p => p.id === prev) ? null : prev)
        setPanelProjectId(prev => prev && !list.some(p => p.id === prev) ? null : prev)
      }
    } finally {
      setProjectsLoading(false)
    }
  }, [])

  useEffect(() => { fetchProjects() }, [fetchProjects])
```

3. `saveConversation`: include the project in the body (read the ref — the callback is memoized):

```ts
        body: JSON.stringify({ messages: payload, existingId, projectId: activeProjectIdRef.current }),
```

4. `sendMessage` fetch body:

```ts
        body: JSON.stringify({
          messages: history,
          ...(activeProjectId ? { projectId: activeProjectId } : {}),
        }),
```

5. `buildOptimistic` return object and the inline optimistic literal in `sendMessage` both gain `project_id: activeProjectIdRef.current` (the literal in `sendMessage` may use `activeProjectId` directly).
6. `loadFromHistory`: add `setActiveProjectId(chat.project_id ?? null)`.
7. `startNewChat`: add `setActiveProjectId(null)`.
8. New function after `startNewChat`:

```ts
  function startNewChatInProject(projectId: string) {
    startNewChat()
    setActiveProjectId(projectId)
  }
```

9. Pass the new props to `HistorySidebar`:

```tsx
        projects={projects}
        projectsLoading={projectsLoading}
        onProjectsChanged={fetchProjects}
        onNewChatInProject={startNewChatInProject}
        onOpenProjectPanel={setPanelProjectId}
```

(`panelProjectId` renders nothing until Task 10 — that's fine; the linter may flag it unused: add the `ProjectPanel` in Task 10 or a `void panelProjectId` placeholder is NOT acceptable — instead simply keep the state and accept it's read by `setPanelProjectId(prev…)` in `fetchProjects`, which counts as a read.)

- [ ] **Step 6: Verify**

Run: `npm run type-check` then `npm run build`
Expected: both PASS.

Then `npm run dev` → assistant page: create a project (folder appears, both desktop and phone-width drawer), "New chat in this project" starts an empty chat, send a message → after save the chat appears nested under the folder (and NOT in the main Chats list), deleting the project moves the chat back to the main list. Overlays render above BottomNav.

- [ ] **Step 7: Commit**

```bash
git add src/features/assistant/ProjectsSection.tsx src/features/assistant/HistoryList.tsx src/features/assistant/HistorySidebar.tsx src/features/assistant/AssistantShell.tsx src/lib/i18n/en.ts src/lib/i18n/zh.ts
git commit -m "feat: sidebar project folders + active-project wiring"
```

---

### Task 10: Project settings panel + composer chip

**Files:**
- Create: `src/features/assistant/ProjectPanel.tsx`
- Modify: `src/features/assistant/AssistantShell.tsx`
- Modify: `src/lib/i18n/en.ts`, `src/lib/i18n/zh.ts`

**Interfaces:**
- Consumes: Task 5 PATCH route, Task 6 file routes, `ProjectWithFiles`, Task 2 error codes (`count`/`type`/`size`/`total`).
- Produces: `ProjectPanel` props `{ project: ProjectWithFiles | null; onClose: () => void; onChanged: () => void; lang: LangCode }` — renders only when `project` is non-null; z-[70] overlay (MemoryView pattern).

- [ ] **Step 1: i18n keys** — `en.ts`:

```ts
  projectInstructions: 'Project instructions',
  projectInstructionsHint: 'The assistant follows these in every chat inside this project.',
  projectFiles: 'Project files',
  projectFilesHint: 'Shared with every chat in this project. Images and PDF only, up to 10 files / 20 MB.',
  projectAddFile: 'Add file',
  projectFileTooMany: 'Up to 10 files per project.',
  projectFileTotalTooLarge: 'Project files can total up to 20 MB.',
```

`zh.ts`:

```ts
  projectInstructions: '项目说明',
  projectInstructionsHint: '此项目内的每个对话都会遵循这些说明。',
  projectFiles: '项目文件',
  projectFilesHint: '供此项目内所有对话共用。仅支持图片和 PDF，最多 10 个文件 / 20 MB。',
  projectAddFile: '添加文件',
  projectFileTooMany: '每个项目最多 10 个文件。',
  projectFileTotalTooLarge: '项目文件总大小不能超过 20 MB。',
```

- [ ] **Step 2: Create `src/features/assistant/ProjectPanel.tsx`** (overlay pattern = MemoryView: fixed inset, z-[70], header with X):

```tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Paperclip, Trash2, Plus, Folder } from 'lucide-react'
import { useToast } from '@/components/Toast'
import { validateAttachment } from '@/lib/ai/attachments'
import { t } from '@/lib/i18n'
import type { LangCode } from '@/lib/i18n'
import type { ProjectWithFiles } from '@/lib/supabase/queries/assistant-projects'

interface Props {
  project:   ProjectWithFiles | null
  onClose:   () => void
  onChanged: () => void
  lang:      LangCode
}

function fmtSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

export function ProjectPanel({ project, onClose, onChanged, lang }: Props) {
  const [name,         setName]         = useState('')
  const [instructions, setInstructions] = useState('')
  const [saving,       setSaving]       = useState(false)
  const [uploading,    setUploading]    = useState(false)
  const [confirmId,    setConfirmId]    = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { error: showError } = useToast()

  // Re-seed the form whenever a different project opens
  const projectId = project?.id
  useEffect(() => {
    if (project) {
      setName(project.name)
      setInstructions(project.instructions ?? '')
      setConfirmId(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  if (!project) return null

  const dirty = name.trim() !== project.name ||
    (instructions.trim() || null) !== (project.instructions?.trim() || null)

  async function saveSettings() {
    if (!project || !name.trim() || saving) return
    setSaving(true)
    const res = await fetch('/api/assistant/projects', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id: project.id, name: name.trim(), instructions: instructions.trim() || null }),
    })
    setSaving(false)
    if (res.ok) onChanged()
  }

  async function handleFilePicked(list: FileList | null) {
    if (!project || !list?.length || uploading) return
    const f = list[0]
    const perFile = validateAttachment(f.name, f.type, f.size)
    if (perFile === 'type') { showError(t(lang, 'attachUnsupported')); return }
    if (perFile === 'size') { showError(t(lang, 'attachTooLarge')); return }
    setUploading(true)
    try {
      const urlRes = await fetch('/api/assistant/projects/upload-url', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ projectId: project.id, filename: f.name, contentType: f.type, size: f.size }),
      })
      if (!urlRes.ok) {
        const { error } = await urlRes.json().catch(() => ({ error: '' })) as { error?: string }
        if (error === 'count')      showError(t(lang, 'projectFileTooMany'))
        else if (error === 'total') showError(t(lang, 'projectFileTotalTooLarge'))
        else if (error === 'type')  showError(t(lang, 'attachUnsupported'))
        else if (error === 'size')  showError(t(lang, 'attachTooLarge'))
        else                        showError(t(lang, 'attachUploadFailed'))
        return
      }
      const { url, key } = await urlRes.json() as { url: string; key: string }
      const put = await fetch(url, { method: 'PUT', body: f, headers: { 'Content-Type': f.type } })
      if (!put.ok) throw new Error()
      const reg = await fetch('/api/assistant/projects/files', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ projectId: project.id, key, name: f.name, mime: f.type, size: f.size }),
      })
      if (!reg.ok) throw new Error()
      onChanged()
    } catch {
      showError(t(lang, 'attachUploadFailed'))
    } finally {
      setUploading(false)
    }
  }

  async function removeFile(id: string) {
    setConfirmId(null)
    const res = await fetch('/api/assistant/projects/files', {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id }),
    })
    if (res.ok) onChanged()
    else showError(t(lang, 'attachUploadFailed'))
  }

  return (
    // z-[70]: above the phone drawer (z-[60]) — MemoryView pattern
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[85dvh] overflow-y-auto bg-paper rounded-card border border-line shadow-xl p-5">
        {/* Header */}
        <div className="flex items-center gap-2.5 mb-4">
          <Folder size={16} className="text-terracotta shrink-0" />
          <p className="font-display text-base font-medium text-ink flex-1 truncate">{t(lang, 'projectSettings')}</p>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-ink2 hover:text-ink hover:bg-bg transition-colors"
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>

        {/* Name */}
        <label className="block text-[11px] font-semibold uppercase tracking-widest text-muted mb-1">
          {t(lang, 'projectName')}
        </label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          maxLength={60}
          className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-terracotta/40 focus:border-terracotta/60 mb-4"
        />

        {/* Instructions */}
        <label className="block text-[11px] font-semibold uppercase tracking-widest text-muted mb-1">
          {t(lang, 'projectInstructions')}
        </label>
        <p className="text-xs text-muted mb-1.5">{t(lang, 'projectInstructionsHint')}</p>
        <textarea
          value={instructions}
          onChange={e => setInstructions(e.target.value)}
          rows={4}
          className="w-full resize-none rounded-xl border border-line bg-bg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-terracotta/40 focus:border-terracotta/60 mb-2"
        />
        <div className="flex justify-end mb-5">
          <button
            onClick={saveSettings}
            disabled={!dirty || !name.trim() || saving}
            className="px-4 py-2 rounded-xl bg-terracotta text-white text-sm font-medium hover:bg-terracotta/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {t(lang, 'memorySave')}
          </button>
        </div>

        {/* Files */}
        <label className="block text-[11px] font-semibold uppercase tracking-widest text-muted mb-1">
          {t(lang, 'projectFiles')}
        </label>
        <p className="text-xs text-muted mb-2">{t(lang, 'projectFilesHint')}</p>
        <div className="space-y-1.5 mb-3">
          {project.files.map(f => (
            <div key={f.id} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-line bg-bg">
              <Paperclip size={12} className="shrink-0 text-muted" />
              <span className="text-sm text-ink truncate flex-1">{f.name}</span>
              <span className="text-[11px] text-muted shrink-0">{fmtSize(f.size)}</span>
              {confirmId === f.id ? (
                <button
                  onClick={() => removeFile(f.id)}
                  className="text-[11px] font-medium text-terracotta shrink-0 px-1.5"
                >
                  {t(lang, 'memoryForget')}
                </button>
              ) : (
                <button
                  onClick={() => setConfirmId(f.id)}
                  className="p-1 rounded-md text-muted hover:text-terracotta hover:bg-line transition-colors shrink-0"
                  aria-label={t(lang, 'memoryForget')}
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
          className="hidden"
          onChange={e => { handleFilePicked(e.target.files); e.target.value = '' }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-line text-ink2 text-sm font-medium hover:border-ink2 disabled:opacity-50 transition-colors"
        >
          <Plus size={13} className={uploading ? 'animate-pulse' : undefined} />
          {t(lang, 'projectAddFile')}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: `AssistantShell.tsx`** — render the panel and the composer chip:

1. Imports: `import { ProjectPanel } from './ProjectPanel'` and add `Folder` to the lucide import.
2. Derive: `const activeProject = activeProjectId ? projects.find(p => p.id === activeProjectId) ?? null : null` and `const panelProject = panelProjectId ? projects.find(p => p.id === panelProjectId) ?? null : null`.
3. Render at the end of the shell, next to the closing tags (sibling of the outer flex divs, after `<BottomNav …/>`'s container):

```tsx
      <ProjectPanel
        project={panelProject}
        onClose={() => setPanelProjectId(null)}
        onChanged={fetchProjects}
        lang={lang}
      />
```

4. Composer chip — in the controls row, immediately after the `+` attach button (spec: left side, next to attach):

```tsx
                {activeProject && (
                  <button
                    onClick={() => setPanelProjectId(activeProject.id)}
                    title={activeProject.name}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-terracotta/40 bg-terracotta/5 text-[11px] font-medium text-terracotta hover:border-terracotta transition-colors max-w-[140px]"
                  >
                    <Folder size={11} className="shrink-0" />
                    <span className="truncate">{activeProject.name}</span>
                  </button>
                )}
```

- [ ] **Step 4: Verify**

Run: `npm run type-check` then `npm run build` — both PASS.

Dev check: open project settings from the folder ⋮ (works from the phone drawer — panel layers above it), rename + instructions save, add a JPG and a PDF (rows appear with sizes), add a 6 MB image → red toast, remove a file. Chip shows in the composer when chatting inside a project and opens the panel.

- [ ] **Step 5: Commit**

```bash
git add src/features/assistant/ProjectPanel.tsx src/features/assistant/AssistantShell.tsx src/lib/i18n/en.ts src/lib/i18n/zh.ts
git commit -m "feat: project settings panel (name/instructions/files) + composer chip"
```

---

### Task 11: Move chat to project

**Files:**
- Modify: `src/features/assistant/HistorySidebar.tsx`
- Modify: `src/features/assistant/AssistantShell.tsx`
- Modify: `src/lib/i18n/en.ts`, `src/lib/i18n/zh.ts`

**Interfaces:**
- Consumes: Task 7 move route, Task 9 `onMove` threading in `HistoryList`/`ChatRow`/`ProjectsSection`.
- Produces: `HistorySidebar` prop `onChatMoved: (chatId: string, projectId: string | null) => void` — the shell uses it to keep `activeProjectId` in sync when the open chat is moved.

- [ ] **Step 1: i18n** — `en.ts`: `moveToProject: 'Move to project'`, `noProject: 'No project'`; `zh.ts`: `moveToProject: '移至项目'`, `noProject: '不属于任何项目'`.

- [ ] **Step 2: `HistorySidebar.tsx`**

1. Props gain `onChatMoved: (chatId: string, projectId: string | null) => void`.
2. State: `const [moveChatId, setMoveChatId] = useState<string | null>(null)`.
3. Replace the Task 9 stub: `function handleMoveRequest(id: string) { setMoveChatId(id) }`.
4. Pass `onMove={projects.length > 0 ? handleMoveRequest : undefined}` to BOTH `HistoryList` instances (desktop + drawer) — main-list chats can move only when a project exists; `ProjectsSection` keeps its unconditional `onMove={handleMoveRequest}` (moving OUT is always possible via the picker's "No project").
5. Move picker modal (with the other modals; uses the shared `Modal`, which is z-[60] and renders above the drawer as the later sibling — same as the rename modal today):

```tsx
      {/* Move-to-project picker */}
      <Modal isOpen={moveChatId !== null} onClose={() => setMoveChatId(null)}>
        <p className="font-display text-base font-medium text-ink mb-3">{t(lang, 'moveToProject')}</p>
        <div className="space-y-1 max-h-[50dvh] overflow-y-auto">
          <button
            onClick={() => confirmMove(null)}
            className="w-full text-left px-3 py-2 rounded-xl border border-line text-sm text-ink hover:border-ink2 transition-colors"
          >
            {t(lang, 'noProject')}
          </button>
          {projects.map(p => (
            <button
              key={p.id}
              onClick={() => confirmMove(p.id)}
              className="w-full text-left px-3 py-2 rounded-xl border border-line text-sm text-ink hover:border-ink2 transition-colors flex items-center gap-2"
            >
              <Folder size={13} className="text-muted shrink-0" />
              <span className="truncate">{p.name}</span>
            </button>
          ))}
        </div>
      </Modal>
```

(add `Folder` to the lucide import), with the handler:

```ts
  async function confirmMove(projectId: string | null) {
    const chatId = moveChatId
    if (!chatId) return
    setMoveChatId(null)

    // Optimistic re-home; revert by refetch on failure
    setChats(prev => prev.map(c => c.id === chatId ? { ...c, project_id: projectId } : c))
    onChatMoved(chatId, projectId)

    const res = await fetch('/api/assistant/move', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id: chatId, projectId }),
    })
    if (!res.ok) fetchChats()
  }
```

- [ ] **Step 3: `AssistantShell.tsx`** — pass the sync callback to `HistorySidebar`:

```tsx
        onChatMoved={(chatId, projectId) => {
          if (chatId === activeChatId) setActiveProjectId(projectId)
        }}
```

(Moving the OPEN chat updates the composer chip and — per spec — its next message picks up the project's instructions + files; the next save carries the new `projectId`, matching the moved row.)

- [ ] **Step 4: Verify**

Run: `npm run type-check` then `npm run build` — both PASS.

Dev check: ⋮ on a main-list chat → "Move to project…" → pick a folder → chat re-homes into the folder instantly; move it out via "No project"; move the currently open chat → composer chip appears/disappears accordingly.

- [ ] **Step 5: Commit**

```bash
git add src/features/assistant/HistorySidebar.tsx src/features/assistant/AssistantShell.tsx src/lib/i18n/en.ts src/lib/i18n/zh.ts
git commit -m "feat: move chat into/out of a project"
```

---

### Task 12: Health tab — API usage window filter (30 days / 7 days / Today)

Nic's request 2026-08-26 — independent of Projects, riding in the same phase. The Admin → Health "API usage tracker" currently shows a fixed last-30-days summary; add a window toggle. Admin UI is desktop-only and hardcoded English (existing convention — no i18n needed).

**Files:**
- Modify: `src/lib/supabase/queries/admin.ts` (`getUsageSummary`, ~line 215)
- Modify: `src/app/api/admin/health/route.ts`
- Modify: `src/features/admin/HealthTab.tsx`

**Interfaces:**
- Produces: `GET /api/admin/health?window=30d|7d|today` (default `30d`); `getUsageSummary(sinceIso: string)` replaces `getUsageSummary(days = 30)`.

- [ ] **Step 1: `queries/admin.ts`** — change the signature to take an ISO timestamp (the route computes the window):

```ts
export async function getUsageSummary(sinceIso: string): Promise<UsageSummary[]> {
  const db = createServiceClient()

  const { data, error } = await db
    .from('api_usage_logs')
    .select('service, tokens_in, tokens_out, estimated_cost')
    .gte('ts', sinceIso)
```

(the aggregation body below is unchanged — delete the old `const since = …` line). Then `grep -n "getUsageSummary" src/` to confirm the health route is the ONLY caller; if any other caller exists, update it to pass `new Date(Date.now() - 30 * 86_400_000).toISOString()`.

- [ ] **Step 2: `api/admin/health/route.ts`** — accept the window param. Change the handler signature to `export async function GET(req: NextRequest)` (add `NextRequest` to the next/server import) and add above the handler:

```ts
type UsageWindow = '30d' | '7d' | 'today'

// "Today" = since midnight Singapore time (UTC+8, no DST), not last-24-hours.
function windowSince(window: UsageWindow): string {
  if (window === 'today') {
    const sgt = new Date(Date.now() + 8 * 3_600_000)
    return new Date(Date.UTC(sgt.getUTCFullYear(), sgt.getUTCMonth(), sgt.getUTCDate()) - 8 * 3_600_000).toISOString()
  }
  const days = window === '7d' ? 7 : 30
  return new Date(Date.now() - days * 86_400_000).toISOString()
}
```

and in the handler:

```ts
  const raw    = req.nextUrl.searchParams.get('window')
  const window: UsageWindow = raw === '7d' || raw === 'today' ? raw : '30d'
```

with the usage call becoming `getUsageSummary(windowSince(window))`. (`getUnusualActivity(7)` and the system checks stay as they are.)

- [ ] **Step 3: `HealthTab.tsx`** — window chips + dynamic labels:

1. Types/state:

```ts
type UsageWindow = '30d' | '7d' | 'today'
const WINDOW_LABELS: Record<UsageWindow, string> = {
  '30d':  'last 30 days',
  '7d':   'last 7 days',
  today:  'today',
}
```

```ts
  const [window,  setWindow]  = useState<UsageWindow>('30d')
```

2. `load` takes the window and keeps existing data visible while switching (no full-page "Running checks…" flash after first load):

```ts
  const load = useCallback(async (win: UsageWindow) => {
    setLoading(true)
    setLoadErr(null)
    try {
      const res  = await fetch(`/api/admin/health?window=${win}`)
      const json = await res.json() as HealthData | { error: string }
      if (!res.ok) throw new Error((json as { error: string }).error ?? `HTTP ${res.status}`)
      setData(json as HealthData)
    } catch (err) {
      setLoadErr((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(window) }, [load, window])
```

Change the full-page loading guard to only blank when there is no data yet: `if (loading && !data) return <p …>Running checks…</p>` — and the Refresh button at the bottom becomes `onClick={() => load(window)}`.

3. Chips row — replace the section heading block (`API usage tracker — last 30 days`) with:

```tsx
      <div>
        <div className="flex items-center justify-between mb-1">
          <p className="text-[11px] uppercase tracking-widest text-muted font-medium">
            API usage tracker — {WINDOW_LABELS[window]}
          </p>
          <div className="flex items-center gap-1">
            {(['30d', '7d', 'today'] as const).map(w => (
              <button
                key={w}
                onClick={() => setWindow(w)}
                disabled={loading}
                className={cn(
                  'px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors',
                  window === w
                    ? 'bg-terracotta text-white border-terracotta'
                    : 'border-line text-ink2 hover:border-ink2',
                )}
              >
                {w === '30d' ? '30 days' : w === '7d' ? '7 days' : 'Today'}
              </button>
            ))}
          </div>
        </div>
```

4. `UsageCard` gains a `windowLabel: string` prop replacing the hardcoded `last 30 days` badge (`<span …>{windowLabel}</span>`); the tab root passes `windowLabel={WINDOW_LABELS[window]}`.
5. Optional polish while switching: wrap the usage grid in `<div className={cn(loading && 'opacity-60 pointer-events-none transition-opacity')}>`.

- [ ] **Step 4: Verify**

Run: `npm run type-check` then `npm run build` — both PASS.

Dev check (admin login): Health tab loads on 30 days as before; 7 days and Today shrink the call counts/costs; Today resets at midnight Singapore time; chips disabled while loading; Refresh keeps the selected window; the drift warning and provider links behave as before.

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/queries/admin.ts src/app/api/admin/health/route.ts src/features/admin/HealthTab.tsx
git commit -m "feat: API usage tracker window filter (30d / 7d / today)"
```

---

### Task 13: Full verification + deploy gates

**Files:** none (verification only)

- [ ] **Step 1: Run every standalone suite** (all must exit 0):

```bash
npx tsx src/lib/ai/attachments.test.ts
npx tsx src/lib/ai/project-context.test.ts
npx tsx src/lib/ai/tool-schemas.test.ts
npx tsx src/lib/ai/tagger.test.ts
npx tsx src/lib/ai/past-chat-summary.test.ts
npx tsx src/lib/storage/job-file-permissions.test.ts
npx tsx src/lib/telegram/link-token.test.ts
npx tsx scripts/lib/frontmatter.test.ts
npx tsx scripts/lib/chunk.test.ts
```

- [ ] **Step 2: Type-check + production build**

Run: `npm run type-check` then `npm run build`
Expected: both green — required before any push (standing rule).

- [ ] **Step 3: 🛑 GATE — confirm with Nic before pushing**

Confirm BOTH with Nic, in plain language: (1) "Did `npx supabase db push` for migration 0047 succeed?" (Task 1 gate — code that reads the new columns must never deploy first); (2) "OK to push to `dev` for the preview?" (standing ask-before-push rule). Only after both: `git push origin dev`.

- [ ] **Step 4: Preview smoke test (Nic, on the Vercel preview — from the spec's Phase 4 testing list)**

1. Create a project, set instructions ("always answer in bullet points"), add a PDF + a photo.
2. New chat in the project → ask something → answer follows the instructions and can answer questions about the files.
3. Ask a follow-up in a SECOND chat in the same project about something discussed in the first (after the first saved) → sibling recall works.
4. Move an existing chat into the project → its next message picks up instructions + files; move it out → they stop applying.
5. Delete the project → its chats reappear intact in the main history list.
6. Phone: folders usable in the drawer; panel + pickers layer above the drawer and BottomNav.
7. `create_pending_job` still works from inside a project chat; a normal non-project chat behaves exactly as before (regression).
8. Two accounts: neither sees the other's projects/files (the standing per-user privacy rule).
9. Second turn inside a project: check the Vercel function logs / Admin → API usage — cache-read tokens should be non-zero (the cached project prefix working).
10. Admin → Health: the usage tracker's 30 days / 7 days / Today chips change the numbers; Today shows only today's calls (Singapore midnight cutoff).

- [ ] **Step 5: After Nic's pass — merge gate**

Ask Nic to confirm the smoke test, then (with their explicit OK) merge `dev` → `main`. Session-end docs (plan.md, context.md, nic-checklist.md, session note) follow the CLAUDE.md session-end flow — not part of this plan.

---

## Self-Review (completed)

- **Spec coverage:** data model → Task 1; folder grouping + create/rename/delete + released-chats confirm copy → Tasks 9, 10 (rename lives in the panel), 5; move via ⋮ → Tasks 7, 11; mobile grouping → the drawer renders the same `ProjectsSection` (the spec's `/assistant/history` route was replaced by the drawer in Phase 1; the redirect stands); instructions in system prompt → Tasks 3, 8; files as document/image blocks from a project header panel → Tasks 6, 8, 10; linked memory project-first → Tasks 1, 8; cached-prefix placement → Task 8 (design note); new-chat-from-project auto-files → Tasks 7, 9; create-pending-job works in project chats → unchanged tool path, verified in smoke 7; overlays z-rule → Tasks 9–11; testing list → Task 13. Additions on Nic's 2026-08-26 request: 10-file cap + request-budget guard → Tasks 2, 8; Health usage window filter → Task 12.
- **Placeholder scan:** none — every step carries real code or an exact command.
- **Type consistency:** `ProjectRow`/`ProjectFileRow`/`ProjectWithFiles` defined once in Task 4 and consumed by name in 5, 6, 8, 9, 10; `validateProjectFile` error codes (`count`/`type`/`size`/`total`) match between Task 2, Task 6 responses, and Task 10's toast mapping; `saveChat`/`updateChat` 4th/5th params match between Tasks 4 and 7; `retrievePastChats(query, projectId?)` matches between Tasks 8's two edits.
