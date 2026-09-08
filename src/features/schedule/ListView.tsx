import { Calendar } from 'lucide-react'
import { JobRow } from './JobRow'
import { DateStrip } from './DateStrip'
import { DayNotices } from './DayNotices'
import type { ScheduleJob } from '@/lib/supabase/queries/jobs'
import type { LangCode } from '@/lib/i18n'

interface ListStrings {
  noJobs:         string
  strictOnTime:   string
  flexibleWindow: string
  /** Optional so callers with their own strings object still satisfy this. */
  onLeave?:       string
  publicHoliday?: string
}

interface ListViewProps {
  jobsByDate:   Record<string, ScheduleJob[]>
  selectedDate: string
  today:        string
  lang:         LangCode
  strings:      ListStrings
  /** Optional: only the live schedule passes these; installer views don't. */
  leaveNamesByDate?: Record<string, string[]>
  holidayByDate?:    Record<string, string>
  onSelectDate: (date: string) => void
  selectable?:  boolean
  selectedIds?: Set<string>
  onToggle?:    (id: string) => void
  onDelete?:    (id: string) => void
}

export function ListView({
  jobsByDate, selectedDate, today, lang, strings,
  leaveNamesByDate = {}, holidayByDate = {}, onSelectDate,
  selectable, selectedIds, onToggle, onDelete,
}: ListViewProps) {
  const dayJobs    = jobsByDate[selectedDate] ?? []
  const dayHoliday = holidayByDate[selectedDate]
  // De-duplicated: one person can hold two overlapping entries (a half day
  // inside a longer one) and should still be named once.
  const dayLeave   = [...new Set(leaveNamesByDate[selectedDate] ?? [])]

  return (
    <div>
      <DateStrip
        jobsByDate={jobsByDate}
        selectedDate={selectedDate}
        today={today}
        lang={lang}
        leaveNamesByDate={leaveNamesByDate}
        holidayByDate={holidayByDate}
        onSelectDate={onSelectDate}
      />

      {/* Job list for selected date — pb-24 was mobile clearance for the
          fixed BottomNav; gone below lg now (nav drawer instead — R2-T5 /
          F1). Shared by ScheduleShell and InstallerShell, both lg-gate
          BottomNav the same way. */}
      <div className="px-4 pb-8 lg:pb-24">
        {/* Above the empty-day branch on purpose: a day with no jobs can
            still be a public holiday or have people away. */}
        <DayNotices
          leaveNames={dayLeave}
          holiday={dayHoliday}
          onLeaveLabel={strings.onLeave}
          holidayLabel={strings.publicHoliday}
        />
        {dayJobs.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-muted">
            <Calendar size={28} strokeWidth={1.2} />
            <p className="text-sm">{strings.noJobs}</p>
          </div>
        ) : (
          <>
            {/* Punctuality legend */}
            <div className="flex gap-3 mb-2">
              <span className="flex items-center gap-1 text-[10px] text-muted">
                <span className="w-1.5 h-1.5 rounded-sm bg-punct-strict inline-block" />
                {strings.strictOnTime}
              </span>
              <span className="flex items-center gap-1 text-[10px] text-muted">
                <span className="w-1.5 h-1.5 rounded-sm bg-punct-flex inline-block" />
                {strings.flexibleWindow}
              </span>
            </div>
            {dayJobs.map(job => (
              <JobRow
                key={job.id}
                job={job}
                currentDate={selectedDate}
                selectable={selectable}
                selected={selectedIds?.has(job.id)}
                onToggle={onToggle}
                deletable={selectable}
                onDelete={() => onDelete?.(job.id)}
              />
            ))}
          </>
        )}
      </div>
    </div>
  )
}
