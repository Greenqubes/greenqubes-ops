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
      'The Installers list on a job is now called Drivers, and it only shows people ticked as Driver in Admin. Everyone else — including your other installers — is picked in the Support crew bucket just below it. Nobody was removed and no job lost its crew; four installers simply moved bucket.',
      'The FCFS board now shows driver rows only, for the same reason: drivers are what a booking is limited by.',
    ],
    added: [
      'Sales can close off their own jobs — the ones they are Person-in-Charge for. The overdue reminders go to the sales person, so they no longer get nagged about a job they cannot finish.',
      'Coordinators can close off jobs they are assigned to, for the same reason.',
      'Filter people by role when picking Person-in-Charge or Sub POC / Coordinators. Open the picker and choose a role to narrow the list, then type to search within it.',
    ],
    improved: [
      '"Mark job complete" now sits next to Save at the bottom of the job form.',
      'The row of buttons on a job no longer runs off the edge of a phone screen — it wraps onto a second line instead. Cancel is reachable again.',
    ],
    fixed: [
      'Sales could not add or remove coordinators on a job. It failed every time with "Save failed — try again", for every sales person, on every job.',
      'Sales edits to a job that was already on the schedule were thrown away silently while the screen said "Saved successfully". This affected every field, not only the date, and is why a changed date never appeared on the schedule.',
      'A job you had just closed still offered "Push to Schedule". Pressing it reported success without changing anything, and told the schedulers the job had been pushed. It now shows "Reopen job" instead, and refuses to push a finished job.',
      'When the system refuses a save, it now says so plainly instead of claiming the save worked. This one protects every screen, not just the ones above.',
    ],
    known: [
      'Nobody is notified when a scheduled job’s date is moved. The crew and the person-in-charge find out only by looking. A fix is being designed next session.',
    ],
  },
]

/** The date the reader must have seen for the popup to stay closed. */
export const LATEST_CHANGELOG_DATE = CHANGELOG[0]?.date ?? ''

/** Per-person, per-device marker — mirrors the tour's seen flag. */
export function changelogSeenKey(userId: string): string {
  return `changelog-seen:${userId}`
}
