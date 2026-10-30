// Client Contact No. auto-fill from past jobs (Nic, 2026-10-27/30): picking a
// Client Name on the job form brings back the number last typed for that
// person at that company. No new table — the numbers already live on jobs.
// The lookup runs in /api/clients/last-phone on the caller's own session, so
// it only ever sees jobs they could open anyway (private drafts stay hidden).

export interface PastClientJob {
  id: string
  client: string | null
  client_poc_name: string | null
  client_poc_phone: string | null
  date: string | null
  created_at: string
}

/** `date` is the job's install date, or the day it was made when it has none
 *  yet (an Ongoing job) — always YYYY-MM-DD. */
export interface LastNumber { phone: string; date: string }

/** Whose number is in the box: a client name is only unique within a company. */
export interface ClientPerson { company: string; name: string }

export type PhoneHint =
  /** Grey line under the box: "From David's last job, 12 Oct 2026". */
  | { kind: 'filled'; name: string; date: string }
  /** The new person has no past number — offer back the one just cleared. */
  | { kind: 'reuse'; name: string; phone: string }
  /** A number was typed before any name was picked — never overwrite it,
   *  offer the picked person's last number instead. */
  | { kind: 'offer'; name: string; phone: string }

const norm = (s: string | null | undefined) => (s ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
const digits = (s: string) => s.replace(/\D/g, '')

/** Same company or person name, ignoring capitals and spacing. Blank never
 *  matches — a job with no client name must not be anyone's last job. */
export function sameName(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = norm(a)
  return x !== '' && x === norm(b)
}

/** A loose ILIKE pattern that narrows the database read; `sameName` makes the
 *  exact call afterwards. Words joined by % so "BINJAI  INTERIOR" (two spaces)
 *  still matches, with % and _ escaped so they are searched for literally. */
export function likePattern(s: string): string {
  const words = s.trim().split(/\s+/).map(w => w.replace(/[\\%_]/g, '\\$&'))
  return `%${words.join('%')}%`
}

/** The number on the newest job (by when it was made) for this person at this
 *  company. Newest by creation, not by last edit: completing an old job bumps
 *  its edit time, and its number may be years out of date. */
export function lastNumberFor(
  jobs: PastClientJob[], company: string, name: string, excludeId?: string,
): LastNumber | null {
  let best: PastClientJob | null = null
  for (const j of jobs) {
    if (j.id === excludeId) continue
    if (!(j.client_poc_phone ?? '').trim()) continue
    if (!sameName(j.client, company) || !sameName(j.client_poc_name, name)) continue
    if (!best || j.created_at > best.created_at) best = j
  }
  if (!best) return null
  return { phone: best.client_poc_phone!.trim(), date: best.date ?? best.created_at.slice(0, 10) }
}

/**
 * What the Client Contact No. box does when a Client Name is picked.
 * `previous` is whose number the box held — the client name picked before,
 * remembered across a company change; null when nobody was picked yet.
 * `phone` undefined = leave the box alone; '' = empty it.
 */
export function phoneAfterPick({ previous, next, current, found }: {
  previous: ClientPerson | null
  next:     ClientPerson
  current:  string
  found:    LastNumber | null
}): { phone?: string; hint: PhoneHint | null } {
  const box = current.trim()
  const switched = previous !== null
    && !(sameName(previous.company, next.company) && sameName(previous.name, next.name))

  if (found) {
    // An empty box, or the number belonged to the person just switched away from.
    if (!box || switched) {
      return { phone: found.phone, hint: { kind: 'filled', name: next.name, date: found.date } }
    }
    // Typed by hand (or the same person picked again): theirs to keep.
    if (digits(found.phone) === digits(box)) return { hint: null }
    return { hint: { kind: 'offer', name: next.name, phone: found.phone } }
  }

  // Nic: "if david has no number, drop it into suggestion to ask user if want
  // to reuse cynthia number instead".
  if (switched && box) {
    return { phone: '', hint: { kind: 'reuse', name: previous!.name, phone: current.trim() } }
  }
  return { hint: null }
}
