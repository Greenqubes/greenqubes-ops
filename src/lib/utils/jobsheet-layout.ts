import { sheetTime, crewLine, type SheetJob } from './jobsheet-rows'
import type { Crew } from './installer-crew'
import { leaveWindowOnDate, type LeavePortion } from './leave-overlap'
import { awayWindowOnDate, type AwayTrip } from './away-overlap'
import { driverTintHex } from './driver-board'

/**
 * The old "Greenqubes Jobs" Google Sheet in the scheduler's layout (Nic,
 * 2026-11-16; spec docs/superpowers/specs/2026-11-16-jobsheet-scheduler-layout-design.md,
 * mockup https://claude.ai/artifact/9CHHtNRpAS27rJvDCEDH9s).
 *
 * Everything the sheet shows is decided HERE and sent fully painted — every
 * cell's text, fill, text colour, weight and alignment, plus column widths
 * and pinned rows — so the Apps Script in the sheet only copies it, and a
 * later tweak never means pasting the script again.
 *
 * Each day: grey gap · date row · Mixed (2+ drivers) · each driver's jobs in
 * that driver's colour (the Drivers view's colours) · anyone else crewed as
 * the single driver · contractor-only jobs · jobs with no driver yet · then,
 * in red text: MC, On leave, each course, PH. White gaps between blocks.
 *
 * Column L sits just beside the table: empty, except the week's year in L2,
 * Arial 20 bold (Nic, 2026-11-17) — the tab names carry no year.
 *
 * Leave TYPE is shown (MC vs On leave) on Nic's explicit call, knowing the
 * sheet is shared with the whole team. HR's note is never read or sent.
 * Dates and day names are always English (hard rule).
 */

export const LAYOUT_COLUMNS: ReadonlyArray<{ name: string; width: number }> = [
  { name: 'Date',                          width: 70 },
  { name: 'Day',                           width: 45 },
  { name: 'Production (生产)',              width: 80 },
  { name: 'Company',                       width: 130 },
  { name: 'Client Name & Contact',         width: 150 },
  { name: 'Time & Punctuality (时间)',      width: 130 },
  { name: 'Jobs Description （工作说明）',   width: 320 },
  { name: 'Address',                       width: 260 },
  { name: 'DO',                            width: 50 },
  { name: 'Sales PIC',                     width: 100 },
  { name: 'Driver & Installer',            width: 245 },
]
const T = LAYOUT_COLUMNS.length              // the table: columns A–K
const W = T + 1                              // the tab: the table, then column L
const C = { date: 0, day: 1, prod: 2, company: 3, client: 4, time: 5, desc: 6, address: 7, do: 8, pic: 9, crew: 10, year: 11 } as const
const YEAR_WIDTH = 90, YEAR_FONT = 'Arial', YEAR_SIZE = 20
const SIZE = 10                              // Google Sheets' own default

const TITLE_BG = '#1F3D3B', TITLE_FG = '#FFFFFF'
const HEADER_BG = '#B7B7B7'
const DAY_GAP_BG = '#CCCCCC'
const INK = '#000000'
const HARD_RED = '#FF0000', ON_RED = '#FFFFFF'

export type PaintedRow = {
  values:  string[]
  bg:      (string | null)[]          // null = no fill
  fg:      string[]
  weights: ('bold' | 'normal')[]
  aligns:  ('left' | 'center')[]
  sizes:   number[]                   // font size, points
  fonts:   (string | null)[]          // null = the sheet's own font
  wrap:    boolean
}

export type PaintedWeek = {
  layout:  2
  week:    string                     // the Monday, YYYY-MM-DD
  widths:  number[]
  frozen:  number                     // rows pinned at the top
  hasJobs: boolean                    // a later week gets a tab only once it has one
  rows:    PaintedRow[]
}

export type LayoutJob = SheetJob & { production_ready: boolean; do_issued: boolean }

export type LayoutLeave = {
  name: string; date_start: string; date_end: string
  start_portion: LeavePortion; end_portion: LeavePortion
  leave_type: string | null
}

export type LayoutHoliday = { holiday_date: string; name: string }

