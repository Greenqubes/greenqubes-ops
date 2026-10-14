// Standalone test — run with: npx tsx src/lib/utils/or-empty.test.ts
// Exits 1 on failure (repo convention — no test framework).
import { orEmpty } from './or-empty'

let failed = 0
function eq<T>(name: string, got: T, want: T) {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (ok) { console.log(`  ✓ ${name}`) } else { failed++; console.error(`  ✗ ${name} (got ${JSON.stringify(got)})`) }
}

async function main() {
  console.log('orEmpty — a warning-only feature must never break a core page (review I3)')
  const quiet = () => {}
  eq('passes data through', await orEmpty(async () => [1, 2], 'x', quiet), [1, 2])
  eq('a thrown error becomes an empty list', await orEmpty(async () => { throw new Error('relation "away_trips" does not exist') }, 'x', quiet), [])
  let logged = ''
  await orEmpty(async () => { throw new Error('boom') }, '[away] trips', (m: string) => { logged = m })
  eq('the failure is still logged with its label', logged.startsWith('[away] trips'), true)

  if (failed > 0) { console.error(`\n${failed} failed`); process.exit(1) }
  console.log('\nall passed')
}
main()
