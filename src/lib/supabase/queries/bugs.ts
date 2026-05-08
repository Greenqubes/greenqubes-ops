import { createServiceClient } from '@/lib/supabase/service'

export type BugPriority = 'low' | 'medium' | 'high' | 'urgent'
export type BugStatus   = 'open' | 'fixed'

export type BugReport = {
  id:              string
  user_email:      string | null
  user_role:       string | null
  route:           string | null
  message:         string
  priority:        BugPriority
  status:          BugStatus
  screenshot_key:  string | null
  markdown_file:   string | null
  ip_address:      string | null
  platform:        string | null
  browser:         string | null
  os:              string | null
  screen:          string | null
  created_at:      string
  resolved_at:     string | null
  github_issue_url: string | null
}

export async function insertBugReport(
  data: Omit<BugReport, 'id' | 'created_at' | 'status' | 'resolved_at'>,
): Promise<string | null> {
  const db = createServiceClient()
  const { data: row, error } = await db
    .from('bug_reports')
    .insert(data)
    .select('id')
    .single()
  if (error) { console.error('[bugs] insert failed', error); return null }
  return row.id
}

export async function getBugReports(): Promise<BugReport[]> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('bug_reports')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) { console.error('[bugs] fetch failed', error); return [] }
  return (data ?? []) as BugReport[]
}

export async function countBugReportsForDate(dateStr: string): Promise<number> {
  const db = createServiceClient()
  const from = `${dateStr}T00:00:00.000Z`
  const to   = `${dateStr}T23:59:59.999Z`
  const { count, error } = await db
    .from('bug_reports')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', from)
    .lte('created_at', to)
  if (error) return 0
  return count ?? 0
}

export async function markBugFixed(id: string): Promise<void> {
  const db = createServiceClient()
  const { error } = await db
    .from('bug_reports')
    .update({ status: 'fixed', resolved_at: new Date().toISOString() })
    .eq('id', id)
  if (error) console.error('[bugs] mark fixed failed', error)
}

export async function getBugMarkdownFile(id: string): Promise<string | null> {
  const db = createServiceClient()
  const { data } = await db
    .from('bug_reports')
    .select('markdown_file')
    .eq('id', id)
    .maybeSingle()
  return data?.markdown_file ?? null
}

export async function updateGitHubIssueUrl(id: string, issueUrl: string): Promise<void> {
  const db = createServiceClient()
  const { error } = await db
    .from('bug_reports')
    .update({ github_issue_url: issueUrl })
    .eq('id', id)
  if (error) console.error('[bugs] update github issue url failed', error)
}
