import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getProjectUploadUrl } from '@/lib/storage/r2'
import { validateProjectFile } from '@/lib/ai/attachments'
import { getOwnProject, listProjectFiles } from '@/lib/supabase/queries/assistant-projects'

// Signed PUT URL for a project reference file (Phase 4). Objects land under
// asst-projects/{userId}/{projectId}/ — never job folders, never `files` rows,
// and outside the scratch-cleanup cron's asst-chat/ sweep.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .maybeSingle() as { data: { id: string } | null; error: unknown }
  if (!profile) return NextResponse.json({ error: 'Not provisioned' }, { status: 403 })

  const body = await req.json() as {
    projectId?: string; filename?: string; contentType?: string; size?: number
  }
  const { projectId, filename, contentType, size } = body
  if (!projectId || !filename || !contentType || typeof size !== 'number') {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  // RLS: only the owner sees the project
  const project = await getOwnProject(projectId)
  if (!project) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const existing = await listProjectFiles([projectId])
  const problem  = validateProjectFile(
    filename, contentType, size,
    existing.length,
    existing.reduce((s, f) => s + f.size, 0),
  )
  if (problem) return NextResponse.json({ error: problem }, { status: 400 })

  const { url, key } = await getProjectUploadUrl(profile.id, projectId, filename, contentType)
  return NextResponse.json({ url, key })
}
