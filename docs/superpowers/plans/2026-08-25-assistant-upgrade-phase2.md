# Assistant Upgrade Phase 2 — Live-Data Tools + Agentic KB Search + Memory

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The assistant gains read-only live access to the schedule/jobs/team under the asker's own RLS, searches the knowledge base agentically (repeatable, rephrasable), and gets real per-user memory (Haiku summaries + meaningful-chat gate + a Memory manager view).

**Architecture:** The chat route becomes a manual tool-use loop (stream → execute client tools → append `tool_result` blocks → continue, cap 8 rounds) streaming SSE throughout. Six read-only tools run through the user-scoped Supabase client so RLS applies. The tagger additionally produces a 2–3-sentence summary + a "meaningful?" boolean; only meaningful chats get a summary + embedding (embedding input = topic + summary). A Memory view (sidebar/drawer) lists, edits (re-embed) and forgets summaries.

**Tech Stack:** Next.js 15 App Router, `@anthropic-ai/sdk` ^0.120 (`claude-sonnet-5`, adaptive thinking), Supabase (RLS + pgvector), Voyage AI embeddings, Tailwind + design tokens.

**Spec:** `docs/superpowers/specs/2026-08-24-assistant-upgrade-design.md` (section "Phase 2"). Phase 1 facts worth keeping: `docs/feat/feat-assistant-20260825-1-note.md`.

## Global Constraints

- **DB push before code push (HARD GATE):** migration 0046 must be applied to the shared remote DB (`npx supabase db push`, run by Nic) **before any `git push` to `dev`** — the Vercel preview shares the production DB and code selecting `asst_chats.summary` crashes with 42703 until the column exists. Commit locally freely; do not push until the Task 1 checkpoint is confirmed.
- Branch: `dev` (commit as you go; push only after the gate above). Never push to `main` — Nic merges after the preview smoke test.
- **Privacy hard rules (spec):** memory strictly per-user (RLS, migration 0030 + `SECURITY INVOKER`); tools run through the **user-scoped** server client (`@/lib/supabase/server` `createClient`) — never the service client; team-shared chat memory stays OFF.
- **Never embed `users` directly onto `jobs`** in a PostgREST select (standing rule, broke twice) — fetch user names in a follow-up query. Embedding `users` on `job_assignees` is fine.
- Job **financials are excluded** from every tool result (installers must never see commercial info; simplest safe rule: the assistant never reads `job_financials`).
- Model settings: `claude-sonnet-5`, `thinking: { type: 'adaptive' }`, `max_tokens: 8192`. Sonnet 5 rejects `budget_tokens` and sampling params (400). Tool round cap: **8**.
- The prompt-cache prefix (tools + first system block) must stay **byte-identical across requests and ≥ ~1024 tokens** — nothing volatile (dates, user, retrieved context) before the cache breakpoint.
- i18n: new user-facing strings in `en.ts` + `zh.ts` only (Bengali frozen — no bn edits; `t()` falls back per-key). Date labels always English. No emoji anywhere in UI (stroke SVG icons only). No locale-dependent date rendering (hydration lesson) — static English month/day tables.
- Overlays layer `z-[60]`+ above BottomNav; the Memory view uses `z-[70]` (above the phone drawer at `z-[60]`).
- Tests: this repo has **no test framework** — standalone `npx tsx <file>.test.ts` scripts that exit 1 on failure, using **relative imports of pure modules only** (importing anything that pulls in `next/headers` breaks tsx). Follow `src/lib/storage/job-file-permissions.test.ts` as the model.
- `npm run type-check` and `npm run build` must be green before any push.
- Files < 500 lines where possible; DB queries live in `src/lib/supabase/queries/<feature>.ts`.
- Communication with Nic: plain everyday language, technical terms explained in one sentence.

---

### Task 1: Migration 0046 — `asst_chats.summary` + `match_asst_chats` returns it

**Files:**
- Create: `supabase/migrations/0046_asst_chat_summary.sql`

**Interfaces:**
- Produces: column `asst_chats.summary text NULL`; RPC `match_asst_chats(query_embedding, match_threshold, match_count)` now returning `(id, topic, summary, msgs, tags, importance, similarity)`. Applying this immediately is safe for the live app: an added column and an extra returned field are both invisible to the deployed code.

- [ ] **Step 1: Write the migration**

```sql
-- 0046: assistant memory summaries (assistant upgrade Phase 2)
-- Apply BEFORE deploying code that selects asst_chats.summary
-- (standing lesson: db push before code push — feat-files 2026-08-06).

alter table asst_chats add column if not exists summary text;

-- match_asst_chats gains summary in its return set. The return type changes,
-- so the old function must be dropped first (CREATE OR REPLACE cannot change
-- a function's return type). Atomic within the migration transaction.
drop function if exists match_asst_chats(extensions.vector, float, int);

CREATE FUNCTION match_asst_chats(
  query_embedding extensions.vector(1024),
  match_threshold float DEFAULT 0.5,
  match_count      int   DEFAULT 3
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
    AND 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;
```

`SECURITY INVOKER` is what keeps memory per-user: the caller's RLS applies inside the function, and since migration 0030 users can only SELECT their own `asst_chats` rows.

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0046_asst_chat_summary.sql
git commit -m "feat: migration 0046 - asst_chats.summary + match_asst_chats returns summary"
```

- [ ] **Step 3: CHECKPOINT — ask Nic to run the migration NOW**

Tell Nic (plain language): "Before anything goes online, the database needs one small update — a new column where the assistant stores its memory summaries. Please run `npx supabase db push` from the project folder. It's safe to run right now while production is live; nothing existing changes." Wait for confirmation. **No `git push` in any later task until this is confirmed.**

---

### Task 2: Tagger — summary + meaningful gate (pure parser + standalone test)

**Files:**
- Modify: `src/lib/ai/tagger.ts`
- Test: `src/lib/ai/tagger.test.ts` (new; standalone tsx, relative import)

**Interfaces:**
- Consumes: nothing new.
- Produces: `ChatTag` gains `summary: string` and `meaningful: boolean`. New pure export `parseChatTag(text: string, forcePromote: boolean): ChatTag` (the JSON-parsing half, extracted so it can be tested without the SDK call). `tagConversation` signature unchanged, now returns the extended `ChatTag`.

- [ ] **Step 1: Write the failing test**

```ts
/**
 * Standalone test for the tagger's response parsing (no test framework in this repo).
 * Run: npx tsx src/lib/ai/tagger.test.ts
 * Exits 1 on any failure.
 */

import { parseChatTag } from './tagger'

let failures = 0

