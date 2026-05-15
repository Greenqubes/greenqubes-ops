# Admin Role Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded `ai@greenqubes.com` email gate with a proper `admin` DB role so new admins can be granted access by changing their role in the Users tab.

**Architecture:** Add `admin` to the `user_role` Postgres enum, update all RLS policies to grant admin the same access as scheduler (plus full read on all tables), swap every `email === ADMIN_EMAIL` check to `profile.role === 'admin'`, and add a confirmation modal in the Users tab when promoting any user to admin. `getEffectiveRole` returns `'scheduler'` as the default UI role for admin so no shell components need changes.

**Tech Stack:** Next.js 15 App Router, Supabase (Postgres 15, RLS), TypeScript strict, Tailwind CSS.

---

## File Map

| File | Change |
|---|---|
| `supabase/migrations/0018_admin_role_enum.sql` | New — add `admin` to `user_role` enum |
| `supabase/migrations/0019_admin_role_policies.sql` | New — seed admin row, drop/recreate RLS policies |
| `src/lib/supabase/types.ts` | Add `'admin'` to `Role` type |
| `src/components/Pill.tsx` | Add `admin` variant (terracotta) |
| `src/lib/utils/role-override.ts` | Drop email param, default admin to `'scheduler'` |
| `src/app/page.tsx` | Drop email arg from `getEffectiveRole` |
| `src/app/schedule/page.tsx` | Drop email arg |
| `src/app/completed/page.tsx` | Drop email arg |
| `src/app/approvals/page.tsx` | Drop email arg |
| `src/app/installer/page.tsx` | Drop email arg |
| `src/app/pending/page.tsx` | Drop email arg |
| `src/app/admin/page.tsx` | Role-based gate (`profile.role === 'admin'`) |
| `src/app/api/admin/health/route.ts` | Role-based `guardAdmin()` |
| `src/app/api/admin/digest/route.ts` | Role-based `guardAdmin()` |
| `src/app/api/admin/crashes/route.ts` | Role-based `guardAdmin()` |
| `src/app/api/admin/crashes/[id]/route.ts` | Role-based `guardAdmin()` |
| `src/app/api/admin/users/route.ts` | Role-based `guardAdmin()` |
| `src/app/api/admin/users/[id]/route.ts` | Role-based `guardAdmin()` |
| `src/components/UserMenu.tsx` | `isAdmin` from DB role, remove `ADMIN_EMAIL` |
| `src/features/admin/AdminShell.tsx` | Change `role: 'scheduler'` prop to `role: Role` |
| `src/features/admin/UsersTab.tsx` | Add `admin` to `ROLES`, add `AdminRoleModal` |
| `CLAUDE.md` | Update hard rule |

---

## Task 1: Migration 0018 — Add `admin` to enum

**Why two migrations?** Postgres does not allow using a newly added enum value in the same transaction as `ALTER TYPE ... ADD VALUE`. Migration 0018 adds the value; migration 0019 uses it.

**Files:**
- Create: `supabase/migrations/0018_admin_role_enum.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- 0018_admin_role_enum.sql
-- Adds 'admin' to the user_role enum.
-- Must be a separate migration from any statements that USE the new value
-- (Postgres constraint: enum values added in a transaction are not visible
-- within that same transaction).

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin';
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0018_admin_role_enum.sql
git commit -m "feat: add admin to user_role enum (migration 0018)"
```

---

## Task 2: Migration 0019 — Seed admin row + update RLS policies

