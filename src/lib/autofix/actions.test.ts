/**
 * Standalone test for what the bug bot is allowed to do when Nic asks.
 * The chat model only chooses WHICH action; these rules decide WHETHER.
 * Run: npx tsx src/lib/autofix/actions.test.ts
 * Exits 1 on any failure.
 */

import { goLive, tryAgain, drop, runNow, type ActionDeps, type Item } from './actions'

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

function item(over: Partial<Item>): Item {
  return {
    id: 'i1', no: 12, status: 'awaiting_nic', verdict: 'fix', severity: 'minor',
    title: 'Today button overlaps', summary: 's', reason: 'r',
    branch: 'claude/autofix-20261105-today', head_sha: 'a'.repeat(40), preview_url: 'https://x.vercel.app',
    nic_notes: [], attempts: 1, live_at: null,
    ...over,
  }
}

function fake(start: Item | null, opts: { goLiveResult?: { ok: true } | { ok: false; reason: string }; fireResult?: { ok: true } | { ok: false; reason: string } } = {}) {
  const calls = { startGoLive: 0, fire: 0, deleteBranch: [] as string[], updates: [] as Partial<Item>[] }
  let current = start ? { ...start } : null
  const deps: ActionDeps = {
    findByNo: async no => (current && current.no === no ? current : null),
    update: async (_id, patch) => { calls.updates.push(patch); if (current) current = { ...current, ...patch } },
    startGoLive: async () => { calls.startGoLive++; return opts.goLiveResult ?? { ok: true } },
    fireRetryNow: async () => { calls.fire++; return opts.fireResult ?? { ok: true } },
    deleteBranch: async b => { calls.deleteBranch.push(b); return true },
    now: () => '2026-11-05T02:00:00.000Z',
  }
  return { deps, calls, get: () => current }
}

async function main() {
  // Unknown number.
  {
    const f = fake(null)
    const reply = await goLive(99, f.deps)
    check('unknown fix → says it cannot find it', reply.includes("couldn't find"), true)
  }

  // Go live: only from awaiting_nic, and only once.
  {
    const f = fake(item({}))
    const reply = await goLive(12, f.deps)
    check('awaiting_nic → startGoLive called once', f.calls.startGoLive, 1)
    check('awaiting_nic → reply says going live', reply.includes('live now'), true)
  }
  {
    const f = fake(item({ status: 'going_live' }))
    await goLive(12, f.deps)
    check('going_live → refused, startGoLive NOT called (double-send)', f.calls.startGoLive, 0)
  }
  {
    const f = fake(item({ status: 'needs_session', reason: 'changes src/components/Modal.tsx, which is off-limits' }))
    const reply = await goLive(12, f.deps)
    check('needs_session → refused', f.calls.startGoLive, 0)
    check('needs_session → reply carries the reason', reply.includes('Modal.tsx'), true)
  }
  {
    const f = fake(item({}), { goLiveResult: { ok: false, reason: 'the fix changed after you tested it' } })
    const reply = await goLive(12, f.deps)
    check('startGoLive refusal → reason passed on', reply.includes('changed after you tested'), true)
  }

  // Try again.
  {
    const f = fake(item({ verdict: 'wish', status: 'closed' }))
    const reply = await tryAgain(12, 'please build it', [], false, f.deps)
    check('wish → refused', f.calls.updates.length, 0)
    check('wish → says wishes are not built overnight', reply.includes('wish'), true)
  }
  {
    const f = fake(item({ status: 'going_live' }))
    await tryAgain(12, 'x', [], false, f.deps)
    check('going_live → refused', f.calls.updates.length, 0)
  }
  {
    const f = fake(item({}))
    const reply = await tryAgain(12, 'still cut off on my phone', ['PHOTO1'], false, f.deps)
    check('awaiting → status retry', f.get()?.status, 'retry')
    check('awaiting → note appended with photo', f.get()?.nic_notes, [{ at: '2026-11-05T02:00:00.000Z', text: 'still cut off on my phone', photos: ['PHOTO1'] }])
    check('now=false → no fire', f.calls.fire, 0)
    check('now=false → reply mentions tonight', reply.includes('tonight'), true)
  }
  {
    const f = fake(item({}))
    await tryAgain(12, 'x', [], true, f.deps)
    check('now=true → fired once', f.calls.fire, 1)
  }
  {
    const f = fake(item({}), { fireResult: { ok: false, reason: 'already ran 5 times today' } })
    const reply = await tryAgain(12, 'x', [], true, f.deps)
    check('now=true but capped → still saved for tonight', f.get()?.status, 'retry')
    check('now=true but capped → reason passed on', reply.includes('5 times today'), true)
  }
  {
    // Nic, 2026-11-05: after a few tries, flag it and stop — don't burn tokens.
    const f = fake(item({ status: 'needs_session', attempts: 3 }))
    const reply = await tryAgain(12, 'still broken', [], true, f.deps)
    check('tried 3 times already → no more tries', [f.calls.updates.length, f.calls.fire], [0, 0])
    check('…and Nic is told it needs a session', reply.includes('3 times') && reply.includes('session'), true)
  }

  // Drop.
  {
    const f = fake(item({}))
    await drop(12, f.deps)
    check('drop → status dropped', f.get()?.status, 'dropped')
    check('drop → branch deleted', f.calls.deleteBranch, ['claude/autofix-20261105-today'])
  }
  {
    const f = fake(item({ status: 'live' }))
    await drop(12, f.deps)
    check('drop on live → refused', f.calls.updates.length, 0)
  }
  {
    const f = fake(item({ status: 'going_live' }))
    await drop(12, f.deps)
    check('drop on going_live → refused', f.calls.updates.length, 0)
  }

  // Run now.
  {
    const f = fake(null)
    const reply = await runNow(f.deps)
    check('run now → fired', f.calls.fire, 1)
    check('run now → reply says starting', reply.includes('Starting'), true)
  }
  {
    const f = fake(null, { fireResult: { ok: false, reason: 'a run is already going' } })
    const reply = await runNow(f.deps)
    check('run now capped → reason passed on', reply.includes('already going'), true)
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed`)
    process.exit(1)
  }
  console.log('\nAll action checks passed')
}

main()
