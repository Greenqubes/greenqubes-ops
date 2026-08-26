/**
 * Standalone test for the design-score prompt builder + model routing.
 * No live API calls — scoreDesignJob() itself is verified by a written
 * path-trace in the Task 7 report, not by this file.
 * Run: npx tsx src/lib/ai/design-score.test.ts
 * Exits 1 on any failure.
 */

import { pickModel, buildScorePrompt, BASELINE_TABLE } from './design-score'

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

check('text-only uses Haiku', pickModel(false).includes('haiku'), true)
check('attachments use Sonnet', pickModel(true).includes('sonnet'), true)

const prompt = buildScorePrompt({
  briefText: 'L3 atrium decals only', installDate: '2026-09-01', todayISO: '2026-08-18',
  attachmentNames: ['floorplan.pdf'],
  history: [{ brief: 'window frosting for NEX unit', complexity: 2, daysTaken: 1 }],
})
check('prompt carries the brief', prompt.includes('L3 atrium decals only'), true)
check('prompt carries the baseline', prompt.includes('BASELINE'), true)
check('prompt carries history', prompt.includes('window frosting'), true)
check('prompt names unreadable attachments', prompt.includes('floorplan.pdf'), true)
check('baseline mentions hoarding', BASELINE_TABLE.toLowerCase().includes('hoarding'), true)

// ── Extra coverage beyond the brief's minimal spec ─────────────────────────

// Null install date and empty history must not throw and must still render.
const emptyPrompt = buildScorePrompt({
  briefText: 'simple decal resize', installDate: null, todayISO: '2026-08-18',
  attachmentNames: [], history: [],
})
check('prompt handles null install date', emptyPrompt.includes('simple decal resize'), true)
check('prompt handles empty history without throwing', typeof emptyPrompt, 'string')

// Unrated history complexity (null) must not crash the formatter.
const unratedPrompt = buildScorePrompt({
  briefText: 'brief text', installDate: '2026-09-01', todayISO: '2026-08-18',
  attachmentNames: [], history: [{ brief: 'past job', complexity: null, daysTaken: 2.5 }],
})
check('prompt handles null history complexity', unratedPrompt.includes('past job'), true)

// Output contract is spelled out for the model.
check('prompt requests JSON contract fields', prompt.includes('"complexity"') && prompt.includes('"proposed_due"') && prompt.includes('"reason"') && prompt.includes('"confidence"'), true)

if (failures > 0) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nAll design-score checks passed')
