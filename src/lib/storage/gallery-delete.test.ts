/**
 * Standalone test for the gallery's Delete-for-everyone rule (no framework).
 * Run: npx tsx src/lib/storage/gallery-delete.test.ts
 * Exits 1 on any failure.
 */
import { canDeleteForEveryone, type DeleteForEveryoneInput } from './gallery-delete'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`); failures++ }
}

const base: DeleteForEveryoneInput = {
  role: 'sales', isAdmin: false, viewerId: 'u1', source: 'chat', fileKind: 'attachment', byId: 'u1',
  jobStatus: 'scheduled', completedAt: null, otherCompletionFiles: 0, filesLocked: false, designBriefEditable: true,
}
const can = (over: Partial<DeleteForEveryoneInput>) => canDeleteForEveryone({ ...base, ...over })
const done = { jobStatus: 'completed', completedAt: '2026-11-01T00:00:00Z', now: Date.parse('2026-11-11T00:00:00Z') }

// Chat photos, files and voice notes (Nic: the sender, schedulers, admin).
check('chat: own photo',                        can({}), true)
check('chat: someone else\'s, as sales',         can({ byId: 'u2' }), false)
check('chat: someone else\'s, as scheduler',     can({ byId: 'u2', role: 'scheduler' }), true)
check('chat: someone else\'s, as admin',         can({ byId: 'u2', role: 'scheduler', isAdmin: true }), true)
check('chat: own photo, completed job',         can({ ...done }), false)
check('chat: installer\'s own photo',            can({ role: 'installer', viewerId: 'u3', byId: 'u3' }), true)
check('voice: own',                             can({ source: 'voice', fileKind: null }), true)

// Files folders: the office rule, minus production and the Ongoing lock.
const folder = { source: 'files' as const, fileKind: 'attachment', byId: 'u9' }
check('folder: sales',                          can({ ...folder }), true)
check('folder: production (view-only page)',    can({ ...folder, role: 'production' }), false)
check('folder: locked (non-sharer on Ongoing)', can({ ...folder, filesLocked: true }), false)
check('folder: installer',                      can({ ...folder, role: 'installer' }), false)
check('folder: hr',                             can({ ...folder, role: 'hr' }), false)
check('folder: completed job',                  can({ ...folder, ...done }), false)

// Production / signed DO / completion photos: canDeleteJobFile, minus designers.
const comp = { source: 'completion' as const, fileKind: 'completion', byId: 'u9' }
check('completion: designer (view-only)',       can({ ...comp, role: 'designer' }), false)
check('completion: installer, open job',        can({ ...comp, role: 'installer' }), true)
check('completion: last one, completed job',    can({ ...comp, ...done }), false)
check('completion: fix after completion',       can({ ...comp, ...done, otherCompletionFiles: 1 }), true)
check('production photo: production role',      can({ source: 'production', fileKind: 'production_instructions', byId: 'u9', role: 'production' }), true)

// Design brief: only while the page lets it be edited.
const brief = { source: 'design_brief' as const, fileKind: 'design_brief', byId: 'u9' }
check('brief: locked page',                     can({ ...brief, designBriefEditable: false }), false)
check('brief: installer',                       can({ ...brief, role: 'installer' }), false)
check('brief: sales, editable',                 can({ ...brief }), true)

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nAll gallery-delete checks passed')
