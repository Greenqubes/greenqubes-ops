/**
 * Greenqubes: the "Greenqubes Jobs" sheet, filled entirely by the app.
 *
 * Setup (once): in the app, Admin -> Settings -> Old jobsheet: Make link, then
 * Copy script. In the sheet: Extensions -> Apps Script. If the editor only
 * shows an empty "function myFunction() {}", replace it with this script;
 * if there is other code there, add a NEW file (+ -> Script) for this one.
 * (Updating from the older "yellow bar" version: paste this over it.)
 * Save, reload the sheet, then use the Greenqubes menu: Set app link,
 * Refresh now, Set up hourly refresh. The full guide is on that Admin card
 * and in the repo at docs/google-sheet-jobsheet-setup.md.
 *
 * What it does, every hour (Nic, 2026-11-12: full automation, view only):
 *   - for this week and the weeks ahead (up to 10), asks the app for that
 *     week's scheduled jobs and REWRITES the week's tab from row 1: a title
 *     row, the column names, then each day's date and that day's jobs.
 *     Everything that was on the tab — typed rows, colours, merged cells —
 *     is replaced. Nobody types in this sheet any more; share it as Viewer.
 *   - makes the tab when it is missing: always for this week and next week,
 *     and for a later week once it has a job. Named like "16/11 to22/11".
 *   - past weeks are never touched: they stay as the record. Tabs that aren't
 *     week tabs (no "d/m to d/m" name) are never touched either.
 * If the app doesn't answer, or two tabs are named for the same week, that
 * week's tab is left exactly as it was; its title row shows when it last
 * updated.
 *
 * Source of truth: scripts/google-sheet/jobsheet-sync.gs in the
 * greenqubes-ops repo (Nic, 2026-11-11; full automation 2026-11-12). Its pure
 * helpers are tested there by scripts/google-sheet/jobsheet-sync.test.ts,
 * which loads THIS file — so nothing at the top level may touch
 * SpreadsheetApp; only define things.
 */

const WIDTH = 12              // Date … Job Time, the sheet's 12 columns
const HEADER_ROWS = 2         // the title row and the column names
const MAX_WEEKS_AHEAD = 10    // weeks further out are not filled yet

/** The column names, in case the app's answer ever lacks them. Must match
 *  SHEET_COLUMNS in src/lib/utils/jobsheet-rows.ts (tested). */
const DEFAULT_COLUMNS = [
  'Date', 'Day', 'Production', 'Contact Person', 'Punctuality', 'Time',
  'Jobs Description', 'Location / Sites', 'DO', 'PIC', 'Remarks', 'Job Time',
]
/** Column widths in pixels, set on every rewrite. */
const COLUMN_WIDTHS = [70, 50, 90, 150, 90, 140, 300, 220, 60, 100, 160, 90]

// ── Pure helpers (tested in the repo) ────────────────────────────────────────

function isoOfUTC(dt) { return dt.toISOString().slice(0, 10) }
function utcOf(iso) { const p = iso.split('-').map(Number); return new Date(Date.UTC(p[0], p[1] - 1, p[2])) }
function addDaysISO(iso, n) { const dt = utcOf(iso); dt.setUTCDate(dt.getUTCDate() + n); return isoOfUTC(dt) }
function mondayOfISO(iso) { const dt = utcOf(iso); return addDaysISO(iso, -((dt.getUTCDay() + 6) % 7)) }
function daysBetween(a, b) { return Math.round((utcOf(b).getTime() - utcOf(a).getTime()) / 86400000) }
function realDate(y, m, d) {
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? isoOfUTC(dt) : null
}

/**
 * "9/11 to15/11" → the Monday (YYYY-MM-DD) of its week, or null when the tab
 * isn't a week tab. Tab names carry no year, so the year is worked out from
 * the WEEKDAY: Nic's weeks start on a Monday (a Sunday start like
 * "22/11 to29/11" is a known typo and still counts), and a date's weekday
 * shifts from one year to the next — so last year's tabs can never be read as
 * this year's or next year's, and are never rewritten. Among the years that
 * fit, the nearest to today wins, ignoring any more than 10 weeks ahead.
 */
