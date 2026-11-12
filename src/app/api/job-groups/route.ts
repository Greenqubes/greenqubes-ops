import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getEffectiveRole } from '@/lib/utils/role-override'
import { canChangeGroups, parseGroupBody } from '@/lib/utils/job-groups'
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
 * job. Nothing but jobs.group_id and job_groups is ever written.
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
  try {
    // The groups the moved jobs were in before: any left with no job is
    // deleted afterwards, so an empty group never lingers (one job, one group).
    let before: string[] = []
    if (body.action === 'create' || body.action === 'add' || body.action === 'remove') {
      const { data, error } = await svc.from('jobs').select('group_id').in('id', body.jobIds) as
        unknown as { data: Array<{ group_id: string | null }> | null; error: unknown }
      if (error) throw error
      before = [...new Set((data ?? []).map(r => r.group_id).filter((g): g is string => !!g))]
    }

    let groupId: string | undefined
    const setGroup = async (value: string | null, ids: string[]) => {
      const { error } = await svc.from('jobs').update({ group_id: value } as never).in('id', ids)
      if (error) throw error
    }
    switch (body.action) {
      case 'create': {
        const { data, error } = await svc.from('job_groups' as never)
          .insert({ name: body.name, created_by: profile.id } as never).select('id').single() as
          unknown as { data: { id: string } | null; error: unknown }
        if (error || !data) throw error ?? new Error('no group id')
        groupId = data.id
        await setGroup(groupId, body.jobIds)
        break
      }
      case 'add':
        groupId = body.groupId
        await setGroup(body.groupId, body.jobIds)
        break
      case 'remove':
        await setGroup(null, body.jobIds)
        break
      case 'rename': {
        const { error } = await svc.from('job_groups' as never).update({ name: body.name } as never).eq('id', body.groupId)
        if (error) throw error
        break
      }
      case 'ungroup': {
        // Unfolds the group for everyone: the FK clears every job's group_id.
        const { error } = await svc.from('job_groups' as never).delete().eq('id', body.groupId)
        if (error) throw error
        break
      }
    }

    for (const g of before) {
      if (g === groupId) continue
      const { count, error } = await svc.from('jobs').select('id', { count: 'exact', head: true }).eq('group_id', g)
      if (!error && count === 0) await svc.from('job_groups' as never).delete().eq('id', g)
    }
    return NextResponse.json({ ok: true, ...(groupId ? { groupId } : {}) })
  } catch (e) {
    console.error(`[job-groups] ${body.action} by ${profile.id} failed`, e)
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}
