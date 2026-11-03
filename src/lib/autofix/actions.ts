// What the bug bot may do when Nic asks — the rules, kept apart from the chat
// model. The model only picks WHICH action Nic meant; these functions decide
// WHETHER it is allowed, so a misread message can never put the wrong thing
// live. Each returns the plain-English reply Nic sees.

import type { ItemStatus } from './report-parse'

export type Note = { at: string; text: string; photos: string[] }

export type Item = {
  id:          string
  no:          number
  status:      ItemStatus
  verdict:     string | null
  severity:    'major' | 'minor' | null
  title:       string | null
  summary:     string | null
  reason:      string | null
  branch:      string | null
  head_sha:    string | null
  preview_url: string | null
  nic_notes:   Note[]
  attempts:    number
  live_at:     string | null
}

type Outcome = { ok: true } | { ok: false; reason: string }

export type ActionDeps = {
  findByNo(no: number): Promise<Item | null>
  update(id: string, patch: Partial<Item>): Promise<void>
  startGoLive(item: Item): Promise<Outcome>
  fireRetryNow(): Promise<Outcome>
  deleteBranch(branch: string): Promise<boolean>
  now(): string
}

const label = (it: Item) => (it.title ? ` (${it.title})` : '')
const notFound = (no: number) => `I couldn't find fix ${no}. Ask me "what's waiting" to see the list.`

export async function goLive(no: number, d: ActionDeps): Promise<string> {
  const it = await d.findByNo(no)
  if (!it) return notFound(no)
  switch (it.status) {
    case 'awaiting_nic': {
      const r = await d.startGoLive(it)
      if (!r.ok) return `Fix ${no} can't go live: ${r.reason}. Nothing changed on the live app.`
      return `Putting fix ${no}${label(it)} live now. I'll tell you the moment it's out — usually 2–3 minutes.`
    }
    case 'going_live':    return `Fix ${no} is already on its way live.`
    case 'live':          return `Fix ${no} is already live.`
    case 'needs_session': return `Fix ${no} needs a session with Claude, so it can't go live from here: ${it.reason ?? 'no reason recorded'}`
    case 'retry':
    case 'fixing':        return `Fix ${no} is being redone — I'll send a new test link when it's ready.`
    case 'dropped':       return `Fix ${no} was dropped. Say "try fix ${no} again" if you want it back.`
    case 'closed':
      return it.verdict === 'wish'
        ? `${no} is a wish, and wishes aren't built overnight — raise it in a session with Claude.`
        : `${no} was closed: ${it.reason ?? 'no reason recorded'}`
    default:              return `${no} hasn't been looked at yet — it's in tonight's run.`
  }
}

export async function tryAgain(no: number, note: string, photos: string[], now: boolean, d: ActionDeps): Promise<string> {
  const it = await d.findByNo(no)
  if (!it) return notFound(no)
  if (it.verdict === 'wish') {
    return `${no} is a wish, and wishes aren't built overnight — raise it in a session with Claude.`
  }
  if (it.status === 'going_live') {
    return `Fix ${no} is going live right now — wait for it to land, then tell me if it's still wrong.`
  }
  await d.update(it.id, {
    status:    'retry',
    nic_notes: [...it.nic_notes, { at: d.now(), text: note, photos }],
  })
  if (!now) return `Got it — I'll have another go at fix ${no} tonight with your note.`
  const r = await d.fireRetryNow()
  return r.ok
    ? `Got it — starting on fix ${no} again now. I'll message you when there's a new test link.`
    : `Got it — saved for tonight's run. I couldn't start it now: ${r.reason}.`
}

export async function drop(no: number, d: ActionDeps): Promise<string> {
  const it = await d.findByNo(no)
  if (!it) return notFound(no)
  if (it.status === 'live' || it.status === 'going_live') {
    return `Fix ${no} is already live, so I can't drop it from here. If it caused a problem, tell me and it goes to a session.`
  }
  await d.update(it.id, { status: 'dropped' })
  if (it.branch) await d.deleteBranch(it.branch)
  return `Dropped fix ${no}${label(it)}. Its test copy is removed.`
}

export async function runNow(d: ActionDeps): Promise<string> {
  const r = await d.fireRetryNow()
  return r.ok
    ? `Starting a run now — I'll message you when it's done.`
    : `I can't start a run right now: ${r.reason}.`
}
