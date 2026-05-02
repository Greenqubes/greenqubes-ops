import { dayLabel, langToLocale } from './utils'
import type { ScheduleJob } from '@/lib/supabase/queries/jobs'

const DAY_INDICES = [0, 1, 2, 3, 4, 5, 6] // Sun–Sat

interface MonthViewProps {
  monthCells:   (string | null)[]
  jobsByDate:   Record<string, ScheduleJob[]>
  selectedDate: string
  today:        string
  lang:         string
  onSelectDate: (date: string) => void
  onDrillDown:  (date: string) => void  // select date + switch to list view
}

export function MonthView({
  monthCells, jobsByDate, selectedDate, today, lang, onSelectDate, onDrillDown,
}: MonthViewProps) {
  const locale = langToLocale(lang)

  // Build day-of-week header using the anchor Sunday of the current month
  const firstRealDate = monthCells.find(d => d !== null) ?? today
  const weekStart = new Date(firstRealDate + 'T00:00:00')
  weekStart.setDate(weekStart.getDate() - weekStart.getDay())
  const dayHeaders = DAY_INDICES.map(i => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    return dayLabel(d.toISOString().split('T')[0], locale)
  })

  return (
    <div className="px-4 pb-6">
      {/* Day-of-week header */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {dayHeaders.map((h, i) => (
          <div key={i} className="text-center text-[10px] text-muted uppercase tracking-wide py-1">
            {h}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {monthCells.map((d, i) => {
          if (!d) return <div key={i} />

          const jobs       = jobsByDate[d] ?? []
          const isToday    = d === today
          const isSelected = d === selectedDate
          const dayNum     = new Date(d + 'T00:00:00').getDate()
          const dots       = jobs.slice(0, 3)

          return (
            <button
              key={i}
              onClick={() => onDrillDown(d)}
              className={cn(
                'aspect-square rounded-lg border flex flex-col items-center justify-start pt-1 px-0.5',
                'text-xs transition-colors cursor-pointer',
                isSelected
                  ? 'bg-ink border-ink text-white'
                  : isToday
                    ? 'border-terracotta text-terracotta font-semibold bg-paper'
                    : 'border-line text-ink2 bg-paper hover:border-ink2'
              )}
            >
              <span className="leading-none">{dayNum}</span>
              {dots.length > 0 && (
                <div className="flex gap-0.5 mt-1">
                  {dots.map((job, idx) => (
                    <span
                      key={idx}
                      className={cn(
                        'w-1 h-1 rounded-full',
                        isSelected
                          ? 'bg-white'
                          : job.punctuality === 'strict'
                            ? 'bg-terracotta'
                            : 'bg-brand-blue'
                      )}
                    />
                  ))}
                  {jobs.length > 3 && (
                    <span className={cn('text-[8px] leading-none', isSelected ? 'text-white' : 'text-muted')}>+</span>
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>

      <p className="text-center text-xs text-muted mt-3">tap any date to see jobs</p>
    </div>
  )
}

function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}
