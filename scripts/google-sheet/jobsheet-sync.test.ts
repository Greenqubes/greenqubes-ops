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
const g = vm.runInContext('({ weekOfTab, tabNameFor, isSpaced, findMarker, MARKER_TEXT })', ctx) as {
  weekOfTab: (name: string, todayISO: string) => string | null
  tabNameFor: (monday: string, spaced: boolean) => string
  isSpaced: (name: string) => boolean
  findMarker: (colA: string[]) => number
  MARKER_TEXT: string
}

check('normal tab',                   g.weekOfTab('9/11 to15/11', '2026-11-11'), '2026-11-09')
check('spaced tab',                   g.weekOfTab('14/9 to 20/9', '2026-11-11'), '2026-09-14')
check('Sunday-start typo → end week', g.weekOfTab('22/11 to29/11', '2026-11-11'), '2026-11-23')
check('year turn, in Dec',            g.weekOfTab('28/12 to3/1', '2026-12-30'), '2026-12-28')
check('year turn, in Jan',            g.weekOfTab('28/12 to3/1', '2027-01-02'), '2026-12-28')
check('not a week tab',               g.weekOfTab('Sheet1', '2026-11-11'), null)
check('From the app tab ignored',     g.weekOfTab('From the app', '2026-11-11'), null)
check('impossible date ignored',      g.weekOfTab('1/1 to31/2', '2026-11-11'), null)
check('name unspaced',                g.tabNameFor('2026-11-30', false), '30/11 to6/12')
check('name spaced',                  g.tabNameFor('2026-11-30', true), '30/11 to 6/12')
check('new name reads back',          g.weekOfTab(g.tabNameFor('2026-12-28', false), '2026-12-20'), '2026-12-28')
check('spaced?',                      [g.isSpaced('14/9 to 20/9'), g.isSpaced('9/11 to15/11')], [true, false])
check('marker none',                  g.findMarker(['Date', '', 'x']), -1)
check('marker found',                 g.findMarker(['Date', 'y', g.MARKER_TEXT, '']), 2)
check('two markers',                  g.findMarker([g.MARKER_TEXT, 'a', g.MARKER_TEXT]), -2)
check('marker text',                  g.MARKER_TEXT, "FROM THE APP · fills itself every hour · don't type below this line")

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nAll jobsheet-sync checks passed')
