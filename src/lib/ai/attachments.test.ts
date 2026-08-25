/**
 * Standalone test for assistant chat attachment rules.
 * Run: npx tsx src/lib/ai/attachments.test.ts
 * Exits 1 on any failure.
 */

import {
  MAX_FILES_PER_MESSAGE, MAX_IMAGE_BYTES, MAX_PDF_BYTES, MAX_MESSAGE_BYTES,
  validateAttachment, isOwnScratchKey, attachmentNote,
} from './attachments'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) { console.log(`  ✓ ${name}`) }
  else { console.error(`  ✗ ${name}\n      expected: ${JSON.stringify(expected)}\n      actual:   ${JSON.stringify(actual)}`); failures++ }
}

// 1. Caps per the Phase 3 plan
check('5 files per message', MAX_FILES_PER_MESSAGE, 5)
check('5 MB images', MAX_IMAGE_BYTES, 5 * 1024 * 1024)
check('15 MB PDFs', MAX_PDF_BYTES, 15 * 1024 * 1024)
check('20 MB per message', MAX_MESSAGE_BYTES, 20 * 1024 * 1024)

// 2. Mime allowlist — Anthropic-supported image types + PDF only
check('jpeg ok',   validateAttachment('a.jpg',  'image/jpeg',      1000), null)
check('png ok',    validateAttachment('a.png',  'image/png',       1000), null)
check('webp ok',   validateAttachment('a.webp', 'image/webp',      1000), null)
check('gif ok',    validateAttachment('a.gif',  'image/gif',       1000), null)
check('pdf ok',    validateAttachment('a.pdf',  'application/pdf', 1000), null)
check('heic rejected', validateAttachment('a.heic', 'image/heic',  1000), 'type')
check('docx rejected', validateAttachment('a.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 1000), 'type')
check('empty mime rejected', validateAttachment('a', '', 1000), 'type')

// 3. Size caps per type
check('image at cap ok',   validateAttachment('a.jpg', 'image/jpeg', 5 * 1024 * 1024), null)
check('image over cap',    validateAttachment('a.jpg', 'image/jpeg', 5 * 1024 * 1024 + 1), 'size')
check('pdf at cap ok',     validateAttachment('a.pdf', 'application/pdf', 15 * 1024 * 1024), null)
check('pdf over cap',      validateAttachment('a.pdf', 'application/pdf', 15 * 1024 * 1024 + 1), 'size')

// 4. Scratch-key ownership guard
check('own key ok',        isOwnScratchKey('asst-chat/user-1/abc.pdf', 'user-1'), true)
check('other user blocked', isOwnScratchKey('asst-chat/user-2/abc.pdf', 'user-1'), false)
check('job key blocked',   isOwnScratchKey('jobs/folder/attachments/x.pdf', 'user-1'), false)
check('traversal blocked', isOwnScratchKey('asst-chat/user-1/../user-2/x.pdf', 'user-1'), false)
check('prefix-user trick blocked', isOwnScratchKey('asst-chat/user-12/abc.pdf', 'user-1'), false)

// 5. Attachment note — ids the model passes to create_pending_job
check('empty note', attachmentNote([]), '')
const note = attachmentNote([
  { id: 'a1', key: 'k1', name: 'permit.pdf', mime: 'application/pdf', size: 1 },
  { id: 'a2', key: 'k2', name: 'site.jpg',   mime: 'image/jpeg',      size: 1 },
])
check('note lists ids',   note.includes('a1') && note.includes('a2'), true)
check('note lists names', note.includes('permit.pdf') && note.includes('site.jpg'), true)
check('note labels types', note.includes('(pdf)') && note.includes('(image)'), true)

if (failures > 0) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nAll attachment checks passed')
