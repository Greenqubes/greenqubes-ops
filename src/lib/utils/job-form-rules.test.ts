/**
 * Standalone test for job-form rules (no test framework).
 * Run: npx tsx src/lib/utils/job-form-rules.test.ts
 * Exits 1 on any failure.
 */

import {
  REQUIRED_JOB_FIELDS,
  missingRequiredJobFields,
  clearedRequiredFields,
  extractDialNumber,
  punctualityFor,
  shouldSuggestAddresses,
  shouldOfferPreviousLocation,
  canTickProductionFlags,
  shouldNotifyOnPush,
  designBriefEditable,
  endDateBeforeStart,
  mapsSearchUrl,
  composeAddress,
} from './job-form-rules'

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

// ── missingRequiredJobFields ────────────────────────────────────────────
// The six fields Nic marked required on 2026-09-10, in on-screen order so
// the form can jump to the FIRST one a person still has to fill.
check('the six required fields, in screen order', REQUIRED_JOB_FIELDS,
  ['project_title', 'date', 'client', 'client_poc_name', 'client_poc_phone', 'location'])

const full = {
  project_title:    'OSG VM Request',
  date:             '2026-09-17',
  client:           'Onitsuka Tiger',
  client_poc_name:  'Marvin',
  client_poc_phone: '9123 4567',
  location:         '313 Orchard Rd',
}

check('everything filled → nothing missing', missingRequiredJobFields(full), [])
check('empty form → all six, in order', missingRequiredJobFields({}), REQUIRED_JOB_FIELDS)
check('one gap → just that one', missingRequiredJobFields({ ...full, location: '' }), ['location'])
check('whitespace is not a value', missingRequiredJobFields({ ...full, project_title: '   ' }), ['project_title'])
check('null and undefined count as missing',
  missingRequiredJobFields({ ...full, client: null, client_poc_phone: undefined }),
  ['client', 'client_poc_phone'])
// Order matters: the form scrolls to the first entry, so it must be the
// topmost empty field on screen, not whichever key was checked first.
check('several gaps come back in screen order',
  missingRequiredJobFields({ ...full, location: '', date: '', project_title: '' }),
  ['project_title', 'date', 'location'])
// Fields deliberately NOT required — description, times, end date.
check('description and times are never required',
  missingRequiredJobFields({ ...full, description: '', time_start: '', time_end: '', date_end: '' } as never),
  [])

// ── clearedRequiredFields ───────────────────────────────────────────────
// The edit form's rule (Nic, 2026-09-10): information already on a job may be
// replaced but not deleted — emptying it leaves the job incomplete. A draft
// that never had the field is left alone, so parked jobs still save.
check('nothing touched → nothing to complain about',
  clearedRequiredFields(full, full), [])
check('a filled field emptied → caught',
  clearedRequiredFields(full, { ...full, location: '' }), ['location'])
check('emptied to whitespace → still caught',
  clearedRequiredFields(full, { ...full, client_poc_phone: '  ' }), ['client_poc_phone'])
check('replaced with something else → fine',
  clearedRequiredFields(full, { ...full, location: '1 Kim Seng Promenade' }), [])
// The parked-draft case: never filled, so nothing was taken away.
check('was empty and still empty → fine',
  clearedRequiredFields({ ...full, client: '' }, { ...full, client: '' }), [])
check('was empty and now filled → fine',
  clearedRequiredFields({ ...full, client: '' }, full), [])
check('several emptied → screen order',
  clearedRequiredFields(full, { ...full, location: '', project_title: '', client: '' }),
  ['project_title', 'client', 'location'])
// Optional fields are not the rule's business.
check('emptying a non-required field is fine',
  clearedRequiredFields({ ...full, description: 'x' } as never, { ...full, description: '' } as never), [])

// ── extractDialNumber ───────────────────────────────────────────────────
// Nic's ask: the field stays free text, the call button dials the number
// it finds inside it.
check('plain number', extractDialNumber('91234567'), '91234567')
check('spaced number', extractDialNumber('9123 4567'), '91234567')
check('name in front', extractDialNumber('Marvin 9123 4567'), '91234567')
check('name and note around it', extractDialNumber('Marvin 9123 4567 (site)'), '91234567')
check('country code kept', extractDialNumber('+65 9123 4567'), '+6591234567')
check('dashes stripped', extractDialNumber('9123-4567'), '91234567')
check('brackets around the code', extractDialNumber('(65) 9123 4567'), '6591234567')
check('two numbers → the first', extractDialNumber('9123 4567 / 8123 4567'), '91234567')
check('office label then number', extractDialNumber('Office: 6123 4567'), '61234567')

