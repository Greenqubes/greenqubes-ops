/**
 * Standalone test for the nav-role rule (no test framework).
 * Run: npx tsx src/lib/utils/nav-role.test.ts
 * Exits 1 on any failure.
 *
 * Kept in its own file, away from role-override.ts, because that module
 * imports next/headers and cannot be run outside a request.
 */

import { navRoleFor } from './nav-role'

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

console.log('navRoleFor:')

// THE BUG this exists to fix (Nic, 2026-09-15): getEffectiveRole answers
// 'scheduler' for a plain admin, so NAV_TABS.admin was unreachable and every
// admin navigated with the scheduler's tabs — no Pending, no Leave.
check('a plain admin gets their own tabs', navRoleFor('admin', undefined), 'admin')
check('no override cookie is the same thing', navRoleFor('admin', null), 'admin')

// PREVIEW-AS MUST STILL WORK. It is the whole point of the feature: an admin
// checking what sales sees should get the sales nav, not their own.
check('an admin previewing as sales gets the sales tabs', navRoleFor('admin', 'sales'), 'sales')
check('an admin previewing as installer gets the installer tabs', navRoleFor('admin', 'installer'), 'installer')
check('an admin previewing as hr gets the hr tabs', navRoleFor('admin', 'hr'), 'hr')

// Everyone else is untouched — the override cookie is meaningless for them,
// and a stray one must not let a non-admin wear another role's navigation.
check('a real scheduler is unaffected', navRoleFor('scheduler', undefined), 'scheduler')
check('a sales user with a stray override stays sales', navRoleFor('sales', 'admin'), 'sales')
check('an installer with a stray override stays installer', navRoleFor('installer', 'scheduler'), 'installer')

// Junk in the cookie falls back rather than throwing or blanking the nav.
check('an unknown override falls back to the real role', navRoleFor('admin', 'wizard'), 'admin')
check('an empty override falls back too', navRoleFor('admin', ''), 'admin')
// 'admin' is deliberately not a valid override value — VALID_ROLES excludes
// it, so "preview as admin" is a no-op rather than a second way to be admin.
check('previewing as admin is not a thing', navRoleFor('admin', 'admin'), 'admin')

console.log(failures === 0 ? '\nAll nav-role checks passed.' : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)