function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) {
    console.log(`  ✓ ${name}`)
  } else {
    console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`)
    failures++
  }
}

// 1. Full valid response parses through, including the new fields
const full = parseChatTag(JSON.stringify({
  topic: 'DAMA acrylic pricing', entities: ['DAMA'], tags: ['supplier', 'pricing'],
  importance: 4, visibility: ['role:sales'],
  summary: 'Nic asked for DAMA 5mm acrylic rates. Current price is $18/sqft with 5-day lead time.',
  meaningful: true,
}), false)
check('topic', full.topic, 'DAMA acrylic pricing')
check('summary', full.summary, 'Nic asked for DAMA 5mm acrylic rates. Current price is $18/sqft with 5-day lead time.')
check('meaningful', full.meaningful, true)
check('importance', full.importance, 4)

// 2. Missing new fields default safely (old-model responses, partial JSON)
const partial = parseChatTag('{"topic":"General","importance":2}', false)
check('missing summary defaults empty', partial.summary, '')
check('missing meaningful defaults false', partial.meaningful, false)

// 3. Malformed JSON falls back to safe defaults
const bad = parseChatTag('not json at all', false)
check('fallback topic', bad.topic, 'General')
check('fallback meaningful', bad.meaningful, false)
check('fallback summary', bad.summary, '')
check('fallback importance', bad.importance, 2)

// 4. D-Promote forces importance 5 but does NOT force meaningful
const promoted = parseChatTag('{"topic":"T","importance":1,"meaningful":false}', true)
check('forcePromote importance', promoted.importance, 5)
check('forcePromote leaves meaningful', promoted.meaningful, false)

// 5. Non-boolean meaningful / non-string summary are ignored
const wrongTypes = parseChatTag('{"meaningful":"yes","summary":42}', false)
check('non-boolean meaningful', wrongTypes.meaningful, false)
check('non-string summary', wrongTypes.summary, '')

// 6. JSON wrapped in prose still parses (the regex extraction path)
const wrapped = parseChatTag('Here you go: {"topic":"Wrapped","meaningful":true,"summary":"S"} done', false)
check('wrapped topic', wrapped.topic, 'Wrapped')
check('wrapped meaningful', wrapped.meaningful, true)

if (failures > 0) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nAll tagger parse checks passed')
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx src/lib/ai/tagger.test.ts`
Expected: FAIL — `parseChatTag` is not exported.

- [ ] **Step 3: Implement in `tagger.ts`**

Extend the interface, extract the parser, and extend the Haiku prompt:

```ts
export interface ChatTag {
  topic:      string
  entities:   string[]
  tags:       string[]
  importance: number
  visibility: string[]
  /** 2–3 sentence recall summary. Empty when nothing reusable. */
  summary:    string
  /** Only meaningful chats enter memory (Nic 2026-08-24) — gates summary + embedding. */
  meaningful: boolean
}

/** Pure parsing of the classifier's response — exported for the standalone test. */
export function parseChatTag(text: string, forcePromote: boolean): ChatTag {
  try {
    const json = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? '{}') as Record<string, unknown>
    return {
      topic:      typeof json.topic === 'string'      ? json.topic : 'General',
      entities:   Array.isArray(json.entities)        ? (json.entities as string[]) : [],
      tags:       Array.isArray(json.tags)            ? (json.tags as string[])     : [],
      importance: forcePromote ? 5 : (typeof json.importance === 'number' ? Math.max(1, Math.min(5, json.importance)) : 2),
      visibility: Array.isArray(json.visibility)      ? (json.visibility as string[]) : ['public-internal'],
      summary:    typeof json.summary === 'string'    ? json.summary : '',
      meaningful: json.meaningful === true,
    }
  } catch {
    return { topic: 'General', entities: [], tags: [], importance: forcePromote ? 5 : 2, visibility: ['public-internal'], summary: '', meaningful: false }
  }
}
```

`tagConversation`'s trailing try/catch collapses to `return parseChatTag(text, forcePromote)`. Add to the Haiku system prompt, after the visibility rules:

```
- summary: string — 2 to 3 plain sentences capturing what would matter if this topic comes up again (decisions made, standing facts, prices quoted, preferences stated, ongoing matters). Empty string "" if nothing is worth remembering.
- meaningful: boolean — true ONLY if the conversation contains something reusable in a future conversation (preferences, standing facts, decisions, ongoing work). Throwaway lookups, greetings, tests and chitchat are false.
```

Note the digest importance score is unchanged and independent of `meaningful` (spec).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx src/lib/ai/tagger.test.ts`
Expected: PASS, all checks green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/tagger.ts src/lib/ai/tagger.test.ts
git commit -m "feat: tagger produces recall summary + meaningful gate (with standalone tests)"
```

---

### Task 3: Save flow — store the summary, gate the embedding

**Files:**
- Modify: `src/lib/supabase/queries/assistant.ts` (`saveChat`, `updateChat`)

**Interfaces:**
- Consumes: `ChatTag.summary` / `ChatTag.meaningful` from Task 2.
- Produces: meaningful chats save `summary` + an embedding of `topic + "\n" + summary` (`input_type: 'document'`); trivial chats save `summary: null, embedding: null` so they can never match in retrieval (`WHERE embedding IS NOT NULL`) and never appear in the Memory view. `src/app/api/assistant/save/route.ts` needs **no change** (it just passes `tag` through).

- [ ] **Step 1: Rewrite the embedding block in both functions**

In `saveChat`, replace the embedding block and extend the insert:

```ts
  // Only meaningful chats enter memory (Nic 2026-08-24): trivial chats keep
  // summary + embedding NULL so they never match in retrieval and never show
  // in the Memory view. Embedding input is topic + summary (not raw messages).
  const summary = tag.meaningful && tag.summary.trim() ? tag.summary.trim() : null
  let embeddingStr: string | null = null
  if (summary) {
    try {
      const vec    = await embed(`${tag.topic}\n${summary}`, 'document')
      embeddingStr = `[${vec.join(',')}]`
    } catch { /* embedding optional */ }
  }
```

…and add `summary,` to the inserted object.

In `updateChat`, same block but the topic must respect a manual rename (the `original.topic` already fetched): use `` `${original.topic ?? tag.topic}\n${summary}` `` as the embed input, and add `summary,` to the updated object. Note in a comment: continuing a conversation regenerates its summary — a manual Memory-view edit is overwritten if the same chat is continued afterwards (accepted trade-off; the alternative needs an extra "edited" flag — YAGNI).

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: clean. (The `summary` column is not in the generated `types.ts` Row types — the inserts already cast `as never`/plain objects; if tsc complains, add `summary?: string | null` to the `asst_chats` Row/Insert/Update types in `src/lib/supabase/types.ts` instead of casting further.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase/queries/assistant.ts src/lib/supabase/types.ts
git commit -m "feat: gated memory save - summary column + topic+summary embedding for meaningful chats"
```

---

### Task 4: Retrieval split — automatic past-chat summaries, KB search becomes callable

**Files:**
- Modify: `src/lib/ai/retrieve.ts`
- Test: `src/lib/ai/past-chat-summary.test.ts` (new)
- Create: `src/lib/ai/past-chat-summary.ts` (pure fallback helper)

**Interfaces:**
- Consumes: `match_asst_chats` now returns `summary` (Task 1).
- Produces (all from `retrieve.ts` unless noted):
  - `pastChatSummary(row: { summary: string | null; msgs: unknown }): string` — from `past-chat-summary.ts`, pure: returns `row.summary` when non-empty, else the first user message sliced to 200 chars (old-row fallback), else `''`.
  - `retrievePastChats(query: string): Promise<{ topic: string | null; summary: string; similarity: number }[]>` — the automatic per-user memory block (embed query → `match_asst_chats`, threshold 0.5, count 3).
  - `formatPastChats(chats): string` — the `--- Relevant past conversations ---` block, `''` when empty.
  - `searchKnowledge(query: string): Promise<{ source_path: string; content: string; similarity: number }[]>` — embed query → `match_kb_chunks`, threshold 0.35, count 5 (used by the `search_knowledge` tool in Task 6).
  - The old `retrieveContext` / `formatContext` / `RetrievedContext` exports are **deleted** (only `chat/route.ts` imports them — verify with grep before deleting).

- [ ] **Step 1: Write the failing test**

```ts
/**
 * Standalone test for the past-chat summary fallback (no test framework in this repo).
 * Run: npx tsx src/lib/ai/past-chat-summary.test.ts
 * Exits 1 on any failure.
 */

import { pastChatSummary } from './past-chat-summary'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) { console.log(`  ✓ ${name}`) }
  else { console.error(`  ✗ ${name}\n      expected: ${JSON.stringify(expected)}\n      actual:   ${JSON.stringify(actual)}`); failures++ }
}

// 1. A stored summary wins
check('summary preferred',
  pastChatSummary({ summary: 'Stored summary.', msgs: [{ role: 'user', content: 'raw' }] }),
  'Stored summary.')

// 2. Old rows (summary null) fall back to the first user message, capped at 200 chars
const long = 'x'.repeat(300)
check('fallback to first user msg', pastChatSummary({ summary: null, msgs: [{ role: 'assistant', content: 'hi' }, { role: 'user', content: long }] }), 'x'.repeat(200))

// 3. Empty-string summary also falls back (never recall an empty block)
check('empty summary falls back', pastChatSummary({ summary: '', msgs: [{ role: 'user', content: 'first question' }] }), 'first question')

// 4. Garbage msgs shapes return '' rather than crashing
check('non-array msgs', pastChatSummary({ summary: null, msgs: 'oops' }), '')
check('no user msg', pastChatSummary({ summary: null, msgs: [{ role: 'assistant', content: 'a' }] }), '')

if (failures > 0) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nAll past-chat-summary checks passed')
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx src/lib/ai/past-chat-summary.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `past-chat-summary.ts`**

```ts
/** What the automatic memory block recalls for one past chat: the stored
 *  summary (Phase 2 rows), or the old first-message truncation for rows
 *  saved before migration 0046. Pure — standalone-testable. */
export function pastChatSummary(row: { summary: string | null; msgs: unknown }): string {
  if (row.summary && row.summary.trim()) return row.summary
  const msgs  = Array.isArray(row.msgs) ? (row.msgs as { role: string; content: string }[]) : []
  const first = msgs.find(m => m.role === 'user')?.content ?? ''
  return first.slice(0, 200)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx src/lib/ai/past-chat-summary.test.ts`
Expected: PASS.

- [ ] **Step 5: Rewrite `retrieve.ts`**

