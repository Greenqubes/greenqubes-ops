# Assistant Upgrade Phase 3 — Chat Attachments → Pending Job Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The assistant page composer accepts image/PDF attachments the model can read; a new `create_pending_job` tool (the ONE allowed action, confirm-first) turns them into a pending job with auto-filed buckets and a link chip; the job form gains Move-file-between-buckets; a daily cron deletes scratch attachments older than 30 days.

**Architecture:** Attachments upload via signed PUT URLs to an R2 scratch prefix `asst-chat/{userId}/…` (never `files` rows), ride on chat messages as metadata, and are converted server-side to base64 image/document blocks for the model. The existing Phase 2 agentic loop gains one write tool executed through the **user-scoped client** (RLS + an effective-role gate); file copies into the new job reuse the Duplicate route's `copyObject` pattern. Move-between-buckets is a one-column PATCH via a server route (the `files` table has SELECT+INSERT RLS only — no UPDATE policy, confirmed in migrations 0002/0019/0024).

**Tech Stack:** Next.js 15 App Router, Anthropic SDK ^1.x (`claude-sonnet-5`, adaptive thinking), Supabase (user-scoped server client), Cloudflare R2 via `@aws-sdk/client-s3`, standalone tsx tests.

**Spec:** `docs/superpowers/specs/2026-08-24-assistant-upgrade-design.md` (Phase 3 section + Guardrails)

## Global Constraints

- **No database migration in this phase** (spec; Phase 4 needs 0047).
- Tool-round cap stays **8** (`MAX_TOOL_ROUNDS`); `max_tokens` stays **8192**.
- Attachment caps (new this phase, sized under Anthropic's 32 MB request cap / 5 MB-per-image API limit): images ≤ **5 MB** each, PDF ≤ **15 MB** each, ≤ **5 files per message**, ≤ **20 MB total per message**.
- Accepted types: `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `application/pdf`. **HEIC is rejected with a clear message** — the Anthropic API does not accept HEIC and converting would need a new dependency (stack locked). *Spec deviation — flag to Nic in the session summary.*
- The floating bubble gets **no paperclip** (spec) — it only gains the job-created chip rendering.
- `create_pending_job` roles: sales / scheduler / coordinator / admin via `getEffectiveRole` (which maps a non-previewing admin to `scheduler`); other roles get a polite refusal string from the tool, never an error.
- The tool can only ever create `status: 'pending'` — no other status, no Telegram fires (matches manual pending creation).
- SYSTEM_PREFIX and `TOOL_DEFINITIONS` are the prompt-cache prefix: they may change in this build but must remain **byte-stable per deploy** — nothing volatile inside.
- Scratch files are **never** `files` rows (bucket-leak lessons); copies into a job go through `copyObject` + a `files` insert with `bucket_id` set.
- Any new overlay layers **z-[60]+** (hard rule).
- New user-facing strings in `en.ts` + `zh.ts` only (Bengali frozen). Date labels always English.
- Never embed `users` on `jobs` in a PostgREST select (standing rule — untouched here).
- Chat-route security guard: every attachment key in a request must start with `asst-chat/{profile.id}/` — keys failing the check are ignored (stops one user feeding another user's scratch keys to the model).

**Spec-wording note:** the spec says creation "reuses the New Job submit logic" — but pending-job creation has no server logic to reuse (NewJobShell inserts client-side; `/api/jobs/[id]/submit` only flips pending→scheduled). This plan creates the dedicated server path the spec intends (`assistant-create-job.ts`), mirroring NewJobShell's insert exactly (same defaults, same 4 default buckets, same visibility).

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/lib/ai/attachments.ts` | Create | Pure: caps, mime allowlist, `validateAttachment`, `isOwnScratchKey`, `attachmentNote`, `ChatAttachment` type |
| `src/lib/ai/attachments.test.ts` | Create | Standalone test (tsx) |
| `src/lib/storage/r2.ts` | Modify | Add `getScratchUploadUrl`, `getObjectBase64`, `listObjects` |
| `src/app/api/assistant/upload-url/route.ts` | Create | Signed PUT URL for scratch uploads (auth + validation) |
| `src/features/assistant/AssistantShell.tsx` | Modify | Composer attach UI, Message.attachments/jobCard, SSE `job_created`, chips |
| `src/app/api/assistant/chat/route.ts` | Modify | Attachments → base64 blocks, ownership guard, tool ctx, `job_created` SSE, SYSTEM_PREFIX rewrite |
| `src/lib/ai/tool-schemas.ts` | Modify | `create_pending_job` definition, `JOB_BUCKETS`, status key `creating` |
| `src/lib/ai/tool-schemas.test.ts` | Modify | 7-tool expectations + new tool checks |
| `src/lib/ai/tool-runner.ts` | Modify | `ToolContext` param; `create_pending_job` case (gate + validation) |
| `src/lib/supabase/queries/assistant-create-job.ts` | Create | `createPendingJobFromChat` — job + buckets + file copies on the user-scoped client |
| `src/features/assistant/statusLabels.ts` | Modify | `creating` → `assistantCreatingJob` |
| `src/components/FloatingChatPanel.tsx` | Modify | `job_created` SSE handling + chip render (no paperclip) |
| `src/lib/i18n/en.ts`, `src/lib/i18n/zh.ts` | Modify | New keys; retire `attachComingSoon` |
| `src/app/api/files/[id]/route.ts` | Modify | Add PATCH (move file between buckets) |
| `src/features/job-detail/MoveFileModal.tsx` | Create | z-[60] bucket picker modal |
| `src/features/job-detail/AttachmentBuckets.tsx` | Modify | Move control per file row + state update on move |
| `src/app/api/cron/asst-scratch-cleanup/route.ts` | Create | 30-day scratch cleanup cron |
| `vercel.json` | Modify | Cron entry |

---

### Task 1: Attachment foundations (pure module + test)

**Files:**
- Create: `src/lib/ai/attachments.ts`
- Test: `src/lib/ai/attachments.test.ts`

**Interfaces:**
- Produces: `MAX_FILES_PER_MESSAGE: number`, `MAX_IMAGE_BYTES`, `MAX_PDF_BYTES`, `MAX_MESSAGE_BYTES`, `IMAGE_MIMES: Set<string>`, `PDF_MIME: string`, `ChatAttachment { id; key; name; mime; size }`, `validateAttachment(name: string, mime: string, size: number): 'type' | 'size' | null`, `isOwnScratchKey(key: string, userId: string): boolean`, `attachmentNote(atts: readonly ChatAttachment[]): string` — consumed by Tasks 2, 3, 4, 5.

- [ ] **Step 1: Write the failing test**

```ts
/**
 * Standalone test for assistant chat attachment rules.
 * Run: npx tsx src/lib/ai/attachments.test.ts
 * Exits 1 on any failure.
 */

import {
  MAX_FILES_PER_MESSAGE, MAX_IMAGE_BYTES, MAX_PDF_BYTES, MAX_MESSAGE_BYTES,
  validateAttachment, isOwnScratchKey, attachmentNote,
} from './attachments'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) { console.log(`  ✓ ${name}`) }
  else { console.error(`  ✗ ${name}\n      expected: ${JSON.stringify(expected)}\n      actual:   ${JSON.stringify(actual)}`); failures++ }
}

// 1. Caps per the Phase 3 plan
check('5 files per message', MAX_FILES_PER_MESSAGE, 5)
check('5 MB images', MAX_IMAGE_BYTES, 5 * 1024 * 1024)
check('15 MB PDFs', MAX_PDF_BYTES, 15 * 1024 * 1024)
check('20 MB per message', MAX_MESSAGE_BYTES, 20 * 1024 * 1024)

// 2. Mime allowlist — Anthropic-supported image types + PDF only
check('jpeg ok',   validateAttachment('a.jpg',  'image/jpeg',      1000), null)
check('png ok',    validateAttachment('a.png',  'image/png',       1000), null)
check('webp ok',   validateAttachment('a.webp', 'image/webp',      1000), null)
check('gif ok',    validateAttachment('a.gif',  'image/gif',       1000), null)
check('pdf ok',    validateAttachment('a.pdf',  'application/pdf', 1000), null)
check('heic rejected', validateAttachment('a.heic', 'image/heic',  1000), 'type')
check('docx rejected', validateAttachment('a.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 1000), 'type')
check('empty mime rejected', validateAttachment('a', '', 1000), 'type')

// 3. Size caps per type
check('image at cap ok',   validateAttachment('a.jpg', 'image/jpeg', 5 * 1024 * 1024), null)
check('image over cap',    validateAttachment('a.jpg', 'image/jpeg', 5 * 1024 * 1024 + 1), 'size')
check('pdf at cap ok',     validateAttachment('a.pdf', 'application/pdf', 15 * 1024 * 1024), null)
check('pdf over cap',      validateAttachment('a.pdf', 'application/pdf', 15 * 1024 * 1024 + 1), 'size')

// 4. Scratch-key ownership guard
check('own key ok',        isOwnScratchKey('asst-chat/user-1/abc.pdf', 'user-1'), true)
check('other user blocked', isOwnScratchKey('asst-chat/user-2/abc.pdf', 'user-1'), false)
check('job key blocked',   isOwnScratchKey('jobs/folder/attachments/x.pdf', 'user-1'), false)
check('traversal blocked', isOwnScratchKey('asst-chat/user-1/../user-2/x.pdf', 'user-1'), false)
check('prefix-user trick blocked', isOwnScratchKey('asst-chat/user-12/abc.pdf', 'user-1'), false)

// 5. Attachment note — ids the model passes to create_pending_job
check('empty note', attachmentNote([]), '')
const note = attachmentNote([
  { id: 'a1', key: 'k1', name: 'permit.pdf', mime: 'application/pdf', size: 1 },
  { id: 'a2', key: 'k2', name: 'site.jpg',   mime: 'image/jpeg',      size: 1 },
])
check('note lists ids',   note.includes('a1') && note.includes('a2'), true)
check('note lists names', note.includes('permit.pdf') && note.includes('site.jpg'), true)
check('note labels types', note.includes('(pdf)') && note.includes('(image)'), true)

if (failures > 0) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nAll attachment checks passed')
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx src/lib/ai/attachments.test.ts`
Expected: FAIL — cannot find module './attachments'

- [ ] **Step 3: Write the implementation**

```ts
// Pure module — attachment rules for the assistant chat (Phase 3). No
// Supabase/Next imports so the standalone test runs under plain tsx.
// Caps are sized under the Anthropic API limits: 5 MB per image (hard API
// limit), 32 MB per request (base64 inflates ~4/3, so 20 MB of files per
// message keeps a single-message request comfortably under it).

export const MAX_FILES_PER_MESSAGE = 5
export const MAX_IMAGE_BYTES   = 5 * 1024 * 1024
export const MAX_PDF_BYTES     = 15 * 1024 * 1024
export const MAX_MESSAGE_BYTES = 20 * 1024 * 1024

export const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
export const PDF_MIME = 'application/pdf'

export interface ChatAttachment {
  id:   string   // client-generated, unique within the conversation
  key:  string   // R2 scratch key: asst-chat/{userId}/{uuid}.{ext}
  name: string
  mime: string
  size: number
}

/** null = accepted; 'type' = unsupported mime (incl. HEIC — the Anthropic API
 *  rejects it); 'size' = over the per-file cap for its type. */
export function validateAttachment(_name: string, mime: string, size: number): 'type' | 'size' | null {
  if (mime === PDF_MIME) return size > MAX_PDF_BYTES ? 'size' : null
  if (IMAGE_MIMES.has(mime)) return size > MAX_IMAGE_BYTES ? 'size' : null
  return 'type'
}

/** A request may only reference the caller's own scratch objects. */
export function isOwnScratchKey(key: string, userId: string): boolean {
  return key.startsWith(`asst-chat/${userId}/`) && !key.includes('..')
}

/** Text appended to a user message so the model can reference attachments by
 *  id when calling create_pending_job. */
export function attachmentNote(atts: readonly ChatAttachment[]): string {
  if (atts.length === 0) return ''
  const items = atts.map(a => `${a.id} = "${a.name}" (${a.mime === PDF_MIME ? 'pdf' : 'image'})`)
  return `Attached files (reference by id in create_pending_job): ${items.join(', ')}`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx src/lib/ai/attachments.test.ts`
Expected: PASS — "All attachment checks passed"

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/attachments.ts src/lib/ai/attachments.test.ts
git commit -m "feat: assistant attachment rules (caps, mime allowlist, scratch-key guard)"
```

---

### Task 2: R2 scratch helpers + upload-url route

**Files:**
- Modify: `src/lib/storage/r2.ts`
- Create: `src/app/api/assistant/upload-url/route.ts`

**Interfaces:**
- Consumes: `validateAttachment` from Task 1.
- Produces: `getScratchUploadUrl(userId, filename, contentType): Promise<{ url: string; key: string }>`, `getObjectBase64(key: string, maxBytes: number): Promise<string | null>`, `listObjects(prefix: string): Promise<{ key: string; lastModified: Date | null }[]>` — consumed by Tasks 4, 8. Route `POST /api/assistant/upload-url` body `{ filename, contentType, size }` → `{ url, key }` — consumed by Task 3.

- [ ] **Step 1: Add the three helpers to `src/lib/storage/r2.ts`**

Add `ListObjectsV2Command` to the existing `@aws-sdk/client-s3` import, then append:

```ts
// ── Assistant chat scratch files (Phase 3) ──────────────────────────────────
// Scratch objects live under asst-chat/{userId}/ — they are never `files`
// rows and never belong to a job until create_pending_job copies them.

export async function getScratchUploadUrl(
  userId: string,
  filename: string,
  contentType: string,
): Promise<{ url: string; key: string }> {
  const ext = filename.includes('.') ? filename.split('.').pop() : undefined
  const key = `asst-chat/${userId}/${randomUUID()}${ext ? `.${ext}` : ''}`
  const url = await getSignedUrl(
    r2,
    new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType }),
    { expiresIn: 300 },
  )
  void logApiUsage({ service: 'r2', endpoint: 'put', estimated_cost: 0 })
  return { url, key }
}

