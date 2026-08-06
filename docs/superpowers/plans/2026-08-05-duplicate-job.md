# Duplicate Job Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the "Duplicate (WIP)" placeholder a working Duplicate button that copies a job's details + attachments into a new pending job (location blank, team/chat/tasks empty), per `docs/superpowers/specs/2026-08-05-duplicate-job-design.md`.

**Architecture:** One new server route `POST /api/jobs/[id]/duplicate` does everything: role gate → insert the new pending job → copy attachment buckets → copy file rows, doing a true R2 object copy (`CopyObjectCommand`) for each stored file so the two jobs never share storage. The client button just calls the route and navigates to the returned job id.

**Tech Stack:** Next.js route handler, Supabase service-role client (`createServiceClient`), AWS SDK v3 S3 client already configured in `src/lib/storage/r2.ts`. No new dependencies, no DB schema changes.

## Global Constraints

- No DB migrations. No Telegram notifications (duplicate is silent; notifications fire on the later push-to-schedule).
- New user-facing strings get i18n keys in `en.ts` + `zh.ts` only — never `bn.ts` (boss decision 2026-08-03).
- Roles: only sales / scheduler / coordinator / admin may duplicate; any job status including completed.
- Copy rules (from the spec): all Details-tab fields copy except `location` (empty string — column is NOT NULL); title gets `" (Copy)"` appended (null title stays null); `sales_poc_id` = duplicating user; `notes` null; files copied = rows **with a bucket_id** (kinds `attachment` / `url_link`) plus kind `production_instructions`; never `do`, `completion`, or chat attachments (kind `attachment` with NULL bucket_id).
- Verification gates: `npm run type-check` + `npm run build`; visual/preview testing is Nic's smoke test.
- Commits on `dev`; never push without asking Nic.

---

### Task 1: `copyObject` helper in r2.ts

**Files:**
- Modify: `src/lib/storage/r2.ts` (imports line 1, new export after `getDownloadUrl`)

**Interfaces:**
- Produces: `copyObject(sourceKey: string, destKey: string): Promise<void>` — Task 2 imports it.

- [ ] **Step 1: Add the import**

Change line 1:

```ts
import { S3Client, PutObjectCommand, GetObjectCommand, CopyObjectCommand } from '@aws-sdk/client-s3'
```

- [ ] **Step 2: Add the helper** (after `getDownloadUrl`)

```ts
// Server-side R2→R2 object copy (no download/re-upload). Keys in this app are
// UUID-based ASCII paths, so the raw `bucket/key` CopySource form is safe.
export async function copyObject(sourceKey: string, destKey: string): Promise<void> {
  await r2.send(new CopyObjectCommand({
    Bucket:     BUCKET,
    CopySource: `${BUCKET}/${sourceKey}`,
    Key:        destKey,
  }))
  void logApiUsage({ service: 'r2', endpoint: 'copy', estimated_cost: 0 })
}
```

- [ ] **Step 3: Type-check**

