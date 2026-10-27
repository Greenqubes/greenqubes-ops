/**
 * The date strip's month labels, the Drivers board's day word, and what the
 * ‹ › beside the heading do in each view (Nic's screenshot, 2026-10-27).
 *
 * Pure and dependency-free apart from the date helpers, so its test runs
 * standalone.
 */
import { shiftDate, shiftMonth } from './utils'
import type { ScheduleView } from './job-jump'

// Static English tables, no locale calls: month names are always English
// (CLAUDE.md hard rule), and /schedule is hydration-sensitive (#418).
const LONG  = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
               'August', 'September', 'October', 'November', 'December']
const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export interface MonthLink {
  /** The 1st of that month — a day every month has, so a tap from the 31st
   *  can never roll over into the month after. */
  iso:   string
  long:  string
  /** For a phone, where three full names side by side would not fit. */
  short: string
}

/** `monthIndex` counts months from year 0, so stepping across New Year is
 *  plain arithmetic. */
function monthLink(monthIndex: number): MonthLink {
  const year = Math.floor(monthIndex / 12)
  const m    = monthIndex % 12
  return {
    iso:   `${year}-${String(m + 1).padStart(2, '0')}-01`,
    long:  `${LONG[m]} ${year}`,
    short: `${SHORT[m]} ${year}`,
  }
}

function monthIndexOf(iso: string): number {
  return Number(iso.slice(0, 4)) * 12 + Number(iso.slice(5, 7)) - 1
}

/** The months either side of what the strip shows. A week can straddle two
 *  months, so "before" is measured from its FIRST day and "after" from its
 *  LAST — the labels always name a month that is not already on screen. */
export function adjacentMonths(firstDay: string, lastDay: string): { prev: MonthLink; next: MonthLink } {
  return {
    prev: monthLink(monthIndexOf(firstDay) - 1),
    next: monthLink(monthIndexOf(lastDay) + 1),
  }
}

/** "3 Jobs Today" only when it IS today — Nic: "Any other day than today, it
 *  should be saying 'On This Day'". */
export function dayWord(selectedDate: string, today: string): 'Today' | 'On This Day' {
  return selectedDate === today ? 'Today' : 'On This Day'
}

/** Where the ‹ › beside the heading go. The Drivers board shows one day, so
 *  it steps a day like List — before 2026-10-27 it had no case here and its
 *  arrows did nothing. */
export function stepDate(view: ScheduleView, date: string, dir: -1 | 1): string {
  if (view === 'week')  return shiftDate(date, dir * 7)
  if (view === 'month') return shiftMonth(date, dir)
  return shiftDate(date, dir)
}
