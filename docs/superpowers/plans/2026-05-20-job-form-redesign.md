# Job Form Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the new job form with a 2-column installer toggle grid, named attachment buckets, Company/POC searchable dropdowns, an "Improve" AI panel, a 3-button action bar, and add installer profile fields in the admin users tab.

**Architecture:** New components (`SearchableSelect`, `InstallerGrid`, `AttachmentBuckets`, `ImageLightbox`) are added to `src/components/` and `src/features/job-detail/`. `NewJobShell` is rebuilt to use these. `CoreSection` gains the new Company/POC fields. `SuggestField` is restyled. Two DB migrations add `attachment_buckets` + `url_text` on `files`, and `clients` + `client_contacts` tables. Six new API routes handle client CRUD.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, react-hook-form, Supabase client + server, Cloudflare R2 (existing upload helper), Lucide icons.

---

## File Map

**New files:**
- `supabase/migrations/0025_attachment_buckets.sql`
- `supabase/migrations/0026_client_tables.sql`
- `src/components/SearchableSelect.tsx`
- `src/components/ImageLightbox.tsx`
- `src/features/job-detail/InstallerGrid.tsx`
- `src/features/job-detail/AttachmentBuckets.tsx`
- `src/app/api/clients/route.ts`
- `src/app/api/clients/[id]/route.ts`
- `src/app/api/clients/[id]/contacts/route.ts`
- `src/app/api/clients/contacts/[id]/route.ts`

**Modified files:**
- `supabase/migrations/` — two new files (see above)
- `src/lib/supabase/types.ts` — add `attachment_buckets`, `clients`, `client_contacts` tables
- `src/lib/supabase/queries/jobs.ts` — extend `InstallerUser` type + query; add bucket query helpers
- `src/lib/supabase/queries/admin.ts` — extend `AdminUser` type + `updateUser` to accept `years_experience`/`skills`
- `src/components/SuggestField.tsx` — rename button to "Improve", redesign panel UI
- `src/features/job-detail/CoreSection.tsx` — replace Client plain input with `SearchableSelect`; add Day display; add Sales/POC dropdown
- `src/features/job-detail/NewJobShell.tsx` — full rebuild: new layout, `InstallerGrid`, `AttachmentBuckets` placeholder, 3-button action bar
- `src/features/admin/UsersTab.tsx` — add `years_experience` + `skills` chip inputs for installer users

---

## Task 1: DB Migration — Attachment Buckets (0025)

**Files:**
- Create: `supabase/migrations/0025_attachment_buckets.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/0025_attachment_buckets.sql

create table public.attachment_buckets (
  id         uuid primary key default gen_random_uuid(),
  job_id     uuid not null references public.jobs(id) on delete cascade,
  name       text not null,
  position   integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.attachment_buckets enable row level security;

create policy "authenticated read attachment_buckets"
  on public.attachment_buckets for select
  to authenticated using (true);

create policy "authenticated insert attachment_buckets"
  on public.attachment_buckets for insert
  to authenticated with check (true);

create policy "authenticated update attachment_buckets"
  on public.attachment_buckets for update
  to authenticated using (true);

create policy "authenticated delete attachment_buckets"
  on public.attachment_buckets for delete
  to authenticated using (true);

alter table public.files
  add column if not exists bucket_id uuid references public.attachment_buckets(id) on delete set null;

alter table public.files
  add column if not exists url_text text;
```

- [ ] **Step 2: Apply the migration**

```bash
npx supabase db push
```

Expected: migration applies without error. Run `npx supabase db push --dry-run` first if unsure.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0025_attachment_buckets.sql
git commit -m "feat(db): add attachment_buckets table and bucket_id/url_text to files"
```

---

## Task 2: DB Migration — Client Tables (0026)

**Files:**
- Create: `supabase/migrations/0026_client_tables.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/0026_client_tables.sql

create table public.clients (
  id   uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table public.client_contacts (
  id        uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name      text not null
);

-- Seed company names from existing job data
insert into public.clients (name)
select distinct client from public.jobs
where client is not null and client <> ''
on conflict (name) do nothing;

alter table public.clients enable row level security;
alter table public.client_contacts enable row level security;

create policy "authenticated read clients"
  on public.clients for select to authenticated using (true);
create policy "authenticated insert clients"
  on public.clients for insert to authenticated with check (true);
create policy "authenticated delete clients"
  on public.clients for delete to authenticated using (true);

create policy "authenticated read client_contacts"
  on public.client_contacts for select to authenticated using (true);
create policy "authenticated insert client_contacts"
  on public.client_contacts for insert to authenticated with check (true);
create policy "authenticated delete client_contacts"
  on public.client_contacts for delete to authenticated using (true);
```

- [ ] **Step 2: Apply the migration**

```bash
npx supabase db push
```

Expected: two new tables created, existing company names seeded into `clients`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0026_client_tables.sql
git commit -m "feat(db): add clients and client_contacts tables"
```

---

## Task 3: Update TypeScript Types

**Files:**
- Modify: `src/lib/supabase/types.ts`
- Modify: `src/lib/supabase/queries/jobs.ts`
- Modify: `src/lib/supabase/queries/admin.ts`

- [ ] **Step 1: Add new tables to `types.ts`**

Inside the `Tables` object in `src/lib/supabase/types.ts`, add after the `files` table definition:

```typescript
      attachment_buckets: {
        Row: {
          id:         string
          job_id:     string
          name:       string
          position:   number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['attachment_buckets']['Row'], 'id' | 'created_at'> & {
          id?: string; created_at?: string
        }
        Update: Partial<Database['public']['Tables']['attachment_buckets']['Insert']>
        Relationships: []
      }

      clients: {
        Row:    { id: string; name: string }
        Insert: { id?: string; name: string }
        Update: Partial<{ id: string; name: string }>
        Relationships: []
      }

      client_contacts: {
        Row:    { id: string; client_id: string; name: string }
        Insert: { id?: string; client_id: string; name: string }
        Update: Partial<{ id: string; client_id: string; name: string }>
        Relationships: []
      }
```

Also add `bucket_id` and `url_text` to the `files` table `Row` type:

```typescript
// In the files Row, add:
          bucket_id:   string | null   // after ts
          url_text:    string | null
```

- [ ] **Step 2: Extend `InstallerUser` type and query in `queries/jobs.ts`**

Replace the existing `InstallerUser` type (lines 67–71) and `getInstallerUsers` function (lines 199–208):

```typescript
export type InstallerUser = {
  id:               string
  name:             string
  phone:            string | null
  role:             string
  years_experience: number | null
  skills:           string[]
}

// ...further down, replace getInstallerUsers:

export async function getInstallerUsers(): Promise<InstallerUser[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('users')
    .select('id, name, phone, role, years_experience, skills')
    .eq('role', 'installer')
    .order('name')
  if (error) throw error
  return (data ?? []) as InstallerUser[]
}
```

Also add bucket query helpers at the bottom of `queries/jobs.ts`:

```typescript
// ── Attachment Buckets ────────────────────────────────────────────────────────

export type AttachmentBucket = {
  id:         string
  job_id:     string
  name:       string
  position:   number
  created_at: string
  files:      BucketFile[]
}

export type BucketFile = {
  id:          string
  job_id:      string | null
  bucket_id:   string | null
  kind:        FileKind
  r2_key:      string
  url_text:    string | null
  uploader_id: string | null
  ts:          string
}

export async function getJobBuckets(jobId: string): Promise<AttachmentBucket[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('attachment_buckets')
    .select('id, job_id, name, position, created_at, files(id, job_id, bucket_id, kind, r2_key, url_text, uploader_id, ts)')
    .eq('job_id', jobId)
    .order('position')
  if (error) throw error
  return (data ?? []) as unknown as AttachmentBucket[]
}

export async function createDefaultBuckets(jobId: string): Promise<void> {
  const supabase = createClient()
  const buckets = [
    { job_id: jobId, name: 'PERMIT-TO-WORK', position: 0 },
    { job_id: jobId, name: 'BCA',            position: 1 },
    { job_id: jobId, name: 'DESIGNER JO',    position: 2 },
    { job_id: jobId, name: 'OTHERS',         position: 3 },
  ]
  const { error } = await supabase.from('attachment_buckets').insert(buckets as never)
  if (error) throw error
}
```

Note: `getJobBuckets` uses the Supabase **browser client** (`createClient` from `@/lib/supabase/client`) since `AttachmentBuckets.tsx` is a client component that fetches its own data.

- [ ] **Step 3: Extend `AdminUser` + `updateUser` in `queries/admin.ts`**

Add `years_experience` and `skills` to the `AdminUser` type:

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
  years_experience:  number | null   // new
  skills:            string[]        // new
  created_at:        string
}
```

Update the `getAllUsers` select string to include the new columns:

```typescript
    .select('id, auth_id, email, name, role, telegram_chat_id, lang, phone, digest_subscriber, years_experience, skills, created_at')
