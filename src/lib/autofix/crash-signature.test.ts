/**
 * Standalone test for crash grouping — 24 copies of one crash are one problem.
 * Run: npx tsx src/lib/autofix/crash-signature.test.ts
 * Exits 1 on any failure.
 */

import { crashSignature, normaliseRoute, groupCrashes, deviceOf, deviceLabel, type CrashRow } from './crash-signature'

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

const UUID_A = '219281ad-cf2b-450f-b8d3-591624c4b47c'
const UUID_B = '384add25-5278-4fd2-96e7-d31262cbc5b2'

check('route uuid → :id', normaliseRoute(`/jobs/${UUID_A}`), '/jobs/:id')
check('route digits → :n, query dropped', normaliseRoute('/fcfs/2026?x=1#top'), '/fcfs/:n')

check('same crash on two different jobs → one signature',
  crashSignature("Cannot read properties of undefined (reading 'localeCompare')", `/jobs/${UUID_A}`),
  crashSignature("Cannot read properties of undefined (reading 'localeCompare')", `/jobs/${UUID_B}`))

const chunkA = 'Loading chunk 5942 failed. (error: https://greenqubes-ops.vercel.app/_next/static/chunks/5942-827e485e17a89332.js?dpl=dpl_Cbfp5QiQm4az2u6NZp)'
const chunkB = 'Loading chunk 77 failed. (error: https://greenqubes-ops.vercel.app/_next/static/chunks/77-0a1b2c3d4e5f6a7b.js?dpl=dpl_Other)'
check('chunk failures with different chunks and deploys → one signature',
  crashSignature(chunkA, '/jobs/x'), crashSignature(chunkB, '/jobs/x'))

check('different messages → different signatures',
  crashSignature('Error in input stream', '/schedule') === crashSignature('network error', '/schedule'), false)

check('whitespace collapsed',
  crashSignature('Error   in\n input stream', '/schedule'), crashSignature('Error in input stream', '/schedule'))

check('signature shape', crashSignature('Error in input stream', '/schedule'), 'Error in input stream @ /schedule')

const row = (id: string, at: string, msg: string, route: string, ua: string | null): CrashRow => ({
  id, occurred_at: at, route, error_message: msg, stack_trace: `at ${id}`, component_stack: null, user_agent: ua, build_id: null,
})
const PC    = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
const PHONE = 'Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36'
const groups = groupCrashes([
  row('1', '2026-10-01T01:00:00Z', 'Error in input stream', '/schedule', PC),
  row('2', '2026-10-03T01:00:00Z', 'Error in input stream', '/schedule', PHONE),
  row('3', '2026-10-02T01:00:00Z', 'network error', '/completed', PC),
])
check('two signatures → two groups', groups.length, 2)
check('biggest group first', groups[0].count, 2)
check('first seen', groups[0].firstSeen, '2026-10-01T01:00:00Z')
check('last seen', groups[0].lastSeen, '2026-10-03T01:00:00Z')
check('row ids kept', groups[0].rowIds, ['1', '2'])
check('phones / pcs counted', [groups[0].phones, groups[0].pcs], [1, 1])
check('sample is the newest row', groups[0].sample.stackTrace, 'at 2')

check('iPhone → Phone', deviceOf('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148'), 'Phone')
check('iPad → Tablet', deviceOf('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)'), 'Tablet')
check('Android phone → Phone', deviceOf(PHONE), 'Phone')
check('Windows Chrome → PC', deviceOf(PC), 'PC')
check('null → Unknown', deviceOf(null), 'Unknown')
check('label for a PC', deviceLabel(PC), 'PC · Chrome 141 · Windows')
check('label for an Android phone', deviceLabel(PHONE), 'Phone · Chrome 141 · Android')
check('label for null', deviceLabel(null), 'Unknown device')

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`)
  process.exit(1)
}
console.log('\nAll crash-signature checks passed')
