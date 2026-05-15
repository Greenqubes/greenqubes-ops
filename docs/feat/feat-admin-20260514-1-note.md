# feat-admin-2 — Session Note
_2026-05-14_

---

## What was done

### Admin role

Added `admin` as a proper 4th role in the DB, replacing the hardcoded `ai@greenqubes.com` email gate. Admin access is now granted by setting a user's role to `admin` in the Users tab — no code change required to add future admins.

#### Migration 0018 — enum

```sql
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin';
```

Split into a separate migration because Postgres does not allow using a newly added enum value in the same transaction as `ALTER TYPE ... ADD VALUE`.

#### Migration 0019 — RLS policies

Dropped and recreated all RLS policies that referenced `'scheduler'` or `('sales', 'scheduler')` to also include `'admin'`. Admin now has full read/write access to every table. Installer-only policies left unchanged. `kb_chunks` policy updated with an admin bypass so admin sees all chunks regardless of visibility tokens.

Also included: `UPDATE public.users SET role = 'admin' WHERE email = 'ai@greenqubes.com'` — this failed silently (see migration 0020 below).

#### Migration 0020 — fix admin seed

The 0019 seed used `WHERE email = 'ai@greenqubes.com'` on `public.users.email`, but that column is only populated on first sign-in after migration 0017. Since `ai@greenqubes.com` signed in before 0017, the column was NULL and the UPDATE matched 0 rows. Fixed with a join through `auth.users`:

```sql
UPDATE public.users pu
SET    role = 'admin'
FROM   auth.users au
WHERE  pu.auth_id = au.id
AND    au.email   = 'ai@greenqubes.com';
```

#### TypeScript + components

- `Role` type: added `'admin'`
- `Pill`: added `admin` variant (`bg-terracotta/10 text-terracotta`, label "Admin")
- `BottomNav`: added `admin` tab set (same as scheduler — Schedule, Approvals, Completed, Assistant)
- `role-override.ts`: dropped `userEmail` param from `getEffectiveRole`; admin with no preview cookie defaults to `'scheduler'` UI so no shell components need changes
- All 6 page routes: dropped second arg from `getEffectiveRole` call
- `AdminShell`: `role` prop changed from `'scheduler'` to `Role`

#### Admin gating

- `src/app/admin/page.tsx`: `profile.role !== 'admin'` replaces email check
- All 6 `src/app/api/admin/*/route.ts`: new `guardAdmin()` fetches profile row and checks `role === 'admin'`; `ADMIN_EMAIL` constant removed from every file
- `UserMenu`: `isAdmin` now derived from `data.role === 'admin'` fetched from DB; `ADMIN_EMAIL` removed

#### UsersTab — AdminRoleModal

Added confirmation modal that fires when the role dropdown is changed to `'admin'` in either the provision form or the edit-role flow.

- **Provision form flow:** modal fires on role select change → Yes keeps `'admin'` selected, No reverts to `'installer'`
- **UserRow edit flow:** modal fires on role select change → Yes immediately PATCHes the API → success phase shows `"{email} is now Admin!"` → Ok closes modal + refreshes list; No reverts dropdown

#### CLAUDE.md

Updated hard rule from "Don't add a fourth role" to "Never add or remove roles without explicit user confirmation. Claude may suggest new roles but must not implement without approval."

---

### Vercel cron fix

Vercel deployments had been silently failing since the overdue cron was added in a previous session. The cron expression `0 */2 * * *` (every 2 hours) exceeds the Hobby plan limit of once per day, causing every deployment to error at the cron validation step without building.

Fixed by changing the schedule to `0 10 * * *` (once daily at 10:00 UTC = 6 PM SGT).

---

## Key files changed

- `supabase/migrations/0018_admin_role_enum.sql` — new
- `supabase/migrations/0019_admin_role_policies.sql` — new
- `supabase/migrations/0020_fix_admin_seed.sql` — new
- `src/lib/supabase/types.ts` — Role type
- `src/components/Pill.tsx` — admin variant
- `src/components/BottomNav.tsx` — admin tab set
- `src/lib/utils/role-override.ts` — drop email param
- `src/app/page.tsx`, `schedule`, `completed`, `approvals`, `installer`, `pending` — drop email arg
- `src/app/admin/page.tsx` — role-based gate
- `src/app/api/admin/health/route.ts`, `digest`, `crashes`, `crashes/[id]`, `users`, `users/[id]` — role-based guardAdmin
- `src/components/UserMenu.tsx` — isAdmin from DB role
- `src/features/admin/AdminShell.tsx` — role prop type
- `src/features/admin/UsersTab.tsx` — ROLES + AdminRoleModal
- `vercel.json` — overdue cron schedule
- `CLAUDE.md` — roles hard rule

---

## Known bug (pending fix)

**AdminRoleModal double-Yes** — when editing a user's role to Admin in UsersTab, "Yes" in the confirm modal requires two presses before it fires. Likely a state update race condition between `handleRoleChange` setting `modalPhase` and the dropdown `value` re-render.

---

## What's next

Fix the AdminRoleModal double-Yes bug. Continue with remaining pre-alpha hotfix items from `docs/nic-checklist.md`.
