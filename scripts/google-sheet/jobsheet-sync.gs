/**
 * Greenqubes: fill the old "Greenqubes Jobs" sheet from the app.
 *
 * Setup (once): in the app, Admin -> Settings -> Old jobsheet: Make link, then
 * Copy script. In the sheet: Extensions -> Apps Script. If the editor only
 * shows an empty "function myFunction() {}", replace it with this script;
 * if there is other code there, add a NEW file (+ -> Script) for this one.
 * Save, reload the sheet, then use the Greenqubes menu: Set app link,
 * Refresh now, Set up hourly refresh. The full guide is on that Admin card
 * and in the repo at docs/google-sheet-jobsheet-setup.md.
 *
 * What it does, every hour:
 *   - makes next week's tab if it doesn't exist yet (copies the header rows
 *     of the newest weekly tab, names it like "30/11 to6/12");
 *   - for this week and the weeks ahead (up to 10), asks the app for that
 *     week's scheduled jobs and writes them BELOW a yellow bar. Rows typed
 *     above the bar are never touched. Past weeks are left as they were.
 * If anything looks wrong — the app doesn't answer, a tab has two yellow
 * bars, two tabs claim the same week, a merged cell crosses the bar — that
 * tab is left exactly as it was, and the bar's "updated" time shows how old
 * its jobs are.
 *
 * Source of truth: scripts/google-sheet/jobsheet-sync.gs in the
 * greenqubes-ops repo (Nic, 2026-11-11). Its pure helpers are tested there
 * by scripts/google-sheet/jobsheet-sync.test.ts, which loads THIS file — so
 * nothing at the top level may touch SpreadsheetApp; only define things.
 */

