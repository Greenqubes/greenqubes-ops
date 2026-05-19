# Job Form Redesign + Attachment Buckets + Installer Admin Fields

_Date: 2026-05-20_

---

## Overview

Three connected changes to the job creation and edit experience:

1. **New job form redesign** — updated layout and interactions matching the approved mockup (v3), including a custom client/POC dropdown, installer toggle grid, and new action buttons.
2. **Attachment buckets** — replace the flat `AttachmentSection` with a modular named-bucket system. Per-job, default buckets auto-created on job save. Each bucket supports images (lightbox), file attachments (download), and URLs (clickable link).
3. **Installer admin fields** — add `years_experience` and `skills` tag-chip inputs to the Admin → Users tab when editing an installer account.

---

## What Stays the Same

- All existing DB columns on `jobs`, `files`, `job_assignees`, `users` — no removals.
- `CoreSection.tsx` field logic (react-hook-form wiring, validation, TimeSelect, punctuality toggle, checkboxes) — only visual and interaction changes.
- `SuggestField.tsx` API call to `/api/ai/suggest` — only the button label and panel UI changes.
- `JobDetailShell.tsx` — not touched in this spec. Changes are isolated to `NewJobShell` and the shared section components.
- All existing RLS policies and Telegram notification routes.

---

## Part 1 — New Job Form Redesign

### 1.1 Layout

Page order (top to bottom):
1. Back arrow + page title ("New job", Fraunces serif)
2. Core fields card
3. Installers section
4. Attachment buckets
5. Action bar: `Cancel` | `Save as pending` | `Send for approval`

The sticky header with the single Save button is removed. The action bar is fixed at the bottom of the page content (not sticky — just below the last section).

### 1.2 Core Fields Card

Fields shown (in order):
- Date + Day (side by side; Day is a read-only display that auto-updates from Date)
- Company (renamed from "Client" — custom dropdown with delete — see 1.3)
- Client POC Name (dependent dropdown, scoped to selected company — see 1.3)
- Client Phone (plain text input, always manual — see 1.3)
- Project Title (with Improve button)
- Job Description (with Improve button)
- Location / Address
- Time Start + Time End (existing TimeSelect — unchanged)
- Punctuality toggle (existing — unchanged)
- Production Ready + DO Issued checkboxes (existing — unchanged)
- Sales / POC (custom dropdown — see 1.4)
- Notes (with Improve button, optional)
- Production Instructions (with Improve button, optional)

**Day display:** derives day-of-week from the `date` field value using `new Date(date + 'T00:00:00')`. Shown in amber, read-only.

### 1.3 Company + Client POC Fields

These three fields replace the existing plain `client`, `client_poc_name`, `client_poc_phone` inputs. The `jobs` table columns remain unchanged — they still store text. Two new DB tables power the dropdowns (see Part 4 — DB changes for client tables).

#### Company dropdown

- Options come from the `clients` table (`SELECT id, name FROM clients ORDER BY name`).
- Search bar always visible inside the open dropdown. Scrolling always works.
- "Add new company…" at the bottom: user types a name → inserts a new row into `clients` → selects it.
- **X button** beside the selected company name (shown after a company is selected). Clicking X opens a warning modal:
  > "This will permanently remove **[Company Name]** and all associated client contacts. Are you sure?"
  > `Cancel` | `Yes, remove`
  - On confirm: DELETE from `clients` (cascades to `client_contacts`). Clears the company + POC fields on the form. Does **not** affect existing jobs (they already store the text value).
- When no company is selected, the Client POC Name and Client Phone fields are disabled/greyed out.

#### Client POC Name dropdown

- Options come from `client_contacts` filtered by the selected company (`SELECT id, name FROM client_contacts WHERE client_id = ? ORDER BY name`).
- Same dropdown style as Sales/POC (search bar, scroll).
- "Add new contact…" at the bottom: user types a POC name → inserts into `client_contacts` linked to current company → selects it.
- **X button per option** inside the open dropdown list (not on the trigger) — clicking X beside a contact name removes that contact from `client_contacts` permanently. No warning modal needed (lower stakes than deleting a company).
- Selecting a contact sets `jobs.client_poc_name` to that contact's name.
- When company changes, POC name resets to empty.

#### Client Phone

- Always a plain `<Input type="tel">` — never a dropdown. Not stored in `client_contacts`.
- No auto-fill. User types manually every time (phone numbers change frequently).
- Saves to `jobs.client_poc_phone`.

### 1.4 Custom Dropdown (Sales/POC)

A shared `SearchableSelect` component used by Sales/POC (and internally by Company and Client POC). Behaviour:

- **Sales/POC:** options from `users` where `role IN ('sales', 'scheduler', 'admin')`. Defaults to the currently logged-in user. Scheduler/admin can override.
- Search bar always visible. Closes on outside click or Escape key.
- Props: `value: string`, `onChange: (v: string) => void`, `options: {label: string, value: string}[]`, `onAddNew?: (name: string) => void`, `onDeleteOption?: (value: string) => void`.

