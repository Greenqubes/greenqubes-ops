/**
 * Standalone test for the job-file delete permission rules (no test framework in this repo).
 * Run: npx tsx src/lib/storage/job-file-permissions.test.ts
 * Exits 1 on any failure.
 */

import { canManageJobFiles, canDeleteOwnUpload, canDeleteJobFile } from './job-file-permissions'

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

// ── 6. Installer deleting their OWN completion upload (Nic, 2026-09-14) ──
// The narrow exception to "installers never". Everything in section 2 above
// still holds for the office rule — this is a separate, additional path.
const ME    = 'user-me'
const OTHER = 'user-other'
const own = (over: Partial<Parameters<typeof canDeleteOwnUpload>[0]> = {}) => canDeleteOwnUpload({
  role: 'installer', jobStatus: 'scheduled', fileKind: 'completion',
  uploaderId: ME, userId: ME, ...over,
})

check('installer may delete their own completion photo', own(), { allowed: true })
check('installer may not delete a colleague\'s', own({ uploaderId: OTHER }), { allowed: false, reason: 'not-owner' })
check('installer may not delete once completed', own({ jobStatus: 'completed' }), { allowed: false, reason: 'completed' })
check('completed beats ownership', own({ jobStatus: 'completed', uploaderId: OTHER }), { allowed: false, reason: 'completed' })
check('only completion files, not attachments', own({ fileKind: 'attachment' }), { allowed: false, reason: 'role' })
check('only completion files, not DOs', own({ fileKind: 'do' }), { allowed: false, reason: 'role' })
check('not production photos either', own({ fileKind: 'production_instructions' }), { allowed: false, reason: 'role' })
check('an unknown uploader is never "mine"', own({ uploaderId: null }), { allowed: false, reason: 'not-owner' })
check('an unknown caller is never the owner', own({ userId: null }), { allowed: false, reason: 'not-owner' })
check('null-equals-null must not match', own({ uploaderId: null, userId: null }), { allowed: false, reason: 'not-owner' })
check('this path is installers only — sales uses the office rule', own({ role: 'sales' }), { allowed: false, reason: 'role' })

// ── 7. The combined gate callers actually use ──
const del = (over: Partial<Parameters<typeof canDeleteJobFile>[0]> = {}) => canDeleteJobFile({
  role: 'installer', jobStatus: 'scheduled', fileKind: 'completion',
  uploaderId: ME, userId: ME, ...over,
})

check('combined: installer, own completion → allowed', del(), { allowed: true })
check('combined: installer, someone else\'s → not-owner', del({ uploaderId: OTHER }), { allowed: false, reason: 'not-owner' })
check('combined: production deletes its own photos (office rule)',
  del({ role: 'production', fileKind: 'production_instructions' }), { allowed: true })
check('combined: production deletes ANY file on an open job (unchanged)',
  del({ role: 'production', fileKind: 'attachment', uploaderId: OTHER }), { allowed: true })
check('combined: office role still blocked once completed',
  del({ role: 'sales', fileKind: 'attachment', jobStatus: 'completed' }), { allowed: false, reason: 'completed' })
check('combined: installer still blocked on non-completion files',
  del({ fileKind: 'attachment' }), { allowed: false, reason: 'role' })
check('combined: unknown role refused', del({ role: 'hacker' }), { allowed: false, reason: 'role' })

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`)
process.exit(failures === 0 ? 0 : 1)
