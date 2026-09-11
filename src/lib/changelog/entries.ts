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
    date: '2026-09-11',
    // Its own entry rather than added to the 10th on purpose: the popup only
    // reopens when the newest DATE is one the reader has not seen, and the
    // whole point of this entry is that everyone reads the log-in line.
    time: '00:00',
    headsUp: [
      '**LOG OUT AND LOG IN AGAIN** once, to switch on automatic updates.',
      'After that the app updates itself — if you are mid-typing it waits and shows a bar to tap.',
    ],
    improved: [
      'What\'s new is twice as wide on a computer.',
      'Older releases fold away here — tap a date to open it.',
    ],
  },
  {
    date: '2026-09-10',
    // 19:35 SGT — bumped from 18:46 when the second release of the day landed
    // (auto-refresh + the assistant scoring lines), per the one-entry-per-date
    // rule. Decoded from the production deployment's own x-vercel-id epoch
    // (UTC+8), probed after it landed. Never from a shell clock: this machine
    // reports MPST and `TZ=Asia/Singapore date` silently returns UTC.
    time: '19:35',
    headsUp: [
      'A job cannot go on the schedule until title, date, company, client, contact number and address are filled.',
      'Those details can be changed later, but not left empty.',
      'The app now updates itself — if you are mid-typing it waits and shows a bar to tap.',
    ],
    added: [
      'Start typing an address and pick it from the list — unit number and postcode fill in.',
      'Open Maps button beside the address.',
      'Call button beside the client contact number.',
      'End Date on a job, so it shows on every day it runs.',
    ],
    improved: [
      'Duplicating a job now copies the address too.',
      'Jobs with no start time are always a flexible window.',
      'Error messages sit beside the field name, in red.',
      'Knowledge saved from the assistant can now be filed for every role, not four.',
      'Anything about a person\'s leave, pay or medical matters stays with HR.',
    ],
    fixed: [
      'The Monday digest no longer offers to save answers the knowledge base already had.',
    ],
  },
  {
    date: '2026-09-09',
    // Bumped, not duplicated — one entry per DATE, so the popup does not
    // re-nag anyone who already read today's release.
    // 15:24 = the Vercel PRODUCTION deployment time for this release, read
    // off the deployment itself. Do NOT compute it with
    // `TZ=Asia/Singapore date` — that silently returns UTC in this shell and
    // put 07:33 here first (see CLAUDE.md session-end step 4).
    time: '15:24',
    headsUp: [
      'The schedule now shows who is on leave and every public holiday, to everyone.',
      'Everyone sees who is away — only HR and the admin can see the reason.',
      'A new HR / Finance role can see every job\'s prices, view-only.',
    ],
    added: [
      'HR / Finance role, with its own Leave page and read-only job pages.',
      'Leave records with morning and afternoon half days, kept by HR.',
      'Putting someone on a job while they are on leave now warns in red.',
      'Company events like a retreat show across every day they run.',
      'Singapore public holidays for 2026 appear on the schedule.',
    ],
    improved: [
      'Buttons and status labels now read properly instead of all lowercase.',
      'The Leave page fits a phone screen when adding or editing an entry.',
    ],
  },
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
