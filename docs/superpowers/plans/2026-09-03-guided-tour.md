# Guided App Tour Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An in-app, show-and-explain guided tour that auto-offers on first login, spotlights real UI elements step by step per role (6 role scripts), and finishes on Connect Telegram.

**Architecture:** A pure state-machine engine (`engine.ts`, standalone-tested) + presentation components (`TourOverlay`, `WelcomeCard`) + a `TourProvider` mounted inside `CompanyBar` (which every authenticated shell renders). Tour progress lives in **sessionStorage** so it survives the CompanyBar remount that happens on every route change; "seen" lives in **localStorage** per user per device. Steps anchor to `data-tour` attributes sprinkled on existing components; a missing anchor degrades the step to a centred card.

**Tech Stack:** Next.js 15 App Router, React client components, Tailwind + existing design tokens, no new dependencies. Standalone tests via `npx tsx` (repo pattern — no framework).

**Spec:** `docs/superpowers/specs/2026-09-03-guided-tour-design.md`

## Global Constraints

- **No new dependencies.** The engine, overlay and spotlight are hand-built.
- **No user-facing copy in components** — every string is an i18n key in `src/lib/i18n/en.ts` + `zh.ts`. **No `bn` keys** (frozen; `t()` falls back per key).
- **Date labels always English** — not relevant here, but never add locale date calls.
- Tour overlay z-index: **`z-[80]`** (card `z-[81]`) — above BottomNav `z-50`, NotificationDrawer `z-50`, FABs `z-[59]/z-[60]`, NavDrawer `z-[70]`.
- **Portal all tour UI to `document.body`** with a mount-gate (`useEffect` → `setMounted(true)`), exactly like `NavDrawer.tsx:81` — CompanyBar's `sticky z-30` root creates a stacking context that would cap any nested z-index.
- **Show-and-explain only:** the tour must never write to the DB, never call an API route, never send Telegram. Its only writes are localStorage/sessionStorage.
- All web-storage access wrapped in `try/catch`, read only after mount (hydration lesson).
- TypeScript strict, no `any`. Files < 500 lines.
- Standalone test files use **relative imports only** (`npx tsx` does not resolve the `@/` alias; type-only imports of `@/…` inside source files are fine — they're erased at transform).
- Commit after every task, on `dev` (work happens in `C:/Greenqubes_GitHub/greenqubes-ops`).

---

### Task 1: Role-home helper + tour engine (pure logic)

**Files:**
- Create: `src/lib/utils/roleHome.ts`
- Modify: `src/app/page.tsx:27-31` (use the helper — single source of truth)
- Create: `src/features/tour/engine.ts`
- Test: `src/features/tour/engine.test.ts`

**Interfaces:**
- Produces: `roleHome(role: Role): string`; from `engine.ts`: types `TourAction`, `TourStep`, `TourState`; constants `TOUR_STATE_KEY`, `TOUR_RESTART_KEY`, `TOUR_ROLES`; functions `tourSeenKey(userId: string): string`, `parseTourState(raw: string | null): TourState | null`, `serializeTourState(s: TourState): string`, `advance(state: TourState, dir: 1 | -1, scriptLength: number): TourState | null`.

- [ ] **Step 1: Write the failing test**

Create `src/features/tour/engine.test.ts` (repo standalone pattern — see `src/lib/utils/cron-health.test.ts` for the `check()` helper shape):

```ts
/**
 * Standalone test for the guided-tour engine (no test framework).
 * Run: npx tsx src/features/tour/engine.test.ts
 * Exits 1 on any failure.
 */
import { advance, parseTourState, serializeTourState, tourSeenKey } from './engine'
import { roleHome } from '../../lib/utils/roleHome'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`); failures++ }
}

// roleHome — single source for the login redirect + tour auto-offer gate
check('installer home', roleHome('installer'), '/installer')
check('sales home', roleHome('sales'), '/schedule')
check('designer home', roleHome('designer'), '/schedule')

// seen key matches the localStorage pattern NotificationDrawer uses
check('seen key format', tourSeenKey('abc-123'), 'tour-seen:abc-123')

// state codec round-trip
check('round-trip', parseTourState(serializeTourState({ role: 'sales', step: 3 })), { role: 'sales', step: 3 })

// parse rejects garbage — a corrupted sessionStorage value must never crash or start a tour
check('parse null', parseTourState(null), null)
check('parse junk', parseTourState('not json'), null)
check('parse wrong role', parseTourState('{"role":"admin","step":0}'), null)
check('parse negative step', parseTourState('{"role":"sales","step":-1}'), null)
check('parse float step', parseTourState('{"role":"sales","step":1.5}'), null)
check('parse missing step', parseTourState('{"role":"sales"}'), null)

// advance — +1/-1 with clamped bottom and null (= finished) past the top
check('advance forward', advance({ role: 'sales', step: 0 }, 1, 3), { role: 'sales', step: 1 })
check('advance past end → finished', advance({ role: 'sales', step: 2 }, 1, 3), null)
check('back from step 1', advance({ role: 'sales', step: 1 }, -1, 3), { role: 'sales', step: 0 })
check('back from step 0 stays', advance({ role: 'sales', step: 0 }, -1, 3), { role: 'sales', step: 0 })

if (failures) { console.error(`\n${failures} test(s) FAILED`); process.exit(1) }
console.log('\nAll tests passed')
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tsx src/features/tour/engine.test.ts`
Expected: FAIL — cannot find module `./engine` / `roleHome`.

- [ ] **Step 3: Write the implementations**

`src/lib/utils/roleHome.ts`:

```ts
import type { Role } from '@/lib/supabase/types'

// Single source for role → home page. Used by the login redirect
// (src/app/page.tsx) and the guided tour's auto-offer gate — keep them
// in lockstep by editing here only.
export function roleHome(role: Role): string {
  return role === 'installer' ? '/installer' : '/schedule'
}
```

`src/features/tour/engine.ts`:

```ts
import type { Role } from '@/lib/supabase/types'
import type { Translations } from '@/lib/i18n'

// Actions a step can fire before it shows, as `tour:<action>` window
// CustomEvents. Components opt in with tiny listeners (UserMenu, NavDrawer,
// the job form's tab state). Every action must be a safe no-op when its
// component isn't on the page.
export type TourAction = 'open-account-menu' | 'open-nav-drawer' | 'job-tab-team'

export type TourStep = {
  id: string
  targets?: string[]             // data-tour values, tried in order; omit = centred card
  route?: string                 // navigate here before showing (e.g. '/jobs/new')
  before?: TourAction | TourAction[]  // run in order (drawer → account menu)
  titleKey: keyof Translations   // typos fail the type-check
  bodyKey: keyof Translations
}

export type TourState = { role: Role; step: number }

// sessionStorage: survives the CompanyBar/TourProvider remount on every
// route change, dies with the tab. localStorage: per-device "seen" flag,
// same pattern as NotificationDrawer's overdue-seen:{userId}.
export const TOUR_STATE_KEY = 'tour-state'
export const TOUR_RESTART_KEY = 'tour-restart'
export const tourSeenKey = (userId: string) => `tour-seen:${userId}`

export const TOUR_ROLES: Role[] = ['sales', 'scheduler', 'coordinator', 'installer', 'designer', 'production']

export function serializeTourState(s: TourState): string {
  return JSON.stringify(s)
}

export function parseTourState(raw: string | null): TourState | null {
  if (!raw) return null
  try {
    const v = JSON.parse(raw) as { role?: unknown; step?: unknown }
    if (
      typeof v === 'object' && v !== null &&
      TOUR_ROLES.includes(v.role as Role) &&
      Number.isInteger(v.step) && (v.step as number) >= 0
    ) {
      return { role: v.role as Role, step: v.step as number }
    }
  } catch { /* corrupted value — treat as no tour */ }
  return null
}

// dir +1/-1. Returns null when advancing past the last step (tour finished);
// backing up from step 0 stays on step 0.
export function advance(state: TourState, dir: 1 | -1, scriptLength: number): TourState | null {
  const next = state.step + dir
  if (next >= scriptLength) return null
  return { ...state, step: Math.max(0, next) }
}
```

Modify `src/app/page.tsx`: add `import { roleHome } from '@/lib/utils/roleHome'` and replace the two redirect lines (27-31) with:

```ts
  if (profile) {
    const effectiveRole = await getEffectiveRole(profile.role)
    if (effectiveRole !== 'admin') redirect(roleHome(effectiveRole))
  }
