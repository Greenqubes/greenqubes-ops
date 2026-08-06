# File Name Display + Readable R2 Job Folders — Design

**Date:** 2026-08-06
**Status:** Approved by Nic (session 2026-08-06; Part B added mid-session per Nic)
**Problem:** The original file name is discarded at upload. R2 keys are UUID-based
(`jobs/{jobId}/attachments/{uuid}.pdf`), and every UI surface derives the display
name from the key tail — so users see gibberish in attachment buckets, job chat,
production photos, the external installer page, and on downloaded files. The R2
dashboard is equally unreadable: every job folder is a bare UUID.

**Scope decisions (Nic):**
- **Part A** — fix what users see **inside the app** (+ downloads as a near-free
  bonus). Individual file keys stay UUID-based.
- **Part B** — new jobs get a human-readable **folder** in R2:
  `{YYYY-MM-DD}_{Title-slug}_{8-char-job-code}`. Existing jobs are NOT renamed
  (their folders stay `jobs/{jobId}/`). The folder name freezes at job creation —
  later title edits do not move files. This supersedes the fuller 2026-06-05
  checklist plan (`{Date}_{Company}_{Client}_{Project}` + compulsory fields +
  rename-existing script), which is now dropped.
- Bug-report screenshots (separate `bug_reports` system, admin-only) stay
  out of scope.

---

## Part A — real file names in the app

Store the original file name in the database at upload time and display it
everywhere. No R2 object is touched or renamed.

### 1. Migration 0041 — `files.name`

```sql
alter table files add column name text;
```

- Nullable. Existing rows stay `NULL` — their original names are unrecoverable.
- No RLS changes (column rides existing row policies).
- `src/lib/supabase/types.ts`: `files` Row gains `name: string | null`
  (Insert/Update derive from Row automatically).
- `files` is already in the realtime publication — new column arrives in
  realtime payloads without further setup.

### 2. Write paths — save `name` on insert

| Site | What to save |
|---|---|
| `PendingFilesSection.tsx` (attachment insert) | `file.name` from the picked `File` |
| `AttachmentBuckets.tsx` (bucket file insert) | `file.name` |
| `ProductionReadySection.tsx` (production_instructions / do / completion insert) | `file.name` |
| `ChatSection.tsx` (chat attachment insert) | `file.name` |
| `ChatSection.tsx` (voice / camera insert) | the already-generated `{username} {date} {time}.{ext}` string (currently built then thrown away) |
| `insertFile()` in `src/lib/supabase/queries/jobs.ts` | new `name` parameter, passed through by its callers |
| `api/jobs/[id]/duplicate/route.ts` | copy `name` from the source row |

`url_link` rows keep `name = NULL` — they display `url_text`, unchanged.

### 3. Read paths — display `name` with fallback

Display rule everywhere: `file.name ?? r2_key.split('/').pop()` — old rows
keep today's behaviour, new rows show the real name.

- `getJobById` select in `queries/jobs.ts` + the `JobFile` / `BucketFile` types
  gain `name`.
- `AttachmentBuckets.tsx` `FileRow` (line ~364)
- `AttachmentSection.tsx` — verified dead code (exported, never imported since
  AttachmentBuckets replaced it): **delete the file** instead of updating it.
- `ProductionReadySection.tsx` (line ~121)
- `ChatSection.tsx` initial-load mapping (line ~129) **and** the realtime INSERT
  handler (both build a `filename` for attachment messages).
- `api/ext/[token]/job/[jobId]/route.ts` — return the stored name to the
  external installer page.

### 4. Downloads — real name via Content-Disposition (opt-in)

- `getDownloadUrl(key)` in `r2.ts` gains an optional `filename` argument. When
  provided, the signed GET URL sets
  `ResponseContentDisposition: inline; filename*=UTF-8''<encoded>` (RFC 5987
  encoding — filenames may contain Chinese characters or spaces). `inline` (not
  `attachment`) keeps in-tab previews of PDFs/images working exactly as today
  while still naming the file correctly when the browser saves it — so passing
  a filename is always safe, even for image URLs.
- `/api/r2/download-url` accepts an optional `filename` body/query field and
  passes it through.
- Callers that trigger explicit downloads (bucket `FileRow` open/download for
  non-image files, chat attachment download arrow, external page file links)
  pass `file.name` when present.

---

## Part B — readable job folders in R2 (new jobs only)

### New key layout

```
jobs/2026-08-12_Booth-Build_x7k2f3a1/attachments/{uuid}.pdf
     └────┬────┘ └───┬────┘ └──┬───┘
      jobs.date   title slug   first 8 chars of job id (never collides)
```

Old jobs keep `jobs/{jobId}/…` untouched. File-level keys stay UUID everywhere.

### Migration 0042 — `jobs.r2_folder` + stamp trigger

```sql
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

- A **BEFORE INSERT trigger** (same pattern as 0038's `scheduled_at`) covers both
  job-creation paths — the new-job form's client-side insert and the Duplicate
  API — plus any future path, with zero app code.
- `[[:alnum:]]` keeps Unicode letters (Chinese titles stay readable in the
  dashboard); runs of everything else collapse to `-`; slug capped at 50 chars;
  empty → `Untitled`.
- Column defaults run before BEFORE-row triggers, so `new.id` is already set.
- Existing rows stay `NULL` → uploads to old jobs keep the `jobs/{jobId}/` prefix.
- `types.ts`: `jobs` Row gains `r2_folder: string | null`; Insert makes it
  optional (the trigger fills it).

### Code changes

- `generateKey(jobId, …)` → `generateKey(folder, …)` where
  `folder = job.r2_folder ?? jobId`; same for `getUploadUrlForKind`.
- `/api/r2/upload-url` fetches the job's `r2_folder` (and 404s if the job
  doesn't exist — previously unchecked).
- Duplicate route: new-job insert `.select('id')` → `.select('id, r2_folder')`;
  copied files use the new job's folder.
- `copyObject`: `CopySource` is now percent-encoded per path segment — keys can
  contain Unicode once titles appear in folder names.

## Error handling

- Insert with `name` on a not-yet-migrated DB would fail — migrations 0041 +
  0042 must be applied (`npx supabase db push`) before the code deploys to
  preview.
- Missing/NULL name never crashes any surface: the fallback chain always ends
  at the current key-tail behaviour. Missing `r2_folder` always falls back to
  the old `jobs/{jobId}/` prefix.

## Testing (on the Vercel preview)

1. Upload one of each: bucket file, pending-job attachment, production photo,
   DO, completion photo, chat attachment, voice note, camera shot.
2. Confirm real names show in: buckets, chat (incl. another device via
   realtime), production section, external installer page.
3. Download a bucket file + chat attachment → saves with the real name
   (test a Chinese-character filename).
4. Duplicate a job with bucket files → names carry over.
5. Open a job with pre-fix files → still renders, shows the old code, no errors.
6. Create a new job titled e.g. "Booth Build 布展" dated 2026-08-12, upload a
   bucket file → R2 dashboard shows `jobs/2026-08-12_Booth-Build-布展_{code}/`.
7. Upload to an old (pre-fix) job → file lands in its existing `jobs/{uuid}/`
   folder, and its old files still download fine.
8. Duplicate the new job → copies land in the copy's own readable folder.
