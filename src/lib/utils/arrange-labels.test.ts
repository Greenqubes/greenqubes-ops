/**
 * Standalone test for the To arrange labels (no test framework).
 * Run: npx tsx src/lib/utils/arrange-labels.test.ts
 * Exits 1 on any failure.
 */
import { shortDay, timeLabel, guideLabel, slotLabel, daysWaiting } from './arrange-labels'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`); failures++ }
}

// Date labels are always English, whatever the person's language (CLAUDE.md).
console.log('days:')
check('Thu 12 Nov', shortDay('2026-11-12'), 'Thu 12 Nov')
check('Sun 1 Mar', shortDay('2026-03-01'), 'Sun 1 Mar')

console.log('times:')
check('evening', timeLabel('22:00'), '10:00 PM')
check('DB seconds', timeLabel('22:30:00'), '10:30 PM')
check('midnight', timeLabel('00:00:00'), '12:00 AM')
check('noon', timeLabel('12:00'), '12:00 PM')
check('morning', timeLabel('09:05'), '9:05 AM')
check('none', timeLabel(null), null)

console.log('the guide:')
check('any day, any time',
  guideLabel({ day: { mode: 'any' }, timeStart: null, timeEnd: null }), 'Any day · any time')
check('a range with a start time',
  guideLabel({ day: { mode: 'between', from: '2026-11-10', to: '2026-11-20' }, timeStart: '22:00', timeEnd: null }),
  'Between Tue 10 Nov and Fri 20 Nov · 10:00 PM')
check('a fixed day with start and end',
  guideLabel({ day: { mode: 'fixed', day: '2026-11-14' }, timeStart: '22:00', timeEnd: '23:30' }),
  'Sat 14 Nov only · 10:00 PM – 11:30 PM')

console.log('the offered slot:')
check('day and time', slotLabel({ date: '2026-11-12', dateEnd: null, timeStart: '22:00:00', timeEnd: null }), 'Thu 12 Nov · 10:00 PM')
check('day only', slotLabel({ date: '2026-11-12', dateEnd: null, timeStart: null, timeEnd: null }), 'Thu 12 Nov')
check('several days with times',
  slotLabel({ date: '2026-11-12', dateEnd: '2026-11-13', timeStart: '09:00', timeEnd: '18:00' }),
  'Thu 12 Nov – Fri 13 Nov · 9:00 AM – 6:00 PM')
check('no date', slotLabel({ date: null, dateEnd: null, timeStart: null, timeEnd: null }), 'Date to be confirmed')

console.log('how long it has waited (Singapore dates):')
// readyAt is a UTC timestamp; 2026-11-01T17:00Z is already 2 Nov in Singapore.
check('ready today', daysWaiting('2026-11-04T01:00:00Z', '2026-11-04'), 0)
check('ready 3 days ago', daysWaiting('2026-11-01T03:00:00Z', '2026-11-04'), 3)
check('late evening UTC is the next day in Singapore', daysWaiting('2026-11-01T17:00:00Z', '2026-11-04'), 2)

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nall arrange-labels checks passed')
