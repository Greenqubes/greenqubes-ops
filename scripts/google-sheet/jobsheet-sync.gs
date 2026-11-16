/**
 * Greenqubes: the "Greenqubes Jobs" sheet, filled entirely by the app.
 * Version 2 — the scheduler's layout (Nic, 2026-11-16).
 *
 * Setup (once): in the app, Admin -> Settings -> Old jobsheet: Make link, then
 * Copy script. In the sheet: Extensions -> Apps Script. If the editor only
 * shows an empty "function myFunction() {}", replace it with this script;
 * if there is other code there, add a NEW file (+ -> Script) for this one.
 * Updating from an earlier version: select all of the old script and paste
 * this over it. The app link is kept, so there's no need to set it again.
 * Save, reload the sheet, then use the Greenqubes menu: Set app link (first
 * time only), Refresh now, Set up hourly refresh. The full guide is on that
 * Admin card and in the repo at docs/google-sheet-jobsheet-setup.md.
 *
 * What it does, every hour (full automation, view only):
 *   - for this week and the weeks ahead (up to 10), asks the app for that
 *     week and REWRITES the week's tab from row 1 exactly as the app sends
 *     it: every cell's text, colour and boldness, the column widths and the
 *     pinned rows. The layout itself (driver blocks in driver colours, red
 *     strict times, leave at the bottom of each day) is decided by the app,
 *     so changing it never needs this script pasted again.
 *   - makes the tab when it is missing: always for this week and next week,
 *     and for a later week once it has a job. Named like "16/11 to22/11".
 *   - past weeks are never touched: they stay as the record. Tabs that aren't
 *     week tabs (no "d/m to d/m" name) are never touched either.
 * If the app doesn't answer, sends something incomplete, or two tabs are
 * named for the same week, that week's tab is left exactly as it was; its
 * title row shows when it last updated.
 *
 * Source of truth: scripts/google-sheet/jobsheet-sync.gs in the
 * greenqubes-ops repo. Its pure helpers are tested there by
 * scripts/google-sheet/jobsheet-sync.test.ts, which loads THIS file — so
 * nothing at the top level may touch SpreadsheetApp; only define things.
 */

const MAX_WEEKS_AHEAD = 10    // weeks further out are not filled yet
const LAYOUT = 2              // the answer this script understands

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
 *  later week once the app says it has a job. */
function needsTab(monday, todayISO, hasJobs) {
  if (daysBetween(mondayOfISO(todayISO), monday) <= 7) return true
  return hasJobs === true
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

/** Google turns text starting = + - @ into a formula ("+65 9123 4567"
 *  becomes an error). A leading apostrophe keeps it text and doesn't show. */
function safeCell(v) {
  const s = v == null ? '' : String(v)
  return /^[=+\-@]/.test(s) ? "'" + s : s
}

function sized_(a, n, ok) { return Array.isArray(a) && a.length === n && a.every(ok) }

/** Is the app's answer whole? Checked BEFORE a tab is wiped, so a bad or
 *  half answer can never leave a tab empty. Every row must carry exactly one
 *  value, fill, text colour, weight and alignment per column. */
function usableWeek(data) {
  if (!data || data.layout !== LAYOUT || typeof data.hasJobs !== 'boolean') return false
  const widths = data.widths, rows = data.rows
  if (!Array.isArray(widths) || widths.length < 1 || widths.length > 26) return false
  if (!widths.every(function (w) { return typeof w === 'number' && w > 0 && w <= 1000 })) return false
  if (!Array.isArray(rows) || rows.length === 0) return false
  const f = data.frozen
  if (typeof f !== 'number' || Math.floor(f) !== f || f < 0 || f > rows.length) return false
  const n = widths.length
  const isText = function (v) { return typeof v === 'string' }
  return rows.every(function (r) {
    return !!r && typeof r.wrap === 'boolean'
      && sized_(r.values, n, isText)
      && sized_(r.bg, n, function (v) { return v === null || typeof v === 'string' })
      && sized_(r.fg, n, isText)
      && sized_(r.weights, n, function (v) { return v === 'bold' || v === 'normal' })
      && sized_(r.aligns, n, function (v) { return v === 'left' || v === 'center' })
  })
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
      // Ask the app first: if it doesn't answer properly, the tab keeps what it had.
      const data = fetchWeek_(link, monday)
      if (!data) { if (names.length) skipped++; continue }

      let sheet = names.length ? ss.getSheetByName(names[0]) : null
      let fresh = false
      if (!sheet) {
        if (!needsTab(monday, today, data.hasJobs)) continue
        try { sheet = makeTab_(ss, monday, today); fresh = true; made++ }
        catch (e) { skipped++; console.log('Could not make the tab for ' + monday + ': ' + e); continue }
      }
      try {
        writeTab_(sheet, data)
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
  const res = UrlFetchApp.fetch(link + '&week=' + monday + '&layout=' + LAYOUT, { muteHttpExceptions: true })
  if (res.getResponseCode() !== 200) { console.log('App answered ' + res.getResponseCode() + ' for ' + monday); return null }
  let data
  try { data = JSON.parse(res.getContentText()) } catch (e) { return null }
  if (!usableWeek(data)) { console.log('The app\'s answer for ' + monday + ' was incomplete — tab left as it was'); return null }
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
 *  colours, merged cells, notes, filters, hidden rows — then the app's rows
 *  are written from row 1 exactly as sent. The answer was checked before
 *  this is called, so a tab is only ever wiped when there is something good
 *  to write. */
function writeTab_(sheet, data) {
  const rows = data.rows
  const width = data.widths.length, height = rows.length

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

  if (maxCols < width) sheet.insertColumnsAfter(maxCols, width - maxCols)
  if (maxRows < height) sheet.insertRowsAfter(maxRows, height - maxRows)
  data.widths.forEach(function (w, i) { sheet.setColumnWidth(i + 1, w) })

  const block = sheet.getRange(1, 1, height, width)
  // Plain text, or Google turns "11-Nov" into a date and "4:00 PM" into a time.
  block.setNumberFormat('@')
  block.setValues(rows.map(function (r) { return r.values.map(safeCell) }))
  block.setBackgrounds(rows.map(function (r) { return r.bg }))
  block.setFontColors(rows.map(function (r) { return r.fg }))
  block.setFontWeights(rows.map(function (r) { return r.weights }))
  block.setHorizontalAlignments(rows.map(function (r) { return r.aligns }))
  block.setVerticalAlignment('middle')
  block.setWraps(rows.map(function (r) { return r.values.map(function () { return r.wrap }) }))
  sheet.setFrozenRows(data.frozen)
}
