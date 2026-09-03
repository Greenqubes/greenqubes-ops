# Provisioning Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Card-only (email-less) user provisioning, subroles, Driver flag, qualifications, link-status tags, admin filter + rename — live on production tonight for the 2026-09-04 launch demo.

**Architecture:** One additive migration (0051) adds `subrole` / `is_driver` / `qualifications` to `users` and extends the 0044 privileged-column guard. A pure helper module (`user-meta.ts`) centralizes link-status derivation, card meta building, and list filtering. Server queries derive `link_status` and never ship raw email/auth_id to card components. UI: admin UsersTab gains filters, rename/email editing, and the new fields; the two job-form grids render a shared `UserMetaLine`; FCFS panel + clash modal swap their meta lines (no link tags there).

**Tech Stack:** Next.js 15 App Router, TypeScript strict, Tailwind (design tokens), Supabase (service + user-scoped clients), standalone tsx test scripts (no framework).

**Spec:** `docs/superpowers/specs/2026-09-03-provisioning-overhaul-design.md`

## Global Constraints

- **Deploy order:** migration 0051 is `npx supabase db push`-ed to the shared DB BEFORE any code lands on `dev`/`main` (new code SELECTs the new columns — feat-files lesson). Nic runs the push (or asks Claude to).
- Subroles/qualifications are **labels only** — zero permission impact; the 7-role model is untouched.
- i18n: new user-facing strings in `src/lib/i18n/en.ts` + `zh.ts` ONLY (bn frozen, falls back). Admin screens stay hardcoded English (existing precedent in `UsersTab.tsx`).
- TypeScript strict, no `any`/`@ts-ignore`. Files < 500 lines.
- `years_experience` / `skills`: remove from UI + swap out of queries where the meta line changes, but DB columns, `types.ts` Row entries, and `AdminUser` stay (dropped in a later session — ledgered).
- Tests: standalone tsx scripts (`npx tsx <file>`, exit 1 on failure) — mirror `src/lib/utils/design-urgency.test.ts` conventions.
- Link-status wording is Nic's exact spec: red **"Unlinked"** (no email), yellow **"Unlinked"** (email, never signed in), green **"Linked"** (`auth_id` set).
- Commit after every task; branch `feat-provision-organisation`; do NOT push to `dev` until Nic confirms the DB push happened.

---

### Task 1: `user-meta` helper + test suite

**Files:**
- Create: `src/lib/utils/user-meta.ts`
- Test: `src/lib/utils/user-meta.test.ts`

**Interfaces:**
- Produces (later tasks import these exact names from `@/lib/utils/user-meta`):
  - `type LinkStatus = 'none' | 'pending' | 'linked'`
  - `linkStatus(u: { email: string | null; auth_id: string | null }): LinkStatus`
  - `type UserMeta = { subroleLine: string | null; isDriver: boolean; qualifications: string[] }`
  - `buildUserMeta(u: { role?: string | null; subrole?: string | null; is_driver?: boolean | null; qualifications?: string[] | null }): UserMeta`
  - `filterUsers<T extends { role: string; subrole: string | null }>(users: T[], role: string, subrole: string): T[]` — `role`/`subrole` accept `'all'`; `subrole: 'none'` matches rows with null/empty subrole
  - `subroleSuggestions(users: Array<{ role: string; subrole: string | null }>, role: string): string[]` — distinct, sorted, for that role
  - `qualificationSuggestions(users: Array<{ qualifications: string[] | null }>): string[]` — distinct, sorted

- [ ] **Step 1: Write the failing test** — create `src/lib/utils/user-meta.test.ts`:

