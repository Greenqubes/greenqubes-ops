'use client'

import { useCallback, useRef, useState } from 'react'

/**
 * Dragging a job card between bands, on mouse AND finger.
 *
 * Pointer events, no library — the stack is locked, and this is the pattern
 * already proven by the job task list's drag-reorder
 * (src/features/job-detail/TaskListSection.tsx). Hit-testing is done against
 * registered band elements rather than HTML5 drag-and-drop, which does not
 * work on touch at all.
 *
 * The card is only PICKED UP after a small movement threshold, so a tap that
 * opens the job is never mistaken for a drag — the card is wrapped in a Link.
 */
const DRAG_THRESHOLD_PX = 6

export function useCardDrag({ onDrop }: { onDrop: (jobId: string, bandId: string) => void }) {
  const [draggingId,  setDraggingId]  = useState<string | null>(null)
  const [hoverBandId, setHoverBandId] = useState<string | null>(null)

  const bands   = useRef(new Map<string, HTMLElement>())
  const pending = useRef<{ id: string; x: number; y: number } | null>(null)
  const active  = useRef<string | null>(null)

  /**
   * Only bands that accept a drop register themselves. An external
   * installer's container deliberately does not (Nic, 2026-09-16), so
   * hit-testing can never return one and a card dropped over it simply snaps
   * back.
   */
  const registerBand = useCallback((bandId: string, el: HTMLElement | null) => {
    if (el) bands.current.set(bandId, el)
    else    bands.current.delete(bandId)
  }, [])

  const bandUnder = useCallback((x: number, y: number): string | null => {
    for (const [id, el] of bands.current) {
      const r = el.getBoundingClientRect()
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return id
    }
    return null
  }, [])

  const startDrag = useCallback((jobId: string, e: React.PointerEvent) => {
    // Left button / touch only — a right-click must not start a drag.
    if (e.button !== 0) return
    pending.current = { id: jobId, x: e.clientX, y: e.clientY }

    const move = (ev: PointerEvent) => {
      const p = pending.current
      if (!p) return
      if (!active.current) {
        if (Math.hypot(ev.clientX - p.x, ev.clientY - p.y) < DRAG_THRESHOLD_PX) return
        active.current = p.id
        setDraggingId(p.id)
        // Stops the page scrolling under a finger mid-drag, and stops the
        // browser selecting text across the cards being dragged over.
        document.body.style.touchAction = 'none'
        document.body.style.userSelect  = 'none'
      }
      setHoverBandId(bandUnder(ev.clientX, ev.clientY))
    }

    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove',   move)
      window.removeEventListener('pointerup',     up)
      window.removeEventListener('pointercancel', up)
      document.body.style.touchAction = ''
      document.body.style.userSelect  = ''
      const dragged = active.current
      const target  = dragged ? bandUnder(ev.clientX, ev.clientY) : null
      pending.current = null
      active.current  = null
      setDraggingId(null)
      setHoverBandId(null)
      if (dragged && target) onDrop(dragged, target)
    }

    window.addEventListener('pointermove',   move)
    window.addEventListener('pointerup',     up)
    window.addEventListener('pointercancel', up)
  }, [bandUnder, onDrop])

  return { draggingId, hoverBandId, startDrag, registerBand }
}
