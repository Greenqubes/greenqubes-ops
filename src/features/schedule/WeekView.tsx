import { JobRow } from './JobRow'
import { dayLabel, langToLocale } from './utils'
import type { ScheduleJob } from '@/lib/supabase/queries/jobs'

interface WeekViewProps {
  weekDays:   string[]
  jobsByDate: Record<string, ScheduleJob[]>
  today:      string
  lang:       string
}

export function WeekView({ weekDays, jobsByDate, today, lang }: WeekViewProps) {
  const locale = langToLocale(lang)

  return (
    <div className="px-4 pb-6 space-y-5">
      {weekDays.map(d => {
        const jobs    = jobsByDate[d] ?? []
        const dayNum  = new Date(d + 'T00:00:00').getDate()
        const short   = dayLabel(d, locale)
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
                <span className="text-[10px] font-medium text-terracotta uppercase tracking-wide">today</span>
              )}
              {jobs.length > 0 && (
                <span className="ml-auto text-xs text-muted">
                  {jobs.length} {jobs.length === 1 ? 'job' : 'jobs'}
                </span>
              )}
            </div>

            {jobs.length === 0 ? (
              <p className="pl-3 text-sm text-muted italic">—</p>
            ) : (
              jobs.map(job => <JobRow key={job.id} job={job} />)
            )}
          </div>
        )
      })}
    </div>
  )
}

function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}
