import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUploadUrlForKind, getProjectFileUploadUrl, validateContentType } from '@/lib/storage/r2'
import { getEffectiveRole } from '@/lib/utils/role-override'
import type { FileKind, Role } from '@/lib/supabase/types'

const VALID_KINDS = new Set<FileKind>(['photo', 'completion', 'voice', 'do', 'attachment', 'production_instructions', 'design_brief'])

// Uploads are manager-only on projects (no designer/production/installer —
// unlike job files, which every office role can attach to).
const PROJECT_MANAGER_ROLES: Role[] = ['sales', 'scheduler', 'coordinator', 'admin']

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    jobId?:      string
    projectId?:  string
    kind:        string
    filename:    string
    contentType: string
  }
  const { jobId, projectId, kind, filename, contentType } = body

  if (!jobId && !projectId) {
    return NextResponse.json({ error: 'jobId or projectId is required' }, { status: 400 })
  }
  if (jobId && projectId) {
    return NextResponse.json({ error: 'Provide exactly one of jobId or projectId' }, { status: 400 })
  }
  if (!kind || !filename || !contentType) {
    return NextResponse.json(
      { error: 'kind, filename, and contentType are required' },
      { status: 400 },
    )
  }
  if (!VALID_KINDS.has(kind as FileKind)) {
    return NextResponse.json({ error: `Invalid kind: ${kind}` }, { status: 400 })
  }
  if (!validateContentType(kind as FileKind, contentType)) {
    return NextResponse.json(
      { error: `Content type "${contentType}" not allowed for kind "${kind}"` },
      { status: 400 },
    )
  }

  if (projectId) {
    type ProfileRow = { id: string; role: Role }
    const { data: profile } = await supabase
      .from('users')
      .select('id, role')
      .eq('auth_id', user.id)
      .maybeSingle() as { data: ProfileRow | null; error: unknown }
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const role = await getEffectiveRole(profile.role)
    if (!PROJECT_MANAGER_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Readable folder set at project creation (/api/projects); RLS scopes
    // the lookup to office roles, so this also rejects uploads to a project
    // the user has no access to.
    const { data: project } = await supabase
      .from('job_projects')
      .select('r2_folder')
      .eq('id', projectId)
      .maybeSingle() as { data: { r2_folder: string | null } | null; error: unknown }
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    const { url, key } = await getProjectFileUploadUrl(project.r2_folder ?? projectId, kind as FileKind, filename, contentType)
    return NextResponse.json({ url, key })
  }

  if (!jobId) return NextResponse.json({ error: 'jobId is required' }, { status: 400 })

  // Readable folder for jobs created after migration 0042; legacy jobs/{id}/
  // for older ones. RLS scopes the lookup to jobs the caller can see, so this
  // also rejects uploads to jobs the user has no access to.
  const { data: job } = await supabase
    .from('jobs')
    .select('r2_folder')
    .eq('id', jobId)
    .maybeSingle() as { data: { r2_folder: string | null } | null; error: unknown }
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

  const { url, key } = await getUploadUrlForKind(job.r2_folder ?? jobId, kind as FileKind, filename, contentType)
  return NextResponse.json({ url, key })
}
