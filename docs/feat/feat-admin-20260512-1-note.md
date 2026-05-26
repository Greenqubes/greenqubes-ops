# feat-admin — Session Note
_2026-05-12_

---

## What was done

### Pre-provision users without prior sign-in

Changed the admin user provisioning flow so that admins can add team members by email before they have signed in via Google OAuth.

**Previously:** `provisionUser()` called `db.auth.admin.listUsers()` to find the user's `auth_id` from Supabase Auth, and threw an error if no Google account existed yet ("user must sign in first").

**Now:** Admin enters email, name, role, lang → user row is created immediately with `auth_id = null` and email stored. When the user signs in for the first time, the auth callback detects the pre-provisioned row by email and fills in `auth_id` automatically.

#### Migration 0017

Added `email text` column to `public.users` with a partial unique index:

```sql
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email text;
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON public.users (email) WHERE email IS NOT NULL;
```

Partial index (`WHERE email IS NOT NULL`) prevents null-vs-null conflicts on existing rows.

#### `src/lib/supabase/queries/admin.ts`

- `AdminUser` type: added `email: string | null`
- `getAllUsers`: select string updated to include `email`
- `provisionUser`: removed `listUsers()` call; checks `users` table for duplicate email; inserts with `auth_id: null`, email stored lowercase; catches Postgres `23505` (unique violation) for a friendly duplicate error message

#### `src/lib/supabase/types.ts`

Added `email: string | null` to the `users` Row type — required for Supabase typed client `.eq('email', ...)` to compile.

#### `src/app/auth/callback/route.ts`

Extended OAuth callback to link pre-provisioned rows on first sign-in:

```typescript
const { error: linkError } = await db
  .from('users')
  .update({ auth_id: authId })
  .eq('email', email)
  .is('auth_id', null)
if (linkError) console.error('[auth/callback] auth_id link failed:', linkError.message)
```

Uses service role client (bypasses RLS). Silent on failure — sign-in is never blocked. Logs errors to console for production debugging.

#### `src/features/admin/UsersTab.tsx`

`UserRow` non-editing view now shows "Waiting for sign-in: {email}" when `auth_id === null && user.email` is set, so admin can see which email the row is waiting for.

### Monday digest confirmed working

Ran `npm run monday-digest` manually. Script executed and correctly skipped sending (no `asst_chats` rows with `importance >= 4` yet). Script is working as expected.

---

## Key files changed

- `supabase/migrations/0017_users_email.sql` — new
- `src/lib/supabase/queries/admin.ts` — `AdminUser` type, `getAllUsers`, `provisionUser` rewritten
- `src/lib/supabase/types.ts` — `email` field added to `users` Row type
- `src/app/auth/callback/route.ts` — auth_id linking on first sign-in
- `src/features/admin/UsersTab.tsx` — "Waiting for sign-in" display in UserRow

---

## Commits

- `ea781c6` feat: add email column to users for pre-provisioning
- `92e173d` feat: add email field to AdminUser type and getAllUsers query
- `723de2d` feat: rewrite provisionUser to not require prior sign-in
- `63a7d5d` fix: tighten provisionUser duplicate check and error handling
- `08e4498` feat: link auth_id on first sign-in for pre-provisioned users
- `4e4b28e` fix: log auth_id link failure in auth callback

---

## What's next

Fix bugs from pre-alpha testing — see `docs/nic-checklist.md` → Pending — Next Session.