```

(Behaviour identical: the previous code redirected installer → `/installer` and the five office roles → `/schedule`; admin fell through to the profile card, and still does.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx tsx src/features/tour/engine.test.ts` → All tests passed.
Run: `npx tsc --noEmit` → clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/roleHome.ts src/app/page.tsx src/features/tour/engine.ts src/features/tour/engine.test.ts
git commit -m "feat(tour): pure tour engine + shared role-home helper"
```

---

### Task 2: Card placement helper (pure)

**Files:**
- Create: `src/features/tour/placement.ts`
- Test: `src/features/tour/placement.test.ts`

**Interfaces:**
- Produces: `type Rect = { top: number; left: number; width: number; height: number }`, `type CardPlacement = { mode: 'anchored'; top: number; left: number } | { mode: 'sheet' }`, `placeCard(target: Rect, card: { width: number; height: number }, viewport: { width: number; height: number }): CardPlacement`.

- [ ] **Step 1: Write the failing test**

`src/features/tour/placement.test.ts`:

```ts
/**
 * Standalone test for tooltip-card placement (no test framework).
 * Run: npx tsx src/features/tour/placement.test.ts
 */
import { placeCard } from './placement'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual); const e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`); failures++ }
}

const CARD = { width: 300, height: 160 }
const PHONE = { width: 390, height: 800 }

// plenty of room below → card sits 12px under the target, aligned to its left
check('below when it fits',
  placeCard({ top: 100, left: 40, width: 120, height: 40 }, CARD, PHONE),
  { mode: 'anchored', top: 152, left: 40 })

// target near the bottom → card flips above (top = target.top - 12 - cardH)
check('flips above near the bottom',
  placeCard({ top: 700, left: 40, width: 120, height: 40 }, CARD, PHONE),
  { mode: 'anchored', top: 528, left: 40 })

// horizontal clamp: target hugs the right edge → left clamped to fit + 8px margin
check('clamped to right edge',
  placeCard({ top: 100, left: 350, width: 30, height: 30 }, CARD, PHONE),
  { mode: 'anchored', top: 142, left: 82 })

// horizontal clamp: never left of the 8px margin
check('clamped to left margin',
  placeCard({ top: 100, left: 0, width: 30, height: 30 }, CARD, PHONE),
  { mode: 'anchored', top: 142, left: 8 })

// tall target on a short viewport: no room below or above → bottom sheet
check('sheet when nothing fits',
  placeCard({ top: 20, left: 0, width: 390, height: 700 }, CARD, { width: 390, height: 780 }),
  { mode: 'sheet' })

if (failures) { console.error(`\n${failures} test(s) FAILED`); process.exit(1) }
console.log('\nAll tests passed')
```

- [ ] **Step 2: Run it to verify it fails** — `npx tsx src/features/tour/placement.test.ts` → cannot find module.

- [ ] **Step 3: Implement** `src/features/tour/placement.ts`:

```ts
export type Rect = { top: number; left: number; width: number; height: number }
export type CardPlacement =
  | { mode: 'anchored'; top: number; left: number }
  | { mode: 'sheet' }

const GAP = 12     // spotlight → card
const MARGIN = 8   // viewport edge

// Below the target when it fits, above when it doesn't, horizontally
// clamped; bottom sheet when neither side has room (small phones with a
// tall spotlight).
export function placeCard(
  target: Rect,
  card: { width: number; height: number },
  viewport: { width: number; height: number },
): CardPlacement {
  const left = Math.min(Math.max(MARGIN, target.left), viewport.width - card.width - MARGIN)
  const below = target.top + target.height + GAP
  if (below + card.height + MARGIN <= viewport.height) return { mode: 'anchored', top: below, left }
  const above = target.top - GAP - card.height
  if (above >= MARGIN) return { mode: 'anchored', top: above, left }
  return { mode: 'sheet' }
}
```

- [ ] **Step 4: Run tests** — placement + engine suites pass; `npx tsc --noEmit` clean.

- [ ] **Step 5: Commit**

```bash
git add src/features/tour/placement.ts src/features/tour/placement.test.ts
git commit -m "feat(tour): tooltip card placement helper"
```

---

### Task 3: Chrome i18n keys + WelcomeCard + TourOverlay

**Files:**
- Modify: `src/lib/i18n/en.ts`, `src/lib/i18n/zh.ts` (append keys)
- Create: `src/features/tour/WelcomeCard.tsx`
- Create: `src/features/tour/TourOverlay.tsx`

**Interfaces:**
- Consumes: `placeCard`/`Rect` from Task 2; `t(lang, key)` from `@/lib/i18n`.
- Produces: `WelcomeCard({ lang, onStart, onSkip }: { lang: LangCode; onStart: () => void; onSkip: () => void })`; `TourOverlay({ lang, el, titleKey, bodyKey, stepNo, total, isFirst, isLast, onNext, onBack, onExit })` where `el: Element | null` (null → centred card) and `titleKey`/`bodyKey: keyof Translations`.

- [ ] **Step 1: Add the chrome keys**

Append to the `en` object in `src/lib/i18n/en.ts` (under a `// ── Guided tour ──` comment) and the matching `zh` entries in `zh.ts`:

| key | en | zh |
|---|---|---|
| `tourWelcomeTitle` | `Welcome to GreenQubes!` | `欢迎使用 GreenQubes！` |
| `tourWelcomeBody` | `Want a quick walkthrough? It takes about two minutes and shows you where everything lives. You can reopen it anytime from your profile picture.` | `要不要快速了解一下？大约两分钟，带你看看每个功能在哪里。之后随时可以从头像菜单重新打开。` |
| `tourStart` | `Start tour` | `开始导览` |
| `tourSkip` | `Skip for now` | `暂时跳过` |
| `tourNext` | `Next` | `下一步` |
| `tourBack` | `Back` | `上一步` |
| `tourFinish` | `Finish` | `完成` |
| `tourExit` | `Exit tour` | `退出导览` |
| `tourMenuLabel` | `App tour` | `应用导览` |

- [ ] **Step 2: Create `src/features/tour/WelcomeCard.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { t, type LangCode } from '@/lib/i18n'

// First-login offer. Portaled to document.body with a mount gate —
// CompanyBar's sticky z-30 root is a stacking context (see NavDrawer.tsx).
export function WelcomeCard({ lang, onStart, onSkip }: {
  lang: LangCode
  onStart: () => void
  onSkip: () => void
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  if (!mounted) return null

  return createPortal(
    <div data-tour-ui className="fixed inset-0 z-[80] flex items-center justify-center px-6 bg-black/40">
      <div className="w-full max-w-sm bg-paper border border-line rounded-card shadow-lg p-6 space-y-4">
        <p className="font-display text-lg font-medium text-ink">{t(lang, 'tourWelcomeTitle')}</p>
        <p className="text-sm text-ink2 leading-relaxed">{t(lang, 'tourWelcomeBody')}</p>
        <div className="flex gap-2 pt-1">
          <button
            onClick={onSkip}
            className="flex-1 py-2 rounded-lg text-sm font-medium border border-line text-ink2 hover:border-ink2 transition-colors"
          >
            {t(lang, 'tourSkip')}
          </button>
          <button
            onClick={onStart}
            className="flex-1 py-2 rounded-lg text-sm font-medium bg-terracotta text-white hover:opacity-90 transition-opacity"
          >
            {t(lang, 'tourStart')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
```

- [ ] **Step 3: Create `src/features/tour/TourOverlay.tsx`**

