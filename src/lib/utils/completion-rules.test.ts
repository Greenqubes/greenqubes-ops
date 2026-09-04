/**
 * Standalone test for installer completion rules (no test framework).
 * Run: npx tsx src/lib/utils/completion-rules.test.ts
 * Exits 1 on any failure.
 */

import { installerCompleteState, showSignedDoSection } from './completion-rules'

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

// ── installerCompleteState ──────────────────────────────────────────────
// Only installers on a scheduled job ever see the button.
check('office role → hidden', installerCompleteState({ role: 'scheduler', status: 'scheduled', completionPhotoCount: 3 }), 'hidden')
check('sales → hidden', installerCompleteState({ role: 'sales', status: 'scheduled', completionPhotoCount: 1 }), 'hidden')
check('installer on pending job → hidden', installerCompleteState({ role: 'installer', status: 'pending', completionPhotoCount: 1 }), 'hidden')
check('installer on completed job → hidden', installerCompleteState({ role: 'installer', status: 'completed', completionPhotoCount: 5 }), 'hidden')
// Photo gate: greyed out with no completion photo, live once one exists.
check('installer, scheduled, no photo → disabled', installerCompleteState({ role: 'installer', status: 'scheduled', completionPhotoCount: 0 }), 'disabled')
check('installer, scheduled, one photo → enabled', installerCompleteState({ role: 'installer', status: 'scheduled', completionPhotoCount: 1 }), 'enabled')
check('installer, scheduled, many photos → enabled', installerCompleteState({ role: 'installer', status: 'scheduled', completionPhotoCount: 7 }), 'enabled')

// ── showSignedDoSection ─────────────────────────────────────────────────
// No DO issued and nothing uploaded → the field has no reason to exist.
check('no DO issued, no files → hidden', showSignedDoSection({ doIssued: false, signedDoFileCount: 0 }), false)
// DO issued → installer needs somewhere to upload the signed copy.
check('DO issued, no files → shown', showSignedDoSection({ doIssued: true, signedDoFileCount: 0 }), true)
check('DO issued, with files → shown', showSignedDoSection({ doIssued: true, signedDoFileCount: 2 }), true)
// Safety net: an already-uploaded signed DO never disappears from view,
// even if the DO-issued tick is later removed.
check('DO tick removed but file exists → shown', showSignedDoSection({ doIssued: false, signedDoFileCount: 1 }), true)

if (failures) {
  console.error(`\n${failures} test(s) FAILED`)
  process.exit(1)
}
console.log('\nAll tests passed')
