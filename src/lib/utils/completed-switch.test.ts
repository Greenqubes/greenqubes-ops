/**
 * Standalone test for the Schedule | Completed switch (no test framework).
 * Run: npx tsx src/lib/utils/completed-switch.test.ts
 * Exits 1 on any failure.
 */
import { liveHrefFor, navTabActive } from './completed-switch'
import { NAV_TABS } from '@/lib/navTabs'
import type { Role } from '@/lib/supabase/types'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`); failures++ }
}

const ROLES: Role[] = ['sales', 'scheduler', 'coordinator', 'installer', 'designer', 'production', 'admin', 'hr']

// Nic, 2026-10-27: "merge completed job tab into schedule tab, with a toggle
// button" — "basically standardize this view to all roles". The Completed tab
// leaves every menu; the switch at the top of the page replaces it.
console.log('the menu:')
for (const role of ROLES) {
  check(`${role} has no Completed tab any more`, NAV_TABS[role].some(t => t.href === '/completed'), false)
}

// The left half of the switch goes back to the role's own home page.
// Installers have no Schedule page (/schedule sends them to /installer).
console.log('liveHrefFor:')
check('installers go back to My Jobs', liveHrefFor('installer'), '/installer')
for (const role of ROLES.filter(r => r !== 'installer')) {
  check(`${role} goes back to Schedule`, liveHrefFor(role), '/schedule')
}
// HR / Finance has no Completed tab today; Nic: "give hr / finance this view as well".
check('HR / Finance gets the switch too, back to Schedule', liveHrefFor('hr'), '/schedule')

// With no Completed tab, the Completed page would leave NOTHING lit in the
// menu. It belongs to Schedule (or My Jobs), so that tab stays lit.
console.log('navTabActive:')
check('THE CHANGE: Completed lights the Schedule tab', navTabActive('/schedule', '/completed'), true)
check('THE CHANGE: Completed lights My Jobs for installers', navTabActive('/installer', '/completed'), true)
check('Completed does not light FCFS',      navTabActive('/fcfs', '/completed'), false)
check('Completed does not light Jobs',      navTabActive('/job-list', '/completed'), false)
check('Completed does not light Assistant', navTabActive('/assistant', '/completed'), false)
// Everything else behaves exactly as before (a prefix match).
check('Schedule lights Schedule',           navTabActive('/schedule', '/schedule'), true)
check('a page under a tab still lights it', navTabActive('/assistant', '/assistant/history'), true)
check('Schedule does not light FCFS',       navTabActive('/fcfs', '/schedule'), false)
check('FCFS does not light Schedule',       navTabActive('/schedule', '/fcfs'), false)

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`)
  process.exit(1)
}
console.log('\nAll checks passed.')
