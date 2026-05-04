import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCfImagesUploadUrl } from '@/lib/storage/cfImages'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const result = await getCfImagesUploadUrl()
    return NextResponse.json(result)
  } catch (err) {
    console.error('[cfimages/upload-url]', err)
    return NextResponse.json({ error: 'Failed to get upload URL' }, { status: 500 })
  }
}
