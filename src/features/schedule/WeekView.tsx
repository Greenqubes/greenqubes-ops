import { cn } from '@/lib/utils/cn'
import { t } from '@/lib/i18n'
import { JobRow } from './JobRow'
import { dayLabel } from './utils'
import type { ScheduleJob } from '@/lib/supabase/queries/jobs'
import type { LangCode } from '@/lib/i18n'

interface WeekViewProps {
  weekDays:   string[]
  jobsByDate: Record<string, ScheduleJob[]>
  today:      string
  lang:       LangCode
  /** Optional: only the live schedule passes these; InstallerShell shares
   *  this component and renders unchanged without them. */
  leaveNamesByDate?: Record<string, string[]>
  holidayByDate?:    Record<string, string>
  onLeaveLabel?:     string
}

export function WeekView({
  weekDays, jobsByDate, today, lang,
  leaveNamesByDate = {}, holidayByDate = {}, onLeaveLabel = 'On leave',
}: WeekViewProps) {
  // pb-24 was mobile clearance for the fixed BottomNav; gone below lg now
  // (nav drawer instead — R2-T5 / F1). Shared by ScheduleShell and
  // InstallerShell, both lg-gate BottomNav the same way.
  return (
    <div className="px-4 pb-8 lg:pb-24 space-y-5">
      {weekDays.map(d => {
        const jobs    = jobsByDate[d] ?? []
        const dayNum  = new Date(d + 'T00:00:00').getDate()
        const short   = dayLabel(d)
        const isToday = d === today

        return (
          <div key={d}>
            <div className="flex items-baseline gap-2 mb-2">
              <span className={cn(
                'font-display text-lg leading-none',
                isToday ? 'text-terracotta' : 'text-ink'
              )}>
                {dayNum}
              </span>
              <span className="text-xs text-muted uppercase tracking-wide">{short}</span>
              {isToday && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-terracotta-soft text-terracotta text-[10px] font-medium">
                  {t(lang, 'filterToday')}
                </span>
              )}
              {holidayByDate[d] && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-brand-green-soft text-brand-green text-[10px] font-medium">
                  {holidayByDate[d]}
                </span>
              )}
              {jobs.length > 0 && (
                <span className="ml-auto text-xs text-muted">
                  {jobs.length} {jobs.length === 1 ? 'job' : 'jobs'}
                </span>
              )}
            </div>

            {(leaveNamesByDate[d] ?? []).length > 0 && (
              <p className="mb-1.5 text-[11px] text-muted">
                <span className="font-medium text-ink2">{onLeaveLabel}:</span>{' '}
                {[...new Set(leaveNamesByDate[d])].join(', ')}
              </p>
            )}

            {jobs.length === 0 ? (
              <p className="pl-3 text-xs text-muted italic">—</p>
            ) : (
              jobs.map(job => <JobRow key={job.id} job={job} currentDate={d} />)
            )}
          </div>
        )
      })}
    </div>
  )
}
