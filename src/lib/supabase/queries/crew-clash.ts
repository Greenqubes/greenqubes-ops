import type { createClient } from '@/lib/supabase/server'
import type { createServiceClient } from '@/lib/supabase/service'
import { formatDate } from '@/lib/telegram/templates'
import { timesOverlap } from '@/lib/utils/clash-detection'
import { onLeaveIds, leaveBlocksJob, leaveDatesLabel, type LeaveRecord } from '@/lib/utils/leave-overlap'
import { awayTripFor, awayWhenLabel } from '@/lib/utils/away-overlap'
import { awayTripsInRangeOrEmpty } from '@/lib/supabase/queries/away'
import type { CheckClash, LeaveCheckClash, AwayCheckClash } from '@/features/job-detail/EditClashModal'

/**
 * The crew check for one job at one slot — lifted unchanged out of
 * /api/jobs/[id]/assign-installers?checkOnly so the To arrange offer and
 * Client OK (spec 2026-11-04) ask exactly the same question as Save & notify.
 *
 *   • booking clashes — DRIVERS only. Support crew are exempt from
 *     double-booking (Phase 3 rule), both on this job and on the other one.
 *   • leave + away    — drivers AND support crew: a person on leave is away
 *     whatever their role on the job.
 *
 * The client is passed in: the checkOnly route uses the caller's session (as
 * it always has); the arrange route passes the service client, because a
 * sales caller's session cannot see every crew row.
 */
export type CrewClashInput = {
  jobId: string; date: string; dateEnd: string | null; timeStart: string | null
  timeEnd: string | null; punctuality: string; driverIds: string[]; supportIds: string[]
}
export type CrewClashResult = { clashes: CheckClash[]; leaveClashes: LeaveCheckClash[]; awayClashes: AwayCheckClash[] }

type SessionDb = Awaited<ReturnType<typeof createClient>>
type ServiceDb = ReturnType<typeof createServiceClient>

export async function computeCrewClashes(
  client: SessionDb | ServiceDb, input: CrewClashInput,
): Promise<CrewClashResult> {
  // The two clients are the same PostgREST client at runtime; their typings
  // come from different package versions (@supabase/ssr vs supabase-js), so
  // TypeScript cannot call through a union of them. One cast, here only.
  const db = client as SessionDb
  const { jobId, date, dateEnd, timeStart, timeEnd, punctuality, driverIds } = input
  const everyone = [...new Set([...driverIds, ...input.supportIds])]

  type ConflictRow = {
    id: string; project_title: string | null; client: string
    time_start: string | null; time_end: string | null; punctuality: string
    job_assignees: Array<{ user_id: string; is_sub_installer: boolean }>
  }
  // Sub-installers are excluded from clash detection (Phase 3 rule) — a
  // helper on another job is not a booking conflict.
  const { data: sameDay } = await db
    .from('jobs')
    .select('id, project_title, client, time_start, time_end, punctuality, job_assignees(user_id, is_sub_installer)')
    .eq('date', date)
    .neq('id', jobId)
    .in('status', ['scheduled', 'awaiting_approval']) as { data: ConflictRow[] | null; error: unknown }

  const names = new Map<string, string>()
  if (everyone.length > 0) {
    const { data: users } = await db
      .from('users')
      .select('id, name')
      .in('id', everyone) as { data: Array<{ id: string; name: string }> | null }
    for (const u of users ?? []) names.set(u.id, u.name)
  }

  // Hard only when both jobs are strict AND both have fixed start times —
  // same grading as the board and the Phase 2 push-time check.
  const clashes: CheckClash[] = []
  for (const conflict of sameDay ?? []) {
    if (!timesOverlap(timeStart, timeEnd, conflict.time_start, conflict.time_end)) continue
    const bothStrict = punctuality === 'strict' && conflict.punctuality === 'strict'
    const bothFixed  = !!timeStart && !!conflict.time_start
    if (punctuality !== 'strict' && conflict.punctuality !== 'strict') continue
    const severity: CheckClash['severity'] = bothStrict && bothFixed ? 'hard' : 'soft'
    const conflictIds = new Set(
      conflict.job_assignees.filter(a => !a.is_sub_installer).map(a => a.user_id),
    )
    for (const id of driverIds) {
      if (!conflictIds.has(id)) continue
      clashes.push({
        installerId:   id,
        installerName: names.get(id) ?? '',
        severity,
        conflict: {
          jobId:        conflict.id,
          projectTitle: conflict.project_title,
          client:       conflict.client,
          timeStart:    conflict.time_start,
          timeEnd:      conflict.time_end,
        },
      })
    }
  }

  // ── Leave ────────────────────────────────────────────────────────────────
  // No sub-installer carve-out: support crew are exempt from double-booking,
  // never from leave. Uses the possibly-overridden date so the form checks
  // the values the user is about to save, not the ones on disk.
  const jobEndDate = dateEnd && dateEnd > date ? dateEnd : date
  const { data: leaveRows } = everyone.length === 0
    ? { data: [] as LeaveRecord[] }
    : await db
        .from('user_leaves')
        .select('id, user_id, date_start, date_end, start_portion, end_portion')
        .in('user_id', everyone)
        .lte('date_start', jobEndDate)
        .gte('date_end', date) as { data: LeaveRecord[] | null }
  const leaves = (leaveRows ?? []) as LeaveRecord[]

  const away = onLeaveIds(everyone, date, dateEnd, timeStart, timeEnd, leaves)
  const leaveClashes: LeaveCheckClash[] = everyone
    .filter(id => away.has(id))
    .flatMap(id => {
      const l = leaves.find(x =>
        x.user_id === id && leaveBlocksJob(x, date, dateEnd, timeStart, timeEnd))
      if (!l) return []
      return [{
        installerId:   id,
        installerName: names.get(id) ?? '',
        dates:         leaveDatesLabel(l, formatDate),
      }]
    })

  // Away on work — amber, never part of hasClash (spec §6).
  const awayTrips = everyone.length === 0 ? [] : await awayTripsInRangeOrEmpty(date, jobEndDate)
  const awayClashes: AwayCheckClash[] = everyone.flatMap(id => {
    const trip = awayTripFor(id, date, dateEnd, timeStart, timeEnd, awayTrips)
    return trip
      ? [{ installerId: id, installerName: names.get(id) ?? '', title: trip.title, when: awayWhenLabel(trip) }]
      : []
  })

  return { clashes, leaveClashes, awayClashes }
}
