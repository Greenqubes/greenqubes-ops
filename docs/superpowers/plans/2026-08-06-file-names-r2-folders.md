# File Names + Readable R2 Folders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show real file names everywhere in the app (and on downloads), and give every NEW job a human-readable folder in Cloudflare R2 (`jobs/2026-08-12_Booth-Build_x7k2f3a1/…`).

**Architecture:** Part A (Tasks 1–8): a new `files.name` column stores the original upload filename; every insert path saves it, every display surface prefers it (fallback = today's key-tail), and signed download URLs carry it via `Content-Disposition: inline; filename*=`. Part B (Tasks 1, 9): a new `jobs.r2_folder` column is stamped by a BEFORE INSERT trigger (pattern of migration 0038); `generateKey` builds keys from that folder, falling back to `jobs/{jobId}/` for pre-existing jobs. No existing R2 object is touched or renamed.

**Tech Stack:** Next.js 15 App Router, Supabase (Postgres + RLS + realtime), Cloudflare R2 via `@aws-sdk/client-s3` presigned URLs. No test runner exists in this repo — the project convention is `npm run type-check` (tsc --noEmit) after every task and `npm run build` before merge (see CLAUDE.md "Run typecheck/build before suggesting a commit").

**Spec:** `docs/superpowers/specs/2026-08-06-file-name-display-design.md`

## Global Constraints

- Work on the `dev` branch. Do NOT push without Nic's explicit OK (standing rule).
- Migrations must stay backward-compatible with code already deployed on dev/main (shared remote DB). Both new columns are nullable with fallbacks, so old deployed code keeps working.
- Never embed `users` directly onto `jobs` in a PostgREST select (standing rule; not needed here).
- No new user-facing copy → no i18n changes (file names are data, not UI text).
- TypeScript strict; no `any`, no `@ts-ignore`.
- Nic must run `npx supabase db push` (migrations 0041 + 0042) BEFORE preview testing. Code is safe to deploy before the push runs (all reads/writes of the new columns are null-tolerant), but names/folders only start working after it.

---

### Task 1: Migrations 0041 + 0042 and `types.ts` rows

**Files:**
- Create: `supabase/migrations/0041_file_names.sql`
- Create: `supabase/migrations/0042_job_r2_folder.sql`
- Modify: `src/lib/supabase/types.ts` (files block ~lines 116–134; jobs block ~lines 42–84)

**Interfaces:**
- Produces: `files.name: string | null` and `jobs.r2_folder: string | null` on both DB and TS types. Every later task relies on these fields existing in `Database['public']['Tables']`.

- [ ] **Step 1: Write migration 0041**

```sql
-- 0041: store the original upload filename for in-app display.
-- R2 keys stay UUID-based; this is display-only metadata. Old rows stay NULL
-- (their original names are unrecoverable) and the app falls back to the key tail.
alter table files add column name text;
```

- [ ] **Step 2: Write migration 0042**

```sql
-- 0042: human-readable R2 folder per job, e.g. 2026-08-12_Booth-Build_x7k2f3a1.
-- Stamped once at INSERT (same pattern as 0038's scheduled_at trigger) so the
-- folder never moves when the title is edited later. Existing rows stay NULL
-- and keep uploading to the legacy jobs/{jobId}/ prefix.
alter table jobs add column r2_folder text;

create or replace function public.stamp_r2_folder()
returns trigger language plpgsql as $$
declare
  slug text;
begin
  slug := regexp_replace(coalesce(new.project_title, ''), '[^[:alnum:]]+', '-', 'g');
  slug := trim(both '-' from slug);
  if slug = '' then slug := 'Untitled'; end if;
  slug := trim(both '-' from left(slug, 50));
  new.r2_folder := to_char(new.date::date, 'YYYY-MM-DD') || '_' || slug || '_' || left(new.id::text, 8);
  return new;
end;
$$;

create trigger jobs_stamp_r2_folder
  before insert on jobs
  for each row execute function public.stamp_r2_folder();
```

Notes for the reviewer: `[[:alnum:]]` under a UTF-8 collation keeps Unicode letters (Chinese titles remain readable); column defaults run before BEFORE-row triggers so `new.id` is already populated; the second `trim` removes a trailing `-` the 50-char cut can leave.

- [ ] **Step 3: Update `types.ts` — files Row + Insert**

In the `files` block, add `name` after `r2_key` and make it optional on Insert (existing insert sites don't pass it yet — Tasks 5–7 add it):

```ts
      files: {
        Row: {
          id:          string
          job_id:      string | null
          kind:        FileKind
          r2_key:      string
          name:        string | null
          uploader_id: string | null
          bucket_id:   string | null
          url_text:    string | null
          visibility:  string[]
          ts:          string
        }
        Insert: Omit<Database['public']['Tables']['files']['Row'], 'id' | 'ts' | 'name'> & {
          id?:   string
          ts?:   string
          name?: string | null
        }
        Update: Partial<Database['public']['Tables']['files']['Insert']>
        Relationships: []
      }
```

- [ ] **Step 4: Update `types.ts` — jobs Row + Insert**

Add to the jobs Row (after `scheduled_at:  string | null`):

```ts
          r2_folder:               string | null
```

Extend the jobs Insert — the trigger fills it, so callers must be allowed to omit it. Add `'r2_folder'` to the Omit list and an optional override:

```ts
        Insert: Omit<
          Database['public']['Tables']['jobs']['Row'],
          'id' | 'created_at' | 'updated_at' | 'scheduled_at' | 'project_title' | 'date_end' | 'r2_folder'
        > & {
          id?:            string
          created_at?:    string
          updated_at?:    string
          scheduled_at?:  string | null
          project_title?: string | null
          date_end?:      string | null
          r2_folder?:     string | null
        }
```

- [ ] **Step 5: Verify**

Run: `npm run type-check`
Expected: clean (columns are additive; nothing reads them yet).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0041_file_names.sql supabase/migrations/0042_job_r2_folder.sql src/lib/supabase/types.ts
git commit -m "feat: files.name + jobs.r2_folder columns (migrations 0041-0042)"
```

---

### Task 2: Delete dead code

**Files:**
- Delete: `src/features/job-detail/AttachmentSection.tsx` (exported, imported nowhere — replaced by AttachmentBuckets in feat-jobs 2026-05-20)
- Modify: `src/lib/supabase/queries/jobs.ts` — delete the `insertFile` function (lines ~309–329; defined, called nowhere)

**Interfaces:**
- Consumes: nothing. Produces: nothing — both are verified-unreferenced (grep `AttachmentSection` and `insertFile` across `src/` each hit only the definition).

- [ ] **Step 1: Delete `src/features/job-detail/AttachmentSection.tsx`**

- [ ] **Step 2: Delete the `insertFile` function from `queries/jobs.ts`**

Remove the whole function AND its `// ── Files ──…` banner comment above it (the function is the banner's only content — the next section starts at the `// ── Attachment Buckets ──…` banner). If `createClient` (the server client import) is then unused in the file, remove that import too — check the remaining functions first; several others use it.

- [ ] **Step 3: Verify**

Run: `npm run type-check`
Expected: clean. If it reports an unused import, remove it.

- [ ] **Step 4: Commit**

```bash
git add -A src/features/job-detail/AttachmentSection.tsx src/lib/supabase/queries/jobs.ts
git commit -m "chore: delete dead AttachmentSection component + unused insertFile query"
```

---

### Task 3: Signed download URLs carry the real filename

**Files:**
- Modify: `src/lib/storage/r2.ts:62-70` (`getDownloadUrl`)
- Modify: `src/app/api/r2/download-url/route.ts`

**Interfaces:**
- Produces: `getDownloadUrl(key: string, filename?: string): Promise<string>` — and the `/api/r2/download-url` POST body gains optional `filename?: string`. Tasks 5–8 pass filenames through these.

- [ ] **Step 1: Extend `getDownloadUrl` and add the disposition helper in `r2.ts`**

Replace the existing `getDownloadUrl` with:

```ts
export async function getDownloadUrl(key: string, filename?: string): Promise<string> {
  const url = await getSignedUrl(
    r2,
    new GetObjectCommand({
      Bucket: BUCKET,
      Key:    key,
      ...(filename ? { ResponseContentDisposition: contentDisposition(filename) } : {}),
    }),
    { expiresIn: 3600 },
  )
  void logApiUsage({ service: 'r2', endpoint: 'get', estimated_cost: 0 })
  return url
}

// `inline` keeps in-tab previews (PDF/image) working; filename* (RFC 5987)
// names the file on save — filenames may contain Chinese characters or spaces.
function contentDisposition(filename: string): string {
  const encoded = encodeURIComponent(filename)
    .replace(/['()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())
  return `inline; filename*=UTF-8''${encoded}`
}
```

- [ ] **Step 2: Pass `filename` through the API route**

In `src/app/api/r2/download-url/route.ts` replace the body parse + call:

```ts
  const { key, filename } = await req.json() as { key: string; filename?: string }
  if (!key) return NextResponse.json({ error: 'key required' }, { status: 400 })

  const url = await getDownloadUrl(key, filename)
  return NextResponse.json({ url })
```

- [ ] **Step 3: Verify**

Run: `npm run type-check`
Expected: clean (`filename` is optional — existing callers unaffected).

- [ ] **Step 4: Commit**

```bash
git add src/lib/storage/r2.ts src/app/api/r2/download-url/route.ts
git commit -m "feat: signed download URLs can carry the real filename (inline disposition)"
```

---

### Task 4: `queries/jobs.ts` — types and selects gain `name`

**Files:**
- Modify: `src/lib/supabase/queries/jobs.ts` — `JobFile` type (~line 87), `getJobById` files embed (~line 188), `BucketFile` type (~line 333), `getAttachmentBuckets` select (~line 357)

**Interfaces:**
- Produces: `JobFile.name: string | null` and `BucketFile.name: string | null`, populated by `getJobById` and `getAttachmentBuckets`. Tasks 5–7 read `file.name` off these types.

- [ ] **Step 1: Add `name` to the `JobFile` type** (after `r2_key`):

```ts
export type JobFile = {
  id:          string
  job_id:      string
  // Set when the file lives in an attachment bucket — bucket files share
  // kind 'attachment' with chat uploads, so chat must filter these out.
  bucket_id:   string | null
  kind:        FileKind
  r2_key:      string
  name:        string | null
  uploader_id: string | null
  ts:          string
  users:       { name: string } | null
}
```

- [ ] **Step 2: Add `name` to the `getJobById` files embed** (~line 188). The inner `users(name)` is a different level — no ambiguity:

```ts
      files ( id, bucket_id, kind, r2_key, name, uploader_id, ts, users!files_uploader_id_fkey ( name ) )
```

- [ ] **Step 3: Add `name: string | null` to the `BucketFile` type** (after `r2_key`, ~line 333).

- [ ] **Step 4: Add `name` to the `getAttachmentBuckets` select** (~line 357):

```ts
    .select('id, job_id, name, position, created_at, files(id, job_id, bucket_id, kind, r2_key, name, url_text, uploader_id, ts)')
```

(The outer `name` is the bucket's name — unchanged; the one inside `files(…)` is new.)

- [ ] **Step 5: Verify**

Run: `npm run type-check`
Expected: clean — adding an optional-nullable field breaks no consumer.

- [ ] **Step 6: Commit**

```bash
git add src/lib/supabase/queries/jobs.ts
git commit -m "feat: JobFile/BucketFile carry the stored file name"
```

---

### Task 5: AttachmentBuckets — save, show, download real names

**Files:**
- Modify: `src/features/job-detail/AttachmentBuckets.tsx` — load select (~line 52), `uploadFile` insert + select (~lines 127–138), `addUrl` select (~line 163), `getDownloadUrl` helper (~lines 179–187), `BucketCard` prop type (~line 235), `FileRow` (~lines 354–374)

**Interfaces:**
- Consumes: `BucketFile.name` (Task 4), `/api/r2/download-url` `filename` field (Task 3).
- Produces: bucket uploads write `files.name`; the component-local helper becomes `getDownloadUrl(r2Key: string, filename?: string)`.

- [ ] **Step 1: `load()` select gains `name`** (~line 52):

```ts
        .select('id, job_id, name, position, created_at, files(id, job_id, bucket_id, kind, r2_key, name, url_text, uploader_id, ts)')
```

- [ ] **Step 2: `uploadFile` — save and return `name`** (~lines 129–137):

```ts
      .insert({
        job_id:      jobId,
        bucket_id:   bucket.id,
        kind:        'attachment',
        r2_key:      key,
        name:        file.name,
        uploader_id: userId,
        visibility:  ['public-internal'],
      } as never)
      .select('id, job_id, bucket_id, kind, r2_key, name, url_text, uploader_id, ts')
```

- [ ] **Step 3: `addUrl` select gains `name`** (~line 163) so the returned row matches `BucketFile` (its value is NULL — URL rows have no filename):

```ts
      .select('id, job_id, bucket_id, kind, r2_key, name, url_text, uploader_id, ts')
```

- [ ] **Step 4: component-local `getDownloadUrl` passes the filename** (~lines 179–187):

```ts
  async function getDownloadUrl(r2Key: string, filename?: string): Promise<string> {
    const res = await fetch('/api/r2/download-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: r2Key, filename }),
    })
    const { url } = await res.json() as { url: string }
    return url
  }
```

Update the two prop typings that carry it — `BucketCard` props (~line 235) and `FileRow` props (~line 359) — to `getDownloadUrl: (key: string, filename?: string) => Promise<string>`.

- [ ] **Step 5: `FileRow` shows the stored name and passes it on click** (~lines 361–374):

```ts
  const isUrl    = file.kind === 'url_link'
  const urlText  = file.url_text ?? file.r2_key
  const filename = isUrl ? urlText : (file.name ?? file.r2_key.split('/').pop() ?? file.r2_key)
  const imgFile  = !isUrl && isImage(filename)

  async function handleClick() {
    if (isUrl) { window.open(urlText, '_blank', 'noopener'); return }
    setDlLoading(true)
    try {
      const url = await getDownloadUrl(file.r2_key, file.name ?? undefined)
      if (imgFile) { onImageClick(url) } else { window.open(url, '_blank', 'noopener') }
    } finally { setDlLoading(false) }
  }
```

(`inline` disposition means passing the name is safe for the image/lightbox path too.)

Note: `isImage(filename)` now sees real names — extension-based detection still works because uploads keep their extension. Old rows fall back to the UUID tail exactly as today.

- [ ] **Step 6: Verify**

Run: `npm run type-check`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/features/job-detail/AttachmentBuckets.tsx
git commit -m "feat: attachment buckets save + show real file names"
```

---

### Task 6: ChatSection — save, show, download real names

**Files:**
- Modify: `src/features/job-detail/ChatSection.tsx` — `toItems` (~line 129), `FileAttachment.download` (~lines 157–176), `handleFileChange` insert (~line 662), `handleCameraCapture` insert (~line 707)

**Interfaces:**
- Consumes: `JobFile.name` (Task 4), `/api/r2/download-url` `filename` field (Task 3).
- Produces: chat attachment + camera rows write `files.name`. The realtime INSERT handler (~line 509) needs NO change — the payload row now carries `name` and flows into `toItems` untouched.

- [ ] **Step 1: `toItems` prefers the stored name** (~line 129):

```ts
      filename: f.name ?? (f.r2_key.split('/').pop() ?? f.r2_key),
```

- [ ] **Step 2: `FileAttachment.download()` passes the filename** — in both fetch bodies inside `download` (~lines 160–169), change the body to:

```ts
          body: JSON.stringify({ key: r2Key, filename }),
```

Leave the eager image-thumbnail fetch (~line 150) as-is — thumbnails don't need a disposition.

- [ ] **Step 3: `handleFileChange` insert saves the name** (~line 662):

```ts
      await supabase.from('files').insert({
        job_id:      jobId,
        kind:        'attachment',
        r2_key:      key,
        name:        file.name,
        uploader_id: userId,
        visibility:  ['public-internal'],
      } as never).throwOnError()
```

- [ ] **Step 4: `handleCameraCapture` insert saves the generated name** (~line 707 — `filename` here is the existing `uploadName(userName, ext)` result, e.g. "Ravi 2026-08-06 14:30.jpg", currently thrown away):

```ts
      await supabase.from('files').insert({
        job_id:      jobId,
        kind:        'attachment',
        r2_key:      key,
        name:        filename,
        uploader_id: userId,
        visibility:  ['public-internal'],
      } as never).throwOnError()
```

Voice notes need nothing: they live in `messages.voice_url` (not `files`) and render as a play card with no filename.

- [ ] **Step 5: Verify**

Run: `npm run type-check`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/features/job-detail/ChatSection.tsx
git commit -m "feat: job chat saves + shows real attachment names (camera keeps its generated name)"
```

---

### Task 7: ProductionReadySection + PendingFilesSection

**Files:**
- Modify: `src/features/job-detail/ProductionReadySection.tsx` — `DownloadButton` (~lines 44–67 + its call site ~line 130), `UploadSection.handleFiles` insert (~line 102), display (~line 121)
- Modify: `src/features/job-detail/PendingFilesSection.tsx` — attachment insert (~line 52; the url_link insert at ~line 74 stays name-less)

**Interfaces:**
- Consumes: `JobFile.name` (Task 4), `/api/r2/download-url` `filename` field (Task 3).
- Produces: production/DO/completion uploads and pending-job attachments write `files.name`.

- [ ] **Step 1: `DownloadButton` gains a `filename` prop**:

```ts
function DownloadButton({ r2Key, filename, lang }: { r2Key: string; filename: string | null; lang: LangCode }) {
  const [loading, setLoading] = useState(false)

  const handleDownload = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/r2/download-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: r2Key, filename: filename ?? undefined }),
      })
      const { url } = await res.json() as { url: string }
      window.open(url, '_blank', 'noopener')
    } finally {
      setLoading(false)
    }
  }
```

- [ ] **Step 2: `UploadSection.handleFiles` insert saves the name** (~line 102):

```ts
        await supabase.from('files').insert({
          job_id: jobId, kind, r2_key: key, name: file.name, uploader_id: userId, visibility: ['public-internal'],
        } as never).throwOnError()
```

- [ ] **Step 3: display + call site** (~lines 120–130):

```ts
            const filename = file.name ?? (file.r2_key.split('/').pop() ?? file.r2_key)
```

and

```tsx
                <DownloadButton r2Key={file.r2_key} filename={file.name} lang={lang} />
```

- [ ] **Step 4: `PendingFilesSection` attachment insert saves the name** (~line 52):

```ts
        await supabase.from('files').insert({
          job_id:      jobId,
          kind:        'attachment',
          r2_key:      key,
          name:        file.name,
          uploader_id: userId,
          visibility:  ['public-internal'],
        } as never).throwOnError()
```

(This component only uploads — it renders no file list, so no display change.)

- [ ] **Step 5: Verify**

Run: `npm run type-check`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/features/job-detail/ProductionReadySection.tsx src/features/job-detail/PendingFilesSection.tsx
git commit -m "feat: production + pending uploads save real names; downloads carry them"
```

---

### Task 8: External installer page shows real names

**Files:**
- Modify: `src/app/api/ext/[token]/job/[jobId]/route.ts` (~lines 40–56)

**Interfaces:**
- Consumes: `files.name` column (Task 1), `getDownloadUrl(key, filename?)` (Task 3).
- Produces: the ext API's `attachments[].name` field now carries real names — the `/ext/[token]` page renders it as-is (no client change needed).

- [ ] **Step 1: Select + map the stored name**:

```ts
  const { data: files } = await supabase
    .from('files')
    .select('id, kind, r2_key, name, url_text, ts')
    .eq('job_id', jobId)
    .not('bucket_id', 'is', null)
    .order('ts', { ascending: true })

  const attachments = await Promise.all(
    (files ?? []).map(async f => ({
      id:   f.id,
      kind: f.kind,
      name: f.kind === 'url_link'
        ? (f.url_text ?? 'Link')
        : (f.name ?? f.r2_key.split('/').pop() ?? 'file'),
      url:  f.kind === 'url_link' ? (f.url_text ?? '') : await getDownloadUrl(f.r2_key, f.name ?? undefined),
    })),
  )
```

- [ ] **Step 2: Verify**

Run: `npm run type-check`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/ext/[token]/job/[jobId]/route.ts"
git commit -m "feat: external installer page shows real attachment names"
```

---

### Task 9: Part B — readable folders for new-job uploads

**Files:**
- Modify: `src/lib/storage/r2.ts` — `generateKey` (~line 29), `getUploadUrlForKind` (~line 46), `copyObject` (~line 74)
- Modify: `src/app/api/r2/upload-url/route.ts`
- Modify: `src/app/api/jobs/[id]/duplicate/route.ts` — new-job select (~line 76), source-file select + copy loop (~lines 103–139)

**Interfaces:**
- Consumes: `jobs.r2_folder` (Task 1 trigger), `files.name` (Task 1).
- Produces: `generateKey(folder: string, kind: FileKind, originalName: string)` and `getUploadUrlForKind(folder: string, …)` — the first argument is now the job's `r2_folder ?? jobId`, no longer always the job id. This task updates ALL callers in the same commit (the signature change breaks the build otherwise).

- [ ] **Step 1: `r2.ts` — folder-based keys + Unicode-safe copy**:

```ts
// `folder` is the job's readable r2_folder slug (new jobs) or the bare job id
// (jobs created before migration 0042 — never renamed).
export function generateKey(folder: string, kind: FileKind, originalName: string): string {
  const ext  = originalName.includes('.') ? originalName.split('.').pop() : undefined
  const name = ext ? `${randomUUID()}.${ext}` : randomUUID()
  return `jobs/${folder}/${KIND_FOLDER[kind]}/${name}`
}
```

```ts
export async function getUploadUrlForKind(
  folder: string,
  kind: FileKind,
  filename: string,
  contentType: string,
): Promise<{ url: string; key: string }> {
  const key = generateKey(folder, kind, filename)
  const url = await getSignedUrl(
    r2,
    new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType }),
    { expiresIn: 300 },
  )
  void logApiUsage({ service: 'r2', endpoint: 'put', estimated_cost: 0 })
  return { url, key }
}
```

```ts
// Server-side R2→R2 object copy (no download/re-upload). CopySource must be
// percent-encoded per path segment — folder slugs may contain Unicode
// (Chinese project titles).
export async function copyObject(sourceKey: string, destKey: string): Promise<void> {
  await r2.send(new CopyObjectCommand({
    Bucket:     BUCKET,
    CopySource: [BUCKET, ...sourceKey.split('/')].map(encodeURIComponent).join('/'),
    Key:        destKey,
  }))
  void logApiUsage({ service: 'r2', endpoint: 'copy', estimated_cost: 0 })
}
```

- [ ] **Step 2: `/api/r2/upload-url` resolves the job's folder** — after the existing kind/content-type validation, replace the final call with:

```ts
  const { data: job } = await supabase
    .from('jobs')
    .select('r2_folder')
    .eq('id', jobId)
    .maybeSingle() as { data: { r2_folder: string | null } | null; error: unknown }
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

  const { url, key } = await getUploadUrlForKind(job.r2_folder ?? jobId, kind as FileKind, filename, contentType)
  return NextResponse.json({ url, key })
```

(RLS scopes the lookup to jobs the caller can see — a 404 here also blocks uploading to jobs the user has no access to, which previously wasn't checked. Voice notes use this same route, so they follow automatically.)

- [ ] **Step 3: Duplicate route — new folder + copied names**:

New-job insert select (~line 76): `.select('id, r2_folder')` and widen the cast:

```ts
    .single() as unknown as { data: { id: string; r2_folder: string | null } | null; error: Error | null }
```

Source-file type + select (~lines 103–111) gain `name`:

```ts
  type FileRow = {
    bucket_id: string | null; kind: FileKind; r2_key: string; name: string | null
    url_text: string | null; visibility: string[]
  }
  const { data: sourceFiles } = await service
    .from('files')
    .select('bucket_id, kind, r2_key, name, url_text, visibility')
```

Copy loop (~lines 118–138): key from the new job's folder, name carried over:

```ts
    let newKey = file.r2_key
    if (file.kind !== 'url_link' && file.r2_key) {
      // True storage copy under the new job's folder; keep the extension.
      newKey = generateKey(newJob.r2_folder ?? newJob.id, file.kind, file.name ?? file.r2_key.split('/').pop() ?? 'file')
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
      name:        file.name,
      url_text:    file.url_text,
      uploader_id: profile.id,
      visibility:  file.visibility,
    } as never)
```

- [ ] **Step 4: Verify all `generateKey`/`getUploadUrlForKind` callers are updated**

Run: `npm run type-check`
Expected: clean. If tsc flags another caller of either function, that's a missed site — update it to pass `job.r2_folder ?? jobId` (as of writing, the only callers are the two files in this task).

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage/r2.ts src/app/api/r2/upload-url/route.ts "src/app/api/jobs/[id]/duplicate/route.ts"
git commit -m "feat: new jobs upload into readable R2 folders (date_title_code)"
```

---

### Task 10: Full verification + handoff to Nic

**Files:** none new.

- [ ] **Step 1: Full check**

Run: `npm run type-check` then `npm run build`
Expected: both clean. Fix anything that surfaces before proceeding (and commit fixes with a `fix:` message).

- [ ] **Step 2: STOP — Nic actions before preview testing** (do not push without his OK):

1. Nic runs `npx supabase db push` → applies 0041 + 0042.
2. With Nic's OK, push `dev` → Vercel preview builds.
3. Nic runs the smoke test from the spec's Testing section (8 items — names in all four surfaces, Chinese-filename download, duplicate carry-over, old-job fallback, readable folder in the R2 dashboard).