// Fetch an object's bytes as base64 for a model content block. Returns null
// when the object is missing (e.g. cleaned up by the 30-day scratch cron),
// empty, or larger than maxBytes — callers substitute a text note.
export async function getObjectBase64(key: string, maxBytes: number): Promise<string | null> {
  try {
    const res   = await r2.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))
    const bytes = await res.Body?.transformToByteArray()
    if (!bytes || bytes.byteLength === 0 || bytes.byteLength > maxBytes) return null
    void logApiUsage({ service: 'r2', endpoint: 'get', estimated_cost: 0 })
    return Buffer.from(bytes).toString('base64')
  } catch {
    return null
  }
}

// Full (paginated) listing under a prefix — used by the scratch-cleanup cron.
export async function listObjects(prefix: string): Promise<{ key: string; lastModified: Date | null }[]> {
  const out: { key: string; lastModified: Date | null }[] = []
  let token: string | undefined
  do {
    const res = await r2.send(new ListObjectsV2Command({
      Bucket: BUCKET, Prefix: prefix, ContinuationToken: token,
    }))
    for (const o of res.Contents ?? []) {
      if (o.Key) out.push({ key: o.Key, lastModified: o.LastModified ?? null })
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined
  } while (token)
  void logApiUsage({ service: 'r2', endpoint: 'list', estimated_cost: 0 })
  return out
}
```

- [ ] **Step 2: Create `src/app/api/assistant/upload-url/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getScratchUploadUrl } from '@/lib/storage/r2'
import { validateAttachment } from '@/lib/ai/attachments'

