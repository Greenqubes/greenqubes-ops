/**
 * Standalone test for the job-file delete permission rules (no test framework in this repo).
 * Run: npx tsx src/lib/storage/job-file-permissions.test.ts
 * Exits 1 on any failure.
 */

import { canManageJobFiles, canDeleteJobFile } from './job-file-permissions'

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

// 2. Installers never manage attachment buckets, whatever the job status
check('installer denied on scheduled job', canManageJobFiles('installer', 'scheduled'), { allowed: false, reason: 'role' })
check('installer denied on pending job', canManageJobFiles('installer', 'pending'), { allowed: false, reason: 'role' })

// 3. Attachment buckets: completed jobs are locked for everyone, admin included
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

// ── 6. The job form's photo sections: one standard rule (Nic, 2026-09-28) ──
// Production Photos, Signed DO and Completion Photos. Anyone who may delete
// there may delete ANY upload — whose it is no longer matters — while the job
// is open and for 24 hours after it is completed. On a completed job the last
// completion photo stays (the job was only allowed to complete because it had
// one). Signed DO has no minimum.
const DONE_AT = '2026-09-25T10:10:03.596Z'
const doneMs  = Date.parse(DONE_AT)
const HOUR    = 60 * 60 * 1000
const del = (over: Partial<Parameters<typeof canDeleteJobFile>[0]> = {}) => canDeleteJobFile({
  role: 'installer', jobStatus: 'scheduled', completedAt: null, fileKind: 'completion',
  otherCompletionFiles: 2, now: doneMs + HOUR, ...over,
})
const done = (over: Partial<Parameters<typeof canDeleteJobFile>[0]> = {}) =>
  del({ jobStatus: 'completed', completedAt: DONE_AT, ...over })

// The reported case (25 Sept): wrong photos, Completed pressed a minute later.
check('installer: Signed DO an hour after completion → allowed', done({ fileKind: 'do' }), { allowed: true })
check('installer: completion photo an hour after completion → allowed', done(), { allowed: true })

// Open jobs
check('installer: completion on an open job', del(), { allowed: true })
check('installer: Signed DO on an open job', del({ fileKind: 'do' }), { allowed: true })
check('installer: open job may go down to zero completion photos', del({ otherCompletionFiles: 0 }), { allowed: true })
check('office: Signed DO on an open job', del({ role: 'sales', fileKind: 'do' }), { allowed: true })

// The 24-hour window
check('23h59m after completion → allowed', done({ now: doneMs + 24 * HOUR - 60_000 }), { allowed: true })
check('exactly 24h after completion → locked', done({ now: doneMs + 24 * HOUR }), { allowed: false, reason: 'completed' })
check('a week later → locked', done({ now: doneMs + 7 * 24 * HOUR }), { allowed: false, reason: 'completed' })
check('completed with no recorded time → locked', done({ completedAt: null }), { allowed: false, reason: 'completed' })
check('garbage completion time → locked', done({ completedAt: 'not-a-date' }), { allowed: false, reason: 'completed' })

// Office staff get the same window
for (const role of ['sales', 'scheduler', 'coordinator', 'production', 'admin']) {
  check(`${role}: completion photo within 24h`, done({ role }), { allowed: true })
  check(`${role}: Signed DO within 24h`, done({ role, fileKind: 'do' }), { allowed: true })
  check(`${role}: locked after 24h`, done({ role, now: doneMs + 25 * HOUR }), { allowed: false, reason: 'completed' })
}
check('production photos within 24h (office)', done({ role: 'production', fileKind: 'production_instructions' }), { allowed: true })

// The minimum of one on a completed job
check('last completion photo on a completed job → kept',
  done({ otherCompletionFiles: 0 }), { allowed: false, reason: 'last-completion' })
check('office cannot take the last one either',
  done({ role: 'scheduler', otherCompletionFiles: 0 }), { allowed: false, reason: 'last-completion' })
check('Signed DO has no minimum', done({ fileKind: 'do', otherCompletionFiles: 0 }), { allowed: true })
check('after 24h, "completed" is the reason even for the last photo',
  done({ otherCompletionFiles: 0, now: doneMs + 30 * HOUR }), { allowed: false, reason: 'completed' })

// What does NOT change
check('installer: never attachments', del({ fileKind: 'attachment' }), { allowed: false, reason: 'role' })
check('installer: never production photos', del({ fileKind: 'production_instructions' }), { allowed: false, reason: 'role' })
check('office: attachments still locked the moment a job completes',
  done({ role: 'sales', fileKind: 'attachment' }), { allowed: false, reason: 'completed' })
check('office: attachments on an open job (unchanged)', del({ role: 'production', fileKind: 'attachment' }), { allowed: true })
check('unknown role refused', del({ role: 'hacker' }), { allowed: false, reason: 'role' })
check('null role refused', del({ role: null }), { allowed: false, reason: 'role' })
check('orphaned file: office may clean up', del({ role: 'admin', jobStatus: null, fileKind: 'attachment' }), { allowed: true })
check('orphaned file: installer may not', del({ jobStatus: null }), { allowed: false, reason: 'role' })

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`)
process.exit(failures === 0 ? 0 : 1)
