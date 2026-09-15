/**
 * Standalone test for new-job attachment rules (no test framework).
 * Run: npx tsx src/lib/storage/new-job-attachments.test.ts
 * Exits 1 on any failure.
 */

import { NEW_JOB_PREFIX, newJobScratchPrefix, ownsNewJobScratchKey, DEFAULT_BUCKET_NAMES, isDefaultBucketName } from './new-job-attachments'

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

const ME  = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'
const YOU = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb'

console.log('newJobScratchPrefix:')
check('a person\'s own holding area', newJobScratchPrefix(ME), `${NEW_JOB_PREFIX}${ME}/`)

console.log('\nownsNewJobScratchKey:')

// The happy path: a file this person just uploaded, waiting to be attached.
check('own upload', ownsNewJobScratchKey(ME, `${NEW_JOB_PREFIX}${ME}/9f2c.pdf`), true)
check('own upload, nested name', ownsNewJobScratchKey(ME, `${NEW_JOB_PREFIX}${ME}/a-b-c.PNG`), true)

// THE SECURITY CASE, and the reason this function exists. The key arrives in
// the request body. Without this check a caller could name ANY object in the
// bucket and have it copied onto their brand-new job — including a file from
// a job they are not allowed to open, or another person's holding area.
check('someone else\'s holding area is refused',
  ownsNewJobScratchKey(ME, `${NEW_JOB_PREFIX}${YOU}/secret.pdf`), false)
check('an existing job\'s file is refused',
  ownsNewJobScratchKey(ME, '2026-10-02_Arnotts_25855e82/attachment/quote.pdf'), false)
check('the assistant\'s scratch area is refused',
  ownsNewJobScratchKey(ME, `asst-chat/${ME}/notes.pdf`), false)
check('a bug screenshot is refused',
  ownsNewJobScratchKey(ME, 'bug-reports/shot.png'), false)

// Path games. The prefix check must not be fooled by traversal or by a key
// that merely CONTAINS the right text somewhere.
check('parent traversal is refused',
  ownsNewJobScratchKey(ME, `${NEW_JOB_PREFIX}${ME}/../${YOU}/secret.pdf`), false)
check('traversal mid-key is refused',
  ownsNewJobScratchKey(ME, `${NEW_JOB_PREFIX}${ME}/a/../../x.pdf`), false)
check('a key that only mentions the prefix later is refused',
  ownsNewJobScratchKey(ME, `jobs/x/${NEW_JOB_PREFIX}${ME}/f.pdf`), false)
check('another id that merely starts the same way is refused',
  ownsNewJobScratchKey(ME, `${NEW_JOB_PREFIX}${ME}-evil/f.pdf`), false)

// Nothing, or rubbish, is not an upload.
check('empty key', ownsNewJobScratchKey(ME, ''), false)
check('the bare prefix with no file', ownsNewJobScratchKey(ME, `${NEW_JOB_PREFIX}${ME}/`), false)
check('the folder without a slash', ownsNewJobScratchKey(ME, `${NEW_JOB_PREFIX}${ME}`), false)
check('no user id', ownsNewJobScratchKey('', `${NEW_JOB_PREFIX}/f.pdf`), false)

// ── Buckets ─────────────────────────────────────────────────────────────────
// The New Job form shows the SAME four buckets the job form does (Nic,
// 2026-09-15): filing into "Attachments" and then finding the file under
// OTHERS reads like the file moved on its own.
//
// Bucket IDs do not exist until the job is created, so a pending file carries
// the bucket's NAME and is matched up after. That makes the name a contract
// between three places — the UI, the create step and the attach route — so it
// lives here and is checked rather than retyped.
console.log('\nbucket names:')

check('the four job-form buckets, in the order the job creates them',
  DEFAULT_BUCKET_NAMES,
  ['PERMIT-TO-WORK', 'BCA', 'DESIGNER JO', 'OTHERS'])

check('a real bucket is accepted', isDefaultBucketName('BCA'), true)
check('OTHERS is a real bucket', isDefaultBucketName('OTHERS'), true)
// A bucket name that is not one of the four would file the upload nowhere
// visible, which is the exact confusion this change exists to remove.
check('an unknown bucket is refused', isDefaultBucketName('SECRET'), false)
check('case matters — the job creates them upper-case', isDefaultBucketName('bca'), false)
check('empty is refused', isDefaultBucketName(''), false)
check('whitespace is refused', isDefaultBucketName('  BCA  '), false)

console.log(failures === 0 ? '\nAll new-job attachment checks passed.' : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)
