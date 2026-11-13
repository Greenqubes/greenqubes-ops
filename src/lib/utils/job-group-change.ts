import type { GroupBody } from './job-groups'

/** The writes a group change needs; the route backs it with the service key. */
export type GroupStore = {
  /** The distinct groups these jobs are in now. */
  groupsOf:    (jobIds: string[]) => Promise<string[]>
  createGroup: (name: string, createdBy: string) => Promise<string>
  setGroup:    (groupId: string | null, jobIds: string[]) => Promise<void>
  /** Takes every job out of the group, including jobs the caller can't see. */
  clearGroup:  (groupId: string) => Promise<void>
  renameGroup: (groupId: string, name: string) => Promise<void>
  countJobs:   (groupId: string) => Promise<number>
  /** 'in_use' when a job still points at it: the database refuses (0073). */
  deleteGroup: (groupId: string) => Promise<'deleted' | 'in_use'>
}

/**
 * Make, add to, take out of, rename or ungroup a Jobs tab group (0072), in an
 * order that never leaves a group behind with nothing in it and never unfolds
 * a group someone has just added to (final review, Nic 2026-11-13):
 *  - create: if the jobs can't be moved in, the new group is taken away again;
 *  - ungroup: the jobs come out first, then the group goes. Since 0073 the
 *    database refuses to delete a group still holding a job, so a job added
 *    at that very moment keeps the group (with just that job) instead of being
 *    unfolded without anyone asking;
 *  - afterwards, each group the moved jobs left is deleted if empty. The same
 *    refusal covers a job added between the count and the delete. Tidying up
 *    never fails the change itself.
 */
export async function applyGroupChange(store: GroupStore, body: GroupBody, actorId: string): Promise<{ groupId?: string }> {
  const before = body.action === 'create' || body.action === 'add' || body.action === 'remove'
    ? await store.groupsOf(body.jobIds) : []

  let groupId: string | undefined
  switch (body.action) {
    case 'create':
      groupId = await store.createGroup(body.name, actorId)
      try {
        await store.setGroup(groupId, body.jobIds)
      } catch (e) {
        await store.deleteGroup(groupId).catch(() => undefined)
        throw e
      }
      break
    case 'add':
      groupId = body.groupId
      await store.setGroup(body.groupId, body.jobIds)
      break
    case 'remove':
      await store.setGroup(null, body.jobIds)
      break
    case 'rename':
      await store.renameGroup(body.groupId, body.name)
      break
    case 'ungroup':
      await store.clearGroup(body.groupId)
      await store.deleteGroup(body.groupId)
      break
  }

  for (const g of before) {
    if (g === groupId) continue
    try {
      if (await store.countJobs(g) === 0) await store.deleteGroup(g)
    } catch { /* a leftover empty group is invisible; the change itself stands */ }
  }
  return groupId ? { groupId } : {}
}