const MARKER_PREFIX = 'FROM THE APP ·'
const WIDTH = 12              // Date … Job Time, the sheet's 12 columns
const MAX_WEEKS_AHEAD = 10    // weeks further out are not filled yet
const ROOM_ABOVE_BAR = 10     // empty rows left for typing when a bar is first placed
const NEW_TAB_BAR_ROW = 45    // a brand-new tab's bar starts no higher than this

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
 * this year's or next year's (final review #1). Among the years that fit, the
 * nearest to today wins, ignoring any more than 10 weeks ahead.
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
 *  neither is touched (final review #1). Returned as a plain object. */
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

/** The tab name for the week starting `monday`, in Nic's style. */
function tabNameFor(monday, spaced) {
  const s = utcOf(monday), e = utcOf(addDaysISO(monday, 6))
  return s.getUTCDate() + '/' + (s.getUTCMonth() + 1) + ' to' + (spaced ? ' ' : '') + e.getUTCDate() + '/' + (e.getUTCMonth() + 1)
}

/** Does this tab name write "to 6/12" (spaced) or "to6/12"? */
function isSpaced(name) { return /to\s+\d/i.test(String(name)) }

/** The bar's words, with when it last filled — stale data shows its age. */
function barText(updated) {
  return MARKER_PREFIX + ' updated ' + updated + " · don't type below this line"
}

/** 0-based row of the one yellow bar in column A; -1 none, -2 more than one.
 *  Only a cell that STARTS with the bar's words counts, so a typed note that
 *  mentions it can never be taken for the bar (final review #7). */
function findMarker(colA) {
  const hits = []
  colA.forEach(function (v, i) { if (String(v).trim().indexOf(MARKER_PREFIX) === 0) hits.push(i) })
  if (hits.length === 0) return -1
  return hits.length > 1 ? -2 : hits[0]
}

/** Where a tab's first bar goes: room to type under the last used row, and
 *  never cramped against the header of a new tab (final review #3). 1-based. */
function markerRowFor(lastUsedRow) {
  return Math.max(lastUsedRow + ROOM_ABOVE_BAR, NEW_TAB_BAR_ROW)
}

/** Google turns text starting = + - @ into a formula ("+65 9123 4567"
 *  becomes an error). A leading apostrophe keeps it text and doesn't show. */
function safeCell(v) {
  const s = v == null ? '' : String(v)
  return /^[=+\-@]/.test(s) ? "'" + s : s
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
 *  doubles up and other timers in the project are left alone (review #6). */
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
  // interleave clears and writes (review #10).
  const lock = LockService.getScriptLock()
  if (!lock.tryLock(30000)) { notify_(ss, 'Another refresh is running — try again in a minute.'); return }
  try {
    const link = PropertiesService.getScriptProperties().getProperty('APP_LINK')
    if (!link) { notify_(ss, 'No app link yet: Greenqubes → Set app link.'); return }
    const today = Utilities.formatDate(new Date(), 'Asia/Singapore', 'yyyy-MM-dd')
    const updated = Utilities.formatDate(new Date(), 'Asia/Singapore', 'd MMM h:mm a')

    try { ensureNextWeekTab_(ss, today) } catch (e) { console.log('Could not make next week\'s tab: ' + e) }

    const sheets = ss.getSheets()
    const byWeek = weeksOfTabs(sheets.map(function (s) { return s.getName() }), today)
    let done = 0, skipped = 0
    sheets.forEach(function (sheet) {
      const monday = weekOfTab(sheet.getName(), today)
      if (!monday || !isRefreshable(monday, today)) return
      if (byWeek[monday].length > 1) {
        skipped++
        console.log('Two tabs for the week of ' + monday + ' (' + byWeek[monday].join(', ') + ') — both left alone')
        return
      }
      try {
        if (refreshTab_(sheet, link, monday, updated)) done++
        else skipped++
      } catch (e) {
        skipped++
        console.log('Tab "' + sheet.getName() + '" failed: ' + e)
      }
    })
    notify_(ss, 'Updated ' + done + ' tab(s)' + (skipped ? ', left ' + skipped + ' unchanged' : '') + '.')
  } finally {
    lock.releaseLock()
  }
}

/** Next week's tab: a blank tab with the newest weekly tab's header rows
 *  (1–2), column widths and frozen rows copied across. Nothing else is
 *  copied, so last week's jobs can never appear under next week's name. If
 *  anything fails part-way, the half-made tab is removed (review #2). */
function ensureNextWeekTab_(ss, today) {
  const nextMonday = addDaysISO(mondayOfISO(today), 7)
  const byWeek = weeksOfTabs(ss.getSheets().map(function (s) { return s.getName() }), today)
  if (byWeek[nextMonday]) return
  let newest = null, newestWeek = ''
  ss.getSheets().forEach(function (s) {
    const w = weekOfTab(s.getName(), today)
    if (w && w <= nextMonday && w > newestWeek) { newestWeek = w; newest = s }
  })
  if (!newest) return   // no weekly tab to copy the header from

  const was = ss.getActiveSheet()
  const tab = ss.insertSheet(tabNameFor(nextMonday, isSpaced(newest.getName())), newest.getIndex())
  try {
    const cols = Math.max(newest.getMaxColumns(), WIDTH)
    if (tab.getMaxColumns() < cols) tab.insertColumnsAfter(tab.getMaxColumns(), cols - tab.getMaxColumns())
    newest.getRange(1, 1, 2, cols).copyTo(tab.getRange(1, 1))
    for (let c = 1; c <= cols; c++) tab.setColumnWidth(c, newest.getColumnWidth(c))
    for (let r = 1; r <= 2; r++) tab.setRowHeight(r, newest.getRowHeight(r))
    tab.setFrozenRows(Math.min(newest.getFrozenRows(), 2))
  } catch (e) {
    ss.deleteSheet(tab)
    throw e
  } finally {
    if (was) ss.setActiveSheet(was)
  }
}

/** One weekly tab: everything below the yellow bar is replaced by the app's
 *  rows for that week. Every check runs BEFORE anything is changed, so a tab
 *  that is left alone keeps its last good jobs (review #4, #11). */
function refreshTab_(sheet, link, monday, updated) {
  const res = UrlFetchApp.fetch(link + '&week=' + monday, { muteHttpExceptions: true })
  if (res.getResponseCode() !== 200) { console.log('App answered ' + res.getResponseCode() + ' for ' + monday); return false }
  let data
  try { data = JSON.parse(res.getContentText()) } catch (e) { return false }
  if (!data || !Array.isArray(data.rows)) return false
  if (!data.rows.every(function (r) { return r && Array.isArray(r.cells) && typeof r.type === 'string' })) return false

  const name = sheet.getName()
  const lastRow = sheet.getLastRow()
  const maxCols = sheet.getMaxColumns()
  const colA = lastRow > 0 ? sheet.getRange(1, 1, lastRow, 1).getDisplayValues().map(function (r) { return r[0] }) : []
  const found = findMarker(colA)
  if (found === -2) { console.log('Two yellow bars on "' + name + '" — left alone'); return false }

  // Merged cells: getLastRow ignores the empty lower part of a merge, so the
  // first bar goes below the bottom of any merge; and a merge that crosses
  // the bar means the tab is left alone rather than unmerging Nic's cells.
  const merges = lastRow > 0 ? sheet.getRange(1, 1, sheet.getMaxRows(), maxCols).getMergedRanges() : []
  let lastUsed = lastRow
  merges.forEach(function (m) { if (m.getRow() <= lastRow) lastUsed = Math.max(lastUsed, m.getLastRow()) })
  const markerRow = found === -1 ? markerRowFor(lastUsed) : found + 1   // 1-based
  const crosses = merges.some(function (m) { return m.getRow() < markerRow && m.getLastRow() >= markerRow })
  if (crosses) { console.log('A merged cell crosses the bar on "' + name + '" — left alone'); return false }

  // Room to write.
  if (maxCols < WIDTH) sheet.insertColumnsAfter(maxCols, WIDTH - maxCols)
  const need = markerRow + Math.max(1, data.rows.length)
  if (sheet.getMaxRows() < need) sheet.insertRowsAfter(sheet.getMaxRows(), need - sheet.getMaxRows())

  // From here on the tab changes. Everything below the bar is the app's
  // block from the last hour; merges there are the app's own (none) or ones
  // made below the bar, which the bar says not to do.
  const width = sheet.getMaxColumns()
  const below = sheet.getMaxRows() - markerRow
  if (below > 0) {
    const old = sheet.getRange(markerRow + 1, 1, below, width)
    old.breakApart()
    old.clear()
  }

  // The yellow bar: one coloured row with the words in column A — not merged,
  // so a frozen column can never make it fail.
  sheet.getRange(markerRow, 1, 1, width).clearContent()
  sheet.getRange(markerRow, 1, 1, WIDTH).setBackground('#fff2cc').setFontColor('#7a5f1e').setFontWeight('bold')
  sheet.getRange(markerRow, 1).setValue(barText(updated)).setWrap(false)

  if (data.rows.length === 0) return true

  const values = [], backgrounds = [], fonts = []
  data.rows.forEach(function (r) {
    const cells = r.cells.slice(0, WIDTH).map(safeCell)
    while (cells.length < WIDTH) cells.push('')
    values.push(cells)
    const bg = new Array(WIDTH).fill(null), fc = new Array(WIDTH).fill('#000000')
    if (r.type === 'gap') bg.fill('#cfcfcf')
    if (r.type === 'leave') fc.fill('#cc0000')
    if (r.type === 'job') {
      // Column E, Punctuality: red for Strict, blue for Flexible.
      if (r.punctuality === 'strict') { bg[4] = '#f4cccc'; fc[4] = '#990000' }
      else { bg[4] = '#cfe2f3'; fc[4] = '#0b5394' }
    }
    backgrounds.push(bg)
    fonts.push(fc)
  })

  const block = sheet.getRange(markerRow + 1, 1, values.length, WIDTH)
  // Plain text, or Google turns "11-Nov" into a date and "4:00 PM" into a time.
  block.setNumberFormat('@')
  block.setValues(values)
  block.setBackgrounds(backgrounds)
  block.setFontColors(fonts)
  block.setWrap(true)
  block.setVerticalAlignment('middle')
  return true
}
