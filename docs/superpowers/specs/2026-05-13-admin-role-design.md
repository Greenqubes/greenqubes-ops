# Admin Role — Design Spec
_2026-05-13_

## Goal

Replace the hardcoded `ai@greenqubes.com` email gate with a proper `admin` DB role. Admin access is then granted by setting a user's role to `admin` in the Users tab — no code change required to add a second admin in future.

---

## Section 1 — Database (Migration 0018)

### Enum extension

```sql
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin';
```

### Seed existing admin

```sql
UPDATE public.users SET role = 'admin' WHERE email = 'ai@greenqubes.com';
```

### RLS policy updates

All existing policies in `supabase/migrations/0002_rls.sql` are recreated via `CREATE OR REPLACE`. The rule:

- `get_my_role() in ('sales', 'scheduler')` → `get_my_role() in ('sales', 'scheduler', 'admin')`
- `get_my_role() = 'scheduler'` → `get_my_role() in ('scheduler', 'admin')`
- `get_my_role() = 'installer'` — left unchanged (admin does not need installer-level impersonation at DB layer)
- `get_my_role() in ('sales', 'scheduler', 'installer')` or `any(visibility)` policies — add `'admin'` to the set

Result: admin has full read/write access to every table that sales or scheduler can touch. Installer-only insert paths (e.g. posting voice notes as an installer) are not granted — admin uses the preview switcher for that flow.

---

## Section 2 — TypeScript + Types

### `src/lib/supabase/types.ts`

Add `'admin'` to the `Role` union type (and the DB enum mapping).

### `src/lib/utils/role-override.ts`

- Remove the `userEmail` parameter from `getEffectiveRole` — admin is now determined by role, not email
- `VALID_ROLES` stays `['sales', 'scheduler', 'installer']` — these are preview targets only
- If `realRole === 'admin'` and no valid override cookie is set, return `'admin'`

```typescript
export async function getEffectiveRole(realRole: Role): Promise<Role> {
  if (realRole !== 'admin') return realRole
  try {
    const cookieStore = await cookies()
    const override = cookieStore.get('role_override')?.value as Role | undefined
    if (override && VALID_ROLES.has(override)) return override
  } catch { /* cookies() unavailable */ }
  return 'admin'
}
```

All callers drop the second `userEmail` argument.

---

## Section 3 — Admin Gating

### Pages + API routes

Every file that currently contains `const ADMIN_EMAIL = 'ai@greenqubes.com'` and checks `user.email === ADMIN_EMAIL`:

- `src/app/admin/page.tsx`
- `src/app/api/admin/health/route.ts`
- `src/app/api/admin/digest/route.ts`
- `src/app/api/admin/crashes/route.ts`
- `src/app/api/admin/crashes/[id]/route.ts`
- `src/app/api/admin/users/route.ts`
- `src/app/api/admin/users/[id]/route.ts`

Change: fetch `profile.role` from `public.users` (same pattern already used in other page routes), then check `profile.role === 'admin'`. Delete the `ADMIN_EMAIL` constant from each file.

### Home redirect (`src/app/page.tsx`)

Add a branch for the admin role:

```typescript
if (effectiveRole === 'admin') redirect('/schedule')
```

Admin lands on the schedule view by default. The UserMenu gives access to `/admin`.

### `src/app/api/assistant/chat/route.ts`

This file also references `ADMIN_EMAIL` (for RAG visibility). Update the same way — fetch role, check `=== 'admin'`.

---

## Section 4 — UserMenu

`isAdmin` currently derived from `email === ADMIN_EMAIL`. Change:

- Extend the existing `public.users` select to include `role` (currently only fetches `lang`)
- `setIsAdmin(data.role === 'admin')`
- Remove the `ADMIN_EMAIL` constant from this file

No visual change. The amber preview chip, "Preview as" switcher, and admin page link all remain exactly as-is.

---

## Section 5 — Admin Users Tab (Confirm Modal)

### Trigger

When the role dropdown in `UsersTab.tsx` (either provision form or edit-role flow) is set to `'admin'`, intercept before saving and open a confirmation modal.

### Modal — confirmation state

> **Are you sure?**
> This user will have unrestricted access to the whole system.
>
> [ No ]  [ Yes ]

- **No** — close modal, revert dropdown to previous value, no save
- **Yes** — call the existing save/update API, then transition modal to success state

### Modal — success state

> **{email} is now Admin!**
>
> [ Ok ]

Ok closes the modal. The user row updates to show the Admin pill.

Selecting any other role (`sales`, `scheduler`, `installer`) saves immediately with no modal — existing behaviour unchanged.

---

## Section 6 — CLAUDE.md Hard Rule

Update from:
> Don't add a fourth role.

To:
> Never add or remove roles without explicit user confirmation. Claude may suggest new roles but must not implement without approval.

---

## Files changed (summary)

| File | Change |
|---|---|
| `supabase/migrations/0018_admin_role.sql` | New — enum value, UPDATE seed, RLS policy rewrites |
| `src/lib/supabase/types.ts` | Add `'admin'` to Role type |
| `src/lib/utils/role-override.ts` | Drop email param, handle `'admin'` return |
| `src/app/page.tsx` | Add admin redirect branch, drop email arg from getEffectiveRole |
| `src/app/schedule/page.tsx` | Drop email arg |
| `src/app/completed/page.tsx` | Drop email arg |
| `src/app/approvals/page.tsx` | Drop email arg |
| `src/app/installer/page.tsx` | Drop email arg |
| `src/app/pending/page.tsx` | Drop email arg |
| `src/app/admin/page.tsx` | Role-based gate, drop ADMIN_EMAIL |
| `src/app/api/admin/*/route.ts` (×6) | Role-based gate, drop ADMIN_EMAIL |
| `src/app/api/assistant/chat/route.ts` | Role-based check, drop ADMIN_EMAIL |
| `src/components/UserMenu.tsx` | isAdmin from role, drop ADMIN_EMAIL |
| `src/features/admin/UsersTab.tsx` | Add admin option to dropdown, add confirm modal |
| `src/app/api/assistant/chat/route.ts` | Role-based check, drop ADMIN_EMAIL |
| `CLAUDE.md` | Update hard rule |