```tsx
'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { t, type LangCode, type Translations } from '@/lib/i18n'
import { placeCard, type Rect } from './placement'

const PAD = 6 // spotlight breathing room around the target

interface Props {
  lang: LangCode
  el: Element | null      // spotlight target; null → centred card, full dim
  titleKey: keyof Translations
  bodyKey: keyof Translations
  stepNo: number          // 1-based
  total: number
  isFirst: boolean
  isLast: boolean
  onNext: () => void
  onBack: () => void
  onExit: () => void
}

export function TourOverlay({ lang, el, titleKey, bodyKey, stepNo, total, isFirst, isLast, onNext, onBack, onExit }: Props) {
  const [mounted, setMounted] = useState(false)
  const [rect, setRect] = useState<Rect | null>(null)
  const [cardStyle, setCardStyle] = useState<React.CSSProperties>({ visibility: 'hidden' })
  const [sheet, setSheet] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setMounted(true) }, [])

  // Measure the target; re-measure on resize + scroll (capture phase so
  // scrolls inside nested containers count too).
  useEffect(() => {
    if (!el) { setRect(null); return }
    const measure = () => {
      const r = el.getBoundingClientRect()
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
    }
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [el])

  // Position the card once its size is known.
  useLayoutEffect(() => {
    const card = cardRef.current
    if (!card) return
    if (!rect) { setSheet(false); setCardStyle({ visibility: 'hidden' }); return }
    const placed = placeCard(
      { top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 },
      { width: card.offsetWidth, height: card.offsetHeight },
      { width: window.innerWidth, height: window.innerHeight },
    )
    if (placed.mode === 'sheet') { setSheet(true); setCardStyle({}) }
    else { setSheet(false); setCardStyle({ top: placed.top, left: placed.left }) }
  }, [rect, stepNo])

  if (!mounted) return null

  const cardBody = (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-display text-base font-medium text-ink">{t(lang, titleKey)}</p>
        <span className="text-[11px] text-muted shrink-0">{stepNo} / {total}</span>
      </div>
      <p className="text-sm text-ink2 leading-relaxed mt-1.5">{t(lang, bodyKey)}</p>
      <div className="flex items-center gap-2 mt-3">
        <button onClick={onExit} className="text-xs text-muted hover:text-ink transition-colors mr-auto">
          {t(lang, 'tourExit')}
        </button>
        {!isFirst && (
          <button onClick={onBack} className="px-3 py-1.5 rounded-lg text-sm font-medium border border-line text-ink2 hover:border-ink2 transition-colors">
            {t(lang, 'tourBack')}
          </button>
        )}
        <button onClick={onNext} className="px-4 py-1.5 rounded-lg text-sm font-medium bg-terracotta text-white hover:opacity-90 transition-opacity">
          {t(lang, isLast ? 'tourFinish' : 'tourNext')}
        </button>
      </div>
    </>
  )

  return createPortal(
    <div data-tour-ui>
      {/* Click shield — show-and-explain: nothing underneath is tappable */}
      <div className="fixed inset-0 z-[80]" />
      {rect ? (
        // Spotlight: transparent hole, the giant box-shadow paints the scrim.
        <div
          className="fixed z-[80] rounded-xl pointer-events-none transition-all duration-200"
          style={{
            top: rect.top - PAD, left: rect.left - PAD,
            width: rect.width + PAD * 2, height: rect.height + PAD * 2,
            boxShadow: '0 0 0 100vmax rgba(0,0,0,0.55)',
          }}
        />
      ) : (
        <div className="fixed inset-0 z-[80] bg-black/55" />
      )}
      {rect && !sheet ? (
        <div ref={cardRef} className="fixed z-[81] w-[300px] max-w-[calc(100vw-16px)] bg-paper border border-line rounded-card shadow-lg p-4" style={cardStyle}>
          {cardBody}
        </div>
      ) : rect && sheet ? (
        <div ref={cardRef} className="fixed z-[81] inset-x-0 bottom-0 bg-paper border-t border-line rounded-t-2xl shadow-lg p-4 pb-[max(env(safe-area-inset-bottom),16px)]">
          {cardBody}
        </div>
      ) : (
        <div ref={cardRef} className="fixed z-[81] inset-0 flex items-center justify-center px-6 pointer-events-none">
          <div className="w-full max-w-sm bg-paper border border-line rounded-card shadow-lg p-5 pointer-events-auto">
            {cardBody}
          </div>
        </div>
      )}
    </div>,
    document.body,
  )
}
```

- [ ] **Step 4: Verify** — `npx tsc --noEmit` clean (components aren't wired anywhere yet; that's Task 4).

- [ ] **Step 5: Commit**

```bash
git add src/lib/i18n/en.ts src/lib/i18n/zh.ts src/features/tour/WelcomeCard.tsx src/features/tour/TourOverlay.tsx
git commit -m "feat(tour): overlay + welcome card presentation, chrome i18n"
```

---

### Task 4: Steps registry stub + TourProvider + CompanyBar mount

**Files:**
- Create: `src/features/tour/steps/index.ts` (empty registry — scripts arrive in Tasks 7-10)
- Create: `src/features/tour/TourProvider.tsx`
- Modify: `src/components/CompanyBar.tsx` (mount in **both** return branches)

**Interfaces:**
- Consumes: everything from Tasks 1-3.
- Produces: `scriptForRole(role: Role): TourStep[] | null` and `TOUR_SCRIPTS: Partial<Record<Role, TourStep[]>>` from `steps/index.ts`; `TourProvider({ lang, role }: { lang?: LangCode; role?: Role })`.

- [ ] **Step 1: Create `src/features/tour/steps/index.ts`**

```ts
import type { Role } from '@/lib/supabase/types'
import type { TourStep } from '../engine'

// Role → script registry. Tasks 8-10 add one entry per role; a role with
// no entry simply never offers a tour (the provider checks scriptForRole).
export const TOUR_SCRIPTS: Partial<Record<Role, TourStep[]>> = {}

export function scriptForRole(role: Role): TourStep[] | null {
  return TOUR_SCRIPTS[role] ?? null
}
```

- [ ] **Step 2: Create `src/features/tour/TourProvider.tsx`**

```tsx
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { roleHome } from '@/lib/utils/roleHome'
import {
  advance, parseTourState, serializeTourState, tourSeenKey,
  TOUR_RESTART_KEY, TOUR_STATE_KEY,
  type TourState,
} from './engine'
import { scriptForRole } from './steps'
import { TourOverlay } from './TourOverlay'
import { WelcomeCard } from './WelcomeCard'
import type { LangCode } from '@/lib/i18n'
import type { Role } from '@/lib/supabase/types'

const POLL_MS = 120
const POLL_TIMEOUT_MS = 2000

// A data-tour name can match several mounted elements (CompanyBar renders
// mobile + desktop variants; BottomNav and NavDrawer share tab names) —
// take the first one that's actually visible at this breakpoint AND on
// screen. The on-screen check matters: NavDrawer's closed panel is
// translated off-viewport but keeps a non-zero size, so a width check
// alone would match rows inside a closed drawer.
function isOnScreen(r: DOMRect): boolean {
  return r.width > 0 && r.height > 0 &&
    r.right > 0 && r.bottom > 0 &&
    r.left < window.innerWidth && r.top < window.innerHeight
}

function findVisibleTarget(names: string[] | undefined): Element | null {
  if (!names) return null
  for (const name of names) {
    const els = document.querySelectorAll(`[data-tour="${name}"]`)
    for (const el of Array.from(els)) {
      if (isOnScreen(el.getBoundingClientRect())) return el
    }
  }
  return null
}

// Mounted inside CompanyBar (both branches), so it exists on every
// authenticated page. Remounts on navigation — sessionStorage carries the
// running tour across; role may be undefined on job-form pages, which is
// fine: a resumed tour knows its role from the stored state.
export function TourProvider({ lang = 'en', role }: { lang?: LangCode; role?: Role }) {
  const [phase, setPhase] = useState<'idle' | 'offer' | 'running'>('idle')
  const [tour, setTour] = useState<TourState | null>(null)
  const [target, setTarget] = useState<Element | null>(null)
  const [ready, setReady] = useState(false)
  const userIdRef = useRef<string | null>(null)
  const pathname = usePathname()
  const router = useRouter()

  const readSession = (k: string) => { try { return sessionStorage.getItem(k) } catch { return null } }
  const writeSession = (k: string, v: string) => { try { sessionStorage.setItem(k, v) } catch { /* best effort */ } }
  const clearSession = (k: string) => { try { sessionStorage.removeItem(k) } catch { /* best effort */ } }
  const markSeen = useCallback(() => {
    const id = userIdRef.current
    if (id) try { localStorage.setItem(tourSeenKey(id), '1') } catch { /* best effort */ }
  }, [])

  const begin = useCallback((r: Role) => {
    markSeen()
    const s: TourState = { role: r, step: 0 }
    writeSession(TOUR_STATE_KEY, serializeTourState(s))
    setTour(s)
    setPhase('running')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markSeen])

  const finish = useCallback(() => {
    clearSession(TOUR_STATE_KEY)
    window.dispatchEvent(new CustomEvent('tour:close-menus'))
    markSeen()
    setTour(null)
    setPhase('idle')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markSeen])

  // Mount: resume a running tour, honour an App-tour restart, or offer once.
  useEffect(() => {
    createClient().auth.getSession().then(({ data: { session } }) => {
      userIdRef.current = session?.user?.id ?? null

      const resumed = parseTourState(readSession(TOUR_STATE_KEY))
      if (resumed && scriptForRole(resumed.role)) {
        setTour(resumed)
        setPhase('running')
        return
      }
      if (!role || !scriptForRole(role) || !userIdRef.current) return

      if (readSession(TOUR_RESTART_KEY)) {
        clearSession(TOUR_RESTART_KEY)
        begin(role)
        return
      }
      if (pathname !== roleHome(role)) return
      let seen: string | null = '1'
      try { seen = localStorage.getItem(tourSeenKey(userIdRef.current)) } catch { /* can't read → don't nag */ }
      if (!seen) setPhase('offer')
    })
    // Mount-only: pathname/role changes remount this component anyway.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Step change: navigate if needed, fire the before-action, find the target.
  useEffect(() => {
    if (phase !== 'running' || !tour) return
    const script = scriptForRole(tour.role)
    if (!script) { setPhase('idle'); return }
    const step = script[tour.step]
    if (!step) { finish(); return }

    if (step.route && pathname !== step.route) {
      writeSession(TOUR_STATE_KEY, serializeTourState(tour))
      router.push(step.route)
      return // the destination page's provider resumes from sessionStorage
    }
    // Menu state is deterministic per step: close everything first, then run
    // the step's before-actions in order, staggered so each action's
    // re-render lands before the next one needs it (open the drawer, THEN
    // the account menu inside it). The target poll below simply keeps
    // retrying until the last menu has opened.
    window.dispatchEvent(new CustomEvent('tour:close-menus'))
    const actions = step.before ? (Array.isArray(step.before) ? step.before : [step.before]) : []
    actions.forEach((a, i) => {
      window.setTimeout(() => window.dispatchEvent(new CustomEvent(`tour:${a}`)), 60 + i * 180)
    })

    setReady(false)
    setTarget(null)
    let cancelled = false
    const t0 = Date.now()
    let timer = 0
    const tick = () => {
      if (cancelled) return
      const el = findVisibleTarget(step.targets)
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'auto' })
        setTarget(el)
        setReady(true)
      } else if (!step.targets || Date.now() - t0 >= POLL_TIMEOUT_MS) {
        setTarget(null) // centred-card fallback — the tour never stalls
        setReady(true)
      } else {
        timer = window.setTimeout(tick, POLL_MS)
      }
    }
    timer = window.setTimeout(tick, 0)
    return () => { cancelled = true; window.clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, tour, pathname])

  const move = (dir: 1 | -1) => {
    if (!tour) return
    const script = scriptForRole(tour.role)
    if (!script) { setPhase('idle'); return }
    const next = advance(tour, dir, script.length)
    if (!next) { finish(); return }
    writeSession(TOUR_STATE_KEY, serializeTourState(next))
    setTour(next)
  }

  if (phase === 'offer' && role) {
    return (
      <WelcomeCard
        lang={lang}
        onStart={() => begin(role)}
        onSkip={() => { markSeen(); setPhase('idle') }}
      />
    )
  }

  if (phase === 'running' && tour && ready) {
    const script = scriptForRole(tour.role)
    const step = script?.[tour.step]
    if (!script || !step) return null
    return (
      <TourOverlay
        lang={lang}
        el={target}
        titleKey={step.titleKey}
        bodyKey={step.bodyKey}
        stepNo={tour.step + 1}
        total={script.length}
        isFirst={tour.step === 0}
        isLast={tour.step === script.length - 1}
        onNext={() => move(1)}
        onBack={() => move(-1)}
        onExit={finish}
      />
    )
  }

  return null
}
```

