/**
 * Standalone test for the Client Contact No. auto-fill (no test framework).
 * Run: npx tsx src/lib/utils/client-phone.test.ts
 * Exits 1 on any failure.
 */
import { sameName, likePattern, lastNumberFor, phoneAfterPick, type PastClientJob } from './client-phone'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`); failures++ }
}

console.log('sameName:')
check('capitals and outside spaces do not matter', sameName('Cynthia', '  cynthia '), true)
check('double spaces inside do not matter', sameName('David  Seet', 'david seet'), true)
check('a longer name is a different person', sameName('Cynthia', 'Cynthia Tan'), false)
check('blank never matches blank', sameName('', '  '), false)
check('missing never matches', sameName(null, 'Cynthia'), false)

console.log('likePattern:')
check('words joined loosely, so extra spaces still match', likePattern(' BINJAI  INTERIOR '), '%BINJAI%INTERIOR%')
check('% and _ in a name are searched for literally', likePattern('50% Off_Shop'), '%50\\%%Off\\_Shop%')

const BINJAI = 'BINJAI INTERIOR DESIGN PTE LTD'
const job = (id: string, client: string | null, name: string | null, phone: string | null, date: string | null, created: string): PastClientJob =>
  ({ id, client, client_poc_name: name, client_poc_phone: phone, date, created_at: created })
const JOBS: PastClientJob[] = [
  job('old',     BINJAI,                 'Cynthia', '8888 0000', '2026-09-01', '2026-08-20T03:00:00Z'),
  job('latest',  BINJAI,                 'Cynthia', '9123 4567', '2026-10-12', '2026-10-01T03:00:00Z'),
  job('blank',   BINJAI,                 'Cynthia', '   ',       '2026-10-30', '2026-10-20T03:00:00Z'),
  job('elsewhere', 'ASICS Asia Pte Ltd', 'Cynthia', '7777 1111', '2026-10-28', '2026-10-25T03:00:00Z'),
  job('nophone', BINJAI,                 'David',   null,        '2026-10-02', '2026-10-02T03:00:00Z'),
  job('ongoing', 'binjai interior design pte ltd ', 'yawai', '9000 1234', null, '2026-10-15T03:00:00Z'),
]

console.log('lastNumberFor:')
check('THE FEATURE: picking Cynthia at Binjai finds her last number',
  lastNumberFor(JOBS, BINJAI, 'Cynthia'), { phone: '9123 4567', date: '2026-10-12' })
check('newest job wins, not the first one found',
  lastNumberFor(JOBS.slice().reverse(), BINJAI, 'Cynthia')?.phone, '9123 4567')
const byId = (...ids: string[]) => JOBS.filter(j => ids.includes(j.id))
check('a job with a blank number is skipped, even though it is newer',
  lastNumberFor(byId('blank', 'old'), BINJAI, 'Cynthia')?.phone, '8888 0000')
check('a Cynthia at another company is never used, even though hers is newest',
  lastNumberFor(byId('elsewhere', 'old'), BINJAI, 'Cynthia')?.phone, '8888 0000')
check('capitals and spaces in company and name are ignored',
  lastNumberFor(JOBS, BINJAI, 'Yawai'), { phone: '9000 1234', date: '2026-10-15' })
check('no install date yet → the date the job was made',
  lastNumberFor(JOBS, BINJAI, 'Yawai')?.date, '2026-10-15')
check('the job being edited is skipped',
  lastNumberFor(JOBS, BINJAI, 'Cynthia', 'latest')?.phone, '8888 0000')
check('nobody ever typed a number for David → nothing',
  lastNumberFor(JOBS, BINJAI, 'David'), null)
check('a client never seen → nothing', lastNumberFor(JOBS, BINJAI, 'Doris'), null)

const CYNTHIA = { company: BINJAI, name: 'Cynthia' }
const found = (phone: string) => ({ phone, date: '2026-10-12' })

console.log('phoneAfterPick:')
check('empty box + a past number → filled in, with where it came from',
  phoneAfterPick({ previous: null, next: { company: BINJAI, name: 'David' }, current: '', found: found('9876 5432') }),
  { phone: '9876 5432', hint: { kind: 'filled', name: 'David', date: '2026-10-12' } })
check('Cynthia → David, David has a number → it replaces Cynthia\'s',
  phoneAfterPick({ previous: CYNTHIA, next: { company: BINJAI, name: 'David' }, current: '9123 4567', found: found('9876 5432') }),
  { phone: '9876 5432', hint: { kind: 'filled', name: 'David', date: '2026-10-12' } })
check('NIC\'S RULE: Cynthia → David, David has none → box empties, Cynthia\'s number offered back',
  phoneAfterPick({ previous: CYNTHIA, next: { company: BINJAI, name: 'David' }, current: '9123 4567', found: null }),
  { phone: '', hint: { kind: 'reuse', name: 'Cynthia', phone: '9123 4567' } })
check('no past number and an empty box → nothing happens',
  phoneAfterPick({ previous: CYNTHIA, next: { company: BINJAI, name: 'David' }, current: '', found: null }),
  { hint: null })
check('a number typed before any name was picked is not overwritten — offered instead',
  phoneAfterPick({ previous: null, next: { company: BINJAI, name: 'David' }, current: '9999 0000', found: found('9876 5432') }),
  { hint: { kind: 'offer', name: 'David', phone: '9876 5432' } })
check('…and nothing is offered when it is the same number written differently',
  phoneAfterPick({ previous: null, next: { company: BINJAI, name: 'David' }, current: '98765432', found: found('9876 5432') }),
  { hint: null })
check('…and nothing happens when the picked name has no past number',
  phoneAfterPick({ previous: null, next: { company: BINJAI, name: 'David' }, current: '9999 0000', found: null }),
  { hint: null })
check('changing the company counts as switching, even to another "Cynthia"',
  phoneAfterPick({ previous: CYNTHIA, next: { company: 'ASICS Asia Pte Ltd', name: 'Cynthia' }, current: '9123 4567', found: found('7777 1111') }),
  { phone: '7777 1111', hint: { kind: 'filled', name: 'Cynthia', date: '2026-10-12' } })
check('…and offers the old number back when the new company\'s person has none',
  phoneAfterPick({ previous: CYNTHIA, next: { company: 'ASICS Asia Pte Ltd', name: 'Doris' }, current: '9123 4567', found: null }),
  { phone: '', hint: { kind: 'reuse', name: 'Cynthia', phone: '9123 4567' } })
check('picking the same person again never overwrites what is in the box',
  phoneAfterPick({ previous: CYNTHIA, next: { company: BINJAI, name: ' cynthia' }, current: '9555 0000', found: found('9123 4567') }),
  { hint: { kind: 'offer', name: ' cynthia', phone: '9123 4567' } })

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nall passed')