check('empty → nothing to dial', extractDialNumber(''), null)
check('whitespace → nothing to dial', extractDialNumber('   '), null)
check('words only → nothing to dial', extractDialNumber('ask for Marvin'), null)
// Short digit runs are unit numbers and postal fragments, not phone numbers.
check('unit number is not a phone number', extractDialNumber('Unit 12-05'), null)
check('four digits alone → not a number', extractDialNumber('ext 4567'), null)
// A long id would dial, and that is accepted: the person pressed call.
check('seven digits is enough', extractDialNumber('1234567'), '1234567')

// ── punctualityFor ──────────────────────────────────────────────────────
// No start time means there is no time to be on time for.
check('no start time → flexible', punctualityFor('', 'strict'), 'flexible')
check('no start time, already flexible → flexible', punctualityFor('', 'flexible'), 'flexible')
check('null start time → flexible', punctualityFor(null, 'strict'), 'flexible')
check('start time set → the choice stands', punctualityFor('10:00', 'strict'), 'strict')
check('start time set, flexible stays flexible', punctualityFor('10:00', 'flexible'), 'flexible')

// ── endDateBeforeStart ──────────────────────────────────────────────────
check('no end date → fine', endDateBeforeStart('2026-09-17', ''), false)
check('same day → fine', endDateBeforeStart('2026-09-17', '2026-09-17'), false)
check('later → fine', endDateBeforeStart('2026-09-17', '2026-09-19'), false)
check('earlier → caught', endDateBeforeStart('2026-09-17', '2026-09-16'), true)
check('no start date → nothing to compare', endDateBeforeStart('', '2026-09-16'), false)

// ── mapsSearchUrl ───────────────────────────────────────────────────────
check('address becomes a maps search',
  mapsSearchUrl('313 Orchard Rd'),
  'https://www.google.com/maps/search/?api=1&query=313%20Orchard%20Rd')
check('commas and hashes survive encoding',
  mapsSearchUrl('#02-14, 313@Somerset'),
  'https://www.google.com/maps/search/?api=1&query=%2302-14%2C%20313%40Somerset')
check('empty address → no link', mapsSearchUrl('   '), null)

// ── composeAddress ──────────────────────────────────────────────────────
// What actually lands in the Location box after tapping a suggestion. The
// driver needs the unit number and postcode, so the detailed address wins —
// with the shop name in front only when it is a business (Nic, 2026-09-10).
const SHOP  = ['establishment', 'point_of_interest', 'store']
const ROAD  = ['street_address', 'geocode']

check('shop keeps its name in front of the full address',
  composeAddress({
    name:      'Capitol Optical (Great World City)',
    fallback:  'Capitol Optical (Great World City), Kim Seng Promenade, Singapore',
    detailed:  '#02-110, 1 Kim Seng Promenade, Singapore 237994',
    types:     SHOP,
  }),
  'Capitol Optical (Great World City), #02-110, 1 Kim Seng Promenade, Singapore 237994')

check('plain street address is not prefixed with itself',
  composeAddress({
    name:     '313 Orchard Road',
    fallback: '313 Orchard Road, Singapore',
    detailed: '313 Orchard Rd, Singapore 238895',
    types:    ROAD,
  }),
  '313 Orchard Rd, Singapore 238895')

check('a building (premise) also drops the name',
  composeAddress({
    name:     'Whitesands',
    fallback: 'Whitesands, Pasir Ris Central Street 3, Singapore',
    detailed: '1 Pasir Ris Central St 3, Singapore 518457',
    types:    ['premise', 'geocode'],
  }),
  '1 Pasir Ris Central St 3, Singapore 518457')

// Google sometimes already leads with the name — never say it twice.
check('name already in the address is not repeated',
  composeAddress({
    name:     'Capitol Optical',
    fallback: 'Capitol Optical, Singapore',
    detailed: 'Capitol Optical, 1 Kim Seng Promenade, Singapore 237994',
    types:    SHOP,
  }),
  'Capitol Optical, 1 Kim Seng Promenade, Singapore 237994')

