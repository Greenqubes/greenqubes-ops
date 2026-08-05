# Job Form Tabs + Two-Column Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganise the New job and Edit job pages into four tabs on phone (Details / Team / Files / Chat) and a two-column layout on PC (Details+Team left, Files+Chat right), with PC cards collapsible (except Chat) — per `docs/superpowers/specs/2026-08-05-job-form-tabs-design.md`.

**Architecture:** A new `JobFormLayout` client component owns the responsive shell: a sticky tab bar below `lg` (1024px) and two flex columns at `lg`+. All four section groups stay **mounted at all times** — tabs show/hide with CSS only, so form state, chat realtime, and uploads survive tab switches and breakpoint changes. A new `CollapseCard` wrapper (backed by a shared `useCardCollapse` hook) provides the PC-only collapse behaviour with per-device localStorage persistence. Existing section components are reused; three of them gain a `bare` prop so the wrapper can own the card frame.

**Tech Stack:** Next.js 15 App Router, React 19 client components, react-hook-form (existing form), Tailwind (design tokens in globals.css), lucide-react icons. No new dependencies.

## Global Constraints

- **No DB or API changes. No migrations.** The only server-side edit is a URL query-string suffix in the chat notification route.
- **No new Bengali translations** (boss decision 2026-08-03): new i18n keys go to `en.ts` + `zh.ts` only; `bn` falls back to English automatically.
- **localStorage must be read after mount only** (inside `useEffect`), never during render — hydration error #418 history on /schedule makes this non-negotiable.
- **Roles/permissions logic must not change.** Every `readOnly` / `canAssign` / `isInstaller` conditional keeps its current meaning; this is a re-layout only.
- **Verification gates:** this repo has no component-test infra; the gates are `npm run type-check` and `npm run build` (project convention), plus Nic's smoke test on the Vercel preview after deploy.
- **All commits go to the `dev` branch.** Never push without asking Nic first.
- **TypeScript strict** — no `any`, no `@ts-ignore`.
- i18n strings live in `src/lib/i18n/{en,zh}.ts` — never hardcode NEW user-facing copy in components (existing hardcoded strings in touched files stay as they are).

---

### Task 1: `useCardCollapse` hook + `CollapseCard` component

**Files:**
- Create: `src/features/job-detail/useCardCollapse.ts`
- Create: `src/features/job-detail/CollapseCard.tsx`

**Interfaces:**
- Consumes: `Card` from `@/components/Card`, `cn` from `@/lib/utils/cn`.
- Produces: `useCardCollapse(storageKey: string): { open: boolean; toggle: () => void }` and `CollapseCard` with props `{ title: string; storageKey: string; collapsible?: boolean; bodyClassName?: string; children: React.ReactNode }`. Tasks 4–6 rely on these exact names.

- [ ] **Step 1: Write the hook**

```tsx
// src/features/job-detail/useCardCollapse.ts
'use client'

import { useCallback, useEffect, useState } from 'react'

// Collapse state for a job-form card, remembered per device. Collapse is a
// PC-only affordance — callers hide the toggle and the collapsed state below
// lg. localStorage is read after mount only, never during render (the
// /schedule hydration #418 rule).
export function useCardCollapse(storageKey: string) {
  const [open, setOpen] = useState(true)

  useEffect(() => {
    try {
      if (localStorage.getItem(storageKey) === 'closed') setOpen(false)
    } catch { /* storage unavailable (private mode) — stay open */ }
  }, [storageKey])

  const toggle = useCallback(() => {
    setOpen(prev => {
      try { localStorage.setItem(storageKey, prev ? 'closed' : 'open') } catch { /* ignore */ }
      return !prev
    })
  }, [storageKey])

  return { open, toggle }
}
```

- [ ] **Step 2: Write the card wrapper**

