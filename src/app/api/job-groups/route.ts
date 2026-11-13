import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getEffectiveRole } from '@/lib/utils/role-override'
import { canChangeGroups, parseGroupBody } from '@/lib/utils/job-groups'
import { applyGroupChange, type GroupStore } from '@/lib/utils/job-group-change'
import type { Role } from '@/lib/supabase/types'

/**
 * POST /api/job-groups — make, add to, take out of, rename or ungroup a Jobs
 * tab group (Nic, 2026-11-11; spec 2026-11-11 Part 4, migration 0072).
 *
 * In this order: the role (sales, coordinator, scheduler, admin), the request
 * shape, then — on the caller's OWN session — that every job named is one
 * they can see (pending privacy, 0062) and that the group is one they can see
 * (0072's policy: it holds a job visible to them). Only then the service key
 * writes, because jobs' UPDATE policies would refuse grouping someone else's
 * job. Nothing but jobs.group_id and job_groups is ever written; the order of
 * those writes lives in applyGroupChange (tested).
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  type ProfileRow = { id: string; role: Role }
  const { data: profile } = await supabase.from('users').select('id, role')
    .eq('auth_id', user.id).maybeSingle() as { data: ProfileRow | null; error: unknown }
  if (!profile) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const role = await getEffectiveRole(profile.role)
  if (!canChangeGroups(role, profile.role === 'admin')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = parseGroupBody(await req.json().catch(() => null))
  if (!body) return NextResponse.json({ error: 'bad_request' }, { status: 400 })

  // ── What the caller can see, on their own session ─────────────────────────
  if ('jobIds' in body) {
    const { data, error } = await supabase.from('jobs').select('id').in('id', body.jobIds)
    if (error) return NextResponse.json({ error: 'failed' }, { status: 500 })
    if ((data ?? []).length !== body.jobIds.length) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  if ('groupId' in body) {
    const { data, error } = await supabase.from('job_groups' as never).select('id').eq('id', body.groupId).maybeSingle()
    if (error) return NextResponse.json({ error: 'failed' }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const svc = createServiceClient()
  const groups = () => svc.from('job_groups' as never)
  const store: GroupStore = {
    groupsOf: async ids => {
      const { data, error } = await svc.from('jobs').select('group_id').in('id', ids) as
        unknown as { data: Array<{ group_id: string | null }> | null; error: unknown }
      if (error) throw error
      return [...new Set((data ?? []).map(r => r.group_id).filter((g): g is string => !!g))]
    },
    createGroup: async (name, createdBy) => {
      const { data, error } = await groups().insert({ name, created_by: createdBy } as never).select('id').single() as
        unknown as { data: { id: string } | null; error: unknown }
      if (error || !data) throw error ?? new Error('no group id')
      return data.id
    },
    setGroup: async (value, ids) => {
      const { error } = await svc.from('jobs').update({ group_id: value } as never).in('id', ids)
      if (error) throw error
    },
    clearGroup: async g => {
      const { error } = await svc.from('jobs').update({ group_id: null } as never).eq('group_id', g)
      if (error) throw error
    },
    renameGroup: async (g, name) => {
      const { error } = await groups().update({ name } as never).eq('id', g)
      if (error) throw error
    },
    countJobs: async g => {
      const { count, error } = await svc.from('jobs').select('id', { count: 'exact', head: true }).eq('group_id', g)
      if (error) throw error
      return count ?? 0
    },
    deleteGroup: async g => {
      const { error } = await groups().delete().eq('id', g)
      // 23503: a job still points at it (0073 refuses rather than unfolding).
      if ((error as { code?: string } | null)?.code === '23503') return 'in_use'
      if (error) throw error
      return 'deleted'
    },
  }
  try {
    const out = await applyGroupChange(store, body, profile.id)
    return NextResponse.json({ ok: true, ...out })
  } catch (e) {
    console.error(`[job-groups] ${body.action} by ${profile.id} failed`, e)
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}
