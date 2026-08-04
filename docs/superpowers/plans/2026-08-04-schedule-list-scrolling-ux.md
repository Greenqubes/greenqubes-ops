# Schedule List View — Scrolling & Navigation UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the endless date strip on the Schedule list view with a windowed week↔month strip, a jump calendar, and a Today button; make weeks Monday-start app-wide; remove the filter chips; tighten the page.

**Architecture:** Two new client components inside the schedule feature folder (`DateStrip`, `JumpCalendar`) replace the strip section of `ListView`. `ScheduleShell` keeps owning `selectedDate` and gains the Today button + jump-calendar trigger. Shared date helpers in `schedule/utils.ts` switch to Monday-start weeks and hardcoded-English labels; every consumer (Week/Month tabs, installer views) follows automatically.

**Tech Stack:** Next.js 15 (app router), React client components, Tailwind (design tokens as CSS vars), lucide-react chevrons + custom inline stroke SVGs. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-03-schedule-list-scrolling-ux-design.md`

## Global Constraints

- **No test framework exists in this repo — do not add one.** Per-task verification is `npm run type-check`; final verification adds `npm run build`. Manual smoke happens on the Vercel preview by Nic.
- **All work on the `dev` branch.** Commit per task. **Never push without asking Nic first.**
- Date labels (day names, month names) are **always English (`en-GB`)** regardless of the user's zh/bn setting.
- **No new Bengali translations:** new i18n keys get the **English text** in `bn.ts`.
- **No emoji anywhere** — icons are stroke-only inline SVGs or lucide-react.
- Overlays must layer **above** BottomNav (`z-50`) — use `z-[60]`+.
- `/schedule` has a known production hydration error (#418) that is **off-limits**: never read `localStorage`/`window` during the initial render — only inside `useEffect` after mount.
- TypeScript strict — no `any`, no `@ts-ignore`.
- User-facing copy lives in `src/lib/i18n/{en,zh,bn}.ts`, never hardcoded in components (date names exempt per the always-English rule).
- Files < 500 lines; one concept per file.

---

### Task 1: Monday-start weeks + always-English date labels (utils + all consumers)

**Files:**
- Modify: `src/features/schedule/utils.ts:26-70`
- Modify: `src/features/schedule/ListView.tsx:3,31,45`
- Modify: `src/features/schedule/WeekView.tsx:4,16,23`
- Modify: `src/features/schedule/MonthView.tsx:3-7,22-32`
- Modify: `src/features/schedule/ScheduleShell.tsx:17,93,170-176`
- Modify: `src/features/installer/InstallerShell.tsx:10,47,125-128`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces (later tasks rely on these exact signatures):
  - `getWeekDays(anchor: string): string[]` — 7 ISO dates, **Monday first**
  - `getMonthDays(anchor: string): string[]` — every ISO date of anchor's month (new)
  - `getMonthCells(anchor: string): (string | null)[]` — **Mon-first** leading blanks
  - `dayLabel(isoDate: string): string` — English short day name ("Mon")
  - `monthLabel(isoDate: string): string` — English "August 2026"
  - `langToLocale` **no longer exists**

- [ ] **Step 1: Rewrite the helpers in `utils.ts`**

Replace lines 26–70 (from `getWeekDays` to end of file) with:

```ts
export function getWeekDays(anchor: string): string[] {
  const d = new Date(anchor + 'T00:00:00')
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)) // back to Monday
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(d)
    day.setDate(d.getDate() + i)
    return toISO(day)
  })
}

export function getMonthDays(anchor: string): string[] {
  const d        = new Date(anchor + 'T00:00:00')
  const year     = d.getFullYear()
  const month    = d.getMonth()
  const daysInMo = new Date(year, month + 1, 0).getDate()
  return Array.from({ length: daysInMo }, (_, i) => toISO(new Date(year, month, i + 1)))
}

export function getMonthCells(anchor: string): (string | null)[] {
  const d         = new Date(anchor + 'T00:00:00')
  const year      = d.getFullYear()
  const month     = d.getMonth()
  const firstDay  = (new Date(year, month, 1).getDay() + 6) % 7 // Mon-first column index
  const daysInMo  = new Date(year, month + 1, 0).getDate()
  return [
    ...Array.from<null>({ length: firstDay }).fill(null),
    ...Array.from({ length: daysInMo }, (_, i) => toISO(new Date(year, month, i + 1))),
  ]
}

