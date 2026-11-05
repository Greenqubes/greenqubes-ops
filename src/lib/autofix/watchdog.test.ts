/**
 * Standalone test for the fixer watchdog (final review, 2026-11-04): a slow
 * run gets ONE heads-up to Nic and is otherwise left alone, so its report is
 * still accepted when it arrives — a long first night must not be thrown away.
 * Run: npx tsx src/lib/autofix/watchdog.test.ts
 * Exits 1 on any failure.
 */

import { alertStaleRuns, type WatchdogDeps } from './watchdog'

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

async function main() {
  const told: string[] = []
  const alerted: string[] = []
  const deps: WatchdogDeps = {
    stale: async () => [
      { id: 'r1', kind: 'nightly', fired_at: '2026-11-05T18:00:00Z', session_url: 'https://claude.ai/code/session_1', finished_at: null, outcome: null, alerted: false },
    ],
    markAlerted: async id => { alerted.push(id) },
    tell: async text => { told.push(text); return true },
  }
  const n = await alertStaleRuns(deps)
  check('one stale run handled', n, 1)
  check('marked alerted so Nic hears once', alerted, ['r1'])
  check('Nic is told, with the run log link', told.length === 1 && told[0].includes('https://claude.ai/code/session_1'), true)
  check('…in words that say it is still allowed to finish', told[0].includes('still going'), true)
  // The deps deliberately offer no way to finish the run: a late report must still land.
  check('no finish capability exists', Object.keys(deps).sort(), ['markAlerted', 'stale', 'tell'])

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed`)
    process.exit(1)
  }
  console.log('\nAll watchdog checks passed')
}

main()
