---
session: fix-files (Attachment delete never deleted — RLS had no DELETE policy)
date: 2026-08-19
branch: dev → main (verified by Nic on preview, then production same day)
---

# Attachment Delete Fix — DONE

> Nic reported that deleting attachments from a job "keeps putting them back".
> His theory was Cloudflare not deleting — half right (R2 objects were indeed
> never deleted), but the reappearing came from the database: the delete was
> silently refused and the UI faked success.

## Root cause

1. **`files` has RLS enabled (0002) but no DELETE policy was ever written** —
   any migration touching `files` only ever created SELECT + INSERT policies.
   Postgres RLS is deny-by-default per command, so every browser-side
   `supabase.from('files').delete()` deleted **zero rows**, and PostgREST
   reports that as success (200, empty result), not an error.
2. **The UI never checked** — `deleteFile` in `AttachmentBuckets.tsx` ignored
   the result and removed the file from local state, so it *looked* deleted
   until the next load (`refreshKey` bump, reopen, refresh) brought it back.
3. **Evidence:** `OG PP VISUALS CHANGE JO.pdf` on job `da4fd964` (Fossil WSO
   Set Up) was still in the DB after Nic's delete attempts — row intact,
   uploaded 10:47 SGT, never deleted.

Two adjacent bugs found during the trace:

- **No R2 deletion existed anywhere** — even a successful row delete would
  have stranded the object in Cloudflare forever.
- **Bucket delete orphaned its files into job chat** — `attachment_buckets`
  *does* have a delete policy (0025, `using (true)`), but `files.bucket_id`
  is `ON DELETE SET NULL`, and job chat renders `kind = 'attachment'` rows
  with **no** bucket_id (the 2026-08-06 chat-leak fix's filter). So deleting
  a bucket unhooked its files straight into the chat, R2 objects stranded.

## The fix (no migration needed)

Deletes now go through server routes using the service client after explicit
permission checks — RLS stays deny-by-default for browser deletes:

- **`DELETE /api/files/[id]`** — auth → effective role → file row → job
  status → `canManageJobFiles` → **R2 object first** (a failure aborts,
  leaving row + file consistent), then the DB row. Missing row = success
  (double-tap safe). `url_link` rows (empty r2_key) skip R2.
- **`DELETE /api/buckets/[id]`** — same checks, then deletes the bucket's
  files (R2 objects + rows) **before** the bucket row. No more SET NULL
  orphaning, no more chat leak; the confirm modal's "Delete bucket and its
  N files?" wording is finally true.
- **`canManageJobFiles(role, jobStatus)`** in
  `src/lib/storage/job-file-permissions.ts` — office roles (sales /
  scheduler / coordinator / designer / production / admin) may delete on
  non-completed jobs; installers never; `completed` locks everyone (matches
  the existing UI readOnly rule). Null status (orphaned file, job row gone)
  = office roles may clean up. **23 standalone tests** (repo pattern, no
  framework): `npx tsx src/lib/storage/job-file-permissions.test.ts` — TDD,
  watched red (16 failures) before implementing.
- **`deleteObject(key)`** added to `src/lib/storage/r2.ts`
  (DeleteObjectCommand, logged to api_usage as `r2/delete`).
- **UI (`AttachmentBuckets.tsx`)** — `deleteFile`/`deleteBucket` call the
  routes; state updates **only on server success**; real error toasts on
  failure (rename got one too); green success toasts.

## Post-merge incident — stale tab leaked one last time

Right after the dev→main merge, Nic deleted the DESIGNER JO bucket from a
tab still running the **pre-fix bundle** (an open tab keeps old JS until
refreshed; production had only just deployed). Old client-side path ran:
bucket row deleted via RLS, both PDFs orphaned into job chat. Confirmed by
data: both rows had `bucket_id = NULL`, and the new code cannot produce that
state. The new route was verified live (unauth DELETE probe → 401, not 405).
Cleanup: one-off script (Nic approved past the permission block) deleted
both R2 objects + rows; verified **0 orphaned attachment rows on any job**.

**Lesson: after a production deploy, refresh open tabs before testing.**

## Facts worth keeping

- **RLS is deny-by-default *per command*** — SELECT/INSERT policies existing
  says nothing about DELETE/UPDATE. A missing policy fails silently: 200,
  zero rows, no error. Never trust a client-side write without checking the
  result (or better: route it through the server).
- Orphaned `kind='attachment'` rows with `bucket_id NULL` are
  indistinguishable from legitimate chat attachments by columns alone —
  don't create them.
- The archive mirror note stands: R2 deletes reach
  `E:\Greenqubes-Archive\r2` at the next 02:00 sync (mirror, not history).

## Key files

| File | Change |
|---|---|
| `src/lib/storage/job-file-permissions.ts` (+ `.test.ts`) | delete permission rules (23 tests) |
| `src/lib/storage/r2.ts` | `deleteObject()` helper |
| `src/app/api/files/[id]/route.ts` | new — delete one attachment (R2 + row) |
| `src/app/api/buckets/[id]/route.ts` | new — delete bucket + its files properly |
| `src/features/job-detail/AttachmentBuckets.tsx` | deletes via routes, error surfacing |

## ⚠️ Notes for next session

- Chat attachments and production photos have **no delete button at all** —
  same missing-policy territory if one is ever added client-side. Any future
  delete surface should reuse `DELETE /api/files/[id]`.
- The old checklist items about R2 object versioning / dated snapshots are
  now more relevant: deletes are real, so a mistaken delete is unrecoverable
  after the next 02:00 mirror sync.
