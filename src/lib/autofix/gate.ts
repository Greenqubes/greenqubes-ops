// The app's own measurement of a fix — run when the cloud reports it, and again
// the moment Nic says "go live". Never trusts the cloud's word on what it
// changed: GitHub's diff is measured against the limiter here.

import { checkLimits } from './limiter'
import { branchHeadSha, compareFiles, githubConfigured } from './github'

export type GateResult = { ok: true; files: number; lines: number } | { ok: false; reason: string }

export async function gateFix(branch: string, expectedHead: string): Promise<GateResult> {
  if (!githubConfigured()) {
    return { ok: false, reason: "the GitHub key isn't set up yet, so the size of the change can't be checked" }
  }
  const head = await branchHeadSha(branch)
  if (!head) return { ok: false, reason: 'its branch is missing on GitHub' }
  if (head !== expectedHead) return { ok: false, reason: 'the fix changed after it was checked' }
  const files = await compareFiles('main', branch)
  if (!files) return { ok: false, reason: "GitHub couldn't measure the change" }
  const lim = checkLimits(files)
  if (!lim.ok) return { ok: false, reason: `too big for an overnight fix — it ${lim.violations.join('; ')}` }
  return { ok: true, files: lim.files, lines: lim.lines }
}