```ts
import { embed } from './embed'
import { createClient } from '@/lib/supabase/server'
import { pastChatSummary } from './past-chat-summary'

export interface PastChat { topic: string | null; summary: string; similarity: number }
export interface KbHit    { source_path: string; content: string; similarity: number }

// Cast needed: Supabase rpc() generic inference doesn't handle number[] args well
// in this SDK version — at runtime the values are correct.
const args = (a: object) => a as never

/** Automatic per-user memory: the caller's own past chats (RLS via
 *  SECURITY INVOKER match_asst_chats — migration 0030 isolation). */
export async function retrievePastChats(query: string): Promise<PastChat[]> {
  let embedding: number[]
  try { embedding = await embed(query, 'query') } catch { return [] }

  const supabase = await createClient()
  const { data } = await supabase.rpc('match_asst_chats',
    args({ query_embedding: embedding, match_threshold: 0.5, match_count: 3 }))

  type Row = { topic: string | null; summary: string | null; msgs: unknown; similarity: number }
  return ((data ?? []) as Row[])
    .map(r => ({ topic: r.topic, summary: pastChatSummary(r), similarity: r.similarity }))
    .filter(r => r.summary !== '')
}

/** KB vector search — now a tool the model calls (repeatably) rather than a
 *  pre-baked one-shot. Visibility filtering via RLS on kb_chunks. */
export async function searchKnowledge(query: string): Promise<KbHit[]> {
  let embedding: number[]
  try { embedding = await embed(query, 'query') } catch { return [] }

  const supabase = await createClient()
  const { data } = await supabase.rpc('match_kb_chunks',
    args({ query_embedding: embedding, match_threshold: 0.35, match_count: 5 }))

  type Row = { source_path: string; content: string; similarity: number }
  return ((data ?? []) as Row[]).map(r => ({
    source_path: r.source_path, content: r.content, similarity: r.similarity,
  }))
}

export function formatPastChats(chats: PastChat[]): string {
  if (chats.length === 0) return ''
  const parts = ['--- Relevant past conversations (this user only) ---']
  chats.forEach((c, i) => {
    const label = c.topic ? `Topic: ${c.topic}` : `Chat ${i + 1}`
    parts.push(`[${label}]\n${c.summary}`)
  })
  return parts.join('\n\n')
}
```

- [ ] **Step 6: Verify nothing else imports the deleted exports**

Run: `npx tsx -e "1"` is not needed — instead grep: `retrieveContext|formatContext` across `src/`. Expected: only `src/app/api/assistant/chat/route.ts` (rewritten in Task 7 — it will not compile until then; that is fine, Tasks 4–7 land as one push).

- [ ] **Step 7: Commit**

```bash
git add src/lib/ai/retrieve.ts src/lib/ai/past-chat-summary.ts src/lib/ai/past-chat-summary.test.ts
git commit -m "feat: retrieval split - summary-aware past-chat memory + callable KB search"
```

(Type-check is temporarily red at this commit because `chat/route.ts` still imports the old names — noted in the message if you prefer: append `[wip: chat route rewired in follow-up commit]`.)

---

### Task 5: Tool schemas — definitions, status keys, validators (pure + standalone test)

**Files:**
- Create: `src/lib/ai/tool-schemas.ts` (pure — no Supabase/Next imports; SDK **type-only** import)
- Test: `src/lib/ai/tool-schemas.test.ts`

**Interfaces:**
- Produces:
  - `MAX_TOOL_ROUNDS = 8`
  - `TOOL_STATUS_KEYS: Record<string, string>` — tool name → SSE status key (`search_knowledge→'kb'`, `get_schedule→'schedule'`, `find_jobs→'jobs'`, `get_job→'job'`, `get_team_workload→'workload'`, `check_clashes→'clashes'`)
  - `TOOL_DEFINITIONS: Anthropic.Messages.Tool[]` — the six client tools
  - `isIsoDate(s: unknown): s is string` — strict `YYYY-MM-DD` + real-calendar-date check
  - `validateRange(start: string, end: string): string | null` — returns an error string (`end before start`, `range longer than 62 days`) or null when fine

- [ ] **Step 1: Write the failing test**

```ts
/**
 * Standalone test for the assistant tool schemas + validators.
 * Run: npx tsx src/lib/ai/tool-schemas.test.ts
 * Exits 1 on any failure.
 */

import { TOOL_DEFINITIONS, TOOL_STATUS_KEYS, MAX_TOOL_ROUNDS, isIsoDate, validateRange } from './tool-schemas'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) { console.log(`  ✓ ${name}`) }
  else { console.error(`  ✗ ${name}\n      expected: ${JSON.stringify(expected)}\n      actual:   ${JSON.stringify(actual)}`); failures++ }
}

// 1. Every tool has a status key and vice versa (web_search is server-side, keyed separately)
const names = TOOL_DEFINITIONS.map(t => t.name).sort()
check('six tools defined', names, ['check_clashes', 'find_jobs', 'get_job', 'get_schedule', 'get_team_workload', 'search_knowledge'])
for (const n of names) check(`status key for ${n}`, typeof TOOL_STATUS_KEYS[n], 'string')
check('web_search status key', TOOL_STATUS_KEYS['web_search'], 'searching')

// 2. Round cap per spec
check('cap is 8', MAX_TOOL_ROUNDS, 8)

// 3. Date validation
check('valid date', isIsoDate('2026-08-28'), true)
check('rejects DD-MM', isIsoDate('28-08-2026'), false)
check('rejects impossible date', isIsoDate('2026-02-30'), false)
check('rejects non-string', isIsoDate(20260828), false)
check('rejects datetime', isIsoDate('2026-08-28T00:00:00Z'), false)

// 4. Range validation
check('good range', validateRange('2026-08-25', '2026-08-31'), null)
check('same-day range', validateRange('2026-08-25', '2026-08-25'), null)
check('end before start', typeof validateRange('2026-08-31', '2026-08-25'), 'string')
check('over 62 days', typeof validateRange('2026-01-01', '2026-06-01'), 'string')

// 5. Every input_schema declares its required fields
for (const t of TOOL_DEFINITIONS) {
  const schema = t.input_schema as { required?: string[] }
  check(`${t.name} has required[]`, Array.isArray(schema.required), true)
}

if (failures > 0) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nAll tool-schema checks passed')
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx src/lib/ai/tool-schemas.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `tool-schemas.ts`**

```ts
import type Anthropic from '@anthropic-ai/sdk'

// Pure module — no Supabase/Next imports, so the standalone test can run it
// under plain tsx. The executors that hit the DB live in tool-runner.ts.

/** Tool-execution rounds per question (spec). On the last round the model is
 *  told to answer with what it has and tool_choice is forced to none. */
export const MAX_TOOL_ROUNDS = 8

/** Tool name → SSE status key. The client maps keys to i18n labels and falls
 *  back to "Thinking…" for unknown keys, so adding tools later is safe. */
export const TOOL_STATUS_KEYS: Record<string, string> = {
  web_search:        'searching',
  search_knowledge:  'kb',
  get_schedule:      'schedule',
  find_jobs:         'jobs',
  get_job:           'job',
  get_team_workload: 'workload',
  check_clashes:     'clashes',
}

export function isIsoDate(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(s + 'T00:00:00Z')
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

export function validateRange(start: string, end: string): string | null {
  if (end < start) return 'end_date is before start_date'
  const days = (Date.parse(end + 'T00:00:00Z') - Date.parse(start + 'T00:00:00Z')) / 86_400_000
  if (days > 62) return 'date range is longer than 62 days — narrow it'
  return null
}

export const TOOL_DEFINITIONS: Anthropic.Messages.Tool[] = [
  {
    name: 'search_knowledge',
    description: 'Search the company knowledge base (SOPs, supplier pricelists, client notes, procedures, contacts). Results are filtered to what the asking user may see. If a search misses, retry once or twice with different wording before giving up.',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'What to look for, in plain words' } },
      required: ['query'],
    },
  },
  {
    name: 'get_schedule',
    description: 'List jobs between two dates (inclusive), newest-first within a day. Shows only what the asking user is allowed to see — an installer sees only jobs formally assigned to them. Max range 62 days.',
    input_schema: {
      type: 'object',
      properties: {
        start_date: { type: 'string', description: 'YYYY-MM-DD' },
        end_date:   { type: 'string', description: 'YYYY-MM-DD' },
        status:     { type: 'string', enum: ['scheduled', 'pending', 'completed'], description: 'Optional status filter; omit for all' },
      },
      required: ['start_date', 'end_date'],
    },
  },
  {
    name: 'find_jobs',
    description: 'Search jobs by free text against project title, client company and location. Returns up to 10 matches, newest first. Use get_job with a returned id for full details.',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Title, client or location text' } },
      required: ['query'],
    },
  },
  {
    name: 'get_job',
    description: "One job's full details: status, dates/times, client, location, description, notes, production fields, team (installers, suggestions marked, sub-installers marked) and task list. Money figures are never included.",
    input_schema: {
      type: 'object',
      properties: { job_id: { type: 'string', description: 'Job id (uuid) from get_schedule or find_jobs' } },
      required: ['job_id'],
    },
  },
  {
    name: 'get_team_workload',
    description: "Every installer's bookings between two dates (inclusive) — who is on which job when, and who has nothing on. Use for questions like 'who is free on Friday?'. Max range 62 days.",
    input_schema: {
      type: 'object',
      properties: {
        start_date: { type: 'string', description: 'YYYY-MM-DD' },
        end_date:   { type: 'string', description: 'YYYY-MM-DD' },
      },
      required: ['start_date', 'end_date'],
    },
  },
  {
    name: 'check_clashes',
    description: 'Check whether an installer already has bookings overlapping a proposed date and time window. Give the installer by name. Omit times to check the whole day. A job with no start time is a whole-day booking and overlaps everything that day.',
    input_schema: {
      type: 'object',
      properties: {
        installer_name: { type: 'string', description: "Installer's name (or part of it)" },
        date:           { type: 'string', description: 'YYYY-MM-DD' },
        time_start:     { type: 'string', description: 'HH:MM 24h, optional' },
        time_end:       { type: 'string', description: 'HH:MM 24h, optional' },
      },
      required: ['installer_name', 'date'],
    },
  },
]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx src/lib/ai/tool-schemas.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/tool-schemas.ts src/lib/ai/tool-schemas.test.ts
git commit -m "feat: assistant tool schemas, status keys and validators (with standalone tests)"
```

---

### Task 6: Tool executors — user-scoped queries + dispatcher

**Files:**
- Create: `src/lib/supabase/queries/assistant-tools.ts` (the DB lookups)
- Create: `src/lib/ai/tool-runner.ts` (dispatch + validation + JSON results)

**Interfaces:**
- Consumes: `isIsoDate`, `validateRange` (Task 5); `searchKnowledge` (Task 4); `timesOverlap` from `@/lib/utils/clash-detection`.
- Produces: `executeTool(name: string, input: unknown): Promise<{ content: string; isError: boolean }>` from `tool-runner.ts` — never throws; content is a JSON string (or plain error text with `isError: true`). Query functions below.

- [ ] **Step 1: Implement `queries/assistant-tools.ts`**

All queries use the **user-scoped** `createClient` from `@/lib/supabase/server` — RLS is the privacy mechanism (spec hard rule #2). Follow-up user queries for POC names (never embed `users` on `jobs`).

```ts
import { createClient } from '@/lib/supabase/server'
import { timesOverlap } from '@/lib/utils/clash-detection'

