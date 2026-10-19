/**
 * Standalone test for where the My Jobs panel sits on a PC (no framework).
 * Run: npx tsx src/features/schedule/my-jobs-panel-box.test.ts
 * Exits 1 on any failure.
 */
import { desktopPanelBox, measuredEdge } from './my-jobs-panel-box'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`); failures++ }
}

// NIC'S SCREENSHOT (2026-10-14): the panel ran from a guessed 60px down to the
// very bottom, so it sat over the right end of the bottom menu. It must fit
// BETWEEN the top bar and the bottom menu, measured, not guessed.
check('sits between the two bars', desktopPanelBox({ topBarBottom: 57, navTop: 840, viewportHeight: 900 }), { top: 57, bottom: 60 })
check('no bottom menu on the page → runs to the bottom', desktopPanelBox({ topBarBottom: 57, navTop: null, viewportHeight: 900 }), { top: 57, bottom: 0 })
check('no top bar measured → starts at the top', desktopPanelBox({ topBarBottom: null, navTop: 840, viewportHeight: 900 }), { top: 0, bottom: 60 })
check('never negative', desktopPanelBox({ topBarBottom: -5, navTop: 950, viewportHeight: 900 }), { top: 0, bottom: 0 })

// REVIEW #2 (2026-10-19): below laptop width the bottom menu is display:none,
// so it measures top 0 — and the panel was squeezed to zero height. A bar with
// no layout box counts as "not there", not as "at the top of the screen".
check('a hidden bar is not measured', measuredEdge({ hasLayoutBox: false, edge: 0 }), null)
check('a visible bar is measured', measuredEdge({ hasLayoutBox: true, edge: 843 }), 843)
check('hidden nav → panel runs to the bottom',
  desktopPanelBox({ topBarBottom: 57, navTop: measuredEdge({ hasLayoutBox: false, edge: 0 }), viewportHeight: 900 }), { top: 57, bottom: 0 })

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nall my-jobs-panel-box checks passed')