```tsx
// src/features/job-detail/CollapseCard.tsx
'use client'

import { ChevronDown } from 'lucide-react'
import { Card } from '@/components/Card'
import { cn } from '@/lib/utils/cn'
import { useCardCollapse } from './useCardCollapse'

interface Props {
  title:          string
  storageKey:     string
  collapsible?:   boolean   // default true; chevron + fold apply on lg+ only
  bodyClassName?: string    // default 'p-4'; pass 'p-0' when children bring their own padding
  children:       React.ReactNode
}

export function CollapseCard({
  title, storageKey, collapsible = true, bodyClassName = 'p-4', children,
}: Props) {
  const { open, toggle } = useCardCollapse(storageKey)

  return (
    <Card className="overflow-hidden">
      <div className={cn(
        'px-4 py-3 border-b border-line flex items-center justify-between',
        !open && 'lg:border-b-0',
      )}>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">
          {title}
        </span>
        {collapsible && (
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            className="hidden lg:flex items-center justify-center w-6 h-6 rounded text-muted hover:text-ink transition-colors"
          >
            <ChevronDown size={14} className={cn('transition-transform', !open && '-rotate-90')} />
          </button>
        )}
      </div>
      {/* Below lg the card is always expanded — collapse is PC-only */}
      <div className={cn(bodyClassName, !open && 'lg:hidden')}>{children}</div>
    </Card>
  )
}
```

- [ ] **Step 3: Type-check**

Run: `npm run type-check`
Expected: PASS (new files compile; nothing imports them yet)

- [ ] **Step 4: Commit**

```bash
git add src/features/job-detail/useCardCollapse.ts src/features/job-detail/CollapseCard.tsx
git commit -m "feat: CollapseCard + useCardCollapse for job form cards (PC-only collapse, per-device memory)"
```

---

### Task 2: `JobFormLayout` responsive shell + tab-label i18n keys

**Files:**
- Create: `src/features/job-detail/JobFormLayout.tsx`
- Modify: `src/lib/i18n/en.ts` (add 4 keys near the "Job form" section, `en.ts:29`)
- Modify: `src/lib/i18n/zh.ts` (same 4 keys)

**Interfaces:**
- Consumes: `t`, `LangCode` from `@/lib/i18n`; `cn`; `Lock` from lucide-react.
- Produces: `JobFormLayout` with props `{ lang: LangCode; initialTab?: JobTab; lockedTabs?: JobTab[]; details: React.ReactNode; team: React.ReactNode; files: React.ReactNode; chat: React.ReactNode }` and exported type `JobTab = 'details' | 'team' | 'files' | 'chat'`. Tasks 4 and 6 rely on these exact names.

- [ ] **Step 1: Add i18n keys**

In `src/lib/i18n/en.ts`, inside the `// ── Job form ──` section (after the `editJob` key), add:

```ts
  tabDetails: 'Details',
  tabTeam: 'Team',
  tabFiles: 'Files',
  tabChat: 'Chat',
```

In `src/lib/i18n/zh.ts` (same relative spot — key order is not significant, keep it near other job-form keys), add:

```ts
  tabDetails: '详情',
  tabTeam: '团队',
  tabFiles: '文件',
  tabChat: '聊天',
```

Do NOT touch `bn.ts` — it is `Partial<Translations>` and falls back to English.

- [ ] **Step 2: Write the layout component**

