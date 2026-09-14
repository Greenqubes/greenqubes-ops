// Positioning for a dropdown that is drawn on top of the page instead of
// inside its card.
//
// Why this exists (Nic, 2026-09-14): every card on the job form is a
// CollapseCard, which sets `overflow-hidden` to keep content inside its 14px
// rounded corners. An absolutely-positioned list inside such a card is
// scissored at the card's edge — the time picker showed three options and cut
// the rest off. The fix is to portal the list to <body> and position it
// against its trigger, the way the app's other overlays already work.
//
// Pure so it can be tested without a browser; the hook that feeds it live
// rects lives in useAnchoredDropdown.ts.

/** Gap between the trigger and the list, matching the old `mt-1`. */
export const DROPDOWN_GAP = 4
/** Screen-edge margin the list is kept clear of. */
export const DROPDOWN_MARGIN = 8
/** Below this much room, opening downward is not worth it. */
export const MIN_USEFUL_HEIGHT = 120

export interface TriggerBox {
  top:    number
  bottom: number
  left:   number
  width:  number
}

export interface Viewport {
  width:  number
  height: number
}

export interface DropdownPosition {
  left:      number
  width:     number
  /** Exactly one of top / bottom is a number; the other is null (auto). */
  top:       number | null
  bottom:    number | null
  maxHeight: number
  placement: 'below' | 'above'
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)

/**
 * Opens below the trigger when there is usable room, otherwise above — and
 * caps the list to the room actually available on that side, so it can never
 * run off the top or bottom of the screen. Anchored by the edge facing the
 * trigger so the list's own height never drags it away from the field.
 */
export function computeDropdownPosition(
  trigger: TriggerBox,
  viewport: Viewport,
  preferredMaxHeight: number,
): DropdownPosition {
  const roomBelow = viewport.height - trigger.bottom - DROPDOWN_GAP - DROPDOWN_MARGIN
  const roomAbove = trigger.top - DROPDOWN_GAP - DROPDOWN_MARGIN

  // Only flip up when below is genuinely cramped AND above is better — a
  // list that flips on a 1px difference feels broken.
  const below = roomBelow >= Math.min(preferredMaxHeight, MIN_USEFUL_HEIGHT) || roomBelow >= roomAbove

  return {
    left:      clamp(trigger.left, DROPDOWN_MARGIN,
                     Math.max(DROPDOWN_MARGIN, viewport.width - trigger.width - DROPDOWN_MARGIN)),
    width:     trigger.width,
    top:       below ? trigger.bottom + DROPDOWN_GAP : null,
    bottom:    below ? null : viewport.height - trigger.top + DROPDOWN_GAP,
    maxHeight: Math.max(0, Math.min(preferredMaxHeight, below ? roomBelow : roomAbove)),
    placement: below ? 'below' : 'above',
  }
}
