import type { createClient } from '@/lib/supabase/server'

/**
 * True when the signed-in caller can read this job under their OWN policies.
 *
 * For routes that go on to use the service client (which bypasses RLS): ask
 * the session client first, so pending-job privacy (migration 0062) and every
 * other read rule still decide. Pass the SESSION client, never the service one.
 */
export async function callerCanSeeJob(
  supabase: Awaited<ReturnType<typeof createClient>>,
  jobId: string,
): Promise<boolean> {
  const { data } = await supabase.from('jobs').select('id').eq('id', jobId).maybeSingle()
  return Boolean(data)
}
