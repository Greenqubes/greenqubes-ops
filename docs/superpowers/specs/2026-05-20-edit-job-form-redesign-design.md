# Edit Job Form — Redesign Spec

_Date: 2026-05-20_
_Status: Approved for implementation_

---

## Goal

Redesign the layout of the edit job form (`/jobs/[id]`) to match the visual pattern established by the new job form. This is a **layout-only change** — all existing business logic, API calls, and component behaviour are preserved. No new features are introduced in this round.

---

## Reference

- Scheduler/Sales mockup: `.superpowers/brainstorm/1710-1779285373/content/edit-form-redesign-v3.html`
- Side-by-side comparison (Scheduler vs Installer): `.superpowers/brainstorm/1710-1779285373/content/edit-form-comparison-v2.html`
- New job form reference: `src/features/job-detail/NewJobShell.tsx`
- Screenshots provided by Nic (2026-05-20 session)

---

## Files Affected

| File | Change |
|---|---|
| `src/features/job-detail/JobDetailShell.tsx` | Major restructure — remove sticky header, add bottom action bar, reorder sections |
| `src/features/job-detail/CoreSection.tsx` | Remove Sales/POC, Notes, Production Instructions fields; remove Date End / always show Day; always use SearchableSelect dropdowns (no plain-input fallback) |
| `src/features/job-detail/ProductionReadySection.tsx` | Add Production Instructions field (moved from CoreSection) |
| `src/features/job-detail/InstallerGrid.tsx` | Add `initialSelectedIds` prop for pre-selecting assigned installers; fix avatar check badge clipping (move badge outside avatar div to fix `overflow: hidden` clipping) |
| `src/app/jobs/[id]/page.tsx` | Load `salesPocOptions` (sales users list) to pass to CoreSection — same pattern as new job page |

**Unchanged:** `ChatSection.tsx`, `AttachmentBuckets.tsx`, `TimeSelect.tsx`, all API routes.

**Deleted:** `src/features/job-detail/AssigneeSection.tsx` — replaced by `InstallerGrid` in the Team card. Confirm no other files import it before deleting.

**Removed from layout (component kept):** `StatusSection.tsx` — no longer rendered in `JobDetailShell`; its logic is absorbed into the action bar buttons.

---

## Section Order (top → bottom)

1. Header
2. Core card
3. Production section _(all roles — read-only for installers)_
4. Team card
5. Attachments card
6. Chat section _(unchanged component)_
7. Notifications placeholder card
8. Action bar

---

## Section Detail

### 1. Header

- **Non-sticky** — scrolls with the page (remove `sticky top-0 z-10` from current header)
- Back link: `← Schedule` (ArrowLeft icon + "Schedule" text), links to `backHref`
- Title: `Edit job` (Fraunces, text-xl, font-semibold — matching new job form)
- Status pill: inline next to title (moved from sticky header)
- Awaiting-approval banner: kept below header when `status === 'awaiting_approval'`

### 2. Core Card

Fields in order:
1. Project Title (SuggestField)
2. Date + Day (2-col grid — Day display replaces Date End)
3. Company (SearchableSelect — always, not conditional on `useDropdowns`)
4. Contact Person (SearchableSelect) + Phone input below
5. Job Description (SuggestField + textarea)
6. Location / Address (Input)
7. Time Start + Time End (2-col grid, TimeSelect)
8. Punctuality (toggle buttons)
9. Production Ready + DO checkboxes (2-col grid)

**Removed from CoreSection:**
- `date_end` field (Date End) — replaced by Day display for all cases
- Sales/POC field — moves to Team card
- Notes field — moves to Team card
- Production Instructions field — moves to Production section
- `salesPocOptions` prop and `useDropdowns` flag — both removed; Company and Contact SearchableSelects become unconditional (always shown). Data loading for companies/contacts (`useEffect` fetching `/api/clients`) stays inside CoreSection unchanged.

### 3. Production Section

_Shown for all roles — but installers get a read-only view (see Installer View section below)._

Fields in order:
1. **Production Instructions** (SuggestField + textarea) — moved here from CoreSection; wired to `register('production_instructions')` and `watch/setValue` passed as new props to `ProductionReadySection`. The AI assist button is labelled **"Suggest"** (renamed from "Improve") for all roles.
2. Production Photos (existing) — view-only for installers (no "Add photo" button shown)
3. **Signed DO (Optional)** (renamed from "Signed DO / Proof") — all roles including installers can upload
4. Completion Photos (existing) — all roles including installers can upload

