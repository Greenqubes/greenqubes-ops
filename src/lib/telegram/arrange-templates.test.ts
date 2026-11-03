/**
 * Standalone test for the To arrange Telegram templates (no framework).
 * Run: npx tsx src/lib/telegram/arrange-templates.test.ts
 * Exits 1 on any failure.
 */
import { tplArrangeReady, tplArrangeOffered, tplArrangeReturned, tplArrangeClientOk } from './templates'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`); failures++ }
}
const firstLine = (s: string) => s.split('\n')[0]

const base = { projectTitle: 'Fossil Westgate', jobClient: 'Fossil SG', jobUrl: 'https://x/jobs/1' }

console.log('headlines:')
check('ready', firstLine(tplArrangeReady({ ...base, salesName: 'Charles', guide: 'Any day · any time', note: null, location: 'Westgate' })),
  '📋 <b>Ready to arrange</b>')
const offered = tplArrangeOffered({ ...base, schedulerName: 'Jun', slot: 'Thu 12 Nov · 10:00 PM', crewNames: ['Rintu'] })
check('offered', firstLine(offered), '📅 <b>Install date offered</b>')
check('offered tells sales what to do', offered.includes('Check with the client, then press Client OK or Client said no.'), true)
const ret = (kind: 'client_no' | 'no_fit' | 'withdrawn' | 'clash') =>
  firstLine(tplArrangeReturned({ ...base, kind, byName: 'Charles', text: null, slot: null }))
check('client said no', ret('client_no'), '↩️ <b>Client said no</b>')
check('could not fit', ret('no_fit'), "↩️ <b>Scheduler couldn't fit it</b>")
check('withdrawn', ret('withdrawn'), "↩️ <b>Offer withdrawn — don't confirm with the client</b>")
check('clash', ret('clash'), '⚠️ <b>Client agreed — crew now clashes</b>')
check('client OK', firstLine(tplArrangeClientOk({ ...base, slot: 'Thu 12 Nov', crewNames: ['Rintu'], awayNames: [] })),
  '✅ <b>Client agreed — on the schedule</b>')

console.log('free text is escaped (Telegram rejects a message with a stray "<"):')
check('reason is escaped',
  tplArrangeReturned({ ...base, kind: 'client_no', byName: 'Charles', text: 'away <b>& back', slot: null }).includes('away &lt;b&gt;&amp; back'), true)
check('note is escaped',
  tplArrangeReady({ ...base, salesName: 'Charles', guide: 'Any day', note: 'after 10pm <mall rule>', location: 'X' }).includes('after 10pm &lt;mall rule&gt;'), true)

console.log('details:')
check('no crew is said plainly', tplArrangeOffered({ ...base, schedulerName: 'Jun', slot: 'Thu 12 Nov', crewNames: [] }).includes('<b>Crew:</b> to be added'), true)
check('away is a warning line, only when someone is away',
  [tplArrangeClientOk({ ...base, slot: 'Thu 12 Nov', crewNames: ['Rintu'], awayNames: ['Ali B'] }).includes('Away (warning only):</b> Ali B'),
   tplArrangeClientOk({ ...base, slot: 'Thu 12 Nov', crewNames: ['Rintu'], awayNames: [] }).includes('Away')], [true, false])
check('every message links to the job', offered.endsWith('<a href="https://x/jobs/1">View in app →</a>'), true)

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nall arrange-templates checks passed')
