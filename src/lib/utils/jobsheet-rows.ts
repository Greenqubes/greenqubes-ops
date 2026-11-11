import type { Crew } from './installer-crew'

/**
 * The old "Greenqubes Jobs" Google Sheet, filled from the app (Nic,
 * 2026-11-11; spec 2026-11-11-gallery-groups-bulk-sheet-design.md Part 2).
 * A script inside the sheet asks /api/sheet/jobs for one week and writes the
 * rows below its yellow marker bar. All layout decisions live HERE, tested,
 * so the script stays thin: it only writes cells and colours rows by `type`.
 *
 * The sheet's 12 columns, in Nic's order. Production, DO and Job Time stay
 * blank — the app doesn't hold them the way his sheet uses them.
 * Dates and day names are always English (hard rule).
 */
export const SHEET_COLUMNS = [
  'Date', 'Day', 'Production', 'Contact Person', 'Punctuality', 'Time',
  'Jobs Description', 'Location / Sites', 'DO', 'PIC', 'Remarks', 'Job Time',
] as const

export type SheetJob = {
  id: string
  date: string
  date_end: string | null
  time_start: string | null
  time_end: string | null
  punctuality: 'strict' | 'flexible'
  project_title: string | null
  client: string
  description: string | null
  location: string
  client_poc_name: string | null
  client_poc_phone: string | null
  /** The job's sales person — his PIC column. */
  salesName: string | null
  crew: Crew
}

export type SheetLeave = { name: string; date_start: string; date_end: string }

export type SheetRow = {
  type: 'gap' | 'day' | 'leave' | 'job'
  /** Always 12, one per SHEET_COLUMNS entry. */
  cells: string[]
  punctuality?: 'strict' | 'flexible'
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

const utc = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)) }
const isoOf = (dt: Date) => dt.toISOString().slice(0, 10)
const blank = (): string[] => Array.from({ length: SHEET_COLUMNS.length }, () => '')
const oneLine = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim()

/** '16:00:00' → '4:00 PM'. */
function clock(t: string): string {
  const [h, m] = t.slice(0, 5).split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

export function sheetTime(start: string | null, end: string | null): string {
  if (!start) return ''
  return end ? `${clock(start)} - ${clock(end)}` : clock(start)
}

/** Drivers, then support crew, then outside contractors — "CK+Razu", the
 *  way the sheet's Remarks column writes a crew. */
export function crewLine(crew: Crew): string {
  return [...crew.drivers, ...crew.support, ...crew.externals].map(p => p.name).join('+')
}

/** A real YYYY-MM-DD that falls on a Monday, else null. */
export function parseWeek(raw: unknown): string | null {
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null
  const dt = utc(raw)
  if (Number.isNaN(dt.getTime()) || isoOf(dt) !== raw) return null
  return dt.getUTCDay() === 1 ? raw : null
}

function jobRow(j: SheetJob): SheetRow {
  const cells = blank()
  cells[3]  = [oneLine(j.client_poc_name), oneLine(j.client_poc_phone)].filter(Boolean).join('\n')
  cells[4]  = j.punctuality === 'strict' ? 'Strict' : 'Flexible'
  cells[5]  = sheetTime(j.time_start, j.time_end)
  cells[6]  = [oneLine(j.project_title) || oneLine(j.client), oneLine(j.description)].filter(Boolean).join('\n')
  cells[7]  = oneLine(j.location)
  cells[9]  = j.salesName ?? ''
  cells[10] = crewLine(j.crew)
  return { type: 'job', cells, punctuality: j.punctuality }
}

export function buildWeekRows(monday: string, jobs: SheetJob[], leaves: SheetLeave[]): SheetRow[] {
  const rows: SheetRow[] = []
  const start = utc(monday)
  for (let i = 0; i < 7; i++) {
    const dt = new Date(start.getTime() + i * 86_400_000)
    const day = isoOf(dt)
    rows.push({ type: 'gap', cells: blank() })
    const head = blank()
    head[0] = `${dt.getUTCDate()}-${MONTHS[dt.getUTCMonth()]}`
    head[1] = DAYS[dt.getUTCDay()]
    rows.push({ type: 'day', cells: head })
    const off = leaves.filter(l => l.date_start <= day && l.date_end >= day).map(l => l.name)
    if (off.length) {
      const cells = blank()
      cells[6] = `On leave: ${off.join(', ')}`
      rows.push({ type: 'leave', cells })
    }
    jobs
      .filter(j => j.date <= day && (j.date_end ?? j.date) >= day)
      // Untimed first, as on the installer lists; '' sorts before any time.
      .sort((a, b) => (a.time_start ?? '').localeCompare(b.time_start ?? ''))
      .forEach(j => rows.push(jobRow(j)))
  }
  return rows
}