```ts
// Standalone test — run with: npx tsx src/lib/utils/user-meta.test.ts
// Exits 1 on failure (repo convention — no test framework).
import {
  linkStatus, buildUserMeta, filterUsers,
  subroleSuggestions, qualificationSuggestions,
} from './user-meta'

let failed = 0
function check(name: string, cond: boolean) {
  if (cond) { console.log(`  ✓ ${name}`) } else { failed++; console.error(`  ✗ ${name}`) }
}
function eq<T>(name: string, got: T, want: T) {
  check(`${name} (got ${JSON.stringify(got)})`, JSON.stringify(got) === JSON.stringify(want))
}

console.log('linkStatus')
eq('no email → none (red Unlinked)',          linkStatus({ email: null, auth_id: null }), 'none')
eq('email, never signed in → pending',        linkStatus({ email: 'a@b.c', auth_id: null }), 'pending')
eq('signed in → linked',                      linkStatus({ email: 'a@b.c', auth_id: 'uid' }), 'linked')
eq('auth without email (edge) → linked',      linkStatus({ email: null, auth_id: 'uid' }), 'linked')
eq('empty-string email counts as no email',   linkStatus({ email: '', auth_id: null }), 'none')

console.log('buildUserMeta')
eq('subrole wins', buildUserMeta({ role: 'production', subrole: 'metalworks' }).subroleLine, 'metalworks')
eq('falls back to role', buildUserMeta({ role: 'installer', subrole: null }).subroleLine, 'installer')
eq('empty subrole falls back', buildUserMeta({ role: 'installer', subrole: '  ' }).subroleLine, 'installer')
eq('no role no subrole → null', buildUserMeta({}).subroleLine, null)
eq('driver default false', buildUserMeta({ role: 'installer' }).isDriver, false)
eq('driver true carried', buildUserMeta({ role: 'installer', is_driver: true }).isDriver, true)
eq('qualifications default empty', buildUserMeta({}).qualifications, [])
eq('qualifications carried', buildUserMeta({ qualifications: ['WAH'] }).qualifications, ['WAH'])

console.log('filterUsers')
const users = [
  { role: 'production', subrole: 'metalworks' },
  { role: 'production', subrole: 'printing' },
  { role: 'production', subrole: null },
  { role: 'installer',  subrole: 'printing' },
]
eq('all/all keeps everything', filterUsers(users, 'all', 'all').length, 4)
eq('role filter', filterUsers(users, 'production', 'all').length, 3)
eq('subrole filter', filterUsers(users, 'all', 'printing').length, 2)
eq('role+subrole', filterUsers(users, 'production', 'printing').length, 1)
eq('none = missing subrole', filterUsers(users, 'all', 'none').length, 1)
eq('none + role', filterUsers(users, 'installer', 'none').length, 0)

console.log('suggestions')
eq('subroles distinct+sorted for role',
   subroleSuggestions([
     { role: 'production', subrole: 'printing' },
     { role: 'production', subrole: 'metalworks' },
     { role: 'production', subrole: 'printing' },
     { role: 'installer',  subrole: 'rigging' },
     { role: 'production', subrole: null },
   ], 'production'),
   ['metalworks', 'printing'])
eq('qualifications distinct+sorted',
   qualificationSuggestions([
     { qualifications: ['WAH', 'Safety Supervisor'] },
     { qualifications: ['WAH'] },
     { qualifications: null },
   ]),
   ['Safety Supervisor', 'WAH'])

if (failed > 0) { console.error(`\n${failed} check(s) failed`); process.exit(1) }
console.log('\nAll user-meta checks passed')
```

- [ ] **Step 2: Run to verify it fails** — `npx tsx src/lib/utils/user-meta.test.ts` → expect module-not-found error for `./user-meta`.

- [ ] **Step 3: Implement** — create `src/lib/utils/user-meta.ts`:

```ts
// Pure helpers for user name-card meta + admin list filtering.
// Link status (Nic, 2026-09-03): red "Unlinked" = no email (card-only row),
// yellow "Unlinked" = email set but never signed in, green "Linked" = auth_id set.

export type LinkStatus = 'none' | 'pending' | 'linked'

export function linkStatus(u: { email: string | null; auth_id: string | null }): LinkStatus {
  if (u.auth_id) return 'linked'
  if (u.email && u.email.trim() !== '') return 'pending'
  return 'none'
}

export type UserMeta = {
  subroleLine:    string | null
  isDriver:       boolean
  qualifications: string[]
}

export function buildUserMeta(u: {
  role?: string | null
  subrole?: string | null
  is_driver?: boolean | null
  qualifications?: string[] | null
}): UserMeta {
  const subrole = u.subrole?.trim()
  return {
    subroleLine:    subrole || u.role || null,
    isDriver:       u.is_driver === true,
    qualifications: u.qualifications ?? [],
  }
}

export function filterUsers<T extends { role: string; subrole: string | null }>(
  users: T[],
  role: string,
  subrole: string,
): T[] {
  return users.filter(u => {
    if (role !== 'all' && u.role !== role) return false
    if (subrole === 'all') return true
    if (subrole === 'none') return !u.subrole?.trim()
    return u.subrole?.trim() === subrole
  })
}

export function subroleSuggestions(
  users: Array<{ role: string; subrole: string | null }>,
  role: string,
): string[] {
  const set = new Set<string>()
  for (const u of users) {
    const s = u.subrole?.trim()
    if (s && u.role === role) set.add(s)
  }
  return [...set].sort((a, b) => a.localeCompare(b))
}

export function qualificationSuggestions(
  users: Array<{ qualifications: string[] | null }>,
): string[] {
  const set = new Set<string>()
  for (const u of users) for (const q of u.qualifications ?? []) {
    const s = q.trim()
    if (s) set.add(s)
  }
  return [...set].sort((a, b) => a.localeCompare(b))
}
```

- [ ] **Step 4: Run to verify it passes** — `npx tsx src/lib/utils/user-meta.test.ts` → "All user-meta checks passed".

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/user-meta.ts src/lib/utils/user-meta.test.ts
git commit -m "feat(provision): user-meta helpers — link status, card meta, filters (TDD)"
```

---

### Task 2: Migration 0051 + types + admin queries/routes (backend slice)

**Files:**
- Create: `supabase/migrations/0051_user_subrole_driver_qualifications.sql`
- Modify: `src/lib/supabase/types.ts:29-30` (users Row — add 3 fields after `skills`)
- Modify: `src/lib/supabase/queries/admin.ts:13-83` (`AdminUser`, `getAllUsers`, `provisionUser`, `updateUser`)
- Modify: `src/app/api/admin/users/route.ts:30-46` (POST — email optional, new fields)
- Modify: `src/app/api/admin/users/[id]/route.ts:25-34` (PATCH — extended body)

**Interfaces:**
- Consumes: nothing from Task 1 (independent).
- Produces: `AdminUser` gains `subrole: string | null`, `is_driver: boolean`, `qualifications: string[]` (keeps `years_experience`/`skills`). `provisionUser(email: string | null, name, role, lang?, extras?: { subrole?: string | null; is_driver?: boolean; qualifications?: string[] })`. `updateUser` patch adds `'name' | 'email' | 'subrole' | 'is_driver' | 'qualifications'`. POST body: `email?` now optional; PATCH body mirrors the patch type.

- [ ] **Step 1: Write migration** — `supabase/migrations/0051_user_subrole_driver_qualifications.sql`:

```sql
-- 0051_user_subrole_driver_qualifications.sql
-- Provisioning overhaul (2026-09-03): subrole label, Driver flag, qualification
-- tags on users. Labels only — no permission impact; the 7-role model is untouched.
-- Also extends the 0044 privileged-column guard: these are admin-managed facts
-- (a user must not self-declare Driver or a license from the browser client).

