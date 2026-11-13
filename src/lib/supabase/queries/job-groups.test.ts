/**
 * Standalone test for reading the Jobs tab's group names (no framework).
 * Run: npx tsx src/lib/supabase/queries/job-groups.test.ts
 * Exits 1 on any failure.
 */
import { readJobGroups } from './job-groups'

let failures = 0
function check(name: string, ok: boolean) {
  if (ok) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}`); failures++ }
}

const client = (answer: { data: unknown; error: unknown }) => {
  const asked: string[][] = []
  return {
    asked,
    from: () => ({ select: () => ({ in: async (_col: string, ids: string[]) => { asked.push(ids); return answer } }) }),
  }
}

async function main() {
  const ok = client({ data: [{ id: 'g', name: 'Oakley' }], error: null })
  check('the names come back', JSON.stringify(await readJobGroups(ok, ['g'])) === JSON.stringify([{ id: 'g', name: 'Oakley' }]))

  const none = client({ data: null, error: null })
  check('no ids: nothing is asked, [] comes back', (await readJobGroups(none, [])).length === 0 && none.asked.length === 0)

  // Final review minor (Nic, 2026-11-13: fix): a failed read threw, and the
  // whole Jobs tab showed an error. The jobs show as plain rows instead.
  const broken = client({ data: null, error: { message: 'boom' } })
  const quiet = console.error
  console.error = () => {}
  let threw = false
  let got: unknown = null
  try { got = await readJobGroups(broken, ['g']) } catch { threw = true } finally { console.error = quiet }
  check('a failed read gives [] (plain rows), not an error page', !threw && Array.isArray(got) && got.length === 0)

  if (failures) { console.error(`\n${failures} group-read check(s) failed`); process.exit(1) }
  console.log('\nAll group-read checks passed')
}
main().catch(e => { console.error(e); process.exit(1) })
