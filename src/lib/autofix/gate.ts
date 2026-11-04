// The app's own measurement of a fix — run when the cloud reports it, and again
// the moment Nic says "go live". Never trusts the cloud's word on what it
// changed: GitHub's diff of the exact commit is measured against the limiter.

import { checkLimits } from './limiter'
import { branchHead, compareFiles, githubConfigured } from './github'

/**
 * `transient` = GitHub couldn't answer (key missing or expired, outage, rate
 * limit). Nothing is wrong with the fix; it should be tried again, not parked.
 */
export type GateResult =
  | { ok: true; files: number; lines: number; paths: string[] }
  | { ok: false; reason: string; transient: boolean }

export async function gateFix(branch: string, expectedHead: string): Promise<GateResult> {
  if (!githubConfigured()) {
    return { ok: false, transient: true, reason: "the GitHub key isn't set up yet, so the size of the change can't be checked" }
  }
  const head = await branchHead(branch)
  if (head.kind === 'error')   return { ok: false, transient: true,  reason: "GitHub couldn't be reached to check the fix" }
  if (head.kind === 'missing') return { ok: false, transient: false, reason: 'its branch is missing on GitHub' }
  if (head.sha !== expectedHead) return { ok: false, transient: false, reason: 'the fix changed after it was checked' }
  // Measure the exact commit, never the branch name — the branch could move.
  const files = await compareFiles('main', expectedHead)
  if (!files) return { ok: false, transient: true, reason: "GitHub couldn't measure the change" }
  const lim = checkLimits(files)
  if (!lim.ok) return { ok: false, transient: false, reason: `too big for an overnight fix — it ${lim.violations.join('; ')}` }
  return { ok: true, files: lim.files, lines: lim.lines, paths: files.map(f => f.filename) }
}
