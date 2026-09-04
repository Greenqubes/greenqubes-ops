/**
 * Standalone test for the markdown → speakable-text stripper.
 * Run: npx tsx src/features/voice/speakable.test.ts
 * Exits 1 on any failure.
 */
import { toSpeakable } from './speakable'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) { console.log(`  ✓ ${name}`) }
  else { console.error(`  ✗ ${name}\n      expected: ${JSON.stringify(expected)}\n      actual:   ${JSON.stringify(actual)}`); failures++ }
}

check('plain text unchanged', toSpeakable('The job is on Tuesday at 2pm.'), 'The job is on Tuesday at 2pm.')
check('bold stripped', toSpeakable('**Fossil** at *VivoCity*'), 'Fossil at VivoCity')
check('link keeps label', toSpeakable('See [the job](https://x.com/jobs/1) here'), 'See the job here')
check('bare URL dropped', toSpeakable('Details: https://example.com/a?b=c end'), 'Details: end')
check('heading marker stripped', toSpeakable('### Tomorrow'), 'Tomorrow')
check('bullet marker stripped', toSpeakable('- first item'), 'first item')
check('numbered marker kept sensible', toSpeakable('2. Fossil install'), 'Fossil install')
check('inline code unwrapped', toSpeakable('press `Push to Schedule` now'), 'press Push to Schedule now')
check('table row → spoken cells', toSpeakable('| Fossil | 2pm |'), 'Fossil, 2pm')
check('emoji removed', toSpeakable('Done ✅ 😏'), 'Done')
check('whitespace collapsed', toSpeakable('a   b\t c'), 'a b c')
check('marker-only chunk → empty', toSpeakable('---'), '')
check('empty in empty out', toSpeakable(''), '')
check('CJK untouched', toSpeakable('明天下午两点在怡丰城。'), '明天下午两点在怡丰城。')

if (failures > 0) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nAll speakable checks passed')
