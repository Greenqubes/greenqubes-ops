import { cn } from '@/lib/utils/cn'
import { t } from '@/lib/i18n'
import type { ScheduleJob } from '@/lib/supabase/queries/jobs'
import type { LangCode } from '@/lib/i18n'

const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] // always English

interface MonthViewProps {
  monthCells:   (string | null)[]
  jobsByDate:   Record<string, ScheduleJob[]>
  selectedDate: string
  today:        string
  lang:         LangCode
  /** Optional: only the live schedule passes these; InstallerShell shares
   *  this component and renders unchanged without them. */
  leaveNamesByDate?: Record<string, string[]>
  holidayByDate?:    Record<string, string>
  onSelectDate: (date: string) => void
  onDrillDown:  (date: string) => void  // select date + switch to list view
}

export function MonthView({
  monthCells, jobsByDate, selectedDate, today, lang,
  leaveNamesByDate = {}, holidayByDate = {}, onSelectDate, onDrillDown,
}: MonthViewProps) {
  // pb-24 was mobile clearance for the fixed BottomNav; gone below lg now
  // (nav drawer instead — R2-T5 / F1). Shared by ScheduleShell and
  // InstallerShell, both lg-gate BottomNav the same way.
  return (
    <div className="px-4 pb-8 lg:pb-24">
      {/* Day-of-week header */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_HEADERS.map((h, i) => (
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
                'relative aspect-square rounded-md border flex flex-col items-center justify-start pt-1 px-0.5',
                'text-xs transition-colors cursor-pointer',
                isSelected
                  ? 'bg-ink border-ink text-paper'
                  : isToday
                    ? 'border-terracotta text-terracotta font-semibold bg-paper'
                    : 'border-line text-ink2 bg-paper hover:border-ink2'
              )}
            >
              <span className="leading-none">{dayNum}</span>
              {/* Corner markers: blue top-left = someone away, green
                  top-right = public holiday. Job dots stay under the number. */}
              {(leaveNamesByDate[d] ?? []).length > 0 && (
                <span className={cn(
                  'absolute top-0.5 left-0.5 w-1 h-1 rounded-full',
                  isSelected ? 'bg-white' : 'bg-brand-blue',
                )} />
              )}
              {holidayByDate[d] && (
                <span className={cn(
                  'absolute top-0.5 right-0.5 w-1 h-1 rounded-full',
                  isSelected ? 'bg-white' : 'bg-brand-green',
                )} />
              )}
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
                            ? 'bg-punct-strict'
                            : 'bg-punct-flex'
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

      <p className="text-center text-xs text-muted mt-3">{t(lang, 'monthViewHint')}</p>
    </div>
  )
}
