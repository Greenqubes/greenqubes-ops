import { Calendar } from 'lucide-react'
import { JobRow } from './JobRow'
import { dayLabel, langToLocale } from './utils'
import type { ScheduleJob } from '@/lib/supabase/queries/jobs'

interface ListStrings {
  noJobs:       string
  strictOnTime: string
  flexibleWindow: string
}

interface ListViewProps {
  jobs:         ScheduleJob[]
  dates:        string[]
  jobsByDate:   Record<string, ScheduleJob[]>
  selectedDate: string
  today:        string
  lang:         string
  strings:      ListStrings
  onSelectDate: (date: string) => void
}

export function ListView({
  jobs, dates, jobsByDate, selectedDate, today, lang, strings, onSelectDate,
}: ListViewProps) {
  const locale  = langToLocale(lang)
  const dayJobs = jobsByDate[selectedDate] ?? []

  return (
    <div>
      {/* Date strip */}
      {dates.length > 0 && (
        <div className="flex gap-2 overflow-x-auto px-4 pb-3 scrollbar-none">
          {dates.map(d => {
            const active    = d === selectedDate
            const isToday   = d === today
            const count     = jobsByDate[d]?.length ?? 0
            const dayNum    = new Date(d + 'T00:00:00').getDate()
            const shortDay  = dayLabel(d, locale)

            return (
              <button
                key={d}
                onClick={() => onSelectDate(d)}
                className={cn(
                  'relative flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl border shrink-0 min-w-[52px]',
                  'transition-colors text-xs font-medium',
                  active
                    ? 'bg-ink border-ink text-white'
                    : 'bg-paper border-line text-ink2 hover:border-ink2'
                )}
              >
                <span className="text-[10px] opacity-70 uppercase tracking-wide">{shortDay}</span>
                <span className={cn('font-display text-base leading-none', isToday && !active && 'text-terracotta')}>
                  {dayNum}
                </span>
                {count > 0 && (
                  <span className={cn(
                    'absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full',
                    active ? 'bg-white' : 'bg-terracotta'
                  )} />
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Job list for selected date */}
      <div className="px-4 pb-24">
        {dayJobs.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-muted">
            <Calendar size={28} strokeWidth={1.2} />
            <p className="text-sm">{strings.noJobs}</p>
          </div>
        ) : (
          <>
            {/* Punctuality legend */}
            <div className="flex gap-4 mb-3">
              <span className="flex items-center gap-1.5 text-xs text-muted">
                <span className="w-2 h-2 rounded-sm bg-terracotta inline-block" />
                {strings.strictOnTime}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted">
                <span className="w-2 h-2 rounded-sm bg-brand-blue inline-block" />
                {strings.flexibleWindow}
              </span>
            </div>
            {dayJobs.map(job => <JobRow key={job.id} job={job} />)}
          </>
        )}
      </div>
    </div>
  )
}

// cn is needed here since this file is used inside a client component
function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}
