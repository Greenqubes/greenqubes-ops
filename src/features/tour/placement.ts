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
