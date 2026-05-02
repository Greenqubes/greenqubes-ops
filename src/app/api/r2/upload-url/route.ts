import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUploadUrl } from '@/lib/storage/r2'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { key, contentType } = await req.json() as { key: string; contentType: string }
  if (!key || !contentType) {
    return NextResponse.json({ error: 'key and contentType required' }, { status: 400 })
  }

  const url = await getUploadUrl(key, contentType)
  return NextResponse.json({ url })
}
