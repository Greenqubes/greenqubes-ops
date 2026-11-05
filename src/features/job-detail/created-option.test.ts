// Standalone test — run with: npx tsx src/features/job-detail/created-option.test.ts
// Exits 1 on failure (repo convention — no test framework).
//
// Crash 2026-10-21 / 2026-11-04 on /jobs/new: "Cannot read properties of
// undefined (reading 'localeCompare')". Adding a new company / client name
// that the server refused (it answers { error } with no name) put a nameless
// option into the list, and sorting the list by name crashed the whole form.
import { createdOption } from './CoreSection'

let failed = 0
function check(name: string, ok: boolean) {
  if (ok) { console.log(`  ✓ ${name}`) } else { failed++; console.error(`  ✗ ${name}`) }
}

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

async function throws(res: Response): Promise<boolean> {
  try { await createdOption(res); return false } catch { return true }
}

async function main() {
  console.log('createdOption — a refused add never becomes a nameless option')

  const ok = await createdOption(reply(200, { id: 'c1', name: 'Umi Beauty' }))
  check('a created company comes back as { id, label }', ok.id === 'c1' && ok.label === 'Umi Beauty')

  const list = [{ id: 'a', label: 'Acme' }, { id: 'z', label: 'Zeta' }]
  const sorted = [...list, ok].sort((a, b) => a.label.localeCompare(b.label)).map(o => o.label)
  check('the new option sorts into the list by name', JSON.stringify(sorted) === JSON.stringify(['Acme', 'Umi Beauty', 'Zeta']))

  check('name already taken (500 { error }) → throws', await throws(reply(500, { error: 'duplicate key value violates unique constraint "clients_name_key"' })))
  check('signed out (401 { error }) → throws', await throws(reply(401, { error: 'Unauthorized' })))
  check('not allowed (403 { error }) → throws', await throws(reply(403, { error: 'Forbidden' })))
  check('a reply with no name, even if OK → throws', await throws(reply(200, {})))
  check('a reply that is not JSON → throws', await throws(new Response('<html>502</html>', { status: 502 })))

  // The old code built { id: data.id, label: data.name } from whatever came
  // back — pinned here so the test shows the crash it guards against.
  const old = { id: undefined as unknown as string, label: (({ error: 'x' }) as { name?: string }).name as string }
  let oldCrashed = false
  try { [...list, old].sort((a, b) => a.label.localeCompare(b.label)) } catch { oldCrashed = true }
  check('(old behaviour) a nameless option crashes the sort', oldCrashed)

  if (failed > 0) { console.error(`\n${failed} failed`); process.exit(1) }
  console.log('\nall passed')
}

void main()
