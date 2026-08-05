'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { t as tr } from '@/lib/i18n'
import { dayLabel, getWeekDays, getMonthDays, shiftDate, shiftMonth, isOverdue } from './utils'
import type { ScheduleJob } from '@/lib/supabase/queries/jobs'
import type { LangCode } from '@/lib/i18n'

type StripMode = 'week' | 'month'
const MODE_KEY = 'gq-strip-mode'

interface DateStripProps {
  jobsByDate:   Record<string, ScheduleJob[]>
  selectedDate: string
  today:        string
  lang:         LangCode
  onSelectDate: (date: string) => void
}

export function DateStrip({ jobsByDate, selectedDate, today, lang, onSelectDate }: DateStripProps) {
  const [mode,   setMode]   = useState<StripMode>('week')
  const [anchor, setAnchor] = useState(selectedDate)
  const stripRef    = useRef<HTMLDivElement>(null)
  const firstScroll = useRef(true)

  // localStorage only after mount — /schedule is hydration-sensitive (#418)
  useEffect(() => {
    if (localStorage.getItem(MODE_KEY) === 'month') setMode('month')
  }, [])

  // the window follows the selection; paging arrows move it independently
  useEffect(() => { setAnchor(selectedDate) }, [selectedDate])

  const days = mode === 'week' ? getWeekDays(anchor) : getMonthDays(anchor)

  // keep the selected day centred (only month mode can overflow)
  useEffect(() => {
    const el = stripRef.current
    if (!el) return
    const target = el.querySelector<HTMLElement>('[data-sel]')
    const behavior: ScrollBehavior = firstScroll.current ? 'auto' : 'smooth'
    firstScroll.current = false
    if (!target) { el.scrollTo({ left: 0, behavior }); return }
    el.scrollTo({ left: target.offsetLeft - el.clientWidth / 2 + target.clientWidth / 2, behavior })
  }, [selectedDate, anchor, mode])

  // mouse wheel → horizontal scroll; native listener because React's onWheel is passive
  useEffect(() => {
    const el = stripRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return
      e.preventDefault()
      el.scrollLeft += e.deltaY
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  function toggleMode() {
    setMode(m => {
      const next: StripMode = m === 'week' ? 'month' : 'week'
      localStorage.setItem(MODE_KEY, next)
      return next
    })
  }

  function page(dir: -1 | 1) {
    setAnchor(a => (mode === 'week' ? shiftDate(a, dir * 7) : shiftMonth(a, dir)))
  }

  const toggleLabel = tr(lang, mode === 'week' ? 'stripShowMonth' : 'stripShowWeek')

  // Which month(s) the visible window covers — persistent while paging (always English)
  const first = days[0]
  const last  = days[days.length - 1]
  const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) =>
    new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', opts)
  const windowLabel =
    first.slice(0, 7) === last.slice(0, 7)
      ? fmt(first, { month: 'long', year: 'numeric' })
      : first.slice(0, 4) === last.slice(0, 4)
        ? `${fmt(first, { month: 'short' })} – ${fmt(last, { month: 'short', year: 'numeric' })}`
        : `${fmt(first, { month: 'short', year: 'numeric' })} – ${fmt(last, { month: 'short', year: 'numeric' })}`

  return (
    <div className="pb-2">
      <p className="px-4 pb-1 text-[10px] uppercase tracking-widest text-muted text-center">{windowLabel}</p>
      <div className="flex items-center gap-1 px-2">
      <button
        onClick={() => page(-1)}
        aria-label="Previous"
        className="p-1.5 text-muted hover:text-ink transition-colors rounded-lg shrink-0"
      >
        <ChevronLeft size={15} />
      </button>

      <div ref={stripRef} className="relative flex gap-1.5 flex-1 min-w-0 overflow-x-auto scrollbar-none p-0.5">
        {days.map(d => {
          const dateJobs    = jobsByDate[d] ?? []
          const active      = d === selectedDate
          const isToday     = d === today
          const hasOverdue  = dateJobs.some(j => isOverdue(j.status, j.date))
          const hasStrict   = dateJobs.some(j => j.punctuality === 'strict')
          const hasFlexible = dateJobs.some(j => j.punctuality !== 'strict')

          return (
            <button
              key={d}
              data-sel={active ? '' : undefined}
              onClick={() => onSelectDate(d)}
              className={cn(
                'relative flex flex-col items-center gap-0.5 py-2 rounded-xl border transition-colors text-xs font-medium',
                mode === 'week' ? 'flex-1 basis-0 min-w-0' : 'shrink-0 min-w-[50px]',
                active
                  ? 'bg-ink border-ink text-paper'
                  : hasOverdue
                    ? 'bg-bad-soft border-bad text-bad'
                    : 'bg-paper border-line text-ink2 hover:border-ink2'
              )}
            >
              <span className={cn('text-[10px] uppercase tracking-wide', !hasOverdue && 'opacity-70')}>
                {dayLabel(d)}
              </span>
              <span className={cn(
                'font-display text-base leading-none',
                !active && isToday && !hasOverdue && 'text-terracotta'
              )}>
                {Number(d.slice(8, 10))}
              </span>

              {dateJobs.length > 0 && (
                active ? (
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-white" />
                ) : (hasStrict && hasFlexible) ? (
                  <>
                    <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-brand-blue" />
                    <span className="absolute top-1.5 right-[9px] w-1.5 h-1.5 rounded-full bg-[#D14545]" />
                  </>
                ) : hasFlexible ? (
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-brand-blue" />
                ) : (
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#D14545]" />
                )
              )}
            </button>
          )
        })}
      </div>

      <button
        onClick={() => page(1)}
        aria-label="Next"
        className="p-1.5 text-muted hover:text-ink transition-colors rounded-lg shrink-0"
      >
        <ChevronRight size={15} />
      </button>

      <button
        onClick={toggleMode}
        title={toggleLabel}
        aria-label={toggleLabel}
        className="p-2 rounded-lg border border-line bg-paper text-ink2 hover:border-ink2 transition-colors shrink-0"
      >
        {mode === 'week' ? <MonthGridIcon /> : <WeekRowIcon />}
      </button>
      </div>
    </div>
  )
}

// The toggle icon shows the layout you'd switch TO (Nic, 2026-08-04).
function MonthGridIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M16 2v4M8 2v4M3 9h18" />
      <path d="M7 13h.01M12 13h.01M17 13h.01M7 17h.01M12 17h.01M17 17h.01" />
    </svg>
  )
}

function WeekRowIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="8" width="20" height="8" rx="2" />
      <path d="M7 11v2M12 11v2M17 11v2" />
    </svg>
  )
}