### 1.5 Improve Button (SuggestField update)

`SuggestField.tsx` changes only — no API route change:

- Button label changes from `✦ Suggest` to `✦ Improve`.
- Suggestion panel redesign:
  - Dashed terracotta border, soft terracotta background.
  - "✦ IMPROVE" header (small caps, terracotta).
  - "YOUR ORIGINAL" label + original text in muted.
  - "SUGGESTED" label + suggested text (diff highlights where text changed — underlined terracotta).
  - Buttons: `Keep mine` (border/paper) | `Use this` (terracotta filled). "Accept" → "Use this", "Dismiss" → "Keep mine".
- Panel appears below the input (not above), same as before.

### 1.6 Installer Toggle Grid

`AssigneeSection.tsx` is replaced with a new `InstallerGrid.tsx` for the new job form. (The existing `AssigneeSection` stays in place in `JobDetailShell` for the edit page — it works differently because it saves to `job_assignees` immediately on change for existing jobs.)

`InstallerGrid.tsx` behaviour:
- Receives `allInstallers: InstallerUser[]` (all users with `role = 'installer'`).
- Displays all installers as toggle buttons in a 2-column grid (`grid-cols-2`, `grid-cols-1` on mobile < 480px).
- Scrollable container with `max-height` capped at ~5 rows (≈ 290px). "Scroll to see more" hint disappears when scrolled to bottom.
- Each card shows: avatar (initials, colour-coded), name, role · years · skills.
- Clicking toggles selection (green highlight + checkmark). Clicking again deselects.
- Selected installer IDs are tracked in local state and passed back via `onChange: (ids: string[]) => void`.
- On job save, selected IDs are inserted into `job_assignees` after the job is created.

**`InstallerUser` type extended** (in `queries/jobs.ts`):
```ts
export type InstallerUser = {
  id:               string
  name:             string
  phone:            string | null
  role:             string          // added
  years_experience: number | null   // added
  skills:           string[]        // added
}
```

Query for all installers updated to `SELECT id, name, phone, role, years_experience, skills FROM users WHERE role = 'installer'`.

### 1.7 Action Bar

Three buttons, right-aligned:

| Button | Style | Action |
|---|---|---|
| Cancel | border/paper | `router.back()` |
| Save as pending | amber border + soft amber bg | INSERT job with `status = 'pending'`, create default buckets, insert selected installers into `job_assignees`, redirect to `/jobs/[id]` |
| Send for approval | terracotta filled | INSERT job with `status = 'awaiting_approval'`, create default buckets, insert selected installers, fire scheduler notifications (see 1.7), redirect to `/jobs/[id]` |

### 1.8 Send for Approval notification

When "Send for approval" is clicked:
- Job inserted with `status = 'awaiting_approval'`.
- After insert, POST to `/api/jobs/[id]/submit` to trigger Telegram notifications to all schedulers and create in-app bell notifications. This route already exists.
- **No clash check on creation** — clash detection runs on the edit page if the job is modified before the scheduler acts. Scheduler can send it back if there is a clash.
- Redirect to `/jobs/[id]` on success.

---

## Part 2 — Attachment Buckets

### 2.1 Database — Migration 0025

```sql
-- New table: named attachment buckets per job
create table public.attachment_buckets (
  id         uuid primary key default gen_random_uuid(),
  job_id     uuid not null references public.jobs(id) on delete cascade,
  name       text not null,
  position   integer not null default 0,
  created_at timestamptz not null default now()
);

-- RLS: same read/write access as files
alter table public.attachment_buckets enable row level security;
-- (policies mirror the files table RLS patterns)

-- Add bucket_id FK to files (nullable — existing file kinds unaffected)
alter table public.files
  add column if not exists bucket_id uuid references public.attachment_buckets(id) on delete set null;

-- Add url_text for URL-kind items (replaces using r2_key as the URL)
-- Note: existing url_link kind already stores URL in r2_key — this column is for bucket URLs only
alter table public.files
  add column if not exists url_text text;
```

Default buckets created when a job is first saved:
- `PERMIT-TO-WORK`, `BCA`, `DESIGNER JO`, `OTHERS` (positions 0–3)
- Created in the job creation API handler after job INSERT, before redirect.

### 2.2 New Component: `AttachmentBuckets.tsx`

Replaces `AttachmentSection.tsx` in both `NewJobShell` and `JobDetailShell`. `AttachmentSection.tsx` is kept for now but becomes unused — remove in a follow-up cleanup.

Props:
```ts
interface Props {
  jobId:   string
  lang:    LangCode
  readOnly?: boolean
}
```

The component fetches its own data (buckets + their files) via Supabase client query on mount, and re-fetches after any mutation. This keeps `NewJobShell` and `JobDetailShell` free of bucket-specific prop drilling.

