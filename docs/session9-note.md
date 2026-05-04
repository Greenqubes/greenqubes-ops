# Session 9 Notes — Installer Feature

> Read at the start of Session 10 alongside CONTEXT.md and plan.md.

_Done: 2026-05-04_

---

## What was built

Installer dashboard at `/installer`: four tabs (Today / Up next / This week / Past), installer job card with a "Call sales" row, role-based redirect from the home page, and i18n coverage for all three languages.

### Files created

| File | Purpose |
|---|---|
| `src/lib/supabase/queries/installer.ts` | `InstallerJob` type + `getInstallerJobs()` — fetches all scheduled/completed jobs for the current user (RLS filters to assigned jobs only); includes sales POC via `users!jobs_sales_poc_id_fkey` join |
| `src/app/installer/page.tsx` | Server page — auth check, role guard (non-installers → `/schedule`), fetches jobs, renders `InstallerShell` |
| `src/features/installer/InstallerShell.tsx` | Client shell with four tabs; sign-out button; derives tab buckets from job list client-side (no extra queries) |
| `src/features/installer/InstallerJobCard.tsx` | Job card: status pill, date, client, time, location, optional "Call sales" `tel:` link row |

### Files modified

| File | Change |
|---|---|
| `src/app/page.tsx` | Added role-based redirects after profile load: installer → `/installer`, sales/scheduler → `/schedule` |
| `src/lib/i18n/zh.ts` | Added 8 installer dashboard keys |
| `src/lib/i18n/bn.ts` | Added 8 installer dashboard keys |
| `docs/plan.md` | Added Session 13 admin row; updated session count to 9–13 |
| `docs/CONTEXT.md` | Added Session 13 admin line in migration checklist + admin folder in file structure |

---

## Architecture

```
/installer  (server)
  └── InstallerShell  (client)
        ├── Tab: today  — scheduled jobs where date === today
        ├── Tab: next   — next 5 scheduled jobs after today
        ├── Tab: week   — scheduled jobs today → end of current week (Sun)
        └── Tab: past   — completed jobs + past-dated jobs, desc order
              └── InstallerJobCard → /jobs/[id]  (existing job detail page)
```

RLS is the only access control needed — installers only see jobs they're assigned to. No role checks needed in app code.

**Retroactive uploads** happen through the existing `/jobs/[id]` page — the `AttachmentSection` and `ChatSection` already handle file uploads regardless of completion status.

---

## Key decisions

| Decision | Why |
|---|---|
| Reuse `/jobs/[id]` for installer job view | The existing `JobDetailShell` already hides financials from installers (RLS blocks `job_financials` at DB layer). No need for a separate installer job view. |
| Tab buckets derived client-side | Single `getInstallerJobs()` fetch covers all four tabs. No extra round-trips. Same pattern as `ScheduleShell`. |
| `sales_poc` join in query | Installer needs the sales POC's phone to call them from the job card. Resolved via `users!jobs_sales_poc_id_fkey`. |
| Role redirect in `src/app/page.tsx` | Clean entry point: installers always land on `/installer`, sales/scheduler land on `/schedule`. |
| "Up next" capped at 5 | Prevents the tab from becoming a full schedule dump — installer just needs to see what's coming soon. |

---

## TODOs left for later sessions

- Installer job detail: the back-navigation from `/jobs/[id]` currently links to `/schedule`. Should detect referrer or add a query param so installers are taken back to `/installer`. Deferred to Session 10 or polish pass.
- Real-time updates on the installer dashboard (job status changes, new assignments) — deferred to Session 10 (realtime subscriptions).
- `tplJobSubmittedForApproval` Telegram notification still not wired (carried from Session 8).

---

## What's next — Session 10

`chat-thread` features:
- Live message subscriptions (Supabase realtime) for job chat
- Voice note recording (`MediaRecorder`) and R2 upload
- Back-navigation fix for installer (back to `/installer` not `/schedule`)
