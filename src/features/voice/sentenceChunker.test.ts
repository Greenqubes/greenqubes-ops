/**
 * Standalone test for the streaming sentence chunker.
 * Run: npx tsx src/features/voice/sentenceChunker.test.ts
 * Exits 1 on any failure.
 */
import { createSentenceChunker } from './sentenceChunker'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) { console.log(`  ✓ ${name}`) }
  else { console.error(`  ✗ ${name}\n      expected: ${JSON.stringify(expected)}\n      actual:   ${JSON.stringify(actual)}`); failures++ }
}

// One sentence arriving in three deltas emits once, on the boundary.
const c1 = createSentenceChunker()
check('fragment emits nothing', c1.push('The job is on Tue'), [])
check('still nothing mid-word', c1.push('sday at 2pm'), [])
check('emits on ". "', c1.push('. Then the next'), ['The job is on Tuesday at 2pm.'])
check('flush returns tail', c1.flush(), 'Then the next')
check('flush is idempotent', c1.flush(), null)

// Sentence enders: . ! ? need following whitespace/end; CJK 。！？ do not.
const c2 = createSentenceChunker()
check('CJK ender emits immediately', c2.push('明天下午两点。好的'), ['明天下午两点。'])
check('newline is a boundary', c2.push('\n- first line\n- second'), ['好的', '- first line'])
check('exclamation + space', c2.push(' done! next'), ['- second done!'])

// Decimal points and times must NOT split.
const c3 = createSentenceChunker()
check('decimal not split', c3.push('It costs 2.5 thousand. Ok'), ['It costs 2.5 thousand.'])
const c4 = createSentenceChunker()
check('multiple sentences in one delta', c4.push('One. Two! Three? Four'), ['One.', 'Two!', 'Three?'])
check('flush tail', c4.flush(), 'Four')

// Whitespace-only content never emits.
const c5 = createSentenceChunker()
check('blank deltas ignored', c5.push('  \n \n '), [])
check('flush of whitespace is null', c5.flush(), null)

if (failures > 0) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nAll sentenceChunker checks passed')
