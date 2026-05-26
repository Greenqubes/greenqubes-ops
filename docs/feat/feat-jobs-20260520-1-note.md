# feat-jobs-20260520-1 — Job Form Redesign

**Date:** 2026-05-20
**Branch:** `feat-job-form-redesign` → merged to `main`
**Sessions:** Continued from previous context window (Tasks 1–11 done prior; Tasks 12–14 completed this session)

---

## What was built

### New components
- **`SearchableSelect`** — reusable dropdown with search, add-new inline, and per-item delete with confirm. Used for company, POC, and sales POC fields.
- **`InstallerGrid`** — 2-column toggle grid showing each installer's role, years of experience, and skills. Green ring + tick when selected. Used on new job form.
- **`ImageLightbox`** — fixed overlay image viewer. Escape + backdrop click to close.
- **`AttachmentBuckets`** — self-fetching bucket UI. Each bucket has a name input, Image / Attachment / URL action buttons, and per-file delete. Images open in lightbox. Files download via signed R2 URL. URL links open in new tab.

### DB migrations
- **0025** — `attachment_buckets` table (id, job_id, name, position); `bucket_id` and `url_text` columns added to `files`.
- **0026** — `clients` table (name unique); `client_contacts` table; backfill from existing `jobs.client` values.

### API routes
- `/api/clients` — GET list, POST create company
- `/api/clients/[id]` — DELETE company (cascades to contacts)
- `/api/clients/[id]/contacts` — GET by company, POST create contact
- `/api/clients/contacts/[id]` — DELETE single contact

### Job form changes
- **CoreSection** — Company field now uses `SearchableSelect` with add/delete. POC Name is a dependent select (disabled until company chosen). Sales POC dropdown shown on new job form only. Production instructions field always visible. Day-of-week label shown next to date (amber, read-only).
- **NewJobShell** — fully rebuilt: CoreSection with dropdowns, InstallerGrid card, locked Attachments + Chat placeholders, 3-button action bar (Cancel / Save as pending / Send for approval). Default buckets created on save.
- **JobDetailShell** — `AttachmentSection` replaced with `AttachmentBuckets`.

### Admin changes
- **UsersTab `UserRow`** — when editing an installer: shows Years of experience (number input) and Skills (chip input; Enter or comma to add, × to remove). Both saved in PATCH body.

### Types extended
- `InstallerUser` — added `role`, `years_experience`, `skills`
- `AdminUser` — added `years_experience`, `skills`
- `AttachmentBucket`, `BucketFile` — new types in `queries/jobs.ts`
- `supabase/types.ts` — `attachment_buckets`, `clients`, `client_contacts` table definitions; `files` extended with `bucket_id`, `url_text`

---

## Key files touched

| File | Change |
|---|---|
| `src/components/SearchableSelect.tsx` | Created |
| `src/components/ImageLightbox.tsx` | Created |
| `src/features/job-detail/InstallerGrid.tsx` | Created |
| `src/features/job-detail/AttachmentBuckets.tsx` | Created |
| `src/features/job-detail/CoreSection.tsx` | Rewritten |
| `src/features/job-detail/NewJobShell.tsx` | Rewritten |
| `src/features/job-detail/JobDetailShell.tsx` | AttachmentSection → AttachmentBuckets; FormValues extended |
| `src/features/admin/UsersTab.tsx` | Installer fields added |
| `src/lib/supabase/queries/jobs.ts` | Types extended, bucket queries added |
| `src/lib/supabase/queries/admin.ts` | AdminUser extended, updateUser Pick extended |
| `src/lib/supabase/types.ts` | New tables, files columns |
| `src/app/jobs/new/page.tsx` | Passes salesPocOptions + allInstallers |
| `src/app/api/clients/` | 4 new CRUD routes |
| `supabase/migrations/0025_attachment_buckets.sql` | Created + applied |
| `supabase/migrations/0026_client_tables.sql` | Created + applied |
| `CLAUDE.md` | feat-job-form-redesign branch rule added |

---

## Branch workflow change

`feat-job-form-redesign` is now the permanent branch for all job form edits. It pushes directly to `main` after preview confirmation — does not go through `dev`. This is documented in `CLAUDE.md`.

---

## Concurrent agent notes

Another agent (chat/notifications work) also committed to `feat-job-form-redesign` during this session — specifically chat notification throttle (ChatSection, messages route, telegram, migration 0027). No file overlaps with job form files. Both agents' commits merged cleanly.

---

## What's next

- **Schedule page visual overhaul** — Nic to share target design screenshot before spec/coding begins.
- **Bulk delete jobs** — Design A chosen (always-on checkboxes, bottom delete bar). Spec + plan still needed.
- **Scheduler: send scheduled job back to sales** — "Send Back" button on scheduled job edit page.
- **AdminRoleModal double-Yes bug** — state race condition, needs investigation.
- **Assistant history sidebar refresh delay** — optimistic update deferred; polish item for after pre-alpha.
