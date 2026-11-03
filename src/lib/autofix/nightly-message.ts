// The one Telegram message Nic gets after a fixer run — plain English, no
// jargon (CLAUDE.md communication style). Wishes come in full (Nic: "together
// with the whole report"); junk and noise are a single closing line.
//
// Reporter-written text goes out in Telegram's HTML mode, so every string that
// came from a person or from the cloud is escaped here.

export type NightlyInput = {
  dateLabel:    string
  fixes:        { no: number; title: string; severity: 'major' | 'minor'; previewUrl: string }[]
  wishes:       { no: number; reporter: string; route: string; priority: string; message: string; reportedOn: string }[]
  needsSession: { no: number; title: string; reason: string }[]
  closed:       { junk: number; noise: number; known: number; repeats: number; alreadyFixed: string[] }
}

// Always English, always Singapore time (CLAUDE.md hard rule on dates).
const DAYS   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const sgt = (iso: string) => new Date(new Date(iso).getTime() + 8 * 60 * 60 * 1000)

/** 'Thu 5 Nov' */
export function dateLabel(iso: string): string {
  const d = sgt(iso)
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`
}

/** '7 Sep' */
export function shortDate(iso: string): string {
  const d = sgt(iso)
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function buildNightlyMessage(i: NightlyInput): string {
  const c = i.closed
  const closedParts = [
    c.junk    ? `${c.junk} junk` : '',
    c.noise   ? `${c.noise} connection blip${c.noise === 1 ? '' : 's'}` : '',
    c.known   ? `${c.known} known (left alone)` : '',
    c.repeats ? `${c.repeats} repeat${c.repeats === 1 ? '' : 's'}` : '',
    c.alreadyFixed.length ? `already fixed: ${c.alreadyFixed.map(escapeHtml).join(', ')}` : '',
  ].filter(Boolean)

  if (!i.fixes.length && !i.wishes.length && !i.needsSession.length && !closedParts.length) return ''

  const out: string[] = [`<b>Auto-fixer — ${escapeHtml(i.dateLabel)}</b>`]

  if (i.fixes.length) {
    out.push('', '<b>Fixes ready to try</b>')
    for (const f of i.fixes) {
      out.push(`<b>Fix ${f.no}</b> · ${f.severity} — ${escapeHtml(f.title)}`, `Try it: ${escapeHtml(f.previewUrl)}`)
    }
    const n = i.fixes[0].no
    out.push('', `Reply in your own words — e.g. "fix ${n} go live" or "fix ${n} still cut off on my phone".`)
  }

  if (i.wishes.length) {
    out.push('', '<b>Wishes (not built)</b>')
    for (const w of i.wishes) {
      out.push(
        `<b>Wish ${w.no}</b> — from ${escapeHtml(w.reporter)} on ${escapeHtml(w.route)} · ${escapeHtml(w.priority)} · ${escapeHtml(w.reportedOn)}`,
        `"${escapeHtml(w.message)}"`,
      )
    }
  }

  if (i.needsSession.length) {
    out.push('', '<b>Needs a session with Claude</b>')
    for (const s of i.needsSession) out.push(`<b>${s.no}</b> — ${escapeHtml(s.title)}: ${escapeHtml(s.reason)}`)
  }

  if (closedParts.length) out.push('', `Closed: ${closedParts.join(' · ')}`)

  return out.join('\n')
}