function weekOfTab(name, todayISO) {
  const m = /^\s*(\d{1,2})\/(\d{1,2})\s*to\s*(\d{1,2})\/(\d{1,2})\s*$/i.exec(String(name))
  if (!m) return null
  const d1 = Number(m[1]), m1 = Number(m[2]), d2 = Number(m[3]), m2 = Number(m[4])
  const thisMonday = mondayOfISO(todayISO)
  const y0 = utcOf(todayISO).getUTCFullYear()
  let best = null, bestGap = Infinity
  for (const y of [y0 - 1, y0, y0 + 1]) {
    const start = realDate(y, m1, d1)
    const end = realDate(m2 < m1 ? y + 1 : y, m2, d2)
    if (!start || !end) continue
    const dow = utcOf(start).getUTCDay()
    if (dow !== 1 && dow !== 0) continue               // a week tab starts on Monday (or the Sunday typo)
    const span = daysBetween(start, end)
    if (span < 5 || span > 7) continue                 // a week, give or take a typo
    const monday = mondayOfISO(end)
    if (daysBetween(thisMonday, monday) > MAX_WEEKS_AHEAD * 7) continue
    const gap = Math.abs(daysBetween(thisMonday, monday))
    if (gap < bestGap) { bestGap = gap; best = monday }
  }
  return best
}

/** This week, or ahead by at most MAX_WEEKS_AHEAD weeks. */
function isRefreshable(monday, todayISO) {
  const ahead = daysBetween(mondayOfISO(todayISO), monday)
  return addDaysISO(monday, 6) >= todayISO && ahead <= MAX_WEEKS_AHEAD * 7
}

/** Week → the tab names that read as that week. Two tabs on one week means
 *  neither is touched. Returned as a plain object. */
function weeksOfTabs(names, todayISO) {
  const out = {}
  names.forEach(function (n) {
    const w = weekOfTab(n, todayISO)
    if (!w) return
    if (!out[w]) out[w] = []
    out[w].push(n)
  })
  return out
}

/** A missing week tab is made for this week and next week always, and for a
 *  later week once the app has a job in it. */
function needsTab(monday, todayISO, rows) {
  if (daysBetween(mondayOfISO(todayISO), monday) <= 7) return true
  return rows.some(function (r) { return r && r.type === 'job' })
}

/** Where a new week tab goes (insertSheet's 0-based position), keeping the
 *  week tabs in date order: right after the latest earlier week, else right
 *  before the earliest later week, else at the end. `existing` holds each
 *  week tab's Monday and its 1-based getIndex(). */
function insertAt(existing, monday, total) {
  let before = null, after = null
  existing.forEach(function (e) {
    if (e.monday < monday && (!before || e.monday > before.monday)) before = e
    if (e.monday > monday && (!after || e.monday < after.monday)) after = e
  })
  if (before) return before.index
  if (after) return after.index - 1
  return total
}

/** The tab name for the week starting `monday`, in Nic's style. */
function tabNameFor(monday, spaced) {
  const s = utcOf(monday), e = utcOf(addDaysISO(monday, 6))
  return s.getUTCDate() + '/' + (s.getUTCMonth() + 1) + ' to' + (spaced ? ' ' : '') + e.getUTCDate() + '/' + (e.getUTCMonth() + 1)
}

/** Does this tab name write "to 6/12" (spaced) or "to6/12"? */
function isSpaced(name) { return /to\s+\d/i.test(String(name)) }

/** Row 1 of every tab: the week, when it last filled (stale data shows its
 *  age), and that the app owns it. */
function headerTitle(monday, updated) {
  return 'Greenqubes jobs · ' + tabNameFor(monday, true) + ' · updated ' + updated + ' · filled by the app every hour, view only'
}

/** Row 2: the app's column names, or the built-in ones if they're missing. */
function headerCells(columns) {
  const ok = Array.isArray(columns) && columns.length > 0 && columns.every(function (c) { return typeof c === 'string' })
  const cells = (ok ? columns : DEFAULT_COLUMNS).slice(0, WIDTH)
  while (cells.length < WIDTH) cells.push('')
  return cells
}

/** Google turns text starting = + - @ into a formula ("+65 9123 4567"
 *  becomes an error). A leading apostrophe keeps it text and doesn't show. */
function safeCell(v) {
  const s = v == null ? '' : String(v)
  return /^[=+\-@]/.test(s) ? "'" + s : s
}

/** The app's rows → the cell values and their look: grey gap rows, bold
 *  date rows, red "On leave" rows, and Punctuality (column E) red for Strict,
 *  blue for Flexible. */
