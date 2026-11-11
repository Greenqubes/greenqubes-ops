/**
 * Standalone test for the Jobs tab bulk move-back rules (no test framework).
 * Run: npx tsx src/lib/utils/bulk-move.test.ts
 * Exits 1 on any failure.
 */
import { bulkFailReason, splitBulk, bulkActionsFor, batchBellText, parseBulkBody, BULK_MAX, BULK_REASON_KEY } from './bulk-move'
import { en } from '../i18n/en'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`); failures++ }
}

// ── Why a job could not move ────────────────────────────────────────────────
check('designers block → designer_on_job', bulkFailReason(409, 'designers_assigned'), 'designer_on_job')
check('403 not_permitted → not_yours',      bulkFailReason(403, 'not_permitted'), 'not_yours')
check('stale seen → changed',               bulkFailReason(409, 'state_changed'), 'changed')
check('invalid_move → changed',             bulkFailReason(409, 'invalid_move'), 'changed')
check('not_ongoing → changed',              bulkFailReason(409, 'not_ongoing'), 'changed')
check('404 → changed',                      bulkFailReason(404, 'Not found'), 'changed')
check('network (status 0) → no_connection', bulkFailReason(0, undefined), 'no_connection')
check('500 → other',                        bulkFailReason(500, 'boom'), 'other')

// ── Splitting a batch's results ─────────────────────────────────────────────
check('split keeps order', splitBulk([
  { id: 'a', ok: true }, { id: 'b', ok: false, reason: 'changed' }, { id: 'c', ok: true },
]), { moved: ['a', 'c'], failed: [{ id: 'b', reason: 'changed' }] })
check('split: failure without reason → other', splitBulk([{ id: 'x', ok: false }]),
  { moved: [], failed: [{ id: 'x', reason: 'other' }] })

// ── Which bulk buttons a list offers ────────────────────────────────────────
check('arrange: sales → toOngoing',              bulkActionsFor('arrange', 'sales', false), { toOngoing: true, toDraft: false })
check('arrange: coordinator → toOngoing',        bulkActionsFor('arrange', 'coordinator', false), { toOngoing: true, toDraft: false })
check('arrange: scheduler → nothing',            bulkActionsFor('arrange', 'scheduler', false), { toOngoing: false, toDraft: false })
check('arrange: admin (reads scheduler) → toOngoing', bulkActionsFor('arrange', 'scheduler', true), { toOngoing: true, toDraft: false })
check('ongoing: sales → toDraft',                bulkActionsFor('ongoing', 'sales', false), { toOngoing: false, toDraft: true })
check('ongoing: scheduler → toDraft',            bulkActionsFor('ongoing', 'scheduler', false), { toOngoing: false, toDraft: true })
check('ongoing: designer → nothing',             bulkActionsFor('ongoing', 'designer', false), { toOngoing: false, toDraft: false })
check('drafts: nothing',                         bulkActionsFor('drafts', 'sales', false), { toOngoing: false, toDraft: false })

// ── The one bell card a batch sends ─────────────────────────────────────────
check('bell for one = single pull back', batchBellText(['Owl Optics - Visual Refresh'], 'Nicholas'),
  { title: 'Back to Ongoing: Owl Optics - Visual Refresh', body: 'Not ready yet — Nicholas' })
check('bell for many', batchBellText(['Deliver Oakley - Eyechamp NEX', 'B', 'C'], 'Nicholas'),
  { title: 'Back to Ongoing: 3 jobs', body: 'Deliver Oakley - Eyechamp NEX and 2 more · Not ready yet — Nicholas' })

// ── The bulk route's body ───────────────────────────────────────────────────
check('body ok', parseBulkBody({ jobs: [{ id: 'j1', seen: { state: 'needs_date', readyAt: 'r', offerAt: null } }] }),
  [{ id: 'j1', seen: { state: 'needs_date', readyAt: 'r', offerAt: null } }])
check('body dedupes ids (first wins)', parseBulkBody({ jobs: [{ id: 'j1', seen: 1 }, { id: 'j1', seen: 2 }] }), [{ id: 'j1', seen: 1 }])
check('body missing seen kept as undefined', parseBulkBody({ jobs: [{ id: 'j1' }] }), [{ id: 'j1' }])
check('body empty → null',         parseBulkBody({ jobs: [] }), null)
check('body non-string id → null', parseBulkBody({ jobs: [{ id: 5 }] }), null)
check('body not object → null',    parseBulkBody('nope'), null)
check('body over max → null', parseBulkBody({ jobs: Array.from({ length: BULK_MAX + 1 }, (_, i) => ({ id: `j${i}` })) }), null)

// ── Every reason has an English line ────────────────────────────────────────
for (const [reason, key] of Object.entries(BULK_REASON_KEY)) {
  check(`reason ${reason} has en text`, typeof (en as Record<string, string>)[key] === 'string' && (en as Record<string, string>)[key].length > 0, true)
}

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nAll bulk-move checks passed')
