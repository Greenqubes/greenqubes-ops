# Sub POC / Coordinators — Design Spec

_Date: 2026-05-21_

## Goal

Allow multiple coordinators (any provisioned user, any role) to be added to a job. When coordinators are saved, fire `tplJobAssigned` Telegram notifications to newly added ones only.

---

## Database

**New table — migration `0029_job_coordinators.sql`:**

```sql
create table job_coordinators (
  job_id  uuid not null references jobs(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  primary key (job_id, user_id)
);
```

**RLS policies on `job_coordinators`:**
- Sales / scheduler / admin: full read + write
- Installer: read-only (SELECT only)
- Public: no access

---

## API

**Extend existing `POST /api/jobs/[id]/notify-assigned`:**

- Accept `coordinatorIds: string[]` alongside existing `installerIds: string[]`
- Fetch `telegram_chat_id` for all coordinator IDs, send `tplJobAssigned` to each
- Diff logic (only notify newly added) is handled by the caller (JobDetailShell) — pass only the delta, not the full list

**New query — `src/lib/supabase/queries/coordinators.ts`:**

- `getJobCoordinators(jobId)` — returns `{ id, name }[]` for a job
- `setJobCoordinators(jobId, userIds[])` — upserts the full coordinator set (delete removed, insert new), returns `{ added: string[], removed: string[] }` for the notification diff

---

## UI

**Both forms — Team card, below Person-in-Charge:**

Replace the "Coming soon" placeholder with a multi-chip selector:

- Selected coordinators shown as removable pills (`name + ×`)
- "Add coordinator" opens a dropdown list of all provisioned users not already selected (excludes the Person-in-Charge)
- Installer view: read-only list of coordinator names as plain pills (no ×)
- `readOnly` prop locks the field for sales on `awaiting_approval` / `scheduled`

**Components:**
- `src/components/MultiUserSelect.tsx` — reusable chip selector (user id → name pills)
- Wired into `JobDetailShell.tsx` (edit form) and `NewJobShell.tsx` (new job)

**State in JobDetailShell:**
- `selectedCoordinatorIds: string[]` — local state, initialised from `getJobCoordinators`
- On save: call `setJobCoordinators`, get back `added[]`, pass to `notify-assigned` as `coordinatorIds`

**State in NewJobShell:**
- `selectedCoordinatorIds: string[]` — local state, default `[]`
- On save: insert job, then insert rows into `job_coordinators`, fire notify-assigned with full list (all are new)

---

## Data flow

```
User adds coordinator pills in UI
  → selectedCoordinatorIds (local state)

On save (JobDetailShell):
  → setJobCoordinators(jobId, selectedCoordinatorIds)
      → returns { added }
  → POST /api/jobs/[id]/notify-assigned { installerIds, coordinatorIds: added }
      → sends tplJobAssigned to each with telegram_chat_id

On save (NewJobShell):
  → insert job row
  → insert job_coordinators rows
  → POST /api/jobs/[id]/notify-assigned { installerIds, coordinatorIds: all }
```

---

## Notification

Reuses `tplJobAssigned` template — same message installers receive. No new template needed for now.

---

## Out of scope

- Coordinator-specific notification template (deferred)
- Coordinators receiving chat notifications (separate feature)
- Coordinator access control changes (they keep their existing role's access)
