# Edit Job Form — Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `/jobs/[id]` layout — new non-sticky header, Team card with InstallerGrid, bottom action bar, and a role-gated installer read-only view — while preserving all existing business logic.

**Architecture:** Layout-only restructure. `JobDetailShell` gets a new layout: removes sticky header, removes `AssigneeSection`/`PendingFilesSection`/`StatusSection`, adds a Team card (Sales/POC + Notes + InstallerGrid), and a sticky action bar. `CoreSection` loses `salesPocOptions`/`useDropdowns` flag and the Sales/POC, Notes, Production Instructions fields — always uses SearchableSelect; gains an `installerView` prop for bold date/time and the DO status button. `ProductionReadySection` splits into three named upload sub-sections and gains a `role` prop. `InstallerGrid` gains an `initialSelectedIds` prop and fixes the check badge clip bug.

**Tech Stack:** Next.js 15 App Router, TypeScript, React Hook Form (`Controller`, `watch`, `setValue`), Tailwind CSS, Supabase client, Lucide React icons (`ArrowLeft`, `Bell`, `Trash2`, `CheckCircle`, `Inbox`)

---

## File Map

| File | Action | What changes |
|---|---|---|
| `src/features/job-detail/InstallerGrid.tsx` | Modify | Add `initialSelectedIds` prop; fix check badge clip (move badge outside avatar div) |
| `src/components/SuggestField.tsx` | Modify | Rename "Improve" → "Suggest" (button, loading text, panel header) |
| `src/app/api/r2/upload-url/route.ts` | Modify | Add `'production_instructions'` to `VALID_KINDS` set |
| `src/features/job-detail/CoreSection.tsx` | Modify | Remove `salesPocOptions`/`useDropdowns`; always use SearchableSelect + Day; remove Sales/POC, Notes, Production Instructions fields; add `installerView` prop |
| `src/features/job-detail/ProductionReadySection.tsx` | Modify | Add `role` prop; split into Production Instructions + Photos + Signed DO + Completion Photos; gate upload buttons by role |
| `src/app/jobs/[id]/page.tsx` | Modify | Add sales users query; pass `salesPocOptions: SelectOption[]` to `JobDetailShell` |
| `src/features/job-detail/JobDetailShell.tsx` | Modify | Full layout rewrite: new header, Team card, action bar, installer view gates, `sales_poc_id` in save, installer diff on submit |
| `src/features/job-detail/NewJobShell.tsx` | Modify | Remove `salesPocOptions` from CoreSection call; add Sales/POC + Notes + Production Instructions fields directly in shell |
| `src/features/job-detail/AssigneeSection.tsx` | Delete | Replaced by InstallerGrid in Team card |

---

## Task 1: Fix InstallerGrid — badge clip + initialSelectedIds prop

**Files:**
- Modify: `src/features/job-detail/InstallerGrid.tsx`

The check badge (`absolute -bottom-0.5 -right-0.5`) sits inside the avatar `div` which has `rounded-full`. The `overflow: hidden` implied by `rounded-full` on a positioned element clips the badge. Fix: move the badge outside the avatar `div` as a sibling, both wrapped in a `relative` container. Also add `initialSelectedIds?: string[]` so the edit form can pre-select already-assigned installers on mount.

- [ ] **Step 1: Replace InstallerGrid.tsx**

```tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { InstallerUser } from '@/lib/supabase/queries/jobs'

const AVATAR_COLORS = [
  '#5C7A6B', '#7A6B8A', '#6B7A8A', '#8A6B6B',
  '#6B8A7A', '#7A8A6B', '#8A7A6B', '#6B6B8A',
]

function initials(name: string) {
  return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
}

interface Props {
  allInstallers:       InstallerUser[]
  onChange:            (selectedIds: string[]) => void
  initialSelectedIds?: string[]
}

export function InstallerGrid({ allInstallers, onChange, initialSelectedIds = [] }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelectedIds))
  const scrollRef  = useRef<HTMLDivElement>(null)
  const [showHint, setShowHint] = useState(false)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
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
    <div className="relative">
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
              inst.skills?.length ? inst.skills.join(', ') : null,
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
                {/* relative wrapper so badge sits outside the clipped avatar */}
                <div className="relative shrink-0">
                  <div
                    className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold text-white transition-shadow',
                      isSelected && 'ring-2 ring-green ring-offset-1',
                    )}
                    style={{ background: color }}
                  >
                    {initials(inst.name)}
                  </div>
                  {isSelected && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-green flex items-center justify-center">
                      <Check size={8} strokeWidth={3} className="text-white" />
                    </div>
                  )}
                </div>
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
              </button>
            )
          })}
        </div>
      </div>
      {showHint && (
        <p className="text-center text-[10px] text-muted mt-1">Scroll to see more</p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors related to InstallerGrid.

- [ ] **Step 3: Commit**

```bash
git add src/features/job-detail/InstallerGrid.tsx
git commit -m "fix: InstallerGrid — move check badge outside avatar div to fix overflow clip; add initialSelectedIds prop"
```

---

## Task 2: Rename "Improve" → "Suggest" in SuggestField

**Files:**
- Modify: `src/components/SuggestField.tsx`

Three string changes. The function name `handleImprove` can stay — it's internal.

- [ ] **Step 1: Change button label**

In `src/components/SuggestField.tsx`, find and replace:

```tsx
// Before (line ~47)
              className="text-xs font-medium text-muted border border-line bg-paper hover:text-terracotta hover:border-terracotta hover:bg-terracotta/5 px-2.5 py-1 rounded-md transition-colors flex items-center gap-1"
            >
              ✦ Improve
            </button>
```
```tsx
// After
              className="text-xs font-medium text-muted border border-line bg-paper hover:text-terracotta hover:border-terracotta hover:bg-terracotta/5 px-2.5 py-1 rounded-md transition-colors flex items-center gap-1"
            >
              ✦ Suggest
            </button>
```

- [ ] **Step 2: Change loading text**

```tsx
// Before (line ~50)
            <span className="text-xs text-muted">Improving…</span>
// After
            <span className="text-xs text-muted">Suggesting…</span>
