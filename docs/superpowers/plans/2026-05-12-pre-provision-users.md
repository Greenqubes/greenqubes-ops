# Pre-Provision Users Without Prior Sign-In — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow admin to provision users by email before they sign in; on first sign-in, the auth callback links the pre-provisioned record to the Google auth account automatically.

**Architecture:** Add an `email` column to `users`, rewrite `provisionUser()` to insert with `auth_id = null`, and extend the auth callback to detect and link pre-provisioned rows using the service role client (bypasses RLS).

**Tech Stack:** Next.js 15, Supabase (Postgres + Auth admin API), TypeScript strict

---

## File Map

| File | Action | What changes |
|---|---|---|
| `supabase/migrations/0017_users_email.sql` | Create | Adds `email text UNIQUE` column to `users` |
| `src/lib/supabase/queries/admin.ts` | Modify | `AdminUser` type + `getAllUsers` select + full rewrite of `provisionUser` |
| `src/app/auth/callback/route.ts` | Modify | Add email→auth_id linking step after session exchange |

---

## Task 1: Add `email` column migration

**Files:**
- Create: `supabase/migrations/0017_users_email.sql`

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/0017_users_email.sql` with this content:

```sql
-- Add email to users for pre-provisioning (auth_id can be null until first sign-in)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS email text;

CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON public.users (email)
  WHERE email IS NOT NULL;
```

> Note: We use a partial unique index (`WHERE email IS NOT NULL`) rather than a column-level UNIQUE constraint so that existing rows with `email = null` don't conflict with each other.

- [ ] **Step 2: Apply the migration**

```powershell
npx supabase db push
```

Expected output: migration `0017_users_email` applied successfully. No errors.

- [ ] **Step 3: Verify column exists in Supabase dashboard**

Open the Supabase dashboard → Table Editor → `users` table. Confirm `email` column is present with type `text`, nullable.

- [ ] **Step 4: Commit**

```powershell
git add supabase/migrations/0017_users_email.sql
git commit -m "feat: add email column to users for pre-provisioning"
```

---

## Task 2: Update `AdminUser` type + `getAllUsers` query

**Files:**
- Modify: `src/lib/supabase/queries/admin.ts:6-26`

- [ ] **Step 1: Update `AdminUser` type to include `email`**

In `src/lib/supabase/queries/admin.ts`, replace lines 6–16:

```typescript
export type AdminUser = {
  id:                string
  auth_id:           string | null
  email:             string | null
  name:              string
  role:              Role
  telegram_chat_id:  string | null
  lang:              LangCode
  phone:             string | null
  digest_subscriber: boolean
  created_at:        string
}
```

- [ ] **Step 2: Update `getAllUsers` select to include `email`**

Replace lines 18–26 (the `getAllUsers` function):

```typescript
export async function getAllUsers(): Promise<AdminUser[]> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('users')
    .select('id, auth_id, email, name, role, telegram_chat_id, lang, phone, digest_subscriber, created_at')
    .order('name')
  if (error) throw error
  return (data ?? []) as unknown as AdminUser[]
}
```

- [ ] **Step 3: Run typecheck**

```powershell
npx tsc --noEmit
```

Expected: no errors. If there are errors referencing `AdminUser`, they will be fixed in Task 3.

- [ ] **Step 4: Commit**

```powershell
git add src/lib/supabase/queries/admin.ts
git commit -m "feat: add email field to AdminUser type and getAllUsers query"
```

---

## Task 3: Rewrite `provisionUser()`

**Files:**
- Modify: `src/lib/supabase/queries/admin.ts:28-65`

- [ ] **Step 1: Replace the `provisionUser` function**

In `src/lib/supabase/queries/admin.ts`, replace lines 28–65 (the entire `provisionUser` function) with:

```typescript
export async function provisionUser(
  email: string,
  name:  string,
  role:  Role,
  lang:  LangCode = 'en',
): Promise<AdminUser> {
  const db = createServiceClient()

  // Prevent duplicate provisioning by email
  const { data: existing } = await db
    .from('users')
    .select('id')
    .eq('email', email.toLowerCase())
    .maybeSingle()
  if (existing) throw new Error(`${email} is already provisioned.`)

  const { data, error } = await db
    .from('users')
    .insert({
      email:             email.toLowerCase(),
      auth_id:           null,
      name,
      role,
      lang,
      digest_subscriber: false,
      visibility:        ['public-internal'],
    } as never)
    .select()
    .single()
  if (error) throw error
  return data as unknown as AdminUser
}
```

> The email is stored lowercase for consistent matching at sign-in time. `auth_id` is explicitly `null` — it gets filled in by the auth callback when the user first signs in.

- [ ] **Step 2: Run typecheck**

```powershell
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Manual smoke test — provision a new user**

Open the app in a browser → sign in as `ai@greenqubes.com` → Admin → Users tab → click "Provision new user" → enter an email that has NOT signed in yet (e.g. a test email), fill name/role/lang → submit.

Expected: form succeeds, new user row appears in the list. No "must sign in first" error.

- [ ] **Step 4: Verify in Supabase dashboard**

Open Supabase dashboard → Table Editor → `users`. Find the newly provisioned row. Confirm:
- `email` = the email you entered (lowercase)
- `auth_id` = `null`
- `name`, `role`, `lang` correct

- [ ] **Step 5: Commit**

```powershell
git add src/lib/supabase/queries/admin.ts
git commit -m "feat: rewrite provisionUser to not require prior sign-in"
```

---

## Task 4: Link `auth_id` in auth callback on first sign-in

**Files:**
- Modify: `src/app/auth/callback/route.ts`

- [ ] **Step 1: Replace the callback route**

Replace the entire contents of `src/app/auth/callback/route.ts` with:

```typescript
import { createClient }        from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse }        from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && session) {
      const email  = session.user.email?.toLowerCase()
      const authId = session.user.id

      if (email) {
        // Link auth_id to any pre-provisioned row that matches this email.
        // Uses service role client because RLS does not allow users to update their own auth_id.
        const db = createServiceClient()
        await db
          .from('users')
          .update({ auth_id: authId })
          .eq('email', email)
          .is('auth_id', null)
      }

      return NextResponse.redirect(`${origin}/`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`)
}
```

- [ ] **Step 2: Run typecheck**

```powershell
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```powershell
git add src/app/auth/callback/route.ts
git commit -m "feat: link auth_id on first sign-in for pre-provisioned users"
```

---

## Task 5: End-to-end verification + push to dev

- [ ] **Step 1: Run build to confirm no compile errors**

```powershell
npx next build
```

Expected: build succeeds with no TypeScript or module errors.

- [ ] **Step 2: Full end-to-end test**

1. Admin provisions a new email via Admin → Users tab (email must NOT have signed in before)
2. Confirm row in Supabase: `email` set, `auth_id = null`
3. Open a private/incognito browser window → go to the app → sign in with that Google account
4. After sign-in, check Supabase `users` table → confirm `auth_id` is now populated for that row
5. Confirm user is redirected to their role-appropriate page (not the "not provisioned" message)

- [ ] **Step 3: Test existing user flow is unchanged**

Sign in as an already-provisioned user (e.g. `ai@greenqubes.com`). Confirm:
- Sign-in works normally
- No errors in the callback
- Redirected to correct page

- [ ] **Step 4: Push to dev**

```powershell
git push origin dev
```

Verify Vercel preview deployment succeeds. Check the preview URL to confirm sign-in and provisioning work.
