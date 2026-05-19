import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { WeekDay, InstallerDayBreakdown } from '@/app/api/jobs/[id]/clashes/route'

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const hhmm = (t: string | null) => t?.slice(0, 5) ?? null

export async function GET(req: NextRequest) {
  const weekStart = req.nextUrl.searchParams.get('weekStart')
  if (!weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
    return NextResponse.json({ error: 'Invalid weekStart' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const weekEnd = (() => {
    const d = new Date(weekStart + 'T00:00:00')
    d.setDate(d.getDate() + 6)
    return d.toISOString().slice(0, 10)
  })()

  type JobRow = {
    id: string; date: string; client: string
    time_start: string | null; time_end: string | null
    job_assignees: Array<{ user_id: string; users: { id: string; name: string } | null }>
  }
  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, date, client, time_start, time_end, job_assignees(user_id, users(id, name))')
    .gte('date', weekStart)
    .lte('date', weekEnd)
    .in('status', ['scheduled', 'awaiting_approval']) as { data: JobRow[] | null; error: unknown }

  const weekDays: WeekDay[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart + 'T00:00:00')
    d.setDate(d.getDate() + i)
    const date    = d.toISOString().slice(0, 10)
    const dayJobs = (jobs ?? []).filter(j => j.date === date)

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

  return NextResponse.json(weekDays satisfies WeekDay[])
}