**Files:**
- Create: `supabase/migrations/0019_admin_role_policies.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- 0019_admin_role_policies.sql
-- Seeds ai@greenqubes.com as admin.
-- Drops and recreates all RLS policies that referenced 'scheduler' or
-- ('sales', 'scheduler') to also include 'admin'.
-- Policies not listed here are unchanged (installer-specific, user-id-based,
-- or already open to all authenticated).

-- ── Seed ───────────────────────────────────────────────────────────────────
UPDATE public.users
SET role = 'admin'
WHERE email = 'ai@greenqubes.com';

-- ── jobs ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "jobs: sales and scheduler see all"     ON jobs;
DROP POLICY IF EXISTS "jobs: sales and scheduler can insert"  ON jobs;
DROP POLICY IF EXISTS "jobs: scheduler can update any"        ON jobs;
DROP POLICY IF EXISTS "jobs: scheduler can delete"            ON jobs;

CREATE POLICY "jobs: sales and scheduler see all"
  ON jobs FOR SELECT TO authenticated
  USING (get_my_role() IN ('sales', 'scheduler', 'admin'));

CREATE POLICY "jobs: sales and scheduler can insert"
  ON jobs FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('sales', 'scheduler', 'admin'));

CREATE POLICY "jobs: scheduler can update any"
  ON jobs FOR UPDATE TO authenticated
  USING (get_my_role() IN ('scheduler', 'admin'));

CREATE POLICY "jobs: scheduler can delete"
  ON jobs FOR DELETE TO authenticated
  USING (get_my_role() IN ('scheduler', 'admin'));

-- ── job_financials ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "financials: sales and scheduler select" ON job_financials;
DROP POLICY IF EXISTS "financials: sales and scheduler insert" ON job_financials;
DROP POLICY IF EXISTS "financials: sales and scheduler update" ON job_financials;

CREATE POLICY "financials: sales and scheduler select"
  ON job_financials FOR SELECT TO authenticated
  USING (get_my_role() IN ('sales', 'scheduler', 'admin'));

CREATE POLICY "financials: sales and scheduler insert"
  ON job_financials FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('sales', 'scheduler', 'admin'));

CREATE POLICY "financials: sales and scheduler update"
  ON job_financials FOR UPDATE TO authenticated
  USING  (get_my_role() IN ('sales', 'scheduler', 'admin'))
  WITH CHECK (get_my_role() IN ('sales', 'scheduler', 'admin'));

-- ── job_assignees ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "assignees: sales and scheduler see all" ON job_assignees;
DROP POLICY IF EXISTS "assignees: sales and scheduler insert"  ON job_assignees;
DROP POLICY IF EXISTS "assignees: sales and scheduler delete"  ON job_assignees;

CREATE POLICY "assignees: sales and scheduler see all"
  ON job_assignees FOR SELECT TO authenticated
  USING (get_my_role() IN ('sales', 'scheduler', 'admin'));

CREATE POLICY "assignees: sales and scheduler insert"
  ON job_assignees FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('sales', 'scheduler', 'admin'));

CREATE POLICY "assignees: sales and scheduler delete"
  ON job_assignees FOR DELETE TO authenticated
  USING (get_my_role() IN ('sales', 'scheduler', 'admin'));

-- ── files ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "files: sales and scheduler see all"    ON files;
DROP POLICY IF EXISTS "files: sales and scheduler insert"     ON files;

CREATE POLICY "files: sales and scheduler see all"
  ON files FOR SELECT TO authenticated
  USING (get_my_role() IN ('sales', 'scheduler', 'admin'));

CREATE POLICY "files: sales and scheduler insert"
  ON files FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('sales', 'scheduler', 'admin'));

-- ── messages ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "messages: sales and scheduler see all" ON messages;
DROP POLICY IF EXISTS "messages: sales and scheduler post"    ON messages;

CREATE POLICY "messages: sales and scheduler see all"
  ON messages FOR SELECT TO authenticated
  USING (get_my_role() IN ('sales', 'scheduler', 'admin'));

CREATE POLICY "messages: sales and scheduler post"
  ON messages FOR INSERT TO authenticated
  WITH CHECK (
    get_my_role() IN ('sales', 'scheduler', 'admin') AND
    author_id = get_my_id()
  );

-- ── asst_chats ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "asst_chats: scheduler reads all" ON asst_chats;

CREATE POLICY "asst_chats: scheduler reads all"
  ON asst_chats FOR SELECT TO authenticated
  USING (get_my_role() IN ('scheduler', 'admin'));

-- ── kb_chunks ──────────────────────────────────────────────────────────────
-- Admin bypass: admin sees all chunks regardless of visibility tokens.
DROP POLICY IF EXISTS "kb_chunks: visibility token check" ON kb_chunks;

CREATE POLICY "kb_chunks: visibility token check"
  ON kb_chunks FOR SELECT TO authenticated
  USING (
    get_my_role() = 'admin' OR
    'public-internal'                 = ANY(visibility) OR
    ('role:' || get_my_role())        = ANY(visibility) OR
    ('private:' || get_my_id()::text) = ANY(visibility)
  );

-- ── events ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "events: scheduler can read" ON events;

CREATE POLICY "events: scheduler can read"
  ON events FOR SELECT TO authenticated
  USING (get_my_role() IN ('scheduler', 'admin'));
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0019_admin_role_policies.sql
git commit -m "feat: grant admin full RLS access, seed ai@greenqubes as admin (migration 0019)"
```

