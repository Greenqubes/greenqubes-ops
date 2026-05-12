# Spec: Pre-Provision Users Without Prior Sign-In
_2026-05-12_

## Problem

The current `provisionUser()` function requires the target user to have already signed in via Google OAuth at least once. It looks up `auth.users` by email to get the `auth_id`, and throws an error if no matching auth record exists. This forces admins to coordinate with new team members before provisioning their accounts.

## Goal

Allow the admin to provision a user by email at any time. When the user later signs in via Google for the first time, the system automatically links their auth record to the pre-provisioned profile.

---

## Design

### 1. Data Model — add `email` to `users` table

**Migration:** `ALTER TABLE users ADD COLUMN email text UNIQUE;`

- Nullable — existing rows with `auth_id` already set are unaffected
- Unique constraint — prevents double-provisioning the same email
- New pre-provisioned rows: `email` set, `auth_id = null`
- Linked rows (after first sign-in): both `email` and `auth_id` set

No other schema changes required.

---

### 2. `provisionUser()` — remove auth.users dependency

**File:** `src/lib/supabase/queries/admin.ts`

New logic (replaces current):
1. Query `users` table for existing row where `email = input.email` — return 409 conflict if found
2. Insert new row: `{ email, name, role, lang, auth_id: null, digest_subscriber: false, visibility: ['public-internal'] }`
3. Return inserted row

The Supabase Admin API call (`listUsers()`) is removed entirely. No dependency on the user having a Google auth record.

---

### 3. Auth callback — link `auth_id` on first sign-in

**File:** `src/app/auth/callback/route.ts`

After the OAuth code exchange succeeds and a session is returned:
1. Get `session.user.email` and `session.user.id` (the Supabase `auth.uid`)
2. Using the **service role client** (bypasses RLS — needed because a user cannot UPDATE their own `auth_id` via RLS), query `users` where `email = session.user.email AND auth_id IS NULL`
3. If a pre-provisioned row is found → `UPDATE users SET auth_id = session.user.id WHERE email = session.user.email`
4. Redirect to `/` as normal

Existing users (already have `auth_id`) — the query finds nothing, no update runs. Behaviour is identical to current for all existing accounts.

---

### 4. Admin UI — no changes required

The provision form (email, name, role, lang) is unchanged. The "user must sign in first" error is eliminated because `provisionUser()` no longer checks auth.users.

The `AdminUser` type in `admin.ts` gains an `email: string | null` field to reflect the new column, but the Users Tab UI does not need to surface it (it's already implied by the form input).

---

## Files Changed

| File | Change |
|---|---|
| `supabase/migrations/0017_add_email_to_users.sql` | New migration — adds `email text UNIQUE` column |
| `src/lib/supabase/queries/admin.ts` | `provisionUser()` rewritten; `AdminUser` type updated |
| `src/app/api/admin/users/route.ts` | No change (calls `provisionUser()` which handles the new logic) |
| `src/app/auth/callback/route.ts` | Add email→auth_id linking step after session exchange |

---

## Error Cases

| Case | Behaviour |
|---|---|
| Admin provisions email that already exists in `users` | 409 — "A user with this email is already provisioned" |
| User signs in but no pre-provisioned row found | Existing behaviour — home page shows "not provisioned" message |
| User signs in and pre-provisioned row found | `auth_id` linked silently; user lands on role-appropriate page |
| Admin provisions email, user never signs in | Row sits with `auth_id = null`; harmless |

---

## Out of Scope

- Sending an invite email to the provisioned user (manual coordination remains)
- Backfilling `email` on existing rows (not needed — `auth_id` is already set for them)
- Any change to the provision form fields
