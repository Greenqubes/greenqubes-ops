'use client'

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

// Shared drag behaviour for root-level floating action buttons (bug report
// bubble, assistant chat bubble, …). One instance per button.
//
// - Pointer Events cover touch + mouse from a single code path.
// - A ~6px movement threshold separates a drag from a tap: below it, the
//   button's own onClick fires untouched (no preventDefault); above it, the
//   drag takes over and the click that the browser fires on release is
//   swallowed so it doesn't also trigger open/close.
// - Position is stored per-button in localStorage as viewport-relative
//   {x, y} (top-left, `position: fixed` coordinates), keyed `fab-pos:<id>`.
// - Hydration-safe: state starts at `null` (server renders the caller's
//   default CSS position — e.g. `fixed right-4 bottom-[...] lg:bottom-[...]`
//   — untouched), and the stored position is applied after mount, same
//   mount-gate shape as NavDrawer's `mounted` flag. Nothing here reads
//   localStorage or window during render.
// - Re-clamped on resize so a position saved on a bigger screen can't strand
//   the button off a smaller one.

export interface FabPosition {
  x: number
  y: number
}

interface UseDraggableFabOptions<T extends HTMLElement> {
  /** localStorage key suffix — final key is `fab-pos:${id}`. */
  id: string
  /** Ref to the draggable element. Must be `position: fixed`. */
  elementRef: RefObject<T | null>
  /** Movement in px before a pointer-down becomes a drag. Defaults to 6. */
  threshold?: number
}

interface DragState {
  pointerId: number
  startClientX: number
  startClientY: number
  startPos: FabPosition
  size: { width: number; height: number }
  moved: boolean
}

interface UseDraggableFabResult<T extends HTMLElement> {
  /** Spread onto the element's style. Always sets `touch-action: none` (a
   *  static value — safe on the server render too, no hydration mismatch)
   *  so a drag started with a finger doesn't also scroll the page; left/top
   *  position overrides only appear once a custom position exists (stored
   *  or mid-drag) — until then the caller's default CSS classes position
   *  the button. */
  style: React.CSSProperties
  /** Spread onto the element alongside its own onClick. */
  handlers: {
    onPointerDown: (e: React.PointerEvent<T>) => void
    onClickCapture: (e: React.MouseEvent<T>) => void
  }
  /** True only once the threshold has been crossed (a real drag, not a tap). */
  isDragging: boolean
}

const DEFAULT_THRESHOLD = 6
const storageKey = (id: string) => `fab-pos:${id}`

function clampToViewport(pos: FabPosition, width: number, height: number): FabPosition {
  const maxX = Math.max(0, window.innerWidth - width)
  const maxY = Math.max(0, window.innerHeight - height)
  return {
    x: Math.min(Math.max(pos.x, 0), maxX),
    y: Math.min(Math.max(pos.y, 0), maxY),
  }
}

function readStoredPosition(id: string): FabPosition | null {
  try {
    const raw = localStorage.getItem(storageKey(id))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<FabPosition>
    if (typeof parsed.x === 'number' && typeof parsed.y === 'number') return { x: parsed.x, y: parsed.y }
    return null
  } catch {
    return null
  }
}

function writeStoredPosition(id: string, pos: FabPosition) {
  try {
    localStorage.setItem(storageKey(id), JSON.stringify(pos))
  } catch {
    // Private browsing / quota exceeded — dragging still works this session,
    // it just won't persist.
  }
}

export function useDraggableFab<T extends HTMLElement = HTMLButtonElement>({
  id,
  elementRef,
  threshold = DEFAULT_THRESHOLD,
}: UseDraggableFabOptions<T>): UseDraggableFabResult<T> {
  const [position, setPosition] = useState<FabPosition | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragRef = useRef<DragState | null>(null)
  const suppressNextClickRef = useRef(false)

  // Restore a stored position once, after mount — server + first client
  // render both show the caller's default CSS position.
  useEffect(() => {
    const el = elementRef.current
    const stored = readStoredPosition(id)
    if (!stored || !el) return
    const rect = el.getBoundingClientRect()
    setPosition(clampToViewport(stored, rect.width, rect.height))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Re-clamp whenever the viewport changes so a stored spot from a bigger
  // screen can't strand the button off a smaller one (and vice versa). A
  // button still on its CSS default (position === null) needs no handling —
  // the default classes are already responsive.
  useEffect(() => {
    function onResize() {
      const el = elementRef.current
      if (!el) return
      setPosition(prev => {
        if (!prev) return prev
        const rect = el.getBoundingClientRect()
        return clampToViewport(prev, rect.width, rect.height)
      })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onPointerMove = useCallback((e: PointerEvent) => {
    const state = dragRef.current
    if (!state || e.pointerId !== state.pointerId) return

    const dx = e.clientX - state.startClientX
    const dy = e.clientY - state.startClientY

    if (!state.moved) {
      if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return
      state.moved = true
      setIsDragging(true)
    }

    setPosition(
      clampToViewport(
        { x: state.startPos.x + dx, y: state.startPos.y + dy },
        state.size.width,
        state.size.height,
      ),
    )
  }, [threshold])

  const endDrag = useCallback((e: PointerEvent) => {
    const state = dragRef.current
    const el = elementRef.current
    if (!state || e.pointerId !== state.pointerId) return

    if (el?.hasPointerCapture(state.pointerId)) el.releasePointerCapture(state.pointerId)
    el?.removeEventListener('pointermove', onPointerMove)
    el?.removeEventListener('pointerup', endDrag)
    el?.removeEventListener('pointercancel', endDrag)

    if (state.moved) {
      // Persist wherever the drag ended up, and swallow the click the
      // browser fires right after pointerup so it doesn't also toggle open.
      setPosition(prev => {
        if (prev) writeStoredPosition(id, prev)
        return prev
      })
      suppressNextClickRef.current = true
    }

    setIsDragging(false)
    dragRef.current = null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, onPointerMove])

  const onPointerDown = useCallback((e: React.PointerEvent<T>) => {
    // Ignore non-primary mouse buttons (right/middle click); touch and pen
    // report button 0 for the primary contact.
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const el = elementRef.current
    if (!el) return

    const rect = el.getBoundingClientRect()
    dragRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startPos: { x: rect.left, y: rect.top },
      size: { width: rect.width, height: rect.height },
      moved: false,
    }

    // Native listeners (not React props) so pointer capture keeps delivering
    // move/up events to this element even once the pointer leaves it —
    // exactly what dragging needs. Not preventDefault'd here: a tap below
    // the movement threshold must pass through untouched.
    el.setPointerCapture(e.pointerId)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', endDrag)
    el.addEventListener('pointercancel', endDrag)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onPointerMove, endDrag])

  const onClickCapture = useCallback((e: React.MouseEvent<T>) => {
    if (!suppressNextClickRef.current) return
    suppressNextClickRef.current = false
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const style: React.CSSProperties = {
    // Static — identical on server and first client render, so this never
    // causes a hydration mismatch. Needed from the very first pointerdown
    // (including a drag that starts from the still-default position), not
    // just once a custom position exists, so the browser never gets a
    // chance to start a scroll gesture before the threshold is crossed.
    touchAction: 'none',
    ...(position ? { left: position.x, top: position.y, right: 'auto', bottom: 'auto' } : null),
    ...(isDragging
      ? { transition: 'none', transform: 'scale(1.08)', boxShadow: '0 12px 28px -6px rgba(0,0,0,0.35)' }
      : null),
  }

  return {
    style,
    handlers: { onPointerDown, onClickCapture },
    isDragging,
  }
}
