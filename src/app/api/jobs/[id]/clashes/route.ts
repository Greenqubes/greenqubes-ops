import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveRole } from '@/lib/utils/role-override'
import { formatDate } from '@/lib/telegram/templates'
import {
  onLeaveIds, leaveBlocksJob, leaveWindowOnDate, leaveDatesLabel, addDays,
  type LeaveRecord,
} from '@/lib/utils/leave-overlap'
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
  id:             string
  name:           string
  role:           string
  subrole:        string | null
  isDriver:       boolean
  qualifications: string[]
  hasConflict:    boolean
  /** Away on the job's date(s) — a red state, not a busy one. */
  onLeave:        boolean
}

export interface LeaveClashEntry {
  person: ClashInstaller
  /** Pre-formatted, e.g. "10 Sep 2026 (from PM) – 12 Sep 2026". */
  dates:  string
  /**
   * The on-leave window on the job's FIRST day, so the modal can tell whether
   * shifting the time clears it. Null when the leave also covers a later day
   * of a multi-day job — then no time shift on day one can help.
   */
  window: { start: string; end: string } | null
}

export interface InstallerDayJob {
  id:        string
  client:    string
  timeStart: string | null
  timeEnd:   string | null
}

export interface InstallerDayBreakdown {
  id:   string
  name: string
  jobs: InstallerDayJob[]
}

export interface WeekDay {
  date:               string
  dayLabel:           string
  jobCount:           number
  installerBreakdown: InstallerDayBreakdown[]
}

export interface ClashesResponse {
  clashes:        Clash[]
  softClashes:    Clash[]
  travelWarnings: Clash[]
  leaveClashes:   LeaveClashEntry[]
  substitutes:    Substitute[]
  weekDays:       WeekDay[]
  jobDate:        string
  jobTimeStart:   string | null
  jobTimeEnd:     string | null
}

// Normalize to HH:MM so HH:MM:SS from the DB and HH:MM from the modal compare correctly.
const hhmm = (t: string | null) => t?.slice(0, 5) ?? null

function timesOverlap(
  s1: string | null, e1: string | null,
  s2: string | null, e2: string | null,
): boolean {
  const [a, b, c, d] = [hhmm(s1), hhmm(e1), hhmm(s2), hhmm(e2)]
  if (!a || !c) return true
  if (b && d)   return a < d && c < b
  if (b)        return c >= a && c < b
  if (d)        return a >= c && a < d
  return a === c
}