export type LayoutInput = {
  monday:   string
  now:      Date
  jobs:     LayoutJob[]
  leaves:   LayoutLeave[]
  trips:    AwayTrip[]
  holidays: LayoutHoliday[]
  /** The is_driver users' names, in name order — the board's driver order. */
  drivers:  string[]
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

const utc = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)) }
const isoOf = (dt: Date) => dt.toISOString().slice(0, 10)
const oneLine = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim()
const dm = (dt: Date) => `${dt.getUTCDate()}/${dt.getUTCMonth() + 1}`

/** '23 Dec 3:00 PM' — Singapore time (UTC+8, no daylight saving). */
export function sgtStamp(now: Date): string {
  const t = new Date(now.getTime() + 8 * 3_600_000)
  const h = t.getUTCHours(), m = t.getUTCMinutes()
  return `${t.getUTCDate()} ${MONTHS[t.getUTCMonth()]} ${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

/** Medical is "MC"; every other type, or none recorded, is "On leave" — so
 *  "emergency" never appears on a sheet the whole team reads. */
export function leaveLabel(type: string | null): 'MC' | 'On leave' {
  return type === 'medical' ? 'MC' : 'On leave'
}

function row(values: string[] = [], bg: string | null = null): PaintedRow {
  return {
    // Callers fill cells by index, leaving holes; every cell must be a string.
    values: Array.from({ length: W }, (_, i) => values[i] ?? ''),
    // Fills stop at the table's edge: column L is never filled.
    bg: Array.from({ length: W }, (_, i) => (i < T ? bg : null)),
    fg: Array(W).fill(INK),
    weights: Array(W).fill('normal'),
    aligns: Array(W).fill('left'),
    sizes: Array(W).fill(SIZE),
    fonts: Array(W).fill(null),
    wrap: true,
  }
}

function redText(text: string): PaintedRow {
  const cells: string[] = []
  cells[C.desc] = text
  const r = row(cells)
  r.fg[C.desc] = HARD_RED
  r.weights[C.desc] = 'bold'
  return r
}

function jobRow(j: LayoutJob, tint: string | null): PaintedRow {
  const cells: string[] = []
  cells[C.prod]    = j.production_ready ? '✓' : ''
  cells[C.company] = oneLine(j.client)
  cells[C.client]  = [oneLine(j.client_poc_name), oneLine(j.client_poc_phone)].filter(Boolean).join('\n')
  cells[C.time]    = sheetTime(j.time_start, j.time_end)
  cells[C.desc]    = [oneLine(j.project_title), oneLine(j.description)].filter(Boolean).join('\n')
  cells[C.address] = oneLine(j.location)
  cells[C.do]      = j.do_issued ? '✓' : ''
  cells[C.pic]     = j.salesName ?? ''
  cells[C.crew]    = crewLine(j.crew)
  const r = row(cells, tint)
  for (const i of [C.prod, C.do]) { r.aligns[i] = 'center'; r.weights[i] = 'bold' }
  // Only a real time turns red — an empty red cell would say nothing.
  if (j.punctuality === 'strict' && cells[C.time]) {
    r.bg[C.time] = HARD_RED; r.fg[C.time] = ON_RED; r.weights[C.time] = 'bold'
  }
  return r
}

/** Which block a job sits in — the board's rule (driver-board.ts primaryBand),
 *  on names: 2+ drivers → Mixed, 1 → that driver, none but an outside
 *  installer → contractor, nobody → no driver yet. */
function blockOf(c: Crew): string {
  if (c.drivers.length >= 2) return 'mixed'
  if (c.drivers.length === 1) return `driver:${c.drivers[0].name}`
  return c.externals.length > 0 ? 'contractor' : 'none'
}

/** No time first, then by start time; ties by id, so rows don't swap places
 *  from one hourly refresh to the next (the database sends no fixed order). */
const byStart = (a: LayoutJob, b: LayoutJob) =>
  (a.time_start ?? '').localeCompare(b.time_start ?? '') || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

function leaveSuffix(l: LayoutLeave, day: string): string {
  const win = leaveWindowOnDate({ ...l, id: '', user_id: '' }, day)
  if (win?.start === '00:00' && win.end === '12:00') return ' (AM)'
  if (win?.start === '12:00' && win.end === '24:00') return ' (PM)'
  return ''
}

/** MC, On leave, each course, then PH — the red rows that close a day. */
function dayEnd(day: string, input: LayoutInput): PaintedRow[] {
  const out: PaintedRow[] = []
  const off = input.leaves
    .filter(l => leaveWindowOnDate({ ...l, id: '', user_id: '' }, day))
    .sort((a, b) => a.name.localeCompare(b.name))
  for (const label of ['MC', 'On leave'] as const) {
    const names = off.filter(l => leaveLabel(l.leave_type) === label).map(l => l.name + leaveSuffix(l, day))
    if (names.length) out.push(redText(`${label}: ${names.join(', ')}`))
  }
  input.trips
    .filter(t => t.people.length > 0 && awayWindowOnDate(t, day))
    .sort((a, b) => `${a.start_date} ${a.start_time} ${a.title}`.localeCompare(`${b.start_date} ${b.start_time} ${b.title}`))
    .forEach(t => out.push(redText(`On course: ${t.people.map(p => p.name).join(', ')} · ${oneLine(t.title)}`)))
  input.holidays
    .filter(h => h.holiday_date === day)
    .forEach(h => out.push(redText(`PH: ${oneLine(h.name)}`)))
  return out
}

export function buildPaintedWeek(input: LayoutInput): PaintedWeek {
  const start = utc(input.monday)
  const days = Array.from({ length: 7 }, (_, i) => new Date(start.getTime() + i * 86_400_000))
  const covers = (j: LayoutJob, day: string) => j.date <= day && (j.date_end ?? j.date) >= day

  const title = row([`Greenqubes jobs · ${dm(days[0])} to ${dm(days[6])} · updated ${sgtStamp(input.now)} · filled by the app every hour, view only`], TITLE_BG)
  title.fg.fill(TITLE_FG); title.weights.fill('bold'); title.wrap = false
  const header = row([...LAYOUT_COLUMNS.map(c => c.name), String(start.getUTCFullYear())], HEADER_BG)
  header.weights.fill('bold'); header.aligns.fill('center')
  header.fonts[C.year] = YEAR_FONT; header.sizes[C.year] = YEAR_SIZE
  const rows: PaintedRow[] = [title, header]

  for (const dt of days) {
    const day = isoOf(dt)
    rows.push(row([], DAY_GAP_BG))
    const head = row([`${dt.getUTCDate()}-${MONTHS[dt.getUTCMonth()]}`, DAYS[dt.getUTCDay()]])
    head.weights.fill('bold')
    rows.push(head)

    const todays = input.jobs.filter(j => covers(j, day))
    const strays = [...new Set(todays.map(j => blockOf(j.crew)))]
      .filter(b => b.startsWith('driver:') && !input.drivers.includes(b.slice(7)))
      .sort()
    const order = ['mixed', ...input.drivers.map(d => `driver:${d}`), ...strays, 'contractor', 'none']

    let blocks = 0
    for (const block of order) {
      const inBlock = todays.filter(j => blockOf(j.crew) === block).sort(byStart)
      if (inBlock.length === 0) continue
      if (blocks++ > 0) rows.push(row())
      const name = block.startsWith('driver:') ? block.slice(7) : null
      const tint = name && input.drivers.includes(name) ? driverTintHex(name) : null
      inBlock.forEach(j => rows.push(jobRow(j, tint)))
    }

    const end = dayEnd(day, input)
    if (end.length && blocks > 0) rows.push(row())
    rows.push(...end)
  }
  rows.push(row([], DAY_GAP_BG))

  const weekDays = days.map(isoOf)
  return {
    layout: 2,
    week: input.monday,
    widths: [...LAYOUT_COLUMNS.map(c => c.width), YEAR_WIDTH],
    frozen: 2,
    hasJobs: input.jobs.some(j => weekDays.some(d => covers(j, d))),
    rows,
  }
}
