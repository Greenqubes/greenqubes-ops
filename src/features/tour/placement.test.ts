/**
 * Standalone test for tooltip-card placement (no test framework).
 * Run: npx tsx src/features/tour/placement.test.ts
 */
import { placeCard } from './placement'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual); const e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`); failures++ }
}

const CARD = { width: 300, height: 160 }
const PHONE = { width: 390, height: 800 }

// plenty of room below → card sits 12px under the target, aligned to its left
check('below when it fits',
  placeCard({ top: 100, left: 40, width: 120, height: 40 }, CARD, PHONE),
  { mode: 'anchored', top: 152, left: 40 })

// target near the bottom → card flips above (top = target.top - 12 - cardH)
check('flips above near the bottom',
  placeCard({ top: 700, left: 40, width: 120, height: 40 }, CARD, PHONE),
  { mode: 'anchored', top: 528, left: 40 })

// horizontal clamp: target hugs the right edge → left clamped to fit + 8px margin
check('clamped to right edge',
  placeCard({ top: 100, left: 350, width: 30, height: 30 }, CARD, PHONE),
  { mode: 'anchored', top: 142, left: 82 })

// horizontal clamp: never left of the 8px margin
check('clamped to left margin',
  placeCard({ top: 100, left: 0, width: 30, height: 30 }, CARD, PHONE),
  { mode: 'anchored', top: 142, left: 8 })

// tall target on a short viewport: no room below or above → bottom sheet
check('sheet when nothing fits',
  placeCard({ top: 20, left: 0, width: 390, height: 700 }, CARD, { width: 390, height: 780 }),
  { mode: 'sheet' })

if (failures) { console.error(`\n${failures} test(s) FAILED`); process.exit(1) }
console.log('\nAll tests passed')
