// Split out of projects.ts (browser-only) so a Client Component can import
// this without pulling in queries/projects.ts's `next/headers`-based server
// client — that mixed module builds fine until something actually imports a
// value from it into a client bundle (AddJobPicker, wired in via Task 11's
// NewJobShell -> ProjectFormShell), at which point Next's webpack build
// fails with "You're importing a component that needs next/headers."
import { createClient as createBrowserClient } from '@/lib/supabase/client'
import { scoreJob } from '@/lib/utils/project-keywords'

export type NestableJob = {
  id: string; project_title: string | null; client: string; status: string
  date: string; sales_poc_id: string | null; created_by: string | null
}

// Picker search (browser). Pending is personal (spec §6): when the caller is
// sales or coordinator, other people's PENDING jobs are filtered out here
// even though today's blanket RLS would return them — scheduler/admin see all.
export async function searchNestableJobs(opts: {
  keywords: string[]; query: string; callerRole: string; callerId: string
}): Promise<NestableJob[]> {
  const supabase = createBrowserClient()
  let q = supabase
    .from('jobs')
    .select('id, project_title, client, status, date, sales_poc_id, created_by')
    .is('project_id', null)
    .in('status', ['pending', 'scheduled', 'completed'])
    .order('date', { ascending: false })
    .limit(200)
  // PostgREST or-filters treat , ( ) as syntax and % as a wildcard — strip
  // them from user text so a search for "Acme, Inc." can't produce a
  // malformed filter that throws (controller ruling, Task 5 review).
  const text = opts.query.replace(/[,()%]/g, ' ').trim()
  if (text) q = q.or(`project_title.ilike.%${text}%,client.ilike.%${text}%`)
  const { data, error } = await q
  if (error) throw error
  let rows = (data ?? []) as unknown as NestableJob[]
  if (opts.callerRole === 'sales' || opts.callerRole === 'coordinator') {
    rows = rows.filter(j =>
      j.status !== 'pending' || j.sales_poc_id === opts.callerId || j.created_by === opts.callerId)
  }
  return rows
    .map(j => ({ j, s: scoreJob(j, opts.keywords) }))
    .sort((a, b) => b.s - a.s || a.j.date.localeCompare(b.j.date))
    .map(x => x.j)
    .slice(0, 30)
}
