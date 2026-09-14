/**
 * Standalone test for the upload gate (file type + video size cap).
 * Run: npx tsx src/lib/storage/upload-rules.test.ts
 * Exits 1 on any failure.
 *
 * The bug (Nic, 2026-09-14): attaching a video under Completion photos failed
 * with "Save failed — try again". `oldValidateContentType` below reproduces
 * the rule as it stood, so these tests can show it rejecting exactly the file
 * the fix accepts — without it, the tests would pass on any implementation.
 */

import {
  validateContentType,
  checkUpload,
  isVideoType,
  bytesToMb,
  MAX_VIDEO_BYTES,
} from './upload-rules'
import type { FileKind } from '@/lib/supabase/types'

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

// ── The rule as it stood before the fix, kept to prove the tests detect it ──
function oldValidateContentType(kind: FileKind, contentType: string): boolean {
  const isImage = kind === 'photo' || kind === 'completion'
  if (isImage)            return contentType.startsWith('image/')
  if (kind === 'voice')   return contentType.startsWith('audio/')
  return true
}

const MB = 1024 * 1024

console.log('\nupload-rules')

// ── 1. The reported bug ──
{
  check('OLD rule rejected a video on completion', oldValidateContentType('completion', 'video/mp4'), false)
  check('completion now accepts video/mp4',  validateContentType('completion', 'video/mp4'),  true)
  check('completion now accepts video/quicktime (iPhone)',
    validateContentType('completion', 'video/quicktime'), true)
  check('completion still accepts images',   validateContentType('completion', 'image/jpeg'), true)
  check('completion still refuses a PDF',    validateContentType('completion', 'application/pdf'), false)
}

// ── 2. Nic's call: completion only. Nothing else changes. ──
{
  check('photo still refuses video',  validateContentType('photo', 'video/mp4'), false)
  check('photo still accepts images', validateContentType('photo', 'image/png'), true)
  check('voice still audio-only',     validateContentType('voice', 'video/mp4'), false)
  // production_instructions (the Production photos section) and `do` fall
  // through to "anything", so they already took video before this change.
  check('production photos already took video',
    validateContentType('production_instructions', 'video/mp4'), true)
  check('do already took anything', validateContentType('do', 'video/mp4'), true)
}

// ── 3. The 100MB video cap ──
{
  check('90s clip passes',      checkUpload('completion', 'video/mp4', 80 * MB), { ok: true })
  check('exactly at the limit passes',
    checkUpload('completion', 'video/mp4', MAX_VIDEO_BYTES), { ok: true })
  check('one byte over is refused',
    checkUpload('completion', 'video/mp4', MAX_VIDEO_BYTES + 1),
    { ok: false, reason: 'size', limitBytes: MAX_VIDEO_BYTES })
  check('the cap is 100MB', bytesToMb(MAX_VIDEO_BYTES), 100)

  // The cap is for video. A large still is not what this rule is about.
  check('a large image is not size-capped',
    checkUpload('completion', 'image/jpeg', 300 * MB), { ok: true })

  // Server-side, size is unknown until the object lands — must not guess.
  check('no size given → type checked only',
    checkUpload('completion', 'video/mp4'), { ok: true })
}

// ── 4. Type failures report why, so the message can say it ──
{
  check('wrong type reports "type"',
    checkUpload('completion', 'application/pdf', 1 * MB), { ok: false, reason: 'type' })
  check('type is checked before size',
    checkUpload('photo', 'video/mp4', 500 * MB), { ok: false, reason: 'type' })
}

// ── 5. isVideoType ──
{
  check('video/mp4 is video',  isVideoType('video/mp4'), true)
  check('image/jpeg is not',   isVideoType('image/jpeg'), false)
  check('empty string is not', isVideoType(''), false)
}

console.log(failures === 0 ? '\nAll upload-rules checks passed.\n' : `\n${failures} FAILED\n`)
process.exit(failures === 0 ? 0 : 1)
