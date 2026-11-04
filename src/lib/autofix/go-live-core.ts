// The order of the go-live steps, kept apart from GitHub and the database so
// it can be tested (final review, 2026-11-04):
//
// 1. CLAIM first (awaiting_nic → going_live, compare-and-set). Whoever wins
//    owns the outcome; a second "go live" message touches nothing.
// 2. Then CHECK — the branch still points at the commit Nic tested, and that
//    commit is still inside the limiter.
// 3. If the live app has changed IN THE SAME FILES since the fix was cut, what
//    would go live is a combination nobody tested — send it back for a fresh
//    test copy on top of the latest version instead (Nic, 2026-11-05). Changes
//    elsewhere leave the fix exactly as tested, so it goes ahead.
// 4. Then MERGE THE COMMIT, not the branch name — so a push to the branch
//    after the check can never ride along unchecked.
// A GitHub hiccup (or an expired key) hands the fix back to Nic to ask again;
// only a real problem with the fix parks it for a session.

import type { Item } from './actions'
import type { GateResult } from './gate'
import type { MergeResult } from './github'
import { GO_LIVE_TIMEOUT_MINUTES } from './scheduling'

type Outcome = { ok: true } | { ok: false; reason: string }

export type GoLiveDeps = {
  claim(id: string, from: 'awaiting_nic', patch: { status: 'going_live'; going_live_at: string }): Promise<boolean>
  gate(branch: string, headSha: string): Promise<GateResult>
  /** Files changed on main since the fix's commit branched off; null = GitHub couldn't say. */
  mainChangedSince(headSha: string): Promise<string[] | null>
  merge(base: string, head: string, message: string): Promise<MergeResult>
  update(id: string, patch: Record<string, unknown>): Promise<unknown>
  /** Start a fixer run now, for a fix sent back for a fresh test copy. */
  refresh(): Promise<Outcome>
  now(): string
}

const handBack = { status: 'awaiting_nic', going_live_at: null }

export async function startGoLiveWith(item: Item, d: GoLiveDeps): Promise<Outcome> {
  if (item.status !== 'awaiting_nic' || !item.branch || !item.head_sha) {
    return { ok: false, reason: "it isn't waiting for you" }
  }
  if (!(await d.claim(item.id, 'awaiting_nic', { status: 'going_live', going_live_at: d.now() }))) {
    return { ok: false, reason: "it's already on its way" }
  }

  const gate = await d.gate(item.branch, item.head_sha)
  if (!gate.ok) {
    if (gate.transient) {
      await d.update(item.id, handBack)
      return { ok: false, reason: `${gate.reason} — nothing changed; you can ask again in a bit` }
    }
    await d.update(item.id, { status: 'needs_session', reason: gate.reason })
    return { ok: false, reason: gate.reason }
  }

  const mainFiles = await d.mainChangedSince(item.head_sha)
  if (mainFiles === null) {
    await d.update(item.id, handBack)
    return { ok: false, reason: "GitHub couldn't say what has changed on the live app — nothing changed; you can ask again in a bit" }
  }
  const overlap = gate.paths.filter(p => mainFiles.includes(p))
  if (overlap.length > 0) {
    await d.update(item.id, {
      status:        'retry',
      going_live_at: null,
      nic_notes:     [...item.nic_notes, {
        at:     d.now(),
        text:   `The live app has changed in the same place since this fix was made (${overlap.join(', ')}). Redo the fix on top of the latest version.`,
        photos: [],
      }],
    })
    const r = await d.refresh()
    return {
      ok: false,
      reason: "the live app has changed in the same place since this fix was made, so I'm making a fresh test copy on top of the latest version — you'll get a new link to check" +
        (r.ok ? '' : ` (it will run tonight: ${r.reason})`),
    }
  }

  const merge = await d.merge('main', item.head_sha, `fix(autofix): ${item.title ?? 'fix'} (#${item.no}, Nic via Telegram)`)
  switch (merge.result) {
    case 'merged':
      await d.update(item.id, { merge_sha: merge.sha })
      return { ok: true }
    case 'conflict': {
      const reason = 'its change clashes with newer work on the live app, so it needs a session'
      await d.update(item.id, { status: 'needs_session', reason })
      return { ok: false, reason }
    }
    case 'nothing': {
      const reason = 'its change is already part of the live app — nothing to put live'
      await d.update(item.id, { status: 'needs_session', reason })
      return { ok: false, reason }
    }
    default:
      await d.update(item.id, handBack)
      return { ok: false, reason: `GitHub refused the update (${merge.detail}); you can ask again later` }
  }
}

/**
 * After the merge, what production is telling us. 'failed' means the update
 * didn't build: production stays on the old version, but main now holds a
 * change that doesn't build — the next session must deal with it first.
 */
export function goingLiveDecision(x: {
  version:      string | null
  mergeBuildId: string | null
  deployState:  'success' | 'failure' | 'pending' | 'unknown'
  ageMin:       number
}): 'live' | 'failed' | 'timeout' | 'wait' {
  if (x.version && x.mergeBuildId && x.version === x.mergeBuildId) return 'live'
  if (x.deployState === 'success') return 'live'
  if (x.deployState === 'failure') return 'failed'
  if (x.ageMin > GO_LIVE_TIMEOUT_MINUTES) return 'timeout'
  return 'wait'
}