// Read-only lookups behind the assistant's tools (Phase 2). Every function
// runs on the user-scoped client so RLS filters what the asker may see —
// an installer's assistant sees only their formally assigned jobs.

export type ToolJob = {
  id:            string
  status:        string
  date:          string
  date_end:      string | null
  time_start:    string | null
  time_end:      string | null
  project_title: string | null
  client:        string
  location:      string
  punctuality:   string
  installers:    string[]
  sales_poc:     string | null
}

type JobRow = {
  id: string; status: string; date: string; date_end: string | null
  time_start: string | null; time_end: string | null
  project_title: string | null; client: string; location: string
  punctuality: string; sales_poc_id: string | null
  job_assignees: Array<{ is_suggestion: boolean; is_sub_installer: boolean; users: { name: string } | null }>
}

const JOB_SELECT = `
  id, status, date, date_end, time_start, time_end,
  project_title, client, location, punctuality, sales_poc_id,
  job_assignees ( is_suggestion, is_sub_installer, users ( name ) )
`

async function toToolJobs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: JobRow[],
): Promise<ToolJob[]> {
  // Sales POC names via follow-up query — never embed users on jobs (standing rule).
  const pocIds = [...new Set(rows.map(r => r.sales_poc_id).filter(Boolean))] as string[]
  const names  = new Map<string, string>()
  if (pocIds.length > 0) {
    const { data } = await supabase.from('users').select('id, name').in('id', pocIds)
    for (const u of (data ?? []) as Array<{ id: string; name: string }>) names.set(u.id, u.name)
  }
  return rows.map(r => ({
    id: r.id, status: r.status, date: r.date, date_end: r.date_end,
    time_start: r.time_start, time_end: r.time_end,
    project_title: r.project_title, client: r.client, location: r.location,
    punctuality: r.punctuality,
    // Formal, non-sub assignees only — suggestions are invisible on the
    // schedule (same semantics as the Schedule tab's list).
    installers: r.job_assignees.filter(a => !a.is_suggestion && !a.is_sub_installer).map(a => a.users?.name ?? '').filter(Boolean),
    sales_poc:  r.sales_poc_id ? (names.get(r.sales_poc_id) ?? null) : null,
  }))
}

export async function getScheduleRange(
  startDate: string, endDate: string, status?: 'scheduled' | 'pending' | 'completed',
): Promise<{ jobs: ToolJob[]; truncated: boolean }> {
  const supabase = await createClient()
  let q = supabase.from('jobs').select(JOB_SELECT)
    .gte('date', startDate).lte('date', endDate)
    .order('date', { ascending: true })
    .order('time_start', { ascending: true, nullsFirst: false })
    .limit(101)
  // 'pending' includes the legacy awaiting_approval status (same mapping as the app's Pending tab)
  if (status === 'pending') q = q.in('status', ['pending', 'awaiting_approval'])
  else if (status)          q = q.eq('status', status)
  const { data, error } = await q
  if (error) throw error
  const rows = (data ?? []) as unknown as JobRow[]
  return { jobs: await toToolJobs(supabase, rows.slice(0, 100)), truncated: rows.length > 100 }
}

export async function findJobs(query: string): Promise<ToolJob[]> {
  const supabase = await createClient()
  // Strip characters that break PostgREST .or() filter syntax
  const safe = query.replace(/[,%().]/g, ' ').trim()
  if (!safe) return []
  const pat = `%${safe}%`
  const { data, error } = await supabase.from('jobs').select(JOB_SELECT)
    .or(`project_title.ilike.${pat},client.ilike.${pat},location.ilike.${pat}`)
    .order('date', { ascending: false })
    .limit(10)
  if (error) throw error
  return toToolJobs(supabase, (data ?? []) as unknown as JobRow[])
}

export type ToolJobDetail = ToolJob & {
  description:             string | null
  notes:                   string | null
  production_instructions: string | null
  production_ready:        boolean
  do_issued:               boolean
  client_poc_name:         string | null
  client_poc_phone:        string | null
  team:  Array<{ name: string; suggestion: boolean; supporting: boolean }>
  tasks: Array<{ text: string; done: boolean }>
}

