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

export function buildSchedulerSummary(p: {
  dateLabel: string
  appUrl:    string
  roster: Array<{
    name: string
    jobs: Array<{ id: string; title: string; driverNames: string[] }>
  }>
}): string {
  const parts = [`<b><u>End of Day Summary (${tgEscape(p.dateLabel)})</u></b>`, '']

  for (const person of p.roster) {
    parts.push(`<b>${tgEscape(person.name)}</b>`)
    if (person.jobs.length === 0) {
      // Everyone is listed whether or not they added anything — Nic's sketch
      // shows an unchanging roster, not just whoever happened to be busy.
      parts.push('<u>NO JOBS ADDED</u>')
    } else {
      parts.push('<u>JOBS ADDED</u>')
      person.jobs.forEach((job, i) => {
        const who = job.driverNames.length > 0
          ? tgEscape(job.driverNames.join(', '))
          : '<b>Unassigned</b>'
        parts.push(`${i + 1}. ${tgEscape(job.title)} (${who})`)
        parts.push(`   <a href="${p.appUrl}/jobs/${job.id}">Open</a>`)
      })
    }
    parts.push(LINE)
  }

  parts.push('END OF SUMMARY')
  return parts.join('\n')
}

export function buildInstallerSummary(p: {
  dateLabel: string
  name:      string
  appUrl:    string
  added:   Array<{ id: string; title: string; dateLabel: string; role: 'driver' | 'support' }>
  removed: Array<{ id: string; title: string; dateLabel: string; role: 'driver' | 'support' }>
}): string {
  const parts = [`<b><u>Your jobs — ${tgEscape(p.dateLabel)}</u></b>`, '', `<b>${tgEscape(p.name)}</b>`]

  const block = (heading: string, rows: typeof p.added) => {
    // A heading with nothing under it reads as an error. Only the sections
    // that have something appear.
    if (rows.length === 0) return
    parts.push(`<u>${heading}</u>`)
    rows.forEach((r, i) => {
      const as = r.role === 'support' ? ' — support crew' : ''
      parts.push(`${i + 1}. ${tgEscape(r.title)} — ${tgEscape(r.dateLabel)}${as}`)
      parts.push(`   <a href="${p.appUrl}/jobs/${r.id}">Open</a>`)
    })
    parts.push(LINE)
  }

  block('ADDED TO YOUR JOBS', p.added)
  block('TAKEN OFF',          p.removed)

  parts.push('END OF SUMMARY')
  return parts.join('\n')
}
