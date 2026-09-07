// Standalone test — run with: npx tsx src/lib/utils/user-meta.test.ts
// Exits 1 on failure (repo convention — no test framework).
import {
  linkStatus, buildUserMeta, filterUsers,
  subroleSuggestions, qualificationSuggestions,
  rolesPresent, filterPickerOptions,
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

if (failed > 0) { console.error(`\n${failed} check(s) failed`); process.exit(1) }
console.log('\nAll user-meta checks passed')