---

## Task 3: TypeScript types + Pill component

**Files:**
- Modify: `src/lib/supabase/types.ts:7`
- Modify: `src/components/Pill.tsx`

- [ ] **Step 1: Add `'admin'` to the `Role` type in `src/lib/supabase/types.ts`**

Change line 7 from:
```typescript
export type Role = 'sales' | 'scheduler' | 'installer'
```
To:
```typescript
export type Role = 'sales' | 'scheduler' | 'installer' | 'admin'
```

Also update the `Enums` section at the bottom of the file (line 328):
```typescript
Enums: {
  user_role:    Role   // now includes 'admin'
  ...
}
```
(No change needed — it references the `Role` type which is already updated.)

- [ ] **Step 2: Add `admin` variant to `src/components/Pill.tsx`**

Replace the entire file content:

```typescript
import { cn } from '@/lib/utils/cn'
import type { JobStatus, Role } from '@/lib/supabase/types'

type PillVariant = JobStatus | Role | 'overdue'

const styles: Record<PillVariant, string> = {
  scheduled:         'bg-brand-blue-soft  text-brand-blue',
  pending:           'bg-brand-amber-soft text-brand-amber',
  awaiting_approval: 'bg-brand-amber-soft text-brand-amber',
  completed:         'bg-brand-green-soft text-brand-green',
  overdue:           'bg-bad text-white',
  sales:             'bg-brand-blue-soft  text-brand-blue',
  scheduler:         'bg-brand-amber-soft text-brand-amber',
  installer:         'bg-brand-green-soft text-brand-green',
  admin:             'bg-terracotta/10 text-terracotta',
}

const label: Record<PillVariant, string> = {
  scheduled:         'scheduled',
  pending:           'Pending',
  awaiting_approval: 'awaiting approval',
  completed:         'Completed',
  overdue:           'Overdue',
  sales:             'Sales',
  scheduler:         'Scheduler',
  installer:         'Installer',
  admin:             'Admin',
}

interface PillProps {
  variant: PillVariant
  className?: string
}

export function Pill({ variant, className }: PillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        styles[variant],
        className
      )}
    >
      {label[variant]}
    </span>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase/types.ts src/components/Pill.tsx
git commit -m "feat: add admin to Role type and Pill component"
```

---

## Task 4: Update `role-override.ts`

**Files:**
- Modify: `src/lib/utils/role-override.ts`

The email parameter is dropped. When the real role is `'admin'` and no preview cookie is set, return `'scheduler'` so admin gets the full scheduler UI by default without any changes to shell components. Admin page gating uses `profile.role` directly, not `getEffectiveRole`.

- [ ] **Step 1: Replace the entire file**

```typescript
import { cookies } from 'next/headers'
import type { Role } from '@/lib/supabase/types'

const VALID_ROLES = new Set<Role>(['sales', 'scheduler', 'installer'])

export async function getEffectiveRole(realRole: Role): Promise<Role> {
  if (realRole !== 'admin') return realRole
  try {
    const cookieStore = await cookies()
    const override = cookieStore.get('role_override')?.value as Role | undefined
    if (override && VALID_ROLES.has(override)) return override
  } catch {
    // cookies() unavailable in this context — fall back
  }
  return 'scheduler'
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/utils/role-override.ts
git commit -m "feat: drop email param from getEffectiveRole, default admin to scheduler"
```

