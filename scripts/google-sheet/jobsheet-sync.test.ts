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

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`); failures++ }
}

const ctx = vm.createContext({})
// Loading must not touch SpreadsheetApp & co — they don't exist here.
vm.runInContext(readFileSync(join(__dirname, 'jobsheet-sync.gs'), 'utf8'), ctx)
const g = vm.runInContext('({ weekOfTab, tabNameFor, isSpaced, findMarker, barText, isRefreshable, weeksOfTabs, safeCell, markerRowFor })', ctx) as {
  weekOfTab: (name: string, todayISO: string) => string | null
  tabNameFor: (monday: string, spaced: boolean) => string
  isSpaced: (name: string) => boolean
  findMarker: (colA: string[]) => number
  barText: (updated: string) => string
  isRefreshable: (monday: string, todayISO: string) => boolean
  weeksOfTabs: (names: string[], todayISO: string) => Record<string, string[]>
  safeCell: (v: string) => string
  markerRowFor: (lastUsedRow: number) => number
}

// ── Reading tab names (they carry no year) ───────────────────────────────────
const T = '2026-11-11'
check('normal tab',                   g.weekOfTab('9/11 to15/11', T), '2026-11-09')
check('spaced tab',                   g.weekOfTab('14/9 to 20/9', T), '2026-09-14')
check('Sunday-start typo → its week', g.weekOfTab('22/11 to29/11', T), '2026-11-23')
check('pre-made future tab',          g.weekOfTab('7/12 to13/12', T), '2026-12-07')
check('year turn, in Dec',            g.weekOfTab('28/12 to3/1', '2026-12-30'), '2026-12-28')
check('year turn, in Jan',            g.weekOfTab('28/12 to3/1', '2027-01-02'), '2026-12-28')
// Final review #1: old tabs must stay in the past, never read as next year's.
check('Jan 2026 tab stays in Jan 2026', g.weekOfTab('5/1 to11/1', T), '2026-01-05')
check('May 2026 tab stays in May 2026', g.weekOfTab('4/5 to10/5', T), '2026-05-04')
check('last year\'s same week',         g.weekOfTab('10/11 to16/11', T), '2025-11-10')
check('last year\'s this-week twin',    g.weekOfTab('3/11 to9/11', T), '2025-11-03')
check('not a week tab',               g.weekOfTab('Sheet1', T), null)
check('From the app tab ignored',     g.weekOfTab('From the app', T), null)
check('impossible date ignored',      g.weekOfTab('1/1 to31/2', T), null)
check('not a week long',              g.weekOfTab('9/11 to30/11', T), null)

// ── Which weeks get refreshed ───────────────────────────────────────────────
check('this week',          g.isRefreshable('2026-11-09', T), true)
check('next week',          g.isRefreshable('2026-11-16', T), true)
check('past week',          g.isRefreshable('2026-11-02', T), false)
check('10 weeks ahead',     g.isRefreshable('2027-01-18', T), true)
check('11 weeks ahead',     g.isRefreshable('2027-01-25', T), false)
check('two tabs, same week → both listed', g.weeksOfTabs(['9/11 to15/11', '9/11 to 15/11', '16/11 to22/11', 'Sheet1'], T),
  { '2026-11-09': ['9/11 to15/11', '9/11 to 15/11'], '2026-11-16': ['16/11 to22/11'] })

// ── Naming new tabs ─────────────────────────────────────────────────────────
check('name unspaced',       g.tabNameFor('2026-11-30', false), '30/11 to6/12')
check('name spaced',         g.tabNameFor('2026-11-30', true), '30/11 to 6/12')
check('new name reads back', g.weekOfTab(g.tabNameFor('2026-12-28', false), '2026-12-20'), '2026-12-28')
check('spaced?',             [g.isSpaced('14/9 to 20/9'), g.isSpaced('9/11 to15/11')], [true, false])

// ── The yellow bar ──────────────────────────────────────────────────────────
const bar = g.barText('11 Nov 2:05 PM')
check('bar text',                bar, "FROM THE APP · updated 11 Nov 2:05 PM · don't type below this line")
check('marker none',             g.findMarker(['Date', '', 'x']), -1)
check('marker found',            g.findMarker(['Date', 'y', bar, '']), 2)
check('old-style bar still found', g.findMarker(['FROM THE APP · fills itself every hour · don\'t type below this line']), 0)
check('two markers',             g.findMarker([bar, 'a', bar]), -2)
check('typed note mentioning it is NOT a bar', g.findMarker(['see FROM THE APP tab', 'FROM THE APP']), -1)
check('first bar leaves room under typed rows', g.markerRowFor(60), 70)
check('first bar in a new tab sits low enough', g.markerRowFor(2), 45)

// ── Cells that Google would turn into formulas ─────────────────────────────
check('+65 number kept as text', g.safeCell('+65 9123 4567'), "'+65 9123 4567")
check('= kept as text',          g.safeCell('=SUM(1)'), "'=SUM(1)")
check('- kept as text',          g.safeCell('-'), "'-")
check('@ kept as text',          g.safeCell('@home'), "'@home")
check('plain text untouched',    g.safeCell('Li Min'), 'Li Min')
check('empty untouched',         g.safeCell(''), '')

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nAll jobsheet-sync checks passed')