// Signed PUT URL for an assistant chat attachment. Objects land in the
// caller's own scratch prefix (asst-chat/{userId}/…) — never in job folders,
// never as `files` rows. Any signed-in role may attach files for questions.
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

  const body = await req.json() as { filename?: string; contentType?: string; size?: number }
  const { filename, contentType, size } = body
  if (!filename || !contentType || typeof size !== 'number') {
    return NextResponse.json({ error: 'filename, contentType and size are required' }, { status: 400 })
  }

  const problem = validateAttachment(filename, contentType, size)
  if (problem === 'type') {
    return NextResponse.json({ error: 'Only JPG, PNG, WebP, GIF images and PDF files are supported' }, { status: 400 })
  }
  if (problem === 'size') {
    return NextResponse.json({ error: 'File too large' }, { status: 400 })
  }

  const { url, key } = await getScratchUploadUrl(profile.id, filename, contentType)
  return NextResponse.json({ url, key })
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: clean (same as before the change — no new errors)

- [ ] **Step 4: Commit**

```bash
git add src/lib/storage/r2.ts src/app/api/assistant/upload-url/route.ts
git commit -m "feat: R2 scratch helpers + assistant upload-url route"
```

---

### Task 3: Composer attach UI (AssistantShell)

**Files:**
- Modify: `src/features/assistant/AssistantShell.tsx`
- Modify: `src/lib/i18n/en.ts`, `src/lib/i18n/zh.ts`

**Interfaces:**
- Consumes: Task 1 constants/validators; Task 2 upload route.
- Produces: `Message` interface gains `attachments?: ChatAttachment[]` and `jobCard?: { id: string; title: string | null }` (exported — FloatingChatPanel and the save payload reference the same shapes). Wire format to `/api/assistant/chat`: each message may carry `attachments: { id, key, name, mime, size }[]` — consumed by Task 4.

- [ ] **Step 1: i18n keys**

In `src/lib/i18n/en.ts` (AI assistant section): **delete** `attachComingSoon` and add:

```ts
  attachFiles: 'Attach files',
  attachTooMany: 'Up to 5 files per message.',
  attachTooLarge: 'File too large — images up to 5 MB, PDFs up to 15 MB.',
  attachTotalTooLarge: 'Attachments too large — up to 20 MB per message.',
  attachUnsupported: 'Only images (JPG, PNG, WebP, GIF) and PDF files can be attached.',
  attachUploadFailed: 'Upload failed — please try again.',
  assistantJobCreated: 'Pending job created',
```

In `src/lib/i18n/zh.ts`: **delete** `attachComingSoon` and add:

```ts
  attachFiles: '添加附件',
  attachTooMany: '每条消息最多 5 个文件。',
  attachTooLarge: '文件太大 — 图片最大 5 MB，PDF 最大 15 MB。',
  attachTotalTooLarge: '附件总大小超限 — 每条消息最多 20 MB。',
  attachUnsupported: '只能添加图片（JPG、PNG、WebP、GIF）或 PDF 文件。',
  attachUploadFailed: '上传失败 — 请重试。',
  assistantJobCreated: '待处理工作已创建',
```

(`bn.ts` untouched — frozen; `t()` falls back per key. If `attachComingSoon` exists in `bn.ts`, leave it — removing en/zh keys requires removing the key from the `Translations` type source, which is `en.ts`; if `bn.ts` then fails type-check on the stale key, delete it there too — that is removing a dead key, not adding a translation.)

- [ ] **Step 2: Message interface + state + upload handlers in `AssistantShell.tsx`**

Extend the exported `Message` interface:

```ts
import type { ChatAttachment } from '@/lib/ai/attachments'

export interface Message {
  id:        string
  role:      'user' | 'assistant'
  content:   string
  sources?:  { url: string; title: string }[]
  status?:   string
  streaming?: boolean
  error?:    boolean
  attachments?: ChatAttachment[]
  jobCard?:  { id: string; title: string | null }
}
```

Add imports: `Paperclip, X, ClipboardList` from `lucide-react`; `useToast` from `@/components/Toast`; `MAX_FILES_PER_MESSAGE, MAX_MESSAGE_BYTES, validateAttachment` from `@/lib/ai/attachments`.

Add state + handlers inside the component (near the dictation state):

```ts
type PendingAtt = ChatAttachment & { status: 'uploading' | 'ready' }
const [pendingAtts, setPendingAtts] = useState<PendingAtt[]>([])
const fileInputRef = useRef<HTMLInputElement>(null)
const { error: showAttachError } = useToast()

function handleFilesPicked(list: FileList | null) {
  if (!list?.length) return
  const current = pendingAtts
  let count = current.length
  let bytes = current.reduce((s, a) => s + a.size, 0)
  for (const f of [...list]) {
    if (count >= MAX_FILES_PER_MESSAGE) { showAttachError(t(lang, 'attachTooMany')); break }
    const problem = validateAttachment(f.name, f.type, f.size)
    if (problem === 'type') { showAttachError(t(lang, 'attachUnsupported')); continue }
    if (problem === 'size') { showAttachError(t(lang, 'attachTooLarge')); continue }
    if (bytes + f.size > MAX_MESSAGE_BYTES) { showAttachError(t(lang, 'attachTotalTooLarge')); continue }
    count++; bytes += f.size
    const id = uid()
    setPendingAtts(prev => [...prev, { id, key: '', name: f.name, mime: f.type, size: f.size, status: 'uploading' }])
    void uploadScratch(id, f)
  }
}

async function uploadScratch(id: string, f: File) {
  try {
    const res = await fetch('/api/assistant/upload-url', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ filename: f.name, contentType: f.type, size: f.size }),
    })
    if (!res.ok) throw new Error()
    const { url, key } = await res.json() as { url: string; key: string }
    const put = await fetch(url, { method: 'PUT', body: f, headers: { 'Content-Type': f.type } })
    if (!put.ok) throw new Error()
    setPendingAtts(prev => prev.map(a => a.id === id ? { ...a, key, status: 'ready' } : a))
  } catch {
    showAttachError(t(lang, 'attachUploadFailed'))
    setPendingAtts(prev => prev.filter(a => a.id !== id))
  }
}

function removeAtt(id: string) {
  setPendingAtts(prev => prev.filter(a => a.id !== id))
  // The scratch object (if uploaded) stays in R2 — the 30-day cron removes it.
}
```

- [ ] **Step 3: Wire sendMessage to carry attachments**

In `sendMessage()`:

```ts
const uploading = pendingAtts.some(a => a.status === 'uploading')
const readyAtts = pendingAtts.filter(a => a.status === 'ready')
if ((!text && readyAtts.length === 0) || isStreaming || uploading) return
```

(replaces `if (!text || isStreaming) return`). Build the user message with attachments and clear the tray:

```ts
const userMsg: Message = {
  id: uid(), role: 'user', content: text,
  ...(readyAtts.length > 0
    ? { attachments: readyAtts.map(({ id, key, name, mime, size }) => ({ id, key, name, mime, size })) }
    : {}),
}
setPendingAtts([])
```

The `history` sent to the route must carry attachments too — replace both mapping sites:

```ts
const history = next
  .filter(m => !m.streaming)
  .slice(0, -1)
  .map(m => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
    ...(m.attachments?.length ? { attachments: m.attachments } : {}),
  }))
```

and the fetch body becomes:

```ts
body: JSON.stringify({ messages: history }),
```

(note: `history` already ends with the just-sent user message because `next` includes `userMsg` — verify by keeping the existing `slice(0, -1)` which drops only the streaming assistant placeholder; the old code re-appended `{ role: 'user', content: text }` separately, which would lose the attachments — this rewrite sends `history` alone).

- [ ] **Step 4: Persist attachments + jobCard in saves and reloads**

`saveConversation` payload mapping becomes:

```ts
const payload = msgs
  .filter(m => !m.streaming && !m.error)
  .map(m => ({
    role: m.role, content: m.content,
    ...(m.attachments?.length ? { attachments: m.attachments } : {}),
    ...(m.jobCard ? { jobCard: m.jobCard } : {}),
  }))
```

`loadFromHistory` mapping becomes:

