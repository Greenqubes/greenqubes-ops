# Session 13.8 — Schedule "+ New" Button + Job Creation Route

> Read alongside `CONTEXT.md` and `plan.md` at session start.

_Done: 2026-05-04_

---

## What was built

### "+ New job" button — `ScheduleShell.tsx`

- Added `Plus` icon to lucide imports
- Added a terracotta `<Link href="/jobs/new">` button styled as `Btn variant="accent"` in the schedule header
- Visible only for `role === 'sales' || role === 'scheduler'` — installers cannot create jobs
- Positioned as the first item in the header right-side icon cluster (before approvals badge and bell)

---

### `/jobs/new` page + `NewJobShell`

**New files:**
- `src/app/jobs/new/page.tsx` — server page
- `src/features/job-detail/NewJobShell.tsx` — client creation shell

**`/app/jobs/new/page.tsx`:**
- Auth guard: redirects to `/login` if no session or no profile
- Role guard: `installer` redirects to `/installer`
- Passes `role`, `userId` (public.users id), `lang` to NewJobShell

**`NewJobShell.tsx`:**
- Sticky header: back arrow → `/schedule`, eyebrow label, "New job" title, terracotta "Create job" `Btn variant="accent"`
- Form: reuses existing `CoreSection` + `FinancialSection` — no new section components needed
- No assignees, chat, or attachments on creation — those are managed post-creation in `/jobs/[id]`
- On submit: inserts job with `status: 'pending'`, `sales_poc_id: userId`, `visibility: ['role:sales', 'role:scheduler']`; conditionally inserts `job_financials` if any financial fields filled; redirects to `/jobs/[newId]`
- Supabase insert uses `as never` cast on payload + `as unknown as Promise<...>` cast on result to work around strict type inference

---

### i18n

Added `createJob` key to all three locales:

| Key | EN | ZH | BN |
|---|---|---|---|
| `createJob` | `'Create job'` | `'创建工作'` | `'কাজ তৈরি করুন'` |

`newJob` was already present in all three locales — used for the ScheduleShell button and the NewJobShell header title.

---

## Files touched

```
src/features/schedule/ScheduleShell.tsx       — "+ New" link button
src/features/job-detail/NewJobShell.tsx        — new
src/app/jobs/new/page.tsx                      — new
src/lib/i18n/en.ts                             — createJob key
src/lib/i18n/zh.ts                             — createJob key
src/lib/i18n/bn.ts                             — createJob key
```

---

## What's next — Session 14

`admin` page at `/admin` (scheduler-only):

1. **User list** — all users in `public.users`, showing name, role, Telegram chat ID, last active
2. **Provision new user** — insert into `public.users` with `auth_id` matched from `auth.users` by email; role selector
3. **Edit user** — change role, Telegram chat ID
4. **Digest voter config** — who receives the Monday digest (boolean toggle per user)
5. **System health** — Supabase reachable, Telegram bot token valid, last obsidian-sync timestamp, last overdue-cron run (from `events` table)
