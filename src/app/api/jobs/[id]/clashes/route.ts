import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveRole } from '@/lib/utils/role-override'
import type { Role } from '@/lib/supabase/types'

export interface ClashInstaller {
  id:   string
  name: string
}

export interface ClashConflict {
  jobId:     string
  client:    string
  timeStart: string | null
  timeEnd:   string | null
}

export interface Clash {
  installer:      ClashInstaller
  conflictingJob: ClashConflict
}

export interface Substitute {
  id:              string
  name:            string
  role:            string
  yearsExperience: number | null
  skills:          string[]
  hasConflict:     boolean   // true = has another job overlapping this time slot
}

export interface ClashesResponse {
  clashes:      Clash[]
  substitutes:  Substitute[]
  jobDate:      string
  jobTimeStart: string | null
  jobTimeEnd:   string | null
}

// Only flags a clash when times genuinely overlap.
// If start times are missing we can't know → flag. If end times are missing,
// two jobs only clash when their start times are identical.
function timesOverlap(
  s1: string | null, e1: string | null,
  s2: string | null, e2: string | null,
): boolean {
  if (!s1 || !s2) return true          // no start time info → flag as unknown
  if (!e1 || !e2) return s1 === s2     // no end time → clash only if same start
  return s1 < e2 && s2 < e1           // proper overlap check
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: jobId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  type ProfileRow = { role: Role }
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('auth_id', user.id)
    .maybeSingle() as { data: ProfileRow | null; error: unknown }

  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const effectiveRole = await getEffectiveRole(profile.role)
  if (effectiveRole !== 'sales') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Load the job + its current assignees
  type JobRow = {
    date: string; time_start: string | null; time_end: string | null
    job_assignees: Array<{ user_id: string; users: { id: string; name: string } | null }>
  }
  const { data: job } = await supabase
    .from('jobs')
    .select('date, time_start, time_end, job_assignees(user_id, users(id, name))')
    .eq('id', jobId)
    .maybeSingle() as { data: JobRow | null; error: unknown }

  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const assignees = job.job_assignees
    .map(a => ({ id: a.user_id, name: a.users?.name ?? '' }))
    .filter(a => a.name)

  const assigneeIds = assignees.map(a => a.id)

  // All other jobs on the same date (any installer could be affected)
  type ConflictRow = {
    id: string; client: string; time_start: string | null; time_end: string | null
    job_assignees: Array<{ user_id: string }>
  }
  const { data: sameDay } = await supabase
    .from('jobs')
    .select('id, client, time_start, time_end, job_assignees(user_id)')
    .eq('date', job.date)
    .neq('id', jobId)
    .in('status', ['scheduled', 'awaiting_approval']) as { data: ConflictRow[] | null; error: unknown }

  // Only same-day jobs whose time actually overlaps with our job
  const overlapping = (sameDay ?? []).filter(j =>
    timesOverlap(job.time_start, job.time_end, j.time_start, j.time_end)
  )

  // Build clash list for current assignees
  const clashes: Clash[] = []
  const clashingInstallerIds = new Set<string>()

  for (const conflict of overlapping) {
    const conflictAssigneeIds = new Set(conflict.job_assignees.map(a => a.user_id))
    for (const assignee of assignees) {
      if (conflictAssigneeIds.has(assignee.id) && !clashingInstallerIds.has(assignee.id)) {
        clashingInstallerIds.add(assignee.id)
        clashes.push({
          installer: { id: assignee.id, name: assignee.name },
          conflictingJob: {
            jobId:     conflict.id,
            client:    conflict.client,
            timeStart: conflict.time_start,
            timeEnd:   conflict.time_end,
          },
        })
      }
    }
  }

  // Build a set of installer IDs who have any overlapping job (for substitute status)
  const busyInstallerIds = new Set<string>()
  for (const conflict of overlapping) {
    for (const a of conflict.job_assignees) {
      busyInstallerIds.add(a.user_id)
    }
  }

  // All installers except: clashing assignees (being replaced) + current non-clashing assignees
  type UserRow = {
    id: string; name: string; role: string
    years_experience: number | null; skills: string[]
  }
  const { data: allInstallers } = await supabase
    .from('users')
    .select('id, name, role, years_experience, skills')
    .eq('role', 'installer') as { data: UserRow[] | null; error: unknown }

  const currentAssigneeIds = new Set(assigneeIds)

  const substitutes: Substitute[] = (allInstallers ?? [])
    .filter(u => !currentAssigneeIds.has(u.id))   // exclude anyone already on this job
    .map(u => ({
      id:              u.id,
      name:            u.name,
      role:            u.role,
      yearsExperience: u.years_experience,
      skills:          u.skills ?? [],
      hasConflict:     busyInstallerIds.has(u.id),
    }))
    // Free installers first, then busy ones
    .sort((a, b) => Number(a.hasConflict) - Number(b.hasConflict))

  return NextResponse.json({
    clashes,
    substitutes,
    jobDate:      job.date,
    jobTimeStart: job.time_start,
    jobTimeEnd:   job.time_end,
  } satisfies ClashesResponse)
}