```ts
type SavedMsg = { role: 'user' | 'assistant'; content: string; attachments?: ChatAttachment[]; jobCard?: { id: string; title: string | null } }
const msgs = (chat.msgs as SavedMsg[])
  .map(m => ({ id: uid(), role: m.role, content: m.content, attachments: m.attachments, jobCard: m.jobCard }))
```

(the save API route and `saveChat`/`updateChat` store `msgs` jsonb as received — no server change needed; the extra fields ride along. `buildOptimistic`'s `msgs` mapping may stay `{ role, content }` — it only feeds the sidebar topic.)

- [ ] **Step 5: SSE `job_created` handling**

In the SSE payload type and dispatch chain add:

```ts
let payload: {
  type: string; text?: string; key?: string
  sources?: { url: string; title: string }[]; message?: string
  id?: string; title?: string | null
}
```

```ts
} else if (payload.type === 'job_created' && payload.id) {
  flush()
  const jobCard = { id: payload.id, title: payload.title ?? null }
  setMessages(prev => prev.map(m => m.id === asstId ? { ...m, jobCard } : m))
}
```

- [ ] **Step 6: Composer + bubble UI**

Replace the disabled attach placeholder button with a live one plus a hidden input (inside the controls row):

```tsx
<input
  ref={fileInputRef}
  type="file"
  accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
  multiple
  className="hidden"
  onChange={e => { handleFilesPicked(e.target.files); e.target.value = '' }}
/>
<button
  onClick={() => fileInputRef.current?.click()}
  title={t(lang, 'attachFiles')}
  aria-label={t(lang, 'attachFiles')}
  className="p-2 rounded-lg text-ink2 hover:text-ink hover:bg-line/60 transition-colors"
>
  <Plus size={16} />
</button>
```

Add the pending-attachment chip tray at the TOP of the composer card (before the `<textarea>`):

```tsx
{pendingAtts.length > 0 && (
  <div className="flex flex-wrap gap-1.5 px-3 pt-2.5">
    {pendingAtts.map(a => (
      <span
        key={a.id}
        className={cn(
          'inline-flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-lg border border-line bg-paper text-[11px] text-ink2 max-w-[200px]',
          a.status === 'uploading' && 'opacity-60 animate-pulse',
        )}
      >
        <Paperclip size={10} className="shrink-0" />
        <span className="truncate">{a.name}</span>
        <button onClick={() => removeAtt(a.id)} className="p-0.5 rounded hover:bg-line/60 text-muted hover:text-ink" aria-label="Remove">
          <X size={10} />
        </button>
      </span>
    ))}
  </div>
)}
```

Update the send button's disabled logic:

```tsx
disabled={(!input.trim() && !pendingAtts.some(a => a.status === 'ready')) || pendingAtts.some(a => a.status === 'uploading')}
```

(and mirror the active/disabled styling condition on the same expression).

In `MessageBubble`, render sent-attachment chips inside the user bubble (above the content) and the job card under the assistant bubble content:

```tsx
{msg.attachments && msg.attachments.length > 0 && (
  <div className={cn('flex flex-wrap gap-1.5', msg.content && 'mb-1.5')}>
    {msg.attachments.map(a => (
      <span key={a.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/15 text-[11px] text-white max-w-[180px]">
        <Paperclip size={9} className="shrink-0" />
        <span className="truncate">{a.name}</span>
      </span>
    ))}
  </div>
)}
```

(placed as the first child inside the bubble div, before `{msg.content && <MarkdownMessage …>}`.)

```tsx
{msg.jobCard && (
  <Link
    href={`/jobs/${msg.jobCard.id}`}
    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-terracotta/40 bg-terracotta/5 text-xs hover:border-terracotta transition-colors"
  >
    <ClipboardList size={13} className="text-terracotta shrink-0" />
    <span className="font-medium text-ink truncate max-w-[220px]">{msg.jobCard.title || 'Untitled job'}</span>
    <span className="text-muted shrink-0">{t(lang, 'assistantJobCreated')}</span>
  </Link>
)}
```

(placed in the bubble column after the bubble div, before the Sources block. `'Untitled job'` literal matches the four existing occurrences in the codebase.)

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: clean

- [ ] **Step 8: Commit**

```bash
git add src/features/assistant/AssistantShell.tsx src/lib/i18n/en.ts src/lib/i18n/zh.ts
git commit -m "feat: assistant composer attachments (chips, scratch upload, job card render)"
```

---

### Task 4: Chat route — attachments become model content blocks

**Files:**
- Modify: `src/app/api/assistant/chat/route.ts`

**Interfaces:**
- Consumes: `ChatAttachment`, `isOwnScratchKey`, `validateAttachment`, `attachmentNote`, `MAX_PDF_BYTES` from Task 1; `getObjectBase64` from Task 2.
- Produces: `attachmentIndex: Map<string, ChatAttachment>` built per request (Task 5's tool context consumes it).

- [ ] **Step 1: Broaden the request body type and build the validated index**

```ts
import { isOwnScratchKey, validateAttachment, attachmentNote, MAX_PDF_BYTES } from '@/lib/ai/attachments'
import type { ChatAttachment } from '@/lib/ai/attachments'
import { getObjectBase64 } from '@/lib/storage/r2'
```

```ts
const body = await req.json() as {
  messages: { role: 'user' | 'assistant'; content: string; attachments?: ChatAttachment[] }[]
}
const { messages } = body

// Only the caller's own, rule-passing scratch files are ever loaded — a
// forged key pointing at another user's scratch (or a job folder) is dropped.
const attachmentIndex = new Map<string, ChatAttachment>()
for (const m of messages) {
  for (const a of m.attachments ?? []) {
    if (typeof a?.id === 'string' && typeof a?.key === 'string' &&
        isOwnScratchKey(a.key, profile.id) &&
        validateAttachment(a.name, a.mime, a.size) === null) {
      attachmentIndex.set(a.id, a)
    }
  }
}
```

- [ ] **Step 2: Transform messages with attachments into content-block arrays**

Replace `const convo: Anthropic.MessageParam[] = [...messages]` (inside the stream `start`, before the loop) with:

```ts
// Messages with attachments become content-block arrays: image/document
// blocks first, then the text with an id-note so the model can reference
// files in create_pending_job. A scratch object that has expired (30-day
// cleanup) degrades to a text note instead of failing the request.
const convo: Anthropic.MessageParam[] = []
for (const m of messages) {
  const atts = (m.attachments ?? []).filter(a => attachmentIndex.has(a.id))
  if (m.role !== 'user' || atts.length === 0) {
    convo.push({ role: m.role, content: m.content })
    continue
  }
  const blocks: Anthropic.ContentBlockParam[] = []
  for (const a of atts) {
    const data = await getObjectBase64(a.key, MAX_PDF_BYTES)
    if (!data) {
      blocks.push({ type: 'text', text: `[Attachment "${a.name}" is no longer available]` })
      continue
    }
    if (a.mime === 'application/pdf') {
      blocks.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } })
    } else {
      blocks.push({
        type: 'image',
        source: { type: 'base64', media_type: a.mime as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif', data },
      })
    }
  }
  blocks.push({ type: 'text', text: `${m.content || '(see attached files)'}\n\n${attachmentNote(atts)}` })
  convo.push({ role: 'user', content: blocks })
}
```

- [ ] **Step 3: Type-check + manual smoke**

Run: `npx tsc --noEmit`
Expected: clean

Manual (dev server, `npm run dev`): attach a small PDF on the assistant page, ask "what does this file say?" — the answer references the document's content. Attach a photo — same. A text-only chat behaves exactly as before.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/assistant/chat/route.ts
git commit -m "feat: chat route reads scratch attachments as image/document blocks"
```

---

### Task 5: `create_pending_job` — schema, runner context, executor, SSE, system prompt

**Files:**
- Modify: `src/lib/ai/tool-schemas.ts`
- Modify: `src/lib/ai/tool-schemas.test.ts`
- Modify: `src/lib/ai/tool-runner.ts`
- Create: `src/lib/supabase/queries/assistant-create-job.ts`
- Modify: `src/app/api/assistant/chat/route.ts`

**Interfaces:**
- Consumes: `attachmentIndex` (Task 4), `ChatAttachment` (Task 1), `copyObject`/`generateKey` (existing r2.ts), `getEffectiveRole` (existing).
- Produces: `JOB_BUCKETS` const + `JobBucket` type; `ToolContext { userId: string; role: Role; attachments: ReadonlyMap<string, ChatAttachment> }`; `executeTool(name, input, ctx)` (signature change); `ToolOutcome` gains `jobCreated?: { id: string; title: string | null }`; `createPendingJobFromChat(input, userId): Promise<{ jobId; filed; skipped } | null>`; SSE event `{ type: 'job_created', id, title }` (Task 3/6 client consumes).

- [ ] **Step 1: Update the schema test first (failing)**

In `src/lib/ai/tool-schemas.test.ts`:

```ts
// section 1 becomes:
const names = TOOL_DEFINITIONS.map(t => t.name).sort()
check('seven tools defined', names, ['check_clashes', 'create_pending_job', 'find_jobs', 'get_job', 'get_schedule', 'get_team_workload', 'search_knowledge'])
for (const n of names) check(`status key for ${n}`, typeof TOOL_STATUS_KEYS[n], 'string')
check('web_search status key', TOOL_STATUS_KEYS['web_search'], 'searching')
check('create status key', TOOL_STATUS_KEYS['create_pending_job'], 'creating')
```

and append (import `JOB_BUCKETS` from `./tool-schemas`):

```ts
// 6. create_pending_job shape
const create = TOOL_DEFINITIONS.find(t => t.name === 'create_pending_job')!
const createSchema = create.input_schema as {
  required?: string[]
  properties?: { files?: { items?: { properties?: { bucket?: { enum?: string[] } } } } }
}
check('create requires client+date', createSchema.required?.slice().sort(), ['client', 'date'])
check('bucket enum matches defaults', createSchema.properties?.files?.items?.properties?.bucket?.enum, [...JOB_BUCKETS])
check('four default buckets', JOB_BUCKETS.length, 4)
```

Run: `npx tsx src/lib/ai/tool-schemas.test.ts`
Expected: FAIL — six tools found, no `create_pending_job` status key, no `JOB_BUCKETS` export

- [ ] **Step 2: Add the tool definition to `src/lib/ai/tool-schemas.ts`**

```ts
/** The four default buckets every job gets — the model files attachments into
 *  these by name; the executor maps name → bucket id on the new job. */
export const JOB_BUCKETS = ['PERMIT-TO-WORK', 'BCA', 'DESIGNER JO', 'OTHERS'] as const
export type JobBucket = typeof JOB_BUCKETS[number]
```

Add to `TOOL_STATUS_KEYS`:

```ts
  create_pending_job: 'creating',
```

Append to `TOOL_DEFINITIONS`:

```ts
  {
    name: 'create_pending_job',
    description: 'Create a new job in pending status — the only write action available. Call ONLY after you have presented the job details to the user in this conversation and they clearly agreed. The job is saved as pending for the user to review and push to the schedule; this tool can never schedule it. Optionally files attachments from this conversation into the new job\'s buckets.',
    input_schema: {
      type: 'object',
      properties: {
        project_title: { type: 'string', description: 'Short project name; omit if not stated' },
        client:        { type: 'string', description: 'Client company name' },
        location:      { type: 'string', description: 'Site address or venue; omit if unknown' },
        date:          { type: 'string', description: 'Job date YYYY-MM-DD' },
        date_end:      { type: 'string', description: 'Last day for multi-day jobs, YYYY-MM-DD; omit for single-day' },
        time_start:    { type: 'string', description: 'HH:MM 24h; omit if not stated' },
        time_end:      { type: 'string', description: 'HH:MM 24h; omit if not stated' },
        description:   { type: 'string', description: 'What the job involves' },
        notes:         { type: 'string', description: 'Internal notes' },
        production_instructions: { type: 'string', description: 'Instructions for the production team — only if clearly present' },
        files: {
          type: 'array',
          description: 'Attachments from this conversation to file into the job',
          items: {
            type: 'object',
            properties: {
              id:     { type: 'string', description: 'Attachment id from the message it was attached to' },
              bucket: { type: 'string', enum: [...JOB_BUCKETS], description: 'Destination bucket; use OTHERS when unsure' },
            },
            required: ['id', 'bucket'],
          },
        },
      },
      required: ['client', 'date'],
    },
  },
```

Run: `npx tsx src/lib/ai/tool-schemas.test.ts`
Expected: PASS

- [ ] **Step 3: Create the executor `src/lib/supabase/queries/assistant-create-job.ts`**

```ts
import { createClient } from '@/lib/supabase/server'
import { copyObject, generateKey } from '@/lib/storage/r2'
import { JOB_BUCKETS, type JobBucket } from '@/lib/ai/tool-schemas'

// The assistant's ONE write action (Phase 3). Runs on the USER-SCOPED client:
// RLS is the real enforcement — the same insert rules as the New Job form in
// the browser. Mirrors NewJobShell exactly: pending status, strict
// punctuality default, the four default buckets, sales/scheduler visibility.
// Attachments are copied (R2 copyObject, like Duplicate) from the caller's
// scratch prefix into the job's folder and inserted as `files` rows with a
// bucket_id — scratch objects themselves are never files rows.

export interface CreateJobInput {
  project_title: string | null
  client:        string
  location:      string | null
  date:          string
  date_end:      string | null
  time_start:    string | null
  time_end:      string | null
  description:   string | null
  notes:         string | null
  production_instructions: string | null
  files:         { key: string; name: string; bucket: JobBucket }[]
}

export async function createPendingJobFromChat(
  input:  CreateJobInput,
  userId: string,
): Promise<{ jobId: string; filed: number; skipped: number } | null> {
  const supabase = await createClient()

  const { data: job, error } = await supabase
    .from('jobs')
    .insert({
      status:                  'pending',
      sales_poc_id:            userId,
      project_title:           input.project_title,
      date:                    input.date,
      date_end:                input.date_end,
      time_start:              input.time_start,
      time_end:                input.time_end,
      client:                  input.client,
      location:                input.location ?? '',
      description:             input.description,
      production_ready:        false,
      do_issued:               false,
      punctuality:             'strict',
      production_instructions: input.production_instructions,
      notes:                   input.notes,
      visibility:              ['role:sales', 'role:scheduler'],
    } as never)
    .select('id, r2_folder')
    .single() as unknown as { data: { id: string; r2_folder: string | null } | null; error: unknown }
  if (error || !job) return null

  // Default buckets — same set, order and casing as the New Job form.
  const bucketIds = new Map<JobBucket, string>()
  for (let i = 0; i < JOB_BUCKETS.length; i++) {
    const { data: bucket } = await supabase
      .from('attachment_buckets')
      .insert({ job_id: job.id, name: JOB_BUCKETS[i], position: i } as never)
      .select('id')
      .single() as unknown as { data: { id: string } | null; error: unknown }
    if (bucket) bucketIds.set(JOB_BUCKETS[i], bucket.id)
  }

  let filed = 0, skipped = 0
  for (const f of input.files) {
    const bucketId = bucketIds.get(f.bucket) ?? bucketIds.get('OTHERS')
    if (!bucketId) { skipped++; continue }
    const destKey = generateKey(job.r2_folder ?? job.id, 'attachment', f.name)
    try {
      await copyObject(f.key, destKey)
    } catch {
      skipped++
      continue
    }
    const { error: fileError } = await supabase.from('files').insert({
      job_id:      job.id,
      bucket_id:   bucketId,
      kind:        'attachment',
      r2_key:      destKey,
      name:        f.name,
      uploader_id: userId,
      visibility:  ['public-internal'],
    } as never)
    if (fileError) skipped++
    else filed++
  }

  return { jobId: job.id, filed, skipped }
}
```

- [ ] **Step 4: Thread `ToolContext` through `src/lib/ai/tool-runner.ts` and add the case**

New imports and types:

```ts
import { JOB_BUCKETS, type JobBucket } from './tool-schemas'
import { createPendingJobFromChat } from '@/lib/supabase/queries/assistant-create-job'
import type { ChatAttachment } from './attachments'
import type { Role } from '@/lib/supabase/types'

const CREATE_JOB_ROLES = new Set<Role>(['sales', 'scheduler', 'coordinator', 'admin'])

export interface ToolContext {
  userId:      string
  role:        Role
  attachments: ReadonlyMap<string, ChatAttachment>
}

export interface ToolOutcome {
  content: string
  isError: boolean
  jobCreated?: { id: string; title: string | null }
}
```

Signature becomes `export async function executeTool(name: string, input: unknown, ctx: ToolContext): Promise<ToolOutcome>` — the six existing cases ignore `ctx`. Add before `default:`:

```ts
      case 'create_pending_job': {
        // Role gate mirrors the app's job-creation rights (Duplicate route
        // pattern). Not an error: an ok() refusal stops the model retrying.
        if (!CREATE_JOB_ROLES.has(ctx.role)) {
          return ok({
            created: false,
            refusal: 'Only sales, scheduler, coordinator and admin accounts can create jobs. Tell the user their role cannot create jobs — you can still answer questions about the attachments.',
          })
        }
        const client = typeof args.client === 'string' ? args.client.trim() : ''
        if (!client) return bad('client is required')
        if (!isIsoDate(args.date)) return bad('date must be YYYY-MM-DD')
        const dateEnd = args.date_end === undefined || args.date_end === null
          ? null : (isIsoDate(args.date_end) ? args.date_end : undefined)
        if (dateEnd === undefined) return bad('date_end must be YYYY-MM-DD')
        if (dateEnd && dateEnd < args.date) return bad('date_end is before date')
        const timeOf = (v: unknown) => v === undefined || v === null
          ? null : (typeof v === 'string' && HHMM_RE.test(v) ? v : undefined)
        const ts = timeOf(args.time_start)
        const te = timeOf(args.time_end)
        if (ts === undefined || te === undefined) return bad('times must be HH:MM (24h)')
        const str = (v: unknown) => typeof v === 'string' && v.trim() ? v.trim() : null

        const unknownIds: string[] = []
        const files: { key: string; name: string; bucket: JobBucket }[] = []
        for (const raw of Array.isArray(args.files) ? args.files as Array<Record<string, unknown>> : []) {
          const id = typeof raw.id === 'string' ? raw.id : ''
          const bucket = typeof raw.bucket === 'string' && (JOB_BUCKETS as readonly string[]).includes(raw.bucket)
            ? raw.bucket as JobBucket : 'OTHERS'
          const att = ctx.attachments.get(id)
          if (!att) { unknownIds.push(id || '(missing id)'); continue }
          files.push({ key: att.key, name: att.name, bucket })
        }

        const title  = str(args.project_title)
        const result = await createPendingJobFromChat({
          project_title: title,
          client,
          location:      str(args.location),
          date:          args.date,
          date_end:      dateEnd,
          time_start:    ts,
          time_end:      te,
          description:   str(args.description),
          notes:         str(args.notes),
          production_instructions: str(args.production_instructions),
          files,
        }, ctx.userId)
        if (!result) return bad('The job could not be saved — the save was rejected.')

        return {
          ...ok({
            created:       true,
            job_id:        result.jobId,
            project_title: title,
            files_filed:   result.filed,
            files_skipped: result.skipped + unknownIds.length,
            ...(unknownIds.length ? { unknown_file_ids: unknownIds } : {}),
            note: 'Saved as a pending job. Tell the user it is on the Pending tab, ready to review and Push to Schedule.',
          }),
          jobCreated: { id: result.jobId, title },
        }
      }
```

- [ ] **Step 5: Chat route — context, effective role, SSE event, SYSTEM_PREFIX**

In `src/app/api/assistant/chat/route.ts`:

Imports: add `getEffectiveRole` from `@/lib/utils/role-override`, `type ToolContext` from `@/lib/ai/tool-runner`, `type Role` from `@/lib/supabase/types`.

After the profile load (before the stream), resolve the effective role and build the context (the `attachmentIndex` from Task 4 already exists at this point — move its construction above the `readable` stream if it isn't already):

```ts
const effectiveRole = await getEffectiveRole(profile.role as Role)
const toolCtx: ToolContext = { userId: profile.id, role: effectiveRole, attachments: attachmentIndex }
```

In the tool-execution block, pass the context and forward the event:

```ts
const results = await Promise.all(toolUses.map(async tu => {
  const r = await executeTool(tu.name, tu.input, toolCtx)
  if (r.jobCreated) send({ type: 'job_created', id: r.jobCreated.id, title: r.jobCreated.title })
  return {
    type: 'tool_result' as const,
    tool_use_id: tu.id,
    content: r.content,
    ...(r.isError ? { is_error: true as const } : {}),
  }
}))
```

SYSTEM_PREFIX edits (byte-stable module constant — exact replacements):

Replace the bullet

```
- You cannot create, edit or delete anything in the app. Never imply that you have taken an action.
```

with

```
- You can take exactly ONE action in the app: creating a pending job with create_pending_job. You cannot edit, schedule, complete or delete anything, and you must never imply that you have taken any other action.
```

In the "Using your tools:" section, after the `check_clashes` bullet, add:

```
- create_pending_job creates a new job in pending status — the only action you can take. Protocol, strictly: FIRST present a short summary of everything you intend to save (project title, client, location, date and times, description, and which bucket each attached file goes to), THEN wait for the user to clearly agree, and only THEN call the tool. Never call it without that explicit agreement in this conversation. If the client or the job date is missing, ask instead of guessing; leave unknown optional fields out entirely. File attachments into the buckets by content: Permit-to-Work for PTW documents, BCA for BCA submissions, Designer JO for design job orders, Others when unsure. Only sales, scheduler, coordinator and admin accounts can create jobs — if the tool refuses for the user's role, relay that politely; you can still answer questions about their attachments. After a successful creation, tell the user the job is saved on the Pending tab, ready to review and Push to Schedule.
- Users may attach images and PDFs to their messages — read them directly and answer questions about them for any role. Each attachment is listed at the end of its message with an id; pass those ids in the files argument of create_pending_job when the user wants them filed into the new job.
```

- [ ] **Step 6: Run all standalone suites + type-check**

Run: `npx tsx src/lib/ai/tool-schemas.test.ts && npx tsx src/lib/ai/attachments.test.ts && npx tsx src/lib/ai/tagger.test.ts && npx tsx src/lib/ai/past-chat-summary.test.ts && npx tsx src/lib/storage/job-file-permissions.test.ts && npx tsx src/lib/telegram/link-token.test.ts`
Expected: all PASS

Run: `npx tsc --noEmit`
Expected: clean

- [ ] **Step 7: Commit**

```bash
git add src/lib/ai/tool-schemas.ts src/lib/ai/tool-schemas.test.ts src/lib/ai/tool-runner.ts src/lib/supabase/queries/assistant-create-job.ts src/app/api/assistant/chat/route.ts
git commit -m "feat: create_pending_job tool — confirm-first pending job with bucket auto-filing"
```

---

### Task 6: Status line + floating panel job chip

**Files:**
- Modify: `src/features/assistant/statusLabels.ts`
- Modify: `src/lib/i18n/en.ts`, `src/lib/i18n/zh.ts`
- Modify: `src/components/FloatingChatPanel.tsx`

**Interfaces:**
- Consumes: SSE `{ type: 'job_created', id, title }` from Task 5; `assistantJobCreated` key from Task 3.

- [ ] **Step 1: Status label key**

`statusLabels.ts` STATUS_I18N gains:

```ts
  creating:  'assistantCreatingJob',
```

`en.ts` (status-line group): `assistantCreatingJob: 'Creating the job…',`
`zh.ts`: `assistantCreatingJob: '正在创建工作…',`

- [ ] **Step 2: FloatingChatPanel job chip**

The panel keeps NO paperclip (spec) — but a text-only conversation there can still create a job, so it must render the chip. In `src/components/FloatingChatPanel.tsx`:

- Add `jobCard?: { id: string; title: string | null }` to the panel's message type (it uses the same shape as AssistantShell's `Message` — extend whichever local interface/import it has).
- Extend the SSE payload type with `id?: string; title?: string | null` and add to the dispatch chain (same pattern as its `sources` branch):

```ts
} else if (payload.type === 'job_created' && payload.id) {
  flush()
  const jobCard = { id: payload.id, title: payload.title ?? null }
  setMessages(prev => prev.map(m => m.id === asstId ? { ...m, jobCard } : m))
}
```

- Render under the assistant bubble content (imports: `ClipboardList` from lucide, `Link` from next/link — reuse the panel's existing `t`/`lang`):

```tsx
{msg.jobCard && (
  <Link
    href={`/jobs/${msg.jobCard.id}`}
    className="inline-flex items-center gap-2 mt-1.5 px-3 py-2 rounded-xl border border-terracotta/40 bg-terracotta/5 text-xs hover:border-terracotta transition-colors"
  >
    <ClipboardList size={13} className="text-terracotta shrink-0" />
    <span className="font-medium text-ink truncate max-w-[180px]">{msg.jobCard.title || 'Untitled job'}</span>
    <span className="text-muted shrink-0">{t(lang, 'assistantJobCreated')}</span>
  </Link>
)}
```

- If the panel's `saveConversation` maps messages to `{ role, content }`, extend it to carry `jobCard` the same way Task 3 did for AssistantShell (attachments never exist here).

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: clean

- [ ] **Step 4: Commit**

```bash
git add src/features/assistant/statusLabels.ts src/lib/i18n/en.ts src/lib/i18n/zh.ts src/components/FloatingChatPanel.tsx
git commit -m "feat: creating-job status line + job chip in floating panel"
```

---

### Task 7: Move file between buckets (job form)

**Files:**
- Modify: `src/app/api/files/[id]/route.ts`
- Create: `src/features/job-detail/MoveFileModal.tsx`
- Modify: `src/features/job-detail/AttachmentBuckets.tsx`
- Modify: `src/lib/i18n/en.ts`, `src/lib/i18n/zh.ts`

**Interfaces:**
- Consumes: `canManageJobFiles` (existing), `useToast` (existing).
- Produces: `PATCH /api/files/[id]` body `{ bucketId: string }` → `{ ok: true }`; `MoveFileModal({ file, buckets, lang, onClose, onMoved })`.

- [ ] **Step 1: i18n keys**

`en.ts` (job-form area near other file strings):

```ts
  moveToBucket: 'Move to…',
  moveFileTitle: 'Move file to',
  fileMoved: 'File moved.',
  moveFileFailed: 'Could not move the file.',
```

`zh.ts`:

```ts
  moveToBucket: '移动到…',
  moveFileTitle: '移动文件到',
  fileMoved: '文件已移动。',
  moveFileFailed: '无法移动文件。',
```

- [ ] **Step 2: PATCH handler in `src/app/api/files/[id]/route.ts`**

A file's bucket is only the `bucket_id` column — the R2 object never moves. The `files` table has no UPDATE RLS policy (deny-by-default), so this mirrors the DELETE handler's shape (service client after the same role/status checks):

```ts
// Move one attachment to another bucket on the same job. The R2 object never
// moves — a bucket is only the bucket_id column on the files row. Same
// permission rules as delete: office roles, never installers, completed locked.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: fileId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  type ProfileRow = { id: string; role: Role }
  const { data: profile } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_id', user.id)
    .maybeSingle() as { data: ProfileRow | null; error: unknown }
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { bucketId } = await req.json() as { bucketId?: string }
  if (!bucketId) return NextResponse.json({ error: 'bucketId is required' }, { status: 400 })

  const role    = await getEffectiveRole(profile.role)
  const service = createServiceClient()

  type FileRow = { id: string; job_id: string | null }
  const { data: file } = await service
    .from('files')
    .select('id, job_id')
    .eq('id', fileId)
    .maybeSingle() as { data: FileRow | null; error: unknown }
  if (!file) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let jobStatus: string | null = null
  if (file.job_id) {
    const { data: job } = await service
      .from('jobs')
      .select('status')
      .eq('id', file.job_id)
      .maybeSingle() as { data: { status: string } | null; error: unknown }
    jobStatus = job?.status ?? null
  }

  const decision = canManageJobFiles(role, jobStatus)
  if (!decision.allowed) {
    return NextResponse.json(
      { error: decision.reason === 'completed' ? 'Job is completed' : 'Forbidden' },
      { status: 403 },
    )
  }

  // The target bucket must exist on the SAME job — no cross-job moves.
  const { data: bucket } = await service
    .from('attachment_buckets')
    .select('id, job_id')
    .eq('id', bucketId)
    .maybeSingle() as { data: { id: string; job_id: string } | null; error: unknown }
  if (!bucket || bucket.job_id !== file.job_id) {
    return NextResponse.json({ error: 'Bucket is not on this job' }, { status: 400 })
  }

  const { error: dbError } = await service
    .from('files')
    .update({ bucket_id: bucketId } as never)
    .eq('id', fileId)
  if (dbError) return NextResponse.json({ error: 'Database update failed' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
```

(`NextRequest` import already exists; the DELETE handler's imports cover everything.)

- [ ] **Step 3: Create `src/features/job-detail/MoveFileModal.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useToast } from '@/components/Toast'
import { t } from '@/lib/i18n'
import type { LangCode } from '@/lib/i18n'
import type { BucketFile } from '@/lib/supabase/queries/jobs'

interface Props {
  file:    BucketFile
  buckets: { id: string; name: string }[]
  lang:    LangCode
  onClose: () => void
  onMoved: (fileId: string, toBucketId: string) => void
}

// z-[60]: overlays layer above BottomNav (hard rule) — and above the job
// form's z-50 modals for good measure. UI updates only on server success.
export function MoveFileModal({ file, buckets, lang, onClose, onMoved }: Props) {
  const [busy, setBusy] = useState(false)
  const { success: showSuccess, error: showError } = useToast()
  const targets  = buckets.filter(b => b.id !== file.bucket_id)
  const filename = file.name ?? file.url_text ?? file.r2_key.split('/').pop() ?? file.r2_key

  async function move(toBucketId: string) {
    setBusy(true)
    try {
      const res = await fetch(`/api/files/${file.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ bucketId: toBucketId }),
      })
      if (!res.ok) { showError(t(lang, 'moveFileFailed')); return }
      onMoved(file.id, toBucketId)
      showSuccess(t(lang, 'fileMoved'))
      onClose()
    } catch {
      showError(t(lang, 'moveFileFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/50" onClick={onClose}>
      <div className="bg-paper rounded-xl p-5 w-80 shadow-xl" onClick={e => e.stopPropagation()}>
        <p className="font-display font-medium text-sm text-ink mb-1">{t(lang, 'moveFileTitle')}</p>
        <p className="text-xs text-muted truncate mb-3">{filename}</p>
        <div className="space-y-1">
          {targets.map(b => (
            <button
              key={b.id}
              type="button"
              disabled={busy}
              onClick={() => move(b.id)}
              className="w-full text-left px-3 py-2 rounded-lg border border-line text-[11px] font-semibold tracking-widest uppercase text-ink2 hover:border-terracotta hover:text-terracotta transition-colors disabled:opacity-50"
            >
              {b.name}
            </button>
          ))}
        </div>
        <div className="flex justify-end mt-3">
          <button type="button" onClick={onClose}
            className="px-3 py-1.5 text-sm rounded-lg border border-line text-ink2">Cancel</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Wire the control into `AttachmentBuckets.tsx`**

- Imports: `FolderInput` added to the lucide import; `MoveFileModal` from `./MoveFileModal`; `t` from `@/lib/i18n` (the `lang` prop already exists on `Props` — start using it).
- Parent state + handler in `AttachmentBuckets`:

```ts
const [moveTarget, setMoveTarget] = useState<BucketFile | null>(null)

function handleMoved(fileId: string, toBucketId: string) {
  setBuckets(prev => {
    let moved: BucketFile | undefined
    const stripped = prev.map(b => {
      const found = b.files.find(f => f.id === fileId)
      if (found) moved = { ...found, bucket_id: toBucketId }
      return { ...b, files: b.files.filter(f => f.id !== fileId) }
    })
    return stripped.map(b => (b.id === toBucketId && moved) ? { ...b, files: [...b.files, moved] } : b)
  })
}
```

- Render next to the lightbox at the top of the returned tree:

```tsx
{moveTarget && (
  <MoveFileModal
    file={moveTarget}
    buckets={buckets.map(b => ({ id: b.id, name: b.name }))}
    lang={lang}
    onClose={() => setMoveTarget(null)}
    onMoved={handleMoved}
  />
)}
```

- Thread an `onMove` callback down: `BucketCard` gains `onMoveFile: (file: BucketFile) => void` (passed as `onMoveFile={file => setMoveTarget(file)}` from the parent, forwarded to each `FileRow` as `onMove={() => onMoveFile(file)}`). `FileRow` gains `onMove: () => void` and renders the button next to the delete trash button (same visibility rules — hidden when `readOnly`):

```tsx
{!readOnly && (
  <button type="button" onClick={onMove} title="Move to…"
    className="text-muted opacity-0 group-hover:opacity-100 hover:text-ink transition-all shrink-0">
    <FolderInput size={12} />
  </button>
)}
```

(URL-link rows get the same button — they are `files` rows and move identically.)

Note: `title="Move to…"` hardcoded matches this file's existing hardcoded-English convention for tooltips; the modal's user-facing strings are i18n'd.

- [ ] **Step 5: Type-check + manual verify**

Run: `npx tsc --noEmit`
Expected: clean

Manual (dev server): on a job form, hover a bucket file → folder icon appears → modal lists the other buckets → pick one → file appears in the target bucket, green toast; reload — the move persisted. Try on a completed job with an office role → server returns 403, red toast, file stays.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/files/[id]/route.ts src/features/job-detail/MoveFileModal.tsx src/features/job-detail/AttachmentBuckets.tsx src/lib/i18n/en.ts src/lib/i18n/zh.ts
git commit -m "feat: move file between buckets on the job form"
```

---

### Task 8: Scratch cleanup cron (30 days)

**Files:**
- Create: `src/app/api/cron/asst-scratch-cleanup/route.ts`
- Modify: `vercel.json`

**Interfaces:**
- Consumes: `listObjects`, `deleteObject` from r2.ts (Task 2 + existing).

- [ ] **Step 1: Create the route**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { listObjects, deleteObject } from '@/lib/storage/r2'

const MAX_AGE_DAYS = 30

// Deletes assistant chat scratch attachments (asst-chat/…) older than 30
// days. Scratch objects are never `files` rows; anything a created job needed
// was COPIED into the job's folder, so deleting scratch can never touch job
// files. Called by Vercel cron daily at 03:00 SGT — see vercel.json.
// Manual run: GET with Authorization: Bearer <CRON_SECRET>
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const cutoff  = Date.now() - MAX_AGE_DAYS * 86_400_000
  const objects = await listObjects('asst-chat/')

  let deleted = 0, failed = 0
  for (const obj of objects) {
    if (!obj.lastModified || obj.lastModified.getTime() >= cutoff) continue
    try {
      await deleteObject(obj.key)
      deleted++
    } catch {
      failed++
    }
  }

  // Health-tab breadcrumb, same pattern as the overdue check's events row.
  const db = createServiceClient()
  await db.from('events').insert({
    kind: 'asst_scratch_cleanup', actor_id: null, target_id: null,
    target_table: null, payload: { deleted, failed }, visibility: [],
  } as never)

  return NextResponse.json({ ok: true, scanned: objects.length, deleted, failed })
}
```

(If type-check rejects the `payload` object against the events Insert type, pass `payload: null` instead — the JSON response still reports the counts.)

- [ ] **Step 2: Add the cron to `vercel.json`**

Append to the `crons` array (03:00 SGT = 19:00 UTC):

```json
    {
      "path": "/api/cron/asst-scratch-cleanup",
      "schedule": "0 19 * * *"
    }
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: clean

- [ ] **Step 4: Commit**

```bash
git add src/app/api/cron/asst-scratch-cleanup/route.ts vercel.json
git commit -m "feat: 30-day assistant scratch-file cleanup cron"
```

---

### Task 9: Full verification + push to dev

- [ ] **Step 1: All standalone suites**

Run: `npx tsx src/lib/ai/attachments.test.ts && npx tsx src/lib/ai/tool-schemas.test.ts && npx tsx src/lib/ai/tagger.test.ts && npx tsx src/lib/ai/past-chat-summary.test.ts && npx tsx src/lib/storage/job-file-permissions.test.ts && npx tsx src/lib/telegram/link-token.test.ts && npx tsx scripts/lib/frontmatter.test.ts && npx tsx scripts/lib/chunker.test.ts`
Expected: all PASS (adjust the two `scripts/lib` paths to the actual filenames if they differ — run whatever `.test.ts` files exist in `scripts/lib/`)

- [ ] **Step 2: Type-check + production build**

Run: `npx tsc --noEmit`
Expected: clean

Run: `npm run build`
Expected: build succeeds

- [ ] **Step 3: Local smoke (dev server)**

1. Assistant page: attach a PDF, ask "what does this say?" → answer reflects the document; status lines behave; Stop works.
2. As sales (or preview-as sales): "create a job for ACME at Marina Square this Friday, file the PDF under Permit-to-Work" → assistant presents a summary and ASKS before creating → agree → "Creating the job…" status → link chip appears → chip opens the pending job → PDF sits in the PERMIT-TO-WORK bucket.
3. Preview-as installer: same request → polite refusal, but attachment questions still answered.
4. Oversized file (>15 MB PDF) and a .docx → clean red toasts, nothing uploads.
5. Job form: move a file between buckets (Task 7 manual check) — including a URL link entry.
6. Floating bubble: no paperclip present; a text-only "create a job…" flow there shows the chip.

- [ ] **Step 4: Ask Nic before pushing** (standing rule — never auto-push)

Then: `git push origin dev` → Vercel preview → Nic's smoke test (spec's Phase 3 checklist: permit PDF + photos → summary → confirm → pending job with correct buckets + link chip; installer/designer refused but can ask about files; oversized file rejected cleanly; job appears on the sales Pending tab and pushes to schedule normally) → merge `main` after approval.

---

## Self-review notes (done at plan time)

- **Spec coverage:** paperclip/composer (T3), scratch prefix + signed URLs (T2), base64 blocks + 32 MB cap handling (T1/T4), floating bubble excluded (T6 chip only), any-role attachment questions (T2 route has no role gate; T5 prompt states it), role gate via `getEffectiveRole` (T5), conversational confirm (T5 SYSTEM_PREFIX), pending-only creation + field list + POC=requester + empty team (T5 executor), buckets via copyObject + Others default (T5), scratch never `files` rows (T2/T8 comments), missing-fields ask-don't-guess (T5 prompt), link card SSE + chip (T3/T5/T6), no Telegram (executor sends none), Move-to-… with z-[60], server route, URL links included (T7), cleanup built not deferred (T8, Nic's pick today), i18n en+zh (T3/T6/T7), per-question cost logging unchanged (loop untouched around usage).
- **Deviations to tell Nic:** HEIC rejected (API limitation); cleanup included per today's decision; "reuse submit logic" interpreted as the new dedicated server path (no server-side pending-creation logic existed to reuse).
- **Type consistency check:** `ChatAttachment` (T1) used by T3 wire format, T4 index, T5 ctx; `JOB_BUCKETS`/`JobBucket` (T5 schema) used by executor; `ToolOutcome.jobCreated` → SSE `job_created` → client `jobCard`. `executeTool` signature change is contained to T5 (route call updated in the same task).
