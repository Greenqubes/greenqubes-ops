// Standalone test — run with: npx tsx src/lib/utils/user-meta.test.ts
// Exits 1 on failure (repo convention — no test framework).
import {
  linkStatus, buildUserMeta, filterUsers,
  subroleSuggestions, qualificationSuggestions,
  rolesPresent, filterPickerOptions,
  SUPPORT_CREW_ROLES, supportCrewPool, SUPPORT_CREW_FILTERS, departmentOf,
} from './user-meta'

let failed = 0
function check(name: string, cond: boolean) {
  if (cond) { console.log(`  ✓ ${name}`) } else { failed++; console.error(`  ✗ ${name}`) }
}
function eq<T>(name: string, got: T, want: T) {
  check(`${name} (got ${JSON.stringify(got)})`, JSON.stringify(got) === JSON.stringify(want))
}

console.log('linkStatus')
eq('no email → none (red dot)',               linkStatus({ email: null, auth_id: null }), 'none')
eq('email, never signed in → pending',        linkStatus({ email: 'a@b.c', auth_id: null }), 'pending')
eq('signed in → linked',                      linkStatus({ email: 'a@b.c', auth_id: 'uid' }), 'linked')
eq('auth without email (edge) → linked',      linkStatus({ email: null, auth_id: 'uid' }), 'linked')
eq('empty-string email counts as no email',   linkStatus({ email: '', auth_id: null }), 'none')

console.log('buildUserMeta')
eq('subrole wins', buildUserMeta({ role: 'production', subrole: 'metalworks' }).subroleLine, 'metalworks')
eq('falls back to role', buildUserMeta({ role: 'installer', subrole: null }).subroleLine, 'installer')
eq('empty subrole falls back', buildUserMeta({ role: 'installer', subrole: '  ' }).subroleLine, 'installer')
eq('no role no subrole → null', buildUserMeta({}).subroleLine, null)
eq('driver default false', buildUserMeta({ role: 'installer' }).isDriver, false)
eq('driver true carried', buildUserMeta({ role: 'installer', is_driver: true }).isDriver, true)
eq('qualifications default empty', buildUserMeta({}).qualifications, [])
eq('qualifications carried', buildUserMeta({ qualifications: ['WAH'] }).qualifications, ['WAH'])

console.log('filterUsers')
const users = [
  { role: 'production', subrole: 'metalworks' },
  { role: 'production', subrole: 'printing' },
  { role: 'production', subrole: null },
  { role: 'installer',  subrole: 'printing' },
]
eq('all/all keeps everything', filterUsers(users, 'all', 'all').length, 4)
eq('role filter', filterUsers(users, 'production', 'all').length, 3)
eq('subrole filter', filterUsers(users, 'all', 'printing').length, 2)
eq('role+subrole', filterUsers(users, 'production', 'printing').length, 1)
eq('none = missing subrole', filterUsers(users, 'all', 'none').length, 1)
eq('none + role', filterUsers(users, 'installer', 'none').length, 0)

console.log('suggestions')
eq('subroles distinct+sorted for role',
   subroleSuggestions([
     { role: 'production', subrole: 'printing' },
     { role: 'production', subrole: 'metalworks' },
     { role: 'production', subrole: 'printing' },
     { role: 'installer',  subrole: 'rigging' },
     { role: 'production', subrole: null },
   ], 'production'),
   ['metalworks', 'printing'])
eq('qualifications distinct+sorted',
   qualificationSuggestions([
     { qualifications: ['WAH', 'Safety Supervisor'] },
     { qualifications: ['WAH'] },
     { qualifications: null },
   ]),
   ['Safety Supervisor', 'WAH'])

console.log('rolesPresent (job-form picker role strip)')
const people = [
  { id: '1', label: 'Ali B',       role: 'sales' },
  { id: '2', label: 'Ali Ramjan',  role: 'production' },
  { id: '3', label: 'Aroze',       role: 'coordinator' },
  { id: '4', label: 'Benny Teo',   role: 'sales' },
  { id: '5', label: 'Billy',       role: 'designer' },
]
eq('canonical order, deduped, only roles present',
   rolesPresent(people), ['sales', 'coordinator', 'designer', 'production'])
eq('empty list has no roles',            rolesPresent([]), [])
// Typed the way a real picker declares its options — role optional, absent here.
const roleless: Array<{ label: string; role?: string | null }> = [{ label: 'Acme Pte Ltd' }]
eq('options without a role are ignored', rolesPresent(roleless), [])
eq('null role ignored',                  rolesPresent([{ label: 'x', role: null }]), [])

console.log('filterPickerOptions')
const labels = (r: string, q: string) => filterPickerOptions(people, r, q).map(o => o.label)
eq('all + no query returns everything',  labels('all', ''), ['Ali B', 'Ali Ramjan', 'Aroze', 'Benny Teo', 'Billy'])
eq('role narrows to that role',          labels('sales', ''), ['Ali B', 'Benny Teo'])
eq('query is case-insensitive',          labels('all', 'ALI'), ['Ali B', 'Ali Ramjan'])
eq('query matches mid-label',            labels('all', 'teo'), ['Benny Teo'])
eq('role and query combine',             labels('sales', 'ali'), ['Ali B'])
eq('whitespace query ignored',           labels('sales', '   '), ['Ali B', 'Benny Teo'])
eq('no match returns empty',             labels('designer', 'zzz'), [])
eq('role with no members returns empty', labels('scheduler', ''), [])
eq('roleless option hidden by a specific role',
   filterPickerOptions(roleless, 'sales', '').length, 0)
