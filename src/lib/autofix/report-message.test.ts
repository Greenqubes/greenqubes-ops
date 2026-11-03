/**
 * Standalone test for what the cloud fixer may report, and the one Telegram
 * message Nic gets from it.
 * Run: npx tsx src/lib/autofix/report-message.test.ts
 * Exits 1 on any failure.
 */

import { parseReport, statusForVerdict } from './report-parse'
import { buildNightlyMessage, escapeHtml, dateLabel, shortDate, clock12, type NightlyInput } from './nightly-message'

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

const SHA = 'a'.repeat(40)
const fixItem = {
  ref: { kind: 'bug', bugReportId: '219281ad-cf2b-450f-b8d3-591624c4b47c' },
  verdict: 'fix', severity: 'minor',
  title: 'Today button overlaps the view switch', summary: 's', reason: 'r',
  whatsNewLine: 'The Today button no longer overlaps the view switch.',
  fix: { branch: 'claude/autofix-20261105-today-button', headSha: SHA, previewUrl: 'https://greenqubes-ops-git-claude-autofix-20261105-today-button-greenqubes-projects.vercel.app' },
}
const base = { runId: '0b7f1c2e-1111-4222-8333-444455556666', items: [fixItem] }
const ok = (b: unknown) => parseReport(b).ok
const without = (k: string) => { const c: Record<string, unknown> = { ...fixItem }; delete c[k]; return { ...base, items: [c] } }

check('valid fix report → ok', ok(base), true)
check('fix without a fix block → error', ok(without('fix')), false)
check('fix without severity → error', ok(without('severity')), false)
check('fix without a What\'s new line → error', ok(without('whatsNewLine')), false)
check('branch without the claude/autofix- prefix → error',
  ok({ ...base, items: [{ ...fixItem, fix: { ...fixItem.fix, branch: 'autofix/x' } }] }), false)
check('branch main → error',
  ok({ ...base, items: [{ ...fixItem, fix: { ...fixItem.fix, branch: 'main' } }] }), false)
check('short sha → error',
  ok({ ...base, items: [{ ...fixItem, fix: { ...fixItem.fix, headSha: 'abc' } }] }), false)
check('preview not on vercel.app → error',
  ok({ ...base, items: [{ ...fixItem, fix: { ...fixItem.fix, previewUrl: 'https://evil.example.com' } }] }), false)
check('preview on http → error',
  ok({ ...base, items: [{ ...fixItem, fix: { ...fixItem.fix, previewUrl: 'http://x.vercel.app' } }] }), false)
check('unknown verdict → error', ok({ ...base, items: [{ ...fixItem, verdict: 'ship-it' }] }), false)
check('missing runId → error', ok({ items: [] }), false)
check('not an object → error', ok('hello'), false)
check('mixed valid report → ok', ok({
  ...base,
  items: [
    fixItem,
    { ref: { kind: 'crash', signature: 'Error in input stream @ /schedule' }, verdict: 'noise', title: 't', summary: 's', reason: 'dropped connection' },
    { ref: { kind: 'item', itemId: '0b7f1c2e-1111-4222-8333-444455556666' }, verdict: 'unclear', title: 't', summary: 's', reason: 'too vague' },
  ],
}), true)
check('title over 120 characters → error', ok({ ...base, items: [{ ...fixItem, title: 'x'.repeat(121) }] }), false)

check('fix + fix block → awaiting_nic', statusForVerdict('fix', true), 'awaiting_nic')
check('fix without a fix → needs_session', statusForVerdict('fix', false), 'needs_session')
for (const v of ['wish', 'junk', 'noise', 'known', 'already_fixed'] as const) {
  check(`${v} → closed`, statusForVerdict(v, false), 'closed')
}
check('unclear → needs_session', statusForVerdict('unclear', false), 'needs_session')
check('needs_session → needs_session', statusForVerdict('needs_session', false), 'needs_session')

// ── the nightly message ──
const empty: NightlyInput = {
  dateLabel: 'Thu 5 Nov', fixes: [], wishes: [], needsSession: [],
  closed: { junk: 0, noise: 0, known: 0, repeats: 0, alreadyFixed: [] },
}
check('nothing to say → empty string', buildNightlyMessage(empty), '')

const oneFix = buildNightlyMessage({
  ...empty,
  fixes: [{ no: 12, title: 'Today button overlaps', severity: 'minor', previewUrl: 'https://x.vercel.app' }],
})
check('fix number shown', oneFix.includes('Fix 12'), true)
check('fix title shown', oneFix.includes('Today button overlaps'), true)
check('severity shown', oneFix.includes('minor'), true)
check('test link shown', oneFix.includes('https://x.vercel.app'), true)
check('reply hint shown', oneFix.includes('Reply in your own words'), true)

check('escapeHtml', escapeHtml('a < b & "c" > d'), 'a &lt; b &amp; "c" &gt; d')
const wish = buildNightlyMessage({
  ...empty,
  wishes: [{ no: 14, reporter: 'Nic', route: '/jobs/x', priority: 'medium', message: 'a < b & "c"', reportedOn: '7 Sep' }],
})
check('reporter text is escaped', wish.includes('a &lt; b &amp; "c"'), true)
check('raw < never reaches Telegram', wish.includes('a < b'), false)
check('wish says not built', wish.includes('not built'), true)

const closedOnly = buildNightlyMessage({
  ...empty,
  closed: { junk: 1, noise: 24, known: 2, repeats: 3, alreadyFixed: ['time picker', 'video upload'] },
})
check('closed line counts junk', closedOnly.includes('1 junk'), true)
check('closed line counts noise', closedOnly.includes('24 connection blips'), true)
check('closed line names already-fixed', closedOnly.includes('already fixed: time picker, video upload'), true)

// Dates in messages are always English (CLAUDE.md hard rule) and Singapore time.
check('dateLabel', dateLabel('2026-11-04T17:30:00Z'), 'Thu 5 Nov')
check('shortDate', shortDate('2026-09-07T03:00:00Z'), '7 Sep')
check('clock12 evening', clock12('2026-11-05T13:14:00Z'), '9:14pm')
check('clock12 noon', clock12('2026-11-05T04:00:00Z'), '12:00pm')
check('clock12 just after midnight', clock12('2026-11-05T16:05:00Z'), '12:05am')

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`)
  process.exit(1)
}
console.log('\nAll report + message checks passed')
