/**
 * Standalone test for assistant chat attachment rules.
 * Run: npx tsx src/lib/ai/attachments.test.ts
 * Exits 1 on any failure.
 */

import {
  MAX_FILES_PER_MESSAGE, MAX_IMAGE_BYTES, MAX_PDF_BYTES, MAX_MESSAGE_BYTES,
  MAX_PROJECT_FILES, MAX_PROJECT_BYTES, REQUEST_FILE_BUDGET,
  validateAttachment, isOwnScratchKey, attachmentNote,
  isOwnProjectKey, validateProjectFile,
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

// 6. Project file rules (Phase 4) — count is cheap, bytes are the physics:
// files ride on every message, so the total is bounded by the API request cap
check('10 files per project', MAX_PROJECT_FILES, 10)
check('20 MB per project', MAX_PROJECT_BYTES, 20 * 1024 * 1024)
check('22 MB request budget', REQUEST_FILE_BUDGET, 22 * 1024 * 1024)

// 7. Project-key ownership guard
check('own project key ok',       isOwnProjectKey('asst-projects/u1/p1/a.pdf', 'u1', 'p1'), true)
check('other user key rejected',  isOwnProjectKey('asst-projects/u2/p1/a.pdf', 'u1', 'p1'), false)
check('other project rejected',   isOwnProjectKey('asst-projects/u1/p2/a.pdf', 'u1', 'p1'), false)
check('scratch key not a project key', isOwnProjectKey('asst-chat/u1/a.pdf', 'u1', 'p1'), false)
check('dotdot rejected',          isOwnProjectKey('asst-projects/u1/p1/../../x', 'u1', 'p1'), false)
check('prefix-project trick blocked', isOwnProjectKey('asst-projects/u1/p12/a.pdf', 'u1', 'p1'), false)

// 8. Project file validation (count → per-file type/size → running total)
check('project file ok',        validateProjectFile('a.pdf', 'application/pdf', 1000, 0, 0), null)
check('project count cap',      validateProjectFile('a.pdf', 'application/pdf', 1000, 10, 0), 'count')
check('9 existing still ok',    validateProjectFile('a.pdf', 'application/pdf', 1000, 9, 0), null)
check('project type rejected',  validateProjectFile('a.docx', 'application/msword', 1000, 0, 0), 'type')
check('project per-file size',  validateProjectFile('a.jpg', 'image/jpeg', 6 * 1024 * 1024, 0, 0), 'size')
check('project total cap',      validateProjectFile('a.pdf', 'application/pdf', 6 * 1024 * 1024, 1, 15 * 1024 * 1024), 'total')
check('project total at cap ok', validateProjectFile('a.pdf', 'application/pdf', 5 * 1024 * 1024, 1, 15 * 1024 * 1024), null)

if (failures > 0) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nAll attachment checks passed')