function paintRows(rows) {
  const values = [], backgrounds = [], fonts = [], weights = []
  rows.forEach(function (r) {
    const cells = (r.cells || []).slice(0, WIDTH).map(safeCell)
    while (cells.length < WIDTH) cells.push('')
    const bg = [], fc = [], fw = []
    for (let i = 0; i < WIDTH; i++) { bg.push(null); fc.push('#000000'); fw.push('normal') }
    if (r.type === 'gap') for (let i = 0; i < WIDTH; i++) bg[i] = '#cfcfcf'
    if (r.type === 'day') for (let i = 0; i < WIDTH; i++) fw[i] = 'bold'
    if (r.type === 'leave') for (let i = 0; i < WIDTH; i++) fc[i] = '#cc0000'
    if (r.type === 'job') {
      if (r.punctuality === 'strict') { bg[4] = '#f4cccc'; fc[4] = '#990000' }
      else { bg[4] = '#cfe2f3'; fc[4] = '#0b5394' }
    }
    values.push(cells); backgrounds.push(bg); fonts.push(fc); weights.push(fw)
  })
  return { values: values, backgrounds: backgrounds, fonts: fonts, weights: weights }
}

// ── The sheet side (runs inside Google) ──────────────────────────────────────

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Greenqubes')
    .addItem('Set app link', 'setAppLink')
    .addItem('Refresh now', 'refreshAll')
    .addItem('Set up hourly refresh', 'setUpHourly')
    .addToUi()
}

function setAppLink() {
  const ui = SpreadsheetApp.getUi()
  const r = ui.prompt('App link', 'Paste the link from the app (Admin → Settings → Old jobsheet).', ui.ButtonSet.OK_CANCEL)
  if (r.getSelectedButton() !== ui.Button.OK) return
  const link = r.getResponseText().trim()
  if (!/^https:\/\/[^\s]+\/api\/sheet\/jobs\?key=[A-Za-z0-9_-]+$/.test(link)) {
    ui.alert("That doesn't look like the app link. Nothing was saved.")
    return
  }
  PropertiesService.getScriptProperties().setProperty('APP_LINK', link)
  ui.alert('Saved. Now choose Greenqubes → Refresh now.')
}

/** Replaces only THIS script's hourly timer, so running it twice never
 *  doubles up and other timers in the project are left alone. */
function setUpHourly() {
  ScriptApp.getProjectTriggers()
    .filter(function (t) { return t.getHandlerFunction() === 'refreshAll' })
    .forEach(function (t) { ScriptApp.deleteTrigger(t) })
  ScriptApp.newTrigger('refreshAll').timeBased().everyHours(1).create()
  SpreadsheetApp.getUi().alert('Done. The sheet now refreshes itself every hour.')
}

function notify_(ss, msg) {
  console.log(msg)
  try { ss.toast(msg, 'Greenqubes', 5) } catch (e) { /* no screen when the hourly timer runs */ }
}

function refreshAll() {
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  // One run at a time: a manual refresh overlapping the hourly one would
  // interleave wipes and writes.
  const lock = LockService.getScriptLock()
  if (!lock.tryLock(30000)) { notify_(ss, 'Another refresh is running — try again in a minute.'); return }
  try {
    const link = PropertiesService.getScriptProperties().getProperty('APP_LINK')
    if (!link) { notify_(ss, 'No app link yet: Greenqubes → Set app link.'); return }
    const today = Utilities.formatDate(new Date(), 'Asia/Singapore', 'yyyy-MM-dd')
    const updated = Utilities.formatDate(new Date(), 'Asia/Singapore', 'd MMM h:mm a')
    const thisMonday = mondayOfISO(today)

    let done = 0, made = 0, skipped = 0
    for (let k = 0; k <= MAX_WEEKS_AHEAD; k++) {
      const monday = addDaysISO(thisMonday, 7 * k)
      const byWeek = weeksOfTabs(ss.getSheets().map(function (s) { return s.getName() }), today)
      const names = byWeek[monday] || []
      if (names.length > 1) {
        skipped++
        console.log('Two tabs for the week of ' + monday + ' (' + names.join(', ') + ') — both left alone')
        continue
      }
      // Ask the app first: if it doesn't answer, the tab keeps what it had.
      const data = fetchWeek_(link, monday)
      if (!data) { if (names.length) skipped++; continue }

      let sheet = names.length ? ss.getSheetByName(names[0]) : null
      let fresh = false
      if (!sheet) {
        if (!needsTab(monday, today, data.rows)) continue
        try { sheet = makeTab_(ss, monday, today); fresh = true; made++ }
        catch (e) { skipped++; console.log('Could not make the tab for ' + monday + ': ' + e); continue }
      }
      try {
        writeTab_(sheet, monday, data, updated)
        done++
      } catch (e) {
        skipped++
        console.log('Tab "' + sheet.getName() + '" failed: ' + e)
        if (fresh) { try { ss.deleteSheet(sheet) } catch (e2) { /* leave the empty tab */ } }
      }
    }
    notify_(ss, 'Updated ' + done + ' tab(s)' + (made ? ', ' + made + ' new' : '') + (skipped ? ', left ' + skipped + ' unchanged' : '') + '.')
  } finally {
    lock.releaseLock()
  }
}

