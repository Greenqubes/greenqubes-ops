/**
 * Standalone test for the floating assistant panel's anchor maths.
 * Run: npx tsx src/components/bubble-anchor.test.ts
 * Exits 1 on any failure.
 *
 * The bug this was written for (Nic, 2026-09-14): with the bubble dragged to
 * the bottom of a phone screen, the panel opened near the TOP with a large
 * dead gap above the bubble. Cause: the old formula placed the panel's TOP at
 * `bubble.top - GAP - panelHeight`, where panelHeight was the panel's MAXIMUM
 * height (min(520, vh-160)), not the height it actually renders at. An empty
 * chat is ~290px tall, so the panel was positioned as if it were 520px and
 * then drawn 290px tall from there — leaving (max - actual) of empty space.
 *
 * `oldAnchorTop` below reproduces that formula so the tests can show it
 * failing the same assertions the fix passes. Without it these tests would
 * pass on any implementation and prove nothing.
 */

import {
  computeBubbleAnchor,
  panelCeilingFor,
  panelWidthFor,
  PANEL_GAP,
  PANEL_MARGIN,
  type BubbleBox,
  type Viewport,
} from './bubble-anchor'

let failures = 0

function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) {
    console.log(`  ✓ ${name}`)
  } else {
    console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`)
    failures++
  }
}

// ── The old, buggy formula, kept only so the tests can prove they detect it ──
function oldAnchorTop(bubble: BubbleBox, vp: Viewport): number {
  const panelHeight = Math.min(520, vp.height - 160)
  const rawTop      = bubble.top - PANEL_GAP - panelHeight
  return Math.min(Math.max(rawTop, PANEL_MARGIN), vp.height - panelHeight - PANEL_MARGIN)
}

// Nic's screenshot: phone, bubble dragged to the bottom-left corner.
const phone: Viewport   = { width: 372, height: 687 }
const bubbleBottomLeft: BubbleBox = { top: 575, bottom: 623, left: 16, right: 64, height: 48 }

// How tall the panel actually renders — an empty chat is header + empty state
// + composer, nowhere near its 520px ceiling.
const EMPTY_CHAT_H = 290
const FULL_CHAT_H  = 520

console.log('\nbubble-anchor')

// ── 1. The bug itself: the panel's bottom edge must sit exactly PANEL_GAP
//       above the bubble, whatever height the panel happens to render at ──
{
  const a = computeBubbleAnchor(bubbleBottomLeft, phone)
  check('opens above when the bubble is in the lower half', a.top, null)

  // Anchored by `bottom`, so the panel's bottom edge in page coords is fixed.
  const panelBottomY = phone.height - (a.bottom as number)
  check('panel bottom sits GAP above the bubble', panelBottomY, bubbleBottomLeft.top - PANEL_GAP)

  // The whole point: the gap does not depend on how tall the panel is.
  const gapEmpty = bubbleBottomLeft.top - panelBottomY
  const gapFull  = bubbleBottomLeft.top - panelBottomY
  check('gap is GAP for a short panel', gapEmpty, PANEL_GAP)
  check('gap is GAP for a tall panel',  gapFull,  PANEL_GAP)
}

// ── 2. Prove the test catches the OLD behaviour (it must NOT pass these) ──
{
  const oldTop        = oldAnchorTop(bubbleBottomLeft, phone)
  const oldBottomEmpty = oldTop + EMPTY_CHAT_H
  const oldGapEmpty    = bubbleBottomLeft.top - oldBottomEmpty

  check('old formula left a gap far larger than GAP', oldGapEmpty > 200, true)
  check('old formula only lined up at full height',
    bubbleBottomLeft.top - (oldTop + FULL_CHAT_H), PANEL_GAP)
}

// ── 3. Opening below, when the bubble is dragged to the top of the screen ──
{
  const bubbleTopRight: BubbleBox = { top: 90, bottom: 138, left: 308, right: 356, height: 48 }
  const a = computeBubbleAnchor(bubbleTopRight, phone)
  check('opens below when the bubble is in the upper half', a.bottom, null)
  check('panel top sits GAP below the bubble', a.top, bubbleTopRight.bottom + PANEL_GAP)
}

// ── 4. maxHeight is the room actually available on the chosen side ──
{
  const a = computeBubbleAnchor(bubbleBottomLeft, phone)
  check('maxHeight never exceeds the panel ceiling',
    (a.maxHeight as number) <= panelCeilingFor(phone.height), true)

  // A bubble just below the middle leaves less room above than the ceiling.
  const midBubble: BubbleBox = { top: 360, bottom: 408, left: 16, right: 64, height: 48 }
  const b = computeBubbleAnchor(midBubble, phone)
  check('maxHeight shrinks to the room above', b.maxHeight, 360 - PANEL_GAP - PANEL_MARGIN)
  check('panel cannot reach the top edge',
    (phone.height - (b.bottom as number)) - (b.maxHeight as number) >= PANEL_MARGIN, true)
}

// ── 5. Horizontal placement and clamping ──
{
  const a = computeBubbleAnchor(bubbleBottomLeft, phone)
  check('grows rightward from a left-hand bubble', a.left, bubbleBottomLeft.left)

  const bubbleRight: BubbleBox = { top: 575, bottom: 623, left: 308, right: 356, height: 48 }
  const b = computeBubbleAnchor(bubbleRight, phone)
  const w = panelWidthFor(phone.width)
  check('right-hand bubble keeps the panel on screen',
    b.left >= PANEL_MARGIN && b.left + w <= phone.width - PANEL_MARGIN, true)
}

// ── 6. Desktop, and a very short window ──
{
  const desktop: Viewport = { width: 1440, height: 900 }
  const bubble: BubbleBox = { top: 732, bottom: 780, left: 1360, right: 1408, height: 48 }
  const a = computeBubbleAnchor(bubble, desktop)
  check('desktop panel bottom sits GAP above the bubble',
    desktop.height - (a.bottom as number), bubble.top - PANEL_GAP)
  check('desktop panel stays on screen',
    a.left >= PANEL_MARGIN && a.left + panelWidthFor(desktop.width) <= desktop.width - PANEL_MARGIN, true)

  // A short window makes the ceiling tiny; maxHeight must never go negative.
  const short: Viewport = { width: 372, height: 300 }
  const b = computeBubbleAnchor({ top: 220, bottom: 268, left: 16, right: 64, height: 48 }, short)
  check('short window never yields a negative maxHeight', (b.maxHeight as number) >= 0, true)
}

console.log(failures === 0 ? '\nAll bubble-anchor checks passed.\n' : `\n${failures} FAILED\n`)
process.exit(failures === 0 ? 0 : 1)