```tsx
// src/features/job-detail/JobFormLayout.tsx
'use client'

import { useState } from 'react'
import { Lock } from 'lucide-react'
import { t } from '@/lib/i18n'
import { cn } from '@/lib/utils/cn'
import type { LangCode } from '@/lib/i18n'

export type JobTab = 'details' | 'team' | 'files' | 'chat'

const TABS: JobTab[] = ['details', 'team', 'files', 'chat']
const TAB_LABEL_KEY = {
  details: 'tabDetails',
  team:    'tabTeam',
  files:   'tabFiles',
  chat:    'tabChat',
} as const

interface Props {
  lang:        LangCode
  initialTab?: JobTab     // e.g. 'chat' from the ?tab=chat deep link
  lockedTabs?: JobTab[]   // New job pre-save: ['files', 'chat']
  details:     React.ReactNode
  team:        React.ReactNode
  files:       React.ReactNode
  chat:        React.ReactNode
}

// The responsive job-form shell. Below lg: a sticky tab bar shows one group
// at a time. At lg+: no tabs — two columns (Details+Team | Files+Chat).
// Every group stays mounted at all times; tabs only toggle CSS visibility,
// so form state, chat realtime, and uploads survive tab switches.
export function JobFormLayout({
  lang, initialTab = 'details', lockedTabs = [], details, team, files, chat,
}: Props) {
  const [active, setActive] = useState<JobTab>(
    lockedTabs.includes(initialTab) ? 'details' : initialTab,
  )

  const groupCn = (tab: JobTab) => cn(tab !== active && 'hidden', 'lg:block')

  return (
    <>
      {/* Tab bar — phone/narrow only; sticks below the CompanyBar (45px) */}
      <div className="lg:hidden sticky top-[45px] z-20 bg-bg border-b border-line flex">
        {TABS.map(tab => {
          const locked = lockedTabs.includes(tab)
          return (
            <button
              key={tab}
              type="button"
              disabled={locked}
              onClick={() => setActive(tab)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                active === tab
                  ? 'border-terracotta text-terracotta'
                  : 'border-transparent text-ink2',
                locked && 'text-muted opacity-50 cursor-not-allowed',
              )}
            >
              {locked && <Lock size={11} />}
              {t(lang, TAB_LABEL_KEY[tab])}
            </button>
          )
        })}
      </div>

      {/* Content — single column with tabs on phone, two columns at lg+.
          flex + gap (not space-y) so hidden groups leave no stray margins. */}
      <div className="max-w-2xl lg:max-w-6xl mx-auto px-4 pt-4 flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="lg:flex-1 lg:min-w-0 flex flex-col gap-4">
          <div className={groupCn('details')}>{details}</div>
          <div className={groupCn('team')}>{team}</div>
        </div>
        <div className="lg:flex-1 lg:min-w-0 flex flex-col gap-4">
          <div className={groupCn('files')}>{files}</div>
          <div className={groupCn('chat')}>{chat}</div>
        </div>
      </div>
    </>
  )
}
```

Note: each group wrapper div contains one or more cards; the group's inner
cards manage their own vertical rhythm via the pattern `flex flex-col gap-4`
in the JSX passed by the shells (Tasks 4 and 6 wrap multi-card groups in
fragments — the column's `gap-4` separates the group wrappers, and the shells
put `space-y-4` inside a group when it holds more than one card).

- [ ] **Step 3: Type-check**

Run: `npm run type-check`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/features/job-detail/JobFormLayout.tsx src/lib/i18n/en.ts src/lib/i18n/zh.ts
git commit -m "feat: JobFormLayout responsive shell (phone tabs / PC two columns) + tab i18n keys"
```

---

### Task 3: `bare` mode for CoreSection, ProductionReadySection, TaskListSection collapse

**Files:**
- Modify: `src/features/job-detail/CoreSection.tsx:28-44,168,368` (props + outer frame)
- Modify: `src/features/job-detail/ProductionReadySection.tsx:23-33,158-160,218` (props + outer frame + h3)
- Modify: `src/features/job-detail/TaskListSection.tsx:157-188,321` (collapse chevron in existing header + body fold)

**Interfaces:**
- Consumes: `useCardCollapse` from Task 1.
- Produces: `bare?: boolean` prop on `CoreSection` and `ProductionReadySection` (default `false`, renders exactly as today). `TaskListSection` gains a self-managed PC collapse using storage key `'gq-jobcard-tasks'`. Tasks 4 and 6 pass `bare` when wrapping in `CollapseCard`.

- [ ] **Step 1: CoreSection — add `bare` prop**

In `CoreSection.tsx`, add to the `Props` interface (after `installerView?: boolean`):

```tsx
  bare?:             boolean