export function shiftDate(anchor: string, days: number): string {
  const d = new Date(anchor + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return toISO(d)
}

export function shiftMonth(anchor: string, delta: number): string {
  const d = new Date(anchor + 'T00:00:00')
  d.setMonth(d.getMonth() + delta, 1)
  return toISO(d)
}

// Date names are ALWAYS English regardless of UI language (CLAUDE.md hard rule).
export function dayLabel(isoDate: string): string {
  return new Date(isoDate + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short' })
}

export function monthLabel(isoDate: string): string {
  return new Date(isoDate + 'T00:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}
```

(`shiftDate`/`shiftMonth` are unchanged — they are shown so the file end is unambiguous. `langToLocale` is gone.)

- [ ] **Step 2: Fix `ListView.tsx` call sites (minimal — this strip is replaced in Task 2)**

Line 3: `import { dayLabel, langToLocale, isOverdue } from './utils'` → `import { dayLabel, isOverdue } from './utils'`
Line 31: delete `const locale  = langToLocale(lang)`
Line 45: `const shortDay     = dayLabel(d, locale)` → `const shortDay     = dayLabel(d)`

- [ ] **Step 3: Fix `WeekView.tsx`**

Line 4: `import { dayLabel, langToLocale } from './utils'` → `import { dayLabel } from './utils'`
Line 16: delete `const locale = langToLocale(lang)`
Line 23: `const short   = dayLabel(d, locale)` → `const short   = dayLabel(d)`

- [ ] **Step 4: Fix `MonthView.tsx` — static Mon-first headers**

Remove line 3's util import entirely (`dayLabel`/`langToLocale` no longer needed):
delete `import { dayLabel, langToLocale } from './utils'`.
Replace line 7 `const DAY_INDICES = [0, 1, 2, 3, 4, 5, 6] // Sun–Sat` with:

```ts
const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] // always English
```

Inside the component, delete lines 22–32 (the `locale` const and the whole computed
`firstRealDate`/`weekStart`/`dayHeaders` block), and change the header render from
`{dayHeaders.map((h, i) => (` to `{DAY_HEADERS.map((h, i) => (`.

- [ ] **Step 5: Fix `ScheduleShell.tsx`**

Line 17: remove `langToLocale` from the utils import (keep `toISO, shiftDate, shiftMonth, getWeekDays, getMonthCells, monthLabel`).
Line 93: delete `const locale = langToLocale(lang)`.
Lines 170–176, the `headingLabel` memo, becomes:

```ts
  const headingLabel = useMemo(() => {
    if (viewMode === 'list') {
      return new Date(selectedDate + 'T00:00:00')
        .toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    }
    return monthLabel(selectedDate)
  }, [viewMode, selectedDate])
```

- [ ] **Step 6: Fix `InstallerShell.tsx`**

Line 10: remove `langToLocale` from the schedule-utils import.
Line 47: delete `const locale  = langToLocale(lang)`.
Lines 125–128 become:

```ts
  const headingLabel = useMemo(
    () => monthLabel(selectedDate),
    [selectedDate],
  )
```

- [ ] **Step 7: Verify**

Run: `npm run type-check`
Expected: clean (any leftover `langToLocale`/locale-argument call site will fail here — fix it the same way as above).

- [ ] **Step 8: Commit**

```bash
git add src/features/schedule/utils.ts src/features/schedule/ListView.tsx src/features/schedule/WeekView.tsx src/features/schedule/MonthView.tsx src/features/schedule/ScheduleShell.tsx src/features/installer/InstallerShell.tsx
git commit -m "feat: Monday-start weeks app-wide + date labels always English"
```

---

### Task 2: DateStrip component (windowed strip) + scrollbar fix + wiring

**Files:**
- Create: `src/features/schedule/DateStrip.tsx`
- Modify: `src/app/globals.css` (append at end of file)
- Modify: `src/lib/i18n/en.ts:26-28` area, `src/lib/i18n/zh.ts`, `src/lib/i18n/bn.ts` (same keys)
- Modify: `src/features/schedule/ListView.tsx` (replace strip block, drop `jobs`/`dates` props)
- Modify: `src/features/schedule/ScheduleShell.tsx:136-148,310-325` (drop `dates` memo + props)

**Interfaces:**
- Consumes (from Task 1): `getWeekDays(anchor)`, `getMonthDays(anchor)`, `shiftDate(anchor, days)`, `shiftMonth(anchor, delta)`, `dayLabel(iso)`, `isOverdue(status, date)`.
- Produces: `DateStrip` component with props
  `{ jobsByDate: Record<string, ScheduleJob[]>; selectedDate: string; today: string; lang: LangCode; onSelectDate: (date: string) => void }`
  and i18n keys `stripShowMonth`, `stripShowWeek` (used only here).

- [ ] **Step 1: Add the `scrollbar-none` utility (currently referenced but never defined)**

Append to `src/app/globals.css`:

```css
/* Hide scrollbars on horizontally scrolling rows (date strip, toggle rows) */
.scrollbar-none {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.scrollbar-none::-webkit-scrollbar {
  display: none;
}
```

- [ ] **Step 2: Add i18n keys**

In `src/lib/i18n/en.ts`, after `viewMonth: 'Month',` (line 28) add:

```ts
  stripShowMonth: 'Show full month',
  stripShowWeek: 'Show one week',
```

In `zh.ts`, in the same position relative to its `viewMonth` key, add:

```ts
  stripShowMonth: '显示整月',
  stripShowWeek: '显示单周',
```

In `bn.ts`, same position, add the **English text** (no-new-bn rule):

```ts
  stripShowMonth: 'Show full month',
  stripShowWeek: 'Show one week',
```

- [ ] **Step 3: Create `src/features/schedule/DateStrip.tsx`**

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { t as tr } from '@/lib/i18n'
import { dayLabel, getWeekDays, getMonthDays, shiftDate, shiftMonth, isOverdue } from './utils'
import type { ScheduleJob } from '@/lib/supabase/queries/jobs'
import type { LangCode } from '@/lib/i18n'

type StripMode = 'week' | 'month'
const MODE_KEY = 'gq-strip-mode'

interface DateStripProps {
  jobsByDate:   Record<string, ScheduleJob[]>
  selectedDate: string
  today:        string
  lang:         LangCode
  onSelectDate: (date: string) => void
}

export function DateStrip({ jobsByDate, selectedDate, today, lang, onSelectDate }: DateStripProps) {
  const [mode,   setMode]   = useState<StripMode>('week')
  const [anchor, setAnchor] = useState(selectedDate)
  const stripRef    = useRef<HTMLDivElement>(null)
  const firstScroll = useRef(true)

  // localStorage only after mount — /schedule is hydration-sensitive (#418)
  useEffect(() => {
    if (localStorage.getItem(MODE_KEY) === 'month') setMode('month')
  }, [])

  // the window follows the selection; paging arrows move it independently
  useEffect(() => { setAnchor(selectedDate) }, [selectedDate])

  const days = mode === 'week' ? getWeekDays(anchor) : getMonthDays(anchor)

  // keep the selected day centred (only month mode can overflow)
  useEffect(() => {
    const el = stripRef.current
    if (!el) return
    const target = el.querySelector<HTMLElement>('[data-sel]')
    const behavior: ScrollBehavior = firstScroll.current ? 'auto' : 'smooth'
    firstScroll.current = false
    if (!target) { el.scrollTo({ left: 0, behavior }); return }
    el.scrollTo({ left: target.offsetLeft - el.clientWidth / 2 + target.clientWidth / 2, behavior })
  }, [selectedDate, anchor, mode])

  // mouse wheel → horizontal scroll; native listener because React's onWheel is passive
  useEffect(() => {
    const el = stripRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return
      e.preventDefault()
      el.scrollLeft += e.deltaY
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  function toggleMode() {
    setMode(m => {
      const next: StripMode = m === 'week' ? 'month' : 'week'
      localStorage.setItem(MODE_KEY, next)
      return next
    })
  }

  function page(dir: -1 | 1) {
    setAnchor(a => (mode === 'week' ? shiftDate(a, dir * 7) : shiftMonth(a, dir)))
  }

  const toggleLabel = tr(lang, mode === 'week' ? 'stripShowMonth' : 'stripShowWeek')

  return (
    <div className="flex items-center gap-1 px-2 pb-2">
      <button
        onClick={() => page(-1)}
        aria-label="Previous"
        className="p-1.5 text-muted hover:text-ink transition-colors rounded-lg shrink-0"
      >
        <ChevronLeft size={15} />
      </button>

      <div ref={stripRef} className="relative flex gap-1.5 flex-1 min-w-0 overflow-x-auto scrollbar-none p-0.5">
        {days.map(d => {
          const dateJobs    = jobsByDate[d] ?? []
          const active      = d === selectedDate
          const isToday     = d === today
          const hasOverdue  = dateJobs.some(j => isOverdue(j.status, j.date))
          const hasStrict   = dateJobs.some(j => j.punctuality === 'strict')
          const hasFlexible = dateJobs.some(j => j.punctuality !== 'strict')

          return (
            <button
              key={d}
              data-sel={active ? '' : undefined}
              onClick={() => onSelectDate(d)}
              className={cn(
                'relative flex flex-col items-center gap-0.5 py-2 rounded-xl border transition-colors text-xs font-medium',
                mode === 'week' ? 'flex-1 basis-0 min-w-0' : 'shrink-0 min-w-[50px]',
                active
                  ? 'bg-ink border-ink text-paper'
                  : hasOverdue
                    ? 'bg-bad-soft border-bad text-bad'
                    : 'bg-paper border-line text-ink2 hover:border-ink2'
              )}
            >
              <span className={cn('text-[10px] uppercase tracking-wide', !hasOverdue && 'opacity-70')}>
                {dayLabel(d)}
              </span>
              <span className={cn(
                'font-display text-base leading-none',
                !active && isToday && !hasOverdue && 'text-terracotta'
              )}>
                {Number(d.slice(8, 10))}
              </span>

              {dateJobs.length > 0 && (
                active ? (
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-white" />
                ) : (hasStrict && hasFlexible) ? (
                  <>
                    <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-brand-blue" />
                    <span className="absolute top-1.5 right-[9px] w-1.5 h-1.5 rounded-full bg-[#D14545]" />
                  </>
                ) : hasFlexible ? (
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-brand-blue" />
                ) : (
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#D14545]" />
                )
              )}
            </button>
          )
        })}
      </div>

      <button
        onClick={() => page(1)}
        aria-label="Next"
        className="p-1.5 text-muted hover:text-ink transition-colors rounded-lg shrink-0"
      >
        <ChevronRight size={15} />
      </button>

      <button
        onClick={toggleMode}
        title={toggleLabel}
        aria-label={toggleLabel}
        className="p-2 rounded-lg border border-line bg-paper text-ink2 hover:border-ink2 transition-colors shrink-0"
      >
        {mode === 'week' ? <MonthGridIcon /> : <WeekRowIcon />}
      </button>
    </div>
  )
}

// The toggle icon shows the layout you'd switch TO (Nic, 2026-08-04).
function MonthGridIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M16 2v4M8 2v4M3 9h18" />
      <path d="M7 13h.01M12 13h.01M17 13h.01M7 17h.01M12 17h.01M17 17h.01" />
    </svg>
  )
}

function WeekRowIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="8" width="20" height="8" rx="2" />
      <path d="M7 11v2M12 11v2M17 11v2" />
    </svg>
  )
}
```

- [ ] **Step 4: Rewire `ListView.tsx`**

Replace the entire file content with:

```tsx
import { Calendar } from 'lucide-react'
import { JobRow } from './JobRow'
import { DateStrip } from './DateStrip'
import type { ScheduleJob } from '@/lib/supabase/queries/jobs'
import type { LangCode } from '@/lib/i18n'

interface ListStrings {
  noJobs:         string
  strictOnTime:   string
  flexibleWindow: string
}

interface ListViewProps {
  jobsByDate:   Record<string, ScheduleJob[]>
  selectedDate: string
  today:        string
  lang:         LangCode
  strings:      ListStrings
  onSelectDate: (date: string) => void
  selectable?:  boolean
  selectedIds?: Set<string>
  onToggle?:    (id: string) => void
  onDelete?:    (id: string) => void
}

export function ListView({
  jobsByDate, selectedDate, today, lang, strings, onSelectDate,
  selectable, selectedIds, onToggle, onDelete,
}: ListViewProps) {
  const dayJobs = jobsByDate[selectedDate] ?? []

  return (
    <div>
      <DateStrip
        jobsByDate={jobsByDate}
        selectedDate={selectedDate}
        today={today}
        lang={lang}
        onSelectDate={onSelectDate}
      />

      {/* Job list for selected date */}
      <div className="px-4 pb-24">
        {dayJobs.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-muted">
            <Calendar size={28} strokeWidth={1.2} />
            <p className="text-sm">{strings.noJobs}</p>
          </div>
        ) : (
          <>
            {/* Punctuality legend */}
            <div className="flex gap-4 mb-3">
              <span className="flex items-center gap-1.5 text-xs text-muted">
                <span className="w-2 h-2 rounded-sm bg-[#D14545] inline-block" />
                {strings.strictOnTime}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted">
                <span className="w-2 h-2 rounded-sm bg-brand-blue inline-block" />
                {strings.flexibleWindow}
              </span>
            </div>
            {dayJobs.map(job => (
              <JobRow
                key={job.id}
                job={job}
                currentDate={selectedDate}
                selectable={selectable}
                selected={selectedIds?.has(job.id)}
                onToggle={onToggle}
                deletable={selectable}
                onDelete={() => onDelete?.(job.id)}
              />
            ))}
          </>
        )}
      </div>
    </div>
  )
}
```

(The old `jobs`/`dates` props, the inline strip, the local `cn` helper and the
`dayLabel`/`isOverdue` imports are all gone — `DateStrip` owns that now. The legend
is tightened in Task 5. `lang` must be typed `LangCode`, not `string`, to satisfy
DateStrip's prop.)

- [ ] **Step 5: Clean up `ScheduleShell.tsx`**

Delete the `dates` memo (lines 136–148, the `useMemo` computing the full
earliest→latest range).
In the `<ListView … />` render (around line 311), delete the two props
`jobs={filtered}` and `dates={dates}` — the remaining props already match the new
interface.

- [ ] **Step 6: Verify**

Run: `npm run type-check`
Expected: clean. Then `npm run dev`, open `http://localhost:3000/schedule`, and check:
strip opens on today (week mode, 7 pills Mon→Sun filling the row); toggle switches to
a scrollable month; ‹ › page without changing the selected day; wheel scrolls the
month strip; no native scrollbar visible.

- [ ] **Step 7: Commit**

```bash
git add src/features/schedule/DateStrip.tsx src/features/schedule/ListView.tsx src/features/schedule/ScheduleShell.tsx src/app/globals.css src/lib/i18n/en.ts src/lib/i18n/zh.ts src/lib/i18n/bn.ts
git commit -m "feat: windowed week/month date strip with paging + mode toggle"
```

---

### Task 3: JumpCalendar popover + heading trigger + Today button

**Files:**
- Create: `src/features/schedule/JumpCalendar.tsx`
- Modify: `src/features/schedule/ScheduleShell.tsx` (heading row + new state)

**Interfaces:**
- Consumes (Task 1): `getMonthCells(anchor)` (Mon-first), `monthLabel(iso)`, `shiftMonth(anchor, delta)`.
- Produces: `JumpCalendar` component with props
  `{ selectedDate: string; today: string; jobsByDate: Record<string, ScheduleJob[]>; onSelectDate: (date: string) => void; onClose: () => void }`.

- [ ] **Step 1: Create `src/features/schedule/JumpCalendar.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { getMonthCells, monthLabel, shiftMonth } from './utils'
import type { ScheduleJob } from '@/lib/supabase/queries/jobs'

const DAY_HEADS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] // Mon-first, always English

interface JumpCalendarProps {
  selectedDate: string
  today:        string
  jobsByDate:   Record<string, ScheduleJob[]>
  onSelectDate: (date: string) => void
  onClose:      () => void
}

export function JumpCalendar({ selectedDate, today, jobsByDate, onSelectDate, onClose }: JumpCalendarProps) {
  const [viewMonth, setViewMonth] = useState(selectedDate)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      {/* scrim: closes on outside tap; above BottomNav per the overlay hard rule */}
      <div className="fixed inset-0 z-[60]" onClick={onClose} />

      <div className="absolute left-4 top-full mt-1 z-[70] w-[300px] bg-paper border border-line rounded-2xl p-4 shadow-lg">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => setViewMonth(m => shiftMonth(m, -1))}
            aria-label="Previous month"
            className="p-1.5 text-muted hover:text-ink transition-colors rounded-lg"
          >
            <ChevronLeft size={15} />
          </button>
          <span className="font-display text-[15px] font-medium text-ink">{monthLabel(viewMonth)}</span>
          <button
            onClick={() => setViewMonth(m => shiftMonth(m, 1))}
            aria-label="Next month"
            className="p-1.5 text-muted hover:text-ink transition-colors rounded-lg"
          >
            <ChevronRight size={15} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-0.5">
          {DAY_HEADS.map((h, i) => (
            <span key={`h${i}`} className="text-center text-[9px] text-muted uppercase tracking-wide py-1">
              {h}
            </span>
          ))}
          {getMonthCells(viewMonth).map((d, i) => {
            if (!d) return <span key={i} />
            const hasJobs  = (jobsByDate[d] ?? []).length > 0
            const sel      = d === selectedDate
            const isToday  = d === today
            return (
              <button
                key={i}
                onClick={() => { onSelectDate(d); onClose() }}
                className={cn(
                  'relative aspect-square flex items-center justify-center text-xs rounded-lg transition-colors',
                  sel
                    ? 'bg-ink text-paper'
                    : isToday
                      ? 'text-terracotta font-semibold ring-1 ring-inset ring-terracotta'
                      : 'text-ink2 hover:bg-bg'
                )}
              >
                {Number(d.slice(8, 10))}
                {hasJobs && (
                  <span className={cn(
                    'absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full',
                    sel ? 'bg-white' : 'bg-terracotta'
                  )} />
                )}
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Wire it into `ScheduleShell.tsx`**

Add to the imports: `ChevronDown` from `lucide-react`, and
`import { JumpCalendar } from './JumpCalendar'`.

Add state next to the others: `const [showJump, setShowJump] = useState(false)`.

The header block (currently the `div` with `className="px-4 pt-5 pb-3 flex items-start justify-between gap-3"`) becomes — note the added `relative` and the
conditional heading button (jump calendar is **list view only**):

```tsx
      {/* ── Header ── */}
      <div className="relative px-4 pt-5 pb-3 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <button onClick={goBack}    className="p-1 text-muted hover:text-ink transition-colors rounded">
              <ChevronLeft  size={16} />
            </button>
            {viewMode === 'list' ? (
              <button
                onClick={() => setShowJump(s => !s)}
                className="flex items-center gap-1 px-1 rounded-lg hover:bg-ink/5 transition-colors"
              >
                <h1 className="font-display text-[26px] font-medium text-ink tracking-tight leading-none">
                  {headingLabel}
                </h1>
                <ChevronDown size={14} className="text-muted" />
              </button>
            ) : (
              <h1 className="font-display text-[26px] font-medium text-ink tracking-tight leading-none px-1">
                {headingLabel}
              </h1>
            )}
            <button onClick={goForward} className="p-1 text-muted hover:text-ink transition-colors rounded">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {viewMode === 'list' && selectedDate !== today && (
            <button
              onClick={() => setSelectedDate(today)}
              className="px-3 py-[7px] text-[11px] font-semibold rounded-full border border-brand-amber bg-brand-amber-soft text-brand-amber transition-colors"
            >
              {tr(lang, 'filterToday')}
            </button>
          )}
          <button
            onClick={() => setShowSearch(s => !s)}
            aria-label="Toggle search"
            className={cn(
              'p-2 rounded-lg border transition-colors',
              showSearch
                ? 'bg-ink border-ink text-paper'
                : 'bg-paper border-line text-ink2 hover:border-ink2'
            )}
          >
            <Search size={15} />
          </button>
          {(role === 'sales' || role === 'scheduler') && (
            <Link
              href="/jobs/new"
              className="inline-flex items-center gap-1 px-3 py-[11px] text-xs rounded-lg font-semibold tracking-wide bg-terracotta text-white hover:brightness-90 active:brightness-75 transition-colors shrink-0"
            >
              <Plus size={12} />
              New
            </Link>
          )}
        </div>

        {showJump && viewMode === 'list' && (
          <JumpCalendar
            selectedDate={selectedDate}
            today={today}
            jobsByDate={jobsByDate}
            onSelectDate={setSelectedDate}
            onClose={() => setShowJump(false)}
          />
        )}
      </div>
```

(The `filterToday` i18n key already exists with value "Today" — it survives the
Task 4 chip deletion because WeekView's badge and this button use it.)

- [ ] **Step 3: Verify**

Run: `npm run type-check` → clean. In `npm run dev`: tap heading → popover with
Mon-first August grid + job dots; ‹ › flips months; picking a day moves list + strip
and closes the popover; Esc and outside-tap close it; Today pill appears only when
off today and jumps back; in Week/Month tabs the heading is plain (no caret, no
popover) and no Today pill shows.

- [ ] **Step 4: Commit**

```bash
git add src/features/schedule/JumpCalendar.tsx src/features/schedule/ScheduleShell.tsx
git commit -m "feat: jump calendar from heading + Today button on schedule list"
```

---

### Task 4: Remove the All/Today/Week/Upcoming filter chips

**Files:**
- Modify: `src/features/schedule/ScheduleShell.tsx` (type, state, memo, chips row)
- Modify: `src/lib/i18n/en.ts:22-25`, `src/lib/i18n/zh.ts`, `src/lib/i18n/bn.ts` (same keys)

**Interfaces:**
- Consumes: nothing new.
- Produces: `ScheduleShell` no longer has a `Filter` type or `filter` state;
  i18n keys `filterAll`, `filterWeek`, `filterUpcoming` **no longer exist**
  (`filterToday` REMAINS — used by WeekView's badge and the Today button).

- [ ] **Step 1: Strip the filter logic from `ScheduleShell.tsx`**

- Delete the type alias line: `type Filter   = 'all' | 'today' | 'week' | 'upcoming'`
- Delete the state line: `const [filter,       setFilter]       = useState<Filter>('all')`
- In the `filtered` memo, delete the four filter conditions (the `endDate` const, the
  `filter === 'today'`, `filter === 'upcoming'` and `filter === 'week'` blocks) so the
  memo keeps ONLY the `pageMode` checks and the `query` search block; change its
  dependency array from `[jobs, filter, query, today]` to `[jobs, query, pageMode]`.

  The memo afterwards:

```ts
  const filtered = useMemo(() => jobs.filter(j => {
    if (pageMode === 'schedule'  && (j.status === 'completed' || j.status === 'pending' || j.status === 'awaiting_approval')) return false
    if (pageMode === 'pending'   && (j.status !== 'pending'   && j.status !== 'awaiting_approval')) return false
    if (pageMode === 'completed' &&  j.status !== 'completed') return false
    if (query.trim()) {
      const q   = query.toLowerCase()
      const hay = [
        j.client, j.description ?? '', j.location,
        ...j.job_assignees.map(a => a.users?.name ?? ''),
      ].join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  }), [jobs, query, pageMode])
```

- Delete the `filterChips` array (the `const filterChips: { v: Filter; label: string }[] = [...]` block).
- In the view-toggle row: the button `onClick` simplifies from
  `onClick={() => { setViewMode(v); if (v === 'week' || v === 'month') setFilter('all') }}`
  to `onClick={() => setViewMode(v)}`, and the whole chips render block
  (`{viewMode !== 'month' && filterChips … }`) is deleted, leaving only the
  `viewtoggle` div inside that row.

- [ ] **Step 2: Delete the dead i18n keys**

In `en.ts` delete lines 22, 24, 25:

```ts
  filterAll: 'All',
  filterWeek: 'This week',
  filterUpcoming: 'Upcoming',
```

**Keep `filterToday: 'Today'`.** Do the same in `zh.ts` and `bn.ts` (delete their
`filterAll`/`filterWeek`/`filterUpcoming` lines, keep `filterToday`).

- [ ] **Step 3: Verify**

Run: `npm run type-check` → clean (a leftover `filter`/`filterChips` reference or a
deleted-key usage fails here). Also run
`grep -rn "filterAll\|filterWeek\|filterUpcoming" src/` — expected: no matches.
In `npm run dev`: only the List/Week/Month toggle remains in that row on
`/schedule`, `/pending`, `/completed`; Week tab's "Today" badge still renders.

- [ ] **Step 4: Commit**

```bash
git add src/features/schedule/ScheduleShell.tsx src/lib/i18n/en.ts src/lib/i18n/zh.ts src/lib/i18n/bn.ts
git commit -m "feat: remove schedule filter chips (superseded by strip + Today button)"
```

---

### Task 5: Tighten the page — legend + vertical paddings

**Files:**
- Modify: `src/features/schedule/ListView.tsx` (legend block)
- Modify: `src/features/schedule/ScheduleShell.tsx` (three padding tweaks)

**Interfaces:** none — visual only.

- [ ] **Step 1: Compact legend in `ListView.tsx`**

Replace the legend block (inside the `dayJobs.length === 0 ? … : …` else-branch):

```tsx
            {/* Punctuality legend */}
            <div className="flex gap-3 mb-2">
              <span className="flex items-center gap-1 text-[10px] text-muted">
                <span className="w-1.5 h-1.5 rounded-sm bg-[#D14545] inline-block" />
                {strings.strictOnTime}
              </span>
              <span className="flex items-center gap-1 text-[10px] text-muted">
                <span className="w-1.5 h-1.5 rounded-sm bg-brand-blue inline-block" />
                {strings.flexibleWindow}
              </span>
            </div>
```

- [ ] **Step 2: Close up vertical paddings in `ScheduleShell.tsx`**

- "Company schedule" label `<p>`: `px-4 pt-3 pb-1` → `px-4 pt-2 pb-0.5`
- Header row div: `relative px-4 pt-5 pb-3 …` → `relative px-4 pt-3 pb-2 …`
- View-toggle row div: `flex items-center gap-2 px-4 pb-3 overflow-x-auto scrollbar-none` → `flex items-center gap-2 px-4 pb-2 overflow-x-auto scrollbar-none`

- [ ] **Step 3: Verify**

Run: `npm run type-check` → clean. In `npm run dev`, eyeball `/schedule`: header,
toggle, strip and first card sit visibly closer; nothing overlaps; legend reads in
one small line.

- [ ] **Step 4: Commit**

```bash
git add src/features/schedule/ListView.tsx src/features/schedule/ScheduleShell.tsx
git commit -m "ux: tighten schedule list spacing + compact punctuality legend"
```

---

### Task 6: Full verification + hand to Nic

**Files:** none (verification only).

**Interfaces:** none.

- [ ] **Step 1: Full production build**

Run: `npm run type-check` then `npm run build`
Expected: both clean; build lists the same 46 routes as before (no route changes).

- [ ] **Step 2: Local smoke pass (all from the spec's testing list)**

With `npm run dev`, verify each and note any failure instead of "fixing forward"
blindly:

1. `/schedule` opens on today, week mode, Mon→Sun.
2. Mode toggle: switches to scrollable month, selected day auto-centres; reload page — month mode was remembered (localStorage) with **no hydration warning in the console**.
3. Strip ‹ › peeks next/previous week/month without changing the selected day or heading.
4. Heading ‹ › still steps one day; strip follows; crossing a month boundary re-windows the strip.
5. Jump calendar: opens from heading (list view only), Mon-first grid, dots on job days, month paging both directions, Esc + outside-tap + pick-a-day all close it.
6. Today button appears only off-today, returns and disappears.
7. Filter chips gone on `/schedule`, `/pending`, `/completed`; search still filters; Week tab badge intact.
8. Week tab and Month tab start Monday; installer page (`/installer`) week/month views start Monday.
9. Switch UI language to zh: day/month names stay English; toggle tooltip is Chinese. Switch to bn: new strings show English.
10. No native scrollbar under the strip or toggle row on desktop; wheel scrolls the month strip.

- [ ] **Step 3: Ask Nic before pushing**

Do NOT push. Report results to Nic, then ask whether to push `dev` so Vercel builds
the preview for his phone + desktop smoke test.

---

## Self-review notes

- Spec §1–§8 all covered: windowed strip + toggle + persistence (Task 2), paging/anchor/auto-centre/wheel (Task 2), jump calendar + Today button (Task 3), Mon-start + Mon-first grids + installer ripple (Task 1), English labels + `langToLocale` removal (Task 1), chips removal + i18n cleanup (Task 4), tightening (Task 5), `scrollbar-none` utility (Task 2), i18n en/zh/bn-English (Task 2), verification list (Task 6).
- `filterToday` deliberately survives Task 4 — WeekView badge + Today button use it.
- Type consistency checked: `DateStrip`/`JumpCalendar` prop names match their call sites in Tasks 2–3; `dayLabel(iso)`/`monthLabel(iso)` single-argument form used everywhere after Task 1; `getMonthDays` defined in Task 1, consumed in Task 2.
- `ListView`'s `lang` prop must be `LangCode` (was `string`) — handled in Task 2's rewrite.
