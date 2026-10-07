/**
 * Standalone test for the PDF writer and the scan file name.
 * Run: npx tsx src/lib/scan/pdf.test.ts
 * Exits 1 on any failure.
 */
import { buildPdf } from './pdf'
import { scanFileName } from './file-name'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`); failures++ }
}

const fakeJpeg = (tag: number) => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, tag, 0x00, 0xff, 0xd9])
const bytes = buildPdf([
  { jpeg: fakeJpeg(1), widthPx: 2480, heightPx: 3508 },
  { jpeg: fakeJpeg(2), widthPx: 3508, heightPx: 2480 },
])
const text = Buffer.from(bytes).toString('latin1')

check('starts with a PDF header', text.startsWith('%PDF-1.4'), true)
check('ends with %%EOF', text.trimEnd().endsWith('%%EOF'), true)
check('two pages', text.includes('/Count 2'), true)
check('portrait A4 media box', text.includes('/MediaBox [0 0 595.28 841.89]'), true)
check('landscape A4 media box', text.includes('/MediaBox [0 0 841.89 595.28]'), true)
check('JPEG bytes embedded intact', text.includes(Buffer.from(fakeJpeg(2)).toString('latin1')), true)

// every xref offset must land exactly on "<n> 0 obj"
const xrefAt = Number(text.match(/startxref\n(\d+)/)![1])
check('startxref points at the xref table', text.slice(xrefAt, xrefAt + 4), 'xref')
const entries = text.slice(xrefAt).split('\n').filter(l => / 00000 n $/.test(l))
check('xref lists 8 objects (catalog, pages, 3 per page)', entries.length, 8)
check('every xref offset is correct', entries.every((l, k) => text.slice(Number(l.slice(0, 10))).startsWith(`${k + 1} 0 obj`)), true)

let threw = false
try { buildPdf([]) } catch { threw = true }
check('refuses zero pages', threw, true)

const d = new Date(2026, 8, 25) // 25 Sep 2026 local
check('file name', scanFileName('Fossil Mustafa Set Up', d), 'Signed DO - Fossil Mustafa Set Up - 25 Sep 2026.pdf')
check('strips characters file systems reject', scanFileName('WS SG / Mustafa: "P9" <2026>?', d), 'Signed DO - WS SG Mustafa P9 2026 - 25 Sep 2026.pdf')
check('no title', scanFileName('  ', d), 'Signed DO - 25 Sep 2026.pdf')
check('null title', scanFileName(null, d), 'Signed DO - 25 Sep 2026.pdf')
check('long title trimmed to 60 chars', scanFileName('x'.repeat(100), d), `Signed DO - ${'x'.repeat(60)} - 25 Sep 2026.pdf`)
check('single-digit day is zero-padded', scanFileName('A', new Date(2026, 9, 5)), 'Signed DO - A - 05 Oct 2026.pdf')

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nall passed')
