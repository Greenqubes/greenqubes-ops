import { NextRequest, NextResponse } from 'next/server'
import { createClient }             from '@/lib/supabase/server'
import { updateUser }               from '@/lib/supabase/queries/admin'
import type { Role, LangCode }      from '@/lib/supabase/types'

const ADMIN_EMAIL = 'ai@greenqubes.com'

async function guardAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.email === ADMIN_EMAIL
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ok = await guardAdmin()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const { id } = await params
    const patch = await req.json() as Partial<{
      role:              Role
      telegram_chat_id:  string | null
      digest_subscriber: boolean
      lang:              LangCode
      phone:             string | null
    }>
    await updateUser(id, patch)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