---

## Task 5: Update page routes (drop email arg)

Six page files call `getEffectiveRole(profile.role, user.email)`. Remove the second argument from all of them.

**Files:**
- Modify: `src/app/page.tsx:28`
- Modify: `src/app/schedule/page.tsx:23`
- Modify: `src/app/completed/page.tsx:23`
- Modify: `src/app/approvals/page.tsx:23`
- Modify: `src/app/installer/page.tsx:23`
- Modify: `src/app/pending/page.tsx:23`

- [ ] **Step 1: `src/app/page.tsx` — drop email arg**

Change:
```typescript
const effectiveRole = await getEffectiveRole(profile.role, user.email)
```
To:
```typescript
const effectiveRole = await getEffectiveRole(profile.role)
```

- [ ] **Step 2: `src/app/schedule/page.tsx` — drop email arg**

Change:
```typescript
const effectiveRole = await getEffectiveRole(profile.role, user.email)
```
To:
```typescript
const effectiveRole = await getEffectiveRole(profile.role)
```

- [ ] **Step 3: `src/app/completed/page.tsx` — drop email arg**

Change:
```typescript
const effectiveRole = await getEffectiveRole(profile.role, user.email)
```
To:
```typescript
const effectiveRole = await getEffectiveRole(profile.role)
```

- [ ] **Step 4: `src/app/approvals/page.tsx` — drop email arg**

Change:
```typescript
const effectiveRole = await getEffectiveRole(profile.role, user.email)
```
To:
```typescript
const effectiveRole = await getEffectiveRole(profile.role)
```

- [ ] **Step 5: `src/app/installer/page.tsx` — drop email arg**

Change:
```typescript
const effectiveRole = await getEffectiveRole(profile.role, user.email)
```
To:
```typescript
const effectiveRole = await getEffectiveRole(profile.role)
```

- [ ] **Step 6: `src/app/pending/page.tsx` — drop email arg**

Change:
```typescript
const effectiveRole = await getEffectiveRole(profile.role, user.email)
```
To:
```typescript
const effectiveRole = await getEffectiveRole(profile.role)
```

- [ ] **Step 7: Commit**

```bash
git add src/app/page.tsx src/app/schedule/page.tsx src/app/completed/page.tsx \
        src/app/approvals/page.tsx src/app/installer/page.tsx src/app/pending/page.tsx
git commit -m "feat: drop email arg from getEffectiveRole in page routes"
```

---

## Task 6: Admin page gate — role-based

**Files:**
- Modify: `src/app/admin/page.tsx`

- [ ] **Step 1: Replace the file**

```typescript
import { redirect }     from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminShell }   from '@/features/admin/AdminShell'
import type { LangCode, Role } from '@/lib/supabase/types'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  type Profile = { name: string; role: Role; lang: LangCode }
  const { data: profile } = await supabase
    .from('users')
    .select('name, role, lang')
    .eq('auth_id', user.id)
    .maybeSingle() as { data: Profile | null; error: unknown }

  if (!profile) redirect('/login')
  if (profile.role !== 'admin') redirect('/schedule')

  return (
    <AdminShell
      userName={profile.name}
      role={profile.role}
      lang={profile.lang}
    />
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/page.tsx
git commit -m "feat: gate /admin by role=admin instead of email"
```

---

## Task 7: Admin API routes — role-based `guardAdmin`

Each of the five admin API route files has a local `guardAdmin()` that checks email. Replace with a role check. The new pattern fetches the user's profile row and checks `role === 'admin'`.

**Files:**
- Modify: `src/app/api/admin/health/route.ts`
- Modify: `src/app/api/admin/digest/route.ts`
- Modify: `src/app/api/admin/crashes/route.ts`
- Modify: `src/app/api/admin/crashes/[id]/route.ts`
- Modify: `src/app/api/admin/users/route.ts`
- Modify: `src/app/api/admin/users/[id]/route.ts`

In every file, replace the existing `ADMIN_EMAIL` constant and `guardAdmin` function with:

