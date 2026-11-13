/**
 * Standalone test for the Jobs tab group rules (no framework).
 * Run: npx tsx src/lib/utils/job-groups.test.ts
 * Exits 1 on any failure.
 */
import {
  canChangeGroups, suggestGroupName, titleInGroup, foldGroups, groupSummary, filterWithGroups,
  pickerGroups, tickState, tickAll, openOnLoad, parseGroupBody, countKey, GROUP_NAME_MAX, type JobGroup,
} from './job-groups'
import type { Role } from '@/lib/supabase/types'

let failures = 0
function check(name: string, ok: boolean) {
  if (ok) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}`); failures++ }
}

type J = { id: string; group_id: string | null; project_title: string | null; client: string; location: string }
const job = (id: string, group_id: string | null, project_title: string | null = id, client = 'Client', location = 'Loc'): J =>
  ({ id, group_id, project_title, client, location })

const a = job('a', 'g1'), b = job('b', null), c = job('c', 'g1'), d = job('d', 'g2'), e = job('e', 'gX')
const T1 = 'Deliver Oakley & RB A4 Tentcard - Eyechamp NEX'
const T2 = 'Deliver Oakley & RB A4 Tentcard - J Glasses (PLQ)'
const jobsInG1 = [
  job('o1', 'g1', T1, 'Luxottica', 'Singapore'),
  job('o2', 'g1', T2, 'Luxottica', 'Singapore'),
  job('o3', 'g1', 'Deliver Oakley & RB A4 Tentcard - Owndays Jem', 'Luxottica', 'Singapore'),
]
const G = new Map<string, JobGroup>([['g1', { id: 'g1', name: 'One' }], ['g2', { id: 'g2', name: 'Two' }]])

console.log('Group name fill')
check('name from shared start, cut at " - "', suggestGroupName([T1, T2]) === 'Deliver Oakley & RB A4 Tentcard')
check('name cut back to a word boundary', suggestGroupName(['Fossil window change - CCP', 'Fossil window cleaning']) === 'Fossil window')
check('nothing shared → empty', suggestGroupName(['Alpha', 'Beta']) === '')
check('trailing separator trimmed', suggestGroupName(['Daikin - A', 'Daikin - B']) === 'Daikin')
check('one title → that title', suggestGroupName(['Daikin AOMM']) === 'Daikin AOMM')
check('capped at GROUP_NAME_MAX', GROUP_NAME_MAX === 120 && suggestGroupName(['x'.repeat(300)]).length === 120)

console.log('Title inside a group')
check('inside a group: rest of the title', titleInGroup(T1, 'Deliver Oakley & RB A4 Tentcard') === 'Eyechamp NEX')
check('case-insensitive start', titleInGroup(T1, 'deliver oakley & rb a4 tentcard') === 'Eyechamp NEX')
check('title not starting with the name → whole title', titleInGroup('Fossil window', 'Deliver Oakley') === 'Fossil window')
check('title equal to the name → whole title', titleInGroup('Daikin', 'Daikin') === 'Daikin')
check('name ending mid-word → whole title', titleInGroup('Daikinx Jem', 'Daikin') === 'Daikinx Jem')
check('separators ":" and "–" stripped too', titleInGroup('Daikin: Jem', 'Daikin') === 'Jem' && titleInGroup('Daikin – Jem', 'Daikin') === 'Jem')

console.log('Folding')
const fold = foldGroups([a, b, c, d, e], G)
check('group sits where its first job sits', fold.map(f => f.kind === 'job' ? f.job.id : f.group.id).join() === 'g1,b,g2,e')
check('group holds its jobs in list order', fold[0].kind === 'group' && fold[0].jobs.map(j => j.id).join() === 'a,c')
check('unknown group id → plain row', fold[3].kind === 'job')
check('empty in, empty out', foldGroups([], G).length === 0)

console.log('Group summary')
const shared = groupSummary([{ client: 'Luxottica', salesName: 'Nicholas' }, { client: 'Luxottica', salesName: 'Nicholas' }])
check('summary: shared company and sales', shared.client === 'Luxottica' && shared.salesName === 'Nicholas')
check('summary: mixed → null',
  groupSummary([{ client: 'A', salesName: 'N' }, { client: 'B', salesName: null }]).client === null
  && groupSummary([{ client: 'A', salesName: 'N' }, { client: 'A', salesName: null }]).salesName === null)

console.log('Who can change groups')
check('editors', (['sales', 'coordinator', 'scheduler'] as Role[]).every(r => canChangeGroups(r, false)))
check('viewers only', (['designer', 'production', 'hr', 'installer'] as Role[]).every(r => !canChangeGroups(r, false)))
check('real admin always', canChangeGroups('designer', true))

console.log('Search')
check('search: job word → only matching jobs of the group', filterWithGroups(jobsInG1, G, 'eyechamp').map(j => j.id).join() === 'o1')
check('search: group name → every job of the group', filterWithGroups(jobsInG1, G, 'one').length === jobsInG1.length)
check('search: empty → all', filterWithGroups(jobsInG1, G, '  ').length === jobsInG1.length)

console.log('Existing-group picker')
const picked = pickerGroups([{ group_id: 'g2' }, { group_id: 'g2' }, { group_id: null }], G)
check('picker: only groups with a visible job, by name, counted',
  picked.length === 1 && picked[0].id === 'g2' && picked[0].name === 'Two' && picked[0].count === 2)

console.log('Ticks')
check('tick state', tickState(new Set(['a']), ['a', 'c']) === 'some' && tickState(new Set(['a', 'c']), ['a', 'c']) === 'all' && tickState(new Set(), ['a']) === 'none')
check('tick group: some → all', [...tickAll(new Set(['a', 'x']), ['a', 'c'])].sort().join() === 'a,c,x')
check('tick group: all → none of them', [...tickAll(new Set(['a', 'c', 'x']), ['a', 'c'])].join() === 'x')

console.log('Open on load')
check('highlighted job inside a group opens it', openOnLoad('c', [a, b, c]) === 'g1')
check('highlighted plain job / none → null', openOnLoad('b', [a, b]) === null && openOnLoad(null, [a]) === null)

console.log('One job or many')
check('1 → the singular text', countKey(1, 'groupAddedOne', 'groupAdded') === 'groupAddedOne')
check('0 and 2+ → the plural text', countKey(0, 'a', 'b') === 'b' && countKey(2, 'a', 'b') === 'b' && countKey(20, 'a', 'b') === 'b')

console.log('Request shape')
// Ids are uuids, as the database's are.
const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const JA = uid(1), JB = uid(2), GX = uid(9), LX = 'abcdef01-2345-4678-9abc-def012345678'
const created = parseGroupBody({ action: 'create', name: '  Oakley ', jobIds: [JA, JA, JB] })
check('body: create trims, dedupes', JSON.stringify(created) === JSON.stringify({ action: 'create', name: 'Oakley', jobIds: [JA, JB] }))
check('body: add / remove / rename / ungroup accepted',
  parseGroupBody({ action: 'add', groupId: GX, jobIds: [JA] }) !== null
  && parseGroupBody({ action: 'remove', jobIds: [JA] }) !== null
  && parseGroupBody({ action: 'rename', groupId: GX, name: 'N' }) !== null
  && parseGroupBody({ action: 'ungroup', groupId: GX }) !== null)
check('body: an upper-case uuid is accepted', parseGroupBody({ action: 'ungroup', groupId: LX.toUpperCase() }) !== null)
check('body: the same job in two cases counts once', JSON.stringify(parseGroupBody({ action: 'remove', jobIds: [LX, LX.toUpperCase()] })) === JSON.stringify({ action: 'remove', jobIds: [LX] }))
check('body: refused', [
  { action: 'create', name: '   ', jobIds: [JA] }, { action: 'create', name: 'x'.repeat(121), jobIds: [JA] },
  { action: 'add', groupId: GX, jobIds: [] }, { action: 'add', groupId: GX, jobIds: Array(201).fill(0).map((_, i) => uid(i)) },
  { action: 'remove', jobIds: [5] }, { action: 'rename', groupId: '', name: 'N' }, { action: 'explode' }, null, 'x',
].every(raw => parseGroupBody(raw) === null))
// Final review minor (Nic, 2026-11-13: fix): a non-uuid id reached the
// database, which answered with an error the route turned into a 500.
check('body: a non-uuid job id is refused (400, not 500)', parseGroupBody({ action: 'remove', jobIds: [JA, 'abc'] }) === null)
check('body: a non-uuid group id is refused', [
  { action: 'add', groupId: 'g', jobIds: [JA] }, { action: 'rename', groupId: 'not-a-uuid', name: 'N' },
  { action: 'ungroup', groupId: `${GX}x` }, { action: 'ungroup', groupId: ` ${GX}` },
].every(raw => parseGroupBody(raw) === null))

if (failures) { console.error(`\n${failures} group check(s) failed`); process.exit(1) }
console.log('\nAll job-groups checks passed')
