# Session 18.3 — Additional Design Edits + Partial 17.6 Feature Pull-forward

_Written: 2026-05-07. All changes committed to `dev` and pushed to Vercel preview._

---

## What was done

Owner-directed design pass continuing from Session 18.2. Several Session 17.6 feature items (project title, schedule filter, button casing) were pulled forward at the owner's request. Session rule (visual/design + explicit owner feature requests).

---

## Changes applied

### Label renames (i18n — en/zh/bn)

| Old | New | Key |
|---|---|---|
| Client | Customer | `client` |
| Job description | Job Description | `jobDescription` |
| Location / address | Location / Address | `locationAddress` |
| Client contact name | Client Name | `clientPOCName` |
| Client contact phone | Client Contact No. (Optional) | `clientPOCPhone` |
| Create job | Create Job | `createJob` |
| Submit for approval | Submit for Approval | `submitForApproval` |
| Push to schedule | Push for Approval | `pushToSchedule` |
| Job chat | Job Chat | `jobChatTitle` |
| Files | Files / URL | `jobFiles` |
| Attach files | Attach Files | `attachFiles` |
| Save links | Save Links | `saveLinks` |

New keys added: `projectTitle`, `jobChatTitleLocked`, `chatLive`, `chatSyncing`, `pendingFiles`, `urlLinks`, `urlLinksPlaceholder`, `saveLinks`, `openLink`.

---

### Approval flow fix

| Change | File |
|---|---|
| Scheduler "Push for Approval" now sets status `awaiting_approval` (not `scheduled` directly) | `StatusSection.tsx` |
| All pending jobs must go through the approval queue — scheduler can no longer bypass it | — |

### Schedule tab filtering

| Change | File |
|---|---|
| Schedule tab now hides `pending` and `awaiting_approval` in addition to `completed` | `ScheduleShell.tsx` |
| Only `scheduled` jobs appear on the Schedule tab | — |

### Financials visibility

| Change | File |
|---|---|
| Financials section hidden for `pending` and `awaiting_approval` jobs (create form + edit form) | `NewJobShell.tsx`, `JobDetailShell.tsx` |
| Financials only visible for `scheduled` and `completed` jobs | — |

### Job Chat header — Live/Syncing indicator + locked title

| Change | File |
|---|---|
| Chat header title: "Job Chat" when open, "Job Chat (Locked)" when chat is locked | `ChatSection.tsx` |
| Green dot + "Live" label shown when Supabase Realtime is connected | `ChatSection.tsx` |
| Red dot + "Syncing" label shown on channel error or timeout | `ChatSection.tsx` |
| Live indicator hidden when chat is locked | `ChatSection.tsx` |

### Whole-job lock on completion

| Change | File |
|---|---|
| `AssigneeSection` accepts `readOnly` prop; scheduler cannot add/remove installers on completed jobs | `AssigneeSection.tsx`, `JobDetailShell.tsx` |
| All form fields, assignees, and financials are read-only once job is `completed` | — |
| Chat stays open for 7 days post-completion; after that, title → "Job Chat (Locked)", input bar removed | `ChatSection.tsx` |

### Pending Files section (new component)

| Change | File |
|---|---|
| New `PendingFilesSection` card — visible only when job status is `pending` | `PendingFilesSection.tsx` (new) |
| "Attach Files" button — multi-file selection, uploads each to R2 as `kind='attachment'` | — |
| "URL Links" textarea + "Save Links" button — saves each line as a `files` record with `kind='url_link'` | — |
| URL links appear in Files/URL section (not Job Chat); `router.refresh()` after save | — |
| Section order in job detail: Attachments (pending only) → Files/URL → Chat | `JobDetailShell.tsx` |

### Files / URL section

| Change | File |
|---|---|
| "Files" section renamed "Files / URL" | `AttachmentSection.tsx` |
| `url_link` kind renders as external "Open" link instead of download button | `AttachmentSection.tsx` |
| `url_link` added to `FileKind` union type | `src/lib/supabase/types.ts` |
| `url_link: 'links'` added to `KIND_FOLDER` in r2.ts | `src/lib/storage/r2.ts` |

### Project Title field (Session 17.6 item 1 — pulled forward)

| Change | File |
|---|---|
| Migration 0012: `ALTER TABLE jobs ADD COLUMN project_title TEXT` | `supabase/migrations/0012_project_title.sql` |
| "Project Title" input added above Date in `CoreSection` (all job forms) | `CoreSection.tsx` |
| `project_title` wired into `FormValues`, defaultValues, insert/update | `JobDetailShell.tsx`, `NewJobShell.tsx` |
| Schedule job cards show `project_title`; falls back to customer name if blank | `JobRow.tsx` |
| `ScheduleJob`, `JobDetail`, `SCHEDULE_SELECT`, `CoreFieldsPatch` types updated | `queries/jobs.ts` |

> **⚠️ DB migration required:** Run `npx supabase db push` to apply migration 0012 before project_title saves/loads correctly.

---

## Session 17.6 items completed in 18.3

| Item | Status |
|---|---|
| Project title field + DB migration | ✓ done |
| Calendar/schedule shows project title | ✓ done |
| "Create Job" button casing | ✓ done |
| Pending jobs hidden from Schedule tab | ✓ done |
| Push for Approval (no direct-to-schedule bypass) | ✓ done |

## Session 17.6 items still pending

| Item | Target |
|---|---|
| Pending tab — sales only (hide from non-sales BottomNav) | Session 17.6 remainder |
| Time picker — 15-min intervals (00/15/30/45) | Session 17.6 remainder |
| Production ready instructions attachment row | Session 17.6 remainder |

---

## TypeScript

`npx tsc --noEmit` — clean, no errors.

---

## Commits this session

| Hash | Message |
|---|---|
| `fcb7f1a` | design: Session 18.3 — label renames, pending flow, chat indicator, pending files |
| `40f8185` | design: Session 18.3 — Job Chat title, locked title, full job lock on complete |
| `87b53ba` | design: Session 18.3 — Files/URL section, link storage, label casing fixes |
| `ea8ca24` | design: Session 18.3 — hide Financials on pending + awaiting_approval jobs |
| `0e00979` | feat: Session 18.3 — Project Title field on all job forms + schedule display |

---

## What's next

- Run `npx supabase db push` to apply migration 0012 (project_title column)
- Session 17.6 remainder: Pending tab sales-only, 15-min time picker, production instructions attachment
- Session 17.4 — Admin role-switcher
- Session 17.5 — Persistent floating AI chatbot
- Session 19 — Pre-Alpha testing
