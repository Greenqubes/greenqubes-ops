/**
 * Standalone test for the job bin's rules (no test framework).
 * Run: npx tsx src/lib/utils/bin-rules.test.ts
 * Exits 1 on any failure.
 */
import {
  hasBin, parseRetention, emptiesOn, isExpired, countExpiringUnder, sgtDate,
  canSeeBinEntry, canRestoreBinEntry, canDeleteForever, DEFAULT_RETENTION,
  type BinAccess,
} from './bin-rules'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`); failures++ }
}

const NIC = 'u-nic', COORD = 'u-coord', WQ = 'u-wq', SALES2 = 'u-s2', ADMIN = 'u-admin'
const sales = { id: NIC, role: 'sales' }, sales2 = { id: SALES2, role: 'sales' }
const coord = { id: COORD, role: 'coordinator' }, sched = { id: WQ, role: 'scheduler' }
const admin = { id: ADMIN, role: 'admin' }

// A shared draft: coordinator made it for Nic, coordinator deleted it.
const draft: BinAccess = { statusAtDelete: 'pending', deletedBy: COORD, sharerIds: [COORD, NIC] }
// A scheduled job the scheduler deleted.
const booked: BinAccess = { statusAtDelete: 'scheduled', deletedBy: WQ, sharerIds: [NIC] }

console.log('who has a bin:')
for (const r of ['sales', 'coordinator', 'scheduler', 'admin']) check(`${r} has a bin`, hasBin(r), true)
for (const r of ['installer', 'designer', 'production', 'hr']) check(`${r} has no bin`, hasBin(r), false)

console.log('deleted drafts stay private:')
check('the sales PIC sees the draft', canSeeBinEntry(sales, draft), true)
check('the coordinator who shared it sees it', canSeeBinEntry(coord, draft), true)
check('another sales person does NOT see it', canSeeBinEntry(sales2, draft), false)
// Nic: "scheduler shouldnt even see any sales job ahead" — the bin is no back door.
check('a scheduler who does not share it does NOT see it', canSeeBinEntry(sched, draft), false)
check('admin sees it', canSeeBinEntry(admin, draft), true)
check('both sharers can restore it (Nic: "both should have rights")', [canRestoreBinEntry(sales, draft), canRestoreBinEntry(coord, draft)], [true, true])
check('the deleter can restore even if no longer a sharer', canRestoreBinEntry({ id: 'u-x', role: 'sales' }, { ...draft, deletedBy: 'u-x' }), true)

console.log('deleted scheduled jobs:')
check('every bin role sees them', [sales, sales2, coord, sched, admin].map(v => canSeeBinEntry(v, booked)), [true, true, true, true, true])
check('a scheduler restores', canRestoreBinEntry(sched, booked), true)
check('admin restores', canRestoreBinEntry(admin, booked), true)
check('the deleter restores', canRestoreBinEntry({ id: WQ, role: 'scheduler' }, booked), true)
check('sales who did not delete it cannot restore', canRestoreBinEntry(sales, booked), false)
check('a coordinator who did not delete it cannot restore', canRestoreBinEntry(coord, booked), false)
check('an installer sees nothing', canSeeBinEntry({ id: 'i', role: 'installer' }, booked), false)

console.log('delete forever:')
check('admin only', [admin, sched, sales, coord].map(canDeleteForever), [true, false, false, false])

console.log('retention:')
check('default is 3 months', DEFAULT_RETENTION, '3m')
check('an unknown value falls back to the default', parseRetention('5y'), '3m')
check('a known value is kept', parseRetention('1y'), '1y')
// 2026-09-28 10:00 SGT == 02:00 UTC
const deleted = '2026-09-28T02:00:00.000Z'
check('deleted 28 Sep, 3 months → restorable until 28 Dec', emptiesOn(deleted, '3m'), '2026-12-28')
check('1 month', emptiesOn(deleted, '1m'), '2026-10-28')
check('2 years', emptiesOn(deleted, '2y'), '2028-09-28')
check('31 Jan + 1 month clamps to 28 Feb', emptiesOn('2027-01-31T02:00:00.000Z', '1m'), '2027-02-28')
// The date is Singapore's: 23:30 UTC on the 27th is already the 28th in SGT.
check('SGT date, not UTC', sgtDate('2026-09-27T23:30:00.000Z'), '2026-09-28')
check('not expired on the last day', isExpired(deleted, '1m', '2026-10-28T15:00:00.000Z'), false)
check('expired the day after', isExpired(deleted, '1m', '2026-10-28T16:30:00.000Z'), true)
check('shortening to 1 month would empty the older one now', countExpiringUnder([deleted, '2026-11-20T02:00:00.000Z'], '1m', '2026-12-01T02:00:00.000Z'), 1)

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nall bin-rules checks passed')
