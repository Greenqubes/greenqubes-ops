import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getDownloadUrl } from '@/lib/storage/r2'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { key, filename } = await req.json() as { key: string; filename?: string }
  if (!key) return NextResponse.json({ error: 'key required' }, { status: 400 })

  const url = await getDownloadUrl(key, filename)
  return NextResponse.json({ url })
}