alter table public.users add column if not exists subrole        text;
alter table public.users add column if not exists is_driver      boolean not null default false;
alter table public.users add column if not exists qualifications text[]  not null default '{}';

-- Full replacement of the 0044 function body with the three new columns added.
create or replace function public.guard_users_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if get_my_role() = 'admin' then
    return new;
  end if;

  if new.role                 is distinct from old.role
     or new.auth_id           is distinct from old.auth_id
     or new.email             is distinct from old.email
     or new.deleted_at        is distinct from old.deleted_at
     or new.digest_subscriber is distinct from old.digest_subscriber
     or new.telegram_chat_id  is distinct from old.telegram_chat_id
     or new.subrole           is distinct from old.subrole
     or new.is_driver         is distinct from old.is_driver
     or new.qualifications    is distinct from old.qualifications
  then
    raise exception 'Not allowed to modify privileged user fields'
      using errcode = '42501';
  end if;

  return new;
end;
$$;
-- Trigger from 0044 already points at this function — no re-create needed.
```

- [ ] **Step 2: Extend `types.ts` users Row** — after `skills: string[]` (line 30) add:

```ts
          subrole:           string | null
          is_driver:         boolean
          qualifications:    string[]
```

(`Insert`/`Update` derive from Row — no further edits.)

- [ ] **Step 3: Extend `AdminUser` + `getAllUsers`** in `src/lib/supabase/queries/admin.ts` — add to the type after `skills`:

```ts
  subrole:           string | null
  is_driver:         boolean
  qualifications:    string[]
```

and change the `getAllUsers` select to:

```ts
    .select('id, auth_id, email, name, role, telegram_chat_id, lang, phone, digest_subscriber, years_experience, skills, subrole, is_driver, qualifications, created_at, deleted_at')
```

- [ ] **Step 4: Rework `provisionUser`** (replace the whole function):

```ts
export async function provisionUser(
  email: string | null,
  name:  string,
  role:  Role,
  lang:  LangCode = 'en',
  extras: { subrole?: string | null; is_driver?: boolean; qualifications?: string[] } = {},
): Promise<AdminUser> {
  const db = createServiceClient()
  const cleanEmail = email?.trim().toLowerCase() || null

  // Prevent duplicate provisioning by email (card-only rows have no email to clash)
  if (cleanEmail) {
    const { data: existing } = await db
      .from('users')
      .select('id')
      .eq('email', cleanEmail)
      .maybeSingle()
    if (existing) throw new Error(`${cleanEmail} is already provisioned.`)
  }

  const { data, error } = await db
    .from('users')
    .insert({
      email:             cleanEmail,
      auth_id:           null,
      name,
      role,
      lang,
      digest_subscriber: false,
      visibility:        ['public-internal'],
      subrole:           extras.subrole?.trim() || null,
      is_driver:         extras.is_driver === true,
      qualifications:    extras.qualifications ?? [],
    } as never)
    .select()
    .single()
  if (error) {
    if (error.code === '23505') throw new Error(`${cleanEmail} is already provisioned.`)
    throw error
  }
  return data as unknown as AdminUser
}
```

- [ ] **Step 5: Extend `updateUser` patch type** — replace the Pick with:

```ts
  patch: Partial<Pick<AdminUser,
    'role' | 'telegram_chat_id' | 'digest_subscriber' | 'lang' | 'phone' |
    'years_experience' | 'skills' |
    'name' | 'email' | 'subrole' | 'is_driver' | 'qualifications'>>,
```

and inside the function, before the update, normalize email + surface the duplicate error:

```ts
  const clean = { ...patch }
  if (typeof clean.email === 'string') clean.email = clean.email.trim().toLowerCase() || null
  if (typeof clean.subrole === 'string') clean.subrole = clean.subrole.trim() || null
  const db = createServiceClient()
  const { error } = await db.from('users').update(clean as never).eq('id', id)
  if (error) {
    if (error.code === '23505') throw new Error('That email is already used by another user.')
    throw error
  }
```

- [ ] **Step 6: POST route** (`src/app/api/admin/users/route.ts`) — replace the body-parse block:

```ts
    const { email, name, role, lang, subrole, is_driver, qualifications } = await req.json() as {
      email?: string | null; name: string; role: Role; lang?: LangCode
      subrole?: string | null; is_driver?: boolean; qualifications?: string[]
    }
    if (!name?.trim() || !role) {
      return NextResponse.json({ error: 'name and role are required' }, { status: 400 })
    }
    const user = await provisionUser(email ?? null, name.trim(), role, lang, { subrole, is_driver, qualifications })