Run: `npm run type-check` — expected PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/storage/r2.ts
git commit -m "feat: R2 copyObject helper for server-side file duplication"
```

---

### Task 2: `POST /api/jobs/[id]/duplicate` route

**Files:**
- Create: `src/app/api/jobs/[id]/duplicate/route.ts`

**Interfaces:**
- Consumes: `copyObject`, `generateKey` from `@/lib/storage/r2`; `createServiceClient` from `@/lib/supabase/service`; auth pattern from the existing DELETE route in `src/app/api/jobs/[id]/route.ts`.
- Produces: `POST` responding `{ id: string, skippedFiles: number }` on success; 401/403/404/500 otherwise. Task 3's button calls it.

- [ ] **Step 1: Write the route**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getEffectiveRole } from '@/lib/utils/role-override'
import { copyObject, generateKey } from '@/lib/storage/r2'
import type { Role, FileKind } from '@/lib/supabase/types'

const DUPLICATE_ROLES: Role[] = ['sales', 'scheduler', 'coordinator', 'admin']

// Duplicate a job: Details-tab fields + attachment buckets + production photos
// copy over; location is blanked, team/chat/tasks start empty, status pending.
// Stored files are truly copied in R2 so the two jobs never share an object.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: jobId } = await params

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

  const role = await getEffectiveRole(profile.role)
  if (!DUPLICATE_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const service = createServiceClient()

  type SourceJob = {
    project_title: string | null; date: string; date_end: string | null
    time_start: string | null; time_end: string | null; client: string
    description: string | null; client_poc_name: string | null
    client_poc_phone: string | null; production_ready: boolean
    do_issued: boolean; punctuality: string
    production_instructions: string | null
  }
  const { data: source } = await service
    .from('jobs')
    .select('project_title, date, date_end, time_start, time_end, client, description, client_poc_name, client_poc_phone, production_ready, do_issued, punctuality, production_instructions')
    .eq('id', jobId)
    .maybeSingle() as { data: SourceJob | null; error: unknown }
  if (!source) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // ── New pending job — location blanked, POC = duplicator ────────────────────
  const { data: newJob, error: insertError } = await service
    .from('jobs')
    .insert({
      status:                  'pending',
      project_title:           source.project_title ? `${source.project_title} (Copy)` : null,
      date:                    source.date,
      date_end:                source.date_end,
      time_start:              source.time_start,
      time_end:                source.time_end,
      client:                  source.client,
      location:                '',
      description:             source.description,
      client_poc_name:         source.client_poc_name,
      client_poc_phone:        source.client_poc_phone,
      production_ready:        source.production_ready,
      do_issued:               source.do_issued,
      punctuality:             source.punctuality,
      production_instructions: source.production_instructions,
      notes:                   null,
      sales_poc_id:            profile.id,
      visibility:              ['role:sales', 'role:scheduler'],
    } as never)
    .select('id')
    .single() as unknown as { data: { id: string } | null; error: Error | null }
  if (insertError || !newJob) {
    return NextResponse.json({ error: 'Insert failed' }, { status: 500 })
  }

  // ── Copy attachment buckets (old id → new id map) ───────────────────────────
  type BucketRow = { id: string; name: string; position: number }
  const { data: buckets } = await service
    .from('attachment_buckets')
    .select('id, name, position')
    .eq('job_id', jobId)
    .order('position') as { data: BucketRow[] | null; error: unknown }

  const bucketMap = new Map<string, string>()
  for (const bucket of buckets ?? []) {
    const { data: newBucket } = await service
      .from('attachment_buckets')
      .insert({ job_id: newJob.id, name: bucket.name, position: bucket.position } as never)
      .select('id')
      .single() as unknown as { data: { id: string } | null; error: unknown }
    if (newBucket) bucketMap.set(bucket.id, newBucket.id)
  }

  // ── Copy files: bucket uploads/links + production photos ────────────────────
  // Chat attachments (kind 'attachment', NULL bucket_id) and do/completion
  // proof photos are deliberately excluded.
  type FileRow = {
    bucket_id: string | null; kind: FileKind; r2_key: string
    url_text: string | null; visibility: string[]
  }
  const { data: sourceFiles } = await service
    .from('files')
    .select('bucket_id, kind, r2_key, url_text, visibility')
    .eq('job_id', jobId)
    .or('bucket_id.not.is.null,kind.eq.production_instructions') as { data: FileRow[] | null; error: unknown }

  let skippedFiles = 0
  for (const file of sourceFiles ?? []) {
    const newBucketId = file.bucket_id ? bucketMap.get(file.bucket_id) ?? null : null
    if (file.bucket_id && !newBucketId) { skippedFiles++; continue }

    let newKey = file.r2_key
    if (file.kind !== 'url_link' && file.r2_key) {
      // True storage copy under the new job's folder; keep the extension.
      newKey = generateKey(newJob.id, file.kind, file.r2_key.split('/').pop() ?? 'file')
      try {
        await copyObject(file.r2_key, newKey)
      } catch {
        skippedFiles++
        continue
      }
    }

    const { error: fileError } = await service.from('files').insert({
      job_id:      newJob.id,
      bucket_id:   newBucketId,
      kind:        file.kind,
      r2_key:      newKey,
      url_text:    file.url_text,
      uploader_id: profile.id,
      visibility:  file.visibility,
    } as never)
    if (fileError) skippedFiles++
  }

  return NextResponse.json({ id: newJob.id, skippedFiles })
}
```

