import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveRole } from '@/lib/utils/role-override'
import type { Role } from '@/lib/supabase/types'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://greenqubes-ops.vercel.app'

// External contacts are shared across jobs — one persistent link per person.
// Scheduler / coordinator / admin manage the pool (RLS enforces the same).

type ContactRow = {
  id:         string
  name:       string
  phone:      string
  token:      string
  deleted_at: string | null
  created_at: string
  job_external_contacts: Array<{
    status: 'pending' | 'accepted' | 'declined'
    jobs:   { date: string; status: string } | null
  }>
}

async function requireManager() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, profile: null }

  type ProfileRow = { id: string; role: Role }
  const { data: profile } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_id', user.id)
    .maybeSingle() as { data: ProfileRow | null; error: unknown }
  if (!profile) return { supabase, profile: null }

  const effectiveRole = await getEffectiveRole(profile.role)
  if (!['scheduler', 'coordinator', 'admin'].includes(effectiveRole)) {
    return { supabase, profile: null }
  }
  return { supabase, profile }
}

// GET — every contact including deleted ones (so they can be restored), with
// total + still-active job counts for the delete warning and "N past jobs".
export async function GET() {
  const { supabase, profile } = await requireManager()
  if (!profile) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('external_contacts')
    .select('id, name, phone, token, deleted_at, created_at, job_external_contacts(status, jobs(date, status))')
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: 'Query failed' }, { status: 500 })

  const contacts = ((data ?? []) as unknown as ContactRow[]).map(c => {
    const links = c.job_external_contacts.filter(l => l.jobs)
    return {
      id:         c.id,
      name:       c.name,
      phone:      c.phone,
      token:      c.token,
      // Canonical (production) URL. Clients that copy the link compose it from
      // window.location.origin instead, so preview testing links stay on the
      // preview — this env var names production in every Vercel environment.
      url:        `${APP_URL}/ext/${c.token}`,
      deleted_at: c.deleted_at,
      job_count:  links.length,
      // "active" = not declined, job not completed, and not already in the past
      active_job_count: links.filter(l =>
        l.status !== 'declined' &&
        l.jobs!.status !== 'completed' &&
        l.jobs!.date >= today,
      ).length,
    }
  })

  return NextResponse.json(contacts)
}

// POST — create a new contact; the DB generates their permanent token.
export async function POST(req: NextRequest) {
  const { supabase, profile } = await requireManager()
  if (!profile) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const name:  string = typeof body.name  === 'string' ? body.name.trim()  : ''
  const phone: string = typeof body.phone === 'string' ? body.phone.trim() : ''
  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const { data: contact, error } = await supabase
    .from('external_contacts')
    .insert({ name, phone, created_by: profile.id } as never)
    .select('id, name, phone, token, deleted_at, created_at')
    .single() as { data: { id: string; name: string; phone: string; token: string } | null; error: unknown }
  if (error || !contact) return NextResponse.json({ error: 'Insert failed' }, { status: 500 })

  return NextResponse.json({
    id:               contact.id,
    name:             contact.name,
    phone:            contact.phone,
    token:            contact.token,
    url:              `${APP_URL}/ext/${contact.token}`,
    deleted_at:       null,
    job_count:        0,
    active_job_count: 0,
  })
}
