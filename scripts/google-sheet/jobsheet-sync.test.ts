/**
 * Standalone test for the pure helpers inside the old jobsheet's Apps Script
 * (no test framework). The .gs file is loaded as-is into a bare vm context,
 * so the code tested here is the code Nic pastes into the sheet.
 * Run: npx tsx scripts/google-sheet/jobsheet-sync.test.ts
 * Exits 1 on any failure.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import vm from 'node:vm'
import { buildPaintedWeek, type LayoutJob } from '../../src/lib/utils/jobsheet-layout'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`); failures++ }
}

const ctx = vm.createContext({})
// Loading must not touch SpreadsheetApp & co — they don't exist here.
vm.runInContext(readFileSync(join(__dirname, 'jobsheet-sync.gs'), 'utf8'), ctx)
const g = vm.runInContext(
  '({ weekOfTab, tabNameFor, isSpaced, isRefreshable, weeksOfTabs, safeCell, needsTab, insertAt, usableWeek })',
  ctx,
) as {
  weekOfTab: (name: string, todayISO: string) => string | null
  tabNameFor: (monday: string, spaced: boolean) => string
  isSpaced: (name: string) => boolean
  isRefreshable: (monday: string, todayISO: string) => boolean
  weeksOfTabs: (names: string[], todayISO: string) => Record<string, string[]>
  safeCell: (v: string) => string
  needsTab: (monday: string, todayISO: string, hasJobs: boolean) => boolean
  insertAt: (existing: Array<{ monday: string; index: number }>, monday: string, total: number) => number
  usableWeek: (data: unknown) => boolean
}

// ── Reading tab names (they carry no year) ───────────────────────────────────
const T = '2026-11-11'
check('normal tab',                   g.weekOfTab('9/11 to15/11', T), '2026-11-09')
check('spaced tab',                   g.weekOfTab('14/9 to 20/9', T), '2026-09-14')
check('Sunday-start typo → its week', g.weekOfTab('22/11 to29/11', T), '2026-11-23')
check('pre-made future tab',          g.weekOfTab('7/12 to13/12', T), '2026-12-07')
check('year turn, in Dec',            g.weekOfTab('28/12 to3/1', '2026-12-30'), '2026-12-28')
check('year turn, in Jan',            g.weekOfTab('28/12 to3/1', '2027-01-02'), '2026-12-28')
// Old tabs must stay in the past, never read as next year's — the script
// WIPES the weeks it refreshes, so this is what keeps the record safe.
check('Jan 2026 tab stays in Jan 2026', g.weekOfTab('5/1 to11/1', T), '2026-01-05')
check('May 2026 tab stays in May 2026', g.weekOfTab('4/5 to10/5', T), '2026-05-04')
check('last year\'s same week',         g.weekOfTab('10/11 to16/11', T), '2025-11-10')
check('last year\'s this-week twin',    g.weekOfTab('3/11 to9/11', T), '2025-11-03')
check('not a week tab',               g.weekOfTab('Sheet1', T), null)
check('Contacts tab ignored',         g.weekOfTab('Contacts', T), null)
check('impossible date ignored',      g.weekOfTab('1/1 to31/2', T), null)
check('not a week long',              g.weekOfTab('9/11 to30/11', T), null)

// ── Which weeks get rewritten ───────────────────────────────────────────────
check('this week',          g.isRefreshable('2026-11-09', T), true)
check('next week',          g.isRefreshable('2026-11-16', T), true)
check('past week',          g.isRefreshable('2026-11-02', T), false)
check('10 weeks ahead',     g.isRefreshable('2027-01-18', T), true)
check('11 weeks ahead',     g.isRefreshable('2027-01-25', T), false)
check('two tabs, same week → both listed', g.weeksOfTabs(['9/11 to15/11', '9/11 to 15/11', '16/11 to22/11', 'Sheet1'], T),
  { '2026-11-09': ['9/11 to15/11', '9/11 to 15/11'], '2026-11-16': ['16/11 to22/11'] })

// ── Which weeks get a NEW tab (Nic, 2026-11-12) — the app says hasJobs ──────
check('this week always gets a tab',          g.needsTab('2026-11-09', T, false), true)
check('next week always gets a tab',          g.needsTab('2026-11-16', T, false), true)
check('later week without jobs → no tab',     g.needsTab('2026-11-30', T, false), false)
check('later week with a job → a tab',        g.needsTab('2026-11-30', T, true), true)

// ── Where a new tab goes: in date order among the week tabs ─────────────────
const tabs = [{ monday: '2026-11-02', index: 3 }, { monday: '2026-11-09', index: 4 }]
check('after the latest earlier week',  g.insertAt(tabs, '2026-11-16', 6), 4)
check('before the earliest later week', g.insertAt([{ monday: '2026-11-16', index: 2 }], '2026-11-09', 5), 1)
check('no week tabs → at the end',      g.insertAt([], '2026-11-09', 3), 3)

// ── Naming new tabs ─────────────────────────────────────────────────────────
check('name unspaced',       g.tabNameFor('2026-11-30', false), '30/11 to6/12')
check('name spaced',         g.tabNameFor('2026-11-30', true), '30/11 to 6/12')
check('new name reads back', g.weekOfTab(g.tabNameFor('2026-12-28', false), '2026-12-20'), '2026-12-28')
check('spaced?',             [g.isSpaced('14/9 to 20/9'), g.isSpaced('9/11 to15/11')], [true, false])

// ── The app's painted week: the script takes it only when it is whole ───────
// (scheduler's layout, Nic 2026-11-16). A refused answer leaves the tab as it was.
const job: LayoutJob = {
  id: 'j', date: '2026-11-11', date_end: null, time_start: '10:00:00', time_end: null, punctuality: 'strict',
  project_title: 'OWL', client: 'Luxottica', description: null, location: 'KAP MALL', client_poc_name: 'Li Min',
  client_poc_phone: '+65 9123 4567', salesName: 'Nicholas',
  crew: { drivers: [{ name: 'CK', you: false }], support: [], externals: [] },
  production_ready: true, do_issued: false,
}
const painted = buildPaintedWeek({
  monday: '2026-11-09', now: new Date('2026-11-11T07:00:00Z'), jobs: [job],
  leaves: [{ name: 'Halim', date_start: '2026-11-11', date_end: '2026-11-11', start_portion: 'full', end_portion: 'full', leave_type: 'medical' }],
  trips: [], holidays: [], drivers: ['CK', 'Rintu', 'Xiao Yi'],
})
const copy = () => JSON.parse(JSON.stringify(painted))
check('the app\'s answer is usable', g.usableWeek(copy()), true)
check('nothing → refused', g.usableWeek(null), false)
check('the old answer → refused', g.usableWeek({ week: '2026-11-09', columns: ['Date'], rows: [{ type: 'job', cells: ['a'] }] }), false)
check('another layout version → refused', g.usableWeek({ ...copy(), layout: 1 }), false)
const short = copy(); short.rows[3].bg.pop()
check('a row one fill short → refused', g.usableWeek(short), false)
const heavy = copy(); heavy.rows[3].weights[0] = 'heavy'
check('an unknown weight → refused', g.usableWeek(heavy), false)
const pinned = copy(); pinned.frozen = pinned.rows.length + 1
check('more rows pinned than sent → refused', g.usableWeek(pinned), false)
check('no rows → refused', g.usableWeek({ ...copy(), rows: [] }), false)
const numeric = copy(); numeric.rows[3].values[3] = 42
check('a value that is not text → refused', g.usableWeek(numeric), false)
// Things Google would reject AFTER the tab is wiped (final review, 2026-11-16).
const named = copy(); named.rows[3].bg[0] = 'red'
check('a fill that is not #RRGGBB → refused', g.usableWeek(named), false)
const ink = copy(); ink.rows[3].fg[0] = '#000'
check('a text colour that is not #RRGGBB → refused', g.usableWeek(ink), false)
const half = copy(); half.widths[0] = 70.5
check('a fractional width → refused', g.usableWeek(half), false)
const allPinned = copy(); allPinned.frozen = allPinned.rows.length
check('every row pinned → refused', g.usableWeek(allPinned), false)
const huge = copy(); huge.rows[3].values[6] = 'x'.repeat(50001)
check('a cell over 50,000 characters → refused', g.usableWeek(huge), false)
// Font and size per cell (the year in L2, Nic 2026-11-17).
check('the year cell comes through', [painted.rows[1].fonts[11], painted.rows[1].sizes[11]], ['Arial', 20])
const noSizes = copy(); delete noSizes.rows[3].sizes
check('a row without sizes → refused', g.usableWeek(noSizes), false)
const tiny = copy(); tiny.rows[3].sizes[0] = 0
check('a size of 0 → refused', g.usableWeek(tiny), false)
const halfPt = copy(); halfPt.rows[3].sizes[0] = 10.5
check('a fractional size → refused', g.usableWeek(halfPt), false)
const sizeText = copy(); sizeText.rows[3].sizes[0] = '10'
check('a size sent as text → refused', g.usableWeek(sizeText), false)
const noFonts = copy(); delete noFonts.rows[3].fonts
check('a row without fonts → refused', g.usableWeek(noFonts), false)
const oddFont = copy(); oddFont.rows[3].fonts[0] = 'Arial;bold'
check('a font name with odd characters → refused', g.usableWeek(oddFont), false)
const numFont = copy(); numFont.rows[3].fonts[0] = 42
check('a font that is not text → refused', g.usableWeek(numFont), false)

// ── Cells that Google would turn into formulas ─────────────────────────────
check('+65 number kept as text', g.safeCell('+65 9123 4567'), "'+65 9123 4567")
check('= kept as text',          g.safeCell('=SUM(1)'), "'=SUM(1)")
check('- kept as text',          g.safeCell('-'), "'-")
check('@ kept as text',          g.safeCell('@home'), "'@home")
check('plain text untouched',    g.safeCell('Li Min'), 'Li Min')
check('empty untouched',         g.safeCell(''), '')

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nAll jobsheet-sync checks passed')
