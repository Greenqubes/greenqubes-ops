// Standalone test — run with: npx tsx src/lib/telegram/away-template.test.ts
// Exits 1 on failure (repo convention — no test framework).
import { tplAwayClash } from './templates'

let failed = 0
function check(name: string, cond: boolean) {
  if (cond) { console.log(`  ✓ ${name}`) } else { failed++; console.error(`  ✗ ${name}`) }
}

const msg = tplAwayClash({
  personNames: ['Halim'], tripTitle: 'Course <Level 2> & refresher', tripWhen: 'Tue 13 Oct 2026, 2:00pm → Thu 15 Oct 2026, 12:00pm',
  projectTitle: 'ASICS <Trail> set up', jobClient: 'ASICS & Co', jobDate: '2026-10-14',
  timeStart: '09:00:00', timeEnd: '11:00:00', location: 'B3-13, ION Orchard', jobUrl: 'https://x/jobs/1',
})

console.log('tplAwayClash')
check('says it is a warning only', msg.includes('warning only'))
check('names the person and trip', msg.includes('Halim') && msg.includes('Course &lt;Level 2&gt; &amp; refresher'))
// HR types these; a raw "<" makes Telegram reject the WHOLE message, silently.
check('no raw < from typed text', !msg.includes('<Level') && !msg.includes('<Trail'))
check('project title escaped inside its bold tag', msg.includes('<b>ASICS &lt;Trail&gt; set up</b>'))
check('client escaped', msg.includes('ASICS &amp; Co'))
check('keeps the link', msg.includes('<a href="https://x/jobs/1">'))
check('one person reads "is away"', msg.includes('Halim is away'))

// Review I1: one message per job naming everyone on the trip who is on it.
const many = tplAwayClash({
  personNames: ['Halim', 'Rintu <B>'], tripTitle: 'Course', tripWhen: 'Tue',
  projectTitle: null, jobClient: 'X', jobDate: '2026-10-14',
  timeStart: null, timeEnd: null, location: 'Y', jobUrl: 'https://x/jobs/2',
})
check('several people in one message', many.includes('Halim, Rintu &lt;B&gt; are away'))

if (failed > 0) { console.error(`\n${failed} failed`); process.exit(1) }
console.log('\nall passed')
