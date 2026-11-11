/**
 * Standalone test for the old-jobsheet week rows (no test framework).
 * Run: npx tsx src/lib/utils/jobsheet-rows.test.ts
 * Exits 1 on any failure. Values are from the real 2026-11-11 data pull
 * (phone numbers made up).
 */
import { SHEET_COLUMNS, sheetTime, crewLine, parseWeek, buildWeekRows, type SheetJob } from './jobsheet-rows'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`); failures++ }
}

const owl: SheetJob = { id: 'owl', date: '2026-11-11', date_end: '2026-11-11', time_start: '11:00:00', time_end: '18:00:00',
  punctuality: 'flexible', project_title: 'OWL OPTICS PTE LTD - VISUAL REFRESH FW2026', client: 'Luxottica',
  description: 'VISUAL  REFRESH\n(CONFIRMED)', location: '9 KING ALBERT PARK #01-51/52 KAP MALL', client_poc_name: 'Li Min',
  client_poc_phone: '9123 4567', salesName: 'Nicholas',
  crew: { drivers: [{ name: 'CK', you: false }], support: [{ name: 'Razu', you: false }], externals: [] } }
const prism: SheetJob = { ...owl, id: 'prism', date: '2026-11-12', date_end: null, time_start: '16:00:00', time_end: null, punctuality: 'strict',
  project_title: 'PRISM+ Tech Show Sticker Installation', description: null, client_poc_phone: null,
  crew: { drivers: [{ name: 'Xiao Yi', you: false }], support: [{ name: 'Zhang Xing', you: false }, { name: 'Hai Long', you: false }], externals: [{ name: 'Ah Seng Signs', you: false }] } }
const tree: SheetJob = { ...owl, id: 'tree', date: '2026-11-12', date_end: null, time_start: null, time_end: null, project_title: 'Christmas Tree installation' }
const giga: SheetJob = { ...owl, id: 'giga', date: '2026-11-15', date_end: '2026-11-16', time_start: '22:00:00', time_end: '03:00:00', project_title: 'Giga Teardown' }
const hsbc: SheetJob = { ...owl, id: 'hsbc', date: '2026-11-12', date_end: null, time_start: '23:45:00', time_end: '05:00:00', project_title: null, client: 'sam bilt' }
const leaves = [{ name: 'Cara', date_start: '2026-11-07', date_end: '2026-11-16' }, { name: 'Vinz', date_start: '2026-11-09', date_end: '2026-11-11' }]

check('columns', SHEET_COLUMNS.length, 12)
check('time range', sheetTime('11:00:00', '18:00:00'), '11:00 AM - 6:00 PM')
check('time start only', sheetTime('16:00:00', null), '4:00 PM')
check('time past midnight', sheetTime('23:45:00', '05:00:00'), '11:45 PM - 5:00 AM')
check('time midnight', sheetTime('00:00', null), '12:00 AM')
check('no time', sheetTime(null, null), '')
check('crew order drivers+support+externals', crewLine(prism.crew), 'Xiao Yi+Zhang Xing+Hai Long+Ah Seng Signs')
check('week ok (Monday)', parseWeek('2026-11-09'), '2026-11-09')
check('week not Monday', parseWeek('2026-11-10'), null)
check('week not a date', parseWeek('2026-02-30'), null)
check('week junk', parseWeek(['2026-11-09']), null)

const rows = buildWeekRows('2026-11-09', [hsbc, giga, prism, owl, tree], leaves)
check('every row has 12 cells', rows.every(r => r.cells.length === 12), true)
check('7 day rows', rows.filter(r => r.type === 'day').map(r => r.cells[0] + ' ' + r.cells[1]),
  ['9-Nov Mon', '10-Nov Tue', '11-Nov Wed', '12-Nov Thu', '13-Nov Fri', '14-Nov Sat', '15-Nov Sun'])
check('Mon: gap, day, leave', rows.slice(0, 3).map(r => r.type), ['gap', 'day', 'leave'])
check('Mon leave line', rows[2].cells[6], 'On leave: Cara, Vinz')
const wed = rows.findIndex(r => r.type === 'day' && r.cells[0] === '11-Nov')
check('Owl row', rows[wed + 2].cells, ['', '', '', 'Li Min\n9123 4567', 'Flexible', '11:00 AM - 6:00 PM',
  'OWL OPTICS PTE LTD - VISUAL REFRESH FW2026\nVISUAL REFRESH (CONFIRMED)', '9 KING ALBERT PARK #01-51/52 KAP MALL', '', 'Nicholas', 'CK+Razu', ''])
const thu = rows.findIndex(r => r.type === 'day' && r.cells[0] === '12-Nov')
check('Thu order: untimed, 4pm, 11:45pm', rows.slice(thu + 1, thu + 5).map(r => r.type === 'job' ? r.cells[6].split('\n')[0] : r.type),
  ['leave', 'Christmas Tree installation', 'PRISM+ Tech Show Sticker Installation', 'sam bilt'])
check('strict flag', rows[thu + 3].punctuality, 'strict')
check('Giga on Sun 15', rows.some(r => r.type === 'job' && r.cells[6].startsWith('Giga Teardown')), true)
const next = buildWeekRows('2026-11-16', [giga], [])
check('Giga also on Mon 16', next.filter(r => r.type === 'job').length, 1)
check('no leave row when nobody is off', next.some(r => r.type === 'leave'), false)

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nAll jobsheet-rows checks passed')
