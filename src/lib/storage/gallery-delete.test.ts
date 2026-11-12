/**
 * Standalone test for the gallery's Delete-for-everyone rule (no framework).
 * Run: npx tsx src/lib/storage/gallery-delete.test.ts
 * Exits 1 on any failure.
 */
import { canDeleteForEveryone, pageFileGates, everyoneBatch, voiceKeyBelongsToJob, type DeleteForEveryoneInput } from './gallery-delete'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`); failures++ }
}

const base: DeleteForEveryoneInput = {
  role: 'sales', isAdmin: false, viewerId: 'u1', source: 'chat', fileKind: 'attachment', byId: 'u1',
  jobStatus: 'scheduled', completedAt: null, otherCompletionFiles: 0, filesLocked: false, designBriefEditable: true,
  // Sent an hour before 'now' — inside the sender's 24-hour window.
  sentAt: '2026-11-10T23:00:00Z', now: Date.parse('2026-11-11T00:00:00Z'),
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

// The sender's own Delete for everyone lasts 24 hours (Nic, 2026-11-12);
// after that they only get Delete for me. Schedulers and admin keep it.
const old = { sentAt: '2026-11-09T23:00:00Z' }  // 25 hours before now
check('chat: own photo after 24 hours',         can({ ...old }), false)
check('chat: own photo at exactly 24 hours',    can({ sentAt: '2026-11-10T00:00:00Z' }), false)
check('chat: own photo at 23h59',               can({ sentAt: '2026-11-10T00:01:00Z' }), true)
check('voice: own after 24 hours',              can({ ...old, source: 'voice', fileKind: null }), false)
check('chat: own photo, no sent time',          can({ sentAt: null }), false)
check('chat: after 24h, as scheduler',          can({ ...old, byId: 'u2', role: 'scheduler' }), true)
check('chat: after 24h, own, as scheduler',     can({ ...old, role: 'scheduler' }), true)
check('chat: after 24h, as admin',              can({ ...old, byId: 'u2', role: 'scheduler', isAdmin: true }), true)
check('folder: uploader after 24h (Files rules)', can({ ...old, source: 'files', fileKind: 'attachment' }), true)

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

// ── The page's own gates, shared with the server (pageFileGates) ──────────
const job = (status: string) => ({ status, created_by: 'c1', sales_poc_id: 's1', coordinatorIds: ['k1'] })
check('ongoing, sales non-sharer → files locked', pageFileGates({ role: 'sales', isAdmin: false, viewerId: 'x', job: job('awaiting_date') }).filesLocked, true)
check('ongoing, sales PIC → not locked',         pageFileGates({ role: 'sales', isAdmin: false, viewerId: 's1', job: job('awaiting_date') }).filesLocked, false)
check('ongoing, any designer → not locked',      pageFileGates({ role: 'designer', isAdmin: false, viewerId: 'x', job: job('awaiting_date') }).filesLocked, false)
check('scheduled, sales non-sharer → not locked', pageFileGates({ role: 'sales', isAdmin: false, viewerId: 'x', job: job('scheduled') }).filesLocked, false)
check('brief editable on scheduled job',        pageFileGates({ role: 'sales', isAdmin: false, viewerId: 's1', job: job('scheduled') }).designBriefEditable, true)
check('brief locked on a draft',                pageFileGates({ role: 'sales', isAdmin: false, viewerId: 's1', job: job('pending') }).designBriefEditable, false)
check('brief locked when completed',            pageFileGates({ role: 'sales', isAdmin: false, viewerId: 's1', job: job('completed') }).designBriefEditable, false)
check('brief locked for hr',                    pageFileGates({ role: 'hr', isAdmin: false, viewerId: 'h', job: job('scheduled') }).designBriefEditable, false)

// ── A batch never deletes the last completion photo (final review C1) ───────
const c = (key: string, kind = 'completion', allowed = true) => ({ key, fileKind: kind, allowed })
check('completed job: 3 of 3 completion ticked → 2 go', [...everyoneBatch([c('a'), c('b'), c('c')], 3, true)], ['a', 'b'])
check('completed job: 1 of 1 → none',                [...everyoneBatch([c('a')], 1, true)], [])
check('completed job: 2 of 4 → both go',              [...everyoneBatch([c('a'), c('b')], 4, true)], ['a', 'b'])
check('open job: all 3 go',                          [...everyoneBatch([c('a'), c('b'), c('c')], 3, false)], ['a', 'b', 'c'])
check('other kinds untouched, not-allowed left out',  [...everyoneBatch([c('x', 'attachment'), c('a'), c('n', 'attachment', false)], 1, true)], ['x'])

// ── Voice keys must live in THIS job's voice folder (final review I9) ────────
check('own job folder',          voiceKeyBelongsToJob('jobs/2026-11-11_owl_ab12cd34/voice/x.webm', '2026-11-11_owl_ab12cd34', 'j1'), true)
check('old job (id folder)',      voiceKeyBelongsToJob('jobs/j1/voice/x.webm', null, 'j1'), true)
check('another job',             voiceKeyBelongsToJob('jobs/other/voice/x.webm', '2026-11-11_owl_ab12cd34', 'j1'), false)
check('not the voice folder',    voiceKeyBelongsToJob('jobs/j1/completion/x.jpg', null, 'j1'), false)
check('no climbing out',         voiceKeyBelongsToJob('jobs/j1/voice/../completion/x.jpg', null, 'j1'), false)
check('bug screenshot',          voiceKeyBelongsToJob('bugs/x.png', null, 'j1'), false)

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nAll gallery-delete checks passed')
