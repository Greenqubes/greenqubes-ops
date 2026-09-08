// What's-new entries shown in the changelog popup.
//
// Written by hand at each session end (Nic, 2026-09-07) rather than generated
// from the bug_reports table: those messages are raw reporter wording, often
// duplicated, and carry the reporter's email — fine as a source to write FROM,
// not as something to show the whole team.
//
// ENGLISH ONLY, deliberately (Nic's call). Translating written prose into
// zh + bn every session is ongoing work, and bn is frozen. The popup's own
// chrome (title, buttons) is translated; these entries are not.
//
// Newest FIRST — the popup renders in array order and auto-opens when
// entries[0].date is newer than what the reader has already seen.
// Any section left out is skipped, heading and all.

export type ChangelogEntry = {
  /** ISO date, e.g. '2026-09-07'. Doubles as the "have they seen it" marker. */
  date: string
  /**
   * Release time, 24-hour 'HH:MM', Singapore time — shown beside the date as
   * h:mm AM/PM. Stored 24-hour so the AM/PM formatting happens in one place
   * instead of being hand-typed (and mistyped) per entry. Optional: older
   * entries without one just show the date.
   */
  time?: string
  /** Only when something CHANGES HOW PEOPLE WORK — shown first, highlighted. */
  headsUp?: string[]
  added?: string[]
  improved?: string[]
  fixed?: string[]
  /** Known problems still open. Honest, and stops repeat bug reports. */
  known?: string[]
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: '2026-09-07',
    time: '20:56',
    headsUp: [
      'The Installers list on a job is now Drivers, and shows only people ticked as Driver. Everyone else picks from Support crew just below it — nobody was removed and no job lost its crew.',
      'The FCFS board now shows driver rows only.',
    ],
    added: [
      'Sales can close off jobs they are Person-in-Charge for.',
      'Coordinators can close off jobs they are assigned to.',
      'Filter by role when picking a Person-in-Charge or Sub POC.',
    ],
    improved: [
      '"Mark job complete" now sits beside Save at the bottom of the job form.',
      'The job button row wraps on a phone instead of running off the screen.',
    ],
    fixed: [
      'Sales can add and remove coordinators on a job again.',
      'Sales edits to a job already on the schedule are no longer silently discarded.',
      'A closed job now offers "Reopen job" instead of pushing it to the schedule again.',
      'A save the system refuses now says so, instead of reporting success.',
    ],
    known: [
      'Nobody is notified when a scheduled job’s date moves — a fix is being designed.',
    ],
  },
]

/** The date the reader must have seen for the popup to stay closed. */
export const LATEST_CHANGELOG_DATE = CHANGELOG[0]?.date ?? ''

/** Per-person, per-device marker — mirrors the tour's seen flag. */
export function changelogSeenKey(userId: string): string {
  return `changelog-seen:${userId}`
}
