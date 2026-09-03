# Provisioning Overhaul — Card-Only Users, Subroles, Driver, Qualifications

**Date:** 2026-09-03 · **Branch:** `feat-provision-organisation` (worktree off `origin/dev`)
**Why now:** Nic runs the live demo + company launch tomorrow (2026-09-04). Installer/team provisioning
won't happen in time, but their name cards must exist on the job form so assigning and trial usage
can start on day one.

## Decisions (Nic, 2026-09-03)

1. **Card-only users** — admin can create a person with just name + role, no email. Their card
   appears on every assignment surface immediately. Email is attached later in the edit form;
   the existing first-sign-in linking then works unchanged. Nothing is deleted or re-created.
2. **Subrole** — ONE free-text label per user (e.g. production → metalworks / printing / painting),
   typed with suggestions from subroles already used for that role. Subroles are **labels only** —
   zero effect on permissions; the seven-role model is untouched (CLAUDE.md hard rule).
3. **Qualifications** — any user, multiple tags (WAH, Safety Supervisor, …), free text with
   suggestions.
4. **Driver** — installer checkbox, badge-only behavior (no warnings, no blocking).
5. **Years of experience + skills** — hidden from every screen; DB columns stay for now.
   **Standing reminder: drop the columns in a later session** (they are redundant — Nic).
6. **Admin list filter** — role chips + subrole dropdown including **"No subrole"** (finds people
   not yet tagged; roles themselves are always set at provisioning, so no role-unassigned state).
7. **Rename** — provisioned users can be renamed (and given/corrected an email) without delete +
   re-add.