/** One week from the app, checked; null when the answer can't be used. */
function fetchWeek_(link, monday) {
  const res = UrlFetchApp.fetch(link + '&week=' + monday, { muteHttpExceptions: true })
  if (res.getResponseCode() !== 200) { console.log('App answered ' + res.getResponseCode() + ' for ' + monday); return null }
  let data
  try { data = JSON.parse(res.getContentText()) } catch (e) { return null }
  if (!data || !Array.isArray(data.rows)) return null
  if (!data.rows.every(function (r) { return r && Array.isArray(r.cells) && typeof r.type === 'string' })) return null
  return data
}

/** A new, empty week tab, in date order among the week tabs, named in the
 *  style of the newest week tab ("16/11 to22/11" or "16/11 to 22/11"). */
function makeTab_(ss, monday, today) {
  const existing = []
  let newest = null
  ss.getSheets().forEach(function (s) {
    const w = weekOfTab(s.getName(), today)
    if (!w) return
    existing.push({ monday: w, index: s.getIndex() })
    if (!newest || w > newest.monday) newest = { monday: w, name: s.getName() }
  })
  const was = ss.getActiveSheet()
  const tab = ss.insertSheet(tabNameFor(monday, newest ? isSpaced(newest.name) : false), insertAt(existing, monday, ss.getSheets().length))
  if (was) ss.setActiveSheet(was)
  return tab
}

/** One week tab, rewritten whole: everything on it is wiped — values,
 *  colours, merged cells, notes, filters, hidden rows — then the header and
 *  the app's rows are written from row 1. The app's answer was checked
 *  before this is called, so a tab is only ever wiped when there is
 *  something good to write. */
function writeTab_(sheet, monday, data, updated) {
  const painted = paintRows(data.rows)
  const header = headerCells(data.columns)

  const maxRows = sheet.getMaxRows(), maxCols = sheet.getMaxColumns()
  sheet.setFrozenRows(0)
  sheet.setFrozenColumns(0)
  const all = sheet.getRange(1, 1, maxRows, maxCols)
  all.breakApart()
  sheet.clear()
  all.clearDataValidations()
  all.clearNote()
  sheet.clearConditionalFormatRules()
  const filter = sheet.getFilter()
  if (filter) filter.remove()
  sheet.getBandings().forEach(function (b) { b.remove() })
  sheet.showRows(1, maxRows)
  sheet.showColumns(1, maxCols)

  const need = HEADER_ROWS + Math.max(1, painted.values.length)
  if (maxCols < WIDTH) sheet.insertColumnsAfter(maxCols, WIDTH - maxCols)
  if (maxRows < need) sheet.insertRowsAfter(maxRows, need - maxRows)
  COLUMN_WIDTHS.forEach(function (w, i) { sheet.setColumnWidth(i + 1, w) })

  // Row 1: the title. Not merged: it simply runs across the empty cells.
  const title = sheet.getRange(1, 1, 1, WIDTH)
  title.setBackground('#1f3d3b').setFontColor('#ffffff').setFontWeight('bold').setFontSize(11)
  sheet.getRange(1, 1).setValue(safeCell(headerTitle(monday, updated))).setWrap(false)

  // Row 2: the column names.
  const names = sheet.getRange(2, 1, 1, WIDTH)
  names.setNumberFormat('@')
  names.setValues([header])
  names.setBackground('#d9e7e6').setFontWeight('bold').setWrap(true).setVerticalAlignment('middle')
  sheet.setFrozenRows(HEADER_ROWS)

  if (painted.values.length === 0) return
  const block = sheet.getRange(HEADER_ROWS + 1, 1, painted.values.length, WIDTH)
  // Plain text, or Google turns "11-Nov" into a date and "4:00 PM" into a time.
  block.setNumberFormat('@')
  block.setValues(painted.values)
  block.setBackgrounds(painted.backgrounds)
  block.setFontColors(painted.fonts)
  block.setFontWeights(painted.weights)
  block.setWrap(true)
  block.setVerticalAlignment('middle')
}
