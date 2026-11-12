import { createClient } from '@/lib/supabase/server'
import type { JobGroup } from '@/lib/utils/job-groups'

/**
 * The names of the given job groups (0072), read on the caller's session —
 * a group is readable only while it holds a job they can see, so a group of
 * someone else's private drafts never comes back. [] for no ids.
 */
export async function getJobGroups(ids: string[]): Promise<JobGroup[]> {
  if (ids.length === 0) return []
  const supabase = await createClient()
  const { data, error } = await supabase.from('job_groups' as never).select('id, name').in('id', ids) as
    unknown as { data: JobGroup[] | null; error: unknown }
  if (error) throw error
  return data ?? []
}
