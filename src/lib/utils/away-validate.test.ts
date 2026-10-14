// Standalone test — run with: npx tsx src/lib/utils/away-validate.test.ts
// Exits 1 on failure (repo convention — no test framework).
import { validateTrip, cleanText, type TripBody } from './away-validate'

let failed = 0
function eq<T>(name: string, got: T, want: T) {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (ok) { console.log(`  ✓ ${name}`) } else { failed++; console.error(`  ✗ ${name} (got ${JSON.stringify(got)})`) }
}

const good: TripBody = {
  user_ids: ['u1'], title: 'First Aid course',
  start_date: '2026-10-13', start_time: '14:00', end_date: '2026-10-15', end_time: '12:00',
}

console.log('validateTrip')
eq('a whole trip is valid', validateTrip(good), null)
eq('nobody on it is refused (Review Focus #4)', validateTrip({ ...good, user_ids: [] }), 'Pick at least one person')
eq('missing people list is refused', validateTrip({ ...good, user_ids: undefined }), 'Pick at least one person')
eq('blank title is refused', validateTrip({ ...good, title: '   ' }), 'Add a title')
eq('bad date is refused', validateTrip({ ...good, end_date: '15/10/2026' }), 'Invalid date')
eq('bad time is refused', validateTrip({ ...good, start_time: '25:00' }), 'Invalid time')
eq('end equal to start is refused', validateTrip({ ...good, end_date: '2026-10-13', end_time: '14:00' }), 'The end must be after the start')
eq('end before start is refused', validateTrip({ ...good, end_date: '2026-10-12' }), 'The end must be after the start')
eq('same-day trip later in the day is valid', validateTrip({ ...good, end_date: '2026-10-13', end_time: '17:00' }), null)

console.log('cleanText')
eq('trims', cleanText('  ABC  '), 'ABC')
eq('blank becomes null', cleanText('   '), null)
eq('null stays null', cleanText(null), null)

if (failed > 0) { console.error(`\n${failed} failed`); process.exit(1) }
console.log('\nall passed')
