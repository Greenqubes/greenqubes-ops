import { createClient } from '@/lib/supabase/server'

// All project access runs on the user-scoped client: the owner-only RLS
// policies (migration 0047) are the enforcement — a foreign id reads or
// touches zero rows, which callers surface as not-found.

export interface ProjectRow {
  id:           string
  name:         string
  instructions: string | null
  created_at:   string
}

export interface ProjectFileRow {
  id:         string
  project_id: string
  name:       string
  r2_key:     string
  mime:       string
  size:       number
  created_at: string
}

export type ProjectWithFiles = ProjectRow & { files: ProjectFileRow[] }

export async function listProjects(): Promise<ProjectRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('asst_projects')
    .select('id, name, instructions, created_at')
    .order('created_at', { ascending: false })
  return (data ?? []) as ProjectRow[]
}

export async function listProjectFiles(projectIds: string[]): Promise<ProjectFileRow[]> {
  if (projectIds.length === 0) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from('asst_project_files')
    .select('id, project_id, name, r2_key, mime, size, created_at')
    .in('project_id', projectIds)
    .order('created_at', { ascending: true })
  return (data ?? []) as ProjectFileRow[]
}

export async function getOwnProject(id: string): Promise<ProjectRow | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('asst_projects')
    .select('id, name, instructions, created_at')
    .eq('id', id)
    .maybeSingle()
  return (data as ProjectRow | null) ?? null
}

export async function createProject(userId: string, name: string): Promise<ProjectRow | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('asst_projects')
    .insert({ user_id: userId, name } as never)
    .select('id, name, instructions, created_at')
    .single()
  if (error) { console.error('[createProject] error', error); return null }
  return data as ProjectRow
}

export async function updateProject(
  id: string,
  fields: { name?: string; instructions?: string | null },
): Promise<boolean> {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from('asst_projects')
    .update({ ...fields, updated_at: new Date().toISOString() } as never, { count: 'exact' })
    .eq('id', id)
  return !error && (count ?? 0) > 0
}

export async function deleteProject(id: string): Promise<boolean> {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from('asst_projects')
    .delete({ count: 'exact' })
    .eq('id', id)
  if (error) console.error('[deleteProject] error', error)
  return !error && (count ?? 0) > 0
}

export async function addProjectFile(
  row: { project_id: string; name: string; r2_key: string; mime: string; size: number },
): Promise<ProjectFileRow | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('asst_project_files')
    .insert(row as never)
    .select('id, project_id, name, r2_key, mime, size, created_at')
    .single()
  if (error) { console.error('[addProjectFile] error', error); return null }
  return data as ProjectFileRow
}

export async function getProjectFileRow(id: string): Promise<ProjectFileRow | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('asst_project_files')
    .select('id, project_id, name, r2_key, mime, size, created_at')
    .eq('id', id)
    .maybeSingle()
  return (data as ProjectFileRow | null) ?? null
}

export async function deleteProjectFileRow(id: string): Promise<boolean> {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from('asst_project_files')
    .delete({ count: 'exact' })
    .eq('id', id)
  return !error && (count ?? 0) > 0
}

export async function moveChatToProject(chatId: string, projectId: string | null): Promise<boolean> {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from('asst_chats')
    .update({ project_id: projectId } as never, { count: 'exact' })
    .eq('id', chatId)
  return !error && (count ?? 0) > 0
}
