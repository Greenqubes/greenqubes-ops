/**
 * Standalone test for the old jobsheet in the scheduler's layout (no test
 * framework). Spec: docs/superpowers/specs/2026-11-16-jobsheet-scheduler-layout-design.md
 * Run: npx tsx src/lib/utils/jobsheet-layout.test.ts
 * Exits 1 on any failure. Names are real crew; phone numbers made up.
 */
import {
  LAYOUT_COLUMNS, sgtStamp, leaveLabel, buildPaintedWeek,
  type LayoutJob, type LayoutLeave, type LayoutInput, type PaintedRow, type PaintedWeek,
} from './jobsheet-layout'
import type { Crew } from './installer-crew'
import type { AwayTrip } from './away-overlap'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`); failures++ }
}

const MON = '2026-12-21', WED = '2026-12-23', THU = '2026-12-24', FRI = '2026-12-25'
const NOW = new Date('2026-12-23T07:00:00Z')            // 3:00 PM in Singapore
const DRIVERS = ['CK', 'Rintu', 'Xiao Yi']
const CK = '#D9D2E9', XY = '#FFF2CC', GREY = '#CCCCCC', RED = '#FF0000'

const people = (names: string[]) => names.map(name => ({ name, you: false }))
const crew = (drivers: string[], support: string[] = [], externals: string[] = []): Crew =>
  ({ drivers: people(drivers), support: people(support), externals: people(externals) })

const base: LayoutJob = {
  id: 'base', date: WED, date_end: null, time_start: '10:00:00', time_end: null, punctuality: 'flexible',
  project_title: 'TITLE', client: 'Luxottica', description: null, location: '9 KING ALBERT PARK #01-51/52 KAP MALL',
  client_poc_name: 'Li Min', client_poc_phone: '9123 4567', salesName: 'Nicholas', crew: crew(['CK']),
  production_ready: true, do_issued: false,
}
const job = (over: Partial<LayoutJob>): LayoutJob => ({ ...base, ...over })

const jobs: LayoutJob[] = [
  // Deliberately out of order: the layout sorts them.
  job({ id: 'none',  project_title: 'NONE',  crew: crew([]) }),
  job({ id: 'ext',   project_title: 'EXT',   crew: crew([], [], ['Fu']) }),
  job({ id: 'stray', project_title: 'STRAY', crew: crew(['Hai Long']) }),
  job({ id: 'ck14',  project_title: 'CK-14', time_start: '14:00:00', time_end: '16:00:00', punctuality: 'strict' }),
  job({ id: 'two',   project_title: 'TWO-DAY', date_end: THU, time_start: '20:00:00', crew: crew(['Xiao Yi']) }),
  job({ id: 'xy',    project_title: 'XY', crew: crew(['Xiao Yi']), production_ready: false, do_issued: true }),
  job({ id: 'ck9',   project_title: 'CK-9', time_start: '09:00:00', crew: crew(['CK'], ['Aroze']) }),
  job({ id: 'cknt',  project_title: 'CK-NOTIME', time_start: null }),
  job({ id: 'mixed', project_title: 'MIXED', time_start: '09:00:00', time_end: '13:00:00', punctuality: 'strict',
        crew: crew(['CK', 'Rintu'], ['Razu']) }),
]

const leave = (name: string, start: string, end: string, sp: LayoutLeave['start_portion'], ep: LayoutLeave['end_portion'], type: string | null): LayoutLeave =>
  ({ name, date_start: start, date_end: end, start_portion: sp, end_portion: ep, leave_type: type })
const leaves: LayoutLeave[] = [
  leave('Vinz',  '2026-12-22', THU, 'full', 'am', 'emergency'),
  leave('Halim', WED, WED, 'full', 'full', 'medical'),
  leave('Razu',  WED, WED, 'pm', 'pm', 'annual'),
  leave('Cara',  THU, THU, 'full', 'full', null),
]

const trip = (id: string, title: string, sd: string, st: string, ed: string, et: string, names: string[]): AwayTrip =>
  ({ id, title, business: null, location: null, start_date: sd, start_time: st, end_date: ed, end_time: et,
     note: 'PRIVATE NOTE', people: names.map(n => ({ id: n, name: n })) })
const trips: AwayTrip[] = [
  trip('t1', 'Forklift course', WED, '09:00', WED, '17:00', ['Firoz', 'Rintu']),
  // Ends at 00:00 on Thursday: covers Wednesday only.
  trip('t2', 'KL supplier visit', WED, '08:00', THU, '00:00', ['CK']),
]

const input: LayoutInput = {
  monday: MON, now: NOW, jobs, leaves, trips,
  holidays: [{ holiday_date: FRI, name: 'Christmas Day' }], drivers: DRIVERS,
}
const week = buildPaintedWeek(input)
const rows = week.rows

/** The rows of one day: after its date row, up to the next grey gap. */
function dayRows(w: PaintedWeek, label: string): PaintedRow[] {
  const at = w.rows.findIndex(r => r.values[0] === label)
  const out: PaintedRow[] = []
  for (let i = at + 1; i < w.rows.length && w.rows[i].bg[0] !== GREY; i++) out.push(w.rows[i])
  return out
}
const desc = (rs: PaintedRow[]) => rs.map(r => r.values[6])
const rowFor = (title: string) => rows.find(r => r.values[6] === title)!
const all = <T>(xs: T[], v: T) => xs.every(x => x === v)
/** Columns A–K, the table itself — column L sits beside it. */
const table = <T>(xs: T[]) => xs.slice(0, 11)

console.log('time stamps and labels:')
check('3:00 PM in Singapore',         sgtStamp(NOW), '23 Dec 3:00 PM')
check('just past midnight, next day', sgtStamp(new Date('2026-12-22T16:30:00Z')), '23 Dec 12:30 AM')
check('noon',                         sgtStamp(new Date('2026-12-23T04:05:00Z')), '23 Dec 12:05 PM')
check('medical → MC',                 leaveLabel('medical'), 'MC')
check('annual → On leave',            leaveLabel('annual'), 'On leave')
check('emergency → On leave',         leaveLabel('emergency'), 'On leave')
check('other → On leave',             leaveLabel('other'), 'On leave')
check('missing type → On leave',      leaveLabel(null), 'On leave')

console.log('the top of the tab:')
check('title row', rows[0].values[0],
  'Greenqubes jobs · 21/12 to 27/12 · updated 23 Dec 3:00 PM · filled by the app every hour, view only')
check('title row dark across',  all(table(rows[0].bg), '#1F3D3B'), true)
check('title text white bold',  [rows[0].fg[0], rows[0].weights[0]], ['#FFFFFF', 'bold'])
check('title row does not wrap', rows[0].wrap, false)
check('column names', table(rows[1].values), [
  'Date', 'Day', 'Production (生产)', 'Company', 'Client Name & Contact', 'Time & Punctuality (时间)',
  'Jobs Description （工作说明）', 'Address', 'DO', 'Sales PIC', 'Driver & Installer'])
check('header grey, bold, centred', [all(table(rows[1].bg), '#B7B7B7'), all(rows[1].weights, 'bold'), all(rows[1].aligns, 'center')], [true, true, true])
check('two rows pinned', week.frozen, 2)
check('widths (K is 245, L is the year)', week.widths, [70, 45, 80, 130, 150, 130, 320, 260, 50, 100, 245, 90])
check('widths follow the columns', LAYOUT_COLUMNS.map(c => c.width), table(week.widths))
check('every row has 12 of everything',
  rows.every(r => [r.values, r.bg, r.fg, r.weights, r.aligns, r.sizes, r.fonts].every(a => a.length === 12)), true)
check('layout version', week.layout, 2)

console.log('the year in L2 (Nic, 2026-11-17):')
check('L2 is the year',                 rows[1].values[11], '2026')
check('L2 Arial 20 bold, no fill',      [rows[1].fonts[11], rows[1].sizes[11], rows[1].weights[11], rows[1].bg[11]], ['Arial', 20, 'bold', null])
check('column L empty and unfilled on every other row',
  rows.every((r, i) => i === 1 || (r.values[11] === '' && r.bg[11] === null)), true)
check("everything else: size 10, the sheet's own font",
  rows.every((r, i) => r.sizes.every((v, c) => (i === 1 && c === 11) || v === 10)
    && r.fonts.every((v, c) => (i === 1 && c === 11) || v === null)), true)
check('a week across New Year: the year it starts in',
  buildPaintedWeek({ ...input, monday: '2026-12-28' }).rows[1].values[11], '2026')
check('the first week of a new year',
  buildPaintedWeek({ ...input, monday: '2027-01-04' }).rows[1].values[11], '2027')

console.log('the order of a day:')
check('Wednesday, top to bottom', desc(dayRows(week, '23-Dec')), [
  'MIXED', '',
  'CK-NOTIME', 'CK-9', 'CK-14', '',
  'XY', 'TWO-DAY', '',
  'STRAY', '',
  'EXT', '',
  'NONE', '',
  'MC: Halim',
  'On leave: Razu (PM), Vinz',
  'On course: CK · KL supplier visit',
  'On course: Firoz, Rintu · Forklift course',
])
const wedAt = rows.findIndex(r => r.values[0] === '23-Dec')
check('date row',                  [rows[wedAt].values[0], rows[wedAt].values[1], rows[wedAt].weights[0]], ['23-Dec', 'Wed', 'bold'])
check('grey gap before each day',  all(table(rows[wedAt - 1].bg), GREY), true)
check('white gap between blocks',  [all(dayRows(week, '23-Dec')[1].bg, null), all(dayRows(week, '23-Dec')[1].values, '')], [true, true])
check('a grey gap closes the week', all(table(rows[rows.length - 1].bg), GREY), true)
check('every day of the week has a date row',
  rows.filter(r => /^\d{1,2}-[A-Z][a-z]{2}$/.test(r.values[0])).map(r => r.values[1]),
  ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
check('an empty day is just its date row', dayRows(week, '21-Dec').length, 0)

console.log('colours:')
check('CK row purple across',      all(table(rowFor('CK-9').bg), CK), true)
check('Xiao Yi row yellow across', all(table(rowFor('XY').bg), XY), true)
check('mixed row white',           rowFor('MIXED').bg.filter((_, i) => i !== 5).every(b => b === null), true)
check('stray driver row white',    all(rowFor('STRAY').bg, null), true)
check('contractor row white',      all(rowFor('EXT').bg, null), true)
check('no-driver row white',       all(rowFor('NONE').bg, null), true)
check('strict time: red, white, bold', [rowFor('CK-14').bg[5], rowFor('CK-14').fg[5], rowFor('CK-14').weights[5]], [RED, '#FFFFFF', 'bold'])
check('strict row keeps its colour elsewhere', [rowFor('CK-14').bg[0], rowFor('CK-14').bg[4]], [CK, CK])
check('strict on a mixed job',     rowFor('MIXED').bg[5], RED)
check('flexible time: the row colour', [rowFor('CK-9').bg[5], rowFor('CK-9').fg[5], rowFor('CK-9').weights[5]], [CK, '#000000', 'normal'])
const strictNoTime = dayRows(buildPaintedWeek({ ...input, jobs: [job({ time_start: null, punctuality: 'strict' })], leaves: [], trips: [], holidays: [] }), '23-Dec')[0]
check('strict with no time: no empty red cell', strictNoTime.bg[5], CK)

console.log('steady order between refreshes:')
const tied = buildPaintedWeek({ ...input, leaves: [], trips: [], holidays: [], jobs: [
  job({ id: 'b', project_title: 'SECOND', time_start: null }),
  job({ id: 'a', project_title: 'FIRST',  time_start: null }),
] })
check('same time → by id, whatever order the database sends', desc(dayRows(tied, '23-Dec')), ['FIRST', 'SECOND'])

console.log('cells:')
const ck9 = rowFor('CK-9')
check('production ✓',        ck9.values[2], '✓')
check('DO blank',            ck9.values[8], '')
check('XY: production blank, DO ✓', [rowFor('XY').values[2], rowFor('XY').values[8]], ['', '✓'])
check('ticks centred',       [ck9.aligns[2], ck9.aligns[8], ck9.weights[2]], ['center', 'center', 'bold'])
check('company',             ck9.values[3], 'Luxottica')
check('client and number',   ck9.values[4], 'Li Min\n9123 4567')
check('time',                rowFor('CK-14').values[5], '2:00 PM - 4:00 PM')
check('no time',             rowFor('CK-NOTIME').values[5], '')
check('address',             ck9.values[7], '9 KING ALBERT PARK #01-51/52 KAP MALL')
check('sales PIC',           ck9.values[9], 'Nicholas')
check('crew',                ck9.values[10], 'CK+Aroze')
check('mixed crew',          rowFor('MIXED').values[10], 'CK+Rintu+Razu')
check('date and day blank on a job row', [ck9.values[0], ck9.values[1]], ['', ''])

const one = (over: Partial<LayoutJob>) =>
  dayRows(buildPaintedWeek({ ...input, jobs: [job(over)], leaves: [], trips: [], holidays: [] }), '23-Dec')[0].values[6]
check('title then description', one({ project_title: 'OWL', description: 'VISUAL  REFRESH\n(CONFIRMED)' }), 'OWL\nVISUAL REFRESH (CONFIRMED)')
check('title alone',            one({ project_title: 'OWL', description: null }), 'OWL')
check('description alone',      one({ project_title: null, description: 'Drop off' }), 'Drop off')

console.log('leave, courses and holidays:')
const mc = rowFor('MC: Halim')
check('leave text red and bold, no fill', [mc.fg[6], mc.weights[6], all(mc.bg, null)], [RED, 'bold', true])
check('the private note never shows', rows.some(r => r.values.some(v => v.includes('PRIVATE NOTE'))), false)
check('Thursday: a two-day job, then AM leave and a missing type',
  desc(dayRows(week, '24-Dec')), ['TWO-DAY', '', 'On leave: Cara, Vinz (AM)'])
check('a trip ending 00:00 is not on its last date',
  dayRows(week, '24-Dec').some(r => r.values[6].startsWith('On course')), false)
check('PH on a day with no jobs: straight under the date', desc(dayRows(week, '25-Dec')), ['PH: Christmas Day'])
check('PH red text', [rowFor('PH: Christmas Day').fg[6], rowFor('PH: Christmas Day').weights[6]], [RED, 'bold'])
const both = buildPaintedWeek({ ...input, jobs: [], leaves: [leave('Halim', WED, WED, 'full', 'full', 'medical')],
  holidays: [{ holiday_date: WED, name: 'Test Day' }], trips: [] })
check('leave before PH', desc(dayRows(both, '23-Dec')), ['MC: Halim', 'PH: Test Day'])

console.log('has jobs:')
check('a week with jobs',    week.hasJobs, true)
check('a week without jobs', buildPaintedWeek({ ...input, jobs: [] }).hasJobs, false)
check('a job outside the week does not count',
  buildPaintedWeek({ ...input, jobs: [job({ date: '2027-01-05' })] }).hasJobs, false)

console.log(failures === 0 ? '\nAll jobsheet-layout checks passed.' : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)
