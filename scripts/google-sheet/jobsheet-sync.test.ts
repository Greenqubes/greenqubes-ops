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
import { SHEET_COLUMNS } from '../../src/lib/utils/jobsheet-rows'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`); failures++ }
}

type Row = { type: string; cells: string[]; punctuality?: string }
const ctx = vm.createContext({})
// Loading must not touch SpreadsheetApp & co — they don't exist here.
vm.runInContext(readFileSync(join(__dirname, 'jobsheet-sync.gs'), 'utf8'), ctx)
const g = vm.runInContext(
  '({ weekOfTab, tabNameFor, isSpaced, isRefreshable, weeksOfTabs, safeCell, needsTab, insertAt, headerTitle, headerCells, paintRows, DEFAULT_COLUMNS, COLUMN_WIDTHS })',
  ctx,
) as {
  weekOfTab: (name: string, todayISO: string) => string | null
  tabNameFor: (monday: string, spaced: boolean) => string
  isSpaced: (name: string) => boolean
  isRefreshable: (monday: string, todayISO: string) => boolean
  weeksOfTabs: (names: string[], todayISO: string) => Record<string, string[]>
  safeCell: (v: string) => string
  needsTab: (monday: string, todayISO: string, rows: Row[]) => boolean
  insertAt: (existing: Array<{ monday: string; index: number }>, monday: string, total: number) => number
  headerTitle: (monday: string, updated: string) => string
  headerCells: (columns: unknown) => string[]
  paintRows: (rows: Row[]) => { values: string[][]; backgrounds: Array<Array<string | null>>; fonts: string[][]; weights: string[][] }
  DEFAULT_COLUMNS: string[]
  COLUMN_WIDTHS: number[]
}

// ── Reading tab names (they carry no year) ───────────────────────────────────
const T = '2026-11-11'
check('normal tab',                   g.weekOfTab('9/11 to15/11', T), '2026-11-09')
check('spaced tab',                   g.weekOfTab('14/9 to 20/9', T), '2026-09-14')
check('Sunday-start typo → its week', g.weekOfTab('22/11 to29/11', T), '2026-11-23')
check('pre-made future tab',          g.weekOfTab('7/12 to13/12', T), '2026-12-07')
check('year turn, in Dec',            g.weekOfTab('28/12 to3/1', '2026-12-30'), '2026-12-28')
check('year turn, in Jan',            g.weekOfTab('28/12 to3/1', '2027-01-02'), '2026-12-28')
// Old tabs must stay in the past, never read as next year's — the script now
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

// ── Which weeks get a NEW tab (Nic, 2026-11-12) ─────────────────────────────
const job: Row = { type: 'job', cells: ['', '', '', 'Ms Lim'], punctuality: 'strict' }
const day: Row = { type: 'day', cells: ['11-Nov', 'Tue'] }
check('this week always gets a tab',          g.needsTab('2026-11-09', T, [day]), true)
check('next week always gets a tab',          g.needsTab('2026-11-16', T, []), true)
check('later week without jobs → no tab',     g.needsTab('2026-11-23', T, [day]), false)
check('later week with a job → a tab',        g.needsTab('2026-12-07', T, [day, job]), true)

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

// ── The header the app writes at the top of every tab ───────────────────────
check('title row', g.headerTitle('2026-11-09', '12 Nov 9:00 PM'),
  'Greenqubes jobs · 9/11 to 15/11 · updated 12 Nov 9:00 PM · filled by the app every hour, view only')
check('column names come from the app', g.headerCells([...SHEET_COLUMNS]), [...SHEET_COLUMNS])
check('built-in names match the app', [...g.DEFAULT_COLUMNS], [...SHEET_COLUMNS])
check('no names sent → built-in names', g.headerCells(undefined), [...SHEET_COLUMNS])
check('bad names sent → built-in names', g.headerCells(['Date', 5]), [...SHEET_COLUMNS])
check('one width per column', g.COLUMN_WIDTHS.length, 12)

// ── Rows: colours and text ──────────────────────────────────────────────────
const p = g.paintRows([
  { type: 'gap', cells: [] },
  day,
  { type: 'leave', cells: ['', '', '', '', '', '', 'On leave: CK'] },
  job,
  { type: 'job', cells: ['', '', '', '+65 9123 4567'], punctuality: 'flexible' },
])
check('every row is 12 cells', p.values.map(v => v.length), [12, 12, 12, 12, 12])
check('gap row is grey', p.backgrounds[0][0], '#cfcfcf')
check('day row is bold', p.weights[1][0], 'bold')
check('leave row is red', p.fonts[2][6], '#cc0000')
check('Strict → red punctuality cell', [p.backgrounds[3][4], p.fonts[3][4]], ['#f4cccc', '#990000'])
check('Flexible → blue punctuality cell', [p.backgrounds[4][4], p.fonts[4][4]], ['#cfe2f3', '#0b5394'])
check('phone number kept as text', p.values[4][3], "'+65 9123 4567")
check('plain cells have no colour', p.backgrounds[3][0], null)

// ── Cells that Google would turn into formulas ─────────────────────────────
check('+65 number kept as text', g.safeCell('+65 9123 4567'), "'+65 9123 4567")
check('= kept as text',          g.safeCell('=SUM(1)'), "'=SUM(1)")
check('- kept as text',          g.safeCell('-'), "'-")
check('@ kept as text',          g.safeCell('@home'), "'@home")
check('plain text untouched',    g.safeCell('Li Min'), 'Li Min')
check('empty untouched',         g.safeCell(''), '')

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nAll jobsheet-sync checks passed')
