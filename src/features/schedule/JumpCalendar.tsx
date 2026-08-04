'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { getMonthCells, monthLabel, shiftMonth } from './utils'
import type { ScheduleJob } from '@/lib/supabase/queries/jobs'

const DAY_HEADS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] // Mon-first, always English

interface JumpCalendarProps {
  selectedDate: string
  today:        string
  jobsByDate:   Record<string, ScheduleJob[]>
  onSelectDate: (date: string) => void
  onClose:      () => void
}

export function JumpCalendar({ selectedDate, today, jobsByDate, onSelectDate, onClose }: JumpCalendarProps) {
  const [viewMonth, setViewMonth] = useState(selectedDate)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      {/* scrim: closes on outside tap; above BottomNav per the overlay hard rule */}
      <div className="fixed inset-0 z-[60]" onClick={onClose} />

      <div className="absolute left-4 top-full mt-1 z-[70] w-[300px] bg-paper border border-line rounded-2xl p-4 shadow-lg">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => setViewMonth(m => shiftMonth(m, -1))}
            aria-label="Previous month"
            className="p-1.5 text-muted hover:text-ink transition-colors rounded-lg"
          >
            <ChevronLeft size={15} />
          </button>
          <span className="font-display text-[15px] font-medium text-ink">{monthLabel(viewMonth)}</span>
          <button
            onClick={() => setViewMonth(m => shiftMonth(m, 1))}
            aria-label="Next month"
            className="p-1.5 text-muted hover:text-ink transition-colors rounded-lg"
          >
            <ChevronRight size={15} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-0.5">
          {DAY_HEADS.map((h, i) => (
            <span key={`h${i}`} className="text-center text-[9px] text-muted uppercase tracking-wide py-1">
              {h}
            </span>
          ))}
          {getMonthCells(viewMonth).map((d, i) => {
            if (!d) return <span key={i} />
            const hasJobs  = (jobsByDate[d] ?? []).length > 0
            const sel      = d === selectedDate
            const isToday  = d === today
            return (
              <button
                key={i}
                onClick={() => { onSelectDate(d); onClose() }}
                className={cn(
                  'relative aspect-square flex items-center justify-center text-xs rounded-lg transition-colors',
                  sel
                    ? 'bg-ink text-paper'
                    : isToday
                      ? 'text-terracotta font-semibold ring-1 ring-inset ring-terracotta'
                      : 'text-ink2 hover:bg-bg'
                )}
              >
                {Number(d.slice(8, 10))}
                {hasJobs && (
                  <span className={cn(
                    'absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full',
                    sel ? 'bg-white' : 'bg-terracotta'
                  )} />
                )}
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}