### 4. Team Card

New card in `JobDetailShell` — not inside `CoreSection`.

Fields in order:
1. **Main Sales / POC** (SearchableSelect, single select) — wired to existing `sales_poc_id` form field via `Controller`. This is the primary owner of the job.
2. **Sales / POC** (multi-select — UI placeholder this session, see below) — shows selected names as bubble chips. Wiring deferred to next session.
3. **Notes** (SuggestField + textarea, moved from CoreSection) — wired to `register('notes')`
4. **Installers** (InstallerGrid, replaces AssigneeSection)
   - `initialSelectedIds`: current `job.job_assignees` IDs pre-selected on mount
   - On save: diff selected IDs against initial IDs → delete removed assignees, insert added assignees via `job_assignees` table
   - `InstallerGrid` gets new optional prop `initialSelectedIds?: string[]`
   - Avatar check badge fix: move badge `<div>` outside the avatar `<div>` as a sibling (wrapped in `relative` container) to prevent `rounded-full` clipping

### 5. Attachments Card

`AttachmentBuckets` component — no changes.

### 6. Chat Section

`ChatSection` component — **no changes**. Carried over exactly as-is. Chat redesign is a separate future session.

### 7. Notifications Placeholder Card

Empty card reserving space for the `telegram-job-assign-notification-tracker` feature (future session).

```
Card header: "Notifications" (bell icon + label)
Body: muted placeholder text — "Coming soon — Telegram notification tracker"
```

No logic. Static display only.

### 8. Action Bar

Replaces both the sticky header Save button and the current `StatusSection`. Always at the bottom of the page (not sticky — inline with scroll).

Four buttons in two rows:

**Row 1 (top):** Delete | Mark job complete | Cancel
**Row 2 (bottom, full width):** Save & notify (terracotta primary)

| Button | Behaviour | Visibility |
|---|---|---|
| Delete | Opens existing `showDeleteModal` confirmation → hard-deletes job via `DELETE /api/jobs/[id]` → `router.push(backHref)` | Sales (pending only) + Scheduler |
| Mark job complete | Calls existing `handleStatusChange('completed')` | Scheduler (scheduled jobs only) |
| Cancel | `router.back()` | Always |
| Save & notify | Runs existing `handleSubmit(onSubmit)` save logic. Bell + Telegram notifications deferred to future session. | Always (disabled when not dirty, same as current save) |

`StatusSection` component is removed from the layout — all its logic is absorbed into these four buttons with the same role/status gates.

---

## Installer View (Role-Gated Differences)

When the logged-in user's role is `installer`, `JobDetailShell` renders a read-only variant. All differences from the Scheduler/Sales view are listed here.

### Header
- Title changes from **"Edit job"** to **"View job"**
- Back link label changes from "← Schedule" to **"← Back to Jobs"** (links to `backHref`)

### Core Card — installer changes
- **Date and time values** rendered bold (`font-semibold`) — day name and start/end times
- **Production Ready + DO row** (2-col grid in Scheduler/Sales view) is replaced by a single full-width **DO status button**:
  - If `do_required === true`: amber button — "Please Sign DO Provided" — highlighted, **not clickable**
  - If `do_required === false`: grey button — "No DO Required" — muted, **not clickable**
  - The Production Ready checkbox is hidden from installer view
- All other Core Card fields are read-only (no form inputs, no edit controls)

### Production Section — installer changes
- **Production Instructions**: text is displayed read-only (no textarea editing, no Suggest button)
- **Production Photos**: photos shown but no "Add photo" button
- **Signed DO (Optional)**: upload button **shown** — installer can upload
- **Completion Photos**: upload button **shown** — installer can upload

### Team Card — installer changes
- **Main Sales / POC**: shown as plain read-only text (name only — no dropdown)
- **Sales / POC**: shown as read-only bubble chips rendered inline (no container box, no border, no chevron). Chips float side by side with `display: flex; flex-wrap: wrap; gap: 5px`. Same chip style as edit form (`ms-tag`) but no X button. No outer box so chips are visible against the card's white background.
- **Notes**: shown as plain read-only text (no textarea, no Suggest button)
- **Installer grid**: shows **only the assigned installers** (no unselected / dimmed cards for unassigned users). Determined by `initialSelectedIds` — only render installer cards whose ID is in the pre-selected set.

