/**
 * Greenqubes: fill the old "Greenqubes Jobs" sheet from the app.
 *
 * Paste this whole file into the sheet: Extensions -> Apps Script, delete
 * what is there, paste, Save. Then reload the sheet and use the Greenqubes
 * menu: Set app link, Refresh now, Set up hourly refresh. The step-by-step
 * guide is in Admin -> Settings -> Old jobsheet, and in the repo at
 * docs/google-sheet-jobsheet-setup.md.
 *
 * What it does, every hour:
 *   - makes next week's tab if it doesn't exist yet (copies the header rows
 *     of the newest weekly tab, names it like "30/11 to6/12");
 *   - for every weekly tab from this week onwards, asks the app for that
 *     week's scheduled jobs and writes them BELOW a yellow bar. Rows typed
 *     above the bar are never touched. Past weeks are left as they were.
 * If anything looks wrong (the app doesn't answer, or a tab has two yellow
 * bars), that tab is left exactly as it was.
 *
 * Source of truth: scripts/google-sheet/jobsheet-sync.gs in the
 * greenqubes-ops repo (Nic, 2026-11-11). Its pure helpers are tested there
 * by scripts/google-sheet/jobsheet-sync.test.ts, which loads THIS file — so
 * nothing at the top level may touch SpreadsheetApp; only define things.
 */

const MARKER_TEXT = "FROM THE APP · fills itself every hour · don't type below this line"
const WIDTH = 12   // Date … Job Time, the sheet's 12 columns

// ── Pure helpers (tested in the repo) ────────────────────────────────────────

function isoOfUTC(dt) { return dt.toISOString().slice(0, 10) }
function utcOf(iso) { const p = iso.split('-').map(Number); return new Date(Date.UTC(p[0], p[1] - 1, p[2])) }
function addDaysISO(iso, n) { const dt = utcOf(iso); dt.setUTCDate(dt.getUTCDate() + n); return isoOfUTC(dt) }
function mondayOfISO(iso) { const dt = utcOf(iso); return addDaysISO(iso, -((dt.getUTCDay() + 6) % 7)) }

/** "9/11 to15/11" → the Monday (YYYY-MM-DD) of its week, or null when the tab
 *  isn't a week tab. Read from the END date, so a tab typed with a Sunday
 *  start ("22/11 to29/11") still lands on the right week; the year is the one
 *  that puts that date nearest today, which handles "28/12 to3/1". */
function weekOfTab(name, todayISO) {
  const m = /^\s*(\d{1,2})\/(\d{1,2})\s*to\s*(\d{1,2})\/(\d{1,2})\s*$/i.exec(String(name))
  if (!m) return null
  const day = Number(m[3]), month = Number(m[4])
  const today = utcOf(todayISO)
  const y0 = today.getUTCFullYear()
  let best = null, bestGap = Infinity
  for (const y of [y0 - 1, y0, y0 + 1]) {
    const dt = new Date(Date.UTC(y, month - 1, day))
    if (dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) continue   // 31/2 and friends
    const gap = Math.abs(dt.getTime() - today.getTime())
    if (gap < bestGap) { bestGap = gap; best = dt }
  }
  return best ? mondayOfISO(isoOfUTC(best)) : null
}

/** The tab name for the week starting `monday`, in Nic's style. */
function tabNameFor(monday, spaced) {
  const s = utcOf(monday), e = utcOf(addDaysISO(monday, 6))
  return s.getUTCDate() + '/' + (s.getUTCMonth() + 1) + ' to' + (spaced ? ' ' : '') + e.getUTCDate() + '/' + (e.getUTCMonth() + 1)
}

/** Does this tab name write "to 6/12" (spaced) or "to6/12"? */
function isSpaced(name) { return /to\s+\d/i.test(String(name)) }

/** 0-based row of the one yellow bar in column A; -1 none, -2 more than one. */
function findMarker(colA) {
  const hits = []
  colA.forEach(function (v, i) { if (String(v).indexOf('FROM THE APP') !== -1) hits.push(i) })
  if (hits.length === 0) return -1
  return hits.length > 1 ? -2 : hits[0]
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

/** Removes this script's old timers first, so running it twice never doubles up. */
function setUpHourly() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t) })
  ScriptApp.newTrigger('refreshAll').timeBased().everyHours(1).create()
  SpreadsheetApp.getUi().alert('Done. The sheet now refreshes itself every hour.')
}