```

Add `bare = false` to the destructured parameters:

```tsx
export function CoreSection({
  register, errors, control, watch, setValue,
  readOnly, lang, role, validateRequired = false, installerView = false, bare = false,
}: Props) {
```

Change the outer frame. Today the fields render inside
`<Card className="p-5 space-y-4">…</Card>` (line 168 to its closing tag at
line 368). Capture the card's children as a variable and choose the frame —
the conditional is stable for the page's lifetime, so inputs don't remount:

```tsx
  const body = (
    <>
      {/* …the entire existing children of the Card, unchanged… */}
    </>
  )

  return (
    <>
      {deleteTarget && (
        /* …existing delete-company Modal, unchanged… */
      )}
      {bare
        ? <div className="space-y-4">{body}</div>
        : <Card className="p-5 space-y-4">{body}</Card>}
    </>
  )
```

Concretely: cut everything between `<Card className="p-5 space-y-4">` and its
matching `</Card>`, paste it into the `body` fragment above the return, and
replace the old Card with the two-branch expression. Nothing inside `body`
changes.

- [ ] **Step 2: ProductionReadySection — add `bare` prop**

Same pattern. Add to `Props` (after `files: JobFile[]`):

```tsx
  bare?:     boolean
```

Destructure with default:

```tsx
export function ProductionReadySection({ register, watch, setValue, readOnly, role, lang, jobId, userId, files, bare = false }: Props) {
```

The section currently returns `<Card className="p-5 space-y-5">` with an `<h3>`
title as its first child (lines 158–160). When `bare`, the `CollapseCard`
provides the title, so drop the h3 too:

```tsx
  const body = (
    <>
      {!bare && (
        <h3 className="text-sm font-medium text-ink">{t(lang, 'productionReadyInstructions')}</h3>
      )}
      {/* …existing Field + three UploadSection blocks, unchanged… */}
    </>
  )

  return bare
    ? <div className="space-y-5">{body}</div>
    : <Card className="p-5 space-y-5">{body}</Card>
```

- [ ] **Step 3: TaskListSection — self-managed PC collapse**

TaskListSection keeps its own Card — its header has live controls (Clear all,
All done) that should stay visible in the title row even when the body is
folded on PC. Add the chevron to the existing header and fold the body.

Imports: add `ChevronDown` to the existing lucide-react import and:

```tsx
import { useCardCollapse } from './useCardCollapse'
```

Inside the component (near the `done`/`total` consts around line 150):

```tsx
  const { open, toggle } = useCardCollapse('gq-jobcard-tasks')
```

The header (line 160) is a `justify-between` row with a left title group and
conditional right-side controls as direct siblings. Wrap the right side and
append the chevron so the layout is stable:

```tsx
      <div className="px-4 py-3 border-b border-line flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {/* …existing ListChecks icon + title + Optional chip, unchanged… */}
        </div>
        <div className="flex items-center gap-3">
          {canEdit && total > 0 && (
            /* …existing Clear all button, unchanged… */
          )}
          {!canEdit && total > 0 && done === total && (
            /* …existing All done span, unchanged… */
          )}
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            className="hidden lg:flex items-center justify-center w-6 h-6 rounded text-muted hover:text-ink transition-colors"
          >
            <ChevronDown size={14} className={cn('transition-transform', !open && '-rotate-90')} />
          </button>
        </div>
      </div>
```

Then wrap **everything after the header div** (progress bar, empty state, task
rows, add-task footer — through to just before `</Card>` at line 321) in:

```tsx
      <div className={cn(!open && 'lg:hidden')}>
        {/* …all existing body content, unchanged… */}
      </div>
```

- [ ] **Step 4: Type-check**

Run: `npm run type-check`
Expected: PASS (both shells still render the sections without `bare`, which defaults to false — zero behaviour change so far)

- [ ] **Step 5: Commit**

```bash
git add src/features/job-detail/CoreSection.tsx src/features/job-detail/ProductionReadySection.tsx src/features/job-detail/TaskListSection.tsx
git commit -m "feat: bare mode for Core/Production sections + PC collapse on task list card"
```

---

### Task 4: Rewire `JobDetailShell` into the new layout + `?tab=chat` deep link

**Files:**
- Modify: `src/features/job-detail/JobDetailShell.tsx` (imports, Props, lines 556–774 — the render body between the header and the action bar)
- Modify: `src/app/jobs/[id]/page.tsx:11-18,50-63` (searchParams + prop)

**Interfaces:**
- Consumes: `JobFormLayout`/`JobTab` (Task 2), `CollapseCard` (Task 1), `bare` props (Task 3).
- Produces: `JobDetailShell` gains optional prop `initialTab?: 'chat'`. The page passes it from `?tab=chat`.

- [ ] **Step 1: Imports and Props**

Add imports:

```tsx
import { JobFormLayout } from './JobFormLayout'
import { CollapseCard } from './CollapseCard'
```

Add to the `Props` interface (after `backHref?: string`):

```tsx
  initialTab?:            'chat'
```

Add `initialTab` to the destructured props (after `backHref = '/schedule'`).

- [ ] **Step 2: Replace the single-column body with JobFormLayout**

Wrap the existing page header's content (back button + title + pill, the div
at line 562 `className="px-4 pt-5 pb-3"`) in the widened container so it
aligns with the columns on PC — change that div to:

```tsx
      <div className="max-w-2xl lg:max-w-6xl mx-auto px-4 pt-5 pb-1">
```

Then replace the whole `<div className="max-w-2xl mx-auto px-4 space-y-4">…</div>`
block (lines 579–774, everything from CoreSection through the Notifications
placeholder card) with:

```tsx
      <JobFormLayout
        lang={lang}
        initialTab={initialTab}
        details={
          <div className="flex flex-col gap-4">
            <CollapseCard title={t(lang, 'jobDetails')} storageKey="gq-jobcard-details">
              <CoreSection
                bare
                register={register}
                errors={errors}
                control={control}
                watch={watch}
                setValue={setValue}
                readOnly={readOnly}
                lang={lang}
                role={role}
                installerView={isInstaller}
              />
            </CollapseCard>
            <CollapseCard title={t(lang, 'productionReadyInstructions')} storageKey="gq-jobcard-production">
              <ProductionReadySection
                bare
                register={register}
                watch={watch}
                setValue={setValue}
                readOnly={readOnly}
                role={role}
                lang={lang}
                jobId={job.id}
                userId={userId}
                files={job.files.filter(f =>
                  f.kind === 'production_instructions' || f.kind === 'do' || f.kind === 'completion'
                )}
              />
            </CollapseCard>
          </div>
        }
        team={
          <div className="flex flex-col gap-4">
            <CollapseCard title={t(lang, 'tabTeam')} storageKey="gq-jobcard-team" bodyClassName="p-0">
              <div className="p-4 space-y-4">
                {/* …existing Person-in-Charge Field, Sub POC / Coordinators Field,
                     and Notes Field — moved verbatim from the old Team Card… */}
              </div>

              {/* Installers sub-section — moved verbatim (the border-t div with
                  the InstallerGrid, lines 687–704 of the old body) */}

              {/* SubInstallerBucket — moved verbatim (old lines 707–720) */}

              {/* ExternalPOCBucket — moved verbatim (old lines 724–726) */}
            </CollapseCard>

            {!isInstaller && (
              <CollapseCard title="Notifications" storageKey="gq-jobcard-notifications" bodyClassName="p-0">
                <div className="px-4 py-5 flex flex-col items-center gap-2 text-center">
                  <Bell size={20} className="text-line" />
                  <p className="text-sm font-medium text-ink2">Coming soon</p>
                  <p className="text-xs text-muted">Telegram notification tracker</p>
                </div>
              </CollapseCard>
            )}
          </div>
        }
        files={
          <div className="flex flex-col gap-4">
            <CollapseCard title={t(lang, 'attachments')} storageKey="gq-jobcard-attachments">
              <AttachmentBuckets
                jobId={job.id}
                userId={userId}
                lang={lang}
                readOnly={readOnly || isInstaller}
              />
            </CollapseCard>
            <TaskListSection
              jobId={job.id}
              role={role}
              lang={lang}
              readOnly={readOnly}
            />
          </div>
        }
        chat={
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
        }
      />
```

Rules for the move:
- The three Team fields, the Installers sub-section, SubInstallerBucket, and
  ExternalPOCBucket move **verbatim** — same props, same conditionals
  (`isInstaller` branches included). Only their wrapper changes from the old
  `<Card className="overflow-hidden">` to the `CollapseCard` with
  `bodyClassName="p-0"` (the old Card's children already carry their own
  padding and `border-t` dividers, so they drop in unchanged).
- The old standalone Notifications placeholder Card (lines 758–772) is
  replaced by the `CollapseCard` version shown above — same inner content,
  minus the old bespoke header row.
- `t(lang, 'jobDetails')` and `t(lang, 'attachments')`: check these keys exist
  in `en.ts` (grep `jobDetails:` and `attachments:`). If either is missing,
  add it to `en.ts` + `zh.ts` (`jobDetails: 'Job details'` / `'工作详情'`,
  `attachments: 'Attachments'` / `'附件'`) — en+zh only, never bn.
- After the rewire, the `Card` import in JobDetailShell may be unused (the old
  Team and Notifications cards were its only uses) — remove the import if so,
  or type-check will fail under strict unused-locals settings.

- [ ] **Step 3: Widen the action bar**

In the fixed action bar (line 777), change the inner container:

```tsx
        <div className="max-w-2xl lg:max-w-6xl mx-auto space-y-2">
```

- [ ] **Step 4: Pass the deep link from the server page**

In `src/app/jobs/[id]/page.tsx`, widen the searchParams type and pass the prop:

```tsx
  searchParams: Promise<{ from?: string; tab?: string }>
```

and in the JSX:

```tsx
    <JobDetailShell
      /* …existing props unchanged… */
      backHref={backHref}
      initialTab={sp.tab === 'chat' ? 'chat' : undefined}
    />
```

- [ ] **Step 5: Type-check and build**

Run: `npm run type-check` then `npm run build`
Expected: both PASS

- [ ] **Step 6: Visual sanity check (dev server)**

Run: `npm run dev`, open a job at `/jobs/<id>`:
- Narrow window (<1024px): 4 tabs under the heading; Details active; switching
  tabs preserves unsaved edits; action bar visible on every tab.
- Wide window (≥1024px): no tab bar; two columns; every card collapses except
  Job Chat; collapse survives a reload; console clean (no hydration warning).
- `/jobs/<id>?tab=chat` in a narrow window opens on the Chat tab.

- [ ] **Step 7: Commit**

```bash
git add src/features/job-detail/JobDetailShell.tsx src/app/jobs/[id]/page.tsx
git commit -m "feat: edit job page — phone tabs + PC two-column layout with collapsible cards"
```

---

### Task 5: Rewire `NewJobShell` — same shell, locked tabs, production card, sticky action bar

**Files:**
- Modify: `src/features/job-detail/NewJobShell.tsx` (imports, lines 243–385 — render body)

**Interfaces:**
- Consumes: `JobFormLayout` (Task 2), `CollapseCard` (Task 1), `CoreSection bare` (Task 3).
- Produces: nothing new — page-level change only.

- [ ] **Step 1: Imports**

Add:

```tsx
import { JobFormLayout } from './JobFormLayout'
import { CollapseCard } from './CollapseCard'
```

- [ ] **Step 2: Replace the render body**

Replace everything inside the root div (from the old
`<div className="max-w-2xl mx-auto px-4 py-6 space-y-6 pb-8">` through its
closing tag, keeping CompanyBar, the clash modal, and the pushed modal) with:

```tsx
    <div className="min-h-screen bg-bg pb-28">
      <CompanyBar lang={lang} />

      {/* Back + title — same container width as the columns */}
      <div className="max-w-2xl lg:max-w-6xl mx-auto px-4 pt-5 pb-1">
        <div className="flex items-center gap-3">
          <Link href="/schedule" className="text-ink2 hover:text-ink shrink-0">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="font-display text-xl font-semibold text-ink">{t(lang, 'newJob')}</h1>
        </div>
      </div>

      <JobFormLayout
        lang={lang}
        lockedTabs={['files', 'chat']}
        details={
          <div className="flex flex-col gap-4">
            <CollapseCard title={t(lang, 'jobDetails')} storageKey="gq-jobcard-details">
              <CoreSection
                bare
                register={register}
                errors={errors}
                control={control}
                watch={watch}
                setValue={setValue}
                readOnly={false}
                lang={lang}
                role={role}
                validateRequired
              />
            </CollapseCard>
            <CollapseCard title={t(lang, 'productionReadyInstructions')} storageKey="gq-jobcard-production">
              <div className="space-y-3">
                <Field label={t(lang, 'productionInstructions')}>
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
                <div className="flex items-center gap-2 text-muted text-xs">
                  <Lock size={12} />
                  Save the job first to add production photos and DO.
                </div>
              </div>
            </CollapseCard>
          </div>
        }
        team={
          <CollapseCard title={t(lang, 'tabTeam')} storageKey="gq-jobcard-team" bodyClassName="p-0">
            <div className="p-4 space-y-4">
              <Field label="Person-in-Charge">
                {/* …existing Controller + SearchableSelect, unchanged… */}
              </Field>
              <Field label="Sub POC / Coordinators">
                {/* …existing MultiUserSelect, unchanged… */}
              </Field>
              <Field label="Notes">
                {/* …existing SuggestField + textarea, unchanged… */}
              </Field>
            </div>
            {/* Installers — same sub-section framing as the edit page */}
            <div className="border-t border-line px-4 pt-3 pb-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted mb-3">Installers</p>
              {allInstallers.length === 0 ? (
                <p className="text-sm text-muted">No installers found.</p>
              ) : (
                <InstallerGrid
                  installers={allInstallers}
                  stateOf={id => selectedIds.includes(id) ? (suggestMode ? 'suggested' : 'assigned') : 'none'}
                  onToggle={id => setSelectedIds(prev =>
                    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
                  )}
                  noteOf={id => (suggestMode && selectedIds.includes(id)) ? 'Suggested' : null}
                />
              )}
            </div>
          </CollapseCard>
        }
        files={
          <Card className="p-5 space-y-2 opacity-60 pointer-events-none select-none">
            <h3 className="text-sm font-medium text-ink">{t(lang, 'attachments')}</h3>
            <div className="flex items-center gap-2 py-4 text-muted text-sm justify-center">
              <Lock size={14} />
              Save the job first to add attachments.
            </div>
          </Card>
        }
        chat={
          <Card className="p-5 space-y-3 opacity-60 pointer-events-none select-none">
            <h3 className="text-sm font-medium text-ink">{t(lang, 'jobChatTitle')}</h3>
            <div className="flex items-center justify-center gap-2 py-6 text-muted text-sm">
              <Lock size={14} />
              {t(lang, 'chatPreScheduleMessage')}
            </div>
          </Card>
        }
      />

      {/* Sticky action bar — same chrome as the edit page */}
      <div className="fixed bottom-0 left-0 right-0 bg-paper border-t border-line px-4 py-3 z-10">
        <div className="max-w-2xl lg:max-w-6xl mx-auto flex gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            disabled={saving}
            className="flex items-center justify-center px-3 py-2 rounded-[10px] border border-line bg-paper text-xs font-medium text-ink2 hover:bg-bg disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => saveJob('pending')}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-[10px] border border-amber-400 bg-amber-50 text-sm font-semibold text-amber-800 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : 'Save as pending'}
          </button>
          <button
            type="button"
            onClick={() => saveJob('push_to_schedule')}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-[10px] bg-terracotta text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Pushing…' : 'Push to Schedule'}
          </button>
        </div>
      </div>

      {/* …existing ClashResolutionModal + showPushedModal blocks, unchanged… */}
    </div>
```

Rules for the move:
- The Team fields and InstallerGrid move **verbatim** (same props/handlers) —
  only their card framing changes to match the edit page.
- **Production Instructions leaves the Team card** — it now lives in the
  Details group's Production card (shown above), same position as Edit.
- The old inline action-bar div (`flex items-center justify-end gap-3 pt-2`)
  is deleted — replaced by the fixed bar above.
- `t(lang, 'newJob')` for the heading: the key exists (`en.ts:16` area,
  `newJob: 'New job'` — verify with grep; if the current page hardcodes
  "New job", reusing the key is the correct i18n behaviour).
- The "Save the job first…" lock lines stay hardcoded English — they are
  existing copy in this file today; keep as-is (no new keys needed).

- [ ] **Step 3: Type-check and build**

Run: `npm run type-check` then `npm run build`
Expected: both PASS

- [ ] **Step 4: Visual sanity check (dev server)**

`/jobs/new` narrow window: 4 tabs, Files + Chat greyed with lock and not
tappable; Details/Team fully working; sticky bottom bar with the three
buttons. Wide window: two columns; right column shows the two locked cards;
production instructions sits in the left column's Production card.

- [ ] **Step 5: Commit**

```bash
git add src/features/job-detail/NewJobShell.tsx
git commit -m "feat: new job page — same tabs/columns shell, locked Files+Chat, sticky action bar"
```

---

### Task 6: Chat Telegram link lands on the Chat tab

**Files:**
- Modify: `src/app/api/jobs/[id]/messages/route.ts:48`

**Interfaces:**
- Consumes: the `?tab=chat` deep link from Task 4.
- Produces: nothing new.

- [ ] **Step 1: Append the tab param**

Change line 48 from:

```ts
  const jobUrl    = `${APP_URL}/jobs/${jobId}`
```

to:

```ts
  // Chat notifications land on the Chat tab directly (phone layout).
  const jobUrl    = `${APP_URL}/jobs/${jobId}?tab=chat`
```

This `jobUrl` feeds only the chat-batch notification (template text link and
the "View in app →" inline button) — both should land on chat. No other
route or template changes.

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/jobs/[id]/messages/route.ts"
git commit -m "feat: chat Telegram notification links open the Chat tab"
```

---

### Task 7: Final gate — build + full self-review against the spec

**Files:**
- None created; verification only.

- [ ] **Step 1: Full build**

Run: `npm run type-check && npm run build`
Expected: both PASS

- [ ] **Step 2: Spec walk-through in the dev server**

Check every numbered item in the spec's Testing section
(`docs/superpowers/specs/2026-08-05-job-form-tabs-design.md`) that can be
verified locally: tabs (1), locked new-job tabs (2), PC columns + collapse
persistence (3), `?tab=chat` (4), a role spot-check via preview-as (5), and a
clean console on reload (6). Telegram link verification (item 4's live half)
happens on the Vercel preview after push.

- [ ] **Step 3: Ask Nic before pushing**

Per the standing rule: commits are local on `dev` — ask Nic for the go-ahead,
then `git push` so Vercel builds the preview for the smoke test.
