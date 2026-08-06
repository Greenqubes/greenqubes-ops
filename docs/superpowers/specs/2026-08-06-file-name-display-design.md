# File Name Display — Design

**Date:** 2026-08-06
**Status:** Approved by Nic (session 2026-08-06)
**Problem:** The original file name is discarded at upload. R2 keys are UUID-based
(`jobs/{jobId}/attachments/{uuid}.pdf`), and every UI surface derives the display
name from the key tail — so users see gibberish in attachment buckets, job chat,
production photos, the external installer page, and on downloaded files.

**Scope decision (Nic):** fix what users see **inside the app** (+ downloads as a
near-free bonus). R2 keys and dashboard folder names stay UUID-based — the
human-readable R2 folder restructure (`{YYYY-MM-DD}_{Company}_{Client}_{Project}`,
agreed 2026-06-05) remains a separate pre-go-live checklist item. Bug-report
screenshots (separate `bug_reports` system, admin-only) are out of scope.

---

## Approach

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
  `ResponseContentDisposition: attachment; filename*=UTF-8''<encoded>` (RFC 5987
  encoding — filenames may contain Chinese characters or spaces).
- **Opt-in only:** links used to render images inline (chat thumbnails,
  lightbox, production photo grid) do NOT pass a filename — otherwise browsers
  would download instead of display.
- `/api/r2/download-url` accepts an optional `filename` body/query field and
  passes it through.
- Callers that trigger explicit downloads (bucket `FileRow` open/download for
  non-image files, chat attachment download arrow, external page file links)
  pass `file.name` when present.

## Error handling

- Insert with `name` on a not-yet-migrated DB would fail — migration 0041 must
  be applied (`npx supabase db push`) before the code deploys to preview.
- Missing/NULL name never crashes any surface: the fallback chain always ends
  at the current key-tail behaviour.

## Testing (on the Vercel preview)

1. Upload one of each: bucket file, pending-job attachment, production photo,
   DO, completion photo, chat attachment, voice note, camera shot.
2. Confirm real names show in: buckets, chat (incl. another device via
   realtime), production section, external installer page.
3. Download a bucket file + chat attachment → saves with the real name
   (test a Chinese-character filename).
4. Duplicate a job with bucket files → names carry over.
5. Open a job with pre-fix files → still renders, shows the old code, no errors.
