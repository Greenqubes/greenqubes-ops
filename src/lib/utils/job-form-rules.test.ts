/**
 * Standalone test for job-form rules (no test framework).
 * Run: npx tsx src/lib/utils/job-form-rules.test.ts
 * Exits 1 on any failure.
 */

import {
  REQUIRED_JOB_FIELDS,
  missingRequiredJobFields,
  extractDialNumber,
  punctualityFor,
  endDateBeforeStart,
  mapsSearchUrl,
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

console.log(failures === 0 ? '\nAll job-form rule checks passed.' : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)
