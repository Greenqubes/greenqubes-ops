import { createClient } from '@/lib/supabase/server'
import type { JobGroup } from '@/lib/utils/job-groups'

/** Just the part of a Supabase client this read uses (a fake in the test). */
type GroupsClient = {
  from: (table: never) => {
    select: (cols: string) => { in: (col: string, ids: string[]) => PromiseLike<{ data: unknown; error: unknown }> }
  }
}

/**
 * Never throws: if the names can't be read, the jobs simply show as plain
 * rows (foldGroups leaves a job whose group it doesn't know unfolded) rather
 * than the whole Jobs tab erroring (final review, Nic 2026-11-13).
 */
export async function readJobGroups(client: GroupsClient, ids: string[]): Promise<JobGroup[]> {
  if (ids.length === 0) return []
  const { data, error } = await client.from('job_groups' as never).select('id, name').in('id', ids)
  if (error) {
    console.error('[job-groups] reading group names failed; showing plain rows', error)
    return []
  }
  return (data as JobGroup[] | null) ?? []
}

/**
 * The names of the given job groups (0072), read on the caller's session —
 * a group is readable only while it holds a job they can see, so a group of
 * someone else's private drafts never comes back. [] for no ids.
 */
export async function getJobGroups(ids: string[]): Promise<JobGroup[]> {
  if (ids.length === 0) return []
  return readJobGroups(await createClient() as unknown as GroupsClient, ids)
}
