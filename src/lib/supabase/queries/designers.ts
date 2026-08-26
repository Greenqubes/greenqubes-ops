import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

// ── Types ────────────────────────────────────────────────────────────────────

type DesignerRow = {
  user_id: string
  users: { name: string } | null
}

type UserRow = {
  id: string
  name: string
}

// ── Queries ──────────────────────────────────────────────────────────────────

export async function getJobDesigners(
  jobId: string,
): Promise<Array<{ id: string; name: string }>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('job_designers')
    .select('user_id, users(name)')
    .eq('job_id', jobId)
  if (error) throw error
  const rows = (data ?? []) as unknown as DesignerRow[]
  return rows.map((row) => ({
    id: row.user_id,
    name: row.users?.name ?? '',
  }))
}

export async function setJobDesigners(
  jobId: string,
  userIds: string[],
): Promise<{ added: string[] }> {
  const supabase = createServiceClient()

  const { data: existing, error: fetchError } = await supabase
    .from('job_designers')
    .select('user_id')
    .eq('job_id', jobId)
  if (fetchError) throw fetchError

  const currentIds = ((existing ?? []) as unknown as Array<{ user_id: string }>).map(
    (row) => row.user_id,
  )

  const added = userIds.filter((id) => !currentIds.includes(id))
  const removed = currentIds.filter((id) => !userIds.includes(id))

  if (removed.length > 0) {
    const { error: deleteError } = await supabase
      .from('job_designers')
      .delete()
      .eq('job_id', jobId)
      .in('user_id', removed)
    if (deleteError) throw deleteError
  }

  if (added.length > 0) {
    const { error: insertError } = await supabase
      .from('job_designers')
      .insert(added.map((id) => ({ job_id: jobId, user_id: id })) as never)
    if (insertError) throw insertError
  }

  return { added }
}

export async function getDesignerUsers(): Promise<Array<{ id: string; name: string }>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('users')
    .select('id, name')
    .eq('role', 'designer')
    .is('deleted_at', null)
    .order('name', { ascending: true })
  if (error) throw error
  const rows = (data ?? []) as unknown as UserRow[]
  return rows
}