export async function getJobSnapshot(jobId: string): Promise<ToolJobDetail | null> {
  const supabase = await createClient()
  // No job_financials — money figures never reach the assistant (spec).
  const { data, error } = await supabase.from('jobs').select(`
      id, status, date, date_end, time_start, time_end,
      project_title, client, location, punctuality, sales_poc_id,
      description, notes, production_instructions, production_ready, do_issued,
      client_poc_name, client_poc_phone,
      job_assignees ( is_suggestion, is_sub_installer, users ( name ) ),
      job_tasks ( text, is_completed, sort_order )
    `)
    .eq('id', jobId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  type DetailRow = JobRow & {
    description: string | null; notes: string | null
    production_instructions: string | null; production_ready: boolean; do_issued: boolean
    client_poc_name: string | null; client_poc_phone: string | null
    job_tasks: Array<{ text: string; is_completed: boolean; sort_order: number }>
  }
  const row    = data as unknown as DetailRow
  const [base] = await toToolJobs(supabase, [row])
  return {
    ...base,
    description:             row.description,
    notes:                   row.notes,
    production_instructions: row.production_instructions,
    production_ready:        row.production_ready,
    do_issued:               row.do_issued,
    client_poc_name:         row.client_poc_name,
    client_poc_phone:        row.client_poc_phone,
    team: row.job_assignees.filter(a => a.users).map(a => ({
      name: a.users!.name, suggestion: a.is_suggestion, supporting: a.is_sub_installer,
    })),
    tasks: [...row.job_tasks].sort((a, b) => a.sort_order - b.sort_order)
      .map(t => ({ text: t.text, done: t.is_completed })),
  }
}

export type InstallerWorkload = {
  name: string
  jobs: Array<{ date: string; time_start: string | null; time_end: string | null; client: string; project_title: string | null }>
}

export async function getTeamWorkload(startDate: string, endDate: string): Promise<InstallerWorkload[]> {
  const supabase = await createClient()
  const [{ data: installers }, { data: jobs, error }] = await Promise.all([
    supabase.from('users').select('id, name').eq('role', 'installer').is('deleted_at', null),
    supabase.from('jobs')
      .select('id, date, time_start, time_end, client, project_title, job_assignees ( user_id, is_suggestion, is_sub_installer )')
      .eq('status', 'scheduled')
      .gte('date', startDate).lte('date', endDate),
  ])
  if (error) throw error
  type WRow = {
    id: string; date: string; time_start: string | null; time_end: string | null
    client: string; project_title: string | null
    job_assignees: Array<{ user_id: string; is_suggestion: boolean; is_sub_installer: boolean }>
  }
  const byInstaller = new Map<string, InstallerWorkload>()
  for (const u of (installers ?? []) as Array<{ id: string; name: string }>) {
    byInstaller.set(u.id, { name: u.name, jobs: [] })
  }
  for (const j of ((jobs ?? []) as unknown as WRow[])) {
    for (const a of j.job_assignees) {
      if (a.is_suggestion || a.is_sub_installer) continue  // formal main bookings only
      byInstaller.get(a.user_id)?.jobs.push({
        date: j.date, time_start: j.time_start, time_end: j.time_end,
        client: j.client, project_title: j.project_title,
      })
    }
  }
  return [...byInstaller.values()].map(w => ({
    ...w, jobs: w.jobs.sort((a, b) => a.date.localeCompare(b.date) || (a.time_start ?? '').localeCompare(b.time_start ?? '')),
  }))
}

export type ClashCheck =
  | { error: string }
  | { candidates: string[] }
  | {
      installer: string
      overlaps: Array<{
        job_id: string; project_title: string | null; client: string
        time_start: string | null; time_end: string | null
        punctuality: string; suggestion_only: boolean
      }>
    }

export async function checkInstallerClashes(
  installerName: string, date: string, timeStart: string | null, timeEnd: string | null,
): Promise<ClashCheck> {
  const supabase = await createClient()
  const safe = installerName.replace(/[,%().]/g, ' ').trim()
  if (!safe) return { error: 'installer_name is empty' }
  const { data: matches } = await supabase.from('users')
    .select('id, name').eq('role', 'installer').is('deleted_at', null)
    .ilike('name', `%${safe}%`)
  const people = (matches ?? []) as Array<{ id: string; name: string }>
  if (people.length === 0) return { error: `No installer matching "${installerName}" found` }
  const exact = people.find(p => p.name.toLowerCase() === safe.toLowerCase())
  if (people.length > 1 && !exact) return { candidates: people.map(p => p.name) }
  const person = exact ?? people[0]

  const { data: jobs, error } = await supabase.from('jobs')
    .select('id, project_title, client, time_start, time_end, punctuality, job_assignees ( user_id, is_suggestion, is_sub_installer )')
    .eq('status', 'scheduled').eq('date', date)
  if (error) throw error
  type CRow = {
    id: string; project_title: string | null; client: string
    time_start: string | null; time_end: string | null; punctuality: string
    job_assignees: Array<{ user_id: string; is_suggestion: boolean; is_sub_installer: boolean }>
  }
  const overlaps = ((jobs ?? []) as unknown as CRow[])
    .map(j => ({ j, a: j.job_assignees.find(a => a.user_id === person.id && !a.is_sub_installer) }))
    .filter((x): x is { j: CRow; a: { user_id: string; is_suggestion: boolean; is_sub_installer: boolean } } => !!x.a)
    // Same overlap semantics as the push-time clash check (whole-day floaters overlap everything)
    .filter(({ j }) => timesOverlap(timeStart, timeEnd, j.time_start, j.time_end))
    .map(({ j, a }) => ({
      job_id: j.id, project_title: j.project_title, client: j.client,
      time_start: j.time_start, time_end: j.time_end,
      punctuality: j.punctuality, suggestion_only: a.is_suggestion,
    }))
  return { installer: person.name, overlaps }
}
```

- [ ] **Step 2: Implement `src/lib/ai/tool-runner.ts`**

```ts
import { searchKnowledge } from './retrieve'
import { isIsoDate, validateRange } from './tool-schemas'
import {
  getScheduleRange, findJobs, getJobSnapshot, getTeamWorkload, checkInstallerClashes,
} from '@/lib/supabase/queries/assistant-tools'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/

export interface ToolOutcome { content: string; isError: boolean }

const ok  = (data: unknown): ToolOutcome => ({ content: JSON.stringify(data), isError: false })
const bad = (msg: string):   ToolOutcome => ({ content: msg, isError: true })

/** Execute one client-tool call. Never throws — failures come back as
 *  is_error tool_results so the model can recover (spec). */
export async function executeTool(name: string, input: unknown): Promise<ToolOutcome> {
  const args = (input ?? {}) as Record<string, unknown>
  try {
    switch (name) {
      case 'search_knowledge': {
        const query = typeof args.query === 'string' ? args.query.trim() : ''
        if (!query) return bad('query is required')
        const hits = await searchKnowledge(query)
        if (hits.length === 0) return ok({ results: [], note: 'No knowledge-base match — try different wording, or say you could not find it.' })
        return ok({ results: hits.map(h => ({ source: h.source_path, content: h.content })) })
      }
      case 'get_schedule': {
        if (!isIsoDate(args.start_date) || !isIsoDate(args.end_date)) return bad('start_date and end_date must be YYYY-MM-DD')
        const rangeErr = validateRange(args.start_date, args.end_date)
        if (rangeErr) return bad(rangeErr)
        const status = args.status
        if (status !== undefined && status !== 'scheduled' && status !== 'pending' && status !== 'completed') {
          return bad('status must be scheduled, pending or completed')
        }
        return ok(await getScheduleRange(args.start_date, args.end_date, status))
      }
      case 'find_jobs': {
        const query = typeof args.query === 'string' ? args.query.trim() : ''
        if (!query) return bad('query is required')
        return ok({ jobs: await findJobs(query) })
      }
      case 'get_job': {
        if (typeof args.job_id !== 'string' || !UUID_RE.test(args.job_id)) return bad('job_id must be a job uuid from get_schedule or find_jobs')
        const job = await getJobSnapshot(args.job_id)
        if (!job) return ok({ found: false, note: 'No such job, or the asking user is not allowed to see it.' })
        return ok({ found: true, job })
      }
      case 'get_team_workload': {
        if (!isIsoDate(args.start_date) || !isIsoDate(args.end_date)) return bad('start_date and end_date must be YYYY-MM-DD')
        const rangeErr = validateRange(args.start_date, args.end_date)
        if (rangeErr) return bad(rangeErr)
        return ok({ installers: await getTeamWorkload(args.start_date, args.end_date) })
      }
      case 'check_clashes': {
        const nameArg = typeof args.installer_name === 'string' ? args.installer_name : ''
        if (!nameArg.trim()) return bad('installer_name is required')
        if (!isIsoDate(args.date)) return bad('date must be YYYY-MM-DD')
        const ts = typeof args.time_start === 'string' && HHMM_RE.test(args.time_start) ? args.time_start : null
        const te = typeof args.time_end   === 'string' && HHMM_RE.test(args.time_end)   ? args.time_end   : null
        return ok(await checkInstallerClashes(nameArg, args.date, ts, te))
      }
      default:
        return bad(`Unknown tool: ${name}`)
    }
  } catch (err) {
    return bad(`Tool failed: ${err instanceof Error ? err.message : 'unknown error'}`)
  }
}
```

- [ ] **Step 3: Type-check**

Run: `npm run type-check`
Expected: the only remaining errors are in `chat/route.ts` (old `retrieveContext` import — rewritten next task). No errors in the new files.

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabase/queries/assistant-tools.ts src/lib/ai/tool-runner.ts
git commit -m "feat: assistant tool executors - user-scoped RLS lookups + dispatcher"
```

---

### Task 7: Chat route — the agentic tool-use loop + system prompt update

**Files:**
- Modify: `src/app/api/assistant/chat/route.ts` (full rewrite of the streaming section)

**Interfaces:**
- Consumes: `TOOL_DEFINITIONS`, `TOOL_STATUS_KEYS`, `MAX_TOOL_ROUNDS` (Task 5); `executeTool` (Task 6); `retrievePastChats`, `formatPastChats` (Task 4).
- Produces: same SSE vocabulary as Phase 1 (`text`/`status`/`sources`/`done`/`error`) with **new status keys** (`kb`, `schedule`, `jobs`, `job`, `workload`, `clashes`) — clients must not break on unknown keys (Task 8 handles labels). One `logApiUsage` row per question summing all loop rounds.

- [ ] **Step 1: Update `SYSTEM_PREFIX`**

Keep everything except the capability bullets. In the "What you can and cannot do:" block, replace this bullet:

> `- You do NOT have live access to the schedule, jobs, or team database. ...`

with:

```
- You have live, read-only access to the schedule, jobs, team workload and clash checks through your tools. Look things up instead of guessing — never answer a live-schedule question from memory or from retrieved documents alone.
```

and replace the first bullet (`- You may be given retrieved company knowledge and relevant past conversations...`) with:

```
- You may be given relevant past conversations with this user in a later system section — use them for continuity and preferences.
```

Then add a new frozen section between "What you can and cannot do" and the glossary:

```
Using your tools:
- search_knowledge searches the company knowledge base (SOPs, supplier pricelists, client notes, procedures, contacts). Search it before answering company-specific questions; if the first search misses, retry once or twice with different wording, then say plainly what you could not find. Mention which note a fact came from when that helps.
- get_schedule lists jobs in a date range; find_jobs searches jobs by name; get_job fetches one job's details, team and task list; get_team_workload shows every installer's bookings over a range; check_clashes tests whether an installer is free at a proposed date and time.
- Every lookup runs under the asking user's own permissions. If a tool returns nothing, the user may simply not be allowed to see it — say you found nothing they can access, and never speculate about data you cannot see.
- You have a limited number of tool calls per question. Be purposeful: fetch what you need, then answer. Independent lookups can be requested together in one turn.
- Job money figures (quotes, supplier costs, margins) are not available to you. Point those questions to the Financials card on the job's own page.
```

The prefix stays static (nothing volatile added) and grows — well above the ~1024-token cache floor.

- [ ] **Step 2: Rewrite the route body**

Replace the imports of `retrieveContext, formatContext` and the streaming section. Full new file below (unchanged parts — `RATE`, D-Promote early return, profile/auth — abbreviated with `/* unchanged */` markers **only in this plan**; the real file keeps them verbatim):

```ts
import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { retrievePastChats, formatPastChats } from '@/lib/ai/retrieve'
import { executeTool } from '@/lib/ai/tool-runner'
import { TOOL_DEFINITIONS, TOOL_STATUS_KEYS, MAX_TOOL_ROUNDS } from '@/lib/ai/tool-schemas'
import { logApiUsage } from '@/lib/supabase/queries/admin'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

/* RATE — unchanged from Phase 1 */
/* SYSTEM_PREFIX — updated per Step 1 */

// All tools sent on every request. Tool definitions sit before the system
// blocks in the prompt, so they are part of the cached prefix — keep them
// byte-stable (they are module constants).
const ALL_TOOLS: Anthropic.Messages.ToolUnion[] = [
  ...TOOL_DEFINITIONS,
  { type: 'web_search_20260209', name: 'web_search' },
]

export async function POST(req: NextRequest) {
  /* auth + profile + ip/userAgent + body parse + D-Promote early return — unchanged */

  // Automatic per-user memory (the KB lookup moved into the search_knowledge tool)
  const pastChats    = await retrievePastChats(lastUserMsg)
  const contextBlock = formatPastChats(pastChats)

  /* today + volatileParts — unchanged (contextBlock now holds past chats only) */

  const encoder  = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      let closed = false
      const send = (data: object) => {
        if (closed) return
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)) }
        catch { closed = true }
      }

      try {
        // The agentic loop: stream → on tool_use execute → append results →
        // continue. Cap MAX_TOOL_ROUNDS executions; the final round forces a
        // text answer (tool_choice none + a budget note in the last results).
        const convo: Anthropic.MessageParam[] = [...messages]
        const sources: { url: string; title: string }[] = []
        let tokensIn = 0, tokensOut = 0, cacheWrite = 0, cacheRead = 0, searches = 0
        let forceAnswer = false

        for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
          if (req.signal.aborted) break

          const stream = anthropic.messages.stream({
            model:      'claude-sonnet-5',
            max_tokens: 8192,
            thinking:   { type: 'adaptive' },
            system: [
              { type: 'text', text: SYSTEM_PREFIX, cache_control: { type: 'ephemeral' } },
              { type: 'text', text: volatileParts.join('\n') },
            ],
            messages: convo,
            tools:    ALL_TOOLS,
            ...(forceAnswer ? { tool_choice: { type: 'none' as const } } : {}),
          }, { signal: req.signal })

          for await (const event of stream) {
            if (event.type === 'content_block_start') {
              const block = event.content_block
              if (block.type === 'thinking') {
                send({ type: 'status', key: 'thinking' })
              } else if (block.type === 'server_tool_use') {
                send({ type: 'status', key: 'searching' })
              } else if (block.type === 'tool_use') {
                send({ type: 'status', key: TOOL_STATUS_KEYS[block.name] ?? 'thinking' })
              }
            } else if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              send({ type: 'text', text: event.delta.text })
            }
          }

          const final = await stream.finalMessage()

          // Accumulate usage + web sources across rounds
          const usage = final.usage
          tokensIn   += usage.input_tokens
          tokensOut  += usage.output_tokens
          cacheWrite += usage.cache_creation_input_tokens ?? 0
          cacheRead  += usage.cache_read_input_tokens ?? 0
          searches   += usage.server_tool_use?.web_search_requests ?? 0
          for (const block of final.content) {
            if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
              for (const result of block.content) {
                if (result.type === 'web_search_result' && !sources.some(s => s.url === result.url)) {
                  sources.push({ url: result.url, title: result.title })
                }
              }
            }
          }

          if (final.stop_reason !== 'tool_use') break

          const toolUses = final.content.filter(
            (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
          )
          // Thinking blocks must ride back unmodified alongside the tool_use
          // blocks — push the response content as-is.
          convo.push({ role: 'assistant', content: final.content as Anthropic.ContentBlockParam[] })

          // Parallel tool calls execute concurrently; failures return
          // is_error tool_results, never dropped (spec).
          const results = await Promise.all(toolUses.map(async tu => {
            const r = await executeTool(tu.name, tu.input)
            return {
              type: 'tool_result' as const,
              tool_use_id: tu.id,
              content: r.content,
              ...(r.isError ? { is_error: true as const } : {}),
            }
          }))

          // tool_result blocks must LEAD the user message; the budget note
          // (cap reached) goes after them.
          const content: Anthropic.ContentBlockParam[] = [...results]
          if (round === MAX_TOOL_ROUNDS - 1) {
            forceAnswer = true
            content.push({
              type: 'text',
              text: 'Tool budget for this question is used up — answer now with the information you already have.',
            })
          }
          convo.push({ role: 'user', content })
        }

        if (sources.length > 0) send({ type: 'sources', sources })

        const cost =
          (tokensIn   / 1_000_000) * RATE.input +
          (tokensOut  / 1_000_000) * RATE.output +
          (cacheWrite / 1_000_000) * RATE.cacheWrite +
          (cacheRead  / 1_000_000) * RATE.cacheRead +
          searches * RATE.perSearch

        void logApiUsage({
          service:        'anthropic',
          endpoint:       'messages.stream',
          called_by:      profile.id,
          tokens_in:      tokensIn + cacheWrite + cacheRead,
          tokens_out:     tokensOut,
          estimated_cost: cost,
          ip_address:     ip,
          user_agent:     userAgent,
        })

        send({ type: 'done' })
      } catch (err) {
        /* abort detection + error send — unchanged from Phase 1 */
      }

      try { controller.close() } catch { /* stream already closed by the client */ }
    },
  })

  /* Response headers — unchanged */
}
```

- [ ] **Step 3: Type-check**

Run: `npm run type-check`
Expected: clean across the whole project (the Task 4 breakage is now resolved). If the SDK's `ToolUnion`/`ContentBlockParam` names differ in ^0.120, use the names the compiler suggests (`Anthropic.Messages.ToolUnion`, `Anthropic.Messages.ContentBlockParam`, `Anthropic.Messages.ToolUseBlock`) — do not `any`-cast.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/assistant/chat/route.ts
git commit -m "feat: agentic tool-use loop in the chat route (cap 8, RLS tools, KB via tool)"
```

---

### Task 8: Client status lines — new keys, shared label map, i18n

**Files:**
- Create: `src/features/assistant/statusLabels.ts`
- Modify: `src/features/assistant/AssistantShell.tsx`
- Modify: `src/components/FloatingChatPanel.tsx`
- Modify: `src/lib/i18n/en.ts`, `src/lib/i18n/zh.ts` (NOT `bn.ts` — frozen, falls back)

**Interfaces:**
- Consumes: SSE `{type:'status', key}` with keys `thinking|searching|kb|schedule|jobs|job|workload|clashes` (Task 7).
- Produces: `statusLabelKey(status: string | undefined): I18nKey` mapping unknown keys to `assistantThinking`.

- [ ] **Step 1: Add the i18n strings**

In `en.ts`, after `assistantSearching`:

```ts
  assistantSearchingKb:      'Searching the knowledge base…',
  assistantCheckingSchedule: 'Checking the schedule…',
  assistantFindingJobs:      'Finding jobs…',
  assistantLookingUpJob:     'Looking up the job…',
  assistantCheckingWorkload: 'Checking team availability…',
  assistantCheckingClashes:  'Checking for clashes…',
```

In `zh.ts`, same keys (align wording with the neighbouring assistant keys already in `zh.ts` — reuse whatever zh terms the app uses for "schedule" and "job"):

```ts
  assistantSearchingKb:      '正在搜索知识库…',
  assistantCheckingSchedule: '正在查看日程…',
  assistantFindingJobs:      '正在查找工作…',
  assistantLookingUpJob:     '正在查看工作详情…',
  assistantCheckingWorkload: '正在查看团队安排…',
  assistantCheckingClashes:  '正在检查时间冲突…',
```

Also update the desktop sub-header line in both: `assistantSubtitle` → en `'with schedule, knowledge and web search'`, zh `'支持日程、知识库与网页搜索'`.

- [ ] **Step 2: Create `statusLabels.ts`**

```ts
// SSE status key → i18n label key. Unknown keys deliberately fall back to
// "Thinking…" so the server can add tools without a client release.
const STATUS_I18N = {
  searching: 'assistantSearching',
  kb:        'assistantSearchingKb',
  schedule:  'assistantCheckingSchedule',
  jobs:      'assistantFindingJobs',
  job:       'assistantLookingUpJob',
  workload:  'assistantCheckingWorkload',
  clashes:   'assistantCheckingClashes',
} as const

type StatusLabelKey = (typeof STATUS_I18N)[keyof typeof STATUS_I18N] | 'assistantThinking'

export function statusLabelKey(status: string | undefined): StatusLabelKey {
  return (STATUS_I18N as Record<string, StatusLabelKey>)[status ?? ''] ?? 'assistantThinking'
}
```

(If `t()`'s key parameter is a narrower union type, adjust `StatusLabelKey` to satisfy it — the six new keys exist in `en.ts` so the literal types line up.)

- [ ] **Step 3: Wire both shells**

In **AssistantShell.tsx** and **FloatingChatPanel.tsx** identically:
1. `Message.status` type: `'thinking' | 'searching'` → `string`.
2. SSE handler: replace `setStatus(payload.key === 'searching' ? 'searching' : 'thinking')` (and the FloatingChatPanel equivalent) with passing the key straight through: `setStatus(payload.key)`.
3. `statusLabel` computation: replace the ternary with

```ts
  const statusLabel = t(lang, statusLabelKey(msg.status))
```

importing `statusLabelKey` from `@/features/assistant/statusLabels` (FloatingChatPanel imports the same module).

- [ ] **Step 4: Type-check**

Run: `npm run type-check`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/features/assistant/statusLabels.ts src/features/assistant/AssistantShell.tsx src/components/FloatingChatPanel.tsx src/lib/i18n/en.ts src/lib/i18n/zh.ts
git commit -m "feat: per-tool status lines in both chat surfaces (en+zh)"
```

---

### Task 9: Memory API — list / edit / forget

**Files:**
- Create: `src/app/api/assistant/memory/route.ts`

**Interfaces:**
- Consumes: `asst_chats.summary` (Task 1), `embed` from `@/lib/ai/embed`.
- Produces: `GET` → `MemoryRow[]` (`{ id, topic, summary, ts }`, own rows only via RLS, newest first); `PATCH {id, summary}` → edits + re-embeds; `DELETE {id}` → clears summary + embedding (chat stays in history). All three use the **user-scoped** client — the `asst_chats` own-select (0030) and own-update policies scope every statement to the caller (same pattern as the rename route, audit finding #4).

- [ ] **Step 1: Implement the route**

```ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { embed } from '@/lib/ai/embed'

// The Memory manager (spec Phase 2): everything the assistant remembers about
// the calling user — one row per meaningful chat's summary. All statements
// run on the RLS client, so they only ever touch the caller's own rows.

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { data, error } = await supabase
    .from('asst_chats')
    .select('id, topic, summary, ts')
    .not('summary', 'is', null)
    .order('ts', { ascending: false })
  if (error) return new Response('Fetch failed', { status: 500 })
  return Response.json(data ?? [])
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  let body: { id?: string; summary?: string }
  try { body = await req.json() } catch { return new Response('Bad request', { status: 400 }) }
  const summary = body.summary?.trim()
  if (!body.id || !summary) return new Response('Bad request', { status: 400 })

  // Topic feeds the embedding input (same shape as save time: topic + summary)
  const { data: row } = await supabase
    .from('asst_chats')
    .select('topic')
    .eq('id', body.id)
    .maybeSingle()
  if (!row) return new Response('Not found', { status: 404 })

  let embeddingStr: string | null = null
  try {
    const vec    = await embed(`${row.topic ?? ''}\n${summary}`, 'document')
    embeddingStr = `[${vec.join(',')}]`
  } catch { /* embedding optional — the corrected text still saves */ }

  const { count, error } = await supabase
    .from('asst_chats')
    .update({ summary, ...(embeddingStr ? { embedding: embeddingStr } : {}) } as never, { count: 'exact' })
    .eq('id', body.id)
  if (error) return new Response('Update failed', { status: 500 })
  if (!count) return new Response('Not found', { status: 404 })
  return Response.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  let body: { id?: string }
  try { body = await req.json() } catch { return new Response('Bad request', { status: 400 }) }
  if (!body.id) return new Response('Bad request', { status: 400 })

  // Forget = clear summary + embedding. The conversation itself stays in
  // history (deleting the chat already removes both — spec).
  const { count, error } = await supabase
    .from('asst_chats')
    .update({ summary: null, embedding: null } as never, { count: 'exact' })
    .eq('id', body.id)
  if (error) return new Response('Update failed', { status: 500 })
  if (!count) return new Response('Not found', { status: 404 })
  return Response.json({ ok: true })
}
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check` — expected clean.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/assistant/memory/route.ts
git commit -m "feat: memory manager API - list, edit (re-embed), forget"
```

---

### Task 10: Memory view UI — sidebar/drawer entry + overlay

**Files:**
- Create: `src/features/assistant/MemoryView.tsx`
- Modify: `src/features/assistant/HistorySidebar.tsx` (Memory entry + `lang` prop)
- Modify: `src/features/assistant/AssistantShell.tsx` (pass `lang` to HistorySidebar)
- Modify: `src/lib/i18n/en.ts`, `src/lib/i18n/zh.ts`

**Interfaces:**
- Consumes: the Task 9 routes.
- Produces: `MemoryView({ open, onClose, lang })` — full-screen on phone, centered card on desktop, `z-[70]` (above the drawer's `z-[60]`, hard rule). `HistorySidebar` gains a required `lang: LangCode` prop.

- [ ] **Step 1: Add i18n strings** (en / zh; no bn):

```ts
  // en.ts
  memory:              'Memory',
  memoryTitle:         'What the assistant remembers about you',
  memoryEmpty:         'Nothing remembered yet — meaningful conversations are added automatically.',
  memoryForget:        'Forget',
  memoryForgetConfirm: 'Forget this? The conversation stays in your history, but the assistant will no longer recall it.',
  memoryEditLabel:     'Edit memory',
  memorySave:          'Save',
  memoryCancel:        'Cancel',
```

```ts
  // zh.ts
  memory:              '记忆',
  memoryTitle:         '助手对你的记忆',
  memoryEmpty:         '还没有记忆 — 有价值的对话会自动加入。',
  memoryForget:        '忘记',
  memoryForgetConfirm: '要忘记这条记忆吗？对话仍会保留在历史中，但助手将不再记起它。',
  memoryEditLabel:     '编辑记忆',
  memorySave:          '保存',
  memoryCancel:        '取消',
```

- [ ] **Step 2: Implement `MemoryView.tsx`**

```tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Pencil, Trash2 } from 'lucide-react'
import { t } from '@/lib/i18n'
import type { LangCode } from '@/lib/i18n'

export interface MemoryRow {
  id:      string
  topic:   string | null
  summary: string
  ts:      string
}

interface Props {
  open:    boolean
  onClose: () => void
  lang:    LangCode
}

// Static English date parts — dates are always English (hard rule) and
// locale calls caused the /schedule hydration bug.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function fmtDate(ts: string): string {
  const d = new Date(ts)
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

export function MemoryView({ open, onClose, lang }: Props) {
  const [rows,      setRows]      = useState<MemoryRow[]>([])
  const [loading,   setLoading]   = useState(true)
  const [editId,    setEditId]    = useState<string | null>(null)
  const [editText,  setEditText]  = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [saving,    setSaving]    = useState(false)

  const fetchRows = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/assistant/memory')
      if (res.ok) setRows(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) { setEditId(null); setConfirmId(null); fetchRows() }
  }, [open, fetchRows])

  async function saveEdit() {
    const id = editId
    const summary = editText.trim()
    if (!id || !summary || saving) return
    setSaving(true)
    const res = await fetch('/api/assistant/memory', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id, summary }),
    })
    setSaving(false)
    if (res.ok) {
      setRows(prev => prev.map(r => r.id === id ? { ...r, summary } : r))
      setEditId(null)
    }
  }

  async function forget(id: string) {
    setConfirmId(null)
    setRows(prev => prev.filter(r => r.id !== id))
    const res = await fetch('/api/assistant/memory', {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id }),
    })
    if (!res.ok) fetchRows()
  }

  if (!open) return null

  return (
    // z-[70]: above the phone drawer (z-[60]) and BottomNav (hard rule)
    <div className="fixed inset-0 z-[70] flex md:items-center md:justify-center">
      <div onClick={onClose} className="absolute inset-0 bg-ink/40" />
      <div className="relative bg-paper w-full h-full md:h-auto md:max-h-[80vh] md:w-[560px] md:rounded-2xl md:border md:border-line flex flex-col overflow-hidden">

        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-line">
          <div>
            <p className="font-display text-base font-medium text-ink">{t(lang, 'memory')}</p>
            <p className="text-xs text-muted mt-0.5">{t(lang, 'memoryTitle')}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-ink2 hover:text-ink hover:bg-bg transition-colors"
            aria-label={t(lang, 'memoryCancel')}
          >
            <X size={16} />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {loading ? (
            <div className="space-y-4 animate-pulse py-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="h-3 w-1/3 rounded bg-line/80" />
                  <div className="h-3 w-full rounded bg-line/60" />
                </div>
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="py-8 text-sm text-muted text-center">{t(lang, 'memoryEmpty')}</p>
          ) : (
            <ul className="divide-y divide-line">
              {rows.map(row => (
                <li key={row.id} className="py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-display text-sm font-medium text-ink truncate">
                        {row.topic ?? 'Untitled'}
                      </p>
                      <p className="text-[11px] text-muted mt-0.5">{fmtDate(row.ts)}</p>
                    </div>
                    {editId !== row.id && confirmId !== row.id && (
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => { setEditId(row.id); setEditText(row.summary); setConfirmId(null) }}
                          className="p-1.5 rounded-lg text-ink2 hover:text-ink hover:bg-bg transition-colors"
                          aria-label={t(lang, 'memoryEditLabel')}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => { setConfirmId(row.id); setEditId(null) }}
                          className="p-1.5 rounded-lg text-ink2 hover:text-terracotta hover:bg-bg transition-colors"
                          aria-label={t(lang, 'memoryForget')}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>

                  {editId === row.id ? (
                    <div className="mt-2">
                      <textarea
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        rows={3}
                        autoFocus
                        className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-terracotta/40 focus:border-terracotta/60"
                      />
                      <div className="flex gap-2 justify-end mt-2">
                        <button
                          onClick={() => setEditId(null)}
                          className="px-3 py-1.5 rounded-xl border border-line text-ink2 text-xs font-medium hover:border-ink2 transition-colors"
                        >
                          {t(lang, 'memoryCancel')}
                        </button>
                        <button
                          onClick={saveEdit}
                          disabled={!editText.trim() || saving}
                          className="px-3 py-1.5 rounded-xl bg-terracotta text-white text-xs font-medium hover:bg-terracotta/90 disabled:opacity-50 transition-colors"
                        >
                          {t(lang, 'memorySave')}
                        </button>
                      </div>
                    </div>
                  ) : confirmId === row.id ? (
                    <div className="mt-2 rounded-xl border border-line bg-bg px-3 py-2.5">
                      <p className="text-xs text-ink2">{t(lang, 'memoryForgetConfirm')}</p>
                      <div className="flex gap-2 justify-end mt-2">
                        <button
                          onClick={() => setConfirmId(null)}
                          className="px-3 py-1.5 rounded-xl border border-line text-ink2 text-xs font-medium hover:border-ink2 transition-colors"
                        >
                          {t(lang, 'memoryCancel')}
                        </button>
                        <button
                          onClick={() => forget(row.id)}
                          className="px-3 py-1.5 rounded-xl bg-terracotta text-white text-xs font-medium hover:bg-terracotta/90 transition-colors"
                        >
                          {t(lang, 'memoryForget')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-1.5 text-sm text-ink2 leading-relaxed">{row.summary}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Wire the entry points in `HistorySidebar.tsx`**

1. Props: add `lang: LangCode` (import the type from `@/lib/i18n`); import `Brain` from `lucide-react`, `t` from `@/lib/i18n`, and `MemoryView` from `./MemoryView`.
2. State: `const [memoryOpen, setMemoryOpen] = useState(false)`.
3. Below `newChatButton`, define:

```tsx
  const memoryButton = (
    <button
      onClick={() => { setMemoryOpen(true); onDrawerClose?.() }}
      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-ink2 hover:bg-bg text-sm font-medium transition-colors"
    >
      <span className="w-6 h-6 rounded-full border border-line flex items-center justify-center">
        <Brain size={13} />
      </span>
      {t(lang, 'memory')}
    </button>
  )
```

4. Render `{memoryButton}` directly under `{newChatButton}` in BOTH the desktop sidebar block and the phone drawer block.
5. At the end of the fragment (next to the modals): `<MemoryView open={memoryOpen} onClose={() => setMemoryOpen(false)} lang={lang} />`.
6. In `AssistantShell.tsx`, pass `lang={lang}` to `<HistorySidebar …>`.

- [ ] **Step 4: Type-check + build**

Run: `npm run type-check` then `npm run build`
Expected: both green.

- [ ] **Step 5: Commit**

```bash
git add src/features/assistant/MemoryView.tsx src/features/assistant/HistorySidebar.tsx src/features/assistant/AssistantShell.tsx src/lib/i18n/en.ts src/lib/i18n/zh.ts
git commit -m "feat: Memory manager view - list, edit and forget memories from sidebar/drawer"
```

---

### Task 11: Verification, deploy gate, smoke checklist

**Files:** none new (verification + push).

- [ ] **Step 1: Run every standalone test**

```bash
npx tsx src/lib/ai/tagger.test.ts
npx tsx src/lib/ai/past-chat-summary.test.ts
npx tsx src/lib/ai/tool-schemas.test.ts
npx tsx src/lib/storage/job-file-permissions.test.ts
npx tsx src/lib/telegram/link-token.test.ts
npx tsx scripts/lib/frontmatter.test.ts
npx tsx scripts/lib/chunk.test.ts
```
Expected: all pass (the last four prove no regressions in untouched modules).

- [ ] **Step 2: Full type-check + production build**

```bash
npm run type-check
npm run build
```
Expected: both green.

- [ ] **Step 3: HARD GATE — confirm migration 0046 is applied**

Confirm with Nic that the Task 1 `npx supabase db push` was run. **Do not push otherwise** — the Vercel preview shares the production DB and will crash selecting `asst_chats.summary` (42703, the feat-files lesson).

- [ ] **Step 4: Push to dev (ask Nic first — standing rule: always ask before pushing)**

```bash
git push origin dev
```

- [ ] **Step 5: Hand Nic the preview smoke checklist** (plain language):

1. **Schedule questions** (your own login): "What's on the schedule this week?", "Who's free on Friday?", "Would [installer] clash on Friday 2–6pm?" — answers should match the Schedule tab/FCFS board, with the new status lines ("Checking the schedule…") flashing while it looks things up.
2. **Job lookup**: ask about a job by name — it should find it and read back the details, team and task list. Money figures must never appear.
3. **Knowledge base**: ask a supplier-pricing question that used to need exact wording — it should now find it (the assistant retries searches itself).
4. **Real installer login**: ask about a job they are NOT assigned to — the assistant must find nothing and say so. (Preview-as doesn't count — RLS needs a real login.)
5. **Two accounts**: things account A discussed must never surface in account B's answers or Memory view.
6. **Memory**: have a meaningful chat (e.g. state a preference) → it appears in Memory (sidebar → Memory) with a 2–3 sentence summary; a throwaway "hello" chat must NOT appear. Edit a summary, start a new chat, ask about that topic — it recalls the edited version. Forget one — it stops being recalled but stays in chat history.
7. **Phase 1 regression**: web search still works with source chips; Stop button; smooth streaming; phone drawer; second message in a chat still logs cache-read tokens (Admin → Health).
8. **Floating bubble**: quick question via the bubble — new status lines render there too.

- [ ] **Step 6: After Nic's pass — Nic merges dev → main** (production DB already has 0046, so no crash window).

---

## Self-Review (done at planning time)

- **Spec coverage:** agentic loop w/ cap 8 + parallel calls + is_error results (Task 7); six read-only tools incl. repeatable `search_knowledge` (Tasks 5–6); pre-baked KB retrieval removed, past-chat retrieval stays automatic (Tasks 4, 7); per-tool status lines (Tasks 7–8); migration 0046 + summary embedding (topic+summary) + meaningful gate (Tasks 1–3); `match_asst_chats` returns summary + old-row fallback (Tasks 1, 4); Memory manager with edit/re-embed/forget, own-rows-only (Tasks 9–10); two-account + installer smoke tests (Task 11); db-push-before-code enforced twice (Tasks 1, 11).
- **Type consistency:** `ChatTag.summary/meaningful` (T2) consumed in T3; `pastChatSummary` (T4) matches `match_asst_chats` row shape (T1); `executeTool → ToolOutcome` (T6) consumed in T7; `TOOL_STATUS_KEYS` keys (T5) match the client label map (T8); `MemoryRow` (T9 route ↔ T10 view).
- **Known deviations, deliberate:** clash severity grading is not reproduced in `check_clashes` (the proposed booking has no punctuality — the tool reports overlaps + each job's punctuality and lets the model explain); continuing a chat regenerates its summary, overwriting a manual Memory edit (no schema flag — YAGNI, documented in code).
