# Session 16 — R2 upload helpers + Cloudflare Images binding + backup.sh

> Read alongside `CONTEXT.md` and `plan.md` at session start.

_Done: 2026-05-04_

---

## What was built

### Storage helpers

**Updated files:**
```
src/lib/storage/r2.ts
scripts/backup.sh
```

**New files:**
```
src/lib/storage/cfImages.ts
src/app/api/cfimages/upload-url/route.ts
```

**Updated callers:**
```
src/app/api/r2/upload-url/route.ts
src/features/job-detail/ChatSection.tsx
```

---

## `src/lib/storage/r2.ts` — kind-aware helpers

Replaced the generic `getUploadUrl(key, contentType)` (where the client built the key) with:

| Export | Purpose |
|---|---|
| `generateKey(jobId, kind, originalName)` | Consistent R2 key: `jobs/{id}/{folder}/{uuid}.{ext}`. UUID prevents collisions. |
| `isImageKind(kind)` | `true` for `photo` and `completion` |
| `validateContentType(kind, contentType)` | photo/completion → `image/*`; voice → `audio/*`; do/attachment → any |
| `getUploadUrlForKind(jobId, kind, filename, contentType)` | Generates key server-side, returns presigned PUT URL + key |
| `getDownloadUrl(key)` | Unchanged — 3600s signed GET |

Key path convention:
```
jobs/{jobId}/photos/{uuid}.jpg
jobs/{jobId}/completion/{uuid}.jpg
jobs/{jobId}/voice/{uuid}.webm
jobs/{jobId}/do/{uuid}.pdf
jobs/{jobId}/attachments/{uuid}.xlsx
```

---

## `/api/r2/upload-url` — updated contract

**Before (insecure):** client passed `{ key, contentType }` — client controlled the key path.

**After:** client passes `{ jobId, kind, filename, contentType }`. Server generates the key, validates kind + content-type before issuing the presigned URL.

Response: `{ url, key }` — client gets the key back to store in the DB.

---

## `src/lib/storage/cfImages.ts` — Cloudflare Images binding

| Export | Purpose |
|---|---|
| `getCfImagesUploadUrl()` | Calls `POST /accounts/{id}/images/v2/direct_upload` → returns `{ uploadUrl, id }` |
| `getCfImagesDeliveryUrl(imageId, variant?)` | Constructs `{CF_IMAGES_DELIVERY_URL}/{imageId}/{variant}` |

Client flow for photo upload (to be wired in Session 18):
1. Call `POST /api/cfimages/upload-url` → get `{ uploadUrl, id }`
2. Client uploads file directly to `uploadUrl` (Cloudflare handles resize)
3. Store `id` in `files.cf_image_id` (migration needed — planned for Session 18)
4. Serve thumbnails via `getCfImagesDeliveryUrl(id, 'thumbnail')`

---

## `/api/cfimages/upload-url` — new route

Auth-gated POST. Calls `getCfImagesUploadUrl()`, returns `{ uploadUrl, id }`. Used by any future photo upload UI to get a one-time direct upload URL from Cloudflare Images.

---

## `ChatSection.tsx` — updated callers

Both upload calls now send `{ jobId, kind, filename, contentType }` and read `key` from the response instead of building it client-side.

---

## `scripts/backup.sh` — cold-archive

Runs on the server PC (daily at 03:00 SGT). Two operations:

1. **R2 sync** — `rclone sync greenqubes-r2:greenqubes-files → BACKUP_ROOT/r2`
2. **Supabase DB dump** — `pg_dump` via the Supabase direct connection URI, gzipped to `BACKUP_ROOT/db/greenqubes-{timestamp}.sql.gz`

30-day retention: old DB dumps pruned automatically. R2 sync keeps a full mirror (deleted files in R2 are deleted locally too — intentional; the drive is a point-in-time cold mirror, not a permanent archive).

Environment variables required:
- `SUPABASE_DB_URL` — Supabase direct connection URI (from Dashboard → Settings → Database)
- `BACKUP_ROOT` — path to external drive (default: `D:/Greenqubes-Archive`)
- `R2_REMOTE` — rclone remote name (default: `greenqubes-r2`)

Setup instructions and Task Scheduler/crontab commands are in the script header.

---

## What's next

- Session 17: Deploy preview to Vercel (connect repo, env vars, confirm build passes, re-point Telegram webhook)
