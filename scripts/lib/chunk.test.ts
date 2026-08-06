/**
 * Standalone test for the chunker (no test framework in this repo).
 * Run: npx tsx scripts/lib/chunk.test.ts
 * Exits 1 on any failure.
 */

import { chunkText, CHUNK_CHARS } from './chunk'

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

// A document with many paragraphs, big enough to need several chunks
const para = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(10).trim() // ~570 chars
const lfDoc = Array.from({ length: 10 }, (_, i) => `## Section ${i}\n${para}`).join('\n\n')
const crlfDoc = lfDoc.replace(/\n/g, '\r\n')

// 1. LF document splits into multiple chunks
const lfChunks = chunkText(lfDoc)
check('LF doc produces multiple chunks', lfChunks.length > 1, true)

// 2. CRLF version of the SAME document must chunk identically —
//    this is the bug: before the fix, \r\n\r\n was not seen as a
//    paragraph break, so the whole doc became one giant chunk.
const crlfChunks = chunkText(crlfDoc)
check('CRLF doc produces same chunk count as LF', crlfChunks.length, lfChunks.length)
check('CRLF chunk content matches LF (normalised)', crlfChunks, lfChunks)

// 3. Every chunk respects the size cap (allowing one oversize paragraph through)
check('no chunk wildly exceeds cap', lfChunks.every(c => c.length <= CHUNK_CHARS + para.length + 20), true)

// 4. Short document → single chunk, content intact
check('short doc single chunk', chunkText('hello\n\nworld'), ['hello\n\nworld'])

// 5. Single paragraph larger than the cap still comes through whole
const big = 'x'.repeat(CHUNK_CHARS + 500)
check('oversize single paragraph kept whole', chunkText(big), [big])

// 6. Whitespace-only input → one (trimmed) fallback chunk, no crash
check('whitespace-only input safe', chunkText('   \n\n  ').length, 1)

if (failures) {
  console.error(`\n${failures} test(s) FAILED`)
  process.exit(1)
}
console.log('\nAll tests passed')
