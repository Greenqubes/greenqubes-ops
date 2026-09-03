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

  // Plain start — used by App-tour restarts (no language chooser there;
  // the person already has their language set).
  const begin = useCallback((r: Role) => {
    markSeen()
    const s: TourState = { role: r, step: 0 }
    writeSession(TOUR_STATE_KEY, serializeTourState(s))
    setTour(s)
    setPhase('running')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markSeen])

  // Start from the welcome flow's language chooser: persist the pick the
  // same way the account menu's switcher does (the tour's ONE sanctioned
  // write — Nic 2026-09-03), refresh so the whole app re-renders in that
  // language, and run the tour; the state in sessionStorage carries the
  // tour through the refresh.
  const beginWithLang = useCallback(async (r: Role, code: LangCode) => {
    markSeen()
    const s: TourState = { role: r, step: 0 }
    writeSession(TOUR_STATE_KEY, serializeTourState(s))
    if (code !== lang) {
      try {
        await fetch('/api/user/lang', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lang: code }),
        })
      } catch { /* keep going — the tour still runs in the current language */ }
      router.refresh()
    }
    setTour(s)
    setPhase('running')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, markSeen])

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
    // Every timer this effect creates — the staggered before-actions AND the
    // target poll — is collected here so cleanup can clear all of them.
    // Left uncleared, a stale tour:* event (e.g. open-account-menu) could
    // still fire after a fast step change, tour exit, or unmount.
    const timers: number[] = []
    actions.forEach((a, i) => {
      timers.push(window.setTimeout(() => window.dispatchEvent(new CustomEvent(`tour:${a}`)), 60 + i * 180))
    })

    setReady(false)
    setTarget(null)
    let cancelled = false
    const t0 = Date.now()
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
        timers.push(window.setTimeout(tick, POLL_MS))
      }
    }
    timers.push(window.setTimeout(tick, 0))
    return () => { cancelled = true; timers.forEach((id) => window.clearTimeout(id)) }
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
        onPick={(code) => { void beginWithLang(role, code) }}
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