// The lookup can fail (offline, quota, Google down) — the box must still get
// the text the person picked.
check('no detailed address → the suggestion text stands',
  composeAddress({
    name:     'Capitol Optical (Great World City)',
    fallback: 'Capitol Optical (Great World City), Kim Seng Promenade, Singapore',
    detailed: '',
    types:    SHOP,
  }),
  'Capitol Optical (Great World City), Kim Seng Promenade, Singapore')

check('no name → the detailed address alone',
  composeAddress({ name: '', fallback: 'somewhere', detailed: '1 Kim Seng Promenade, Singapore', types: SHOP }),
  '1 Kim Seng Promenade, Singapore')

check('no types → treated as an address, not a shop',
  composeAddress({ name: 'Somewhere', fallback: 'Somewhere', detailed: '1 Kim Seng Promenade', types: [] }),
  '1 Kim Seng Promenade')

// ── shouldSuggestAddresses (Nic, 2026-09-14) ──
// The suggestion list dropped open the moment a saved job was opened, because
// loading an address into the box looked identical to typing one.
const suggest = (over: Partial<Parameters<typeof shouldSuggestAddresses>[0]> = {}) =>
  shouldSuggestAddresses({ value: 'Tampines Street 81', disabled: false, userEdited: true, justPicked: false, ...over })

check('the reported bug: a saved address on form load does NOT suggest',
  suggest({ userEdited: false }), false)
check('typing does suggest', suggest(), true)
check('a short entry does not suggest', suggest({ value: 'te' }), false)
check('three characters is enough', suggest({ value: 'tes' }), true)
check('whitespace does not count towards the minimum', suggest({ value: '  a  ' }), false)
check('an empty box does not suggest', suggest({ value: '' }), false)
check('a read-only form never suggests', suggest({ disabled: true }), false)
check('the write straight after a pick does not re-open', suggest({ justPicked: true }), false)
check('the detailed-address swap does not re-open', suggest({ justPicked: true, value: '#02-110, 1 Kim Seng Promenade' }), false)
check('disabled beats everything', suggest({ disabled: true, userEdited: true, justPicked: false }), false)

// ── Previous-address offer after a Duplicate (Nic, 2026-09-15) ───────────────
// Duplicate used to COPY the source job's address into the copy. For a bulk
// order — 18 Cold Storage branches on one date — that address is wrong every
// single time, and an unedited copy looks finished. The copy now starts BLANK
// and the old address is offered underneath as a one-tap fill, so nothing is
// retyped and nothing is silently inherited.
console.log('\nshouldOfferPreviousLocation:')

const offer = (over: Partial<Parameters<typeof shouldOfferPreviousLocation>[0]> = {}) =>
  shouldOfferPreviousLocation({
    current:  '',
    previous: 'Cold Storage Takashimaya, 391A Orchard Rd, Singapore 238872',
    disabled: false,
    ...over,
  })

check('an empty box with a previous address offers it', offer(), true)
check('once the user has typed, the offer is gone', offer({ current: 'Jelita' }), false)
check('no previous address, nothing to offer', offer({ previous: '' }), false)
check('a whitespace-only previous address is not a real one', offer({ previous: '   ' }), false)
check('a whitespace-only box still counts as empty', offer({ current: '   ' }), true)
// Using or dismissing the offer drops `previous` — the caller's job, and the
// same state as having nothing to offer in the first place.
check('using or dismissing it ends the offer', offer({ previous: null }), false)
check('a read-only form never offers', offer({ disabled: true }), false)

// THE OLD BEHAVIOUR, asserted so this test can prove it catches the real thing:
// before 2026-09-15 the copy arrived carrying the source address, so the box was
// never empty and no offer could ever apply. A regression that re-copies the
// address makes `current` non-empty, which this check pins.
check('a copy that arrives pre-filled is the bug — no offer', offer({ current: 'Cold Storage Takashimaya, 391A Orchard Rd, Singapore 238872' }), false)

// Safety property this change buys: a blank copy cannot reach the schedule,
// because Location is one of the six fields required on Push to Schedule.
check('a blank copy cannot be pushed until its address is filled', REQUIRED_JOB_FIELDS.includes('location'), true)

