import { NextResponse }        from 'next/server'
import { createClient }        from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verdictsForItems, verdictLabel } from '@/lib/autofix/verdicts'

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

export async function GET() {
  if (!(await guardAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const db = createServiceClient()
  // '*' rather than a column list: build_id and autofix_item_id arrive with
  // migration 0069, and naming them before it is applied would break the tab.
  const { data, error } = await db
    .from('crash_logs')
    .select('*')
    .eq('resolved', false)
    .order('occurred_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const rows = (data ?? []) as Array<Record<string, unknown> & { user_id: string | null; autofix_item_id?: string | null }>

  // "which desk it's from" (Nic) — the person's name, plus the fixer's verdict.
  // Both lookups are best-effort: a failure shows the email and no chip.
  const userIds = [...new Set(rows.map(r => r.user_id).filter((x): x is string => !!x))]
  const names = new Map<string, string>()
  if (userIds.length) {
    const { data: people } = await db.from('users').select('id, name').in('id', userIds)
    for (const p of (people ?? []) as { id: string; name: string | null }[]) if (p.name) names.set(p.id, p.name)
  }
  const verdicts = await verdictsForItems([...new Set(rows.map(r => r.autofix_item_id).filter((x): x is string => !!x))])

  return NextResponse.json(rows.map(r => {
    const v = r.autofix_item_id ? verdicts.get(r.autofix_item_id) : undefined
    return {
      ...r,
      user_name:      r.user_id ? names.get(r.user_id) ?? null : null,
      verdict:        v ? verdictLabel(v) : null,
      verdict_reason: v?.reason ?? null,
    }
  }))
}
