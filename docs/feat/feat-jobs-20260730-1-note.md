---
session: feat-jobs (Workflow V2 — Phase 4 external links + sub-installers + task list)
date: 2026-07-30
branch: feat-workflow-v2 (all code + docs)
---

# Workflow V2 Phase 4 — External Links, Sub-installers, Task List (PASSED)

> Phase 4 is **complete and fully smoke-tested** (all 6 sections green, including two retests after
> Nic's feedback). **The Workflow V2 build is COMPLETE.** What remains: a full V2 regression test
> on the preview, then the one-shot clean-cut switchover to dev/main.

## What was done

Tasks 20–25 of `docs/superpowers/plans/2026-06-05-workflow-v2.md`, built to the four **approved
mockups** (external-installer-link, external-poc-bucket, sub-installer-section, task-list-section
— all tagged Approved; they supersede the plan's rough sketches, same rule as Phase 3).

### External installer persistent links (Tasks 20–22)

- **Migrations 0039 + 0040**: `external_contacts` (one row per outside person; lifetime `token`
  from **built-in `gen_random_uuid`** — `gen_random_bytes` broke db push, pgcrypto is NOT enabled
  on this DB), `job_external_contacts` (status pending/accepted/declined + `is_suggestion`/
  `suggested_by` from 0040 — plain uuid, **no users FK**, the 0035 PGRST201 lesson), `job_tasks`,
  `external_verification` file_kind (unused, future external uploads).
- **Public page `/ext/[token]`** (mobile-first, no login — the unguessable token IS the identity):
  greeting hero, **Needs response** with inline Accept/Decline, Upcoming, Past/Declined. Accepted
  jobs open a detail view: time ("arrive by" when strict), location, site contact, notes,
  **bucket attachments** (signed downloads; chat files NOT exposed), **interactive task list**
  with progress bar, Open in Maps, **person-in-charge call card** — live chat for externals was
  deliberately deferred by the plan. Deleted contact → "link no longer valid" screen.
- **Public API** under `/api/ext/[token]` (service-role after token validation): job list,
  respond (pending + non-suggestion rows only), accepted-job detail, task tick
  (`completed_by` stays NULL for externals). Middleware passes `/ext/` + `/api/ext/` through.

### External POC bucket in the Team card (Task 25 + Nic's feedback)

- **Every office role sees it** (Nic's smoke-test call — overrides the plan's manager-only gate):
  **sales SUGGESTS** an external (amber chip; the contact's page shows NOTHING until confirmed —
  same rules as installer suggestions), **scheduler/coordinator/admin** confirm by tapping
  "Sales suggested", assign directly, unassign, **add new** (mints + auto-copies the link),
  **delete** (warning shows affected active-job count; link dies instantly) and **restore**
  (same token, full history, restorable forever). **Designer/production: strictly view-only.**
- Chip colours: amber = assigned/awaiting response or suggestion, green = accepted, red = declined.
- **Copy-link composes from `window.location.origin`**, NOT `NEXT_PUBLIC_APP_URL` — that env var
  names production in every Vercel environment, so preview testing copied dead production links
  (found in smoke test). Clipboard failure falls back to a copyable prompt.

### Sub-installer bucket (Task 23)

- Collapsible bucket below the main installer grid: same pool minus main picks, same
  amber-suggestion (sales, via `suggest-installer` `is_sub` flag) → green-confirmation
  (new `sub-installers` route) rules. Confirmed subs get their own Telegram:
  **`tplSubInstallerAssigned` — "Job Assigned — Supporting Role"** with main-team names and
  "help the main team — check in with them once on site" (Nic's wording).
- `assign-installers` now touches **main rows only**; assigning someone as main absorbs their sub
  row (PK is one row per person per job). Subs are **excluded from clash detection** on the push
  check AND the edit check (Phase 3 rule) but still count in the workload chart. Installer
  visibility unchanged: a suggested sub must not see the job (0037 rule holds).

### Task list (Task 24)

- Optional card on the job form: office roles add / X-delete / Clear all / **drag-reorder via
  pointer events (works on touch)**; checkboxes decorative in edit mode. Installers + subs get
  interactive ticks with a progress bar and "All done"; externals tick on their link page.
  Non-editors see nothing when the list is empty. RLS: installers only read/tick tasks on jobs
  they are formally assigned to.

## Bugs found during testing — all fixed

| # | Symptom | Root cause | Fix |
|---|---|---|---|
| 1 | `db push` failed at statement 0 | `gen_random_bytes` needs pgcrypto — never enabled (only pgvector is) | Token default → dash-stripped built-in `gen_random_uuid()` (`e0735ac`) |
| 2 | Copied external link showed 404 | URL built from `NEXT_PUBLIC_APP_URL` = production domain in ALL Vercel envs; `/ext` doesn't exist on prod until switchover | Compose from `window.location.origin` (`3e7e479`) |
| 3 | Confirmed sub, Save & notify — no Telegram | Typo in the new template: `<\b>` (backspace char) instead of `</b>` — unclosed bold tag, Telegram rejected the message, route swallows send errors by design | One-character fix (`f382bbb`) |

## Key decisions

- **External bucket for every office role** (Nic): sales suggest, managers confirm/manage the
  pool, designer/production look only. Suggestions are invisible on the contact's page.
- **External chat deferred** (plan decision, made after mockup approval) — the person-in-charge
  call card stands in.
- **Sub Telegram is its own template** — helpers must know they're supporting, not leading.
- **Retest hygiene**: sub/assign routes only notify **newly added** people — re-saving the same
  person sends nothing. Remember this when smoke-testing notifications.

## ⚠️ Critical context for next session

- **V2 build is COMPLETE.** Next: **full V2 regression test** (Phases 1–4 together on the
  preview), then the **clean-cut switchover** — replace the old workflow on dev/main in ONE shot.
  Nothing merges to dev until then.
- Migrations **0001–0040 all applied** to the shared remote DB. 0039/0040 tables are inert for
  dev/main code — backward-compatible.
- `jobs` Row in types.ts finally gained `project_title` + `date_end` (existed in DB since
  0012/0013, never typed — old code cast around it). Typed clients now see them.
- Standing rules that keep biting: **never embed `users` onto `jobs`**; **suggested_by columns
  have NO users FK** (0035); **"preview as" changes UI role only** — RLS needs real logins;
  **overlays above BottomNav** (z-[60]+); **pgcrypto is not enabled** — use built-in RNG.
- Test data to wipe before go-live now also includes the **test external contacts** (delete from
  the bucket — their links die with them).
- Deferred/backlog: external page chat; accept/decline Telegram back to the office (not built —
  the office sees chip colours on refresh); FCFS extra views; schedule list scroll UX.

## Key files

| File | Change |
|---|---|
| `supabase/migrations/0039_external_contacts_tasks.sql` | external_contacts + job_external_contacts + job_tasks + RLS |
| `supabase/migrations/0040_external_suggestions.sql` | is_suggestion/suggested_by + office-wide RLS |
| `src/app/ext/[token]/page.tsx`, `src/features/external/*` | **new** — public link page (home, detail, formatters) |
| `src/app/api/ext/[token]/**` | **new** — public token API (list, respond, detail, tasks) |
| `src/app/api/external-contacts/**` | **new** — pool CRUD + soft delete/restore |
| `src/app/api/jobs/[id]/external-contacts/route.ts` | **new** — assign / sales-suggest / confirm / unassign |
| `src/app/api/jobs/[id]/sub-installers/route.ts` | **new** — sub confirm + Supporting Role Telegram |
| `src/app/api/jobs/[id]/tasks/route.ts` | **new** — task CRUD + reorder |
| `src/features/job-detail/ExternalPOCBucket.tsx` | **new** — role-aware bucket |
| `src/features/job-detail/SubInstallerBucket.tsx` | **new** — sub bucket (wraps InstallerGrid) |
| `src/features/job-detail/TaskListSection.tsx` | **new** — edit + tick views, pointer drag |
| `src/features/job-detail/JobDetailShell.tsx` | main/sub split, bucket wiring, sub save path |
| `src/app/api/jobs/[id]/{assign-installers,suggest-installer,clashes}/route.ts` | sub-aware (preserve/exclude sub rows) |
| `src/lib/telegram/templates.ts` | tplSubInstallerAssigned |
| `src/lib/supabase/queries/external.ts` | **new** — token validation + contact jobs (service role) |
| `middleware.ts` | `/ext/` + `/api/ext/` public |
| `src/lib/i18n/{en,zh,bn}.ts` | taskList* / subBucket* / extBucket* strings |
| `docs/workflow-v2-phase4-smoke-test.md` | Nic's tick-through — all green |