- [ ] **Step 3: Mount in `src/components/CompanyBar.tsx`**

Add `import { TourProvider } from '@/features/tour/TourProvider'`. In the **role-less branch** (line 22-35), add `<TourProvider lang={lang} />` just inside the root div; in the **role branch** (line 37-63), add `<TourProvider lang={lang} role={role} />` just inside the root div. (Rendering it inside the sticky bar is fine — all its visible output portals to `document.body`.)

- [ ] **Step 4: Verify** — `npx tsc --noEmit` clean; `npm run build` green. Manual sanity: `npm run dev`, sign in — nothing visible changes (registry is empty, so no tour offers yet).

- [ ] **Step 5: Commit**

```bash
git add src/features/tour/steps/index.ts src/features/tour/TourProvider.tsx src/components/CompanyBar.tsx
git commit -m "feat(tour): TourProvider mounted in CompanyBar, empty script registry"
```

---

### Task 5: UserMenu + NavDrawer — anchors, listeners, App tour row

**Files:**
- Modify: `src/components/UserMenu.tsx`
- Modify: `src/components/NavDrawer.tsx`

**Interfaces:**
- Consumes: `TOUR_RESTART_KEY` from `engine.ts`.
- Produces: `data-tour` anchors `account`, `connect-telegram`, `menu`; window-event handling for `tour:open-account-menu`, `tour:open-nav-drawer`, `tour:close-menus`; the App tour menu row.

- [ ] **Step 1: UserMenu changes**

All in `src/components/UserMenu.tsx`:

1. Imports: add `Compass` to the lucide import; add `import { t } from '@/lib/i18n'` (extend the existing type-only i18n import) and `import { TOUR_RESTART_KEY } from '@/features/tour/engine'`.
2. **Anchor the avatar:** add `data-tour="account"` to the avatar `<button>` (line 168).
3. **Anchor Connect Telegram:** add `data-tour="connect-telegram"` to the `<a href="/api/telegram/link">` (line 253).
4. **Guard the outside-click closer** (line 101-107) — clicks on tour UI must not close the menu mid-finale:

```ts
    function onPointerDown(e: PointerEvent) {
      const el = e.target as Element | null
      if (el?.closest?.('[data-tour-ui]')) return // tour card clicks don't close the menu
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
```

5. **Tour event listeners** — new effect next to the outside-click one. Two UserMenu instances are mounted (desktop top bar + inside NavDrawer); only the visible one may react:

```ts
  // Guided tour: open this menu when the tour asks — but only the instance
  // that's actually visible AND on screen. Two copies are mounted (desktop
  // top bar; NavDrawer's footer), and the closed drawer is translated
  // off-viewport with a non-zero size, so a width check alone would open
  // the wrong one.
  useEffect(() => {
    function onOpen() {
      const r = ref.current?.getBoundingClientRect()
      if (r && r.width > 0 && r.right > 0 && r.left < window.innerWidth) setOpen(true)
    }
    function onClose() { setOpen(false) }
    window.addEventListener('tour:open-account-menu', onOpen)
    window.addEventListener('tour:close-menus', onClose)
    return () => {
      window.removeEventListener('tour:open-account-menu', onOpen)
      window.removeEventListener('tour:close-menus', onClose)
    }
  }, [])
```

6. **App tour row** — insert between the Connect Telegram `<a>` and the admin block (after line 263), reusing the row styling of the dark-mode button:

```tsx
          {/* Guided tour — restart from the role home page. The '/' redirect
              resolves the role server-side, so this works from any page,
              including ones whose CompanyBar has no role prop. */}
          <button
            onClick={() => {
              setOpen(false)
              try { sessionStorage.setItem(TOUR_RESTART_KEY, '1') } catch { /* best effort */ }
              router.push('/')
            }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink2 hover:bg-bg hover:text-ink transition-colors border-t border-line"
          >
            <Compass size={14} strokeWidth={1.8} />
            {t(lang, 'tourMenuLabel')}
          </button>
```

- [ ] **Step 2: NavDrawer changes**

All in `src/components/NavDrawer.tsx`:

1. **Anchor the hamburger:** add `data-tour="menu"` to the trigger `<button>` (line 61), and add `ref={triggerRef}` with `const triggerRef = useRef<HTMLButtonElement>(null)`.
2. **Anchor the tabs:** in the `tabs.map` (line 127), add `data-tour={`nav-${href.slice(1)}`}` to the `<Link>`.
3. **Tour event listeners** — new effect; visibility check keeps this a no-op on desktop where the trigger is `display:none`:

```ts
  // Guided tour: open the drawer when the tour asks (mobile only — the
  // trigger has zero size at ≥lg, so this is a no-op on desktop).
  useEffect(() => {
    function onOpen() {
      if (triggerRef.current && triggerRef.current.getBoundingClientRect().width > 0) setOpen(true)
    }
    function onClose() { setOpen(false) }
    window.addEventListener('tour:open-nav-drawer', onOpen)
    window.addEventListener('tour:close-menus', onClose)
    return () => {
      window.removeEventListener('tour:open-nav-drawer', onOpen)
      window.removeEventListener('tour:close-menus', onClose)
    }
  }, [])
```

