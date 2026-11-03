/**
 * Standalone test for the To arrange rules (no test framework).
 * Run: npx tsx src/lib/utils/arrange-rules.test.ts
 * Exits 1 on any failure.
 */
import {
  parseArrangeState, parseArrangement, nextArrangeState, arrangeTurn,
  isArrangeSalesSide, isArrangeSchedulerSide, canArrange,
  hhmm, validateGuide, guideJobPatch, validateOffer,
  type ArrangeAction, type Arrangement,
} from './arrange-rules'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`); failures++ }
}

const job = { status: 'awaiting_date', created_by: 's1', sales_poc_id: 's1', coordinatorIds: ['c1'] }

console.log('parsing what the database hands back:')
check('a known state', parseArrangeState('offered'), 'offered')
check('null stays null', parseArrangeState(null), null)
check('an unknown word is null, never trusted', parseArrangeState('scheduled'), null)
const good: Arrangement = {
  readyBy: 's1', readyByName: 'Charles', readyAt: '2026-11-02T03:00:00Z',
  day: { mode: 'between', from: '2026-11-10', to: '2026-11-20' }, timeStart: '22:00', timeEnd: null, note: null,
  offer: null, lastReturn: null,
}
check('a well-formed arrangement parses', parseArrangement(good)?.readyBy, 's1')
check('a wrong shape is null', parseArrangement({ hello: 1 }), null)
check('a bad day mode is null', parseArrangement({ ...good, day: { mode: 'sometime' } }), null)
check('null is null', parseArrangement(null), null)

console.log('the round trip (Nic, 2026-11-03):')
check('ready: Ongoing → needs a date', nextArrangeState(null, 'ready'), 'needs_date')
check('ready again while waiting (guide edited)', nextArrangeState('needs_date', 'ready'), 'needs_date')
check('ready while offered withdraws the offer', nextArrangeState('offered', 'ready'), 'needs_date')
check('ready after "couldn\'t fit" re-sends', nextArrangeState('no_fit', 'ready'), 'needs_date')
check('offer: needs a date → offered', nextArrangeState('needs_date', 'offer'), 'offered')
check('send back: needs a date → no fit', nextArrangeState('needs_date', 'send_back'), 'no_fit')
check('withdraw: offered → needs a date', nextArrangeState('offered', 'withdraw'), 'needs_date')
check('client said no: offered → needs a date', nextArrangeState('offered', 'client_no'), 'needs_date')
check('client OK: offered → out of To arrange', nextArrangeState('offered', 'client_ok'), null)
check('pull back from any state', (['needs_date', 'offered', 'no_fit', 'clash'] as const).map(s => nextArrangeState(s, 'pull_back')), [null, null, null, null])
check('cannot offer twice', nextArrangeState('offered', 'offer'), 'invalid')
check('cannot offer before it is ready', nextArrangeState(null, 'offer'), 'invalid')
check('Client OK twice is invalid the second time', nextArrangeState(null, 'client_ok'), 'invalid')
check('withdraw after Client OK is invalid', nextArrangeState(null, 'withdraw'), 'invalid')
check('pull back when not in To arrange is invalid', nextArrangeState(null, 'pull_back'), 'invalid')
check('nothing but pull_back leaves clash',
  (['ready', 'offer', 'send_back', 'withdraw', 'client_no', 'client_ok'] as ArrangeAction[]).map(a => nextArrangeState('clash', a)),
  Array(6).fill('invalid'))

console.log('whose turn:')
check('needs a date → scheduler', arrangeTurn('needs_date'), 'scheduler')
check('clash → scheduler', arrangeTurn('clash'), 'scheduler')
check('offered → sales', arrangeTurn('offered'), 'sales')
check('no fit → sales', arrangeTurn('no_fit'), 'sales')

console.log('who may press what:')
check('the sales PIC is sales side', isArrangeSalesSide({ id: 's1', role: 'sales' }, job), true)
check('a coordinator on the job is sales side', isArrangeSalesSide({ id: 'c1', role: 'coordinator' }, job), true)
check('a coordinator NOT on the job is not sales side',
  isArrangeSalesSide({ id: 'c2', role: 'coordinator' }, { status: 'awaiting_date', created_by: 's1', sales_poc_id: 's1', coordinatorIds: ['c1'] }), false)
check('another sales person is not sales side', isArrangeSalesSide({ id: 's9', role: 'sales' }, job), false)
check('a scheduler who made the job is not sales side', isArrangeSalesSide({ id: 'x', role: 'scheduler' }, { ...job, created_by: 'x' }), false)
check('admin is sales side on any job', isArrangeSalesSide({ id: 'a', role: 'scheduler', isAdmin: true }, job), true)
check('a scheduler is scheduler side', isArrangeSchedulerSide({ id: 'x', role: 'scheduler' }), true)
check('admin previewing as sales is still scheduler side', isArrangeSchedulerSide({ id: 'a', role: 'sales', isAdmin: true }), true)
check('sales is not scheduler side', isArrangeSchedulerSide({ id: 's1', role: 'sales' }), false)
check('a plain scheduler cannot press Client OK', canArrange({ id: 'x', role: 'scheduler' }, job, 'client_ok'), false)
check('the sales PIC can press Client OK', canArrange({ id: 's1', role: 'sales' }, job, 'client_ok'), true)
check('the sales PIC cannot offer', canArrange({ id: 's1', role: 'sales' }, job, 'offer'), false)
check('the scheduler can offer, send back, withdraw',
  (['offer', 'send_back', 'withdraw'] as ArrangeAction[]).map(a => canArrange({ id: 'x', role: 'scheduler' }, job, a)), [true, true, true])
check('sales side: ready, client no, pull back',
  (['ready', 'client_no', 'pull_back'] as ArrangeAction[]).map(a => canArrange({ id: 'c1', role: 'coordinator' }, job, a)), [true, true, true])
check('a designer can do nothing',
  (['ready', 'offer', 'client_ok', 'pull_back'] as ArrangeAction[]).map(a => canArrange({ id: 'd', role: 'designer' }, job, a)), [false, false, false, false])

console.log('time strings:')
check('DB seconds dropped', hhmm('22:00:00'), '22:00')
check('form value kept', hhmm('22:00'), '22:00')
check('blank is null', hhmm(''), null)
check('null is null', hhmm(null), null)

console.log('the guide sales gives:')
const g = (day: Arrangement['day'], timeStart: string | null = null, timeEnd: string | null = null) =>
  ({ day, timeStart, timeEnd, note: null })
check('any day, any time is fine', validateGuide(g({ mode: 'any' })), null)
check('a proper range is fine', validateGuide(g({ mode: 'between', from: '2026-11-10', to: '2026-11-20' })), null)
check('a one-day range is fine', validateGuide(g({ mode: 'between', from: '2026-11-10', to: '2026-11-10' })), null)
check('a backwards range', validateGuide(g({ mode: 'between', from: '2026-11-20', to: '2026-11-10' })), 'bad_range')
check('a range with a blank end', validateGuide(g({ mode: 'between', from: '2026-11-10', to: '' })), 'bad_range')
check('an impossible date in a range', validateGuide(g({ mode: 'between', from: '2026-11-31', to: '2026-12-02' })), 'bad_range')
check('a fixed day is fine', validateGuide(g({ mode: 'fixed', day: '2026-11-14' })), null)
check('a fixed day left blank', validateGuide(g({ mode: 'fixed', day: '' })), 'bad_day')
check('an end time with no start', validateGuide(g({ mode: 'any' }, null, '23:00')), 'end_without_start')
check('an end before the start', validateGuide(g({ mode: 'any' }, '22:00', '21:00')), 'end_before_start')
check('an end equal to the start', validateGuide(g({ mode: 'any' }, '22:00', '22:00')), 'end_before_start')
check('start with a later end is fine', validateGuide(g({ mode: 'any' }, '22:00', '23:30')), null)

console.log('what the guide writes onto the job:')
check('a fixed day sets the date and leaves the end date alone',
  guideJobPatch(g({ mode: 'fixed', day: '2026-11-14' }, '22:00'), 'strict'),
  { date: '2026-11-14', time_start: '22:00', time_end: null, punctuality: 'strict' })
check('a range clears the date and end date — the scheduler picks',
  guideJobPatch(g({ mode: 'between', from: '2026-11-10', to: '2026-11-20' }), 'flexible'),
  { date: null, date_end: null, time_start: null, time_end: null, punctuality: 'flexible' })
check('no start time drops strict to flexible, as the form does',
  guideJobPatch(g({ mode: 'any' }), 'strict'),
  { date: null, date_end: null, time_start: null, time_end: null, punctuality: 'flexible' })

console.log('checking the scheduler\'s offer against the guide:')
const slot = (date: string | null, timeStart: string | null = null, timeEnd: string | null = null) =>
  ({ date, dateEnd: null, timeStart, timeEnd })
const T = '2026-11-04'
const range = { day: { mode: 'between', from: '2026-11-10', to: '2026-11-20' } as const, timeStart: null, timeEnd: null }
check('no date', validateOffer(range, slot(null), T), 'date_required')
check('a date in the past', validateOffer({ day: { mode: 'any' }, timeStart: null, timeEnd: null }, slot('2026-11-03'), T), 'in_past')
check('today is fine', validateOffer({ day: { mode: 'any' }, timeStart: null, timeEnd: null }, slot('2026-11-04'), T), null)
check('inside the range', validateOffer(range, slot('2026-11-12'), T), null)
check('the first day of the range', validateOffer(range, slot('2026-11-10'), T), null)
check('the last day of the range', validateOffer(range, slot('2026-11-20'), T), null)
check('before the range', validateOffer(range, slot('2026-11-09'), T), 'outside_range')
check('after the range', validateOffer(range, slot('2026-11-21'), T), 'outside_range')
const fixed = { day: { mode: 'fixed', day: '2026-11-14' } as const, timeStart: null, timeEnd: null }
check('the fixed day', validateOffer(fixed, slot('2026-11-14'), T), null)
check('not the fixed day', validateOffer(fixed, slot('2026-11-15'), T), 'not_fixed_day')
const timed = { day: { mode: 'any' } as const, timeStart: '22:00', timeEnd: null }
check('the locked time kept', validateOffer(timed, slot('2026-11-12', '22:00'), T), null)
check('the locked time changed', validateOffer(timed, slot('2026-11-12', '21:00'), T), 'time_locked')
check('the locked time removed', validateOffer(timed, slot('2026-11-12', null), T), 'time_locked')
check('DB time vs form time are the same lock',
  validateOffer({ day: { mode: 'any' }, timeStart: '22:00:00', timeEnd: null }, slot('2026-11-12', '22:00'), T), null)
check('a locked end time changed',
  validateOffer({ day: { mode: 'any' }, timeStart: '22:00', timeEnd: '23:00' }, slot('2026-11-12', '22:00', '23:30'), T), 'time_locked')
check('no time locked: the scheduler may pick any',
  validateOffer(range, slot('2026-11-12', '09:00', '12:00'), T), null)

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nall arrange-rules checks passed')