```

- [ ] **Step 7: PATCH route** (`src/app/api/admin/users/[id]/route.ts`) — extend the body type:

```ts
    const patch = await req.json() as Partial<{
      role:              Role
      telegram_chat_id:  string | null
      digest_subscriber: boolean
      lang:              LangCode
      phone:             string | null
      name:              string
      email:             string | null
      subrole:           string | null
      is_driver:         boolean
      qualifications:    string[]
    }>
    if (typeof patch.name === 'string' && !patch.name.trim()) {
      return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 })
    }
```

- [ ] **Step 8: Verify** — `npm run type-check` passes; `npx tsx src/lib/utils/user-meta.test.ts` still green.

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/0051_user_subrole_driver_qualifications.sql src/lib/supabase/types.ts src/lib/supabase/queries/admin.ts "src/app/api/admin/users/route.ts" "src/app/api/admin/users/[id]/route.ts"
git commit -m "feat(provision): migration 0051 + email-optional provisioning + rename/email/subrole/driver/qualifications in admin API"
```

---

### Task 3: Admin UI — provision form + edit form (UsersTab part 1)

**Files:**
- Modify: `src/features/admin/UsersTab.tsx` (`ProvisionForm` 62-169, `UserRow` editing branch 400-489, `save()` 287-315, `cancel()` 339-348)

**Interfaces:**
- Consumes: Task 1 helpers (`subroleSuggestions`, `qualificationSuggestions`), Task 2 API shapes.
- Produces: `ProvisionForm` now takes `{ onDone, allUsers }: { onDone: () => void; allUsers: AdminUser[] }` (for suggestions). `UserRow` unchanged signature.

- [ ] **Step 1: ProvisionForm** — email input loses `required` + `type="email"` stays; placeholder becomes `"Google account email (leave blank for a name card only)"`. Submit body gains the new fields. Add state + inputs after the role/lang row:

```tsx
  const [subrole, setSubrole] = useState('')
  const [isDriver, setIsDriver] = useState(false)
  const [quals, setQuals] = useState<string[]>([])
  const [qualInput, setQualInput] = useState('')
```

Subrole input with datalist suggestions (native, no new component needed):

```tsx
          <input
            className="w-full border border-line rounded-lg px-3 py-2 text-sm text-ink bg-bg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-terracotta/40"
            placeholder="Subrole — e.g. metalworks, printing (optional)"
            value={subrole}
            onChange={e => setSubrole(e.target.value)}
            list="subrole-suggestions"
          />
          <datalist id="subrole-suggestions">
            {subroleSuggestions(allUsers, role).map(s => <option key={s} value={s} />)}
          </datalist>
          {role === 'installer' && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="accent-terracotta w-4 h-4"
                     checked={isDriver} onChange={e => setIsDriver(e.target.checked)} />
              <span className="text-sm text-ink">Driver (licensed vehicle operator)</span>
            </label>
          )}
```

Qualifications chip editor — copy the existing skills chip pattern (lines 450-475) verbatim but bound to `quals`/`qualInput`, label **"Qualifications / licenses"**, placeholder `"e.g. WAH, Safety Supervisor — press Enter"`, plus `list="qual-suggestions"` + a `<datalist id="qual-suggestions">{qualificationSuggestions(allUsers).map(...)}</datalist>`. Submit body: `JSON.stringify({ email: email.trim() || null, name, role, lang, subrole: subrole.trim() || null, is_driver: isDriver, qualifications: quals })`. Reset all new state on success.

- [ ] **Step 2: UserRow edit form** — add state seeded from the user:

```tsx
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email ?? '')
  const [subrole, setSubrole] = useState(user.subrole ?? '')
  const [isDriver, setIsDriver] = useState(user.is_driver)
  const [quals, setQuals] = useState<string[]>(user.qualifications ?? [])
  const [qualInput, setQualInput] = useState('')
```

In the editing branch, ABOVE the role select, add (hidden for GreenqubesAI, same guard as the role select):

```tsx
            {user.name !== 'GreenqubesAI' && (
              <>
                <div>
                  <label className="text-xs text-muted mb-1 block">Display name</label>
                  <input className="w-full border border-line rounded-lg px-3 py-2 text-sm text-ink bg-bg focus:outline-none focus:ring-2 focus:ring-terracotta/40"
                         value={name} onChange={e => setName(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted mb-1 block">Google account email</label>
                  <input type="email" placeholder="Add email to let them sign in"
                         className="w-full border border-line rounded-lg px-3 py-2 text-sm text-ink bg-bg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-terracotta/40"
                         value={email} onChange={e => setEmail(e.target.value)} />
                </div>
              </>
            )}
```

After the role select add the subrole input + installer-only Driver checkbox + qualifications chips (same blocks as Step 1, datalist ids `subrole-suggestions-${user.id}` / `qual-suggestions-${user.id}` to avoid collisions; suggestions from a new `allUsers` prop threaded by Task 4 — until then use `[user]`, Task 4 finishes the wiring).
**Delete** the `role === 'installer'` years-experience + skills block (lines 436-477) and the `yearsExp`/`skills`/`skillInput` state + `addSkill` (lines 223-225, 234-238) + their `cancel()` resets.
`save()` body becomes:

