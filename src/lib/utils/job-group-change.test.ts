/**
 * Standalone test for the order of writes behind a Jobs tab group change
 * (no framework). Run: npx tsx src/lib/utils/job-group-change.test.ts
 * Exits 1 on any failure.
 *
 * The store below behaves like the database after 0073: a group still
 * holding a job can't be deleted ('in_use'), instead of quietly unfolding it.
 */
import { applyGroupChange, type GroupStore } from './job-group-change'

let failures = 0
function check(name: string, ok: boolean) {
  if (ok) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}`); failures++ }
}

type Fake = GroupStore & {
  jobs: Map<string, string | null>
  groups: Set<string>
  failSetGroup?: boolean
  failCount?: boolean
  /** Runs between the emptiness count and the delete: someone else's add. */
  meanwhile?: () => void
}
function fake(jobs: Record<string, string | null>, groups: string[]): Fake {
  let next = 0
  const s: Fake = {
    jobs: new Map(Object.entries(jobs)),
    groups: new Set(groups),
    groupsOf: async ids => [...new Set(ids.map(id => s.jobs.get(id)).filter((g): g is string => !!g))],
    createGroup: async () => { const id = `new${++next}`; s.groups.add(id); return id },
    setGroup: async (g, ids) => {
      if (s.failSetGroup) throw new Error('update failed')
      for (const id of ids) s.jobs.set(id, g)
    },
    clearGroup: async g => { for (const [id, v] of s.jobs) if (v === g) s.jobs.set(id, null); s.meanwhile?.() },
    renameGroup: async () => {},
    countJobs: async g => {
      if (s.failCount) throw new Error('count failed')
      const n = [...s.jobs.values()].filter(v => v === g).length
      s.meanwhile?.()
      return n
    },
    deleteGroup: async g => {
      if ([...s.jobs.values()].includes(g)) return 'in_use'
      s.groups.delete(g)
      return 'deleted'
    },
  }
  return s
}
const rejects = async (p: Promise<unknown>) => { try { await p; return false } catch { return true } }

async function main() {
  console.log('Making a group')
  {
    const s = fake({ a: null, b: null }, [])
    const out = await applyGroupChange(s, { action: 'create', name: 'N', jobIds: ['a', 'b'] }, 'me')
    check('create: the jobs join the new group, whose id comes back',
      out.groupId === 'new1' && s.jobs.get('a') === 'new1' && s.jobs.get('b') === 'new1')
  }
  {
    // Final review minor (Nic, 2026-11-13: fix): the group was made, the jobs
    // update failed, and an empty group nobody could see was left behind.
    const s = fake({ a: null }, [])
    s.failSetGroup = true
    const failed = await rejects(applyGroupChange(s, { action: 'create', name: 'N', jobIds: ['a'] }, 'me'))
    check('create: a failed job update takes the new group away again', failed && s.groups.size === 0)
  }
  {
    const s = fake({ a: 'old', b: 'old', c: 'keep', d: 'keep' }, ['old', 'keep'])
    await applyGroupChange(s, { action: 'create', name: 'N', jobIds: ['a', 'b', 'c'] }, 'me')
    check('create: a group the jobs left empty is deleted; one still holding a job stays',
      !s.groups.has('old') && s.groups.has('keep'))
  }

  console.log('Adding and taking out')
  {
    const s = fake({ a: null }, ['g'])
    const out = await applyGroupChange(s, { action: 'add', groupId: 'g', jobIds: ['a'] }, 'me')
    check('add: the job joins, the group id comes back', out.groupId === 'g' && s.jobs.get('a') === 'g')
  }
  {
    const s = fake({ a: 'g', b: 'g' }, ['g'])
    await applyGroupChange(s, { action: 'remove', jobIds: ['a'] }, 'me')
    check('remove: the group keeps its other job', s.jobs.get('a') === null && s.groups.has('g'))
    await applyGroupChange(s, { action: 'remove', jobIds: ['b'] }, 'me')
    check('remove: the last job out deletes the group', !s.groups.has('g'))
  }
  {
    // Final review minor (Nic, 2026-11-13: fix): the count said empty, then
    // someone else added a job before the delete, which unfolded it again.
    const s = fake({ a: 'g', other: null }, ['g'])
    s.meanwhile = () => { s.jobs.set('other', 'g'); s.meanwhile = undefined }
    const ok = !(await rejects(applyGroupChange(s, { action: 'remove', jobIds: ['a'] }, 'me')))
    check('remove: a job added between the count and the delete keeps the group, and the change still succeeds',
      ok && s.groups.has('g') && s.jobs.get('other') === 'g')
  }
  {
    const s = fake({ a: 'g' }, ['g'])
    s.failCount = true
    const ok = !(await rejects(applyGroupChange(s, { action: 'remove', jobIds: ['a'] }, 'me')))
    check('remove: a failed tidy-up does not fail the change', ok && s.jobs.get('a') === null)
  }

  console.log('Rename and ungroup')
  {
    const s = fake({ a: 'g', hidden: 'g', x: 'h' }, ['g', 'h'])
    await applyGroupChange(s, { action: 'ungroup', groupId: 'g' }, 'me')
    check('ungroup: every job in it unfolds (seen or not) and the group is deleted',
      s.jobs.get('a') === null && s.jobs.get('hidden') === null && !s.groups.has('g') && s.jobs.get('x') === 'h' && s.groups.has('h'))
  }
  {
    const s = fake({ a: 'g', other: null }, ['g'])
    s.meanwhile = () => { s.jobs.set('other', 'g'); s.meanwhile = undefined }
    const ok = !(await rejects(applyGroupChange(s, { action: 'ungroup', groupId: 'g' }, 'me')))
    check('ungroup: a job added at that moment keeps the group, holding just that job',
      ok && s.jobs.get('a') === null && s.groups.has('g') && s.jobs.get('other') === 'g')
  }

  if (failures) { console.error(`\n${failures} group-change check(s) failed`); process.exit(1) }
  console.log('\nAll group-change checks passed')
}
main().catch(e => { console.error(e); process.exit(1) })