```typescript
async function guardAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('auth_id', user.id)
    .maybeSingle()
  return profile?.role === 'admin'
}
```

Remove `const ADMIN_EMAIL = 'ai@greenqubes.com'` from each file.

- [ ] **Step 1: Update `src/app/api/admin/health/route.ts`**

Remove:
```typescript
const ADMIN_EMAIL = 'ai@greenqubes.com'

async function guardAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.email === ADMIN_EMAIL
}
```

Add:
```typescript
async function guardAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('auth_id', user.id)
    .maybeSingle()
  return profile?.role === 'admin'
}
```

- [ ] **Step 2: Update `src/app/api/admin/digest/route.ts`** (same replacement — remove `ADMIN_EMAIL` constant and replace `guardAdmin`)

- [ ] **Step 3: Update `src/app/api/admin/crashes/route.ts`** (same replacement)

- [ ] **Step 4: Update `src/app/api/admin/crashes/[id]/route.ts`** (same replacement)

- [ ] **Step 5: Update `src/app/api/admin/users/route.ts`** (same replacement)

- [ ] **Step 6: Update `src/app/api/admin/users/[id]/route.ts`** (same replacement)

- [ ] **Step 7: Commit**

```bash
git add src/app/api/admin/
git commit -m "feat: gate all admin API routes by role=admin instead of email"
```

---

## Task 8: UserMenu — `isAdmin` from DB role

**Files:**
- Modify: `src/components/UserMenu.tsx`

`isAdmin` currently derives from `email === ADMIN_EMAIL`. The existing `useEffect` already queries `public.users` for `lang` — extend that select to include `role` and derive `isAdmin` from it.

- [ ] **Step 1: Remove `ADMIN_EMAIL` constant**

Delete this line near the top of the file:
```typescript
const ADMIN_EMAIL = 'ai@greenqubes.com'
```

- [ ] **Step 2: Extend the DB query to fetch role**

In the `useEffect`, change:
```typescript
const { data } = await supabase
  .from('users')
  .select('lang')
  .eq('auth_id', user.id)
  .maybeSingle() as { data: { lang: string } | null; error: unknown }
if (data?.lang) setLang(data.lang as LangCode)
```
To:
```typescript
const { data } = await supabase
  .from('users')
  .select('lang, role')
  .eq('auth_id', user.id)
  .maybeSingle() as { data: { lang: string; role: string } | null; error: unknown }
if (data?.lang) setLang(data.lang as LangCode)
if (data?.role) setIsAdmin(data.role === 'admin')
```

- [ ] **Step 3: Remove the email-based `isAdmin` line from the same `useEffect`**

Delete:
```typescript
const admin = userEmail === ADMIN_EMAIL
setIsAdmin(admin)
if (admin) setRoleOverride(readRoleOverrideCookie())
```

Replace with:
```typescript
setRoleOverride(readRoleOverrideCookie())
```

(The `setIsAdmin` call is now inside the DB query block above. `readRoleOverrideCookie()` can always run — it only shows the chip when `isAdmin` is true.)

- [ ] **Step 4: Commit**

```bash
git add src/components/UserMenu.tsx
git commit -m "feat: derive isAdmin from DB role in UserMenu"
```

---

## Task 9: AdminShell — update role prop type

**Files:**
- Modify: `src/features/admin/AdminShell.tsx:26-29`

The `role` prop is currently typed as `'scheduler'`. Change it to `Role`.

- [ ] **Step 1: Update the Props type in `src/features/admin/AdminShell.tsx`**

Add the import:
```typescript
import type { LangCode, Role } from '@/lib/supabase/types'
```
(Replace the existing `import type { LangCode } from ...` line.)

Change the Props type:
```typescript
type Props = {
  userName: string
  role:     Role
  lang:     LangCode
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/admin/AdminShell.tsx
git commit -m "feat: accept Role (not just scheduler) in AdminShell props"
```

---

## Task 10: UsersTab — add admin role + confirm modal

**Files:**
- Modify: `src/features/admin/UsersTab.tsx`

