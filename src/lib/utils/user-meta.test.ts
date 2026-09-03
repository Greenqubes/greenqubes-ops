// Standalone test — run with: npx tsx src/lib/utils/user-meta.test.ts
// Exits 1 on failure (repo convention — no test framework).
import {
  linkStatus, buildUserMeta, filterUsers,
  subroleSuggestions, qualificationSuggestions,
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

if (failed > 0) { console.error(`\n${failed} check(s) failed`); process.exit(1) }
console.log('\nAll user-meta checks passed')