- [ ] **Step 3: Verify** — `npx tsc --noEmit` clean. Manual: in `npm run dev`, the App tour row shows in the account menu (it navigates home and does nothing more — the registry is still empty; that's expected until Task 8).

- [ ] **Step 4: Commit**

```bash
git add src/components/UserMenu.tsx src/components/NavDrawer.tsx
git commit -m "feat(tour): account-menu + nav-drawer anchors, listeners, App tour row"
```

---

### Task 6: Page anchors — BottomNav, bell, schedule, job form, installer, FCFS, Design Load

**Files:**
- Modify: `src/components/BottomNav.tsx`
- Modify: `src/features/notifications/NotificationDrawer.tsx`
- Modify: `src/features/schedule/ScheduleShell.tsx`, `src/features/schedule/DateStrip.tsx`
- Modify: `src/features/job-detail/NewJobShell.tsx` (and/or `src/features/job-detail/JobFormLayout.tsx` — wherever the listed elements live)
- Modify: `src/features/installer/InstallerShell.tsx`
- Modify: `src/features/fcfs/FCFSShell.tsx`
- Modify: `src/features/design-load/DesignLoadShell.tsx`

**Interfaces:**
- Produces: the full anchor vocabulary the scripts (Tasks 7-10) target:
  `nav-schedule` `nav-fcfs` `nav-design-load` `nav-completed` `nav-pending` `nav-installer` `nav-assistant` (BottomNav + NavDrawer tabs) · `bell` · `schedule-views` · `date-strip` · `new-job` · `job-tabs` · `job-details` · `job-team` · `job-actions` · `installer-tabs` · `fcfs-board` · `fcfs-zoom` · `design-board` · `design-toggle`; plus the `tour:job-tab-team` listener.

These are pure attribute additions (plus one 3-line listener) — no behaviour, layout or prop changes. For each, find the element described and add the attribute:

- [ ] **Step 1: `BottomNav.tsx`** — in the `tabs.map` `<Link>` (line 24), add `data-tour={`nav-${href.slice(1)}`}` (mirrors NavDrawer so one step name works at both breakpoints).
- [ ] **Step 2: `NotificationDrawer.tsx`** — add `data-tour="bell"` to the bell trigger button (the button that toggles the drawer open, rendered in the CompanyBar slot).
- [ ] **Step 3: `ScheduleShell.tsx`** — add `data-tour="schedule-views"` to the list/week/month view-toggle group's container; add `data-tour="new-job"` to the New Job button (the button/link that routes to `/jobs/new`). `DateStrip.tsx` — add `data-tour="date-strip"` to the strip's root element.
- [ ] **Step 4: Job form** (elements live in `NewJobShell.tsx` / `JobFormLayout.tsx` — put each attribute wherever that element is actually rendered):
  - `data-tour="job-tabs"` on the phone tab bar (Details / Team / Files / Chat).
  - `data-tour="job-details"` on the Details/core section card container.
  - `data-tour="job-team"` on the Team card container (the one holding the installer grid).
  - `data-tour="job-actions"` on the sticky action bar (Save / Push to Schedule).
  - **`tour:job-tab-team` listener** where the active-tab state lives — on the event, switch the phone tab state to Team; harmless on PC (both columns always visible):

```ts
  // Guided tour: jump the phone layout to the Team tab so its step can
  // spotlight the card (no-op on PC where all cards are visible).
  useEffect(() => {
    function onTeamTab() { setActiveTab('team') }   // ← adjust to the real setter/tab id
    window.addEventListener('tour:job-tab-team', onTeamTab)
    return () => window.removeEventListener('tour:job-tab-team', onTeamTab)
  }, [])
```

- [ ] **Step 5: `InstallerShell.tsx`** — add `data-tour="installer-tabs"` to the Today / Up next / This week tab row container.
- [ ] **Step 6: `FCFSShell.tsx`** — add `data-tour="fcfs-board"` to the timeline board's outer container; add `data-tour="fcfs-zoom"` to the AM/PM/9-6 zoom control group.
- [ ] **Step 7: `DesignLoadShell.tsx`** — add `data-tour="design-board"` to the designer-bars chart container; add `data-tour="design-toggle"` to the Board | My Jobs toggle (designer-only element — other roles' scripts don't target it).
- [ ] **Step 8: Verify** — `npx tsc --noEmit` clean; visual spot-check in dev that nothing moved (attributes are inert).
- [ ] **Step 9: Commit**

```bash
git add src/components/BottomNav.tsx src/features/notifications/NotificationDrawer.tsx src/features/schedule src/features/job-detail src/features/installer/InstallerShell.tsx src/features/fcfs/FCFSShell.tsx src/features/design-load/DesignLoadShell.tsx
git commit -m "feat(tour): data-tour anchors across shells + job-form tab event"
```

---

### Task 7: Shared steps + script-validation test + shared copy

**Files:**
- Create: `src/features/tour/steps/common.ts`
- Modify: `src/lib/i18n/en.ts`, `src/lib/i18n/zh.ts`
- Test: `src/features/tour/steps/scripts.test.ts`

**Interfaces:**
- Produces: `bellStep: TourStep`, `outroSteps: TourStep[]` (account → connect-telegram → done), shared step constants `scheduleViewsStep`, `dateStripStep`, `completedTabStep` reused by several role scripts.
- The validation test auto-covers every script later registered in `TOUR_SCRIPTS`.

- [ ] **Step 1: Write the validation test** (fails until common keys exist; keeps passing as Tasks 8-10 add scripts)

`src/features/tour/steps/scripts.test.ts`:

```ts
/**
 * Standalone validation of all registered tour scripts (no test framework).
 * Run: npx tsx src/features/tour/steps/scripts.test.ts
 * Checks every script: non-empty, unique ids, closes with the shared outro,
 * and every i18n key exists in BOTH en and zh (zh is Partial — a missing
 * zh key silently falls back to English, which we don't want for the tour).
 */
import { TOUR_SCRIPTS } from './index'
import { bellStep, outroSteps } from './common'
import { en } from '../../../lib/i18n/en'
import { zh } from '../../../lib/i18n/zh'

let failures = 0
function assert(name: string, ok: boolean, detail = '') {
  if (ok) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`); failures++ }
}

// the shared steps must themselves be sound
assert('bell step targets the bell', bellStep.targets?.[0] === 'bell')
assert('outro is account → telegram → done',
  outroSteps.map(s => s.id).join(',') === 'account,telegram,done')

const entries = Object.entries(TOUR_SCRIPTS)
assert('at least one script registered', entries.length > 0)

for (const [role, steps] of entries) {
  if (!steps) continue
  assert(`${role}: non-empty`, steps.length > 0)
  const ids = steps.map(s => s.id)
  assert(`${role}: unique step ids`, new Set(ids).size === ids.length)
  assert(`${role}: ends with the shared outro`,
    ids.slice(-3).join(',') === 'account,telegram,done')
  for (const s of steps) {
    assert(`${role}/${s.id}: en has ${s.titleKey}`, s.titleKey in en)
    assert(`${role}/${s.id}: en has ${s.bodyKey}`, s.bodyKey in en)
    assert(`${role}/${s.id}: zh has ${s.titleKey}`, s.titleKey in zh)
    assert(`${role}/${s.id}: zh has ${s.bodyKey}`, s.bodyKey in zh)
  }
}

if (failures) { console.error(`\n${failures} check(s) FAILED`); process.exit(1) }
console.log('\nAll script checks passed')
```

- [ ] **Step 2: Run it to verify it fails** — `npx tsx src/features/tour/steps/scripts.test.ts` → cannot find `./common`.

- [ ] **Step 3: Add the shared i18n keys** (en.ts + zh.ts, same `// ── Guided tour ──` block):

| key | en | zh |
|---|---|---|
| `tourBellTitle` | `Notifications` | `通知` |
| `tourBellBody` | `The bell shows alerts about your jobs — overdue warnings and updates. Red means something needs a look.` | `铃铛显示与你的工作相关的提醒——逾期警告和更新。红色表示需要处理。` |
| `tourAccountTitle` | `Your account` | `你的账户` |
| `tourAccountBody` | `Your profile picture opens the account menu: language, dark mode, and Telegram.` | `点击头像打开账户菜单：语言、深色模式和 Telegram。` |
| `tourTelegramTitle` | `Connect Telegram — do this now` | `连接 Telegram——现在就做` |
| `tourTelegramBody` | `Two taps and every notification about your jobs also reaches your Telegram. Tap it as soon as the tour ends.` | `只需两步，你的工作通知就会同时发送到你的 Telegram。导览一结束就点它。` |
| `tourDoneTitle` | `You're all set!` | `一切就绪！` |
| `tourDoneBody` | `That's the essentials. Reopen this tour anytime: profile picture → App tour.` | `基本功能都介绍完了。随时可以重新打开导览：头像 → 应用导览。` |
| `tourScheduleViewsTitle` | `Schedule views` | `日程视图` |
| `tourScheduleViewsBody` | `Switch between list, week and month. The list shows one day at a time.` | `可切换列表、周和月视图。列表视图按天显示。` |
| `tourDateStripTitle` | `Moving between days` | `切换日期` |
| `tourDateStripBody` | `Tap a date, page with the arrows, or use the amber Today button to jump back.` | `点选日期、用箭头翻页，或点琥珀色的"今天"按钮快速返回。` |
| `tourCompletedTitle` | `Completed jobs` | `已完成工作` |
| `tourCompletedBody` | `Finished jobs live here, out of the way of the live schedule.` | `已完成的工作集中在这里，不占用日程表。` |

