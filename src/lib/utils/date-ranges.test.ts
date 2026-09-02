/**
 * Standalone test for project date-range merging (spec §6). No framework.
 * Run: npx tsx src/lib/utils/date-ranges.test.ts — exits 1 on any failure.
 */
import { mergeDateRanges, formatRanges } from './date-ranges'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual); const e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`); failures++ }
}

check('empty → empty', mergeDateRanges([]), [])
check('single day', mergeDateRanges([{ date: '2026-09-15', date_end: null }]),
  [{ start: '2026-09-15', end: '2026-09-15' }])
check('overlap merges', mergeDateRanges([
  { date: '2026-09-15', date_end: '2026-09-17' },
  { date: '2026-09-16', date_end: '2026-09-19' },
]), [{ start: '2026-09-15', end: '2026-09-19' }])
check('adjacent (next day) merges', mergeDateRanges([
  { date: '2026-09-15', date_end: null },
  { date: '2026-09-16', date_end: null },
]), [{ start: '2026-09-15', end: '2026-09-16' }])
check('gap stays split + sorted', mergeDateRanges([
  { date: '2026-09-23', date_end: '2026-09-26' },
  { date: '2026-09-15', date_end: '2026-09-19' },
  { date: '2026-09-30', date_end: '2026-10-01' },
]), [
  { start: '2026-09-15', end: '2026-09-19' },
  { start: '2026-09-23', end: '2026-09-26' },
  { start: '2026-09-30', end: '2026-10-01' },
])
check('date_end before date is ignored (bad data)', mergeDateRanges([
  { date: '2026-09-15', date_end: '2026-09-10' },
]), [{ start: '2026-09-15', end: '2026-09-15' }])

check('format multi', formatRanges([
  { start: '2026-09-15', end: '2026-09-19' },
  { start: '2026-09-30', end: '2026-10-01' },
]), '15/9/26 – 19/9/26, 30/9/26 – 1/10/26')
check('format single-day range', formatRanges([{ start: '2026-09-23', end: '2026-09-23' }]), '23/9/26')
check('format empty', formatRanges([]), '')

if (failures > 0) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nAll date-range checks passed')