function notify_(ss, msg) {
  console.log(msg)
  try { ss.toast(msg, 'Greenqubes', 5) } catch (e) { /* no screen when the hourly timer runs */ }
}

function refreshAll() {
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  const link = PropertiesService.getScriptProperties().getProperty('APP_LINK')
  if (!link) { notify_(ss, 'No app link yet: Greenqubes → Set app link.'); return }
  const today = Utilities.formatDate(new Date(), 'Asia/Singapore', 'yyyy-MM-dd')

  try { ensureNextWeekTab_(ss, today) } catch (e) { console.log('Could not make next week\'s tab: ' + e) }

  let done = 0, skipped = 0
  ss.getSheets().forEach(function (sheet) {
    const monday = weekOfTab(sheet.getName(), today)
    if (!monday || addDaysISO(monday, 6) < today) return   // not a week tab, or a past week
    try {
      if (refreshTab_(sheet, link, monday)) done++
      else skipped++
    } catch (e) {
      skipped++
      console.log('Tab "' + sheet.getName() + '" failed: ' + e)
    }
  })
  notify_(ss, 'Updated ' + done + ' tab(s)' + (skipped ? ', left ' + skipped + ' unchanged' : '') + '.')
}

/** Next week's tab, copied from the newest weekly tab with only its header
 *  rows (1–2) kept. Does nothing if it already exists. */
function ensureNextWeekTab_(ss, today) {
  const nextMonday = addDaysISO(mondayOfISO(today), 7)
  let newest = null, newestWeek = ''
  const sheets = ss.getSheets()
  for (let i = 0; i < sheets.length; i++) {
    const w = weekOfTab(sheets[i].getName(), today)
    if (!w) continue
    if (w === nextMonday) return
    if (w > newestWeek) { newestWeek = w; newest = sheets[i] }
  }
  if (!newest) return   // no weekly tab to copy the header from

  const was = ss.getActiveSheet()
  const copy = ss.insertSheet(tabNameFor(nextMonday, isSpaced(newest.getName())), newest.getIndex(), { template: newest })
  const max = copy.getMaxRows()
  if (max > 3) copy.deleteRows(4, max - 3)   // a sheet must keep one row past its frozen header
  if (max >= 3) copy.getRange(3, 1, 1, copy.getMaxColumns()).clear()
  if (was) ss.setActiveSheet(was)
}

/** One weekly tab: everything below the yellow bar is replaced by the app's
 *  rows for that week. Returns false (tab untouched) when anything is off. */
function refreshTab_(sheet, link, monday) {
  const res = UrlFetchApp.fetch(link + '&week=' + monday, { muteHttpExceptions: true })
  if (res.getResponseCode() !== 200) { console.log('App answered ' + res.getResponseCode() + ' for ' + monday); return false }
  let data
  try { data = JSON.parse(res.getContentText()) } catch (e) { return false }
  if (!data || !Array.isArray(data.rows)) return false

  const lastRow = sheet.getLastRow()
  const colA = lastRow > 0 ? sheet.getRange(1, 1, lastRow, 1).getDisplayValues().map(function (r) { return r[0] }) : []
  const found = findMarker(colA)
  if (found === -2) { console.log('Two yellow bars on "' + sheet.getName() + '" — left alone'); return false }
  const markerRow = found === -1 ? lastRow + 2 : found + 1   // 1-based

  // Room to write.
  if (sheet.getMaxColumns() < WIDTH) sheet.insertColumnsAfter(sheet.getMaxColumns(), WIDTH - sheet.getMaxColumns())
  const need = markerRow + Math.max(1, data.rows.length)
  if (sheet.getMaxRows() < need) sheet.insertRowsAfter(sheet.getMaxRows(), need - sheet.getMaxRows())

  // Clear everything below the bar — the app's block from the last hour.
  const below = sheet.getMaxRows() - markerRow
  if (below > 0) {
    const old = sheet.getRange(markerRow + 1, 1, below, sheet.getMaxColumns())
    old.breakApart()
    old.clear()
  }

  // The yellow bar.
  const bar = sheet.getRange(markerRow, 1, 1, WIDTH)
  bar.breakApart()
  bar.clearContent()
  bar.merge()
  bar.setValue(MARKER_TEXT).setBackground('#fff2cc').setFontColor('#7a5f1e').setFontWeight('bold')

  if (data.rows.length === 0) return true

  const values = [], backgrounds = [], fonts = []
  data.rows.forEach(function (r) {
    const cells = (r.cells || []).slice(0, WIDTH).map(function (c) { return c == null ? '' : String(c) })
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
