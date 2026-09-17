/**
 * The two 6pm Telegram summaries.
 *
 * Pure string building so the wording can be checked without sending
 * anything. Nic's sketch, 2026-09-14, answered 2026-09-15: TWO messages, not
 * one, because the audiences want different things — the scheduler wants the
 * whole day, an installer wants only their own.
 *
 * Both are sent as HTML, so every piece of user text goes through tgEscape.
 * A crafted job title could otherwise inject formatting or a fake link into
 * a Telegram message (audit hardening item, 2026-08-13).
 */

/** HTML-escape user text destined for a parse_mode:'HTML' message. */
export function tgEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/**
 * `17/09/2026 (Thu)` — the same shape the overdue bell cards use.
 *
 * Static English tables and a UTC-anchored Date, deliberately: date labels
 * are ALWAYS English in every language (CLAUDE.md hard rule), and a
 * toLocaleDateString call is what produced hydration error #418 on
 * /schedule. `templates.formatDate` gives "17 Sep 2026" with no day name —
 * useful in a one-line notification, not enough in a list someone scans.
 */
export function formatDayDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const day = DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y} (${day})`
}

const LINE = '────────────'

/**
 * Telegram refuses a sendMessage over 4096 characters outright.
 *
 * This is not theoretical: rendered against the real database on 2026-09-16,
 * a week of jobs came to **6,374 characters** — the message would have been
 * rejected and silently never arrived. Nic's 2026-09-15 alone was 18 jobs in
 * one day. A summary that fails on exactly the busiest days is worse than no
 * summary, because nobody notices it stopped.
 */
export const TELEGRAM_LIMIT = 4096

/**
 * Break a long message into sendable parts, at LINE boundaries.
 *
 * Splitting is done between lines, never inside one, because every line this
 * module emits carries its own balanced HTML tags — cutting mid-tag would
 * make Telegram reject the part for bad markup instead of length. A single
 * line longer than the limit (a pasted junk job title) is hard-cut as a last
 * resort, since there is nowhere safe to break it.
 */
export function splitForTelegram(text: string, limit: number = TELEGRAM_LIMIT): string[] {
  if (text.length <= limit) return [text]

  const parts: string[] = []
  let cur = ''

  for (const rawLine of text.split('\n')) {
    let line = rawLine
    // Nowhere safe to break inside one line — cut it rather than lose the
    // whole message.
    while (line.length > limit) {
      if (cur) { parts.push(cur); cur = '' }
      parts.push(line.slice(0, limit))
      line = line.slice(limit)
    }
    if (cur && cur.length + 1 + line.length > limit) { parts.push(cur); cur = line }
    else cur = cur ? `${cur}\n${line}` : line
  }
  if (cur) parts.push(cur)

  // Say which part this is, so a reader knows another is coming.
  return parts.map((p, i) => `${p}\n\n<i>(${i + 1}/${parts.length})</i>`)
}

export type UnassignedJob = {
  id: string; title: string; dateLabel: string
  location: string; createdBy: string; daysAway: number
}

/**
 * The scheduler's 4pm check: **every job still without a driver**.
 *
 * Nic's scheduler, 2026-09-17, in his own words — "at 4pm SGT it will cut off
 * and read whatever job that has not been arranged with installer/driver, he
 * will do it. regardless if the job is 5 days from now, 20 days from now or 1
 * month away. cuz by end of day before he leaves he will insert
 * installer/driver into all the job. then if still left unassigned, fire tmr
 * again until driver or installer is inserted."
 *
 * So: no look-ahead window, and it repeats daily until the gap is filled.
 * This replaced a full who-added-what roster, which listed everything and
 * therefore told him nothing he had to act on.
 *
 * Soonest first, because that is the order he will work through them. Each
 * line carries the date, the address and who entered the job — the address
 * because two jobs can share a title (his 18-duplicate order), and the
 * creator because that is who he would ask.
 *
 * Returns an ALL-CLEAR line rather than '' when nothing is missing: silence
 * would be indistinguishable from a broken bot, which is exactly how the
 * vault sync went unnoticed for 57 days.
 */
export function buildUnassignedSummary(p: {
  dateLabel: string
  appUrl:    string
  /** Grouped by the job's sales person (Nic, 2026-09-17) — the scheduler
   *  chases per person, so the message is ordered the way he works. Jobs
   *  inside a group run soonest first. */
  groups: Array<{ salesName: string; jobs: UnassignedJob[] }>
}): string {
  const total = p.groups.reduce((n, g) => n + g.jobs.length, 0)

  if (total === 0) {
    return `<b><u>Jobs still to arrange — ${tgEscape(p.dateLabel)}</u></b>\n\n`
      + '✅ Every upcoming job has a driver. Nothing outstanding.'
  }

  const parts = [
    `<b><u>Jobs still to arrange — ${tgEscape(p.dateLabel)}</u></b>`,
    '',
    `${total} job${total === 1 ? '' : 's'} with nobody assigned:`,
    '',
  ]

  for (const group of p.groups) {
    if (group.jobs.length === 0) continue
    parts.push(`<b>${tgEscape(group.salesName)}</b>`)
    group.jobs.forEach((j, i) => {
      const when = j.daysAway === 0 ? 'TODAY'
        : j.daysAway === 1 ? 'tomorrow'
        : `in ${j.daysAway} days`
      parts.push(`${i + 1}. <b>${tgEscape(j.title)}</b>`)
      parts.push(`   ${tgEscape(j.dateLabel)} — <b>${when}</b>`)
      if (j.location) parts.push(`   ${tgEscape(j.location)}`)
      parts.push(`   <a href="${p.appUrl}/jobs/${j.id}">Open</a>`)
    })
    parts.push(LINE)
  }

  parts.push('These will appear again tomorrow until someone is assigned.')
  return parts.join('\n')
}

const MONTHS_TIME = ['AM', 'PM']

/** `9 AM – 6 PM`, `9:30 AM – 11:15 AM`, `from 2 PM`, or `All day`. */
export function formatTimeRange(start: string | null, end: string | null): string {
  const one = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    const suffix = MONTHS_TIME[h >= 12 ? 1 : 0]
    const h12 = h % 12 || 12
    return m === 0 ? `${h12} ${suffix}` : `${h12}:${String(m).padStart(2, '0')} ${suffix}`
  }
  if (!start) return 'All day'
  if (!end)   return `from ${one(start)}`
  return `${one(start)} – ${one(end)}`
}

export type InstallerJobRow = {
  id: string; title: string; dateLabel: string
  role: 'driver' | 'support'; location: string
}

export type TomorrowRow = {
  id: string; title: string; timeLabel: string
  role: 'driver' | 'support'; location: string
  /** Everyone else on the job, so the line can be written from the reader's
   *  side: support crew are told who to follow, a driver is told who is
   *  following them (Nic, 2026-09-17). */
  driverNames:  string[]
  supportNames: string[]
  /** The job's Person-in-Charge — who the crew call if something is wrong on
   *  site (Nic, 2026-09-17). '' when the job has none. */
  pocName: string
}

/**
 * One installer's evening message: **where they are going tomorrow**, then
 * what changed for them today.
 *
 * Nic, 2026-09-17. It began as a change log alone, which left a hole: an
 * installer whose schedule did not change today got NO message, even with a
 * 9am tomorrow assigned three weeks ago — so silence meant both "nothing
 * changed" and "nobody told you about tomorrow". Tomorrow now leads, because
 * it is the thing he acts on tonight; the changes follow, whatever date they
 * fall on, so a move three weeks out is still heard about.
 *
 * Jobs dated TODAY are deliberately absent: those notify immediately when the
 * change is made, so by 6pm they are old news.
 *
 * Returns '' when there is nothing tomorrow AND nothing changed. The caller
 * must not send an empty message — "nothing happened" every evening is how
 * people learn to ignore a channel.
 */
export function buildInstallerSummary(p: {
  dateLabel:     string
  name:          string
  appUrl:        string
  tomorrowLabel: string
  tomorrow:      TomorrowRow[]
  added:         InstallerJobRow[]
  removed:       InstallerJobRow[]
}): string {
  if (p.tomorrow.length === 0 && p.added.length === 0 && p.removed.length === 0) return ''

  const parts = [`<b><u>Your jobs — ${tgEscape(p.dateLabel)}</u></b>`, '', `<b>${tgEscape(p.name)}</b>`]

  if (p.tomorrow.length > 0) {
    parts.push(`<u>TOMORROW — ${tgEscape(p.tomorrowLabel)}</u>`)
    p.tomorrow.forEach((r, i) => {
      parts.push(`${i + 1}. <b>${tgEscape(r.title)}</b>`)
      parts.push(`   ${tgEscape(r.timeLabel)}`)
      // The address is what tells two identically-titled jobs apart. Nic's
      // 18-duplicate order produced exactly that, and on a phone the title
      // alone is useless.
      if (r.location) parts.push(`   ${tgEscape(r.location)}`)

      // Written from the READER's side (Nic, 2026-09-17), replacing a
      // "— support crew" label that told them what they already knew:
      //   • support crew are told WHO TO FOLLOW
      //   • a driver is told WHO IS FOLLOWING THEM
      // Support crew with no driver yet is said out loud — that is a real
      // problem for them at 6pm, not a blank to be left out.
      if (r.role === 'support') {
        parts.push(`   Driver: ${r.driverNames.length > 0
          ? tgEscape(r.driverNames.join(', '))
          : '<b>nobody assigned yet</b>'}`)
      } else {
        const others = [...r.driverNames, ...r.supportNames]
        if (others.length > 0) parts.push(`   With you: ${tgEscape(others.join(', '))}`)
      }

      // Who to call if something is wrong on site (Nic, 2026-09-17). Said
      // plainly when there is nobody, because "who do I ring?" at 8am on a
      // job with no Person-in-Charge is exactly when it matters.
      parts.push(`   PIC: ${r.pocName ? tgEscape(r.pocName) : '<b>none set</b>'}`)

      parts.push(`   <a href="${p.appUrl}/jobs/${r.id}">Open</a>`)
    })
    parts.push(LINE)
  }

  const block = (heading: string, rows: InstallerJobRow[]) => {
    // A heading with nothing under it reads as an error. Only the sections
    // that have something appear.
    if (rows.length === 0) return
    parts.push(`<u>${heading}</u>`)
    rows.forEach((r, i) => {
      const as = r.role === 'support' ? ' — support crew' : ''
      parts.push(`${i + 1}. ${tgEscape(r.title)} — ${tgEscape(r.dateLabel)}${as}`)
      if (r.location) parts.push(`   ${tgEscape(r.location)}`)
      parts.push(`   <a href="${p.appUrl}/jobs/${r.id}">Open</a>`)
    })
    parts.push(LINE)
  }

  block('ADDED TO YOUR JOBS', p.added)
  block('TAKEN OFF',          p.removed)

  parts.push('END OF SUMMARY')
  return parts.join('\n')
}
