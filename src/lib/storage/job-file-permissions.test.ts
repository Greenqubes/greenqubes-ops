/**
 * Standalone test for the job-file delete permission rules (no test framework in this repo).
 * Run: npx tsx src/lib/storage/job-file-permissions.test.ts
 * Exits 1 on any failure.
 */

import { canManageJobFiles } from './job-file-permissions'

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

const OFFICE_ROLES = ['sales', 'scheduler', 'coordinator', 'designer', 'production', 'admin']

// 1. Every office role may delete on an active (non-completed) job
for (const role of OFFICE_ROLES) {
  check(`${role} allowed on scheduled job`, canManageJobFiles(role, 'scheduled'), { allowed: true })
}
check('sales allowed on pending job', canManageJobFiles('sales', 'pending'), { allowed: true })
check('scheduler allowed on awaiting_approval job', canManageJobFiles('scheduler', 'awaiting_approval'), { allowed: true })

// 2. Installers never delete, whatever the job status
check('installer denied on scheduled job', canManageJobFiles('installer', 'scheduled'), { allowed: false, reason: 'role' })
check('installer denied on pending job', canManageJobFiles('installer', 'pending'), { allowed: false, reason: 'role' })

// 3. Completed jobs are locked for everyone, admin included
for (const role of OFFICE_ROLES) {
  check(`${role} denied on completed job`, canManageJobFiles(role, 'completed'), { allowed: false, reason: 'completed' })
}

// 4. Missing or unknown role is denied
check('null role denied', canManageJobFiles(null, 'scheduled'), { allowed: false, reason: 'role' })
check('undefined role denied', canManageJobFiles(undefined, 'scheduled'), { allowed: false, reason: 'role' })
check('unknown role denied', canManageJobFiles('hacker', 'scheduled'), { allowed: false, reason: 'role' })
check('empty role denied', canManageJobFiles('', 'scheduled'), { allowed: false, reason: 'role' })

// 5. Orphaned file (job row gone) — office roles may clean it up, installers may not
check('sales allowed when job status unknown', canManageJobFiles('sales', null), { allowed: true })
check('admin allowed when job status unknown', canManageJobFiles('admin', undefined), { allowed: true })
check('installer denied when job status unknown', canManageJobFiles('installer', null), { allowed: false, reason: 'role' })

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`)
process.exit(failures === 0 ? 0 : 1)
