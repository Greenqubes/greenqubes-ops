# Session 17.4 — Admin Role-Switcher

_Written: 2026-05-07. All changes committed to `dev` and pushed to Vercel preview._

---

## What was done

Added a role-preview switcher for the `ai@greenqubes.com` admin account. Admin can preview the UI as Sales, Scheduler, or Installer without any DB writes. Uses a `role_override` session cookie, respected only when the authenticated user is the designated admin.

---

## New file

| File | Purpose |
|---|---|
| `src/lib/utils/role-override.ts` | Server-side helper — reads `role_override` cookie; only applies override if email === `ai@greenqubes.com` |

---

## Changes

### UserMenu.tsx

- Added "Preview as" section (admin only) — three buttons: Sales / Scheduler / Installer
- Active override highlighted in amber; "Exit preview" button appears when an override is active
- Amber chip + amber ring on avatar when override is active (always-visible indicator)
- `handlePreviewAs(role)` — sets `role_override` cookie, navigates to correct page, refreshes
- `handleExitPreview()` — clears cookie, returns to `/schedule`

### Page files (server-side)

All six pages now call `getEffectiveRole(profile.role, user.email)` and pass the result downstream:

| Page | Change |
|---|---|
| `src/app/schedule/page.tsx` | Uses effective role for ScheduleShell |
| `src/app/completed/page.tsx` | Uses effective role for ScheduleShell |
| `src/app/pending/page.tsx` | Uses effective role for ScheduleShell |
| `src/app/approvals/page.tsx` | Bypasses scheduler-only guard for admin with scheduler override |
| `src/app/installer/page.tsx` | Bypasses installer-only guard for admin with installer override |
| `src/app/page.tsx` | Root redirect uses effective role |

---

## Error logging improvements

- `ErrorPage.tsx` — now logs `error.digest` to `/api/crash` and displays it on screen so Vercel function logs can be cross-referenced
- `src/app/api/crash/route.ts` — includes digest in the markdown body; writes `.txt` files (was `.md`) to `CRASH_LOG_DIR`
- `CRASH_LOG_DIR=C:\Greenqubes_GitHub\greenqubes-ops\crash logs` added to `.env.local`
- `getEffectiveRole` wrapped in try-catch so a `cookies()` failure never crashes a page

---

## Bug found during session

Schedule page (`/schedule`) threw digest `1969713423` immediately after OAuth login. Root cause: **migration 0012 (`project_title` column) had not been pushed to Supabase**. `getScheduleJobs()` selects `project_title` which caused a Postgres "column does not exist" error.

**Fix:** `npx supabase db push` — applied migration 0012, error resolved.

---

## TypeScript

`npx tsc --noEmit` — clean, no errors.

---

## Commits this session

| Hash | Message |
|---|---|
| `550bd16` | feat: Session 17.4 — admin role-switcher |
| `c921d72` | fix: include error digest in crash logs + defensive getEffectiveRole |
| `a3d2839` | fix: write crash logs as .txt into local crash logs folder |
| `2d92593` | fix: crash log filename format crash-YYYY-MM-DD_HH-MM-SS.txt |

---

## What's next

- Session 17.5 — Persistent floating AI chatbot (all pages except /assistant)
- Session 17.6 remainder — Pending tab sales-only, 15-min time picker, production ready instructions
- Session 19 — Pre-Alpha testing