// ── Who may tick "Production ready" / "DO issued" (Nic, 2026-09-15) ──────────
// Sales joins the roles that can tick these, but ONLY on jobs where they are
// the Person-in-Charge (his call: own jobs, not everyone's). That matches the
// permission sales already holds in the database on their own jobs (0055/0056),
// so this stays a screen change with no migration — and a sales person who
// somehow tried it on a colleague's job would be refused by the database and
// told so, rather than the tick silently doing nothing.
console.log('\ncanTickProductionFlags:')

const tick = (over: Partial<Parameters<typeof canTickProductionFlags>[0]> = {}) =>
  canTickProductionFlags({ role: 'sales', isSalesPoc: true, readOnly: false, ...over })

check('sales may tick on their own job', tick(), true)
check('sales may NOT tick on a colleague\'s job', tick({ isSalesPoc: false }), false)
check('production still ticks any job', tick({ role: 'production', isSalesPoc: false }), true)
check('scheduler still ticks any job', tick({ role: 'scheduler', isSalesPoc: false }), true)
check('coordinator still ticks any job', tick({ role: 'coordinator', isSalesPoc: false }), true)
check('admin still ticks any job', tick({ role: 'admin', isSalesPoc: false }), true)
check('designer never ticks', tick({ role: 'designer', isSalesPoc: true }), false)
check('installer never ticks', tick({ role: 'installer', isSalesPoc: true }), false)
check('hr never ticks', tick({ role: 'hr', isSalesPoc: true }), false)
check('a read-only form beats every role', tick({ role: 'scheduler', readOnly: true }), false)
check('read-only beats sales on their own job', tick({ readOnly: true }), false)

// ── Silent Push to Schedule, admin only (Nic, 2026-09-15) ───────────────────
// Pushing a job normally Telegrams every scheduler. Nic wants a quiet push for
// backfilling work the team already knows about. The flag arrives in the
// REQUEST BODY, so the server must decide whether to honour it — otherwise any
// sales person could silence the schedulers by sending one extra field.
console.log('\nshouldNotifyOnPush:')

check('a normal push notifies', shouldNotifyOnPush({ realRole: 'sales', silentRequested: false }), true)
check('an admin asking for quiet gets quiet', shouldNotifyOnPush({ realRole: 'admin', silentRequested: true }), false)
check('an admin not asking still notifies', shouldNotifyOnPush({ realRole: 'admin', silentRequested: false }), true)

// THE SECURITY CASE: the flag is client-supplied, so a non-admin sending it
// must change nothing at all.
check('sales cannot silence the schedulers', shouldNotifyOnPush({ realRole: 'sales', silentRequested: true }), true)
check('a scheduler cannot silence either', shouldNotifyOnPush({ realRole: 'scheduler', silentRequested: true }), true)
check('a coordinator cannot silence either', shouldNotifyOnPush({ realRole: 'coordinator', silentRequested: true }), true)

// The REAL role decides, never the previewed one: getEffectiveRole never
// returns 'admin', so an admin previewing as sales is still an admin here.
check('a missing flag is a normal push', shouldNotifyOnPush({ realRole: 'admin', silentRequested: undefined }), true)

// ── Design brief locked until the job is on the schedule ────────────────────
// Follows from 0060 (Nic, 2026-09-15): designers can no longer see pending
// jobs, so a brief written on one — or a designer attached to one — would be
// invisible to the person it is for. The card unlocks when the job is pushed.
console.log('\ndesignBriefEditable:')

check('a scheduled job can be briefed', designBriefEditable({ status: 'scheduled', readOnly: false }), true)
check('a pending job cannot', designBriefEditable({ status: 'pending', readOnly: false }), false)
check('nor one awaiting approval', designBriefEditable({ status: 'awaiting_approval', readOnly: false }), false)
// Completed jobs were already locked by readOnly; this must not change that.
check('a completed job stays locked', designBriefEditable({ status: 'completed', readOnly: true }), false)
check('read-only beats a scheduled job', designBriefEditable({ status: 'scheduled', readOnly: true }), false)
// The New Job form has no job yet — nothing to brief against.
check('a job that does not exist yet cannot be briefed', designBriefEditable({ status: null, readOnly: false }), false)

console.log(failures === 0 ? '\nAll job-form rule checks passed.' : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)