eq('roleless option still searchable under all',
   filterPickerOptions(roleless, 'all', 'acme').length, 1)

console.log('\nsupportCrewPool:')
// Nic, 2026-09-28: a role filter under Support crew like the admin one, with
// Sales, HR / Finance, Admin and Designer taken OUT of the list entirely.
const crew = [
  { id: 'ck',  name: 'CK',         role: 'installer'   },
  { id: 'ali', name: 'Ali B',      role: 'production'  },
  { id: 'bt',  name: 'Benny Teo',  role: 'scheduler'   },
  { id: 'br',  name: 'Bryan',      role: 'admin'       },
  { id: 'co',  name: 'Charles Ow', role: 'sales'       },
  { id: 'wj',  name: 'Wan Jun',    role: 'designer'    },
  { id: 'hr',  name: 'Hana',       role: 'hr'          },
  { id: 'cd',  name: 'Cody',       role: 'coordinator' },
]
const ids = (role: string, keep: string[] = []) => supportCrewPool(crew, role, new Set(keep)).map(u => u.id)
eq('filter buttons are the four dispatchable roles, in admin order',
   SUPPORT_CREW_ROLES, ['scheduler', 'coordinator', 'installer', 'production'])
// THE REQUEST: before this, sales/admin/designer (Charles Ow, Bryan) sat in the list.
eq('All drops sales, hr, admin and designer', ids('all'), ['ck', 'ali', 'bt', 'cd'])
eq('a role button narrows to that role',      ids('production'), ['ali'])
eq('scheduler button',                        ids('scheduler'), ['bt'])
// Someone from an excluded role ALREADY on this job's crew must stay visible,
// or they could never be taken off again.
eq('an excluded person already on the crew stays under All', ids('all', ['co']), ['ck', 'ali', 'bt', 'co', 'cd'])
eq('...but a role button still filters them out',            ids('installer', ['co']), ['ck'])
eq('an excluded role shows nobody', ids('sales'), [])

console.log('\nSupport crew department pills:')
// Nic, 2026-10-26 (the scheduler's request): the Production pill lumped every
// trade together. It becomes five department pills, matched on the person's
// department label. Real people and labels from the live users table.
const prod = (id: string, subrole: string | null) => ({ id, name: id, role: 'production', subrole })
const team = [
  prod('Ali B', 'Carpenter'), prod('Aroze', 'Carpenter'), prod('Billy', 'Carpenter'),
  prod('Wen Bing', 'Senior Carpenter'), prod('You Sheng', 'Assistant Carpenter'),
  prod('Ali Ramjan', 'Painter'), prod('Sujan', 'Painter'),
  prod('Firoz', 'Metalwork'), prod('Hai Fa', 'Metalwork'), prod('Halim', 'Metalwork'), prod('Xiao Chen', 'Metalwork'),
  prod('Jing Dong', 'Printing'), prod('Kong Yang', 'Printing'), prod('Yang Lei', 'Printing'),
  prod('Thoa', 'Electrician'),
  prod('New Welder', 'Welder'),                     // a trade with no pill yet
  prod('No Label', null),
  { id: 'CK', name: 'CK', role: 'installer', subrole: null },
  { id: 'Sales Carpenter', name: 'x', role: 'sales', subrole: 'Carpenter' },   // excluded role
]
const dept = (filter: string, keep: string[] = []) => supportCrewPool(team, filter, new Set(keep)).map(u => u.id)
eq('pills: Production replaced by the five departments',
   SUPPORT_CREW_FILTERS,
   ['all', 'scheduler', 'coordinator', 'installer', 'carpentry', 'painter', 'metalwork', 'printing', 'electrician'])
eq('Carpentry — senior and assistant carpenters included',
   dept('carpentry'), ['Ali B', 'Aroze', 'Billy', 'Wen Bing', 'You Sheng'])
eq('Painter',     dept('painter'),     ['Ali Ramjan', 'Sujan'])
eq('Metalwork',   dept('metalwork'),   ['Firoz', 'Hai Fa', 'Halim', 'Xiao Chen'])
eq('Printing',    dept('printing'),    ['Jing Dong', 'Kong Yang', 'Yang Lei'])
eq('Electrician', dept('electrician'), ['Thoa'])
eq('a trade with no pill, or no label, still shows under All',
   dept('all').filter(i => i === 'New Welder' || i === 'No Label'), ['New Welder', 'No Label'])
eq('an excluded role is never in a department pill', dept('carpentry').includes('Sales Carpenter'), false)
eq('label wording, not exact text', [
  departmentOf('Metal works'), departmentOf('  PAINTER '), departmentOf('Asst. Printing'),
  departmentOf('Welder'), departmentOf(null), departmentOf(''),
], ['metalwork', 'painter', 'printing', null, null, null])

if (failed > 0) { console.error(`\n${failed} check(s) failed`); process.exit(1) }
console.log('\nAll user-meta checks passed')
