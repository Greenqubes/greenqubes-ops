import { Calendar } from 'lucide-react'
import { JobRow } from './JobRow'
import { DateStrip } from './DateStrip'
import type { ScheduleJob } from '@/lib/supabase/queries/jobs'
import type { LangCode } from '@/lib/i18n'

interface ListStrings {
  noJobs:         string
  strictOnTime:   string
  flexibleWindow: string
}

interface ListViewProps {
  jobsByDate:   Record<string, ScheduleJob[]>
  selectedDate: string
  today:        string
  lang:         LangCode
  strings:      ListStrings
  onSelectDate: (date: string) => void
  selectable?:  boolean
  selectedIds?: Set<string>
  onToggle?:    (id: string) => void
  onDelete?:    (id: string) => void
}

export function ListView({
  jobsByDate, selectedDate, today, lang, strings, onSelectDate,
  selectable, selectedIds, onToggle, onDelete,
}: ListViewProps) {
  const dayJobs = jobsByDate[selectedDate] ?? []

  return (
    <div>
      <DateStrip
        jobsByDate={jobsByDate}
        selectedDate={selectedDate}
        today={today}
        lang={lang}
        onSelectDate={onSelectDate}
      />

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
