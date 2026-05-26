import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUploadUrlForKind, validateContentType } from '@/lib/storage/r2'
import type { FileKind } from '@/lib/supabase/types'

const VALID_KINDS = new Set<FileKind>(['photo', 'completion', 'voice', 'do', 'attachment', 'production_instructions'])

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

  const { url, key } = await getUploadUrlForKind(jobId, kind as FileKind, filename, contentType)
  return NextResponse.json({ url, key })
}
