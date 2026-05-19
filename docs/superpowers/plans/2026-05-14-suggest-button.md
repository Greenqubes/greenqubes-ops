# AI Suggest Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "✦ Suggest" button to four job form text fields that sends the field's content to Claude and shows an Accept/Dismiss preview of the improved text.

**Architecture:** A new `SuggestField` wrapper component manages button visibility, loading state, and the preview popover. A new `/api/ai/suggest` route handles the Claude call (non-streaming, Haiku model). CoreSection and ProductionReadySection each receive `watch` and `setValue` from their parent shell so `SuggestField` can read and update field values.

**Tech Stack:** Next.js API routes, Anthropic SDK, React Hook Form (`watch` + `setValue`), Tailwind CSS

---

## File Map

| Action | File | Purpose |
|---|---|---|
| Create | `src/app/api/ai/suggest/route.ts` | API route — receives text, returns Claude suggestion |
| Create | `src/components/SuggestField.tsx` | Wrapper component — button, loading, preview popover |
| Modify | `src/features/job-detail/CoreSection.tsx` | Add `watch` + `setValue` props; wrap 3 fields |
| Modify | `src/features/job-detail/ProductionReadySection.tsx` | Add optional `watch` + `setValue` props; wrap 1 field |
| Modify | `src/features/job-detail/JobDetailShell.tsx` | Pass `watch` + `setValue` to both sections |
| Modify | `src/features/job-detail/NewJobShell.tsx` | Add `watch` + `setValue` to useForm; pass to CoreSection |

---

## Task 1: API route

**Files:**
- Create: `src/app/api/ai/suggest/route.ts`

- [ ] **Step 1: Create the route file**

```ts
import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { logApiUsage } from '@/lib/supabase/queries/admin'

// ── Edit this one object to change how Claude polishes text ───────────────────
const SUGGEST_CONFIG = {
  model: 'claude-haiku-4-5-20251001',
  style: 'Fix grammar and clarity. Keep the original meaning and tone. Return only the improved text — no commentary, no explanation, no markdown.',
  // future: enableRag: false
} as const
// ─────────────────────────────────────────────────────────────────────────────

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .maybeSingle()
  if (!profile) return new Response('Not provisioned', { status: 403 })

  const body = await req.json() as { field?: string; value?: string }
  const { field, value } = body
  if (!value?.trim()) return Response.json({ error: 'No text provided' }, { status: 400 })

  const ip        = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? undefined
  const userAgent = req.headers.get('user-agent') ?? undefined

  const message = await anthropic.messages.create({
    model:      SUGGEST_CONFIG.model,
    max_tokens: 512,
    system:     SUGGEST_CONFIG.style,
    messages: [{
      role:    'user',
      content: field
        ? `This is the "${field}" field. Text to improve:\n\n${value}`
        : `Text to improve:\n\n${value}`,
    }],
  })

  const suggestion = message.content
    .filter(b => b.type === 'text')
    .map(b => (b as { type: 'text'; text: string }).text)
    .join('')
    .trim()

  const tokensIn  = message.usage.input_tokens
  const tokensOut = message.usage.output_tokens
  // Haiku 4.5 pricing: ~$0.80 / 1M input, ~$4 / 1M output
  const cost = (tokensIn / 1_000_000) * 0.80 + (tokensOut / 1_000_000) * 4

  void logApiUsage({
    service:        'anthropic',
    endpoint:       'ai/suggest',
    called_by:      profile.id,
    tokens_in:      tokensIn,
    tokens_out:     tokensOut,
    estimated_cost: cost,
    ip_address:     ip,
    user_agent:     userAgent,
  })

  return Response.json({ suggestion })
}
```

- [ ] **Step 2: Verify typecheck passes**

```bash
cd "/Users/Nic/Desktop/Greenqubes AI/greenqubes-ops" && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/ai/suggest/route.ts
git commit -m "feat: add /api/ai/suggest route"
```

---

## Task 2: SuggestField component

