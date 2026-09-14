/**
 * Standalone test for the portalled dropdown's positioning.
 * Run: npx tsx src/components/anchored-dropdown.test.ts
 * Exits 1 on any failure.
 *
 * Context (Nic, 2026-09-14): the time picker's list was clipped by its card's
 * `overflow-hidden`, so only three options were reachable. The list now draws
 * on top of the page, which means it has to position itself — these checks
 * cover the cases that make that safe: it never runs off an edge, it flips up
 * when the field is near the bottom, and it is capped to the room available.
 */

import {
  computeDropdownPosition,
  DROPDOWN_GAP,
  DROPDOWN_MARGIN,
  type TriggerBox,
  type Viewport,
} from './anchored-dropdown'

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

const PREFERRED = 192 // max-h-48, the list's current ceiling
const phone:   Viewport = { width: 372, height: 687 }
const desktop: Viewport = { width: 1440, height: 900 }

console.log('\nanchored-dropdown')

// ── 1. Plenty of room below — opens downward, just under the field ──
{
  const trigger: TriggerBox = { top: 200, bottom: 238, left: 16, width: 160 }
  const p = computeDropdownPosition(trigger, phone, PREFERRED)
  check('opens below', p.placement, 'below')
  check('sits GAP under the trigger', p.top, trigger.bottom + DROPDOWN_GAP)
  check('bottom is auto when opening below', p.bottom, null)
  check('matches the trigger width', p.width, trigger.width)
  check('lines up with the trigger', p.left, trigger.left)
  check('gets its full preferred height', p.maxHeight, PREFERRED)
}

// ── 2. The reported case: field near the bottom of the screen ──
{
  // "Time end" low in a card on a phone — the case Nic screenshotted.
  const trigger: TriggerBox = { top: 600, bottom: 638, left: 190, width: 166 }
  const p = computeDropdownPosition(trigger, phone, PREFERRED)
  check('flips above when below is cramped', p.placement, 'above')
  check('top is auto when opening above', p.top, null)
  check('bottom edge sits GAP above the trigger',
    phone.height - (p.bottom as number), trigger.top - DROPDOWN_GAP)
  check('capped to the room above', p.maxHeight, PREFERRED)
  check('cannot reach the top edge',
    (phone.height - (p.bottom as number)) - p.maxHeight >= DROPDOWN_MARGIN, true)
}

// ── 3. Cramped both ways — never negative, never off-screen ──
{
  const short: Viewport = { width: 372, height: 300 }
  const trigger: TriggerBox = { top: 130, bottom: 168, left: 16, width: 160 }
  const p = computeDropdownPosition(trigger, short, PREFERRED)
  check('height never goes negative', p.maxHeight >= 0, true)
  check('height fits the chosen side',
    p.placement === 'below'
      ? p.maxHeight <= short.height - trigger.bottom - DROPDOWN_GAP - DROPDOWN_MARGIN
      : p.maxHeight <= trigger.top - DROPDOWN_GAP - DROPDOWN_MARGIN,
    true)
}

// ── 4. A field at the very top must not flip up into nothing ──
{
  const trigger: TriggerBox = { top: 4, bottom: 42, left: 16, width: 160 }
  const p = computeDropdownPosition(trigger, phone, PREFERRED)
  check('stays below when there is no room above', p.placement, 'below')
}

// ── 5. Horizontal clamping — a wide field near the right edge ──
{
  const trigger: TriggerBox = { top: 200, bottom: 238, left: 340, width: 160 }
  const p = computeDropdownPosition(trigger, phone, PREFERRED)
  check('pulled back inside the right edge',
    p.left + p.width <= phone.width - DROPDOWN_MARGIN, true)
  check('never crosses the left edge', p.left >= DROPDOWN_MARGIN, true)
}

// ── 6. A field wider than the screen must still produce a sane left ──
{
  const trigger: TriggerBox = { top: 200, bottom: 238, left: 0, width: 500 }
  const p = computeDropdownPosition(trigger, phone, PREFERRED)
  check('oversized trigger clamps to the margin', p.left, DROPDOWN_MARGIN)
}

// ── 7. Desktop behaves the same way ──
{
  const trigger: TriggerBox = { top: 300, bottom: 338, left: 1100, width: 220 }
  const p = computeDropdownPosition(trigger, desktop, PREFERRED)
  check('desktop opens below with room', p.placement, 'below')
  check('desktop stays on screen',
    p.left >= DROPDOWN_MARGIN && p.left + p.width <= desktop.width - DROPDOWN_MARGIN, true)
}

console.log(failures === 0 ? '\nAll anchored-dropdown checks passed.\n' : `\n${failures} FAILED\n`)
process.exit(failures === 0 ? 0 : 1)
