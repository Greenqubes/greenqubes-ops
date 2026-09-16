/**
 * Standalone test for job location coordinates (no test framework).
 * Run: npx tsx src/lib/utils/location-coords.test.ts
 * Exits 1 on any failure.
 */

import { coordsAfterChange } from './location-coords'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`); failures++ }
}

const HERE  = { lat: 1.3036, lng: 103.8318 }
const THERE = { lat: 1.3521, lng: 103.8198 }

console.log('coordsAfterChange:')

check('picking a suggestion stores its coordinates',
  coordsAfterChange({ previous: { lat: null, lng: null }, nextValue: '313 Orchard Rd', fromPick: true, pickedCoords: HERE }),
  HERE)

check('picking a different place replaces them',
  coordsAfterChange({ previous: HERE, nextValue: 'Somewhere else', fromPick: true, pickedCoords: THERE }),
  THERE)

// The bug this rule exists to prevent: pick "313 Orchard", then hand-edit the
// text to a different address. Without clearing, the job would carry
// coordinates pointing at a place it is no longer at — silently wrong data
// that a future proximity feature would trust.
check('typing over a picked address clears the coordinates',
  coordsAfterChange({ previous: HERE, nextValue: 'Blk 825 Tampines', fromPick: false }),
  { lat: null, lng: null })

// Whitespace-only edits are not a different place.
check('trailing whitespace is not a new address',
  coordsAfterChange({ previous: HERE, nextValue: '313 Orchard Rd  ', fromPick: false, previousValue: '313 Orchard Rd' }),
  HERE)

check('a pick that returns no coordinates leaves nothing behind',
  coordsAfterChange({ previous: HERE, nextValue: 'Unknown place', fromPick: true, pickedCoords: null }),
  { lat: null, lng: null })

check('an empty box has no coordinates',
  coordsAfterChange({ previous: HERE, nextValue: '', fromPick: false }),
  { lat: null, lng: null })

console.log(failures === 0 ? '\nAll location-coords checks passed.' : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)