**Files:**
- Create: `src/components/SuggestField.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client'

import { useState, ReactNode } from 'react'

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

  const handleSuggest = async () => {
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
              onClick={handleSuggest}
              className="text-xs font-medium text-terracotta hover:bg-terracotta/10 px-2 py-0.5 rounded transition-colors"
            >
              ✦ Suggest
            </button>
          )}
          {loading && (
            <span className="text-xs text-muted">loading…</span>
          )}
        </div>
      )}
      {children}
      {suggestion && (
        <div className="mt-2 rounded-lg border border-line bg-bg px-3 py-2.5">
          <p className="text-xs text-muted mb-1.5">✦ Suggested improvement</p>
          <p className="text-sm text-ink">{suggestion}</p>
          <div className="flex gap-2 mt-2.5">
            <button
              type="button"
              onClick={() => { onAccept(suggestion); setSuggestion(null) }}
              className="text-xs font-medium px-3 py-1.5 rounded-md bg-terracotta text-white"
            >
              Accept
            </button>
            <button
              type="button"
              onClick={() => setSuggestion(null)}
              className="text-xs font-medium px-3 py-1.5 rounded-md border border-line text-ink2"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify typecheck passes**

```bash
cd "/Users/Nic/Desktop/Greenqubes AI/greenqubes-ops" && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/SuggestField.tsx
git commit -m "feat: add SuggestField component"
```

---

## Task 3: Update CoreSection

**Files:**
- Modify: `src/features/job-detail/CoreSection.tsx`

CoreSection needs two new props — `watch` (to read current field values) and `setValue` (to write the accepted suggestion back into the form).

- [ ] **Step 1: Update the Props interface and imports**

Replace the existing import line and interface at the top of `CoreSection.tsx`:

Old imports (lines 1–11):
```tsx
'use client'

import { UseFormRegister, FieldErrors, Control, Controller } from 'react-hook-form'
import { Card } from '@/components/Card'
import { Field } from '@/components/Field'
import { Input } from '@/components/Input'
import { TimeSelect } from './TimeSelect'
import { t } from '@/lib/i18n'
import { cn } from '@/lib/utils/cn'
import type { LangCode } from '@/lib/i18n'
import type { FormValues } from './JobDetailShell'
```

New imports:
```tsx
'use client'

