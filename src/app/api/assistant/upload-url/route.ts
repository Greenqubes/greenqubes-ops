import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getScratchUploadUrl } from '@/lib/storage/r2'
import { validateAttachment } from '@/lib/ai/attachments'

// Signed PUT URL for an assistant chat attachment. Objects land in the
// caller's own scratch prefix (asst-chat/{userId}/…) — never in job folders,
// never as `files` rows. Any signed-in role may attach files for questions.
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

  const body = await req.json() as { filename?: string; contentType?: string; size?: number }
  const { filename, contentType, size } = body
  if (!filename || !contentType || typeof size !== 'number') {
    return NextResponse.json({ error: 'filename, contentType and size are required' }, { status: 400 })
  }

  const problem = validateAttachment(filename, contentType, size)
  if (problem === 'type') {
    return NextResponse.json({ error: 'Only JPG, PNG, WebP, GIF images and PDF files are supported' }, { status: 400 })
  }
  if (problem === 'size') {
    return NextResponse.json({ error: 'File too large' }, { status: 400 })
  }

  const { url, key } = await getScratchUploadUrl(profile.id, filename, contentType)
  return NextResponse.json({ url, key })
}
