# Session Note — feat-admin-3 — 2026-05-29

**Session type:** Feature — Remove User / Revoke Access  
**Status:** Complete — live on Vercel preview, DB migration pending

---

## What was done

### Feature: Remove User / Revoke Access

Admin can now remove any user from the system via Admin → Users tab. Two distinct deletion paths based on whether the user has ever signed in.

**Provisioned users (auth_id IS NULL — never signed in):**
- Hard delete from `users` table
- No Supabase Auth entry to revoke

**Active / past employees (auth_id IS NOT NULL):**
- Soft delete: `deleted_at = now()` stamped on `users` row (preserves all FK references — job assignments, messages, file uploads still show their name)
- Supabase Auth revoked via `supabase.auth.admin.deleteUser()` — prevents re-login via Google
- Operation order: Auth revoked first, then `deleted_at` stamped — retryable on failure

**Deleted users blocked at three layers:**
1. Middleware — checks `deleted_at` on every request, signs out + redirects to `/login?error=account_removed`
2. Auth callback — rejects sign-in for deleted users, also prevents re-linking deleted provisioned rows
3. Supabase Auth revocation — tokens invalid immediately

### Migration 0032

`supabase/migrations/0032_user_soft_delete.sql`:
- `ALTER TABLE public.users ADD COLUMN IF NOT EXISTS deleted_at timestamptz`
- Partial index: `CREATE INDEX IF NOT EXISTS users_active_idx ON public.users (id) WHERE deleted_at IS NULL`

**Note: `npx supabase db push` still needs to be run to apply this to the remote DB.**

### Query filters

Added `.is('deleted_at', null)` to all user-selection queries so deleted users don't appear in dropdowns, grids, or as notification recipients:
- `getAllUsers()`, `getDigestSubscribers()` in `queries/admin.ts`
- `getInstallerUsers()` in `queries/jobs.ts`
- `getAllProvisionedUsers()` in `queries/coordinators.ts`
- `getSchedulers()` in `queries/notifications.ts`
- Inline sales users query in `app/jobs/[id]/page.tsx`
- Installer/coordinator Telegram lookups in `notify-assigned/route.ts`
- `WorkloadPreviewModal.tsx` scheduler list
- `app/jobs/new/page.tsx` dropdowns
- `app/api/jobs/[id]/clashes/route.ts` substitute list
- `lib/digest/run.ts`, `lib/digest/timeout.ts`, `app/api/admin/digest/route.ts`

Name-resolution lookups (chat message authors) intentionally NOT filtered — historical names preserved.

### UI

`src/features/admin/UsersTab.tsx`:
- `DeleteUserModal` component — two variants based on `user.auth_id === null`
  - Provisioned: "Remove provisioned user?" / "[name] hasn't signed in yet. This will delete them permanently."
  - Active employee: "Remove access?" / "[name] will no longer be able to sign in. Their name will remain on past jobs and messages."
- Remove button (terracotta, `text-xs`, underline) on every card except GreenqubesAI
- Hidden during edit mode
- Loading state ("Removing…"), 4xx shows API error message, 5xx shows generic fallback
- Safe JSON parsing (content-type check before `res.json()`)

### Error handling

`UserRemovalValidationError` class added to `queries/admin.ts` — thrown for all user-facing validation failures (GreenqubesAI guard, already-deleted guard, user not found). API route uses `instanceof` check to route 400 vs 500, avoiding fragile string matching.

---

## Files changed

- `supabase/migrations/0032_user_soft_delete.sql` (new)
- `src/lib/supabase/queries/admin.ts` — `removeUserAccess()`, `UserRemovalValidationError`, `deleted_at` in select + filters
- `src/lib/supabase/types.ts` — `deleted_at: string | null` on users Row type
- `src/app/api/admin/users/[id]/route.ts` — DELETE handler
- `src/app/auth/callback/route.ts` — deleted user rejection, `.maybeSingle()` fix
- `middleware.ts` — soft-delete check on every request
- `src/lib/supabase/queries/jobs.ts` — `deleted_at` filter
- `src/lib/supabase/queries/coordinators.ts` — `deleted_at` filter
- `src/lib/supabase/queries/notifications.ts` — `deleted_at` filter
- `src/app/jobs/[id]/page.tsx` — `deleted_at` filter
- `src/app/jobs/new/page.tsx` — `deleted_at` filter
- `src/app/api/jobs/[id]/clashes/route.ts` — `deleted_at` filter
- `src/app/api/jobs/[id]/notify-assigned/route.ts` — `deleted_at` filter
- `src/features/approvals/WorkloadPreviewModal.tsx` — `deleted_at` filter
- `src/lib/digest/run.ts` — `deleted_at` filter
- `src/lib/digest/timeout.ts` — `deleted_at` filter
- `src/app/api/admin/digest/route.ts` — `deleted_at` filter
- `src/features/admin/UsersTab.tsx` — `DeleteUserModal` + Remove button

---

## Next

- Run `npx supabase db push` to apply migration 0032 to remote DB
- Pre-alpha testing (Session 19)
- Pending bugs: AdminRoleModal double-Yes, Scheduler "Send Back" + "Delete Job" on scheduled jobs, Bulk delete jobs