- [ ] **Step 4: Create `src/features/tour/steps/common.ts`**

```ts
import type { TourStep } from '../engine'

// Steps shared by several role scripts. The outro is the mandated closer for
// EVERY script (scripts.test.ts enforces it): account area → Connect
// Telegram → done. 'open-nav-drawer' is a mobile-only no-op on desktop;
// 'account' resolves to whichever UserMenu avatar is visible.
export const bellStep: TourStep = {
  id: 'bell', targets: ['bell'],
  titleKey: 'tourBellTitle', bodyKey: 'tourBellBody',
}

export const scheduleViewsStep: TourStep = {
  id: 'schedule-views', route: '/schedule', targets: ['schedule-views'],
  titleKey: 'tourScheduleViewsTitle', bodyKey: 'tourScheduleViewsBody',
}

export const dateStripStep: TourStep = {
  id: 'date-strip', targets: ['date-strip'],
  titleKey: 'tourDateStripTitle', bodyKey: 'tourDateStripBody',
}

// Any step that targets a nav tab needs before: 'open-nav-drawer' — on the
// phone the tabs live inside the closed hamburger drawer (on desktop the
// action is a no-op and the target resolves to BottomNav instead).
export const completedTabStep: TourStep = {
  id: 'completed-tab', before: 'open-nav-drawer', targets: ['nav-completed'],
  titleKey: 'tourCompletedTitle', bodyKey: 'tourCompletedBody',
}

export const outroSteps: TourStep[] = [
  { id: 'account', before: 'open-nav-drawer', targets: ['account'],
    titleKey: 'tourAccountTitle', bodyKey: 'tourAccountBody' },
  // Both actions in order: on the phone the account menu lives inside the
  // drawer, so the drawer must be (re)opened before the menu can.
  { id: 'telegram', before: ['open-nav-drawer', 'open-account-menu'], targets: ['connect-telegram'],
    titleKey: 'tourTelegramTitle', bodyKey: 'tourTelegramBody' },
  { id: 'done', titleKey: 'tourDoneTitle', bodyKey: 'tourDoneBody' },
]
```

- [ ] **Step 5: Run the tests** — scripts suite passes (registry still empty → only the common-step checks run); engine + placement suites still pass; `npx tsc --noEmit` clean.

- [ ] **Step 6: Commit**

```bash
git add src/features/tour/steps/common.ts src/features/tour/steps/scripts.test.ts src/lib/i18n/en.ts src/lib/i18n/zh.ts
git commit -m "feat(tour): shared steps, script validation suite, shared copy"
```

---

### Task 8: Sales + scheduler scripts

**Files:**
- Create: `src/features/tour/steps/sales.ts`, `src/features/tour/steps/scheduler.ts`
- Modify: `src/features/tour/steps/index.ts` (register), `src/lib/i18n/en.ts`, `src/lib/i18n/zh.ts`

**Interfaces:**
- Consumes: `TourStep`, shared steps from `common.ts`.
- Produces: `salesSteps: TourStep[]`, `schedulerSteps: TourStep[]`, registered in `TOUR_SCRIPTS`. From this task on, **the sales and scheduler tours are live end-to-end.**

- [ ] **Step 1: Add the i18n keys** (en + zh, same block):

| key | en | zh |
|---|---|---|
| `tourSalesIntroTitle` | `Your role: Sales` | `你的角色：销售` |
| `tourSalesIntroBody` | `You create jobs, push them onto the schedule, and suggest installers. This tour shows each step.` | `你负责创建工作、推送到日程表并推荐安装人员。本导览会逐一介绍。` |
| `tourPendingTitle` | `Your Pending tab` | `待处理标签` |
| `tourPendingBody` | `Jobs you've created but not pushed yet. Pending jobs are private to you (and any coordinator assigned on them).` | `你已创建但尚未推送的工作。待处理工作只有你（和指派的统筹）能看到。` |
| `tourNewJobTitle` | `Creating a job` | `创建工作` |
| `tourNewJobBody` | `This button opens the New Job form. Let's have a look.` | `这个按钮打开新建工作表单。我们去看看。` |
| `tourJobFormTitle` | `The job form` | `工作表单` |
| `tourJobFormBody` | `Details holds the client, date, time and location — everything the team needs to schedule the job.` | `"详情"包含客户、日期、时间和地点——团队排程所需的信息都在这里。` |
| `tourJobTeamTitle` | `Team & installers` | `团队与安装人员` |
| `tourJobTeamBody` | `Pick installers here. Yellow = your suggestion; the scheduler confirms it to green. You can also assign a designer.` | `在这里选择安装人员。黄色＝你的建议；排程确认后变绿色。你也可以指派设计师。` |
| `tourJobActionsTitle` | `Push to Schedule` | `推送到日程` |
| `tourJobActionsBody` | `Save keeps the job pending; Push to Schedule makes it live and notifies the schedulers. A warning pops up if your installer is double-booked.` | `"保存"让工作保持待处理；"推送到日程"正式生效并通知排程。如果安装人员时间冲突，会弹出警告。` |
| `tourFcfsTitle` | `The FCFS board` | `FCFS 看板` |
| `tourFcfsBody` | `A day timeline of every job in queue order, with installer availability. Handy for seeing where your job stands.` | `按排队顺序显示当天所有工作和安装人员的时间安排。方便查看你的工作排在哪里。` |
| `tourDesignTabTitle` | `Design workload` | `设计工作量` |
| `tourDesignTabBody` | `The Design tab shows every designer's current load — check it before assigning a designer.` | `"设计"标签显示每位设计师当前的工作量——指派设计师前先看看。` |
| `tourSchedulerIntroTitle` | `Your role: Scheduler` | `你的角色：排程` |
| `tourSchedulerIntroBody` | `You run the company schedule: assign installers, resolve clashes, and complete jobs.` | `你负责公司日程：指派安装人员、解决冲突并完成工作。` |
| `tourSchedulerCompletedBody` | `Finished jobs live here. Select several to complete or revert them in bulk.` | `已完成的工作在这里。可多选进行批量完成或撤销。` |
| `tourFcfsSchedulerTitle` | `FCFS — your main tool` | `FCFS——你的主要工具` |
| `tourFcfsSchedulerBody` | `Jobs ranked first-come-first-served, with installer bars coloured by punctuality. Red = strict timing, blue = flexible.` | `工作按先到先得排序，安装人员条按守时要求着色。红色＝严格准时，蓝色＝弹性时间。` |
| `tourAssignTitle` | `Assigning installers` | `指派安装人员` |
| `tourAssignBody` | `Tap a job row to open the assignment panel: confirm suggestions, add installers, then Save & Notify — Telegram tells everyone involved.` | `点击工作行打开指派面板：确认建议、添加安装人员，然后"保存并通知"——Telegram 会通知所有相关人员。` |
| `tourSuggestVsAssignTitle` | `Yellow vs green` | `黄色与绿色` |
| `tourSuggestVsAssignBody` | `Sales and coordinators suggest installers (yellow). Only your formal assignment turns them green — installers only ever see green.` | `销售和统筹只能建议安装人员（黄色）。只有你的正式指派才会变绿——安装人员只会看到绿色的。` |

- [ ] **Step 2: Create `src/features/tour/steps/sales.ts`**