```ts
      const body: Record<string, unknown> = {
        role,
        telegram_chat_id:  tgId.trim() || null,
        digest_subscriber: digestSub,
        subrole:           subrole.trim() || null,
        is_driver:         isDriver,
        qualifications:    quals,
      }
      if (user.name !== 'GreenqubesAI') {
        body.name  = name.trim()
        body.email = email.trim() || null
      }
```

`cancel()` resets the new state from `user.*`.

- [ ] **Step 3: Verify** — `npm run type-check` passes (UsersTab compiles with the new AdminUser fields).

- [ ] **Step 4: Commit**

```bash
git add src/features/admin/UsersTab.tsx
git commit -m "feat(provision): card-only provisioning + rename/email/subrole/driver/qualifications in admin forms"
```

---

### Task 4: Admin UI — row display, link tags, filter bar (UsersTab part 2)

**Files:**
- Modify: `src/features/admin/UsersTab.tsx` (`UserRow` display branch 490-514, `UsersTab` root 522-599, `ProvisionForm` call site 565-567)

**Interfaces:**
- Consumes: Task 1 (`linkStatus`, `filterUsers`, `subroleSuggestions`, `qualificationSuggestions`), Task 3 form changes.
- Produces: `UserRow` gains `allUsers: AdminUser[]` prop (suggestion datalists); `ProvisionForm` receives `allUsers` here.

- [ ] **Step 1: Link tag + new display badges in UserRow** — replace the old amber "not linked" badge (lines 507-511) with a three-state tag:

```tsx
              {(() => {
                const st = linkStatus(user)
                return st === 'linked' ? (
                  <span className="text-xs bg-brand-green/10 text-brand-green border border-brand-green/20 rounded-full px-2 py-0.5 font-medium">Linked</span>
                ) : st === 'pending' ? (
                  <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5 font-medium">Unlinked</span>
                ) : (
                  <span className="text-xs bg-red-50 text-red-700 border border-red-200 rounded-full px-2 py-0.5 font-medium">Unlinked</span>
                )
              })()}
```

Above the pill row: keep "Waiting for sign-in: {email}" for pending rows (existing lines 492-494 already gate on `user.email` — unchanged); add for card-only rows:

```tsx
            {user.auth_id === null && !user.email && (
              <p className="text-sm text-[--ink2] mb-2">Card only — no email yet</p>
            )}
```

In the pill row, after `<Pill variant={user.role} />` add subrole + driver + qualification tags:

```tsx
              {user.subrole && (
                <span className="text-xs text-ink2 bg-bg border border-line rounded-full px-2 py-0.5">{user.subrole}</span>
              )}
              {user.is_driver && (
                <span className="text-xs bg-brand-blue/10 text-brand-blue border border-brand-blue/20 rounded-full px-2 py-0.5 font-medium">Driver</span>
              )}
              {(user.qualifications ?? []).map(q => (
                <span key={q} className="text-xs text-muted bg-bg border border-line rounded-full px-2 py-0.5">{q}</span>
              ))}
```

- [ ] **Step 2: Filter bar in UsersTab root** — add state + derived lists:

```tsx
  const [roleFilter,    setRoleFilter]    = useState<string>('all')
  const [subroleFilter, setSubroleFilter] = useState<string>('all')
  const shown = filterUsers(users, roleFilter, subroleFilter)
  const subroleOptions = roleFilter === 'all'
    ? [...new Set(users.map(u => u.subrole?.trim()).filter(Boolean))].sort() as string[]
    : subroleSuggestions(users, roleFilter)
```

Render between the provision form and the list (role chips reuse the toggle-button styling; reset subrole when it vanishes from options):

```tsx
      <div className="flex flex-wrap items-center gap-1.5">
        {(['all', ...ROLES] as string[]).map(r => (
          <button key={r}
            onClick={() => { setRoleFilter(r); setSubroleFilter('all') }}
            className={cn('text-xs rounded-full border px-2.5 py-1 transition-colors',
              roleFilter === r
                ? 'border-terracotta text-terracotta bg-terracotta/5 font-medium'
                : 'border-line text-muted hover:text-ink2')}>
            {r === 'all' ? 'All' : r.charAt(0).toUpperCase() + r.slice(1)}
          </button>
        ))}
        <select
          className="ml-auto border border-line rounded-lg px-2 py-1 text-xs text-ink bg-bg focus:outline-none"
          value={subroleFilter}
          onChange={e => setSubroleFilter(e.target.value)}>
          <option value="all">All subroles</option>
          <option value="none">No subrole</option>
          {subroleOptions.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
```

List renders `shown` instead of `users`; count label: `` {shown.length} of {users.length} user{users.length !== 1 ? 's' : ''} `` (plain `{users.length} users` when no filter active). Empty-after-filter state: `<p className="text-sm text-muted py-6 text-center">No users match this filter.</p>`.

- [ ] **Step 3: Thread `allUsers`** — `<ProvisionForm onDone={...} allUsers={users} />` and `<UserRow key={u.id} user={u} allUsers={users} onSaved={load} />`; wire the Task 3 datalists to this prop.

