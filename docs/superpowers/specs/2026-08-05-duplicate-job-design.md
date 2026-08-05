# Duplicate Job Button

**Date:** 2026-08-05
**Status:** Approved by Nic (pending spec review)
**Session:** ux-jobs (follows the job form tabs + two-column redesign, same session)

---

## Problem

Nic often runs the same project at a different location. Today that means re-typing
the whole job. The edit page has carried a disabled "Duplicate (WIP)" placeholder
button since ux-jobs 2026-05-21 — this feature makes it real.

## Decisions made during brainstorming (Nic, 2026-08-05)

- **Copies:** everything in the Details tab — project title, company, contact person
  + phone, description, date, times, punctuality, production-ready / DO ticks,
  production instructions, **production photos** — plus **all attachment buckets**
  (files and URL links).
- **Clears:** **location only** among the copied fields (blank, ready for the new
  site). Signed DO and completion photos never copy (proof for the original job).
  Team resets: person-in-charge becomes the duplicating user; coordinators,
  installers, sub-installers, external installers all empty. Notes, task list, and
  chat start empty. Status is **pending**.
- **Title gets a marker:** `" (Copy)"` is appended to the copied project title
  (e.g. "Vivienne Westwood Installation (Copy)"). An untitled job stays untitled.
- **True file copies:** stored files are copied object-by-object in R2 into the new
  job's folder (S3 CopyObject — no download/re-upload, no egress cost). The two jobs
  never share a stored object, so a future file-cleanup feature can't break one job
  by deleting the other's file. (Today nothing ever deletes R2 objects — job DELETE
  removes only DB rows — but shared keys would also fight the planned R2
  human-readable folder rename.)
- **Who can duplicate:** sales, scheduler, coordinator, admin (the roles that can
  edit core fields). Designer, production, and installer never see the button.
  Works on jobs of **any status, including completed** — repeating a past job is a
  prime use case.

---

## Design

### 1. API route — `POST /api/jobs/[id]/duplicate`

New route `src/app/api/jobs/[id]/duplicate/route.ts`, service-role Supabase client
for the inserts (same pattern as other job routes), auth via the session user:

1. **Auth + role gate:** signed-in user resolved to a `users` row; effective role
   (preview-as aware, via `getEffectiveRole`) must be sales / scheduler /
   coordinator / admin, else 403.
2. **Load source job** (404 if missing) and its `attachment_buckets` + the `files`
   rows to copy: rows **with a `bucket_id`** (bucket uploads are kind
   `attachment`, bucket links are kind `url_link`) plus rows of kind
   `production_instructions` (production photos). Chat attachments share kind
   `attachment` but have **no** `bucket_id` — they are excluded (chat starts
   empty). `do` and `completion` kinds are ignored.
3. **Insert the new job**: status `pending`, `location` empty string (column is
   NOT NULL), `project_title` = source title + `" (Copy)"` (null stays null),
   `sales_poc_id` = the duplicating user's id, `notes` null,
   `visibility: ['role:sales', 'role:scheduler']` (same as the new-job form).
   All other copied columns come straight from the source row. `scheduled_at`,
   `completed_at`, `approved_by` are not set (fresh pending job).
4. **Copy buckets**: insert one `attachment_buckets` row per source bucket (same
   name + position, new job_id), keeping an old→new bucket id map.
5. **Copy files**: for each source file row —
   - URL links (`url_text` set, no `r2_key`): insert row with the new job/bucket ids.
   - Stored files: `CopyObjectCommand` from the source `r2_key` to a new key under
     the new job id (reusing `generateKey()`'s naming), then insert the `files` row
     with the new key, new job/bucket ids, `uploader_id` = duplicating user, fresh `ts`.
   - A failed copy of one file does not abort the duplicate: skip it, count it, and
     report `skippedFiles` in the response so the client can mention it.
6. **Respond** `{ id: <new job id>, skippedFiles: n }`.

No DB schema changes. No Telegram notifications — duplicating is silent; the usual
notifications fire later when the job is pushed to schedule.

### 2. R2 helper

`src/lib/storage/r2.ts` gains `copyObject(sourceKey, destKey)` wrapping
`CopyObjectCommand` (the S3 client + bucket constant already live there).

### 3. The button (JobDetailShell)

- The disabled "Duplicate (WIP)" button becomes **Duplicate**, shown only when the
  effective role is sales / scheduler / coordinator / admin (reuses the existing
  `canEditCore` flag; installer/designer/production never see it). Shown regardless
  of job status — including completed.
- On tap: button disables and shows "Duplicating…", calls the route, then
  `router.push('/jobs/<newId>')` and a success toast ("Job duplicated — set the new
  location"). If files were skipped, the toast mentions how many. On failure: error
  toast, button re-enables, user stays put.
- No confirmation modal — the action is additive (nothing is overwritten) and easy
  to undo (delete the pending duplicate).

### 4. Out of scope

- Chat, task list, team assignments, external links: never copied (by design).
- No changes to clash checking, notifications, or the new tab layout.
- Bulk duplicate, "duplicate to multiple dates": not in this feature.

## Testing

Type-check + build, then on the preview:

1. Duplicate a job with attachments (files + URL links + production photos) —
   new pending job opens with everything except location; title ends in " (Copy)";
   files open/download correctly on the duplicate.
2. Delete a file on the duplicate → original job's copy unaffected (and vice versa).
3. Duplicate a completed job — works; duplicate is pending and editable.
4. Preview-as designer/production/installer — no Duplicate button.
5. Duplicate, then delete the duplicate — original untouched.