**On the new job form (`/jobs/new`):** buckets cannot exist before the job is saved (there is no `jobId` yet). The new job form shows a locked placeholder card in place of `AttachmentBuckets` with the message "Save the job first to add attachments." After saving, the user is redirected to the edit page where the full bucket UI is available. This mirrors the existing pattern for the locked chat section on the new job form.

**Bucket rendering:**
- Each bucket: header (editable name + 3 action buttons + trash icon) + body (list of items).
- Name editing: the bucket name input is always visible. Changes save on blur via PATCH to bucket.
- Trash icon: deletes the bucket. If bucket has files, show a confirmation (e.g., "Delete bucket and its X files?").
- "+ Add bucket" button at the bottom creates a new bucket with name "NEW BUCKET" and auto-focuses the name input.

**Three upload actions per bucket:**

| Button | Behaviour |
|---|---|
| Image | `<input type="file" accept="image/*" multiple>` → upload to R2 via existing signed-URL helper → insert into `files` with `kind='attachment'`, `bucket_id` set, `url_text = null` |
| Attachment | `<input type="file" multiple>` (no accept filter) → same R2 upload → same insert |
| URL | Opens a small modal: text input for the URL, "Add link" button → insert into `files` with `kind='url_link'`, `bucket_id` set, `url_text` = the URL, `r2_key = ''` |

**Item rendering by type:**

| Type | Detection | Render |
|---|---|---|
| Image | `kind = 'attachment'` and filename ends in `.jpg/.jpeg/.png/.gif/.webp` | Thumbnail (70×54px). Click → lightbox modal (full image + X button). |
| File | `kind = 'attachment'` and not an image | File row: coloured icon box (PDF/DOC/XLS/ZIP/other) + filename + type label + download arrow. Click → existing `DownloadButton` signed-URL flow. |
| URL | `kind = 'url_link'` | URL row: link icon + truncated URL text. Click → `window.open(url, '_blank')`. URL from `url_text` column (falls back to `r2_key` for legacy records). |

**Image Lightbox:** a new `ImageLightbox.tsx` component. Semi-transparent backdrop, centred image (`max-w-[90vw] max-h-[85vh]`), X button top-right, closes on backdrop click or Escape key.

### 2.3 API changes

- Bucket CRUD: handled directly via Supabase client (RLS enforces access). No new API routes needed for create/rename/delete.
- File upload to bucket: reuses existing R2 signed-URL upload helper (`/api/r2/upload-url`). The `bucket_id` is passed as metadata and inserted into `files` after upload completes.
- URL add: direct Supabase insert from client (no API route needed).

---

## Part 3 — Installer Admin Fields

### 3.1 Where to add

In `src/features/admin/UsersTab.tsx` (or equivalent), in the user editing UI for installer-role accounts. The DB columns `years_experience` and `skills` already exist (migration 0021).

### 3.2 Fields added

When editing a user with `role = 'installer'`:

**Years of experience:** number input. Accepts positive integers. Saved to `users.years_experience`.

**Skills:** tag chip input. UX:
- Text input at the end of the chip list.
- Press Enter or comma to add a skill chip.
- Each chip shows the skill text + an × button to remove.
- Saved as `text[]` to `users.skills`.
- Pre-populated from existing `skills` array on load.

### 3.3 Query update

`InstallerUser` type and the query fetching all installers (used by `InstallerGrid`) must include `years_experience` and `skills` so the installer toggle cards can show them.

---

## Part 4 — Client/Company DB Tables

### 4.1 Migration 0026

```sql
-- Company/client names
create table public.clients (
  id   uuid primary key default gen_random_uuid(),
  name text not null unique
);

-- POC names per company (phone is NOT stored here — always manual on the job)
create table public.client_contacts (
  id        uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name      text not null
);

-- Seed company names from existing job data
insert into public.clients (name)
select distinct client from public.jobs
where client is not null and client <> ''
on conflict (name) do nothing;

-- RLS: authenticated users can read; sales/scheduler/admin can insert/update/delete
alter table public.clients enable row level security;
alter table public.client_contacts enable row level security;
-- (policies follow the same pattern as other public-internal tables)
```

### 4.2 No jobs table changes

`jobs.client`, `jobs.client_poc_name`, `jobs.client_poc_phone` stay as text columns. The new tables power the dropdowns only — they don't replace the stored values on jobs. This means existing jobs are unaffected.

### 4.3 API routes needed

- `GET /api/clients` — returns all companies from `clients` table
- `POST /api/clients` — creates a new company
- `DELETE /api/clients/[id]` — deletes company + cascades to contacts
- `GET /api/clients/[id]/contacts` — returns POC names for a company
- `POST /api/clients/[id]/contacts` — creates a new POC name
- `DELETE /api/clients/contacts/[id]` — removes a single POC

All protected by Supabase auth session (no role restriction — all roles can manage client data).

---

## Out of Scope (this spec)

- Edit page (`JobDetailShell`) redesign — `AssigneeSection` stays as-is there for now.
- Financials section.
- Bulk delete jobs (separate spec).
- Scheduler send-back / delete buttons on scheduled jobs (separate spec).
