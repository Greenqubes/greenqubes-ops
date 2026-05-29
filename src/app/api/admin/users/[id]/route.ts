import { NextRequest, NextResponse } from 'next/server'
import { createClient }             from '@/lib/supabase/server'
import { updateUser, removeUserAccess, UserRemovalValidationError } from '@/lib/supabase/queries/admin'
import type { Role, LangCode }      from '@/lib/supabase/types'

async function guardAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('auth_id', user.id)
    .maybeSingle() as { data: { role: string } | null; error: unknown }
  return profile?.role === 'admin'
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

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ok = await guardAdmin()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const { id } = await params
    await removeUserAccess(id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = (err as Error).message
    const status = err instanceof UserRemovalValidationError ? 400 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
