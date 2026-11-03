// Waking the cloud fixer — a Claude Code scheduled task with an API trigger
// only, so the app decides when it runs and quiet nights cost Nic's plan
// nothing. The fire text is just the run id: the cloud fetches its real work
// list from /api/autofix/inbox, never from this text (the routine treats fire
// text as untrusted, and so do we).

import { canFire } from './scheduling'
import {
  createRun, finishRun, setRunSession, firesTodaySgt, runInFlight,
  newBugReports, retryItems, unattachedCrashes,
} from './store'

const FIRE_URL = (id: string) => `https://api.anthropic.com/v1/claude_code/routines/${id}/fire`

export function fixerConfigured(): boolean {
  return !!(process.env.AUTOFIX_ROUTINE_ID && process.env.AUTOFIX_ROUTINE_TOKEN && process.env.AUTOFIX_SECRET)
}

export async function pendingWorkCount(): Promise<number> {
  const [bugs, crashes, retries] = await Promise.all([newBugReports(), unattachedCrashes(), retryItems()])
  return bugs.length + crashes.length + retries.length
}

export async function fireFixer(kind: 'nightly' | 'retry'): Promise<{ ok: true; runId: string } | { ok: false; reason: string }> {
  if (!fixerConfigured()) return { ok: false, reason: "the fixer isn't set up yet" }

  const [pendingWork, firesToday, inFlight] = await Promise.all([pendingWorkCount(), firesTodaySgt(), runInFlight()])
  const gate = canFire({ pendingWork, firesToday, runInFlight: inFlight })
  if (!gate.fire) return { ok: false, reason: gate.why }

  const runId = await createRun(kind)
  if (!runId) return { ok: false, reason: "couldn't record the run" }

  try {
    const res = await fetch(FIRE_URL(process.env.AUTOFIX_ROUTINE_ID!), {
      method:  'POST',
      headers: {
        Authorization:       `Bearer ${process.env.AUTOFIX_ROUTINE_TOKEN}`,
        'anthropic-version': '2023-06-01',
        'Content-Type':      'application/json',
      },
      body: JSON.stringify({ text: `run ${runId}` }),
    })
    if (!res.ok) {
      await finishRun(runId, `fire-failed: ${res.status}`)
      return { ok: false, reason: `Claude's cloud refused to start (${res.status})` }
    }
    const body = await res.json() as { claude_code_session_url?: string }
    await setRunSession(runId, body.claude_code_session_url ?? null)
    return { ok: true, runId }
  } catch (e) {
    await finishRun(runId, 'fire-failed: network')
    console.error('[autofix] fire failed', e)
    return { ok: false, reason: "couldn't reach Claude's cloud" }
  }
}
