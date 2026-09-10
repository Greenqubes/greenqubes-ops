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

console.log(failures === 0 ? '\nAll job-form rule checks passed.' : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)
