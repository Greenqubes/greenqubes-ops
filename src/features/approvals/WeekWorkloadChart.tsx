'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { fmtTime } from '@/features/schedule/utils'
import type { WeekDay } from '@/app/api/jobs/[id]/clashes/route'

// Every 2 jobs bumps level by 1, capped at 4
function jobLevel(count: number): number {
  if (count === 0) return 0
  return Math.min(Math.ceil(count / 2), 4)
}

// Bar heights in px for levels 0–4
const BAR_H = [6, 18, 32, 46, 60]

// Colours: grey → green → amber → orange → terracotta
const BAR_COLOR = [
  'bg-line',
  'bg-green',
  'bg-amber',
  'bg-orange-400',
  'bg-terracotta',
]

function getWeekStart(dateStr: string): string {
  const d   = new Date(dateStr + 'T00:00:00')
  const dow = d.getDay()
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1))
  return d.toISOString().slice(0, 10)
}

function shiftWeek(weekStart: string, delta: number): string {
  const d = new Date(weekStart + 'T00:00:00')
  d.setDate(d.getDate() + delta * 7)
  return d.toISOString().slice(0, 10)
}

function fmtWeekRange(weekStart: string): string {
  const start = new Date(weekStart + 'T00:00:00')
  const end   = new Date(weekStart + 'T00:00:00')
  end.setDate(end.getDate() + 6)
  const s  = start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  const e  = end.toLocaleDateString('en-GB',   { day: 'numeric', month: 'short' })
  const yr = `'${String(end.getFullYear()).slice(2)}`
  return `${s} – ${e} ${yr}`
}

interface Props {
  initialWeekDays: WeekDay[]
  jobDate:         string
}

export function WeekWorkloadChart({ initialWeekDays, jobDate }: Props) {
  const [weekStart,    setWeekStart]    = useState(() => getWeekStart(jobDate))
  const [weekDays,     setWeekDays]     = useState(initialWeekDays)
  const [loading,      setLoading]      = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const isFirstRender = useRef(true)

  // Fetch when navigating to a different week; skip on first mount (use initialWeekDays)
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return }
    setLoading(true)
    fetch(`/api/workload?weekStart=${weekStart}`)
      .then(r => r.json())
      .then((data: WeekDay[]) => setWeekDays(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [weekStart])

  const selectedDay = weekDays.find(d => d.date === selectedDate) ?? null

  const weeklyInstallers = useMemo(() => {
    const map = new Map<string, { id: string; name: string; jobCount: number; days: string[] }>()
    for (const day of weekDays) {
      for (const inst of day.installerBreakdown) {
        if (!map.has(inst.id)) map.set(inst.id, { id: inst.id, name: inst.name, jobCount: 0, days: [] })
        const e = map.get(inst.id)!
        e.jobCount += inst.jobs.length
        e.days.push(day.dayLabel)
      }
    }
    return Array.from(map.values()).sort((a, b) => b.jobCount - a.jobCount)
  }, [weekDays])

  function navigate(delta: number) {
    setSelectedDate(null)
    setWeekStart(prev => shiftWeek(prev, delta))
  }

  return (
    <div>
      {/* Week navigation */}
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={() => navigate(-1)}
          className="p-0.5 text-muted hover:text-ink transition-colors">
          <ChevronLeft size={13} />
        </button>
        <span className="text-[10px] font-medium text-muted">{fmtWeekRange(weekStart)}</span>
        <button type="button" onClick={() => navigate(1)}
          className="p-0.5 text-muted hover:text-ink transition-colors">
          <ChevronRight size={13} />
        </button>
      </div>

      <div className={cn('flex gap-3 transition-opacity duration-150', loading && 'opacity-40')}>

        {/* Bar chart — single flex row, one button per day contains bar + label */}
        <div className="flex-1 min-w-0 flex gap-1">
          {weekDays.map(day => {
            const level      = jobLevel(day.jobCount)
            const isSelected = day.date === selectedDate
            const isJobDay   = day.date === jobDate
            return (
              <button
                key={day.date}
                type="button"
                onClick={() => setSelectedDate(p => p === day.date ? null : day.date)}
                className="flex-1 flex flex-col items-stretch focus:outline-none"
              >
                {/* Bar area — fixed height, bar grows from bottom */}
                <div className="flex items-end" style={{ height: 60 }}>
                  <div
                    className={cn(
                      'w-full rounded-sm transition-all duration-200',
                      BAR_COLOR[level],
                      isSelected && 'ring-1 ring-inset ring-ink/50',
                      isJobDay && !isSelected && 'ring-1 ring-inset ring-terracotta/60',
                    )}
                    style={{ height: BAR_H[level] }}
                  />
                </div>
                {/* Label */}
                <span className={cn(
                  'mt-1 text-center text-[9px] font-medium transition-colors',
                  isSelected ? 'text-ink' : isJobDay ? 'text-terracotta' : 'text-muted'
                )}>
                  {day.dayLabel}
                </span>
              </button>
            )
          })}
        </div>

        {/* Installer panel */}
        <div className="w-36 shrink-0 flex flex-col">
          <p className="text-[9px] font-semibold uppercase tracking-widest text-muted mb-1">
            {selectedDay ? selectedDay.dayLabel : 'Week'}
          </p>
          <div className="overflow-y-auto flex-1" style={{ maxHeight: 72 }}>
            {selectedDay ? (
              selectedDay.installerBreakdown.length === 0 ? (
                <p className="text-[10px] text-muted">No jobs scheduled</p>
              ) : (
                <div className="space-y-1.5">
                  {selectedDay.installerBreakdown.map(inst => (
                    <div key={inst.id}>
                      <p className="text-[10px] font-semibold text-ink truncate">{inst.name}</p>
                      {inst.jobs.map(j => (
                        <p key={j.id} className="text-[9px] text-muted truncate leading-tight">
                          {j.client}{j.timeStart ? ` · ${fmtTime(j.timeStart)}` : ''}
                        </p>
                      ))}
                    </div>
                  ))}
                </div>
              )
            ) : (
              weeklyInstallers.length === 0 ? (
                <p className="text-[10px] text-muted">No jobs this week</p>
              ) : (
                <div className="space-y-0.5">
                  {weeklyInstallers.map(inst => (
                    <div key={inst.id} className="flex items-center gap-1">
                      <p className="text-[10px] text-ink truncate flex-1">{inst.name}</p>
                      <span className="text-[9px] font-semibold text-muted shrink-0">{inst.jobCount}j</span>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
