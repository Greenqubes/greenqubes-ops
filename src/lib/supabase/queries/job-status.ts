import type { createClient } from '@/lib/supabase/server'

/**
 * The raw job_status of one job, read through the caller's own SESSION
 * client, or null when it cannot be seen. For the stage guards on the crew
 * and designer routes (spec 2026-10-09) — translate it with stageOf(), never
 * compare it directly (see src/lib/utils/job-stage.ts).
 */
export async function loadJobStatus(
  supabase: Awaited<ReturnType<typeof createClient>>,
  jobId: string,
): Promise<string | null> {
  const { data } = await supabase.from('jobs').select('status').eq('id', jobId).maybeSingle() as
    { data: { status: string } | null; error: unknown }
  return data?.status ?? null
}