Two changes:
1. Add `'admin'` to the `ROLES` array so it appears in all role dropdowns
2. Add an `AdminRoleModal` that fires when either the provision form or the edit-role dropdown selects `'admin'`

### Modal behaviour

- **UserRow edit flow:** When the role select changes to `'admin'`, open the modal (confirm phase). Yes → immediately call the save API → transition to success phase showing `"{user.email} is now Admin!"` → Ok closes modal + refreshes list. No → revert role select to previous value.
- **ProvisionForm flow:** When the role select changes to `'admin'`, open the modal (confirm phase). Yes → close modal, keep role as `'admin'`, user completes form normally. No → revert role to `'installer'` (the default).

- [ ] **Step 1: Add `ROLES` update**

Change line 11:
```typescript
const ROLES: Role[] = ['sales', 'scheduler', 'installer']
```
To:
```typescript
const ROLES: Role[] = ['sales', 'scheduler', 'installer', 'admin']
```

- [ ] **Step 2: Add `AdminRoleModal` component**

Add this component before `ProvisionForm`:

```typescript
// ── Admin role confirmation modal ──────────────────────────────────────────

type ModalPhase = 'confirm' | 'success'

function AdminRoleModal({
  phase,
  email,
  onConfirm,
  onCancel,
  onClose,
}: {
  phase:     ModalPhase
  email:     string
  onConfirm: () => void
  onCancel:  () => void
  onClose:   () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm px-4">
      <div className="bg-paper border border-line rounded-card shadow-lg w-full max-w-sm p-6 flex flex-col gap-4">
        {phase === 'confirm' ? (
          <>
            <p className="font-display font-medium text-ink text-base">Are you sure?</p>
            <p className="text-sm text-ink2">
              This user will have unrestricted access to the whole system.
            </p>
            <div className="flex gap-2 justify-end">
              <Btn variant="ghost" size="sm" onClick={onCancel}>No</Btn>
              <Btn variant="accent" size="sm" onClick={onConfirm}>Yes</Btn>
            </div>
          </>
        ) : (
          <>
            <p className="font-display font-medium text-ink text-base">
              {email} is now Admin!
            </p>
            <div className="flex justify-end">
              <Btn variant="primary" size="sm" onClick={onClose}>Ok</Btn>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Update `ProvisionForm` to intercept admin role selection**

Add modal state to `ProvisionForm`:

```typescript
function ProvisionForm({ onDone }: { onDone: () => void }) {
  const [email,       setEmail]       = useState('')
  const [name,        setName]        = useState('')
  const [role,        setRole]        = useState<Role>('installer')
  const [lang,        setLang]        = useState<LangCode>('en')
  const [busy,        setBusy]        = useState(false)
  const [err,         setErr]         = useState<string | null>(null)
  const [showModal,   setShowModal]   = useState(false)
  const [pendingRole, setPendingRole] = useState<Role | null>(null)

  function handleRoleChange(next: Role) {
    if (next === 'admin') {
      setPendingRole(next)
      setShowModal(true)
    } else {
      setRole(next)
    }
  }

  function confirmAdmin() {
    if (pendingRole) setRole(pendingRole)
    setPendingRole(null)
    setShowModal(false)
  }

  function cancelAdmin() {
    setPendingRole(null)
    setShowModal(false)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setErr(null)
    try {
      const res = await fetch('/api/admin/users', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, name, role, lang }),
      })
      if (!res.ok) {
        const { error } = await res.json() as { error: string }
        throw new Error(error)
      }
      setEmail(''); setName('')
      onDone()
    } catch (err) {
      setErr((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {showModal && (
        <AdminRoleModal
          phase="confirm"
          email={email || 'This user'}
          onConfirm={confirmAdmin}
          onCancel={cancelAdmin}
          onClose={cancelAdmin}
        />
      )}
      <Card className="p-4 mb-4">
        <p className="text-[11px] uppercase tracking-widest text-muted font-medium mb-3">
          Provision new user
        </p>
        <form onSubmit={submit} className="flex flex-col gap-2.5">
          <input
            className="w-full border border-line rounded-lg px-3 py-2 text-sm text-ink bg-bg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-terracotta/40"
            placeholder="Google account email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <input
            className="w-full border border-line rounded-lg px-3 py-2 text-sm text-ink bg-bg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-terracotta/40"
            placeholder="Display name"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
          <div className="flex gap-2">
            <select
              className="flex-1 border border-line rounded-lg px-3 py-2 text-sm text-ink bg-bg focus:outline-none focus:ring-2 focus:ring-terracotta/40"
              value={role}
              onChange={e => handleRoleChange(e.target.value as Role)}
            >
              {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
            </select>
            <select
              className="w-24 border border-line rounded-lg px-3 py-2 text-sm text-ink bg-bg focus:outline-none focus:ring-2 focus:ring-terracotta/40"
              value={lang}
              onChange={e => setLang(e.target.value as LangCode)}
            >
              {LANGS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          {err && <p className="text-xs text-red-500">{err}</p>}
          <Btn type="submit" variant="accent" size="sm" disabled={busy}>
            {busy ? 'Adding…' : 'Add user'}
          </Btn>
        </form>
      </Card>
    </>
  )
}
```

- [ ] **Step 4: Update `UserRow` to intercept admin role selection and auto-save**

Add modal state to `UserRow`:

```typescript
function UserRow({ user, onSaved }: { user: AdminUser; onSaved: () => void }) {
  const [editing,     setEditing]     = useState(false)
  const [role,        setRole]        = useState<Role>(user.role)
  const [tgId,        setTgId]        = useState(user.telegram_chat_id ?? '')
  const [digestSub,   setDigestSub]   = useState(user.digest_subscriber)
  const [busy,        setBusy]        = useState(false)
  const [err,         setErr]         = useState<string | null>(null)
  const [modalPhase,  setModalPhase]  = useState<'confirm' | 'success' | null>(null)
  const [prevRole,    setPrevRole]    = useState<Role>(user.role)

  function handleRoleChange(next: Role) {
    if (next === 'admin') {
      setPrevRole(role)
      setModalPhase('confirm')
    } else {
      setRole(next)
    }
  }

  async function confirmAdmin() {
    setRole('admin')
    setBusy(true); setErr(null)
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          role:              'admin',
          telegram_chat_id:  tgId.trim() || null,
          digest_subscriber: digestSub,
        }),
      })
      if (!res.ok) {
        const { error } = await res.json() as { error: string }
        throw new Error(error)
      }
      setModalPhase('success')
    } catch (err) {
      setErr((err as Error).message)
      setRole(prevRole)
      setModalPhase(null)
    } finally {
      setBusy(false)
    }
  }

  function cancelAdmin() {
    setModalPhase(null)
  }

  function closeSuccessModal() {
    setModalPhase(null)
    setEditing(false)
    onSaved()
  }

  async function save() {
    setBusy(true); setErr(null)
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          role,
          telegram_chat_id:  tgId.trim() || null,
          digest_subscriber: digestSub,
        }),
      })
      if (!res.ok) {
        const { error } = await res.json() as { error: string }
        throw new Error(error)
      }
      setEditing(false)
      onSaved()
    } catch (err) {
      setErr((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function cancel() {
    setRole(user.role)
    setTgId(user.telegram_chat_id ?? '')
    setDigestSub(user.digest_subscriber)
    setEditing(false)
    setErr(null)
  }

  const joined = new Date(user.created_at).toLocaleDateString('en-SG', {
    day: 'numeric', month: 'short', year: 'numeric',
  })

  return (
    <>
      {modalPhase && (
        <AdminRoleModal
          phase={modalPhase}
          email={user.email ?? user.name}
          onConfirm={confirmAdmin}
          onCancel={cancelAdmin}
          onClose={closeSuccessModal}
        />
      )}
      <Card className={cn('p-4 transition-colors', editing && 'ring-2 ring-terracotta/30')}>
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0">
            <p className="font-display font-medium text-ink text-sm truncate">{user.name}</p>
            <p className="text-xs text-muted truncate">{joined}</p>
          </div>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-muted hover:text-ink2 underline underline-offset-2 shrink-0"
            >
              Edit
            </button>
          )}
        </div>

        {editing ? (
          <div className="flex flex-col gap-2.5 mt-2">
            <select
              className="w-full border border-line rounded-lg px-3 py-2 text-sm text-ink bg-bg focus:outline-none focus:ring-2 focus:ring-terracotta/40"
              value={role}
              onChange={e => handleRoleChange(e.target.value as Role)}
            >
              {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
            </select>

            <div>
              <label className="text-xs text-muted mb-1 block">Telegram Chat ID</label>
              <input
                className="w-full border border-line rounded-lg px-3 py-2 text-sm text-ink bg-bg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-terracotta/40"
                placeholder="e.g. 123456789"
                value={tgId}
                onChange={e => setTgId(e.target.value)}
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="accent-terracotta w-4 h-4"
                checked={digestSub}
                onChange={e => setDigestSub(e.target.checked)}
              />
              <span className="text-sm text-ink">Receives Monday digest</span>
            </label>

            {err && <p className="text-xs text-red-500">{err}</p>}

            <div className="flex gap-2">
              <Btn variant="primary" size="sm" onClick={save} disabled={busy}>
                {busy ? 'Saving…' : 'Save'}
              </Btn>
              <Btn variant="ghost" size="sm" onClick={cancel} disabled={busy}>
                Cancel
              </Btn>
            </div>
          </div>
        ) : (
          <>
            {user.auth_id === null && user.email && (
              <p className="text-sm text-[--ink2] mb-2">Waiting for sign-in: <span className="font-medium">{user.email}</span></p>
            )}
            <div className="flex flex-wrap gap-2 items-center">
              <Pill variant={user.role} />
              {user.telegram_chat_id ? (
                <span className="text-xs text-muted font-mono">TG {user.telegram_chat_id}</span>
              ) : (
                <span className="text-xs text-muted italic">No Telegram ID</span>
              )}
              {user.digest_subscriber && (
                <span className="text-xs bg-brand-blue/10 text-brand-blue border border-brand-blue/20 rounded-full px-2 py-0.5 font-medium">
                  digest
                </span>
              )}
              {!user.auth_id && (
                <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">
                  not linked
                </span>
              )}
            </div>
          </>
        )}
      </Card>
    </>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add src/features/admin/UsersTab.tsx
git commit -m "feat: add admin role to UsersTab with confirmation modal"
```

---

## Task 11: Update CLAUDE.md hard rule

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the hard rule**

Find:
```
- zh/bn language settings are for UI text translation only. All date labels, day names, and month names are always English regardless of user language.
- Stack is locked. Do not suggest Firebase, AWS S3, OpenAI embeddings, Pinecone, or any alternative to the chosen services. See `docs/context.md` for the full list.
```

The rule to change is in the `## Hard rules` section. Find:
```
- zh/bn language settings are for UI text translation only...
```

Look for the fourth-role rule (it may appear in CLAUDE.md as "Don't add a fourth role."). Replace it with:
```
- Never add or remove roles without explicit user confirmation. Claude may suggest new roles but must not implement without approval.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md roles hard rule"
```

---

## Task 12: Apply migrations + typecheck

- [ ] **Step 1: Apply both migrations**

```bash
npx supabase db push
```

Expected output: migrations 0018 and 0019 applied successfully. Verify `ai@greenqubes.com` now has role `admin` by checking the Supabase dashboard → Table Editor → users.

- [ ] **Step 2: Run typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors. If there are errors, they will be in files where `Role` is used in a non-exhaustive switch or where the old `getEffectiveRole(role, email)` signature is still being called.

- [ ] **Step 3: Push to dev and verify preview**

```bash
git push origin dev
```

Open the Vercel preview URL. Sign in as `ai@greenqubes.com`. Verify:
- Admin page loads (not redirected to `/schedule`)
- Preview as roles still works
- Sign in as a non-admin account → admin page redirects to `/schedule`
- Admin → Users tab → edit a user's role to Admin → confirm modal fires → success message shows

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -p
git commit -m "fix: typecheck and preview fixes for admin role"
```