```ts
import type { TourStep } from '../engine'
import { bellStep, dateStripStep, outroSteps, scheduleViewsStep } from './common'

// Sales: create → push → suggest. 14 steps.
export const salesSteps: TourStep[] = [
  { id: 'intro', route: '/schedule', titleKey: 'tourSalesIntroTitle', bodyKey: 'tourSalesIntroBody' },
  scheduleViewsStep,
  dateStripStep,
  { id: 'pending', before: 'open-nav-drawer', targets: ['nav-pending'], titleKey: 'tourPendingTitle', bodyKey: 'tourPendingBody' },
  { id: 'new-job', targets: ['new-job'], titleKey: 'tourNewJobTitle', bodyKey: 'tourNewJobBody' },
  { id: 'job-form', route: '/jobs/new', targets: ['job-details', 'job-tabs'], titleKey: 'tourJobFormTitle', bodyKey: 'tourJobFormBody' },
  { id: 'job-team', before: 'job-tab-team', targets: ['job-team'], titleKey: 'tourJobTeamTitle', bodyKey: 'tourJobTeamBody' },
  { id: 'job-actions', targets: ['job-actions'], titleKey: 'tourJobActionsTitle', bodyKey: 'tourJobActionsBody' },
  { id: 'fcfs', route: '/fcfs', targets: ['fcfs-board'], titleKey: 'tourFcfsTitle', bodyKey: 'tourFcfsBody' },
  { id: 'design-tab', before: 'open-nav-drawer', targets: ['nav-design-load'], titleKey: 'tourDesignTabTitle', bodyKey: 'tourDesignTabBody' },
  bellStep,
  ...outroSteps,
]
```

- [ ] **Step 3: Create `src/features/tour/steps/scheduler.ts`**

```ts
import type { TourStep } from '../engine'
import { bellStep, dateStripStep, outroSteps, scheduleViewsStep } from './common'

// Scheduler: the schedule + FCFS assignment loop. 13 steps.
export const schedulerSteps: TourStep[] = [
  { id: 'intro', route: '/schedule', titleKey: 'tourSchedulerIntroTitle', bodyKey: 'tourSchedulerIntroBody' },
  scheduleViewsStep,
  dateStripStep,
  { id: 'completed-tab', before: 'open-nav-drawer', targets: ['nav-completed'], titleKey: 'tourCompletedTitle', bodyKey: 'tourSchedulerCompletedBody' },
  { id: 'fcfs', route: '/fcfs', targets: ['fcfs-board'], titleKey: 'tourFcfsSchedulerTitle', bodyKey: 'tourFcfsSchedulerBody' },
  { id: 'assign', targets: ['fcfs-board'], titleKey: 'tourAssignTitle', bodyKey: 'tourAssignBody' },
  { id: 'suggest-vs-assign', titleKey: 'tourSuggestVsAssignTitle', bodyKey: 'tourSuggestVsAssignBody' },
  { id: 'design-tab', before: 'open-nav-drawer', targets: ['nav-design-load'], titleKey: 'tourDesignTabTitle', bodyKey: 'tourDesignTabBody' },
  bellStep,
  ...outroSteps,
]
```

- [ ] **Step 4: Register** — in `steps/index.ts`, import both and set `TOUR_SCRIPTS` to `{ sales: salesSteps, scheduler: schedulerSteps }`.

- [ ] **Step 5: Run tests** — scripts suite now validates both scripts (ids, outro, en+zh keys). `npx tsc --noEmit` clean.

- [ ] **Step 6: Manual smoke** — `npm run dev`, sign in as admin, preview-as **sales**, clear storage (DevTools → Application → clear `tour-seen:*` + `tour-state`), reload `/schedule`: offer appears; walk all 14 steps through `/jobs/new` and `/fcfs`; finale opens the account menu onto Connect Telegram; Exit and re-open via App tour. Repeat quickly as scheduler.

- [ ] **Step 7: Commit**

```bash
git add src/features/tour/steps/sales.ts src/features/tour/steps/scheduler.ts src/features/tour/steps/index.ts src/lib/i18n/en.ts src/lib/i18n/zh.ts
git commit -m "feat(tour): sales + scheduler scripts live end-to-end"
```

---

### Task 9: Coordinator + installer scripts

**Files:**
- Create: `src/features/tour/steps/coordinator.ts`, `src/features/tour/steps/installer.ts`
- Modify: `src/features/tour/steps/index.ts`, `src/lib/i18n/en.ts`, `src/lib/i18n/zh.ts`

**Interfaces:**
- Produces: `coordinatorSteps`, `installerSteps`, registered.

- [ ] **Step 1: i18n keys** (en + zh):

| key | en | zh |
|---|---|---|
| `tourCoordinatorIntroTitle` | `Your role: Coordinator` | `你的角色：统筹` |
| `tourCoordinatorIntroBody` | `You create and push jobs like sales, and coordinate the jobs you're assigned to.` | `你可以像销售一样创建和推送工作，并统筹指派给你的工作。` |
| `tourCoordPendingTitle` | `Pending jobs you share` | `共享的待处理工作` |
| `tourCoordPendingBody` | `You see pending jobs you created, plus ones whose sales person added you as coordinator.` | `你能看到自己创建的待处理工作，以及销售把你加为统筹的工作。` |
| `tourCoordSuggestTitle` | `Suggesting installers` | `建议安装人员` |
| `tourCoordSuggestBody` | `You suggest installers (yellow); the scheduler makes the formal assignment (green).` | `你可以建议安装人员（黄色）；由排程做正式指派（绿色）。` |
| `tourInstallerIntroTitle` | `Your role: Installer` | `你的角色：安装人员` |
| `tourInstallerIntroBody` | `My Jobs shows every job assigned to you — and only yours.` | `"我的工作"显示所有指派给你的工作——只显示你的。` |
| `tourInstallerTabsTitle` | `Today, up next, this week` | `今天、接下来、本周` |
| `tourInstallerTabsBody` | `Three tabs sort your jobs by when they happen. Today is what needs doing now.` | `三个标签按时间整理你的工作。"今天"是现在要做的。` |
| `tourInstallerJobTitle` | `Inside a job` | `工作详情` |
| `tourInstallerJobBody` | `Open a job to see the address, time, a task list to tick off, and where to upload photos and the signed DO.` | `打开工作可查看地址、时间、可勾选的任务清单，以及上传照片和签收 DO 的地方。` |
| `tourInstallerChatTitle` | `Job chat` | `工作聊天` |
| `tourInstallerChatBody` | `Every job has its own chat — text, photos and voice notes. The office sees what you post.` | `每个工作都有自己的聊天——文字、照片和语音。办公室能看到你发的内容。` |
| `tourInstallerPhotosTitle` | `Completion photos` | `完工照片` |
| `tourInstallerPhotosBody` | `A job can only be marked complete with photos uploaded. Take them before you leave the site.` | `必须上传照片才能标记完工。离开现场前记得拍照。` |

- [ ] **Step 2: `src/features/tour/steps/coordinator.ts`**

```ts
import type { TourStep } from '../engine'
import { bellStep, dateStripStep, outroSteps, scheduleViewsStep } from './common'

// Coordinator: sales-level job flow, suggest-only for installers. 12 steps.
// nav-pending may not exist for this role's tabs — the engine degrades that
// step to a centred card, which reads fine.
export const coordinatorSteps: TourStep[] = [
  { id: 'intro', route: '/schedule', titleKey: 'tourCoordinatorIntroTitle', bodyKey: 'tourCoordinatorIntroBody' },
  scheduleViewsStep,
  dateStripStep,
  { id: 'pending', before: 'open-nav-drawer', targets: ['nav-pending'], titleKey: 'tourCoordPendingTitle', bodyKey: 'tourCoordPendingBody' },
  { id: 'new-job', targets: ['new-job'], titleKey: 'tourNewJobTitle', bodyKey: 'tourNewJobBody' },
  { id: 'job-form', route: '/jobs/new', targets: ['job-details', 'job-tabs'], titleKey: 'tourJobFormTitle', bodyKey: 'tourJobFormBody' },
  { id: 'job-team', before: 'job-tab-team', targets: ['job-team'], titleKey: 'tourCoordSuggestTitle', bodyKey: 'tourCoordSuggestBody' },
  { id: 'job-actions', targets: ['job-actions'], titleKey: 'tourJobActionsTitle', bodyKey: 'tourJobActionsBody' },
  { id: 'fcfs', route: '/fcfs', targets: ['fcfs-board'], titleKey: 'tourFcfsTitle', bodyKey: 'tourFcfsBody' },
  bellStep,
  ...outroSteps,
]
```

- [ ] **Step 3: `src/features/tour/steps/installer.ts`**

```ts
import type { TourStep } from '../engine'
import { bellStep, completedTabStep, outroSteps } from './common'

// Installer: home is /installer; job-page details are centred cards (no
// data rows to anchor to on a fresh account). 10 steps.
export const installerSteps: TourStep[] = [
  { id: 'intro', route: '/installer', titleKey: 'tourInstallerIntroTitle', bodyKey: 'tourInstallerIntroBody' },
  { id: 'tabs', targets: ['installer-tabs'], titleKey: 'tourInstallerTabsTitle', bodyKey: 'tourInstallerTabsBody' },
  { id: 'job', titleKey: 'tourInstallerJobTitle', bodyKey: 'tourInstallerJobBody' },
  { id: 'chat', titleKey: 'tourInstallerChatTitle', bodyKey: 'tourInstallerChatBody' },
  { id: 'photos', titleKey: 'tourInstallerPhotosTitle', bodyKey: 'tourInstallerPhotosBody' },
  completedTabStep,
  bellStep,
  ...outroSteps,
]
```

