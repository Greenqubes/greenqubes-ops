import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase/server'
import { getAllUsers, provisionUser } from '@/lib/supabase/queries/admin'
import type { Role, LangCode }       from '@/lib/supabase/types'

const ADMIN_EMAIL = 'ai@greenqubes.com'

async function guardAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.email === ADMIN_EMAIL
}

export async function GET() {
  const ok = await guardAdmin()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const users = await getAllUsers()
    return NextResponse.json(users)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const ok = await guardAdmin()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const { email, name, role, lang } = await req.json() as {
      email: string; name: string; role: Role; lang?: LangCode
    }
    if (!email || !name || !role) {
      return NextResponse.json({ error: 'email, name, and role are required' }, { status: 400 })
    }
    const user = await provisionUser(email, name, role, lang)
    return NextResponse.json(user, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 })
  }
}
