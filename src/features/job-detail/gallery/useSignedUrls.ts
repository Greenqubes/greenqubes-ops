'use client'

import { useCallback, useEffect, useState } from 'react'
import { visibleKeysToSign } from '@/lib/utils/gallery'

/**
 * Signed links for the Gallery's tiles and viewer, fetched ONLY for keys a
 * caller says are on screen (spec: no thumbnails exist, so a full-size file
 * loads per tile — never for a whole 100-photo job at once on mobile data).
 * Links come from /api/r2/download-url, which checks the caller may see the
 * job, and are cached per page for 10 minutes (they expire after that).
 */

const TTL_MS = 10 * 60_000
const cache = new Map<string, { url: string; at: number }>()
const inFlight = new Set<string>()

async function signOne(key: string): Promise<string | null> {
  try {
    const res = await fetch('/api/r2/download-url', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key }),
    })
    if (!res.ok) return null
    const { url } = await res.json() as { url?: string }
    return url ?? null
  } catch {
    return null
  }
}

export function useSignedUrls(): { urls: Record<string, string>; sign: (keys: string[]) => void } {
  const [urls, setUrls] = useState<Record<string, string>>({})

  const sign = useCallback((keys: string[]) => {
    const now = Date.now()
    const fresh: Record<string, string> = {}
    const done = new Set<string>()
    for (const k of keys) {
      const hit = cache.get(k)
      if (hit && now - hit.at < TTL_MS) { fresh[k] = hit.url; done.add(k) }
      if (inFlight.has(k)) done.add(k)
    }
    if (Object.keys(fresh).length) setUrls(u => ({ ...u, ...fresh }))
    for (const k of visibleKeysToSign(keys, done)) {
      inFlight.add(k)
      void signOne(k).then(url => {
        inFlight.delete(k)
        if (!url) return
        cache.set(k, { url, at: Date.now() })
        setUrls(u => ({ ...u, [k]: url }))
      })
    }
  }, [])

  return { urls, sign }
}

/** Tells `onVisible` when an element scrolls into view (once). */
export function useOnVisible(onVisible: () => void): (el: Element | null) => void {
  const [el, setEl] = useState<Element | null>(null)
  useEffect(() => {
    if (!el) return
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) { onVisible(); io.disconnect() }
    }, { rootMargin: '200px' })
    io.observe(el)
    return () => io.disconnect()
  }, [el, onVisible])
  return setEl
}

/** A fresh link that downloads with the file's own name. */
export async function downloadFile(key: string, filename: string): Promise<boolean> {
  try {
    const res = await fetch('/api/r2/download-url', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, filename }),
    })
    if (!res.ok) return false
    const { url } = await res.json() as { url: string }
    const a = document.createElement('a')
    a.href = url; a.download = filename; a.target = '_blank'; a.rel = 'noopener'
    a.click()
    return true
  } catch {
    return false
  }
}