```

- [ ] **Step 3: Change suggestion panel header**

```tsx
// Before (line ~59)
          <p className="text-[10px] font-semibold tracking-widest uppercase text-terracotta mb-2.5">✦ Improve</p>
// After
          <p className="text-[10px] font-semibold tracking-widest uppercase text-terracotta mb-2.5">✦ Suggest</p>
```

- [ ] **Step 4: Commit**

```bash
git add src/components/SuggestField.tsx
git commit -m "feat: rename Improve → Suggest in SuggestField"
```

---

## Task 3: Fix upload API — add production_instructions to VALID_KINDS

**Files:**
- Modify: `src/app/api/r2/upload-url/route.ts`

`ProductionReadySection` uploads files with `kind: 'production_instructions'` but the upload route's `VALID_KINDS` set does not include it, causing a 400 error on every production photo upload.

- [ ] **Step 1: Add production_instructions to VALID_KINDS**

In `src/app/api/r2/upload-url/route.ts`, line 6:

```tsx
// Before
const VALID_KINDS = new Set<FileKind>(['photo', 'completion', 'voice', 'do', 'attachment'])

// After
const VALID_KINDS = new Set<FileKind>(['photo', 'completion', 'voice', 'do', 'attachment', 'production_instructions'])
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/r2/upload-url/route.ts
git commit -m "fix: add production_instructions to upload API valid kinds"
```

---

## Task 4: Refactor CoreSection

**Files:**
- Modify: `src/features/job-detail/CoreSection.tsx`

Removes the `salesPocOptions` / `useDropdowns` toggle. The component now always uses `SearchableSelect` and always shows the Day display (never Date End). Removes Sales/POC, Notes, and Production Instructions fields entirely — those move to the Team card or Production section in `JobDetailShell`.

Adds `installerView?: boolean` prop that:
- Replaces every form input with a plain read-only display div (bold for date + times)
- Replaces the Production Ready + DO checkbox row with a full-width DO status button

- [ ] **Step 1: Replace CoreSection.tsx**

```tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { UseFormRegister, FieldErrors, Control, Controller, UseFormWatch, UseFormSetValue } from 'react-hook-form'
import { Card } from '@/components/Card'
import { Field } from '@/components/Field'
import { Input } from '@/components/Input'
import { SuggestField } from '@/components/SuggestField'
import { SearchableSelect, SelectOption } from '@/components/SearchableSelect'
import { Modal } from '@/components/Modal'
import { Btn } from '@/components/Btn'
import { TimeSelect } from './TimeSelect'
import { t } from '@/lib/i18n'
import { cn } from '@/lib/utils/cn'
import type { LangCode } from '@/lib/i18n'
import type { FormValues } from './JobDetailShell'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const TEXTAREA = 'w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:border-terracotta focus:ring-terracotta/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 resize-none'

interface Props {
  register:          UseFormRegister<FormValues>
  errors:            FieldErrors<FormValues>
  control:           Control<FormValues>
  watch:             UseFormWatch<FormValues>
  setValue:          UseFormSetValue<FormValues>
  readOnly:          boolean
  lang:              LangCode
  validateRequired?: boolean
  installerView?:    boolean
}

