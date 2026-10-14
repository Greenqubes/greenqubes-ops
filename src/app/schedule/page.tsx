import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getScheduleJobs, getDrivers, getSupportPool, getStageJobs } from '@/lib/supabase/queries/jobs'
import { getLeaveForSchedule, getHolidays, getCompanyEvents } from '@/lib/supabase/queries/leave'
import { awayTripsOrEmpty } from '@/lib/supabase/queries/away'
import { ScheduleShell } from '@/features/schedule/ScheduleShell'
import { getEffectiveRole, getNavRole } from '@/lib/utils/role-override'
import type { LangCode } from '@/lib/i18n'
import type { Role } from '@/lib/supabase/types'

export default async function SchedulePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  type ProfileRow = { id: string; role: Role; lang: string }
  const { data: profile } = await supabase
    .from('users')
    .select('id, role, lang')
    .eq('auth_id', user.id)
    .maybeSingle() as { data: ProfileRow | null; error: unknown }

  if (!profile) redirect('/login')

  const effectiveRole = await getEffectiveRole(profile.role)
  // Nav only: a plain admin navigates with their own tabs. Permissions below
  // keep using effectiveRole exactly as before.
  const navRole      = await getNavRole(profile.role)
  if (effectiveRole === 'installer') redirect('/installer')

  // My Jobs panel: the roles that create and run jobs (Nic, 2026-10-08).
  // A plain admin resolves to 'scheduler' here, so admins get it too.
  const showMyJobs = ['sales', 'coordinator', 'scheduler'].includes(effectiveRole)
  const [jobs, leaves, holidays, events, drivers, supportPool, awayTrips, myJobsSource] = await Promise.all([
    getScheduleJobs(), getLeaveForSchedule(), getHolidays(), getCompanyEvents(),
    getDrivers(), getSupportPool(), awayTripsOrEmpty(),
    showMyJobs
      ? getStageJobs(['pending', 'awaiting_approval', 'awaiting_date', 'scheduled']) // raw status — see job-stage.ts
      : Promise.resolve(undefined),
  ])

  return (
    <ScheduleShell
      jobs={jobs}
      leaves={leaves}
      holidays={holidays}
      events={events}
      awayTrips={awayTrips}
      drivers={drivers}
      supportPool={supportPool}
      lang={(profile.lang as LangCode) ?? 'en'}
      role={effectiveRole}
      navRole={navRole}
      myJobsSource={myJobsSource}
      userId={profile.id}
    />
  )
}