import { UseFormRegister, FieldErrors, Control, Controller, UseFormWatch, UseFormSetValue } from 'react-hook-form'
import { Card } from '@/components/Card'
import { Field } from '@/components/Field'
import { Input } from '@/components/Input'
import { SuggestField } from '@/components/SuggestField'
import { TimeSelect } from './TimeSelect'
import { t } from '@/lib/i18n'
import { cn } from '@/lib/utils/cn'
import type { LangCode } from '@/lib/i18n'
import type { FormValues } from './JobDetailShell'
```

Old Props interface (lines 13–21):
```tsx
interface Props {
  register:    UseFormRegister<FormValues>
  errors:      FieldErrors<FormValues>
  control:     Control<FormValues>
  readOnly:    boolean
  lang:        LangCode
  /** When true every field except Notes & Punctuality is required */
  validateRequired?: boolean
}
```

New Props interface:
```tsx
interface Props {
  register:         UseFormRegister<FormValues>
  errors:           FieldErrors<FormValues>
  control:          Control<FormValues>
  watch:            UseFormWatch<FormValues>
  setValue:         UseFormSetValue<FormValues>
  readOnly:         boolean
  lang:             LangCode
  validateRequired?: boolean
}
```

- [ ] **Step 2: Destructure the new props in the function signature**

Old signature:
```tsx
export function CoreSection({ register, errors, control, readOnly, lang, validateRequired = false }: Props) {
```

New signature:
```tsx
export function CoreSection({ register, errors, control, watch, setValue, readOnly, lang, validateRequired = false }: Props) {
```

- [ ] **Step 3: Wrap Project Title with SuggestField**

Old Project Title block (lines 31–39):
```tsx
      {/* Project Title */}
      <Field label={t(lang, 'projectTitle')} error={errors.project_title?.message}>
        <Input
          {...register('project_title', req)}
          placeholder="e.g. Vivienne Westwood Installation"
          disabled={readOnly}
          error={!!errors.project_title}
        />
      </Field>
```

New:
```tsx
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
```

- [ ] **Step 4: Wrap Job Description with SuggestField**

Old Description block (lines 129–137):
```tsx
      {/* Description */}
      <Field label={t(lang, 'jobDescription')}>
        <textarea
          {...register('description')}
          disabled={readOnly}
          rows={3}
          className={TEXTAREA}
        />
      </Field>
```

New:
```tsx
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
```

- [ ] **Step 5: Wrap Notes with SuggestField**

Old Notes block (lines 139–141):
```tsx
      {/* Notes — always optional */}
      <Field label={t(lang, 'notes')}>
        <textarea {...register('notes')} disabled={readOnly} rows={2} className={TEXTAREA} />
      </Field>
```

New:
```tsx
      {/* Notes — always optional */}
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
```

- [ ] **Step 6: Verify typecheck passes**

```bash
cd "/Users/Nic/Desktop/Greenqubes AI/greenqubes-ops" && npx tsc --noEmit 2>&1 | head -30
```

Expected: errors about missing `watch`/`setValue` props in the callers — that's fine, we fix them in Tasks 5 and 6.

- [ ] **Step 7: Commit**

```bash
git add src/features/job-detail/CoreSection.tsx
git commit -m "feat: add SuggestField to CoreSection fields"
```

---

## Task 4: Update ProductionReadySection

**Files:**
- Modify: `src/features/job-detail/ProductionReadySection.tsx`

`watch` and `setValue` are optional here because `ProductionReadySection` is rendered as `readOnly` in NewJobShell (new job form), where the production instructions section is locked.

- [ ] **Step 1: Update imports and Props interface**

Add to imports at top of `ProductionReadySection.tsx`:
```tsx
import { UseFormWatch, UseFormSetValue } from 'react-hook-form'
import { SuggestField } from '@/components/SuggestField'
```

(Keep all existing imports — add these two.)

Old Props interface:
```tsx
interface Props {
  register: UseFormRegister<FormValues>
  readOnly: boolean
  lang:     LangCode
  jobId:    string
  userId:   string
  files:    JobFile[]
}
```

New Props interface:
```tsx
interface Props {
  register:  UseFormRegister<FormValues>
  watch?:    UseFormWatch<FormValues>
  setValue?: UseFormSetValue<FormValues>
  readOnly:  boolean
  lang:      LangCode
  jobId:     string
  userId:    string
  files:     JobFile[]
}
```

- [ ] **Step 2: Destructure new props**

Old function signature:
```tsx
export function ProductionReadySection({ register, readOnly, lang, jobId, userId, files }: Props) {
```

New:
```tsx
export function ProductionReadySection({ register, watch, setValue, readOnly, lang, jobId, userId, files }: Props) {
```

- [ ] **Step 3: Wrap Production Instructions with SuggestField**

Old Production Instructions block (lines 111–118):
```tsx
      {/* Instructions comment */}
      <Field label={t(lang, 'productionInstructions')}>
        <textarea
          {...register('production_instructions')}
          disabled={readOnly}
          rows={2}
          className={TEXTAREA}
        />
      </Field>
```

New:
```tsx
      {/* Instructions comment */}
      <Field label={t(lang, 'productionInstructions')}>
        <SuggestField
          value={watch?.('production_instructions') ?? ''}
          onAccept={s => setValue?.('production_instructions', s, { shouldDirty: true })}
          readOnly={readOnly}
          field="Production Instructions"
        >
          <textarea
            {...register('production_instructions')}
            disabled={readOnly}
            rows={2}
            className={TEXTAREA}
          />
        </SuggestField>
      </Field>
```

- [ ] **Step 4: Verify typecheck passes**

```bash
cd "/Users/Nic/Desktop/Greenqubes AI/greenqubes-ops" && npx tsc --noEmit 2>&1 | head -30
```

Expected: errors about missing `watch`/`setValue` in callers — that's fine.

- [ ] **Step 5: Commit**

```bash
git add src/features/job-detail/ProductionReadySection.tsx
git commit -m "feat: add SuggestField to ProductionReadySection"
```

---

## Task 5: Wire up JobDetailShell

**Files:**
- Modify: `src/features/job-detail/JobDetailShell.tsx`

`watch` and `setValue` are already destructured from `useForm` in JobDetailShell. We just need to pass them down.

- [ ] **Step 1: Pass watch + setValue to CoreSection**

In `JobDetailShell.tsx` at line 206. Replace:

```tsx
        <CoreSection
          register={register}
          errors={errors}
          control={control}
          readOnly={readOnly}
          lang={lang}
        />
```

With:
```tsx
        <CoreSection
          register={register}
          errors={errors}
          control={control}
          watch={watch}
          setValue={setValue}
          readOnly={readOnly}
          lang={lang}
        />
```

- [ ] **Step 2: Pass watch + setValue to ProductionReadySection**

In `JobDetailShell.tsx` at line 215. Replace:

```tsx
          <ProductionReadySection
            register={register}
            readOnly={readOnly || status === 'pending' || status === 'awaiting_approval' || status === 'scheduled'}
            lang={lang}
            jobId={job.id}
            userId={userId}
            files={job.files.filter(f => f.kind === 'production_instructions')}
          />
```

With:
```tsx
          <ProductionReadySection
            register={register}
            watch={watch}
            setValue={setValue}
            readOnly={readOnly || status === 'pending' || status === 'awaiting_approval' || status === 'scheduled'}
            lang={lang}
            jobId={job.id}
            userId={userId}
            files={job.files.filter(f => f.kind === 'production_instructions')}
          />
```

- [ ] **Step 3: Verify typecheck passes cleanly**

```bash
cd "/Users/Nic/Desktop/Greenqubes AI/greenqubes-ops" && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors (or only the NewJobShell error from Task 6).

- [ ] **Step 4: Commit**

```bash
git add src/features/job-detail/JobDetailShell.tsx
git commit -m "feat: pass watch+setValue to CoreSection and ProductionReadySection"
```

---

## Task 6: Wire up NewJobShell

**Files:**
- Modify: `src/features/job-detail/NewJobShell.tsx`

NewJobShell needs `watch` and `setValue` added to the `useForm` destructure, then passed to CoreSection. ProductionReadySection is `readOnly` in this shell so no changes needed there.

- [ ] **Step 1: Add watch + setValue to useForm destructure**

Old:
```tsx
const { register, handleSubmit, control, formState: { errors } } = useForm<FormValues>({
```

New:
```tsx
const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm<FormValues>({
```

- [ ] **Step 2: Pass watch + setValue to CoreSection**

Old:
```tsx
<CoreSection
  register={register}
  errors={errors}
  control={control}
  readOnly={false}
  lang={lang}
  validateRequired
/>
```

New:
```tsx
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

- [ ] **Step 3: Verify typecheck passes cleanly**

```bash
cd "/Users/Nic/Desktop/Greenqubes AI/greenqubes-ops" && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/job-detail/NewJobShell.tsx
git commit -m "feat: wire suggest button in NewJobShell"
```

---

## Task 7: Manual verification

- [ ] **Step 1: Run the dev server**

```bash
cd "/Users/Nic/Desktop/Greenqubes AI/greenqubes-ops" && npm run dev
```

- [ ] **Step 2: Test on an existing job**

Open any job in edit mode (sales or scheduler role). Confirm:
- No "✦ Suggest" button appears on empty fields
- Typing text into Project Title → "✦ Suggest" button appears above the field
- Clicking it → button changes to "loading…"
- After a moment → preview box appears below the field with suggested text + Accept + Dismiss
- Accept → field content updates, preview box closes
- Dismiss → preview box closes, field unchanged

- [ ] **Step 3: Test on the new job form**

Go to /schedule → New Job. Confirm same behaviour on Project Title, Description, Notes.
Confirm Production Instructions section shows no Suggest button (it's locked on the new job form).

- [ ] **Step 4: Test on a completed job**

Open any completed job. Confirm no Suggest buttons appear anywhere (all fields are readOnly).

- [ ] **Step 5: Push to dev**

```bash
git push origin dev
```

Check Vercel preview URL to confirm it builds and works on mobile.