export function CoreSection({
  register, errors, control, watch, setValue,
  readOnly, lang, validateRequired = false, installerView = false,
}: Props) {
  const req = validateRequired ? { required: 'Required' } : {}

  const [companies,        setCompanies]        = useState<SelectOption[]>([])
  const [contacts,         setContacts]         = useState<SelectOption[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [deleteTarget,     setDeleteTarget]     = useState<{ id: string; label: string } | null>(null)
  const [deleteLoading,    setDeleteLoading]    = useState(false)
  const pendingResolve = useRef<((v: boolean) => void) | null>(null)

  const dateValue = watch('date')
  const dayLabel  = dateValue ? DAYS[new Date(dateValue + 'T00:00:00').getDay()] : '—'
  const dateDisplay = dateValue
    ? new Date(dateValue + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—'

  useEffect(() => {
    fetch('/api/clients')
      .then(r => r.json())
      .then((data: { id: string; name: string }[]) =>
        setCompanies(data.map(c => ({ id: c.id, label: c.name }))),
      )
      .catch(() => {})
  }, [])

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
      setDeleteTarget({ id: '', label })
      pendingResolve.current = resolve
    })
  }

  const doIssued = watch('do_issued')

  // Shared read-only display box for installer view
  const roBox = (value: string, bold = false) => (
    <div className={cn(
      'w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink2',
      bold && 'font-semibold text-ink',
    )}>
      {value || '—'}
    </div>
  )

  return (
    <>
      {deleteTarget && (
        <Modal isOpen={!!deleteTarget} onClose={() => { setDeleteTarget(null); pendingResolve.current?.(false) }}>
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
                onClick={() => { pendingResolve.current?.(true); setDeleteTarget(null) }}>
                Yes
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      <Card className="p-5 space-y-4">

        {/* Project Title */}
        <Field label={t(lang, 'projectTitle')} error={errors.project_title?.message}>
          {installerView ? roBox(watch('project_title')) : (
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
          )}
        </Field>

        {/* Date + Day */}
        <div className="grid grid-cols-2 gap-4">
          <Field label={t(lang, 'date')} error={errors.date?.message}>
            {installerView ? roBox(dateDisplay, true) : (
              <Input
                type="date"
                {...register('date', { required: true })}
                error={!!errors.date}
                disabled={readOnly}
              />
            )}
          </Field>
          <Field label="Day">
            <div className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm font-semibold text-amber-600 text-center">
              {dayLabel}
            </div>
          </Field>
        </div>

        {/* Company */}
        <Field label="Company" error={errors.client?.message}>
          {installerView ? roBox(watch('client')) : (
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
          )}
        </Field>

        {/* Contact Person */}
        <Field label={t(lang, 'clientPOCName')} error={errors.client_poc_name?.message}>
          {installerView ? roBox(watch('client_poc_name')) : (
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
          )}
        </Field>

        {/* Client Phone */}
        <Field label={t(lang, 'clientPOCPhone')} error={errors.client_poc_phone?.message}>
          {installerView ? roBox(watch('client_poc_phone')) : (
            <Input
              type="tel"
              {...register('client_poc_phone')}
              disabled={readOnly}
              error={!!errors.client_poc_phone}
            />
          )}
        </Field>

        {/* Location */}
        <Field label={t(lang, 'locationAddress')} error={errors.location?.message}>
          {installerView ? roBox(watch('location')) : (
            <Input {...register('location', req)} disabled={readOnly} error={!!errors.location} />
          )}
        </Field>

        {/* Description */}
        <Field label={t(lang, 'jobDescription')}>
          {installerView ? (
            <div className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink2 min-h-[4.5rem] leading-relaxed">
              {watch('description') || '—'}
            </div>
          ) : (
            <SuggestField
              value={watch('description')}
              onAccept={s => setValue('description', s, { shouldDirty: true })}
              readOnly={readOnly}
              field="Job Description"
            >
              <textarea {...register('description')} disabled={readOnly} rows={3} className={TEXTAREA} />
            </SuggestField>
          )}
        </Field>

        {/* Times */}
        <div className="grid grid-cols-2 gap-4">
          <Field label={t(lang, 'timeStart')} error={errors.time_start?.message}>
            {installerView ? roBox(watch('time_start') || '—', true) : (
              <Controller
                control={control}
                name="time_start"
                rules={req}
                render={({ field }) => (
                  <TimeSelect value={field.value} onChange={field.onChange} disabled={readOnly} error={!!errors.time_start} />
                )}
              />
            )}
          </Field>
          <Field label={t(lang, 'timeEnd')}>
            {installerView ? roBox(watch('time_end') || '—', true) : (
              <Controller
                control={control}
                name="time_end"
                render={({ field }) => (
                  <TimeSelect value={field.value} onChange={field.onChange} disabled={readOnly} />
                )}
              />
            )}
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
                    disabled={readOnly || installerView}
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

        {/* Production Ready + DO — or DO status button for installer */}
        {installerView ? (
          doIssued ? (
            <div className="flex items-center justify-center gap-2 w-full px-3 py-3 rounded-lg border border-amber-300 bg-amber-50 text-sm font-semibold text-amber-700">
              Please Sign DO Provided
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 w-full px-3 py-3 rounded-lg border border-line bg-bg text-sm text-muted opacity-70">
              No DO Required
            </div>
          )
        ) : (
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
        )}

      </Card>
    </>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: errors in `NewJobShell.tsx` (still passes `salesPocOptions` to CoreSection) and `JobDetailShell.tsx` (old props). These are resolved in Tasks 6 and 7. Note the error count — just verify no new unexpected errors appear beyond those two files.

- [ ] **Step 3: Commit**

```bash
git add src/features/job-detail/CoreSection.tsx
git commit -m "refactor: CoreSection — remove useDropdowns/salesPocOptions, always SearchableSelect; add installerView prop for read-only display + DO status button"
```

---

## Task 5: Update ProductionReadySection

**Files:**
- Modify: `src/features/job-detail/ProductionReadySection.tsx`

Adds `role: Role` prop. Splits the single file upload section into three named sub-sections using existing `FileKind` values from `src/lib/supabase/types.ts`:
- **Production Photos** → `kind: 'production_instructions'`
- **Signed DO (Optional)** → `kind: 'do'`
- **Completion Photos** → `kind: 'completion'`

Upload permissions by section:
- Production Photos: all roles except installer
- Signed DO (Optional): all roles including installer
- Completion Photos: all roles including installer

Production Instructions textarea: read-only div for installer (no `SuggestField`, no textarea).

- [ ] **Step 1: Replace ProductionReadySection.tsx**

```tsx
'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/Card'
import { Btn } from '@/components/Btn'
import { Field } from '@/components/Field'
import { t } from '@/lib/i18n'
import { useToast } from '@/components/Toast'
import { Camera, Download, Image as ImageIcon, FileVideo } from 'lucide-react'
import type { UseFormRegister, UseFormWatch, UseFormSetValue } from 'react-hook-form'
import { SuggestField } from '@/components/SuggestField'
import type { LangCode } from '@/lib/i18n'
import type { JobFile } from '@/lib/supabase/queries/jobs'
import type { FormValues } from './JobDetailShell'
import type { Role } from '@/lib/supabase/types'

const TEXTAREA = 'w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:border-terracotta focus:ring-terracotta/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 resize-none'

const VIDEO_EXT = /\.(mp4|mov|avi|webm|mkv)$/i

interface Props {
  register:  UseFormRegister<FormValues>
  watch?:    UseFormWatch<FormValues>
  setValue?: UseFormSetValue<FormValues>
  readOnly:  boolean
  role:      Role
  lang:      LangCode
  jobId:     string
  userId:    string
  files:     JobFile[]
}

function DownloadButton({ r2Key, lang }: { r2Key: string; lang: LangCode }) {
  const [loading, setLoading] = useState(false)

  const handleDownload = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/r2/download-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: r2Key }),
      })
      const { url } = await res.json() as { url: string }
      window.open(url, '_blank', 'noopener')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Btn variant="ghost" size="sm" onClick={handleDownload} disabled={loading}>
      <Download size={13} />
      {t(lang, 'downloadFile')}
    </Btn>
  )
}

interface UploadSectionProps {
  label:     string
  kind:      'production_instructions' | 'do' | 'completion'
  files:     JobFile[]
  canUpload: boolean
  jobId:     string
  userId:    string
  lang:      LangCode
  accept?:   string
}

function UploadSection({ label, kind, files, canUpload, jobId, userId, lang, accept = 'image/*,video/*' }: UploadSectionProps) {
  const { success: showSuccess, error: showError } = useToast()
  const supabase = createClient()
  const router   = useRouter()
  const fileRef  = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? [])
    if (!selected.length) return
    e.target.value = ''
    setUploading(true)
    try {
      for (const file of selected) {
        const urlRes = await fetch('/api/r2/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId, kind, filename: file.name, contentType: file.type || 'application/octet-stream' }),
        })
        const { url, key } = await urlRes.json() as { url: string; key: string }
        await fetch(url, { method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file })
        await supabase.from('files').insert({
          job_id: jobId, kind, r2_key: key, uploader_id: userId, visibility: ['public-internal'],
        } as never).throwOnError()
      }
      router.refresh()
      showSuccess(t(lang, 'savedSuccessfully'))
    } catch {
      showError(t(lang, 'saveError'))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted mb-2">{label}</p>
      {files.length > 0 && (
        <ul className="divide-y divide-line mb-2">
          {files.map(file => {
            const filename = file.r2_key.split('/').pop() ?? file.r2_key
            const isVideo  = VIDEO_EXT.test(filename)
            return (
              <li key={file.id} className="flex items-center gap-3 py-2.5">
                {isVideo
                  ? <FileVideo size={14} className="text-muted shrink-0" />
                  : <ImageIcon size={14} className="text-muted shrink-0" />
                }
                <p className="flex-1 min-w-0 text-sm text-ink truncate">{filename}</p>
                <DownloadButton r2Key={file.r2_key} lang={lang} />
              </li>
            )
          })}
        </ul>
      )}
      {canUpload && (
        <>
          <input type="file" ref={fileRef} onChange={handleFiles} multiple accept={accept} className="hidden" />
          <Btn variant="secondary" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
            <Camera size={13} />
            {uploading ? t(lang, 'uploading') : t(lang, 'attachFiles')}
          </Btn>
        </>
      )}
      {!canUpload && files.length === 0 && (
        <p className="text-sm text-muted italic">None</p>
      )}
    </div>
  )
}

export function ProductionReadySection({ register, watch, setValue, readOnly, role, lang, jobId, userId, files }: Props) {
  const isInstaller         = role === 'installer'
  const instructionsLocked  = readOnly || isInstaller
  const canUploadProduction = !readOnly && !isInstaller
  const canUploadDo         = !readOnly
  const canUploadCompletion = !readOnly

  const productionPhotos = files.filter(f => f.kind === 'production_instructions')
  const signedDoFiles    = files.filter(f => f.kind === 'do')
  const completionPhotos = files.filter(f => f.kind === 'completion')

  return (
    <Card className="p-5 space-y-5">
      <h3 className="text-sm font-medium text-ink">{t(lang, 'productionReadyInstructions')}</h3>

      {/* Production Instructions */}
      <Field label={t(lang, 'productionInstructions')}>
        {isInstaller ? (
          <div className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink2 min-h-[3rem] leading-relaxed">
            {watch?.('production_instructions') || <span className="italic text-muted">None</span>}
          </div>
        ) : (
          <SuggestField
            value={watch?.('production_instructions') ?? ''}
            onAccept={s => setValue?.('production_instructions', s, { shouldDirty: true })}
            readOnly={instructionsLocked}
            field="Production Instructions"
          >
            <textarea
              {...register('production_instructions')}
              disabled={instructionsLocked}
              rows={2}
              className={TEXTAREA}
            />
          </SuggestField>
        )}
      </Field>

      {/* Production Photos (kind='production_instructions' — existing kind reused for backwards compat) */}
      <UploadSection
        label="Production Photos"
        kind="production_instructions"
        files={productionPhotos}
        canUpload={canUploadProduction}
        jobId={jobId}
        userId={userId}
        lang={lang}
      />

      {/* Signed DO (Optional) */}
      <UploadSection
        label="Signed DO (Optional)"
        kind="do"
        files={signedDoFiles}
        canUpload={canUploadDo}
        jobId={jobId}
        userId={userId}
        lang={lang}
        accept="image/*,.pdf"
      />

      {/* Completion Photos */}
      <UploadSection
        label="Completion Photos"
        kind="completion"
        files={completionPhotos}
        canUpload={canUploadCompletion}
        jobId={jobId}
        userId={userId}
        lang={lang}
      />
    </Card>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: error in `JobDetailShell.tsx` (missing `role` prop on `ProductionReadySection`). That's fixed in Task 7.

- [ ] **Step 3: Commit**

```bash
git add src/features/job-detail/ProductionReadySection.tsx
git commit -m "feat: ProductionReadySection — split into Photos/Signed DO/Completion sub-sections; add role prop; installer read-only instructions"
```

---

## Task 6: Update page.tsx — load salesPocOptions

**Files:**
- Modify: `src/app/jobs/[id]/page.tsx`

Adds a parallel query for sales users and maps them to `SelectOption[]`. Passes result to `JobDetailShell` as `salesPocOptions`.

- [ ] **Step 1: Replace page.tsx**

```tsx
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getJobById, getInstallerUsers, getJobMessages } from '@/lib/supabase/queries/jobs'
import { JobDetailShell } from '@/features/job-detail/JobDetailShell'
import { getEffectiveRole } from '@/lib/utils/role-override'
import type { LangCode } from '@/lib/i18n'
import type { Role } from '@/lib/supabase/types'

export default async function JobDetailPage({
  params,
  searchParams,
}: {
  params:       Promise<{ id: string }>
  searchParams: Promise<{ from?: string }>
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams])
  const backHref = sp.from === 'installer' ? '/installer' : '/schedule'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  type ProfileRow = { id: string; role: Role; lang: string; name: string }
  const { data: profile } = await supabase
    .from('users')
    .select('id, role, lang, name')
    .eq('auth_id', user.id)
    .maybeSingle() as { data: ProfileRow | null; error: unknown }

  if (!profile) redirect('/login')

  const role = await getEffectiveRole(profile.role)

  const [job, installers, messages, salesUsersResult] = await Promise.all([
    getJobById(id),
    role === 'installer' ? Promise.resolve([]) : getInstallerUsers(),
    getJobMessages(id),
    supabase.from('users').select('id, name').eq('role', 'sales').order('name'),
  ])

  if (!job) notFound()

  const salesPocOptions = (salesUsersResult.data ?? []).map((u: { id: string; name: string }) => ({
    id:    u.id,
    label: u.name,
  }))

  return (
    <JobDetailShell
      job={job}
      role={role}
      userId={profile.id}
      userName={profile.name ?? ''}
      lang={(profile.lang as LangCode) ?? 'en'}
      installers={installers}
      initialMessages={messages}
      salesPocOptions={salesPocOptions}
      backHref={backHref}
    />
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/jobs/[id]/page.tsx
git commit -m "feat: page.tsx — load sales users as salesPocOptions, pass to JobDetailShell"
```

---

## Task 7: Rewrite JobDetailShell

**Files:**
- Modify: `src/features/job-detail/JobDetailShell.tsx`

Full layout rewrite. Key changes vs the current file:
- Remove sticky header; replace with non-sticky header section
- Add `salesPocOptions: SelectOption[]` prop
- Track `selectedInstallerIds` in state (initialized from `job.job_assignees`)
- `saveValues` now includes `sales_poc_id`
- `onSubmit` diffs installer selections and applies changes to `job_assignees`
- Remove `AssigneeSection`, `PendingFilesSection`, `StatusSection` from JSX
- New layout: CoreSection → ProductionReadySection (all roles) → Team card → AttachmentBuckets → ChatSection → Notifications placeholder → sticky action bar
- Installer gates throughout: `isInstaller` flag controls title, Team card content, which sections show, action bar buttons

- [ ] **Step 1: Replace JobDetailShell.tsx**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { createClient } from '@/lib/supabase/client'
import { t } from '@/lib/i18n'
import { useToast } from '@/components/Toast'
import { Btn } from '@/components/Btn'
import { Pill } from '@/components/Pill'
import { Card } from '@/components/Card'
import { Field } from '@/components/Field'
import { SearchableSelect, SelectOption } from '@/components/SearchableSelect'
import { SuggestField } from '@/components/SuggestField'
import { CoreSection } from './CoreSection'
import { AttachmentBuckets } from './AttachmentBuckets'
import { ChatSection } from './ChatSection'
import { ProductionReadySection } from './ProductionReadySection'
import { InstallerGrid } from './InstallerGrid'
import { ClashResolutionModal } from '@/features/approvals/ClashResolutionModal'
import { Modal } from '@/components/Modal'
import type { ClashesResponse } from '@/app/api/jobs/[id]/clashes/route'
import type { JobDetail, InstallerUser, JobMessage } from '@/lib/supabase/queries/jobs'
import type { Role, JobStatus, Punctuality } from '@/lib/supabase/types'
import type { LangCode } from '@/lib/i18n'
import { ArrowLeft, Bell, Inbox, Trash2, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils/cn'

export type FormValues = {
  project_title:           string
  date:                    string
  date_end:                string
  time_start:              string
  time_end:                string
  client:                  string
  location:                string
  description:             string
  client_poc_name:         string
  client_poc_phone:        string
  production_ready:        boolean
  do_issued:               boolean
  punctuality:             Punctuality
  production_instructions: string
  notes:                   string
  sales_poc_id:            string
  quote_amount:            string
  supplier_cost:           string
  margin_notes:            string
}

const TEXTAREA = 'w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:border-terracotta focus:ring-terracotta/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 resize-none'

interface Props {
  job:             JobDetail
  role:            Role
  userId:          string
  userName:        string
  lang:            LangCode
  installers:      InstallerUser[]
  initialMessages: JobMessage[]
  salesPocOptions: SelectOption[]
  backHref?:       string
}

export function JobDetailShell({
  job, role, userId, userName, lang, installers, initialMessages, salesPocOptions, backHref = '/schedule',
}: Props) {
  const { success: showSuccess, error: showError } = useToast()
  const router   = useRouter()
  const supabase = createClient()

  const completed = job.status === 'completed'
  const readOnly  = completed

  const initialAssigneeIds = job.job_assignees
    .map(a => a.users?.id)
    .filter(Boolean) as string[]

  const [saving,               setSaving]              = useState(false)
  const [status,               setStatus]              = useState<JobStatus>(job.status)
  const [clashData,            setClashData]           = useState<ClashesResponse | null>(null)
  const [showSuccessModal,     setShowSuccessModal]    = useState(false)
  const [showPushAnywaysModal, setShowPushAnywaysModal]= useState(false)
  const [showDeleteModal,      setShowDeleteModal]     = useState(false)
  const [deleting,             setDeleting]            = useState(false)
  const [selectedInstallerIds, setSelectedInstallerIds]= useState<string[]>(initialAssigneeIds)

  const {
    register, handleSubmit, getValues, setValue, reset, control, watch,
    formState: { isDirty, errors },
  } = useForm<FormValues>({
    defaultValues: {
      project_title:           job.project_title ?? '',
      date:                    job.date ?? '',
      date_end:                job.date_end ?? '',
      time_start:              job.time_start?.slice(0, 5) ?? '',
      time_end:                job.time_end?.slice(0, 5) ?? '',
      client:                  job.client ?? '',
      location:                job.location ?? '',
      description:             job.description ?? '',
      client_poc_name:         job.client_poc_name ?? '',
      client_poc_phone:        job.client_poc_phone ?? '',
      production_ready:        job.production_ready,
      do_issued:               job.do_issued,
      punctuality:             job.punctuality,
      production_instructions: job.production_instructions ?? '',
      notes:                   job.notes ?? '',
      sales_poc_id:            job.sales_poc_id ?? '',
      quote_amount:            job.job_financials?.quote_amount?.toString() ?? '',
      supplier_cost:           job.job_financials?.supplier_cost?.toString() ?? '',
      margin_notes:            job.job_financials?.margin_notes ?? '',
    },
  })

  const saveValues = async (values: FormValues) => {
    await supabase.from('jobs').update({
      project_title:           values.project_title || null,
      date:                    values.date,
      date_end:                values.date_end || null,
      time_start:              values.time_start || null,
      time_end:                values.time_end || null,
      client:                  values.client,
      location:                values.location,
      description:             values.description || null,
      client_poc_name:         values.client_poc_name || null,
      client_poc_phone:        values.client_poc_phone || null,
      production_ready:        values.production_ready,
      do_issued:               values.do_issued,
      punctuality:             values.punctuality,
      production_instructions: values.production_instructions || null,
      notes:                   values.notes || null,
      sales_poc_id:            values.sales_poc_id || null,
    } as never).eq('id', job.id).throwOnError()
    reset(values)
  }

  const saveInstallerDiff = async () => {
    const added   = selectedInstallerIds.filter(id => !initialAssigneeIds.includes(id))
    const removed = initialAssigneeIds.filter(id => !selectedInstallerIds.includes(id))
    for (const id of removed) {
      await supabase.from('job_assignees').delete().eq('job_id', job.id).eq('user_id', id).throwOnError()
    }
    for (const id of added) {
      await supabase.from('job_assignees').insert({ job_id: job.id, user_id: id } as never).throwOnError()
    }
  }

  const onSubmit = async (values: FormValues) => {
    setSaving(true)
    try {
      await Promise.all([saveValues(values), saveInstallerDiff()])
      showSuccess(t(lang, 'savedSuccessfully'))
      router.refresh()
    } catch {
      showError(t(lang, 'saveError'))
    } finally {
      setSaving(false)
    }
  }

  const handleStatusChange = async (newStatus: JobStatus, newDate?: string) => {
    try {
      const patch: Record<string, unknown> = { status: newStatus }
      if (newStatus === 'completed') patch.completed_at = new Date().toISOString()
      if (newDate) patch.date = newDate
      await supabase.from('jobs').update(patch as never).eq('id', job.id).throwOnError()
      setStatus(newStatus)
      if (newDate) setValue('date', newDate)
      showSuccess(t(lang, 'savedSuccessfully'))
    } catch {
      showError(t(lang, 'saveError'))
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/jobs/${job.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      router.push(backHref)
    } catch {
      showError(t(lang, 'saveError'))
      setDeleting(false)
      setShowDeleteModal(false)
    }
  }

  const handleSubmitForApproval = async () => {
    setSaving(true)
    try {
      if (isDirty) await saveValues(getValues())
      const res = await fetch(`/api/jobs/${job.id}/clashes`)
      if (!res.ok) throw new Error()
      const data: ClashesResponse = await res.json()
      if (data.clashes.length === 0 && data.travelWarnings.length === 0) {
        const submitRes = await fetch(`/api/jobs/${job.id}/submit`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
        if (!submitRes.ok) throw new Error()
        setStatus('awaiting_approval')
        setShowSuccessModal(true)
      } else {
        setClashData(data)
      }
    } catch {
      showError(t(lang, 'saveError'))
    } finally {
      setSaving(false)
    }
  }

  const handleSendToScheduler = async (
    replacements: Record<string, string | 'keep'>,
    timeStart: string,
    timeEnd: string,
  ) => {
    try {
      for (const [oldId, newId] of Object.entries(replacements)) {
        if (newId === 'keep') continue
        await supabase.from('job_assignees').delete().eq('job_id', job.id).eq('user_id', oldId)
        await supabase.from('job_assignees').insert({ job_id: job.id, user_id: newId } as never)
      }
      if (timeStart !== (job.time_start ?? '').slice(0, 5) || timeEnd !== (job.time_end ?? '').slice(0, 5)) {
        await supabase.from('jobs').update({ time_start: timeStart || null, time_end: timeEnd || null } as never).eq('id', job.id)
        if (timeStart) setValue('time_start', timeStart)
        if (timeEnd)   setValue('time_end', timeEnd)
      }
      const res = await fetch(`/api/jobs/${job.id}/submit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) throw new Error()
      setStatus('awaiting_approval')
      setClashData(null)
      setShowSuccessModal(true)
    } catch {
      showError(t(lang, 'saveError'))
    }
  }

  const handlePushAnyways = async () => {
    try {
      const res = await fetch(`/api/jobs/${job.id}/submit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) throw new Error()
      setStatus('awaiting_approval')
      setClashData(null)
      setShowPushAnywaysModal(true)
    } catch {
      showError(t(lang, 'saveError'))
    }
  }

  const isInstaller      = role === 'installer'
  const showDelete       = (role === 'sales' && status === 'pending') || role === 'scheduler'
  const showMarkComplete = role === 'scheduler' && status === 'scheduled'

  return (
    <div className="min-h-screen bg-bg pb-28">

      {/* ── Header (non-sticky) ─────────────────────────────────── */}
      <div className="px-4 pt-5 pb-3">
        <Link
          href={backHref}
          className="flex items-center gap-1.5 text-sm text-ink2 hover:text-ink mb-2"
        >
          <ArrowLeft size={14} />
          {isInstaller ? 'Back to Jobs' : 'Schedule'}
        </Link>
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="font-display text-xl font-semibold text-ink">
            {isInstaller ? 'View job' : 'Edit job'}
          </h1>
          <Pill variant={status} />
        </div>
      </div>

      {/* Awaiting-approval banner */}
      {status === 'awaiting_approval' && (
        <div className="mx-4 mb-2 rounded-card border border-terracotta bg-terracotta-soft px-4 py-3 flex gap-3 items-start">
          <div className="w-7 h-7 rounded-full bg-paper flex items-center justify-center shrink-0 mt-0.5">
            <Inbox size={14} className="text-terracotta" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-widest font-medium text-terracotta mb-0.5">
              {t(lang, 'awaitingApproval')}
            </p>
            <p className="text-sm text-ink2">{t(lang, 'awaitingApprovalDetail')}</p>
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 space-y-4">

        {/* ── Core card ───────────────────────────────────────────── */}
        <CoreSection
          register={register}
          errors={errors}
          control={control}
          watch={watch}
          setValue={setValue}
          readOnly={readOnly}
          lang={lang}
          installerView={isInstaller}
        />

        {/* ── Production section (all roles; installer = read-only) ─ */}
        <ProductionReadySection
          register={register}
          watch={watch}
          setValue={setValue}
          readOnly={readOnly || status === 'pending' || status === 'awaiting_approval' || status === 'scheduled'}
          role={role}
          lang={lang}
          jobId={job.id}
          userId={userId}
          files={job.files.filter(f =>
            f.kind === 'production_instructions' || f.kind === 'do' || f.kind === 'completion'
          )}
        />

        {/* ── Team card ───────────────────────────────────────────── */}
        <Card className="overflow-hidden">
          <div className="p-4 space-y-4">

            {/* Main Sales / POC */}
            <Field label="Main Sales / POC">
              {isInstaller ? (
                <div className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink2">
                  {salesPocOptions.find(o => o.id === watch('sales_poc_id'))?.label ?? '—'}
                </div>
              ) : (
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
              )}
            </Field>

            {/* Sales / POC — multi-select (UI placeholder; wiring deferred to next session) */}
            <Field label="Sales / POC">
              {isInstaller ? (
                <div className="flex flex-wrap gap-2">
                  {/* populated when multi-select feature ships */}
                </div>
              ) : (
                <div className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-muted italic cursor-not-allowed">
                  Coming soon — multi-select
                </div>
              )}
            </Field>

            {/* Notes */}
            <Field label={t(lang, 'notes')}>
              {isInstaller ? (
                <div className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink2 min-h-[3rem] leading-relaxed">
                  {watch('notes') || <span className="italic text-muted">No notes</span>}
                </div>
              ) : (
                <SuggestField
                  value={watch('notes')}
                  onAccept={s => setValue('notes', s, { shouldDirty: true })}
                  readOnly={readOnly}
                  field="Notes"
                >
                  <textarea
                    {...register('notes')}
                    disabled={readOnly}
                    rows={2}
                    className={TEXTAREA}
                  />
                </SuggestField>
              )}
            </Field>

          </div>

          {/* Installers sub-section */}
          <div className="border-t border-line px-4 pt-3 pb-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted mb-3">Installers</p>
            {isInstaller ? (
              /* installer sees only their own card (and teammates assigned to this job) */
              <InstallerGrid
                allInstallers={installers.filter(i => initialAssigneeIds.includes(i.id))}
                initialSelectedIds={initialAssigneeIds}
                onChange={() => {}}
              />
            ) : (
              <InstallerGrid
                allInstallers={installers}
                initialSelectedIds={initialAssigneeIds}
                onChange={setSelectedInstallerIds}
              />
            )}
          </div>
        </Card>

        {/* ── Attachments ─────────────────────────────────────────── */}
        <AttachmentBuckets
          jobId={job.id}
          lang={lang}
          readOnly={readOnly || isInstaller}
        />

        {/* ── Chat (unchanged) ────────────────────────────────────── */}
        <ChatSection
          jobId={job.id}
          userId={userId}
          userName={userName}
          lang={lang}
          completedAt={job.completed_at}
          initialMessages={initialMessages}
          chatFiles={job.files.filter(f => f.kind === 'attachment')}
          preScheduleLocked={status === 'pending' || status === 'awaiting_approval'}
        />

        {/* ── Notifications placeholder (non-installer only) ────────  */}
        {!isInstaller && (
          <Card className="overflow-hidden">
            <div className="px-4 py-3 border-b border-line flex items-center gap-2">
              <Bell size={12} className="text-muted" />
              <span className="text-[10px] font-semibold tracking-widest uppercase text-muted">
                Notifications
              </span>
            </div>
            <div className="px-4 py-5 flex flex-col items-center gap-2 text-center">
              <Bell size={20} className="text-line" />
              <p className="text-sm font-medium text-ink2">Coming soon</p>
              <p className="text-xs text-muted">Telegram notification tracker</p>
            </div>
          </Card>
        )}

      </div>

      {/* ── Action bar (sticky bottom) ───────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 bg-paper border-t border-line px-4 py-3 z-10">
        <div className="max-w-2xl mx-auto space-y-2">
          {isInstaller ? (
            <button
              type="button"
              onClick={() => router.back()}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-[10px] bg-terracotta text-white text-sm font-semibold"
            >
              <ArrowLeft size={14} />
              Back to Jobs
            </button>
          ) : (
            <>
              <div className="flex gap-2">
                {showDelete && (
                  <button
                    type="button"
                    onClick={() => setShowDeleteModal(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] border border-line bg-paper text-xs font-medium text-ink2 hover:text-terracotta hover:border-terracotta transition-colors"
                  >
                    <Trash2 size={12} />
                    Delete
                  </button>
                )}
                {showMarkComplete && (
                  <button
                    type="button"
                    onClick={() => handleStatusChange('completed')}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-[10px] border border-line bg-paper text-xs font-medium text-ink2 hover:bg-bg transition-colors"
                  >
                    <CheckCircle size={12} />
                    Mark job complete
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => router.back()}
                  className={cn(
                    'flex items-center justify-center px-3 py-2 rounded-[10px] border border-line bg-paper text-xs font-medium text-ink2 hover:bg-bg transition-colors',
                    !showDelete && !showMarkComplete && 'flex-1',
                  )}
                >
                  Cancel
                </button>
              </div>
              {!readOnly && (
                <button
                  type="button"
                  onClick={handleSubmit(onSubmit)}
                  disabled={saving || !isDirty}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-[10px] bg-terracotta text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Bell size={14} />
                  {saving ? t(lang, 'loading') : 'Save & notify'}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Modals ──────────────────────────────────────────────── */}
      {clashData && (
        <ClashResolutionModal
          jobDate={clashData.jobDate}
          jobTimeStart={clashData.jobTimeStart}
          jobTimeEnd={clashData.jobTimeEnd}
          clashes={clashData.clashes}
          travelWarnings={clashData.travelWarnings}
          substitutes={clashData.substitutes}
          weekDays={clashData.weekDays}
          lang={lang}
          onSendToScheduler={handleSendToScheduler}
          onCancel={() => setClashData(null)}
        />
      )}

      <Modal isOpen={showSuccessModal} onClose={() => { setShowSuccessModal(false); router.push('/schedule') }}>
        <div className="space-y-4 text-center">
          <p className="font-display text-lg font-medium text-ink">Pushed for Approval!</p>
          <Btn variant="primary" size="sm" onClick={() => { setShowSuccessModal(false); router.push('/schedule') }}>
            OK
          </Btn>
        </div>
      </Modal>

      <Modal isOpen={showPushAnywaysModal} onClose={() => { setShowPushAnywaysModal(false); router.push('/schedule') }}>
        <div className="space-y-4 text-center">
          <p className="font-display text-lg font-medium text-ink">Pushed for Approval!</p>
          <p className="text-sm text-muted">Please check with the Scheduler for approval directly.</p>
          <Btn variant="primary" size="sm" onClick={() => { setShowPushAnywaysModal(false); router.push('/schedule') }}>
            OK
          </Btn>
        </div>
      </Modal>

      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)}>
        <div className="space-y-4">
          <h2 className="font-display text-lg font-medium text-ink">
            {t(lang, 'deleteJobConfirmTitle')}
          </h2>
          <p className="text-sm text-muted">{t(lang, 'deleteJobConfirmBody')}</p>
          <div className="flex gap-2 justify-end pt-1">
            <Btn variant="secondary" size="sm" onClick={() => setShowDeleteModal(false)} disabled={deleting}>
              {t(lang, 'cancel')}
            </Btn>
            <Btn variant="primary" size="sm" onClick={handleDelete} disabled={deleting}>
              {deleting ? t(lang, 'loading') : t(lang, 'deleteJob')}
            </Btn>
          </div>
        </div>
      </Modal>

    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: error in `NewJobShell.tsx` still passing `salesPocOptions` to CoreSection. Fix in next step.

- [ ] **Step 3: Commit**

```bash
git add src/features/job-detail/JobDetailShell.tsx
git commit -m "feat: JobDetailShell redesign — new header, Team card with InstallerGrid, sticky action bar, installer view"
```

---

## Task 8: Fix NewJobShell — restore fields removed from CoreSection

**Files:**
- Modify: `src/features/job-detail/NewJobShell.tsx`

`CoreSection` no longer renders Sales/POC, Notes, or Production Instructions. These need to be added directly in `NewJobShell` between `CoreSection` and the Installers card. Also remove the now-invalid `salesPocOptions` prop from the `<CoreSection>` call.

- [ ] **Step 1: Remove salesPocOptions from CoreSection call**

In `NewJobShell.tsx`, find the `<CoreSection>` JSX block and remove the `salesPocOptions={salesPocOptions}` prop:

```tsx
// Before
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
        />

// After
        <CoreSection
          register={register}
          errors={errors}
          control={control}
          watch={watch}
          setValue={setValue}
          readOnly={false}
          lang={lang}
          validateRequired
        />
```

- [ ] **Step 2: Add Sales/POC, Notes, Production Instructions fields after CoreSection**

Add a new card block between `{/* Core fields */}` and `{/* Installers */}` in NewJobShell's JSX. You'll need to add these imports at the top of NewJobShell if not already present: `Field` from `@/components/Field`, `SuggestField` from `@/components/SuggestField`, `Controller` from `react-hook-form`, `SearchableSelect` from `@/components/SearchableSelect`.

The `salesPocOptions` prop and `userId` are already available in `NewJobShell`. Insert this card after the `<CoreSection>` block:

```tsx
        {/* Team fields — Sales/POC, Notes, Production Instructions */}
        <Card className="p-5 space-y-4">
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
                  disabled={false}
                />
              )}
            />
          </Field>
          <Field label="Notes">
            <SuggestField
              value={watch('notes')}
              onAccept={s => setValue('notes', s, { shouldDirty: true })}
              field="Notes"
            >
              <textarea
                {...register('notes')}
                rows={2}
                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:border-terracotta focus:ring-terracotta/20 transition-colors duration-150 resize-none"
              />
            </SuggestField>
          </Field>
          <Field label="Production Instructions">
            <SuggestField
              value={watch('production_instructions')}
              onAccept={s => setValue('production_instructions', s, { shouldDirty: true })}
              field="Production Instructions"
            >
              <textarea
                {...register('production_instructions')}
                rows={2}
                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:border-terracotta focus:ring-terracotta/20 transition-colors duration-150 resize-none"
              />
            </SuggestField>
          </Field>
        </Card>
```

- [ ] **Step 3: Type-check — expect clean**

```bash
npx tsc --noEmit
```
Expected: **no errors**.

- [ ] **Step 4: Commit**

```bash
git add src/features/job-detail/NewJobShell.tsx
git commit -m "fix: NewJobShell — remove salesPocOptions from CoreSection, add Sales/POC + Notes + Production Instructions fields"
```

---

## Task 9: Delete AssigneeSection, push to dev, verify

**Files:**
- Delete: `src/features/job-detail/AssigneeSection.tsx`

Confirmed in the codebase: `AssigneeSection` is only imported in `JobDetailShell.tsx`. That import was already removed in Task 7.

- [ ] **Step 1: Delete the file**

```bash
rm src/features/job-detail/AssigneeSection.tsx
```

- [ ] **Step 2: Type-check — expect clean**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: delete AssigneeSection — replaced by InstallerGrid in Team card"
```

- [ ] **Step 4: Push to dev**

```bash
git push origin dev
```

- [ ] **Step 5: Verify Vercel preview — scheduler view**

Open the Vercel preview URL for the dev branch. Sign in as scheduler and open any job.

Check:
1. Header is non-sticky — scrolls with the page; shows "Edit job" + status pill + "← Schedule" back link
2. Core card: SearchableSelect for Company and Contact, Day chip (not Date End), no Sales/POC or Notes fields in this card
3. Production section visible with Production Instructions textarea, Production Photos / Signed DO / Completion Photos sub-sections
4. Team card: "Main Sales / POC" dropdown, "Coming soon" placeholder for multi-select, Notes textarea, InstallerGrid 2-col grid with check badges showing on pre-assigned installers
5. Attachments, Chat, Notifications placeholder all present
6. Sticky action bar at bottom: Delete (if pending/scheduler) + Mark job complete (if scheduled) + Cancel in row 1; "Save & notify" full-width terracotta in row 2
7. Changing an installer selection and hitting "Save & notify" correctly diffs and saves to `job_assignees`

- [ ] **Step 6: Verify Vercel preview — installer view**

Sign in as (or impersonate) an installer role and open the same job.

Check:
1. Header shows "View job" + "← Back to Jobs" link
2. Core card: all fields shown as plain read-only divs; date and times are bold; no checkboxes — just the DO status button (amber if `do_issued=true`, grey if false)
3. Production section: instructions show as read-only div; no Suggest button; Production Photos view-only (no upload); Signed DO and Completion Photos have upload buttons
4. Team card: Main Sales/POC = plain text; Sales/POC = empty inline chip area; Notes = read-only div; InstallerGrid shows only assigned installers
5. Attachments: no add buttons; files are clickable links
6. Chat: editable
7. No Notifications card
8. Action bar: single full-width terracotta "← Back to Jobs" button
