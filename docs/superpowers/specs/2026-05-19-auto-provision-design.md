# Auto-Provision on Sign-In — Design Spec

_Date: 2026-05-19_

---

## Problem

Admin currently has to manually provision every team member before they can sign in. The goal is to let anyone sign in with Google and be automatically added to the users list, then wait for Admin to assign them a role before they can access the app.

---

## Behaviour

### New user signs in (never provisioned)
1. Google OAuth completes → auth callback runs
2. No matching row found in `users` → auto-create row with Google display name, email, `auth_id`, and `role = null`
3. Redirect to `/pending`
4. `/pending` shows: "You're registered! Reach out to your Admin to get set up." + OK button
5. OK → sign out → redirect to `/login`

### Pending user signs in again (has row, no role yet)
1. Auth callback runs → finds row by `auth_id`, role is null → redirect to `/pending`
2. Same pending page as above

### Provisioned user (admin assigned a role)
1. Auth callback runs → finds row with a real role → redirect to `/` → existing role-based routing takes over
2. No change to existing flow

### Admin assigns a role to a pending user
1. Pending user appears in UsersTab with their Google display name, email, and a "Pending" label instead of a role pill
2. Admin clicks Edit → can update Display Name + assign Role (plus Telegram ID, digest, lang as before)
3. On Save → user's next sign-in (or page refresh from `/pending`) goes straight to their dashboard

---

## Changes Required

### 1. DB Migration (`supabase/migrations/0022_nullable_role.sql`)
- Drop NOT NULL constraint from `users.role`
- Drop the column default if one exists

### 2. TypeScript Types (`src/lib/supabase/types.ts`)
- `users.Row.role` → `Role | null`

### 3. Admin Query Types (`src/lib/supabase/queries/admin.ts`)
- `AdminUser.role` → `Role | null`
- Add `name` to the fields updateable via `updateUser()` so admin can correct Google display names

### 4. Auth Callback (`src/app/auth/callback/route.ts`)
After the existing pre-provision link attempt:
- Query `users` by `auth_id` to find the user's row
- **Row found, role set** → redirect to `/` (unchanged)
- **Row found, role null** → redirect to `/pending`
- **No row** → insert new row (`auth_id`, `email`, `name` from Google metadata or email prefix, `role = null`, `lang = 'en'`, `digest_subscriber = false`, `visibility = ['public-internal']`) → redirect to `/pending`

### 5. Pending Page (`src/app/pending/page.tsx`) — new file
- Server component: verify user is authenticated (redirect to `/login` if not)
- Fetch profile; if role is set, redirect to `/` (handles case where admin assigns role mid-session)
- Render: GreenQubes logo, "You're registered!" heading, "Reach out to your Admin to get set up." subtext, OK button
- OK button signs the user out (`signOut()`) and redirects to `/login`
- No BottomNav, no other navigation

### 6. Home Page (`src/app/page.tsx`)
- After fetching profile, add: if `profile` exists but `profile.role === null` → `redirect('/pending')`
- This catches any pending user who navigates directly to `/`

### 7. Admin Users Tab (`src/features/admin/UsersTab.tsx`)
- `UserRow` state: `role` type → `Role | null`; add `name` state field (editable)
- Edit form: add Display Name input field above the role select
- Role select: add a blank/disabled "Select role…" option when current role is null; selecting it leaves role as null
- Display (non-editing): show a styled "Pending" span instead of `<Pill>` when `role === null`
- `AdminRoleModal` for admin role confirmation: unchanged, only shown when selecting admin

### 8. Admin PATCH API (`src/app/api/admin/users/[id]/route.ts`)
- Accept `name` in the request body and include it in the DB update patch

---

## Edge Cases

- **Duplicate sign-in during auto-provision**: The insert uses `auth_id` as the unique key. If somehow called twice, the second insert fails. The callback should use upsert or check first — use `maybeSingle()` check before insert.
- **Pre-provisioned user signs in**: The existing link attempt (update by email + null auth_id) runs first. After that, the auth_id query finds the row with a real role → redirects to `/`. No auto-provision insert attempted.
- **Admin navigates to `/pending`**: They have a real role, so the page redirects them to `/`.
- **`get_my_role()` DB function with null role**: Returns null — existing RLS policies only grant access to specific role values, so a null-role user naturally gets no access to business data. No RLS changes needed.

---

## Files Changed

| File | Change |
|---|---|
| `supabase/migrations/0022_nullable_role.sql` | New — drop NOT NULL on `users.role` |
| `src/lib/supabase/types.ts` | `users.Row.role: Role \| null` |
| `src/lib/supabase/queries/admin.ts` | `AdminUser.role: Role \| null`, add `name` to updateUser |
| `src/app/auth/callback/route.ts` | Auto-provision new users, route by role null/set |
| `src/app/pending/page.tsx` | New page |
| `src/app/page.tsx` | Redirect null-role users to `/pending` |
| `src/features/admin/UsersTab.tsx` | Null role display, name edit field |
| `src/app/api/admin/users/[id]/route.ts` | Accept `name` in PATCH body |