- [ ] **Step 4: Register both** in `steps/index.ts`.
- [ ] **Step 5: Run tests** (`scripts.test.ts` covers the new scripts automatically) + `npx tsc --noEmit`.
- [ ] **Step 6: Manual smoke** as in Task 8, preview-as coordinator and installer (installer home is `/installer`).
- [ ] **Step 7: Commit**

```bash
git add src/features/tour/steps/coordinator.ts src/features/tour/steps/installer.ts src/features/tour/steps/index.ts src/lib/i18n/en.ts src/lib/i18n/zh.ts
git commit -m "feat(tour): coordinator + installer scripts"
```

---

### Task 10: Designer + production scripts

**Files:**
- Create: `src/features/tour/steps/designer.ts`, `src/features/tour/steps/production.ts`
- Modify: `src/features/tour/steps/index.ts`, `src/lib/i18n/en.ts`, `src/lib/i18n/zh.ts`

**Interfaces:**
- Produces: `designerSteps`, `productionSteps`, registered — **all 6 scripts live**.

- [ ] **Step 1: i18n keys** (en + zh):

| key | en | zh |
|---|---|---|
| `tourDesignerIntroTitle` | `Your role: Designer` | `你的角色：设计师` |
| `tourDesignerIntroBody` | `The Design tab is your base: every designer's workload at a glance, including yours.` | `"设计"标签是你的大本营：一眼看到每位设计师的工作量，包括你的。` |
| `tourDesignBoardTitle` | `The Design Load board` | `设计负载看板` |
| `tourDesignBoardBody` | `Your bar grows with deadline pressure and changes colour with urgency. The bubble beside it lists your jobs.` | `你的柱条随截止压力增高，颜色随紧急度变化。旁边的气泡列出你的工作。` |
| `tourDesignToggleTitle` | `Board or My Jobs` | `看板或我的工作` |
| `tourDesignToggleBody` | `Switch to My Jobs for a simple list of just your design jobs.` | `切换到"我的工作"，只看你自己的设计工作清单。` |
| `tourDesignBriefTitle` | `The Design brief` | `设计摘要` |
| `tourDesignBriefBody` | `Each job's form has a Design brief card: instructions and files from sales. That's your starting point.` | `每个工作表单里有"设计摘要"卡片：销售提供的说明和文件。从那里开始。` |
| `tourDesignCompleteTitle` | `Finishing a design` | `完成设计` |
| `tourDesignCompleteBody` | `Tick Design completed and rate the complexity 1-5. Honest ratings teach the AI to predict deadlines better.` | `勾选"设计完成"并给复杂度打 1-5 分。如实评分能让 AI 更准确地预测截止日期。` |
| `tourDesignDueTitle` | `Due-date alerts` | `截止日期提醒` |
| `tourDesignDueBody` | `When an install date moves, your design due date follows — the bell and Telegram both tell you.` | `安装日期变动时，设计截止日期会跟着调整——铃铛和 Telegram 都会通知你。` |
| `tourProductionIntroTitle` | `Your role: Production` | `你的角色：生产` |
| `tourProductionIntroBody` | `You track what's ready to build. Most of the app is read-only for you — by design.` | `你负责跟进生产进度。应用的大部分内容对你是只读的——这是有意设计。` |
| `tourProductionFieldsTitle` | `Your fields` | `你的栏位` |
| `tourProductionFieldsBody` | `On any job you can edit: Production ready, DO issued, production instructions and production photos. Everything else is view-only.` | `在任何工作里你可以编辑：生产就绪、DO 已开、生产说明和生产照片。其余内容仅供查看。` |
| `tourProductionFilesTitle` | `Files` | `文件` |
| `tourProductionFilesBody` | `You can open and read every job's files and drawings — you just can't change the attachment buckets.` | `你可以打开并查看每个工作的文件和图纸——只是不能更改附件分组。` |

- [ ] **Step 2: `src/features/tour/steps/designer.ts`**

```ts
import type { TourStep } from '../engine'
import { bellStep, outroSteps } from './common'

// Designer: Design Load is the centrepiece; job-form specifics are centred
// cards (no job to open on a fresh account). 10 steps.
export const designerSteps: TourStep[] = [
  { id: 'intro', route: '/schedule', titleKey: 'tourDesignerIntroTitle', bodyKey: 'tourDesignerIntroBody' },
  { id: 'board', route: '/design-load', targets: ['design-board'], titleKey: 'tourDesignBoardTitle', bodyKey: 'tourDesignBoardBody' },
  { id: 'toggle', targets: ['design-toggle'], titleKey: 'tourDesignToggleTitle', bodyKey: 'tourDesignToggleBody' },
  { id: 'brief', titleKey: 'tourDesignBriefTitle', bodyKey: 'tourDesignBriefBody' },
  { id: 'complete', titleKey: 'tourDesignCompleteTitle', bodyKey: 'tourDesignCompleteBody' },
  { id: 'due', titleKey: 'tourDesignDueTitle', bodyKey: 'tourDesignDueBody' },
  bellStep,
  ...outroSteps,
]
```

- [ ] **Step 3: `src/features/tour/steps/production.ts`**

```ts
import type { TourStep } from '../engine'
import { bellStep, dateStripStep, outroSteps, scheduleViewsStep } from './common'

// Production: schedule orientation + the narrow edit surface. 9 steps.
export const productionSteps: TourStep[] = [
  { id: 'intro', route: '/schedule', titleKey: 'tourProductionIntroTitle', bodyKey: 'tourProductionIntroBody' },
  scheduleViewsStep,
  dateStripStep,
  { id: 'fields', titleKey: 'tourProductionFieldsTitle', bodyKey: 'tourProductionFieldsBody' },
  { id: 'files', titleKey: 'tourProductionFilesTitle', bodyKey: 'tourProductionFilesBody' },
  bellStep,
  ...outroSteps,
]
```

- [ ] **Step 4: Register both** — `TOUR_SCRIPTS` now has all 6 roles.
- [ ] **Step 5: Run tests + type-check** — all standalone suites + `npx tsc --noEmit`.
- [ ] **Step 6: Manual smoke** preview-as designer and production.
- [ ] **Step 7: Commit**

```bash
git add src/features/tour/steps/designer.ts src/features/tour/steps/production.ts src/features/tour/steps/index.ts src/lib/i18n/en.ts src/lib/i18n/zh.ts
git commit -m "feat(tour): designer + production scripts — all 6 roles live"
```

---

### Task 11: Full verification + smoke-test checklist doc

**Files:**
- Create: `docs/guided-tour-smoke-test.md`

- [ ] **Step 1: Run every standalone suite** (the repo's existing suites plus the three new ones) and confirm green:

```bash
npx tsx src/features/tour/engine.test.ts
npx tsx src/features/tour/placement.test.ts
npx tsx src/features/tour/steps/scripts.test.ts
```

Also run the pre-existing suites listed in recent session notes (they are untouched but must still pass — the i18n files were edited).

- [ ] **Step 2: Type-check + production build**

```bash
npx tsc --noEmit
npm run build
```

Expected: both clean. Fix anything that surfaces before proceeding.

- [ ] **Step 3: Write `docs/guided-tour-smoke-test.md`** — a tickable checklist for Nic on the dev preview, structured as: for **each of the 6 roles** (via preview-as, plus one real non-admin login at the end) × **phone + PC**: offer appears once on the home page and never on deep links · Start walks every step with the spotlight on the right element · steps that navigate (`/jobs/new`, `/fcfs`, `/design-load`) land and continue · the finale opens the account menu and highlights Connect Telegram · Exit restores the page and the offer does not reappear · profile → App tour restarts from step 1 · switch to 中文 and spot-check three steps · dark mode readable · Bengali shows English tour text · the bell, FABs and bottom nav are not tappable while the tour runs.

- [ ] **Step 4: Commit + push to dev**

```bash
git add docs/guided-tour-smoke-test.md
git commit -m "docs: guided tour smoke-test checklist"
git push origin dev
```

- [ ] **Step 5: Hand to Nic** — Vercel builds the dev preview; Nic runs the checklist. Merge `dev` → `main` only after his pass (house rule).
