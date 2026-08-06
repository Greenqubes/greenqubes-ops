---
session: ux-jobs (Job form — tabs + two-column reorganisation, Duplicate button)
date: 2026-08-06
branch: dev → main (live on production)
---

# Job Form Tabs + Duplicate Button — DONE, live on production

> The New/Edit job pages now share one responsive shell: **4 tabs on phone**
> (Details / Team / Files / Chat), **two columns on PC** (Details+Team |
> Files+Chat) with every card collapsible except Job Chat. The Duplicate (WIP)
> placeholder became a **working Duplicate button**, and a pre-existing
> production bug (bucket uploads leaking into job chat) was found and fixed.
> Smoke tests passed on phone + PC; `dev` merged into `main` the same day.

## What was done

1. **Full design loop before code** (both features): brainstorm with the visual
   companion (phone wireframes for jump-bar vs tabs vs accordion → Nic picked
   tabs, "cleaner the better"; 4-tab vs 5-tab grouping → 4; per-tab structure
   mockups; PC two-column mockup v1 → v2 with collapse chevrons) → specs
   (`docs/superpowers/specs/2026-08-05-job-form-tabs-design.md`,
   `docs/superpowers/specs/2026-08-05-duplicate-job-design.md`) → plans
   (`docs/superpowers/plans/2026-08-05-job-form-tabs.md`,
   `docs/superpowers/plans/2026-08-05-duplicate-job.md`) → inline execution in
   committed tasks (type-check + production build after every task).
2. **New `JobFormLayout` component** — the responsive shell. Below `lg`
   (1024px): sticky tab bar under the CompanyBar; **all four groups stay
   mounted** (tabs toggle CSS only) so form state, chat realtime, and uploads
   survive switching; opens on Details; `?tab=chat` opens on Chat. At `lg`+:
   no tabs, two flex columns, container widens `max-w-2xl → max-w-6xl`.
3. **New `CollapseCard` + `useCardCollapse`** — PC-only collapse (chevron
   hidden below `lg`), per-device memory in localStorage read **after mount
   only** (hydration #418 rule). Cards: Job details, Production, Team,
   Notifications placeholder, Attachments, Task list (self-managed — its
   header has live controls). Job Chat never collapses.
4. **`bare` mode** for `CoreSection` / `ProductionReadySection` (module-level
   frame components so inputs never remount) — the CollapseCard supplies the
   card chrome and title.
5. **New job page** — same shell: Files/Chat tabs greyed + locked pre-save;
   production instructions moved from the Team card into the Production card
   (now matches Edit); action bar became sticky-bottom with the edit page's
   chrome.
6. **Chat Telegram deep link** — the chat-batch notification URL gained
   `?tab=chat` (messages route); the job page passes it through server-side
   (no client searchParams reads — hydration-safe).
7. **Duplicate button** (`/api/jobs/[id]/duplicate`, service-role client):
   sales/scheduler/coordinator/admin, any status incl. completed. Copies all
   Details-tab fields (title + `" (Copy)"`), attachment buckets, bucket
   files/URL links, and production photos as **true R2 copies** (new
   `copyObject` in `r2.ts` — CopyObjectCommand, no egress). Location blanks
   (NOT NULL → empty string), POC = duplicator, notes/team/chat/tasks fresh,
   status pending; lands on the new job's edit page. Failed file copies don't
   abort — reported as `skippedFiles` in the toast.
8. **Bug fixed — bucket uploads appeared in job chat** (Nic found it testing
   Duplicate; **pre-existing on production**, not caused by the redesign):
   bucket files share kind `attachment` with chat uploads. Chat now excludes
   rows with a `bucket_id` in both paths — `getJobById` select gained
   `bucket_id` + JobDetailShell filters it, and ChatSection's realtime INSERT
   handler ignores bucket rows.
9. **Smoke tests passed on the preview** (phone + PC) for tabs, Duplicate, and
   the chat fix → `dev` merged into `main`, production verified.

## Key decisions

- **Tabs over jump-bar/accordion** on phone; **no tabs on PC** — two columns
  showing everything at once (Nic's vision), collapse instead of tabs there.
- **4 tabs, not 5** — Production lives inside the Details tab (no squeezed
  labels on narrow phones).
- **Duplicate scope**: only **location** clears among copied fields; production
  photos copy, signed DO / completion photos never; title gets `" (Copy)"`.
- **True storage copies** for duplicated files — the two jobs never share an R2
  object (safe against future file-cleanup; plays nice with the planned
  human-readable R2 folder rename).
- **Notifications placeholder** lives at the bottom of the Team tab; the real
  Telegram notification tracker is now a checklist future-planning item.

## Key files

| File | Change |
|---|---|
| `src/features/job-detail/JobFormLayout.tsx` | new — responsive tabs/columns shell |
| `src/features/job-detail/CollapseCard.tsx` + `useCardCollapse.ts` | new — PC collapse |
| `src/features/job-detail/JobDetailShell.tsx` | rewired into the shell; Duplicate button + handler |
| `src/features/job-detail/NewJobShell.tsx` | rewired; locked tabs; sticky action bar |
| `src/features/job-detail/{CoreSection,ProductionReadySection}.tsx` | `bare` prop |
| `src/features/job-detail/TaskListSection.tsx` | collapse chevron in its own header |
| `src/features/job-detail/ChatSection.tsx` | realtime handler ignores bucket files |
| `src/app/api/jobs/[id]/duplicate/route.ts` | new — duplicate endpoint |
| `src/app/api/jobs/[id]/messages/route.ts` | chat notification URL + `?tab=chat` |
| `src/app/jobs/[id]/page.tsx` | passes `initialTab` from `?tab=chat` |
| `src/lib/storage/r2.ts` | `copyObject` helper |
| `src/lib/supabase/queries/jobs.ts` | `bucket_id` on JobFile + selects |
| `src/lib/i18n/{en,zh}.ts` | tab/card/duplicate keys (no bn, per the freeze) |

No DB migrations.

## ⚠️ Notes for next session

- **Nic's standing priority: the full security + integrity audit** — it has now
  been queue-jumped twice (schedule UX, then this). Raise it first.
- New future-planning items in the checklist: **Telegram notification tracker**
  (behind the Team-tab placeholder) and **sub-jobs under a parent job**
  (dropdown) — both need their own design sessions.
- Pre-go-live cleanup still pending: wipe test jobs / external contacts / test
  installer; remove Nic's TG id from Wei Qing's row. Duplicate-testing copies
  ("… (Copy)" jobs) should be wiped in the same pass.
- Spec/plan files for this session are dated 2026-08-05 (session ran into
  2026-08-06) — filenames kept as committed; links in plan.md are correct.
- Hydration #418 on /schedule: still off-limits; this session kept all
  localStorage reads inside `useEffect` — consoles stayed clean.
