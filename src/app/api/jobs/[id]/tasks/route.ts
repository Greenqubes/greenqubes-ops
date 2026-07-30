import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveRole } from '@/lib/utils/role-override'
import type { Role } from '@/lib/supabase/types'

// Job task list (Phase 4). Office roles (sales/scheduler/coordinator/admin)
// build and reorder the list; installers + sub-installers tick items off on
// site (externals tick via the public /api/ext/[token]/tasks route). RLS
// backs every rule — installers only ever see/update tasks on jobs they are
// formally assigned to.

const EDIT_ROLES = ['sales', 'scheduler', 'coordinator', 'admin']

async function getProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, profile: null, effectiveRole: '' }

  type ProfileRow = { id: string; role: Role }
  const { data: profile } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_id', user.id)
    .maybeSingle() as { data: ProfileRow | null; error: unknown }
  if (!profile) return { supabase, profile: null, effectiveRole: '' }

  const effectiveRole = await getEffectiveRole(profile.role)
  return { supabase, profile, effectiveRole }
}

// GET — all tasks for the job, in order
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: jobId } = await params
  const { supabase, profile } = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('job_tasks')
    .select('id, text, is_completed, sort_order')
    .eq('job_id', jobId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST — add a task at the end of the list
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: jobId } = await params
  const { supabase, profile, effectiveRole } = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!EDIT_ROLES.includes(effectiveRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const text: string = typeof body.text === 'string' ? body.text.trim() : ''
  if (!text) return NextResponse.json({ error: 'Bad request' }, { status: 400 })

  const { data: last } = await supabase
    .from('job_tasks')
    .select('sort_order')
    .eq('job_id', jobId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle() as { data: { sort_order: number } | null }

  const { data: task, error } = await supabase
    .from('job_tasks')
    .insert({
      job_id:     jobId,
      text,
      created_by: profile.id,
      sort_order: (last?.sort_order ?? -1) + 1,
    } as never)
    .select('id, text, is_completed, sort_order')
    .single()
  if (error || !task) return NextResponse.json({ error: 'Insert failed' }, { status: 500 })
  return NextResponse.json(task)
}

// PATCH — three shapes:
//   { task_id, is_completed }  tick/untick (installer on assigned jobs; office too)
//   { task_id, text }          edit wording (office roles)
//   { order: [taskId, ...] }   persist a drag-reorder (office roles)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: jobId } = await params
  const { supabase, profile, effectiveRole } = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))

  if (Array.isArray(body.order)) {
    if (!EDIT_ROLES.includes(effectiveRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const order: string[] = body.order.filter((x: unknown): x is string => typeof x === 'string')
    for (let i = 0; i < order.length; i++) {
      const { error } = await supabase
        .from('job_tasks')
        .update({ sort_order: i } as never)
        .eq('id', order[i])
        .eq('job_id', jobId)
      if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }

  const taskId: string | undefined = typeof body.task_id === 'string' ? body.task_id : undefined
  if (!taskId) return NextResponse.json({ error: 'Bad request' }, { status: 400 })

  if (typeof body.is_completed === 'boolean') {
    // RLS restricts installers to jobs they are formally assigned to.
    const { error } = await supabase
      .from('job_tasks')
      .update({
        is_completed: body.is_completed,
        completed_by: body.is_completed ? profile.id : null,
        completed_at: body.is_completed ? new Date().toISOString() : null,
      } as never)
      .eq('id', taskId)
      .eq('job_id', jobId)
    if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (typeof body.text === 'string') {
    if (!EDIT_ROLES.includes(effectiveRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const text = body.text.trim()
    if (!text) return NextResponse.json({ error: 'Bad request' }, { status: 400 })
    const { error } = await supabase
      .from('job_tasks')
      .update({ text } as never)
      .eq('id', taskId)
      .eq('job_id', jobId)
    if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Bad request' }, { status: 400 })
}

// DELETE — remove one task ({ task_id }) or the whole list ({ all: true })
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: jobId } = await params
  const { supabase, profile, effectiveRole } = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!EDIT_ROLES.includes(effectiveRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))

  if (body.all === true) {
    const { error } = await supabase.from('job_tasks').delete().eq('job_id', jobId)
    if (error) return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  const taskId: string | undefined = typeof body.task_id === 'string' ? body.task_id : undefined
  if (!taskId) return NextResponse.json({ error: 'Bad request' }, { status: 400 })

  const { error } = await supabase.from('job_tasks').delete().eq('id', taskId).eq('job_id', jobId)
  if (error) return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
