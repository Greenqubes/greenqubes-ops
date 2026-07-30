import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveRole } from '@/lib/utils/role-override'
import type { Role } from '@/lib/supabase/types'

// Soft delete / restore an external contact. Deleting stamps deleted_at, which
// invalidates their persistent link IMMEDIATELY (the public /ext route returns
// 410). Restoring clears it — the SAME token works again, all history intact.

async function requireManager() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, ok: false }

  type ProfileRow = { role: Role }
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('auth_id', user.id)
    .maybeSingle() as { data: ProfileRow | null; error: unknown }
  if (!profile) return { supabase, ok: false }

  const effectiveRole = await getEffectiveRole(profile.role)
  return { supabase, ok: ['scheduler', 'coordinator', 'admin'].includes(effectiveRole) }
}

// DELETE — soft delete (link invalid from this moment)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { supabase, ok } = await requireManager()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await supabase
    .from('external_contacts')
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq('id', id)
  if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// PATCH — restore (same token reactivated)
export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { supabase, ok } = await requireManager()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await supabase
    .from('external_contacts')
    .update({ deleted_at: null } as never)
    .eq('id', id)
  if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
