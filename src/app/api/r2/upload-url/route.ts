import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUploadUrlForKind, validateContentType } from '@/lib/storage/r2'
import type { FileKind } from '@/lib/supabase/types'

const VALID_KINDS = new Set<FileKind>(['photo', 'completion', 'voice', 'do', 'attachment', 'production_instructions', 'design_brief'])

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    jobId:       string
    kind:        string
    filename:    string
    contentType: string
  }
  const { jobId, kind, filename, contentType } = body

  if (!jobId || !kind || !filename || !contentType) {
    return NextResponse.json(
      { error: 'jobId, kind, filename, and contentType are required' },
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
