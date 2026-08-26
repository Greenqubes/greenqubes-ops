/**
 * Standalone test for the tagger's response parsing (no test framework in this repo).
 * Run: npx tsx src/lib/ai/tagger.test.ts
 * Exits 1 on any failure.
 */

import { parseChatTag } from './tagger'

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

// 1. Full valid response parses through, including the new fields
const full = parseChatTag(JSON.stringify({
  topic: 'DAMA acrylic pricing', entities: ['DAMA'], tags: ['supplier', 'pricing'],
  importance: 4, visibility: ['role:sales'],
  summary: 'Nic asked for DAMA 5mm acrylic rates. Current price is $18/sqft with 5-day lead time.',
  meaningful: true,
}), false)
check('topic', full.topic, 'DAMA acrylic pricing')
check('summary', full.summary, 'Nic asked for DAMA 5mm acrylic rates. Current price is $18/sqft with 5-day lead time.')
check('meaningful', full.meaningful, true)
check('importance', full.importance, 4)

// 2. Missing new fields default safely (old-model responses, partial JSON)
const partial = parseChatTag('{"topic":"General","importance":2}', false)
check('missing summary defaults empty', partial.summary, '')
check('missing meaningful defaults false', partial.meaningful, false)

// 3. Malformed JSON falls back to safe defaults
const bad = parseChatTag('not json at all', false)
check('fallback topic', bad.topic, 'General')
check('fallback meaningful', bad.meaningful, false)
check('fallback summary', bad.summary, '')
check('fallback importance', bad.importance, 2)

// 4. D-Promote forces importance 5 but does NOT force meaningful
const promoted = parseChatTag('{"topic":"T","importance":1,"meaningful":false}', true)
check('forcePromote importance', promoted.importance, 5)
check('forcePromote leaves meaningful', promoted.meaningful, false)

// 5. Non-boolean meaningful / non-string summary are ignored
const wrongTypes = parseChatTag('{"meaningful":"yes","summary":42}', false)
check('non-boolean meaningful', wrongTypes.meaningful, false)
check('non-string summary', wrongTypes.summary, '')

// 6. JSON wrapped in prose still parses (the regex extraction path)
const wrapped = parseChatTag('Here you go: {"topic":"Wrapped","meaningful":true,"summary":"S"} done', false)
check('wrapped topic', wrapped.topic, 'Wrapped')
check('wrapped meaningful', wrapped.meaningful, true)

if (failures > 0) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nAll tagger parse checks passed')
