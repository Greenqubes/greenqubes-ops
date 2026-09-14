'use client'

import { useState, useLayoutEffect, useCallback, type RefObject } from 'react'
import { computeDropdownPosition, type DropdownPosition } from './anchored-dropdown'

/**
 * Live position for a dropdown that is portalled to <body> rather than left
 * inside its card (see anchored-dropdown.ts for why).
 *
 * Re-measures on scroll and resize while open. The scroll listener is in the
 * CAPTURE phase on purpose: scroll events from an inner scrolling element
 * (the job form's own panes) do not bubble to window, so a bubble-phase
 * listener would let the list drift away from its field.
 *
 * Returns null while closed, and until the first measurement — callers should
 * render nothing until they have a position, so the list never flashes at the
 * top-left corner before it is placed.
 */
export function useAnchoredDropdown(
  open: boolean,
  triggerRef: RefObject<HTMLElement | null>,
  preferredMaxHeight = 192,
): DropdownPosition | null {
  const [pos, setPos] = useState<DropdownPosition | null>(null)

  const measure = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setPos(computeDropdownPosition(
      { top: r.top, bottom: r.bottom, left: r.left, width: r.width },
      { width: window.innerWidth, height: window.innerHeight },
      preferredMaxHeight,
    ))
  }, [triggerRef, preferredMaxHeight])

  useLayoutEffect(() => {
    if (!open) { setPos(null); return }
    measure()
    window.addEventListener('scroll', measure, true)
    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('scroll', measure, true)
      window.removeEventListener('resize', measure)
    }
  }, [open, measure])

  return pos
}

/** Turns a position into the inline style the portalled list wears. */
export function dropdownStyle(pos: DropdownPosition): React.CSSProperties {
  return {
    position:  'fixed',
    left:      pos.left,
    width:     pos.width,
    top:       pos.top    ?? undefined,
    bottom:    pos.bottom ?? undefined,
    maxHeight: pos.maxHeight,
  }
}
