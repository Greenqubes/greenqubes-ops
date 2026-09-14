// Where the floating assistant panel opens once its bubble has been dragged
// off the default corner. Pure so it can be tested without a browser: the
// caller passes the bubble's rect and the viewport size.
//
// Undragged bubbles never come through here — the panel is pinned by plain
// CSS in that case (see FloatingChatPanel), so a person who never drags the
// bubble sees byte-identical output.

/** Gap kept between the bubble and the panel, matching the 12px baked into
 *  the default (never-dragged) CSS anchor. */
export const PANEL_GAP = 12
/** Screen-edge margin the anchored panel is kept clear of. */
export const PANEL_MARGIN = 8

export interface BubbleBox {
  top:    number
  bottom: number
  left:   number
  right:  number
  height: number
}

export interface Viewport {
  width:  number
  height: number
}

/** What the panel's inline style should be. Exactly one of `top` / `bottom`
 *  is a number; the other is null, meaning "leave it to auto". `maxHeight`
 *  caps the panel to the room actually available on that side. */
export interface PanelAnchor {
  left:      number
  top:       number | null
  bottom:    number | null
  maxHeight: number
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)

export function panelWidthFor(vw: number): number {
  return Math.min(340, vw - 32)
}

/** The panel's own ceiling, matching the `max-h-[min(520px,100vh-160px)]`
 *  class it carries. */
export function panelCeilingFor(vh: number): number {
  return Math.min(520, vh - 160)
}

/**
 * Vertically: opens above the bubble when the bubble's centre is in the lower
 * half of the viewport, below it otherwise. The panel is anchored by the edge
 * FACING the bubble — `bottom` when opening above, `top` when opening below —
 * so its own rendered height never moves it away from the bubble. `maxHeight`
 * is the room on that side, so it cannot spill past the opposite screen edge.
 *
 * Horizontally: aligns to whichever side of the bubble has more room, so the
 * panel grows into open space, then clamps fully inside the viewport.
 */
export function computeBubbleAnchor(bubble: BubbleBox, viewport: Viewport): PanelAnchor {
  const { width: vw, height: vh } = viewport
  const panelWidth = panelWidthFor(vw)
  const ceiling    = panelCeilingFor(vh)

  const openAbove = bubble.top + bubble.height / 2 > vh / 2

  const leftSpace     = bubble.left
  const rightSpace    = vw - bubble.right
  // More room to the right → grow rightward from the bubble's left edge.
  const alignLeftEdge = rightSpace >= leftSpace
  const rawLeft       = alignLeftEdge ? bubble.left : bubble.right - panelWidth

  const roomAbove = bubble.top    - PANEL_GAP - PANEL_MARGIN
  const roomBelow = vh - bubble.bottom - PANEL_GAP - PANEL_MARGIN

  return {
    left:      clamp(rawLeft, PANEL_MARGIN, Math.max(PANEL_MARGIN, vw - panelWidth - PANEL_MARGIN)),
    top:       openAbove ? null : bubble.bottom + PANEL_GAP,
    bottom:    openAbove ? vh - bubble.top + PANEL_GAP : null,
    maxHeight: Math.max(0, Math.min(ceiling, openAbove ? roomAbove : roomBelow)),
  }
}
