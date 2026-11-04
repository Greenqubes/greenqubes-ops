/**
 * Standalone test for auto-fixer progress on request (Nic, 2026-11-05: ask the
 * bot "how's it going?" mid-run instead of getting automatic pings).
 * Run: npx tsx src/lib/autofix/progress.test.ts
 * Exits 1 on any failure.
 */

import { parseProgress, progressReply } from './progress'

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

// ── what the cloud fixer may send ──
check('valid note', parseProgress({ runId: 'r1', note: 'Sorted 22 — fixing 1 of 2' }), { ok: true, runId: 'r1', note: 'Sorted 22 — fixing 1 of 2' })
check('note trimmed', parseProgress({ runId: 'r1', note: '  Started  ' }), { ok: true, runId: 'r1', note: 'Started' })
check('empty note → refused', parseProgress({ runId: 'r1', note: '   ' }).ok, false)
check('note over 200 characters → refused', parseProgress({ runId: 'r1', note: 'x'.repeat(201) }).ok, false)
check('missing run id → refused', parseProgress({ note: 'x' }).ok, false)
check('not an object → refused', parseProgress('hello').ok, false)

// ── what the bot answers ──
const NOW = '2026-11-04T15:40:00.000Z'
check('no run ever → says so',
  progressReply(null, NOW), "There's no fixer run on record yet.")
check('a run going → how long, and the latest note',
  progressReply({ fired_at: '2026-11-04T15:10:00.000Z', finished_at: null, outcome: 'Sorted 22 — fixing 1 of 2' }, NOW),
  'A run is going — started 30 minutes ago. Latest: Sorted 22 — fixing 1 of 2')
check('a run going with no note yet → getting started',
  progressReply({ fired_at: '2026-11-04T15:39:00.000Z', finished_at: null, outcome: null }, NOW),
  'A run is going — started 1 minute ago. Latest: getting started.')
check('nothing going → when the last one finished (Singapore time)',
  progressReply({ fired_at: '2026-11-04T14:00:00.000Z', finished_at: '2026-11-04T14:52:00.000Z', outcome: 'reported' }, NOW),
  'No run is going right now. The last one finished at 10:52pm.')
check('the last one failed to start → says so plainly',
  progressReply({ fired_at: '2026-11-04T14:00:00.000Z', finished_at: '2026-11-04T14:00:05.000Z', outcome: 'fire-failed: 401' }, NOW),
  "No run is going right now. The last one couldn't start (10:00pm).")

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`)
  process.exit(1)
}
console.log('\nAll progress checks passed')
