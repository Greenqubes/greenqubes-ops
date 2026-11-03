/**
 * Standalone test for putting one fix live (final review, 2026-11-04):
 * claim before checking, merge the exact commit Nic tested, and never strand a
 * fix because a second message or a GitHub hiccup arrived at the wrong moment.
 * Run: npx tsx src/lib/autofix/go-live.test.ts
 * Exits 1 on any failure.
 */

import { startGoLiveWith, type GoLiveDeps } from './go-live-core'
import type { Item } from './actions'

let failures = 0

function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) {
    console.log(`  ✓ ${name}`)
  } else {
    console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`)
    failures++
  }
}

const SHA = 'a'.repeat(40)
const item = (over: Partial<Item> = {}): Item => ({
  id: 'i1', no: 12, status: 'awaiting_nic', verdict: 'fix', severity: 'minor',
  title: 'Today button overlaps', summary: 's', reason: null,
  branch: 'claude/autofix-20261105-today', head_sha: SHA, preview_url: 'https://x.vercel.app',
  nic_notes: [], attempts: 1, live_at: null, ...over,
})

function fake(opts: {
  claimWins?: boolean
  gate?: { ok: true; files: number; lines: number } | { ok: false; reason: string; transient: boolean }
  merge?: { result: 'merged'; sha: string } | { result: 'nothing' } | { result: 'conflict' } | { result: 'error'; detail: string }
} = {}) {
  const log: string[] = []
  const updates: Record<string, unknown>[] = []
  const merges: { base: string; head: string }[] = []
  const deps: GoLiveDeps = {
    claim: async () => { log.push('claim'); return opts.claimWins ?? true },
    gate: async () => { log.push('gate'); return opts.gate ?? { ok: true, files: 1, lines: 3 } },
    merge: async (base, head) => { log.push('merge'); merges.push({ base, head }); return opts.merge ?? { result: 'merged', sha: 'm'.repeat(40) } },
    update: async (_id, patch) => { updates.push(patch as Record<string, unknown>) },
    now: () => '2026-11-05T13:00:00.000Z',
  }
  return { deps, log, updates, merges }
}

async function main() {
  {
    const f = fake()
    const r = await startGoLiveWith(item(), f.deps)
    check('happy path → ok', r.ok, true)
    check('claims BEFORE it checks or merges', f.log, ['claim', 'gate', 'merge'])
    check('merges the exact commit Nic tested, not the branch name', f.merges, [{ base: 'main', head: SHA }])
    check('records the merge commit', f.updates, [{ merge_sha: 'm'.repeat(40) }])
  }
  {
    // Two "go live" messages close together: the loser must not touch anything.
    const f = fake({ claimWins: false })
    const r = await startGoLiveWith(item(), f.deps)
    check('second message loses the claim → refused', r.ok, false)
    check('…and never checks, merges or writes', [f.log, f.updates.length], [['claim'], 0])
  }
  {
    const f = fake()
    await startGoLiveWith(item({ status: 'needs_session' }), f.deps)
    check('not waiting for Nic → nothing at all', f.log, [])
  }
  {
    const f = fake({ gate: { ok: false, reason: 'too big for an overnight fix', transient: false } })
    const r = await startGoLiveWith(item(), f.deps)
    check('fails the limiter → needs a session', f.updates, [{ status: 'needs_session', reason: 'too big for an overnight fix' }])
    check('…and is not merged', f.merges.length, 0)
    check('…reason passed on', !r.ok && r.reason, 'too big for an overnight fix')
  }
  {
    const f = fake({ gate: { ok: false, reason: "GitHub couldn't be reached", transient: true } })
    await startGoLiveWith(item(), f.deps)
    check('GitHub hiccup while checking → handed back to Nic, not parked', f.updates, [{ status: 'awaiting_nic', going_live_at: null }])
  }
  {
    const f = fake({ merge: { result: 'conflict' } })
    await startGoLiveWith(item(), f.deps)
    check('clashes with newer work → needs a session', (f.updates[0] as { status: string }).status, 'needs_session')
  }
  {
    const f = fake({ merge: { result: 'error', detail: 'GitHub answered 503' } })
    await startGoLiveWith(item(), f.deps)
    check('GitHub refuses the merge → handed back to Nic', f.updates, [{ status: 'awaiting_nic', going_live_at: null }])
  }
  {
    const f = fake({ merge: { result: 'nothing' } })
    await startGoLiveWith(item(), f.deps)
    check('already on main → needs a session', (f.updates[0] as { status: string }).status, 'needs_session')
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed`)
    process.exit(1)
  }
  console.log('\nAll go-live checks passed')
}

main()