function timesTouch(
  s1: string | null, e1: string | null,
  s2: string | null, e2: string | null,
): boolean {
  const [a, b, c, d] = [hhmm(s1), hhmm(e1), hhmm(s2), hhmm(e2)]
  if (!a || !c) return false
  return (!!b && b === c) || (!!d && d === a)
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  const daysFromMon = day === 0 ? 6 : day - 1
  d.setDate(d.getDate() - daysFromMon)
  return d.toISOString().slice(0, 10)
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
  if (!['sales', 'scheduler', 'coordinator', 'admin'].includes(effectiveRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  type JobRow = {
    date: string; date_end: string | null; time_start: string | null; time_end: string | null
    job_assignees: Array<{ user_id: string; is_sub_installer: boolean; users: { id: string; name: string } | null }>
  }
  const { data: job } = await supabase
    .from('jobs')
    .select('date, date_end, time_start, time_end, job_assignees(user_id, is_sub_installer, users(id, name))')
    .eq('id', jobId)
    .maybeSingle() as { data: JobRow | null; error: unknown }

  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Sub-installers are excluded from clash detection (Phase 3 rule).
  const assignees = job.job_assignees
    .filter(a => !a.is_sub_installer)
    .map(a => ({ id: a.user_id, name: a.users?.name ?? '' }))
    .filter(a => a.name)

  const assigneeIds = assignees.map(a => a.id)

  // ── Leave ────────────────────────────────────────────────────────────────
  // Deliberately NOT the sub-filtered list above: support crew are exempt from
  // BOOKING clashes (they can double up on jobs) but never from leave — a
  // person who is away is away whatever their role on the job.
  const allPeople = job.job_assignees
    .map(a => ({ id: a.user_id, name: a.users?.name ?? '' }))
    .filter(p => p.name)
  const peopleIds = allPeople.map(p => p.id)
  const jobEndDate = job.date_end && job.date_end > job.date ? job.date_end : job.date

  const { data: leaveRows } = peopleIds.length === 0
    ? { data: [] as LeaveRecord[] }
    : await supabase
        .from('user_leaves')
        .select('id, user_id, date_start, date_end, start_portion, end_portion')
        .in('user_id', peopleIds)
        .lte('date_start', jobEndDate)
        .gte('date_end', job.date) as { data: LeaveRecord[] | null }
  const leaves = (leaveRows ?? []) as LeaveRecord[]

  const onLeave = onLeaveIds(peopleIds, job.date, job.date_end ?? null, job.time_start, job.time_end, leaves)
  const leaveClashes: LeaveClashEntry[] = allPeople
    .filter(p => onLeave.has(p.id))
    .flatMap(p => {
      const l = leaves.find(x =>
        x.user_id === p.id && leaveBlocksJob(x, job.date, job.date_end ?? null, job.time_start, job.time_end))
      if (!l) return []
      const win = leaveWindowOnDate(l, job.date)
      // If the leave also blocks a later day of a multi-day job, no time shift
      // on day one clears it — hand the modal a null window so it stays red.
      const blocksOtherDays = !!(job.date_end && job.date_end > job.date) &&
        leaveBlocksJob(l, addDays(job.date, 1), job.date_end, job.time_start, job.time_end)
      return [{
        person: { id: p.id, name: p.name },
        dates:  leaveDatesLabel(l, formatDate),
        window: blocksOtherDays ? null : win,
      }]
    })

  type ConflictRow = {
    id: string; client: string; time_start: string | null; time_end: string | null
    job_assignees: Array<{ user_id: string; is_sub_installer?: boolean }>
  }
  const { data: sameDay } = await supabase
    .from('jobs')
    .select('id, client, time_start, time_end, job_assignees(user_id, is_sub_installer)')
    .eq('date', job.date)
    .neq('id', jobId)
    .in('status', ['scheduled', 'awaiting_approval']) as { data: ConflictRow[] | null; error: unknown }

  // Helpers on another job are not a booking conflict either.
  const sameDayJobs = (sameDay ?? []).map(j => ({
    ...j,
    job_assignees: j.job_assignees.filter(a => !a.is_sub_installer),
  }))

  // A clash only counts as "hard" (blocking) when BOTH jobs have a fixed start
  // time. If the overlap exists only because a job has no fixed time — a
  // whole-day "floater" installer — it's a soft, non-blocking heads-up instead.
  const jobHasStart = !!hhmm(job.time_start)
  const bothFixed   = (j: ConflictRow) => jobHasStart && !!hhmm(j.time_start)

  const overlapping = sameDayJobs.filter(j =>
    timesOverlap(job.time_start, job.time_end, j.time_start, j.time_end)
  )
  const hardOverlap = overlapping.filter(bothFixed)
  const softOverlap = overlapping.filter(j => !bothFixed(j))

  const touching = sameDayJobs.filter(j =>
    !timesOverlap(job.time_start, job.time_end, j.time_start, j.time_end) &&
    timesTouch(job.time_start, job.time_end, j.time_start, j.time_end)
  )

  // Collect one entry per shared installer between the current job and each conflict.
  const collectClashes = (conflicts: ConflictRow[]): Clash[] => {
    const out: Clash[] = []
    const seen = new Set<string>()
    for (const conflict of conflicts) {
      const ids = new Set(conflict.job_assignees.map(a => a.user_id))
      for (const assignee of assignees) {
        if (ids.has(assignee.id) && !seen.has(assignee.id)) {
          seen.add(assignee.id)
          out.push({
            installer:      { id: assignee.id, name: assignee.name },
            conflictingJob: { jobId: conflict.id, client: conflict.client, timeStart: conflict.time_start, timeEnd: conflict.time_end },
          })
        }
      }
    }
    return out
  }

  const clashes        = collectClashes(hardOverlap)
  const softClashes    = collectClashes(softOverlap)
  const travelWarnings = collectClashes(touching)

  // Only firm (hard) overlaps mark a substitute as "busy".
  const busyInstallerIds = new Set<string>()
  for (const conflict of hardOverlap) {
    for (const a of conflict.job_assignees) busyInstallerIds.add(a.user_id)
  }

  type UserRow = { id: string; name: string; role: string; subrole: string | null; is_driver: boolean; qualifications: string[] }
  const { data: allInstallers } = await supabase
    .from('users')
    .select('id, name, role, subrole, is_driver, qualifications')
    .eq('role', 'installer')
    .is('deleted_at', null) as { data: UserRow[] | null; error: unknown }

  const currentAssigneeIds = new Set(assigneeIds)
  const subPool = (allInstallers ?? []).filter(u => !currentAssigneeIds.has(u.id))

  // Second leave query for the substitute pool — swapping someone in who is
  // also away just moves the problem.
  const subIds = subPool.map(u => u.id)
  const { data: subLeaveRows } = subIds.length === 0
    ? { data: [] as LeaveRecord[] }
    : await supabase
        .from('user_leaves')
        .select('id, user_id, date_start, date_end, start_portion, end_portion')
        .in('user_id', subIds)
        .lte('date_start', jobEndDate)
        .gte('date_end', job.date) as { data: LeaveRecord[] | null }
  const subOnLeave = onLeaveIds(
    subIds, job.date, job.date_end ?? null, job.time_start, job.time_end,
    (subLeaveRows ?? []) as LeaveRecord[],
  )

  const substitutes: Substitute[] = subPool
    .map(u => ({
      id: u.id, name: u.name, role: u.role,
      subrole:        u.subrole,
      isDriver:       u.is_driver,
      qualifications: u.qualifications ?? [],
      hasConflict:    busyInstallerIds.has(u.id),
      onLeave:        subOnLeave.has(u.id),
    }))
    // Free people first; busy and away both sink to the bottom.
    .sort((a, b) => Number(a.hasConflict || a.onLeave) - Number(b.hasConflict || b.onLeave))

  // Week workload
  const weekStart = getWeekStart(job.date)
  const weekEnd   = (() => {
    const d = new Date(weekStart + 'T00:00:00')
    d.setDate(d.getDate() + 6)
    return d.toISOString().slice(0, 10)
  })()

  type WeekJobRow = {
    id: string; date: string; client: string
    time_start: string | null; time_end: string | null
    job_assignees: Array<{ user_id: string; users: { id: string; name: string } | null }>
  }
  const { data: weekJobs } = await supabase
    .from('jobs')
    .select('id, date, client, time_start, time_end, job_assignees(user_id, users(id, name))')
    .gte('date', weekStart)
    .lte('date', weekEnd)
    .in('status', ['scheduled', 'awaiting_approval']) as { data: WeekJobRow[] | null; error: unknown }

  const weekDays: WeekDay[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart + 'T00:00:00')
    d.setDate(d.getDate() + i)
    const date    = d.toISOString().slice(0, 10)
    const dayJobs = (weekJobs ?? []).filter(j => j.date === date)

    const instMap = new Map<string, InstallerDayBreakdown>()
    for (const j of dayJobs) {
      for (const a of j.job_assignees) {
        if (!a.users) continue
        if (!instMap.has(a.user_id)) instMap.set(a.user_id, { id: a.user_id, name: a.users.name, jobs: [] })
        instMap.get(a.user_id)!.jobs.push({
          id: j.id, client: j.client,
          timeStart: hhmm(j.time_start),
          timeEnd:   hhmm(j.time_end),
        })
      }
    }

    return { date, dayLabel: DAY_LABELS[i], jobCount: dayJobs.length, installerBreakdown: Array.from(instMap.values()) }
  })

  return NextResponse.json({
    clashes, softClashes, travelWarnings, leaveClashes, substitutes, weekDays,
    jobDate:      job.date,
    jobTimeStart: job.time_start,
    jobTimeEnd:   job.time_end,
  } satisfies ClashesResponse)
}