Note: the `as never` insert casts and `as unknown as { data … }` result casts follow
the existing pattern in this codebase (see NewJobShell's jobs insert and the
DELETE route's profile select).

- [ ] **Step 2: Type-check**

Run: `npm run type-check` — expected PASS.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/jobs/[id]/duplicate/route.ts"
git commit -m "feat: duplicate job API route — copy details + attachments into a new pending job"
```

---

### Task 3: Wire the Duplicate button + i18n keys

**Files:**
- Modify: `src/features/job-detail/JobDetailShell.tsx` (imports, state, handler, the WIP button in the action bar)
- Modify: `src/lib/i18n/en.ts`, `src/lib/i18n/zh.ts` (2 keys each)

**Interfaces:**
- Consumes: Task 2's route.
- Produces: nothing new.

- [ ] **Step 1: i18n keys**

In `en.ts` (Job form section, after the `attachments` key added by the tabs feature):

```ts
  duplicateJob: 'Duplicate',
  duplicateSuccess: 'Job duplicated — set the new location',
```

In `zh.ts` (same spot):

```ts
  duplicateJob: '复制',
  duplicateSuccess: '工作已复制 — 请填写新地点',
```

- [ ] **Step 2: Button + handler in JobDetailShell**

Add `Copy` to the lucide-react import (line 32 area, alongside `Trash2`).

Add state next to the other useState calls:

```tsx
  const [duplicating,          setDuplicating]         = useState(false)
```

Add the handler near `handleDelete`:

```tsx
  const handleDuplicate = async () => {
    setDuplicating(true)
    try {
      const res = await fetch(`/api/jobs/${job.id}/duplicate`, { method: 'POST' })
      if (!res.ok) throw new Error()
      const data = await res.json() as { id: string; skippedFiles: number }
      showSuccess(data.skippedFiles > 0
        ? `${t(lang, 'duplicateSuccess')} (${data.skippedFiles} file(s) skipped)`
        : t(lang, 'duplicateSuccess'))
      router.push(`/jobs/${data.id}`)
    } catch {
      showError(t(lang, 'saveError'))
      setDuplicating(false)
    }
  }
```

Replace the WIP placeholder button:

```tsx
                <button
                  type="button"
                  disabled
                  className="flex items-center justify-center px-3 py-2 rounded-[10px] border border-dashed border-line bg-paper text-xs font-medium text-muted opacity-50 cursor-not-allowed"
                >
                  Duplicate (WIP)
                </button>
```

with:

```tsx
                {canEditCore && (
                  <button
                    type="button"
                    onClick={handleDuplicate}
                    disabled={duplicating}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] border border-line bg-paper text-xs font-medium text-ink2 hover:bg-bg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Copy size={12} />
                    {duplicating ? '…' : t(lang, 'duplicateJob')}
                  </button>
                )}
```

(`canEditCore` is sales/scheduler/coordinator/admin — exactly the duplicate
roles; installer never reaches this bar, designer/production see no button.
The button stays visible on completed jobs: it sits in the top action row,
which renders for all non-installer roles regardless of `readOnly`.)

- [ ] **Step 3: Type-check and build**

Run: `npm run type-check` then `npm run build` — expected PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/job-detail/JobDetailShell.tsx src/lib/i18n/en.ts src/lib/i18n/zh.ts
git commit -m "feat: working Duplicate button — copies job into a new pending job"
```

---

### Task 4: Final gate

- [ ] **Step 1:** `npm run type-check && npm run build` — both PASS.
- [ ] **Step 2:** Ask Nic before pushing `dev`; his preview smoke test follows the spec's Testing list (duplicate with attachments; file independence; completed-job duplicate; role visibility; delete-duplicate safety).