```

Update the `updateUser` patch type to allow the new fields:

```typescript
export async function updateUser(
  id:    string,
  patch: Partial<Pick<AdminUser, 'role' | 'telegram_chat_id' | 'digest_subscriber' | 'lang' | 'phone' | 'years_experience' | 'skills'>>,
): Promise<void> {
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/types.ts src/lib/supabase/queries/jobs.ts src/lib/supabase/queries/admin.ts
git commit -m "feat(types): extend InstallerUser, AdminUser; add bucket/client types and queries"
```

---

## Task 4: Client API Routes

**Files:**
- Create: `src/app/api/clients/route.ts`
- Create: `src/app/api/clients/[id]/route.ts`
- Create: `src/app/api/clients/[id]/contacts/route.ts`
- Create: `src/app/api/clients/contacts/[id]/route.ts`

- [ ] **Step 1: Create `src/app/api/clients/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('clients')
    .select('id, name')
    .order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name } = await req.json() as { name: string }
  if (!name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const { data, error } = await supabase
    .from('clients')
    .insert({ name: name.trim() } as never)
    .select('id, name')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
```

- [ ] **Step 2: Create `src/app/api/clients/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase.from('clients').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Create `src/app/api/clients/[id]/contacts/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: clientId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('client_contacts')
    .select('id, name')
    .eq('client_id', clientId)
    .order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: clientId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name } = await req.json() as { name: string }
  if (!name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const { data, error } = await supabase
    .from('client_contacts')
    .insert({ client_id: clientId, name: name.trim() } as never)
    .select('id, name')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
```

- [ ] **Step 4: Create `src/app/api/clients/contacts/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase.from('client_contacts').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/app/api/clients/
git commit -m "feat(api): client and client_contacts CRUD routes"
```

---

## Task 5: `SuggestField` — "Improve" Redesign

**Files:**
- Modify: `src/components/SuggestField.tsx`

- [ ] **Step 1: Replace the file contents**

```typescript
'use client'

import { useState, ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

interface Props {
  value:    string
  onAccept: (suggestion: string) => void
  readOnly?: boolean
  field?:   string
  children: ReactNode
}

export function SuggestField({ value, onAccept, readOnly = false, field, children }: Props) {
  const [loading,    setLoading]    = useState(false)
  const [suggestion, setSuggestion] = useState<string | null>(null)

  const handleImprove = async () => {
    if (!value.trim() || loading) return
    setLoading(true)
    setSuggestion(null)
    try {
      const res  = await fetch('/api/ai/suggest', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ field, value }),
      })
      const data = await res.json() as { suggestion?: string }
      if (data.suggestion) setSuggestion(data.suggestion)
    } finally {
      setLoading(false)
    }
  }

  const showButton = !readOnly && value.trim().length > 0 && !loading && !suggestion

  return (
    <div>
      {(showButton || loading) && (
        <div className="flex justify-end mb-1">
          {showButton && (
            <button
              type="button"
              onClick={handleImprove}
              className="text-xs font-medium text-muted border border-line bg-paper hover:text-terracotta hover:border-terracotta hover:bg-terracotta/5 px-2.5 py-1 rounded-md transition-colors flex items-center gap-1"
            >
              ✦ Improve
            </button>
          )}
          {loading && (
            <span className="text-xs text-muted">Improving…</span>
          )}
        </div>
      )}
      {children}
      {suggestion && (
        <div className="mt-2 rounded-xl border-2 border-dashed border-terracotta bg-terracotta/[0.04] px-3.5 py-3">
          <p className="text-[10px] font-semibold tracking-widest uppercase text-terracotta mb-2.5">✦ Improve</p>
          <p className={cn('text-[10px] font-semibold tracking-wider uppercase text-muted mb-1')}>Your original</p>
          <p className="text-sm text-muted mb-2.5 leading-relaxed">{value}</p>
          <p className={cn('text-[10px] font-semibold tracking-wider uppercase text-muted mb-1')}>Suggested</p>
          <p className="text-sm text-ink mb-3 leading-relaxed">
            {suggestion}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSuggestion(null)}
              className="flex-1 py-2 rounded-lg border border-line bg-paper text-sm font-medium text-ink2"
            >
              Keep mine
            </button>
            <button
              type="button"
              onClick={() => { onAccept(suggestion); setSuggestion(null) }}
              className="flex-1 py-2 rounded-lg bg-terracotta text-sm font-medium text-white"
            >
              Use this
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/SuggestField.tsx
git commit -m "feat(ui): rename Suggest→Improve, redesign suggestion panel"
```

---

## Task 6: `SearchableSelect` Component

**Files:**
- Create: `src/components/SearchableSelect.tsx`

- [ ] **Step 1: Create the component**

```typescript
'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Search, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export type SelectOption = {
  id:    string
  label: string
}

interface Props {
  value:           string       // the selected label (stored as text on the job)
  onChange:        (label: string) => void
  options:         SelectOption[]
  placeholder?:    string
  disabled?:       boolean
  onAddNew?:       (name: string) => Promise<SelectOption>
  onDeleteOption?: (id: string, label: string) => Promise<void>    // X per item in list — permanent delete
  onClearOption?:  () => void                                      // X on trigger — clears selection only
  confirmDelete?:  (label: string) => Promise<boolean>             // optional confirm modal before delete
}

export function SearchableSelect({
  value, onChange, options, placeholder = 'Select…', disabled = false,
  onAddNew, onDeleteOption, onClearOption, confirmDelete,
}: Props) {
  const [open,    setOpen]    = useState(false)
  const [query,   setQuery]   = useState('')
  const [loading, setLoading] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setOpen(false); setQuery('') }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [])

  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(query.toLowerCase()),
  )

  async function handleAddNew() {
    if (!onAddNew || !query.trim()) return
    setLoading(true)
    try {
      const created = await onAddNew(query.trim())
      onChange(created.label)
      setOpen(false)
      setQuery('')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(e: React.MouseEvent, opt: SelectOption) {
    e.stopPropagation()
    if (!onDeleteOption) return
    if (confirmDelete) {
      const ok = await confirmDelete(opt.label)
      if (!ok) return
    }
    await onDeleteOption(opt.id, opt.label)
    if (value === opt.label) onClearOption?.()
  }

  const hasValue = value.trim().length > 0

  return (
    <div ref={wrapRef} className="relative">
      {/* Trigger */}
      <div
        onClick={() => { if (!disabled) { setOpen(o => !o); setQuery('') } }}
        className={cn(
          'flex items-center gap-2 w-full border rounded-lg px-3 py-2 text-sm min-h-[38px] transition-colors select-none',
          disabled
            ? 'opacity-45 cursor-not-allowed bg-bg border-line'
            : 'cursor-pointer bg-bg border-line hover:border-ink2',
          open && !disabled && 'border-terracotta bg-paper rounded-b-none',
          hasValue ? 'text-ink' : 'text-muted',
        )}
      >
        <span className="flex-1 truncate text-left">
          {hasValue ? value : placeholder}
        </span>
        {hasValue && onClearOption && !disabled && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onClearOption() }}
            className="w-4.5 h-4.5 rounded-full bg-line flex items-center justify-center hover:bg-terracotta hover:text-white transition-colors shrink-0"
            aria-label="Clear"
          >
            <X size={8} strokeWidth={2.5} />
          </button>
        )}
        <ChevronDown
          size={14}
          className={cn('text-muted shrink-0 transition-transform', open && 'rotate-180')}
        />
      </div>

      {/* Dropdown */}
      {open && !disabled && (
        <div className="absolute left-0 right-0 top-full z-50 bg-paper border border-terracotta border-t-0 rounded-b-lg shadow-lg max-h-56 flex flex-col">
          {/* Search bar */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-line shrink-0">
            <Search size={13} className="text-muted shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search…"
              className="flex-1 bg-transparent text-sm text-ink placeholder:text-muted outline-none"
              onKeyDown={e => { if (e.key === 'Enter' && filtered.length === 0) handleAddNew() }}
            />
          </div>

          {/* List */}
          <ul className="overflow-y-auto flex-1">
            {filtered.map(opt => (
              <li
                key={opt.id}
                onClick={() => { onChange(opt.label); setOpen(false); setQuery('') }}
                className="flex items-center gap-2 px-3 py-2.5 text-sm text-ink cursor-pointer hover:bg-bg group"
              >
                <span className="flex-1">{opt.label}</span>
                {onDeleteOption && (
                  <button
                    type="button"
                    onClick={e => handleDelete(e, opt)}
                    className="w-4 h-4 rounded-full flex items-center justify-center text-muted opacity-0 group-hover:opacity-100 hover:bg-terracotta/10 hover:text-terracotta transition-all"
                    aria-label={`Remove ${opt.label}`}
                  >
                    <X size={8} strokeWidth={2.5} />
                  </button>
                )}
              </li>
            ))}

            {/* Add new */}
            {onAddNew && query.trim().length > 0 && filtered.length === 0 && (
              <li
                onClick={handleAddNew}
                className="flex items-center gap-2 px-3 py-2.5 text-sm text-terracotta font-medium cursor-pointer hover:bg-terracotta/5 border-t border-line"
              >
                <Plus size={13} />
                {loading ? 'Adding…' : `Add "${query.trim()}"`}
              </li>
            )}
            {onAddNew && (
              <li
                onClick={handleAddNew}
                className={cn(
                  'flex items-center gap-2 px-3 py-2.5 text-sm text-terracotta font-medium cursor-pointer hover:bg-terracotta/5 border-t border-line',
                  query.trim().length > 0 && filtered.length === 0 && 'hidden',
                )}
              >
                <Plus size={13} />
                {loading ? 'Adding…' : 'Add new…'}
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/SearchableSelect.tsx
git commit -m "feat(ui): add SearchableSelect component"
```

---

## Task 7: Update `CoreSection` — Company, POC, Day, Sales/POC

**Files:**
- Modify: `src/features/job-detail/CoreSection.tsx`

The `CoreSection` is used by both `NewJobShell` (new job) and `JobDetailShell` (edit page). The Company + POC dropdowns only need to behave differently on the new form — but `CoreSection` is shared. The strategy: pass `salesPocOptions` and client options as props; when they are undefined, fall back to plain text inputs (existing edit-page behaviour is unchanged).

- [ ] **Step 1: Replace `CoreSection.tsx` with the updated version**

```typescript
'use client'

import { useState, useEffect } from 'react'
import { UseFormRegister, FieldErrors, Control, Controller, UseFormWatch, UseFormSetValue } from 'react-hook-form'
import { Card } from '@/components/Card'
import { Field } from '@/components/Field'
import { Input } from '@/components/Input'
import { SuggestField } from '@/components/SuggestField'
import { SearchableSelect, SelectOption } from '@/components/SearchableSelect'
import { TimeSelect } from './TimeSelect'
import { Modal } from '@/components/Modal'
import { Btn } from '@/components/Btn'
import { t } from '@/lib/i18n'
import { cn } from '@/lib/utils/cn'
import type { LangCode } from '@/lib/i18n'
import type { FormValues } from './JobDetailShell'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface Props {
  register:          UseFormRegister<FormValues>
  errors:            FieldErrors<FormValues>
  control:           Control<FormValues>
  watch:             UseFormWatch<FormValues>
  setValue:          UseFormSetValue<FormValues>
  readOnly:          boolean
  lang:              LangCode
  validateRequired?: boolean
  // When provided, enables the searchable-select dropdowns for new-job form
  salesPocOptions?:  SelectOption[]
  salesPocUserId?:   string    // current user id — used as default value label lookup
}

const TEXTAREA = 'w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:border-terracotta focus:ring-terracotta/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 resize-none'

export function CoreSection({
  register, errors, control, watch, setValue,
  readOnly, lang, validateRequired = false,
  salesPocOptions, salesPocUserId,
}: Props) {
  const req = validateRequired ? { required: 'Required' } : {}

  // Company + POC state (only active when salesPocOptions is passed — i.e. new job form)
  const [companies,        setCompanies]        = useState<SelectOption[]>([])
  const [contacts,         setContacts]         = useState<SelectOption[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [deleteTarget,     setDeleteTarget]     = useState<SelectOption | null>(null)
  const [deleteLoading,    setDeleteLoading]    = useState(false)
  const useDropdowns = !!salesPocOptions

  // Derive day-of-week from date field
  const dateValue = watch('date')
  const dayLabel  = dateValue
    ? DAYS[new Date(dateValue + 'T00:00:00').getDay()]
    : '—'

  // Load companies on mount (only on new job form)
  useEffect(() => {
    if (!useDropdowns) return
    fetch('/api/clients')
      .then(r => r.json())
      .then((data: { id: string; name: string }[]) =>
        setCompanies(data.map(c => ({ id: c.id, label: c.name }))),
      )
      .catch(() => {})
  }, [useDropdowns])

  // Load contacts when company changes
  useEffect(() => {
    if (!selectedClientId) { setContacts([]); return }
    fetch(`/api/clients/${selectedClientId}/contacts`)
      .then(r => r.json())
      .then((data: { id: string; name: string }[]) =>
        setContacts(data.map(c => ({ id: c.id, label: c.name }))),
      )
      .catch(() => {})
  }, [selectedClientId])

  async function handleAddCompany(name: string): Promise<SelectOption> {
    const res  = await fetch('/api/clients', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    const data = await res.json() as { id: string; name: string }
    const opt  = { id: data.id, label: data.name }
    setCompanies(prev => [...prev, opt].sort((a, b) => a.label.localeCompare(b.label)))
    return opt
  }

  async function handleDeleteCompany(id: string): Promise<void> {
    await fetch(`/api/clients/${id}`, { method: 'DELETE' })
    setCompanies(prev => prev.filter(c => c.id !== id))
  }

  function clearCompany() {
    setSelectedClientId(null)
    setValue('client', '', { shouldDirty: true })
    setValue('client_poc_name', '', { shouldDirty: true })
    setValue('client_poc_phone', '', { shouldDirty: true })
    setContacts([])
  }

  async function handleAddContact(name: string): Promise<SelectOption> {
    if (!selectedClientId) throw new Error('No company selected')
    const res  = await fetch(`/api/clients/${selectedClientId}/contacts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    const data = await res.json() as { id: string; name: string }
    const opt  = { id: data.id, label: data.name }
    setContacts(prev => [...prev, opt].sort((a, b) => a.label.localeCompare(b.label)))
    return opt
  }

  async function handleDeleteContact(id: string, label: string): Promise<void> {
    await fetch(`/api/clients/contacts/${id}`, { method: 'DELETE' })
    setContacts(prev => prev.filter(c => c.id !== id))
    if (watch('client_poc_name') === label) setValue('client_poc_name', '', { shouldDirty: true })
  }

  async function confirmDeleteCompany(label: string): Promise<boolean> {
    return new Promise(resolve => {
      setDeleteTarget({ id: '', label })  // id not needed for display
      // resolve will be called when user clicks Yes/No in the modal
      // We store the resolve in a ref to call it from the modal buttons
      pendingResolve.current = resolve
    })
  }
  const pendingResolve = { current: null as ((v: boolean) => void) | null }

  return (
    <>
      {/* Delete company confirm modal */}
      {deleteTarget && (
        <Modal onClose={() => { setDeleteTarget(null); pendingResolve.current?.(false) }}>
          <div className="flex flex-col gap-4">
            <p className="font-display font-medium text-ink">Remove company?</p>
            <p className="text-sm text-ink2">
              This will remove <strong>{deleteTarget.label}</strong> and all associated client names as well. Are you sure?
            </p>
            <div className="flex gap-2 justify-end">
              <Btn variant="ghost" size="sm" disabled={deleteLoading}
                onClick={() => { setDeleteTarget(null); pendingResolve.current?.(false) }}>
                No
              </Btn>
              <Btn variant="accent" size="sm" disabled={deleteLoading}
                onClick={async () => {
                  setDeleteLoading(true)
                  pendingResolve.current?.(true)
                  setDeleteTarget(null)
                  setDeleteLoading(false)
                }}>
                Yes
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      <Card className="p-5 space-y-4">

        {/* Project Title */}
        <Field label={t(lang, 'projectTitle')} error={errors.project_title?.message}>
          <SuggestField
            value={watch('project_title')}
            onAccept={s => setValue('project_title', s, { shouldDirty: true })}
            readOnly={readOnly}
            field="Project Title"
          >
            <Input
              {...register('project_title', req)}
              placeholder="e.g. Vivienne Westwood Installation"
              disabled={readOnly}
              error={!!errors.project_title}
            />
          </SuggestField>
        </Field>

        {/* Date + Day */}
        <div className="grid grid-cols-2 gap-4">
          <Field label={t(lang, 'date')} error={errors.date?.message}>
            <Input
              type="date"
              {...register('date', { required: true })}
              error={!!errors.date}
              disabled={readOnly}
            />
          </Field>
          <Field label="Day">
            <div className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm font-semibold text-amber-600 text-center">
              {dayLabel}
            </div>
          </Field>
        </div>

        {/* Company (dropdown on new form, plain input on edit) */}
        <Field label="Company" error={errors.client?.message}>
          {useDropdowns ? (
            <SearchableSelect
              value={watch('client')}
              onChange={label => {
                const found = companies.find(c => c.label === label)
                setSelectedClientId(found?.id ?? null)
                setValue('client', label, { shouldDirty: true })
                setValue('client_poc_name', '', { shouldDirty: true })
              }}
              options={companies}
              placeholder="Pick company…"
              disabled={readOnly}
              onAddNew={handleAddCompany}
              onDeleteOption={handleDeleteCompany}
              onClearOption={clearCompany}
              confirmDelete={confirmDeleteCompany}
            />
          ) : (
            <Input
              {...register('client', { required: true })}
              error={!!errors.client}
              disabled={readOnly}
            />
          )}
        </Field>

        {/* Client POC Name */}
        <Field label={t(lang, 'clientPOCName')} error={errors.client_poc_name?.message}>
          {useDropdowns ? (
            <SearchableSelect
              value={watch('client_poc_name')}
              onChange={label => setValue('client_poc_name', label, { shouldDirty: true })}
              options={contacts}
              placeholder={selectedClientId ? 'Pick contact…' : 'Select a company first…'}
              disabled={readOnly || !selectedClientId}
              onAddNew={selectedClientId ? handleAddContact : undefined}
              onDeleteOption={handleDeleteContact}
              onClearOption={() => setValue('client_poc_name', '', { shouldDirty: true })}
            />
          ) : (
            <Input
              {...register('client_poc_name')}
              disabled={readOnly}
              error={!!errors.client_poc_name}
            />
          )}
        </Field>

        {/* Client Phone — always plain input */}
        <Field label={t(lang, 'clientPOCPhone')} error={errors.client_poc_phone?.message}>
          <Input
            type="tel"
            {...register('client_poc_phone')}
            disabled={readOnly || (useDropdowns && !selectedClientId && !watch('client_poc_phone'))}
            error={!!errors.client_poc_phone}
          />
        </Field>

        {/* Location */}
        <Field label={t(lang, 'locationAddress')} error={errors.location?.message}>
          <Input
            {...register('location', req)}
            disabled={readOnly}
            error={!!errors.location}
          />
        </Field>

        {/* Description */}
        <Field label={t(lang, 'jobDescription')}>
          <SuggestField
            value={watch('description')}
            onAccept={s => setValue('description', s, { shouldDirty: true })}
            readOnly={readOnly}
            field="Job Description"
          >
            <textarea
              {...register('description')}
              disabled={readOnly}
              rows={3}
              className={TEXTAREA}
            />
          </SuggestField>
        </Field>

        {/* Times */}
        <div className="grid grid-cols-2 gap-4">
          <Field label={t(lang, 'timeStart')} error={errors.time_start?.message}>
            <Controller
              control={control}
              name="time_start"
              rules={req}
              render={({ field }) => (
                <TimeSelect value={field.value} onChange={field.onChange} disabled={readOnly} error={!!errors.time_start} />
              )}
            />
          </Field>
          <Field label={t(lang, 'timeEnd')}>
            <Controller
              control={control}
              name="time_end"
              render={({ field }) => (
                <TimeSelect value={field.value} onChange={field.onChange} disabled={readOnly} />
              )}
            />
          </Field>
        </div>

        {/* Punctuality */}
        <Field label={t(lang, 'punctuality')}>
          <Controller
            control={control}
            name="punctuality"
            render={({ field }) => (
              <div className="flex gap-2">
                {([
                  { v: 'strict'   as const, label: t(lang, 'strictOnTime'),   activeBg: 'bg-terracotta-soft', activeBorder: 'border-terracotta', dot: 'bg-terracotta'  },
                  { v: 'flexible' as const, label: t(lang, 'flexibleWindow'), activeBg: 'bg-brand-blue-soft', activeBorder: 'border-brand-blue', dot: 'bg-brand-blue' },
                ]).map(opt => (
                  <button
                    key={opt.v}
                    type="button"
                    disabled={readOnly}
                    onClick={() => field.onChange(opt.v)}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm transition-colors',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                      field.value === opt.v
                        ? `${opt.activeBg} ${opt.activeBorder} text-ink`
                        : 'border-line bg-paper text-ink2 hover:bg-bg',
                    )}
                  >
                    <span className={cn('w-2.5 h-2.5 rounded-sm shrink-0', opt.dot)} />
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          />
        </Field>

        {/* Production ready + DO issued */}
        <div className="grid grid-cols-2 gap-2">
          {(['production_ready', 'do_issued'] as const).map((field, i) => (
            <label key={field} className={cn(
              'flex items-center gap-2.5 px-3 py-2.5 border border-line rounded-lg text-sm text-ink2 select-none transition-colors',
              readOnly ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-bg',
            )}>
              <input type="checkbox" {...register(field)} disabled={readOnly} className="rounded border-line accent-terracotta shrink-0" />
              {i === 0 ? t(lang, 'productionReady') : t(lang, 'doIssued')}
            </label>
          ))}
        </div>

        {/* Sales / POC — dropdown on new form only */}
        {useDropdowns && salesPocOptions && (
          <Field label="Sales / POC">
            <Controller
              control={control}
              name="sales_poc_id"
              render={({ field }) => (
                <SearchableSelect
                  value={salesPocOptions.find(o => o.id === field.value)?.label ?? ''}
                  onChange={label => {
                    const found = salesPocOptions.find(o => o.label === label)
                    if (found) field.onChange(found.id)
                  }}
                  options={salesPocOptions}
                  disabled={readOnly}
                />
              )}
            />
          </Field>
        )}

        {/* Notes */}
        <Field label={t(lang, 'notes')}>
          <SuggestField
            value={watch('notes')}
            onAccept={s => setValue('notes', s, { shouldDirty: true })}
            readOnly={readOnly}
            field="Notes"
          >
            <textarea {...register('notes')} disabled={readOnly} rows={2} className={TEXTAREA} />
          </SuggestField>
        </Field>

        {/* Production Instructions */}
        <Field label="Production instructions">
          <SuggestField
            value={watch('production_instructions')}
            onAccept={s => setValue('production_instructions', s, { shouldDirty: true })}
            readOnly={readOnly}
            field="Production Instructions"
          >
            <textarea {...register('production_instructions')} disabled={readOnly} rows={2} className={TEXTAREA} />
          </SuggestField>
        </Field>

      </Card>
    </>
  )
}
```

> **Note on `sales_poc_id`:** `FormValues` in `JobDetailShell.tsx` does not currently include `sales_poc_id`. Add it to `FormValues` in the next step.

- [ ] **Step 2: Add `sales_poc_id` to `FormValues` in `JobDetailShell.tsx`**

In `src/features/job-detail/JobDetailShell.tsx`, find the `FormValues` type (around line 27) and add:

```typescript
  sales_poc_id: string    // add after notes
```

Also add `sales_poc_id: job.sales_poc_id ?? ''` to the form `defaultValues` in `JobDetailShell`.

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/features/job-detail/CoreSection.tsx src/features/job-detail/JobDetailShell.tsx
git commit -m "feat(form): Company/POC searchable dropdowns, Day display, Sales/POC field in CoreSection"
```

---

## Task 8: `InstallerGrid` Component

**Files:**
- Create: `src/features/job-detail/InstallerGrid.tsx`

- [ ] **Step 1: Create the component**

```typescript
'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils/cn'
import type { InstallerUser } from '@/lib/supabase/queries/jobs'

const AVATAR_COLORS = [
  '#5C7A6B','#7A6B8A','#6B7A8A','#8A6B6B',
  '#6B8A7A','#7A8A6B','#8A7A6B','#6B6B8A',
]

function initials(name: string) {
  return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
}

interface Props {
  allInstallers: InstallerUser[]
  onChange:      (selectedIds: string[]) => void
}

export function InstallerGrid({ allInstallers, onChange }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const scrollRef  = useRef<HTMLDivElement>(null)
  const [showHint, setShowHint] = useState(false)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    // Show scroll hint if content overflows
    if (el.scrollHeight > el.clientHeight) setShowHint(true)
    function onScroll() {
      if (!el) return
      setShowHint(el.scrollTop + el.clientHeight < el.scrollHeight - 4)
    }
    el.addEventListener('scroll', onScroll)
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      onChange([...next])
      return next
    })
  }

  return (
    <div>
      <div
        ref={scrollRef}
        className="max-h-[290px] overflow-y-auto"
        style={{ scrollbarWidth: 'thin' }}
      >
        <div className="grid grid-cols-2 gap-2 pr-0.5 max-[480px]:grid-cols-1">
          {allInstallers.map((inst, i) => {
            const isSelected = selected.has(inst.id)
            const color      = AVATAR_COLORS[i % AVATAR_COLORS.length]
            const meta       = [
              inst.role,
              inst.years_experience ? `${inst.years_experience}y` : null,
              inst.skills?.join(', '),
            ].filter(Boolean).join(' · ')

            return (
              <button
                key={inst.id}
                type="button"
                onClick={() => toggle(inst.id)}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-[1.5px] text-left w-full transition-all',
                  isSelected
                    ? 'border-green bg-green/10'
                    : 'border-line bg-paper hover:border-green hover:bg-green/5',
                )}
              >
                {/* Avatar */}
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold text-white shrink-0 transition-shadow',
                    isSelected && 'ring-2 ring-green ring-offset-1',
                  )}
                  style={{ background: color }}
                >
                  {initials(inst.name)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    'text-sm font-semibold truncate',
                    isSelected ? 'text-green' : 'text-ink',
                  )}>
                    {inst.name}
                  </p>
                  {meta && (
                    <p className="text-[11px] text-muted truncate">{meta}</p>
                  )}
                </div>

                {/* Check circle */}
                <div className={cn(
                  'w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all',
                  isSelected ? 'bg-green border-green' : 'border-line',
                )}>
                  {isSelected && (
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {showHint && (
        <p className="text-center text-xs text-muted pt-1.5 flex items-center justify-center gap-1">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 12 15 18 9" />
          </svg>
          Scroll to see more
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/features/job-detail/InstallerGrid.tsx
git commit -m "feat(form): InstallerGrid two-column toggle component"
```

---

## Task 9: `ImageLightbox` Component

**Files:**
- Create: `src/components/ImageLightbox.tsx`

- [ ] **Step 1: Create the component**

```typescript
'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'

interface Props {
  src:     string
  alt?:    string
  onClose: () => void
}

export function ImageLightbox({ src, alt = '', onClose }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/80 hover:text-white bg-ink/40 rounded-full p-1.5 transition-colors"
        aria-label="Close"
      >
        <X size={20} />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        onClick={e => e.stopPropagation()}
        className="max-w-[90vw] max-h-[85vh] rounded-xl object-contain shadow-2xl"
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ImageLightbox.tsx
git commit -m "feat(ui): ImageLightbox component"
```

---

## Task 10: `AttachmentBuckets` Component

**Files:**
- Create: `src/features/job-detail/AttachmentBuckets.tsx`

This component fetches its own data via the browser Supabase client and handles all bucket mutations inline.

- [ ] **Step 1: Create the component**

```typescript
'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ImageLightbox } from '@/components/ImageLightbox'
import { Image as ImageIcon, Paperclip, Link as LinkIcon, Trash2, Plus,
         FileText, FileSpreadsheet, FileArchive, Download } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { AttachmentBucket, BucketFile } from '@/lib/supabase/queries/jobs'
import type { LangCode } from '@/lib/i18n'

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp'])

function isImage(filename: string) {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase()
  return IMAGE_EXTS.has(ext)
}

function fileExtLabel(filename: string) {
  const ext = filename.slice(filename.lastIndexOf('.') + 1).toUpperCase()
  return ext || 'FILE'
}

function FileTypeIcon({ filename }: { filename: string }) {
  const ext = filename.slice(filename.lastIndexOf('.') + 1).toLowerCase()
  if (['xls', 'xlsx', 'csv'].includes(ext))  return <FileSpreadsheet size={14} />
  if (['zip', 'rar', '7z'].includes(ext))    return <FileArchive size={14} />
  return <FileText size={14} />
}

interface Props {
  jobId:    string
  lang:     LangCode
  readOnly?: boolean
}

export function AttachmentBuckets({ jobId, readOnly = false }: Props) {
  const [buckets,    setBuckets]    = useState<AttachmentBucket[]>([])
  const [loading,    setLoading]    = useState(true)
  const [lightbox,   setLightbox]   = useState<string | null>(null)
  const supabase = createClient()

  async function load() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('attachment_buckets')
        .select('id, job_id, name, position, created_at, files(id, job_id, bucket_id, kind, r2_key, url_text, uploader_id, ts)')
        .eq('job_id', jobId)
        .order('position')
      if (error) throw error
      setBuckets((data ?? []) as unknown as AttachmentBucket[])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [jobId])

  async function addBucket() {
    const maxPos = buckets.reduce((m, b) => Math.max(m, b.position), -1)
    const { data, error } = await supabase
      .from('attachment_buckets')
      .insert({ job_id: jobId, name: 'NEW BUCKET', position: maxPos + 1 } as never)
      .select('id, job_id, name, position, created_at')
      .single()
    if (error) return
    setBuckets(prev => [...prev, { ...(data as unknown as AttachmentBucket), files: [] }])
  }

  async function renameBucket(id: string, name: string) {
    await supabase.from('attachment_buckets').update({ name } as never).eq('id', id)
    setBuckets(prev => prev.map(b => b.id === id ? { ...b, name } : b))
  }

  async function deleteBucket(id: string) {
    await supabase.from('attachment_buckets').delete().eq('id', id)
    setBuckets(prev => prev.filter(b => b.id !== id))
  }

  async function uploadFile(bucket: AttachmentBucket, file: File, kind: 'image' | 'attachment') {
    const userId = (await supabase.auth.getUser()).data.user?.id
    if (!userId) return

    // Get R2 signed upload URL
    const res = await fetch('/api/r2/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, kind: 'attachment', filename: file.name, contentType: file.type }),
    })
    if (!res.ok) return
    const { url, key } = await res.json() as { url: string; key: string }

    // Upload to R2
    await fetch(url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })

    // Insert into files table
    const { data: fileRow, error } = await supabase
      .from('files')
      .insert({
        job_id:      jobId,
        bucket_id:   bucket.id,
        kind:        'attachment',
        r2_key:      key,
        uploader_id: userId,
        visibility:  ['public-internal'],
      } as never)
      .select('id, job_id, bucket_id, kind, r2_key, url_text, uploader_id, ts')
      .single()
    if (error) return

    setBuckets(prev => prev.map(b =>
      b.id === bucket.id
        ? { ...b, files: [...b.files, fileRow as unknown as BucketFile] }
        : b,
    ))
  }

  async function addUrl(bucket: AttachmentBucket, url: string) {
    const userId = (await supabase.auth.getUser()).data.user?.id
    if (!userId) return

    const { data: fileRow, error } = await supabase
      .from('files')
      .insert({
        job_id:      jobId,
        bucket_id:   bucket.id,
        kind:        'url_link',
        r2_key:      '',
        url_text:    url,
        uploader_id: userId,
        visibility:  ['public-internal'],
      } as never)
      .select('id, job_id, bucket_id, kind, r2_key, url_text, uploader_id, ts')
      .single()
    if (error) return

    setBuckets(prev => prev.map(b =>
      b.id === bucket.id
        ? { ...b, files: [...b.files, fileRow as unknown as BucketFile] }
        : b,
    ))
  }

  async function deleteFile(bucketId: string, fileId: string) {
    await supabase.from('files').delete().eq('id', fileId)
    setBuckets(prev => prev.map(b =>
      b.id === bucketId
        ? { ...b, files: b.files.filter(f => f.id !== fileId) }
        : b,
    ))
  }

  async function getDownloadUrl(r2Key: string): Promise<string> {
    const res = await fetch('/api/r2/download-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: r2Key }),
    })
    const { url } = await res.json() as { url: string }
    return url
  }

  if (loading) return <p className="text-sm text-muted py-4">Loading attachments…</p>

  return (
    <div className="space-y-3">
      {lightbox && (
        <ImageLightbox src={lightbox} onClose={() => setLightbox(null)} />
      )}

      {buckets.map(bucket => (
        <BucketCard
          key={bucket.id}
          bucket={bucket}
          readOnly={readOnly}
          onRename={name => renameBucket(bucket.id, name)}
          onDelete={() => deleteBucket(bucket.id)}
          onUpload={(file, kind) => uploadFile(bucket, file, kind)}
          onAddUrl={url => addUrl(bucket, url)}
          onDeleteFile={fileId => deleteFile(bucket.id, fileId)}
          onImageClick={src => setLightbox(src)}
          getDownloadUrl={getDownloadUrl}
        />
      ))}

      {!readOnly && (
        <button
          type="button"
          onClick={addBucket}
          className="flex items-center gap-2 w-full px-4 py-2.5 rounded-xl border-2 border-dashed border-line text-sm font-medium text-muted hover:border-terracotta hover:text-terracotta hover:bg-terracotta/5 transition-all"
        >
          <Plus size={14} />
          Add bucket
        </button>
      )}
    </div>
  )
}

// ── BucketCard ───────────────────────────────────────────────────────────────

interface BucketCardProps {
  bucket:         AttachmentBucket
  readOnly:       boolean
  onRename:       (name: string) => void
  onDelete:       () => void
  onUpload:       (file: File, kind: 'image' | 'attachment') => void
  onAddUrl:       (url: string) => void
  onDeleteFile:   (fileId: string) => void
  onImageClick:   (src: string) => void
  getDownloadUrl: (key: string) => Promise<string>
}

function BucketCard({
  bucket, readOnly, onRename, onDelete, onUpload, onAddUrl, onDeleteFile, onImageClick, getDownloadUrl,
}: BucketCardProps) {
  const [name,       setName]       = useState(bucket.name)
  const [urlModal,   setUrlModal]   = useState(false)
  const [urlInput,   setUrlInput]   = useState('')
  const [deleteConf, setDeleteConf] = useState(false)
  const imgRef  = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <div className="rounded-xl border border-line bg-paper overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-line">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          onBlur={() => { if (name !== bucket.name) onRename(name) }}
          disabled={readOnly}
          className="flex-1 bg-transparent text-[11px] font-semibold tracking-widest uppercase text-ink2 outline-none disabled:cursor-default"
        />
        {!readOnly && (
          <div className="flex items-center gap-1 shrink-0">
            {/* Image upload */}
            <input ref={imgRef} type="file" accept="image/*" multiple className="hidden"
              onChange={e => { [...(e.target.files ?? [])].forEach(f => onUpload(f, 'image')); e.target.value = '' }} />
            <ActionBtn icon={<ImageIcon size={11} />} label="Image" onClick={() => imgRef.current?.click()} />

            {/* File upload */}
            <input ref={fileRef} type="file" multiple className="hidden"
              onChange={e => { [...(e.target.files ?? [])].forEach(f => onUpload(f, 'attachment')); e.target.value = '' }} />
            <ActionBtn icon={<Paperclip size={11} />} label="Attachment" onClick={() => fileRef.current?.click()} />

            {/* URL */}
            <ActionBtn icon={<LinkIcon size={11} />} label="URL" onClick={() => setUrlModal(true)} />

            {/* Delete bucket */}
            <button type="button" onClick={() => setDeleteConf(true)}
              className="p-1.5 rounded-lg text-muted hover:text-terracotta hover:bg-terracotta/5 transition-colors">
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="px-4 py-3 min-h-[40px]">
        {bucket.files.length === 0 ? (
          <p className="text-xs text-muted italic">No files yet</p>
        ) : (
          <div className="space-y-1">
            {bucket.files.map(file => (
              <FileRow
                key={file.id}
                file={file}
                readOnly={readOnly}
                onDelete={() => onDeleteFile(file.id)}
                onImageClick={onImageClick}
                getDownloadUrl={getDownloadUrl}
              />
            ))}
          </div>
        )}
      </div>

      {/* URL modal */}
      {urlModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50" onClick={() => setUrlModal(false)}>
          <div className="bg-paper rounded-xl p-5 w-80 shadow-xl" onClick={e => e.stopPropagation()}>
            <p className="font-display font-medium text-sm text-ink mb-3">Add URL</p>
            <input
              autoFocus
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              placeholder="https://…"
              className="w-full border border-line rounded-lg px-3 py-2 text-sm text-ink bg-bg mb-3 outline-none focus:border-terracotta"
            />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setUrlModal(false)}
                className="px-3 py-1.5 text-sm rounded-lg border border-line text-ink2">Cancel</button>
              <button type="button"
                onClick={() => { if (urlInput.trim()) { onAddUrl(urlInput.trim()); setUrlInput(''); setUrlModal(false) } }}
                className="px-3 py-1.5 text-sm rounded-lg bg-terracotta text-white">Add link</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete bucket confirm */}
      {deleteConf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50" onClick={() => setDeleteConf(false)}>
          <div className="bg-paper rounded-xl p-5 w-72 shadow-xl" onClick={e => e.stopPropagation()}>
            <p className="font-display font-medium text-sm text-ink mb-2">Delete bucket?</p>
            <p className="text-xs text-ink2 mb-4">
              {bucket.files.length > 0
                ? `Delete bucket and its ${bucket.files.length} file${bucket.files.length !== 1 ? 's' : ''}?`
                : 'Delete this empty bucket?'}
            </p>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setDeleteConf(false)}
                className="px-3 py-1.5 text-sm rounded-lg border border-line text-ink2">Cancel</button>
              <button type="button" onClick={() => { setDeleteConf(false); onDelete() }}
                className="px-3 py-1.5 text-sm rounded-lg bg-terracotta text-white">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ActionBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="flex items-center gap-1 px-2 py-1 rounded-lg border border-line text-[11px] font-medium text-ink2 hover:bg-bg hover:border-ink2 transition-colors">
      {icon} {label}
    </button>
  )
}

function FileRow({ file, readOnly, onDelete, onImageClick, getDownloadUrl }: {
  file: BucketFile
  readOnly: boolean
  onDelete: () => void
  onImageClick: (src: string) => void
  getDownloadUrl: (key: string) => Promise<string>
}) {
  const [dlLoading, setDlLoading] = useState(false)
  const isUrl     = file.kind === 'url_link'
  const urlText   = file.url_text ?? file.r2_key
  const filename  = isUrl ? urlText : (file.r2_key.split('/').pop() ?? file.r2_key)
  const imgFile   = !isUrl && isImage(filename)

  async function handleClick() {
    if (isUrl) { window.open(urlText, '_blank', 'noopener'); return }
    if (imgFile) {
      setDlLoading(true)
      try {
        const url = await getDownloadUrl(file.r2_key)
        onImageClick(url)
      } finally { setDlLoading(false) }
      return
    }
    setDlLoading(true)
    try {
      const url = await getDownloadUrl(file.r2_key)
      window.open(url, '_blank', 'noopener')
    } finally { setDlLoading(false) }
  }

  return (
    <div className="flex items-center gap-2 py-1.5 group">
      {imgFile ? (
        <button type="button" onClick={handleClick} disabled={dlLoading}
          className="w-[70px] h-[54px] rounded-lg bg-line overflow-hidden shrink-0 hover:opacity-80 transition-opacity">
          {/* Thumbnail placeholder — shows filename until URL is resolved */}
          <div className="w-full h-full flex items-center justify-center text-[9px] text-muted font-medium">
            {fileExtLabel(filename)}
          </div>
        </button>
      ) : isUrl ? (
        <div className="w-6 h-6 rounded-md bg-terracotta/10 flex items-center justify-center shrink-0">
          <LinkIcon size={12} className="text-terracotta" />
        </div>
      ) : (
        <div className="w-6 h-6 rounded-md bg-line flex items-center justify-center shrink-0 text-muted">
          <FileTypeIcon filename={filename} />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <button type="button" onClick={handleClick} disabled={dlLoading}
          className={cn('text-xs text-left truncate max-w-full hover:underline', isUrl ? 'text-terracotta' : 'text-ink')}>
          {filename}
        </button>
        {!isUrl && (
          <p className="text-[10px] text-muted">{fileExtLabel(filename)}</p>
        )}
      </div>

      {!isUrl && !imgFile && (
        <button type="button" onClick={handleClick} disabled={dlLoading}
          className="text-muted hover:text-ink transition-colors shrink-0">
          <Download size={13} />
        </button>
      )}

      {!readOnly && (
        <button type="button" onClick={onDelete}
          className="text-muted opacity-0 group-hover:opacity-100 hover:text-terracotta transition-all shrink-0">
          <Trash2 size={12} />
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/features/job-detail/AttachmentBuckets.tsx
git commit -m "feat(form): AttachmentBuckets component with lightbox, download, URL support"
```

---

## Task 11: Rebuild `NewJobShell`

**Files:**
- Modify: `src/features/job-detail/NewJobShell.tsx`

The new shell needs: back link, Fraunces page title, `CoreSection` with dropdowns, `InstallerGrid`, `AttachmentBuckets` locked placeholder, chat locked notice, 3-button action bar (Cancel | Save as pending | Send for approval).

- [ ] **Step 1: Load Sales/POC users server-side and pass to the shell**

In the server page that renders `NewJobShell` (`src/app/jobs/new/page.tsx` — find and read this file first), add a query to load `sales`, `scheduler`, and `admin` users and pass them as a prop.

Find the file:
```bash
find src/app -name "page.tsx" | xargs grep -l "NewJobShell" 2>/dev/null
```

Read that page file, then add:

```typescript
// In the server page, after auth check:
const supabase = await createClient()
const { data: salesUsers } = await supabase
  .from('users')
  .select('id, name')
  .in('role', ['sales', 'scheduler', 'admin'])
  .order('name')

const { data: installerUsers } = await supabase
  .from('users')
  .select('id, name, phone, role, years_experience, skills')
  .eq('role', 'installer')
  .order('name')
```

Pass both as props: `salesUsers` and `installerUsers` to `NewJobShell`.

- [ ] **Step 2: Update `NewJobShell` props interface and rewrite the component**

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { createClient } from '@/lib/supabase/client'
import { t } from '@/lib/i18n'
import { useToast } from '@/components/Toast'
import { CoreSection } from './CoreSection'
import { InstallerGrid } from './InstallerGrid'
import { AttachmentBuckets } from './AttachmentBuckets'
import { Lock, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import type { FormValues } from './JobDetailShell'
import type { InstallerUser } from '@/lib/supabase/queries/jobs'
import type { LangCode } from '@/lib/i18n'
import type { SelectOption } from '@/components/SearchableSelect'

interface Props {
  userId:           string
  userName:         string
  lang:             LangCode
  salesPocOptions:  SelectOption[]
  allInstallers:    InstallerUser[]
}

export function NewJobShell({ userId, userName, lang, salesPocOptions, allInstallers }: Props) {
  const router = useRouter()
  const { error: showError } = useToast()
  const [saving,        setSaving]        = useState(false)
  const [selectedIds,   setSelectedIds]   = useState<string[]>([])

  const today = new Date().toISOString().split('T')[0]

  const { register, handleSubmit, control, watch, setValue, formState: { errors } } =
    useForm<FormValues>({
      defaultValues: {
        project_title:           '',
        date:                    today,
        date_end:                '',
        time_start:              '',
        time_end:                '',
        client:                  '',
        location:                '',
        description:             '',
        client_poc_name:         '',
        client_poc_phone:        '',
        production_ready:        false,
        do_issued:               false,
        punctuality:             'strict',
        production_instructions: '',
        notes:                   '',
        quote_amount:            '',
        supplier_cost:           '',
        margin_notes:            '',
        sales_poc_id:            userId,
      },
    })

  async function saveJob(status: 'pending' | 'awaiting_approval') {
    const values = watch()
    setSaving(true)
    const supabase = createClient()
    try {
      const { data: job, error: insertError } = await (supabase
        .from('jobs')
        .insert({
          status,
          sales_poc_id:            values.sales_poc_id || userId,
          project_title:           values.project_title || null,
          date:                    values.date,
          date_end:                values.date_end     || null,
          time_start:              values.time_start   || null,
          time_end:                values.time_end     || null,
          client:                  values.client,
          location:                values.location,
          description:             values.description  || null,
          client_poc_name:         values.client_poc_name  || null,
          client_poc_phone:        values.client_poc_phone || null,
          production_ready:        values.production_ready,
          do_issued:               values.do_issued,
          punctuality:             values.punctuality,
          production_instructions: values.production_instructions || null,
          notes:                   values.notes || null,
          visibility:              ['role:sales', 'role:scheduler'],
        } as never)
        .select('id')
        .single() as unknown as Promise<{ data: { id: string } | null; error: Error | null }>)

      if (insertError || !job) throw insertError

      // Create default attachment buckets
      await supabase.from('attachment_buckets').insert([
        { job_id: job.id, name: 'PERMIT-TO-WORK', position: 0 },
        { job_id: job.id, name: 'BCA',            position: 1 },
        { job_id: job.id, name: 'DESIGNER JO',    position: 2 },
        { job_id: job.id, name: 'OTHERS',         position: 3 },
      ] as never)

      // Insert selected installers
      if (selectedIds.length > 0) {
        await supabase.from('job_assignees').insert(
          selectedIds.map(uid => ({ job_id: job.id, user_id: uid })) as never,
        )
      }

      // Fire Telegram notifications if sending for approval
      if (status === 'awaiting_approval') {
        await fetch(`/api/jobs/${job.id}/submit`, { method: 'POST' })
      }

      router.push(`/jobs/${job.id}`)
    } catch {
      showError(t(lang, 'saveError'))
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg pb-24">
      {/* Back + title */}
      <div className="px-4 pt-4 pb-0 max-w-2xl mx-auto">
        <Link href="/schedule" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink mb-3">
          <ArrowLeft size={15} /> Schedule
        </Link>
        <h1 className="font-display text-3xl font-medium text-ink mb-5">New job</h1>
      </div>

      {/* Core fields */}
      <div className="max-w-2xl mx-auto px-4 space-y-4">
        <CoreSection
          register={register}
          errors={errors}
          control={control}
          watch={watch}
          setValue={setValue}
          readOnly={false}
          lang={lang}
          validateRequired
          salesPocOptions={salesPocOptions}
          salesPocUserId={userId}
        />

        {/* Installers */}
        <div>
          <p className="text-[11px] uppercase tracking-widest text-muted font-medium mb-2">Installers</p>
          <div className="bg-paper border border-line rounded-xl p-4">
            <InstallerGrid allInstallers={allInstallers} onChange={setSelectedIds} />
          </div>
        </div>

        {/* Attachments — locked until job is saved */}
        <div>
          <p className="text-[11px] uppercase tracking-widest text-muted font-medium mb-2">Attachments</p>
          <div className="bg-paper border border-line rounded-xl p-5 flex items-center gap-2.5 text-muted text-sm opacity-60 pointer-events-none select-none">
            <Lock size={14} />
            Save the job first to add attachments.
          </div>
        </div>

        {/* Chat locked notice */}
        <div className="bg-paper border border-line rounded-xl p-5 flex items-center gap-2.5 text-muted text-sm opacity-60 pointer-events-none select-none">
          <Lock size={14} />
          {t(lang, 'chatPreScheduleMessage')}
        </div>
      </div>

      {/* Action bar */}
      <div className="max-w-2xl mx-auto px-4 mt-6 flex justify-end items-center gap-2">
        <Link
          href="/schedule"
          className="px-4 py-2.5 rounded-xl border border-line bg-paper text-sm font-medium text-ink2 hover:bg-bg transition-colors"
        >
          Cancel
        </Link>
        <button
          type="button"
          disabled={saving}
          onClick={handleSubmit(() => saveJob('pending'))}
          className="px-4 py-2.5 rounded-xl border-[1.5px] border-amber-500 bg-amber-50 text-sm font-medium text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50"
        >
          Save as pending
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={handleSubmit(() => saveJob('awaiting_approval'))}
          className="px-4 py-2.5 rounded-xl bg-terracotta text-sm font-medium text-white hover:bg-terracotta/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
        >
          Send for approval
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Update the server page to pass the new props**

After finding the server page (from Step 1), update its render call to pass `salesPocOptions` and `allInstallers`:

```typescript
<NewJobShell
  userId={profile.id}
  userName={profile.name}
  lang={profile.lang}
  salesPocOptions={(salesUsers ?? []).map(u => ({ id: u.id, label: u.name }))}
  allInstallers={(installerUsers ?? []) as InstallerUser[]}
/>
```

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/features/job-detail/NewJobShell.tsx
git commit -m "feat(form): rebuild NewJobShell with installer grid, action bar, attachment placeholder"
```

---

## Task 12: Installer Admin Fields in `UsersTab`

**Files:**
- Modify: `src/features/admin/UsersTab.tsx`

When editing a user with `role = 'installer'`, show two extra fields: Years of experience (number) and Skills (tag chip input).

- [ ] **Step 1: Add state + UI inside the `UserRow` editing block**

In `src/features/admin/UsersTab.tsx`, inside the `UserRow` component, add state for the new fields:

```typescript
  const [years,  setYears]  = useState<string>(String(user.years_experience ?? ''))
  const [skills, setSkills] = useState<string[]>(user.skills ?? [])
  const [skillInput, setSkillInput] = useState('')
```

Inside the `editing` block (where Role, Telegram ID, digest checkbox are shown), add after the digest checkbox and before the error/buttons:

```typescript
            {/* Installer-only fields */}
            {role === 'installer' && (
              <>
                <div>
                  <label className="text-xs text-muted mb-1 block">Years of experience</label>
                  <input
                    type="number"
                    min={0}
                    value={years}
                    onChange={e => setYears(e.target.value)}
                    placeholder="e.g. 5"
                    className="w-full border border-line rounded-lg px-3 py-2 text-sm text-ink bg-bg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-terracotta/40"
                  />
                </div>

                <div>
                  <label className="text-xs text-muted mb-1 block">Skills</label>
                  <div className="flex flex-wrap gap-1.5 mb-1.5">
                    {skills.map(skill => (
                      <span key={skill} className="inline-flex items-center gap-1 bg-line text-ink2 text-xs px-2 py-0.5 rounded-full">
                        {skill}
                        <button type="button" onClick={() => setSkills(s => s.filter(x => x !== skill))}
                          className="text-muted hover:text-terracotta transition-colors leading-none">×</button>
                      </span>
                    ))}
                    <input
                      value={skillInput}
                      onChange={e => setSkillInput(e.target.value)}
                      onKeyDown={e => {
                        if ((e.key === 'Enter' || e.key === ',') && skillInput.trim()) {
                          e.preventDefault()
                          const s = skillInput.trim().replace(/,$/, '')
                          if (s && !skills.includes(s)) setSkills(prev => [...prev, s])
                          setSkillInput('')
                        }
                      }}
                      placeholder="Type skill, press Enter"
                      className="border-none outline-none text-xs text-ink bg-transparent placeholder:text-muted min-w-[120px]"
                    />
                  </div>
                  <p className="text-[10px] text-muted">Press Enter or comma to add</p>
                </div>
              </>
            )}
```

- [ ] **Step 2: Include the new fields in the `save()` call**

In the `save()` function, update the `body` to include the new fields:

```typescript
          body: JSON.stringify({
            role,
            telegram_chat_id:  tgId.trim() || null,
            digest_subscriber: digestSub,
            ...(role === 'installer' && {
              years_experience: years !== '' ? parseInt(years, 10) : null,
              skills,
            }),
          }),
```

- [ ] **Step 3: Update the `PATCH /api/admin/users/[id]` route to accept the new fields**

Read `src/app/api/admin/users/[id]/route.ts` and update its handler to pass `years_experience` and `skills` through to `updateUser`:

```typescript
// In the PATCH handler, extract new fields from body:
const { role, telegram_chat_id, digest_subscriber, years_experience, skills } =
  await req.json() as {
    role?:              Role
    telegram_chat_id?:  string | null
    digest_subscriber?: boolean
    years_experience?:  number | null
    skills?:            string[]
  }

// Build patch object:
const patch: Parameters<typeof updateUser>[1] = {}
if (role              !== undefined) patch.role              = role
if (telegram_chat_id  !== undefined) patch.telegram_chat_id  = telegram_chat_id
if (digest_subscriber !== undefined) patch.digest_subscriber = digest_subscriber
if (years_experience  !== undefined) patch.years_experience  = years_experience
if (skills            !== undefined) patch.skills            = skills

await updateUser(id, patch)
```

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/features/admin/UsersTab.tsx src/app/api/admin/users/
git commit -m "feat(admin): years_experience and skills chip inputs for installer users"
```

---

## Task 13: Wire Up `AttachmentBuckets` on Edit Page

The edit page (`JobDetailShell`) still uses the old `AttachmentSection`. Replace it with `AttachmentBuckets` now that the component exists.

**Files:**
- Modify: `src/features/job-detail/JobDetailShell.tsx`

- [ ] **Step 1: Swap `AttachmentSection` for `AttachmentBuckets` in `JobDetailShell`**

In `src/features/job-detail/JobDetailShell.tsx`:

1. Remove the import for `AttachmentSection` and add:
```typescript
import { AttachmentBuckets } from './AttachmentBuckets'
```

2. Find the `<AttachmentSection files={job.files} lang={lang} />` usage and replace with:
```typescript
<AttachmentBuckets jobId={job.id} lang={lang} readOnly={readOnly} />
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/features/job-detail/JobDetailShell.tsx
git commit -m "feat(form): replace AttachmentSection with AttachmentBuckets on edit page"
```

---

## Task 14: End-to-End Smoke Test

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Test new job form**

1. Go to `/jobs/new`
2. Confirm: back arrow → Schedule, page title "New job" in Fraunces font
3. Pick a date — confirm Day label updates automatically
4. Open Company dropdown — confirm search, "Add new…", X per item (with modal), X on trigger clears
5. Pick a company — confirm Client POC Name unlocks, contacts populate
6. Pick a POC — confirm X on trigger clears POC only; company stays
7. Delete a contact via X in dropdown — confirm it's removed from list
8. Type in Project Title → click "Improve" → confirm before/after panel, "Keep mine" dismisses, "Use this" updates field
9. Tap 3+ installers — confirm they highlight green
10. Scroll the installer grid — confirm "Scroll to see more" hint appears and disappears at bottom
11. Confirm attachments section shows "Save the job first to add attachments"
12. Click "Save as pending" → confirm redirect to `/jobs/[id]`, status = pending
13. On the edit page, confirm 4 default buckets appear (PERMIT-TO-WORK, BCA, DESIGNER JO, OTHERS)
14. Upload an image to a bucket → confirm thumbnail appears → click → lightbox opens
15. Upload a file → confirm file row with download icon → click download
16. Add a URL → confirm URL row → click opens in new tab

- [ ] **Step 3: Test Send for approval**

1. Create another job → click "Send for approval"
2. Confirm redirect to `/jobs/[id]`, status = awaiting_approval
3. Check that schedulers receive a Telegram notification (or confirm the `/api/jobs/[id]/submit` call returns 200)

- [ ] **Step 4: Test admin installer fields**

1. Go to `/admin` → Users tab → find an installer → click Edit
2. Confirm Years of experience and Skills fields appear (and are absent for non-installer roles)
3. Enter years, add skill chips (type + Enter), save → reload → confirm values persist

- [ ] **Step 5: Push to preview**

```bash
git push origin feat-job-form-redesign
```

Check Vercel preview URL, repeat smoke test in preview environment.

---

## Self-Review Notes

- **Spec coverage:** All four spec parts covered — form redesign (Tasks 7, 11), attachment buckets (Tasks 1, 10, 13), installer admin fields (Task 12), client DB tables (Tasks 2, 4).
- **`sales_poc_id` in submit route:** The existing `/api/jobs/[id]/submit` route updates status to `awaiting_approval` — it does not need changes since `NewJobShell` calls it after insert.
- **`getJobBuckets` import:** `queries/jobs.ts` imports `createClient` from `@/lib/supabase/client` for `getJobBuckets` — check that the file's existing imports use server client and separate this carefully. The bucket helpers should use the client-side import since they're called from client components.
- **`sales_poc_id` field:** Added to `FormValues` — verify `JobDetailShell` default values include it to avoid a TypeScript error on the edit page.
