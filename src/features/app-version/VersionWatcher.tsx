'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { t } from '@/lib/i18n'
import { versionAction } from './version-rules'
import { useHasUnsavedWork } from './unsaved-work'
import type { LangCode } from '@/lib/i18n'

/**
 * Refreshes a stale tab by itself after a deploy (Nic, 2026-09-10 — nobody
 * should have to be told to reload, least of all an installer out on a job).
 *
 * A deploy cannot reach into an open tab, so the tab asks: on load, on a quiet
 * timer, and — the one that matters — whenever it comes back to the front,
 * which is what "opening the app" looks like on a phone.
 *
 * Mounted once in CompanyBar, so it rides along on every signed-in page.
 */

// While the build is current: a quiet check. Browsers throttle this in a
// background tab, which costs nothing — coming back to the front re-checks.
const CHECK_MS = 3 * 60 * 1000
// Once a newer build is known, look at the conditions often, so the refresh
// lands on the first still moment rather than three minutes later.
const DECIDE_MS = 3 * 1000

export function VersionWatcher({ lang = 'en' }: { lang?: LangCode }) {
  const current = process.env.NEXT_PUBLIC_BUILD_ID ?? 'dev'
  const hasUnsavedWork = useHasUnsavedWork()

  const [latest,     setLatest]     = useState<string | null>(null)
  const [showBanner, setShowBanner] = useState(false)
  const lastTouch = useRef(Date.now())
  // A reload takes a moment to actually navigate; without this the decide
  // timer can fire again and call reload a second time.
  const reloading = useRef(false)

  const stale = latest !== null && latest !== current

  const check = useCallback(() => {
    fetch('/api/version', { cache: 'no-store' })
      .then(r => r.ok ? r.json() as Promise<{ version: string }> : null)
      .then(data => { if (data?.version) setLatest(data.version) })
      .catch(() => {}) // offline, or the server is mid-deploy — ask again later
  }, [])

  // Never poll a build with no stamp (local dev): it can never match, and the
  // rules would refuse to reload anyway.
  const enabled = current !== 'dev'

  useEffect(() => {
    if (!enabled) return
    check()
    const timer = setInterval(check, CHECK_MS)

    // Coming back to the tab is the moment worth checking — on a phone this
    // IS "opening the app".
    const onWake = () => { if (document.visibilityState === 'visible') check() }
    document.addEventListener('visibilitychange', onWake)
    window.addEventListener('focus', onWake)

    const touch = () => { lastTouch.current = Date.now() }
    window.addEventListener('pointerdown', touch, { passive: true })
    window.addEventListener('keydown',     touch, { passive: true })
    window.addEventListener('touchstart',  touch, { passive: true })

    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onWake)
      window.removeEventListener('focus', onWake)
      window.removeEventListener('pointerdown', touch)
      window.removeEventListener('keydown',     touch)
      window.removeEventListener('touchstart',  touch)
    }
  }, [enabled, check])

  // Once a newer build is known, keep asking what to do about it: the answer
  // changes as they save their work and go still.
  useEffect(() => {
    if (!enabled || !stale) { setShowBanner(false); return }

    const decide = () => {
      if (reloading.current) return
      const action = versionAction({
        current,
        latest,
        hasUnsavedWork,
        visible:     document.visibilityState === 'visible',
        idleSeconds: (Date.now() - lastTouch.current) / 1000,
      })

      if (action === 'reload') {
        reloading.current = true
        window.location.reload()
        return
      }
      setShowBanner(action === 'banner')
    }

    decide()
    const timer = setInterval(decide, DECIDE_MS)
    return () => clearInterval(timer)
  }, [enabled, stale, current, latest, hasUnsavedWork])

  if (!showBanner) return null

  // Same bar the job form uses for "this job was updated" — deliberately the
  // same thing to learn. sticky top-[45px] parks it under CompanyBar.
  return (
    <button
      type="button"
      onClick={() => { reloading.current = true; window.location.reload() }}
      className="sticky top-[45px] z-40 w-full flex items-center justify-center gap-2 px-4 py-2 bg-brand-amber-soft border-b border-brand-amber/40 text-xs font-semibold text-brand-amber"
    >
      <RefreshCw size={12} />
      {t(lang, 'newVersionAvailable')} — {t(lang, 'newVersionReload')}
    </button>
  )
}