9. **Link-status DOTS (2026-09-03 round 2; reworked per Nic's artifact comments 2026-09-04)** —
   link status is a small colored **dot beside the name (left side)**, NOT a text chip ("too
   cluttered"): **red dot** = no email (card-only), **amber dot** = email entered, never signed
   in, **green dot** = signed in at least once. `title` tooltip carries the words (Unlinked /
   Linked). Shown on the admin Users page and job-form name cards ONLY — installer grid (incl.
   the merged crew bucket) + designer grid. NOT on pickers, FCFS panel, or clash rows.
   Replaces the old amber "not linked" admin badge.
9b. **Card layout rules (Nic's artifact comments, 2026-09-04)** — on every surface that shows
   them: **Driver** is a chip sitting **beside the name, right side, always**; **subrole** is a
   chip/tag (never flat text) — installers, designers and admin rows alike; **qualifications**
   are chips on **their own row below** the role/subrole row. Provision + edit forms: the
   subrole and qualifications inputs each get an **Insert button** (type anything → Insert adds
   it exactly as typed; type-ahead suggestions stay), and in Edit mode every inserted
   subrole/qualification tag shows an **×** to remove it.
10. **Support crew = the existing Sub-installer bucket, widened (Nic's call 2026-09-04: one
   merged bucket)** — the job form's existing collapsible sub-installer bucket is renamed
   **"Support crew"** and its pool widens from installers-only to installers AND every other
   role (except GreenqubesAI) — for dispatching production etc. onto the install team (night
   jobs, manpower shortage). Role/subrole chips on the cards tell people apart. **Zero
   migration, zero new component:** rows keep the existing `job_assignees.is_sub_installer =
   true` flag and the existing save/suggest routes, so everyone in the bucket inherits the
   "Supporting Role" Telegram, clash-check exclusion, FCFS-bar exclusion, and workload
   counting. New `getSupportUsers()` (non-installer pool, mirrors `getInstallerUsers`) feeds
   the merged pool = installer pool ∪ support pool, minus main-grid picks. Known cosmetic
   side-effect (accepted): assigned support crew appear in the schedule card's `Installer:`
   names line like subs do.
8. **Design Load board bars** — deliberately skipped (tiny chart labels, no room). Everything else
   card-shaped gains the new info; dropdown pickers and their selected pills deliberately excluded.

## Data model — migration `0051_user_subrole_driver_qualifications.sql`

```sql
alter table users add column if not exists subrole text;                          -- nullable, one label
alter table users add column if not exists is_driver boolean not null default false;
alter table users add column if not exists qualifications text[] not null default '{}';
```

Plus: extend the `guard_users_privileged_columns()` trigger function (from 0044) so
`subrole`, `is_driver`, `qualifications` join the protected set — non-admins must not edit their
own driver status or qualifications from the browser (same self-escalation logic as the 2026-08-13
audit fix; service role + admin sessions unaffected). `CREATE OR REPLACE FUNCTION` with the full
updated body — trigger itself unchanged.

No change needed for email-less rows: `email` is already nullable (0017) with a partial unique
index (`WHERE email IS NOT NULL`), and every consumer already handles `null`
(verified 2026-09-03 code map). `name` stays NOT NULL.

**Deploy order (feat-files lesson):** `npx supabase db push` BEFORE any code deploys — new code
SELECTs the new columns.

## API + queries

- `POST /api/admin/users` (`src/app/api/admin/users/route.ts`): `email` becomes optional —
  require only `name` + `role`. Accept optional `subrole`, `is_driver`, `qualifications`.
- `provisionUser` (`src/lib/supabase/queries/admin.ts`): allow `email: null` (skip the duplicate
  pre-check when null); insert the three new fields.
- `updateUser` patch type (`admin.ts`) + `PATCH /api/admin/users/[id]` body: add
  `name`, `email`, `subrole`, `is_driver`, `qualifications`. Email set/change: lowercase, rely on
  the partial unique index (catch `23505` → clear "already used" error). Service-role client
  bypasses the 0044 guard, as today. GreenqubesAI stays locked (no rename/remove, as today).
- `getAllUsers` select list: add the three new columns (drop nothing — `years_experience`/`skills`
  stay selected but unused, removed for real when the columns go).
- `getInstallerUsers` + `InstallerUser` type (`src/lib/supabase/queries/jobs.ts`): replace
  `years_experience, skills` with `subrole, is_driver, qualifications`, plus a derived
  `link_status: 'none' | 'pending' | 'linked'` (computed server-side from email/auth_id presence —
  raw emails/auth ids are not shipped to card components).
- `getDesignerUsers` (`src/lib/supabase/queries/designers.ts`): select `subrole, qualifications`
  and derive `link_status` too; the designer-option mapping in `src/app/jobs/new/page.tsx` +
  `src/app/jobs/[id]/page.tsx` passes them through.
- Clash route payload (`src/app/api/jobs/[id]/clashes/route.ts`): substitute candidates carry
  `subrole, isDriver, qualifications` instead of `yearsExperience, skills`.
- `getAllProvisionedUsers` (coordinators/POC dropdowns): unchanged — pickers don't show the info.

## Shared building block

- `src/lib/utils/user-meta.ts` — pure helpers: build the card meta model
  (subrole line, driver flag, qualification tags) from a user-ish object,
  `linkStatus({email, auth_id})` → `'none' | 'pending' | 'linked'` (red / yellow / green), and
  `filterUsers(users, role?, subrole?)` where `subrole === 'none'` means "No subrole".
  **New standalone test suite** `src/lib/utils/user-meta.test.ts` (repo convention: tsx script,
  exit 1 on failure).
- `src/components/UserMetaLine.tsx` — one small client-safe component rendering
  subrole text · Driver badge · qualification tag pills, compact variant for tight tiles.
  Reused by all card surfaces below so they can't drift.
- `src/components/SuggestInput` (or local to UsersTab if trivial) — text input with suggestion
  list computed client-side from the already-loaded users (single value for subrole; chip-adder
  for qualifications, reusing the existing skills-chip editor pattern in UsersTab).

## UI changes

**Admin → Users (`src/features/admin/UsersTab.tsx`):**
- Filter bar above the list: role chips (All + 7 roles) + subrole dropdown (distinct subroles of
  the currently listed users + "No subrole"). Client-side filtering; count label follows.
- ProvisionForm: email optional (helper text "Leave blank to create a name card only — attach
  their email later"); add subrole (suggest), Driver checkbox (installer role only),
  qualifications chips.
- UserRow: show subrole beside the role Pill, Driver badge, qualification tags, and the
  **link-status tag** (red "Unlinked" no email / yellow "Unlinked" email but never signed in /
  green "Linked" — replaces the old amber "not linked" badge). "Waiting for sign-in: {email}"
  line stays for yellow rows; red rows get "Card only — no email". Edit form: + Display name, + Email, + subrole,
  + Driver (installer), + qualifications; − Years of experience, − Skills.
- DeleteUserModal copy unchanged (card-only rows already hit the hard-delete path — correct).

**Job form:**
- `InstallerGrid` (also serves `SubInstallerBucket`): meta line becomes subrole (falls back to
  role label) + Driver badge; qualification tags line below; **link-status tag** (red/yellow
  "Unlinked" / green "Linked"); old `role · Ny · skills` line gone.
- `DesignerGrid` + `DesignerOption`: gains the same meta rendering under the name (subrole +
  qualification tags + **link-status tag**). Today it is name-only.

**FCFS `AssignmentPanel`:** assigned/suggested/newly-added rows gain UserMetaLine under the name
(no link-status tag — Nic scoped tags to admin + job-form grids only).
The add picker is a dropdown → unchanged.

**`ClashResolutionModal`:** substitute row meta swaps years/skills for UserMetaLine.

**Unchanged by design:** POC/Sub-POC/coordinator dropdowns + selected pills, chat avatars,
schedule text lines, external installers bucket (separate `external_contacts` system),
Design Load board bars, installer-facing views.

**i18n:** new strings in `en.ts` + `zh.ts` only (bn frozen, falls back to English).
Date/label hard rules unaffected.

## What card-only users can and cannot do

Can: be assigned/suggested on jobs, be POC/coordinator/designer, appear in FCFS + workload,
be renamed, be filtered. Cannot (until email added + first sign-in): sign in, link Telegram,
receive any notification (all sends already skip null `telegram_chat_id`), vote in digests.
This is the intended demo state.

## Testing

1. `npm run type-check` + all 17 existing suites stay green.
2. New `user-meta` suite (meta model + filter logic incl. "No subrole" + link-status derivation).
3. Manual preview pass: provision card-only users (several roles), tag subroles, tick Driver,
   add qualifications, verify cards on new-job + edit-job forms + FCFS panel, rename a user,
   attach an email to a card-only user, filter by role/subrole/"No subrole".
4. Deploy: db push → `dev` → preview verified by Nic → `main` tonight (demo is tomorrow).

## Follow-ups ledgered (not in this build)

- **Drop `years_experience` + `skills` columns + dead references** — reminder for a future
  session (Nic, 2026-09-03).
- Design Load board bars: revisit subrole display only if Nic asks.
- Bulk/faster provisioning for when real emails arrive (Nic answered "cards only" for now).
