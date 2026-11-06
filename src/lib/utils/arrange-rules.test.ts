/**
 * Standalone test for the To arrange rules (no test framework).
 * Run: npx tsx src/lib/utils/arrange-rules.test.ts
 * Exits 1 on any failure.
 */
import {
  parseArrangeState, parseArrangement, nextArrangeState, arrangeTurn,
  isArrangeSalesSide, isArrangeSchedulerSide, canArrange,
  hhmm, validateGuide, guideJobPatch, validateOffer,
  clashKeys, newClashKeys, offerMatchesJob, offerHasCrew, clientOkSchedulerMessage,
  arrangeFieldLocks, seedCrewFromOffer, blocksPush, arrangeClearPatch, groupArrangeJobs,
  parseArrangeAction, parseGuideInput, idList, reasonText,
  seenMatches, contractorsInOffer, offerExpired,
  arrangeCta, arrangeCardHref, opensChangeDate, withoutChangeParam,
  type ArrangeAction, type Arrangement, type ArrangeOffer, type ArrangeState,
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

// ── Task 3 ──────────────────────────────────────────────────────────────────
console.log('clashes — only NEW ones send a job back (Nic, builder check):')
const result = {
  clashes:      [{ installerId: 'r', conflict: { jobId: 'j1' } }, { installerId: 'r', conflict: { jobId: 'j1' } }],
  leaveClashes: [{ installerId: 'a' }],
}
check('booking and leave keys, sorted, unique', clashKeys(result), ['b:r:j1', 'l:a'])
check('no clashes, no keys', clashKeys({ clashes: [], leaveClashes: [] }), [])
check('an accepted clash is not new', newClashKeys(['b:r:j1'], ['b:r:j1']), [])
check('a fresh clash is new', newClashKeys(['b:r:j1', 'l:a'], ['b:r:j1']), ['l:a'])
check('a clash that went away is not new', newClashKeys([], ['b:r:j1']), [])

const offer: ArrangeOffer = {
  by: 'x', byName: 'Jun', at: '2026-11-03T03:00:00Z',
  date: '2026-11-12', dateEnd: null, timeStart: '22:00', timeEnd: null,
  driverIds: [], supportIds: [], contactIds: [], crewNames: [], acceptedClashKeys: [],
}
const offerSlot = { date: '2026-11-12', dateEnd: null, timeStart: '22:00', timeEnd: null }
console.log('the offer still matches the job:')
check('same slot matches', offerMatchesJob(offer, offerSlot), true)
check('stale DB seconds still match the offer',
  offerMatchesJob({ ...offer, timeStart: '22:00' }, { ...offerSlot, timeStart: '22:00:00' }), true)
check('moved date does not match', offerMatchesJob(offer, { ...offerSlot, date: '2026-11-13' }), false)
check('changed time does not match', offerMatchesJob(offer, { ...offerSlot, timeStart: '21:00' }), false)
check('an added end date does not match', offerMatchesJob(offer, { ...offerSlot, dateEnd: '2026-11-13' }), false)
check('an added end time does not match', offerMatchesJob(offer, { ...offerSlot, timeEnd: '23:00' }), false)

console.log('crew on the offer:')
check('no crew at all', offerHasCrew(offer), false)
check('support crew only counts as crew', offerHasCrew({ ...offer, supportIds: ['s'] }), true)
check('a contractor only counts as crew', offerHasCrew({ ...offer, contactIds: ['k'] }), true)
check('a driver → the short "client agreed" message', clientOkSchedulerMessage({ ...offer, driverIds: ['r'] }), 'arranged')
check('no driver → the normal Assign Installer message', clientOkSchedulerMessage({ ...offer, supportIds: ['s'] }), 'assign_crew')
check('no crew → the normal Assign Installer message', clientOkSchedulerMessage(offer), 'assign_crew')

console.log('which date/time fields are locked on the job page:')
const sched = { sales: false, scheduler: true }, sales = { sales: true, scheduler: false }, both = { sales: true, scheduler: true }
const fixedTimed: Arrangement = { ...good, day: { mode: 'fixed', day: '2026-11-14' }, timeStart: '22:00' }
check('not in To arrange: nothing locked', arrangeFieldLocks(null, null, sales), { date: false, dateEnd: false, time: false })
check('offered: locked for the scheduler', arrangeFieldLocks('offered', good, sched), { date: true, dateEnd: true, time: true })
check('offered: locked for sales', arrangeFieldLocks('offered', good, sales), { date: true, dateEnd: true, time: true })
check('clash: the client agreed the slot — locked', arrangeFieldLocks('clash', good, sched), { date: true, dateEnd: true, time: true })
check('needs a date, a range, time given: scheduler picks the day only',
  arrangeFieldLocks('needs_date', good, sched), { date: false, dateEnd: false, time: true })
// Review fix (2026-11-04): a fixed START day must still let the scheduler
// give a multi-day job its end date — sales' guide has no end date at all.
check('needs a date, fixed day and time: scheduler may still set the end date',
  arrangeFieldLocks('needs_date', fixedTimed, sched), { date: true, dateEnd: false, time: true })
check('needs a date, any day, any time: scheduler picks both',
  arrangeFieldLocks('needs_date', { ...good, day: { mode: 'any' }, timeStart: null }, sched), { date: false, dateEnd: false, time: false })
check('needs a date: sales change it through the guide, not the form',
  arrangeFieldLocks('needs_date', good, sales), { date: true, dateEnd: true, time: true })
check('no fit: sales locked too', arrangeFieldLocks('no_fit', good, sales), { date: true, dateEnd: true, time: true })
check('admin is both — scheduler rules win', arrangeFieldLocks('needs_date', good, both), { date: false, dateEnd: false, time: true })

console.log('the scheduler\'s crew picks come back filled in:')
const withOffer: Arrangement = { ...good, offer: { ...offer, driverIds: ['r'], supportIds: ['s'] } }
check('after a client no, the scheduler sees his last crew',
  seedCrewFromOffer('needs_date', withOffer, true), { driverIds: ['r'], supportIds: ['s'] })
check('in a clash, the scheduler sees the agreed crew to change',
  seedCrewFromOffer('clash', withOffer, true), { driverIds: ['r'], supportIds: ['s'] })
check('not for sales', seedCrewFromOffer('needs_date', withOffer, false), null)
// Review fix (2026-11-04): the OLD rule returned null while offered, so right
// after he offered, his own crew picks no longer matched anything and the
// page counted them as unsaved — blocking Withdraw (and an admin's Client OK)
// with "save your changes first".
check('while offered, the picks stay as offered (not unsaved work)',
  seedCrewFromOffer('offered', withOffer, true), { driverIds: ['r'], supportIds: ['s'] })
check('no offer yet, nothing to seed', seedCrewFromOffer('needs_date', good, true), null)

console.log('Push to Schedule while an offer is with the client:')
check('blocked while offered', blocksPush('offered'), true)
check('allowed while it needs a date', blocksPush('needs_date'), false)
check('allowed in a clash (that is how the scheduler finishes it)', blocksPush('clash'), false)
check('allowed outside To arrange', blocksPush(null), false)
check('arrangeClearPatch clears both', arrangeClearPatch(), { arrange_state: null, arrangement: null })

console.log('the To arrange list:')
const row = (id: string, state: ArrangeState | null, arr: Arrangement | null) => ({ id, arrange_state: state, arrangement: arr })
const at = (readyAt: string, extra: Partial<Arrangement> = {}): Arrangement => ({ ...good, readyAt, ...extra })
const grouped = groupArrangeJobs([
  row('old-ready', 'needs_date', at('2026-11-01T00:00:00Z')),
  row('new-ready', 'needs_date', at('2026-11-03T00:00:00Z')),
  row('clash', 'clash', at('2026-11-02T00:00:00Z')),
  row('broken', 'needs_date', null),
  row('late-offer', 'offered', at('2026-11-01T00:00:00Z', { offer: { ...offer, at: '2026-11-03T05:00:00Z' } })),
  row('early-offer', 'offered', at('2026-11-01T00:00:00Z', { offer: { ...offer, at: '2026-11-02T05:00:00Z' } })),
  row('nofit', 'no_fit', at('2026-10-30T00:00:00Z', { lastReturn: { kind: 'no_fit', text: 'full', by: 'x', byName: 'Jun', at: '2026-11-01T00:00:00Z' } })),
  row('not-arranging', null, null),
])
check('needs a date: clash first, then oldest ready first, broken last',
  grouped.needsDate.map(j => j.id), ['clash', 'old-ready', 'new-ready', 'broken'])
check('with sales: offered (oldest offer first), then couldn\'t fit',
  grouped.withSales.map(j => j.id), ['early-offer', 'late-offer', 'nofit'])

// ── Task 6: reading a request ───────────────────────────────────────────────
console.log('reading what the browser sends:')
check('a known action', parseArrangeAction('client_ok'), 'client_ok')
check('an unknown action', parseArrangeAction('delete_job'), null)
check('not a string', parseArrangeAction(7), null)
check('a full guide', parseGuideInput({ day: { mode: 'fixed', day: '2026-11-14' }, timeStart: '22:00', timeEnd: null, note: ' mall rule ' }),
  { day: { mode: 'fixed', day: '2026-11-14' }, timeStart: '22:00', timeEnd: null, note: 'mall rule' })
check('blank times and note become null', parseGuideInput({ day: { mode: 'any' }, timeStart: '', timeEnd: '', note: '   ' }),
  { day: { mode: 'any' }, timeStart: null, timeEnd: null, note: null })
check('missing fields become null', parseGuideInput({ day: { mode: 'any' } }),
  { day: { mode: 'any' }, timeStart: null, timeEnd: null, note: null })
check('only the fields of its own mode are kept',
  parseGuideInput({ day: { mode: 'between', from: '2026-11-10', to: '2026-11-20', day: 'x', evil: 1 } }),
  { day: { mode: 'between', from: '2026-11-10', to: '2026-11-20' }, timeStart: null, timeEnd: null, note: null })
check('a bad day is refused', parseGuideInput({ day: { mode: 'soon' } }), null)
check('no body is refused', parseGuideInput(null), null)
check('a non-string time is refused', parseGuideInput({ day: { mode: 'any' }, timeStart: 2200 }), null)
check('a very long note is cut to 500 characters', parseGuideInput({ day: { mode: 'any' }, note: 'x'.repeat(900) })?.note?.length, 500)
check('crew ids: strings only, no repeats', idList(['a', 'b', 'a', 3, null]), ['a', 'b'])
check('crew ids: not a list', idList('a'), [])
check('reason text: trimmed, blank is null, capped', [reasonText('  away  '), reasonText('   '), reasonText(5), reasonText('y'.repeat(900))?.length],
  ['away', null, null, 500])

// ── Review fixes (2026-11-04) ───────────────────────────────────────────────
console.log('a stale screen cannot act on an offer it never saw (review #2):')
// Sales' phone shows offer A; meanwhile the scheduler withdrew it and offered
// B. The state is 'offered' again, so a state check alone let A's Client OK
// schedule B's day. The screen now says what it saw.
const offerA: Arrangement = { ...good, offer: { ...offer, at: '2026-11-03T05:00:00Z' } }
const offerB: Arrangement = { ...good, offer: { ...offer, at: '2026-11-03T09:00:00Z' } }
const seenA = { state: 'offered', readyAt: good.readyAt, offerAt: '2026-11-03T05:00:00Z' }
check('the offer on screen is the current one', seenMatches('offered', offerA, seenA), true)
check('a re-offer since the screen loaded', seenMatches('offered', offerB, seenA), false)
check('the state moved on since the screen loaded', seenMatches('needs_date', offerA, seenA), false)
check('the guide was re-sent since (new readyAt)', seenMatches('offered', { ...offerA, readyAt: '2026-11-03T08:00:00Z' }, seenA), false)
check('not in To arrange, screen agrees', seenMatches(null, null, { state: null, readyAt: null, offerAt: null }), true)
check('not in To arrange, screen thinks it is', seenMatches(null, null, seenA), false)
check('nothing sent is never a match', seenMatches('offered', offerA, undefined), false)
check('a wrong shape is never a match', seenMatches('offered', offerA, { state: 'offered' }), false)

console.log('only the scheduler\'s contractor picks ride in the offer (review #3):')
const extRows = [
  { contact_id: 'ck', suggested_by: 'jun' },     // the scheduler added him
  { contact_id: 'fu', suggested_by: 'charles' }, // sales suggested him
  { contact_id: 'old', suggested_by: null },      // nobody on record
]
check('the scheduler\'s pick only', contractorsInOffer(extRows, ['jun']), ['ck'])
check('admin counts as the scheduler side', contractorsInOffer(extRows, ['jun', 'charles']), ['ck', 'fu'])
check('no scheduler-side picks, no contractors', contractorsInOffer(extRows, []), [])

console.log('Client OK on a day that has passed (review #11):')
check('the offered day is today — fine', offerExpired({ ...offer, date: '2026-11-04' }, '2026-11-04'), false)
check('the offered day has passed', offerExpired({ ...offer, date: '2026-11-03' }, '2026-11-04'), true)

console.log('the word on a To arrange card (Nic 2026-11-06: a Change date link):')
check('scheduler, needs a date → offer', arrangeCta('needs_date', false, true), 'offer')
check('scheduler, crew clash → offer', arrangeCta('clash', false, true), 'offer')
check('scheduler, waiting on the client → change', arrangeCta('offered', false, true), 'change')
check('scheduler, sent back to sales → nothing', arrangeCta('no_fit', false, true), null)
check('sales, waiting on the client → answer', arrangeCta('offered', true, false), 'answer')
check('sales, needs a date → nothing', arrangeCta('needs_date', true, false), null)
check('admin (both sides), waiting on the client → answer, as before', arrangeCta('offered', true, true), 'answer')
check('neither side → nothing', arrangeCta('offered', false, false), null)

console.log('where the card goes:')
check('Change date opens the job at the change step', arrangeCardHref('j1', 'change'), '/jobs/j1?arrange=change')
check('Offer a date just opens the job', arrangeCardHref('j1', 'offer'), '/jobs/j1')
check('no word just opens the job', arrangeCardHref('j1', null), '/jobs/j1')

console.log('arriving from Change date:')
check('scheduler, offer still out → open the change step', opensChangeDate('?arrange=change', 'offered', true), true)
check('offer already answered or withdrawn → do not', opensChangeDate('?arrange=change', 'needs_date', true), false)
check('sales following the same address → do not', opensChangeDate('?arrange=change', 'offered', false), false)
check('a plain visit → do not', opensChangeDate('', 'offered', true), false)
check('works beside other address parts', opensChangeDate('?tab=details&arrange=change', 'offered', true), true)
check('the marker is dropped after use', withoutChangeParam('?arrange=change'), '')
check('other address parts are kept', withoutChangeParam('?tab=details&arrange=change'), '?tab=details')

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nall arrange-rules checks passed')
