/**
 * Standalone test for the job-description translate rules (no test framework in this repo).
 * Run: npx tsx src/lib/ai/translate.test.ts
 * Exits 1 on any failure.
 */

import { translateTarget, translateSystemPrompt } from './translate'

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

// The profile language decides the target (Nic, 2026-09-28).
check('Chinese profile → Simplified Chinese', translateTarget('zh'), 'Simplified Chinese')
check('Bengali profile → Bengali (content, not UI text — the bn freeze does not apply)', translateTarget('bn'), 'Bengali')
// "english not necessary for translation" — no button, and the route refuses.
check('English profile → nothing to translate into', translateTarget('en'), null)
check('missing profile language → nothing', translateTarget(null), null)
check('undefined → nothing', translateTarget(undefined), null)
check('unknown code → nothing', translateTarget('fr'), null)

const zh = translateSystemPrompt('Simplified Chinese')
check('prompt names the target language', zh.includes('Simplified Chinese'), true)
check('prompt keeps dates/times/numbers as written', /dates.*times.*numbers/i.test(zh), true)
check('prompt keeps names and addresses as written', /names.*addresses/i.test(zh), true)
check('prompt asks for the translation only', /only the translation/i.test(zh), true)

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`)
process.exit(failures === 0 ? 0 : 1)