- [ ] **Step 4: Verify** — `npm run type-check`; then `npm run dev` briefly: admin → Users renders, filters narrow the list, tags show. (Real data check happens in Task 8's preview pass.)

- [ ] **Step 5: Commit**

```bash
git add src/features/admin/UsersTab.tsx
git commit -m "feat(provision): admin link-status tags + role/subrole filter bar (incl. No subrole)"
```

---

### Task 5: Grid queries, i18n keys, clash payload

**Files:**
- Modify: `src/lib/supabase/queries/jobs.ts:105-112` (`InstallerUser`), `:279-289` (`getInstallerUsers`)
- Modify: `src/lib/supabase/queries/designers.ts:72-83` (`getDesignerUsers`)
- Modify: `src/app/jobs/new/page.tsx:36-48` (inline installer select + designer mapping)
- Modify: `src/app/jobs/[id]/page.tsx:70` (designer mapping)
- Modify: `src/app/api/jobs/[id]/clashes/route.ts:204-219` (substitute payload)
- Modify: `src/lib/i18n/en.ts` + `src/lib/i18n/zh.ts` (new keys near the fcfs block, en.ts ~line 370)

**Interfaces:**
- Consumes: `linkStatus` (Task 1), 0051 columns (Task 2).
- Produces:
  - `InstallerUser = { id: string; name: string; phone: string | null; role: string; subrole: string | null; is_driver: boolean; qualifications: string[]; link_status: LinkStatus }` (years/skills GONE from this type).
  - `getDesignerUsers(): Promise<Array<{ id: string; name: string; subrole: string | null; qualifications: string[]; link_status: LinkStatus }>>`
  - `DesignerOption` (Task 6) is fed `{ id, label, subrole, qualifications, linkStatus }` by both pages.
  - `Substitute` gains `subrole: string | null; isDriver: boolean; qualifications: string[]` and loses `yearsExperience`/`skills` (update the `Substitute` type where it is declared — find with `grep -rn "yearsExperience" src/` and change every hit; the modal display swap itself is Task 7).
  - i18n keys (en / zh): `metaDriver: 'Driver' / '司机'`, `metaLinked: 'Linked' / '已绑定'`, `metaUnlinked: 'Unlinked' / '未绑定'`.

- [ ] **Step 1: `InstallerUser` + `getInstallerUsers`** — new type as above; query becomes:

```ts
export async function getInstallerUsers(): Promise<InstallerUser[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('users')
    .select('id, name, phone, role, subrole, is_driver, qualifications, email, auth_id')
    .eq('role', 'installer')
    .is('deleted_at', null)
    .order('name')
  if (error) throw error
  type Raw = { id: string; name: string; phone: string | null; role: string; subrole: string | null; is_driver: boolean; qualifications: string[]; email: string | null; auth_id: string | null }
  return ((data ?? []) as unknown as Raw[]).map(({ email, auth_id, ...u }) => ({
    ...u,
    link_status: linkStatus({ email, auth_id }),
  }))
}
```

(import `linkStatus`, `type LinkStatus` from `@/lib/utils/user-meta`; email/auth_id are consumed server-side, never returned.)

- [ ] **Step 2: `jobs/new/page.tsx` inline select** — replace the raw `supabase.from('users').select('id, name, phone, role, years_experience, skills')…` block (lines 36-41) with a call to `getInstallerUsers()` (import from `@/lib/supabase/queries/jobs`) — it now exists server-side with identical filters, deleting the duplication. `allInstallers = await`-ed result directly.

- [ ] **Step 3: `getDesignerUsers`** — select `id, name, subrole, qualifications, email, auth_id`, map to the produced shape via `linkStatus` (same strip pattern as Step 1). Update its local `UserRow` type accordingly.

- [ ] **Step 4: Designer option mappings** — both pages:

```ts
  const designerOptions = designerUsers.map(u => ({
    id: u.id, label: u.name,
    subrole: u.subrole, qualifications: u.qualifications, linkStatus: u.link_status,
  }))
```

- [ ] **Step 5: Clash route substitutes** — select `id, name, role, subrole, is_driver, qualifications`; map to `{ id, name, role, subrole, isDriver: u.is_driver, qualifications: u.qualifications ?? [], hasConflict }`; update the `Substitute` type declaration and the route's local `UserRow` type.

- [ ] **Step 6: i18n** — add the three keys to `en.ts` and `zh.ts` beside the fcfs block. Run `npm run type-check`.

- [ ] **Step 7: Verify + commit**

```bash
npm run type-check
git add src/lib/supabase/queries/jobs.ts src/lib/supabase/queries/designers.ts src/app/jobs/new/page.tsx "src/app/jobs/[id]/page.tsx" "src/app/api/jobs/[id]/clashes/route.ts" src/lib/i18n/en.ts src/lib/i18n/zh.ts
git commit -m "feat(provision): grids + clash payload carry subrole/driver/qualifications/link_status; en+zh keys"
```

NOTE: type-check will FAIL at this point in `InstallerGrid.tsx` (still reads `years_experience`/`skills`) and possibly `ClashResolutionModal.tsx` — that is EXPECTED mid-flight; Tasks 6-7 fix the consumers. If the executor wants green commits, fold Tasks 5+6+7 verification into one type-check at Task 7 Step 4 and commit per-task anyway (repo allows WIP commits on a feature branch).

---

### Task 6: `UserMetaLine` + grid cards (InstallerGrid, DesignerGrid)

**Files:**
- Create: `src/components/UserMetaLine.tsx`
- Modify: `src/features/job-detail/InstallerGrid.tsx:62-66, 103-113` (+ new `lang` prop)
- Modify: `src/features/job-detail/DesignerGrid.tsx:19-29, 88-92` (+ new `lang` prop)
- Modify: every `<InstallerGrid`/`<DesignerGrid` call site to pass `lang` — `src/features/job-detail/NewJobShell.tsx:402-410`, `src/features/job-detail/JobDetailShell.tsx:1249-1260, 1273-1282`, `src/features/job-detail/SubInstallerBucket.tsx:78-85` (thread `lang` into SubInstallerBucket's props if absent), `src/features/job-detail/DesignBriefSection.tsx:260-264`

**Interfaces:**
- Consumes: `InstallerUser`/`DesignerOption` shapes from Task 5, `buildUserMeta` from Task 1, i18n keys from Task 5.
- Produces:

```tsx
// src/components/UserMetaLine.tsx
export function UserMetaLine({ user, lang, mutedClass }: {
  user: { role?: string | null; subrole?: string | null; is_driver?: boolean | null;
          qualifications?: string[] | null; linkStatus?: LinkStatus }
  lang: LangCode
  /** text color class for the subrole line — grids tint by card state */
  mutedClass?: string
}): JSX.Element | null
```

- [ ] **Step 1: Implement `UserMetaLine`** — a client-safe presentational component:

```tsx
'use client'

import { cn } from '@/lib/utils/cn'
import { t } from '@/lib/i18n'
import { buildUserMeta, type LinkStatus } from '@/lib/utils/user-meta'
import type { LangCode } from '@/lib/i18n'

export function UserMetaLine({ user, lang, mutedClass = 'text-muted' }: {
  user: { role?: string | null; subrole?: string | null; is_driver?: boolean | null;
          qualifications?: string[] | null; linkStatus?: LinkStatus }
  lang: LangCode
  mutedClass?: string
}) {
  const meta = buildUserMeta(user)
  const st   = user.linkStatus
  const hasAnything = meta.subroleLine || meta.isDriver || meta.qualifications.length > 0 || st
  if (!hasAnything) return null
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 flex-wrap">
        {meta.subroleLine && (
          <span className={cn('text-[11px] truncate', mutedClass)}>{meta.subroleLine}</span>
        )}
        {meta.isDriver && (
          <span className="text-[10px] font-medium bg-brand-blue/10 text-brand-blue border border-brand-blue/20 rounded-full px-1.5 py-px shrink-0">
            {t(lang, 'metaDriver')}
          </span>
        )}
        {st && (st === 'linked' ? (
          <span className="text-[10px] font-medium bg-brand-green/10 text-brand-green border border-brand-green/20 rounded-full px-1.5 py-px shrink-0">
            {t(lang, 'metaLinked')}
          </span>
        ) : st === 'pending' ? (
          <span className="text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-1.5 py-px shrink-0">
            {t(lang, 'metaUnlinked')}
          </span>
        ) : (
          <span className="text-[10px] font-medium bg-red-50 text-red-700 border border-red-200 rounded-full px-1.5 py-px shrink-0">
            {t(lang, 'metaUnlinked')}
          </span>
        ))}
      </div>
      {meta.qualifications.length > 0 && (
        <p className={cn('text-[10px] truncate', mutedClass)}>{meta.qualifications.join(' · ')}</p>
      )}
    </div>
  )
}
```

(Check `t`'s actual import path/signature against another client component, e.g. `AssignmentPanel.tsx`, and mirror it exactly.)

- [ ] **Step 2: InstallerGrid** — add `lang: LangCode` to `Props`; delete the `meta` computation (lines 62-66); replace the meta `<p>` (lines 107-109) with:

```tsx
                  <UserMetaLine
                    user={{ role: inst.role, subrole: inst.subrole, is_driver: inst.is_driver,
                            qualifications: inst.qualifications, linkStatus: inst.link_status }}
                    lang={lang}
                    mutedClass={metaColor}
                  />
```

(`metaColor` at lines 72-75 stays as-is and feeds `mutedClass`.)

- [ ] **Step 3: DesignerGrid** — extend the option type:

```ts
export interface DesignerOption {
  id:              string
  label:           string
  subrole?:        string | null
  qualifications?: string[]
  linkStatus?:     LinkStatus
}
```

add `lang: LangCode` to `Props`; under the name `<p>` (line 89-91) add:

```tsx
                  <UserMetaLine
                    user={{ subrole: d.subrole, qualifications: d.qualifications, linkStatus: d.linkStatus }}
                    lang={lang}
                    mutedClass={selected ? 'text-brand-green/70' : 'text-muted'}
                  />
```

(no `role` fallback — a designer card with no subrole shows no meta line, matching today's clean look.)

- [ ] **Step 4: Thread `lang` through every call site** listed in Files (all hosts already hold `lang`; add a `lang` prop to `SubInstallerBucket` and `DesignBriefSection` only if they don't already receive it — check first).

- [ ] **Step 5: Verify** — `npm run type-check` (must be fully green now unless ClashResolutionModal still references old fields — that's Task 7); visual check via `npm run dev` on `/jobs/new`.

- [ ] **Step 6: Commit**

```bash
git add src/components/UserMetaLine.tsx src/features/job-detail/InstallerGrid.tsx src/features/job-detail/DesignerGrid.tsx src/features/job-detail/NewJobShell.tsx src/features/job-detail/JobDetailShell.tsx src/features/job-detail/SubInstallerBucket.tsx src/features/job-detail/DesignBriefSection.tsx
git commit -m "feat(provision): UserMetaLine on installer + designer cards — subrole, Driver, qualifications, link tag"
```

---

### Task 7: FCFS panel + clash modal meta swap

**Files:**
- Modify: `src/features/fcfs/AssignmentPanel.tsx:271-278, 311-318, 376-383` (the three row flavours; roster is already `InstallerUser[]`)
- Modify: `src/features/approvals/ClashResolutionModal.tsx:233-237, 263` (meta line)

**Interfaces:**
- Consumes: Task 5's `InstallerUser`/`Substitute` shapes, Task 1's `buildUserMeta`. NO link tags here (Nic scoped tags to admin + job-form grids only).

- [ ] **Step 1: AssignmentPanel** — the formal/suggestion rows only receive `{ user_id, name, … }` assignee records; the roster (`installers: InstallerUser[]`) holds the meta. Add a lookup + line under each name `<p>` in all three flavours (formal, suggestion, newly-added — the newly-added flavour already looks up `rosterOf(id)`):

```tsx
// once, near rosterOf:
const metaTextOf = (id: string) => {
  const u = installers.find(x => x.id === id)
  if (!u) return null
  const m = buildUserMeta(u)
  const parts = [m.subroleLine, m.isDriver ? t(lang, 'metaDriver') : null, ...m.qualifications]
  return parts.filter(Boolean).join(' · ') || null
}
```

and under each name:

```tsx
                    {metaTextOf(a.user_id) && (
                      <p className="text-[10px] text-muted truncate">{metaTextOf(a.user_id)}</p>
                    )}
```

(use `id` instead of `a.user_id` in the newly-added flavour; check the exact roster prop name — the code map says the panel receives an `InstallerUser[]` roster and `rosterOf(id)` exists at ~line 92/368.)

- [ ] **Step 2: ClashResolutionModal** — replace the meta computation (lines 233-237):

```tsx
                      const m = buildUserMeta({ role: sub.role, subrole: sub.subrole,
                        is_driver: sub.isDriver, qualifications: sub.qualifications })
                      const meta = [
                        m.subroleLine ? m.subroleLine.charAt(0).toUpperCase() + m.subroleLine.slice(1) : null,
                        m.isDriver ? 'Driver' : null,
                        ...m.qualifications,
                      ].filter(Boolean).join(' · ')
```

(the modal is English-hardcoded today — "Replace with:", "Free", "Conflict" — so plain `'Driver'` matches its precedent; keep the `{meta}` render line as-is, it tolerates `''`.)

- [ ] **Step 3: Verify** — `npm run type-check` fully green; grep guard:

```bash
grep -rn "years_experience\|yearsExperience" src/ --include=*.tsx --include=*.ts
```

Expected remaining hits ONLY in: `types.ts` (Row), `queries/admin.ts` (AdminUser — kept for the future column drop). Anything else is a missed consumer — fix it.

- [ ] **Step 4: Commit**

```bash
git add src/features/fcfs/AssignmentPanel.tsx src/features/approvals/ClashResolutionModal.tsx
git commit -m "feat(provision): FCFS + clash substitute rows show subrole/Driver/qualifications (years/skills gone)"
```

---

### Task 8: Full verification + docs + handoff

**Files:**
- Modify: `docs/nic-checklist.md` (pending item: drop years/skills columns; demo-day notes)
- No code.

- [ ] **Step 1: Run everything**

```bash
npm run type-check
npx tsx src/lib/utils/user-meta.test.ts
# then every existing suite (17 files) — all must stay green:
npx tsx scripts/lib/chunk.test.ts && npx tsx scripts/lib/frontmatter.test.ts
# … (loop over git ls-files "*.test.ts")
npm run build
```

Expected: 18 suites green, build clean.

- [ ] **Step 2: Checklist entry** — add to `docs/nic-checklist.md` "Pending — Next Session": `- [ ] **Drop users.years_experience + users.skills columns** — hidden from all screens 2026-09-03 (Nic: redundant); needs a small migration + type cleanup in a quiet session.`

- [ ] **Step 3: STOP — human gate before any push.** Report to Nic:
  1. Nic (or Claude at his request) runs `npx supabase db push` → migration 0051 applied to the shared DB.
  2. Only THEN `git push -u origin feat-provision-organisation` → merge to `dev` → Nic smoke-tests the Vercel preview (provision card-only users per role, subrole tags, Driver, qualifications, rename, filters, link tags on both grids).
  3. On Nic's pass → merge `dev` → `main` tonight.

- [ ] **Step 4: Commit docs**

```bash
git add docs/nic-checklist.md
git commit -m "docs: years/skills column-drop reminder + provisioning demo notes"
```
