// Auto-fixer progress on request (Nic, 2026-11-05): during a run the cloud
// fixer posts a one-line note at each milestone; nothing is sent to Nic until
// he asks the bot "how's it going?". No automatic pings — he didn't want the
// chat flooded.
//
// The note lives in the run's existing `outcome` field while the run is
// going; when the run finishes, its final result replaces it. So the note is
// temporary by design and nothing extra is stored.

import { clock12 } from './nightly-message'

type Obj = Record<string, unknown>
const isObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x)

export function parseProgress(body: unknown): { ok: true; runId: string; note: string } | { ok: false; error: string } {
  if (!isObj(body)) return { ok: false, error: 'body must be an object' }
  if (typeof body.runId !== 'string' || !body.runId.trim() || body.runId.length > 64) return { ok: false, error: 'runId missing' }
  const note = typeof body.note === 'string' ? body.note.trim() : ''
  if (!note) return { ok: false, error: 'note missing' }
  if (note.length > 200) return { ok: false, error: 'note over 200 characters' }
  return { ok: true, runId: body.runId, note }
}

export type RunLike = { fired_at: string; finished_at: string | null; outcome: string | null }

/** The bot's plain-English answer to "how's it going?". */
export function progressReply(run: RunLike | null, nowIso: string): string {
  if (!run) return "There's no fixer run on record yet."
  if (!run.finished_at) {
    const mins = Math.max(0, Math.floor((new Date(nowIso).getTime() - new Date(run.fired_at).getTime()) / 60_000))
    const ago = `${mins} minute${mins === 1 ? '' : 's'} ago`
    return `A run is going — started ${ago}. Latest: ${run.outcome?.trim() || 'getting started.'}`
  }
  if (run.outcome?.startsWith('fire-failed') || run.outcome?.startsWith('setup')) {
    return `No run is going right now. The last one couldn't start (${clock12(run.fired_at)}).`
  }
  return `No run is going right now. The last one finished at ${clock12(run.finished_at)}.`
}
