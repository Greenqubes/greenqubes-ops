import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const VALID_LANGS = ['en', 'zh', 'bn']

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const lang = body.lang as string
  if (!VALID_LANGS.includes(lang)) {
    return NextResponse.json({ error: 'Invalid lang' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('users')
    .update({ lang } as never)
    .eq('auth_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
