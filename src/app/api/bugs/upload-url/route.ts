import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase/server'
import { getBugScreenshotUploadUrl } from '@/lib/storage/r2'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { filename, contentType } = await req.json() as {
    filename:    string
    contentType: string
  }

  if (!filename || !contentType) {
    return NextResponse.json({ error: 'filename and contentType are required' }, { status: 400 })
  }
  if (!contentType.startsWith('image/')) {
    return NextResponse.json({ error: 'Only image uploads are allowed for screenshots' }, { status: 400 })
  }

  const { url, key } = await getBugScreenshotUploadUrl(filename, contentType)
  return NextResponse.json({ url, key })
}
