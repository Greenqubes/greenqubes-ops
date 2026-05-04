import { NextResponse }        from 'next/server'
import { createClient }        from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

const ADMIN_EMAIL = 'ai@greenqubes.com'

async function guardAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.email === ADMIN_EMAIL
}

export async function GET() {
  if (!(await guardAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const db = createServiceClient()
  const { data, error } = await db
    .from('crash_logs')
    .select('id, occurred_at, route, error_message, stack_trace, component_stack, user_email, user_agent, markdown_body, resolved')
    .eq('resolved', false)
    .order('occurred_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