### Attachments Card — installer changes
- "Add files" and "Add link" buttons are **hidden**
- Existing file names are shown as **clickable blue underlined links** that open in a new tab

### Notifications Card
- **Hidden** entirely for installer role

### Chat Section
- Unchanged — installers can read and send messages

### Action Bar — installer changes
- **All buttons removed** (Delete, Mark job complete, Save & notify)
- Single **full-width** button: **"← Back to Jobs"** — calls `router.back()`

---

## Data Loading Change

`src/app/jobs/[id]/page.tsx` needs to load sales users for the Sales/POC SearchableSelect:

```ts
// Same pattern as /jobs/new/page.tsx
const { data: salesUsers } = await supabase
  .from('users')
  .select('id, name')
  .eq('role', 'sales')
  .order('name')

const salesPocOptions = salesUsers?.map(u => ({ id: u.id, label: u.name })) ?? []
```

Pass `salesPocOptions` as a prop to `JobDetailShell`.

---

## Multi-Select Sales / POC — Next Session Handoff

This feature is **UI placeholder only** in the current session. The field is rendered but not wired to the database. The next session must complete the full implementation.

### What it is
A second "Sales / POC" row in the Team card, directly below "Main Sales / POC". Allows multiple additional sales/POC users to be tagged on a job (e.g., for notification routing, visibility, or co-ownership).

### Visual spec (already built in this session)
- **Edit form (Scheduler/Sales):** Multi-select input rendered as a bordered box (`border: 1px solid var(--line); border-radius: 8px`) containing bubble chips for each selected name. Each chip: `padding: 2px 7px; border-radius: 99px; background: var(--bg); border: 1px solid var(--line); font-size: 12px`. Chip includes an X (remove) button. Box includes a downward chevron icon on the right for dropdown affordance. "Add more…" placeholder shown when fewer than max selections.
- **Installer / View job:** Same bubble chip container but with `background: var(--bg)` to signal read-only. Chips show name only — no X button, no chevron, no placeholder text. Non-interactive.
- Reference mockup: `.superpowers/brainstorm/1710-1779285373/content/edit-form-comparison-v2.html` (Team card section on both phones)

### DB schema required (next session must create)
New junction table `job_poc_users` — same pattern as `job_assignees`:
```sql
create table job_poc_users (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references jobs(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  created_at timestamptz default now(),
  unique(job_id, user_id)
);
```
Enable RLS. Policy: scheduler + sales can insert/delete; all roles can select where job is theirs.

### Data loading (next session)
- On load (`page.tsx`): fetch `job_poc_users` for the job, resolve to user names via `users` table, pass as `pocUserIds: string[]` prop to `JobDetailShell`
- On save: diff selected IDs against initial IDs → delete removed rows, insert added rows in `job_poc_users` — same pattern as `job_assignees` diff in the same session

### Component changes (next session)
- `JobDetailShell.tsx`: replace the placeholder `<div>` with a real `Controller`-wired multi-select (use the same `SearchableSelect` component with a `multiple` prop, or build a `MultiSelect` wrapper if `SearchableSelect` doesn't support it)
- `src/app/jobs/[id]/page.tsx`: load `pocUserIds` alongside `salesPocOptions`

---

## Deferred Items (do not implement this session)

| Item | Notes |
|---|---|
| Date End field | Removed for now. Will be added back to both new job form and edit form together in a future session |
| Delete warning modal | Already built (`showDeleteModal`) — **include it** (reuse as-is). Scheduler and Sales (pending jobs only) see the Delete button. |
| Telegram notifications on Save & notify | Deferred — ops bot send to all assigned users |
| Bell notification on Save & notify | Deferred |
| `telegram-job-assign-notification-tracker` | Placeholder card only |
| Chat section redesign | `ChatSection.tsx` untouched — full redesign in a separate future session |
| InstallerGrid checkbox on new job form | Avatar check badge fix is part of this session (fix the component). The new job form will benefit automatically |

---

## Out of Scope

- No new API routes
- No DB schema changes
- No i18n string changes (existing keys reused)
- No changes to RLS or permissions
- No changes to `ChatSection`, `AttachmentBuckets`, `TimeSelect`
