'use client'

import { useState, useMemo } from 'react'
import { Search, X, Briefcase, List, CalendarDays, Grid3X3, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { CompanyBar } from '@/components/CompanyBar'
import { t } from '@/lib/i18n'
import {
  toISO, timeToMinutes, shiftDate, shiftMonth,
  getWeekDays, getMonthCells, monthLabel, langToLocale,
} from '@/features/schedule/utils'
import { WeekView  } from '@/features/schedule/WeekView'
import { MonthView } from '@/features/schedule/MonthView'
import { InstallerJobCard } from './InstallerJobCard'
import { NowCard } from './NowCard'
import { BottomNav } from '@/components/BottomNav'
import type { InstallerJob } from '@/lib/supabase/queries/installer'
import type { ScheduleJob } from '@/lib/supabase/queries/jobs'
import type { LangCode } from '@/lib/i18n'

type Tab      = 'today' | 'next' | 'week'
type ViewMode = 'list' | 'week' | 'month'

function getWeekEnd(today: string): string {
  const d = new Date(today + 'T00:00:00')
  const dayOfWeek = d.getDay()
  const daysUntilSun = dayOfWeek === 0 ? 0 : 7 - dayOfWeek
  d.setDate(d.getDate() + daysUntilSun)
  return toISO(d)
}

interface Props {
  jobs:     InstallerJob[]
  lang:     LangCode
  userName: string
}

export function InstallerShell({ jobs, lang, userName }: Props) {
  const [tab,          setTab]          = useState<Tab>('today')
  const [viewMode,     setViewMode]     = useState<ViewMode>('list')
  const [query,        setQuery]        = useState('')
  const [showSearch,   setShowSearch]   = useState(false)
  const [selectedDate, setSelectedDate] = useState(() => toISO(new Date()))

  const today   = toISO(new Date())
  const weekEnd = getWeekEnd(today)
  const locale  = langToLocale(lang)

  const scheduled = useMemo(
    () => jobs
      .filter(j => j.status === 'scheduled')
      .sort((a, b) => a.date.localeCompare(b.date) || (a.time_start ?? '').localeCompare(b.time_start ?? '')),
    [jobs],
  )

  const todayJobs = useMemo(() => scheduled.filter(j => j.date === today), [scheduled, today])
  const nextJobs  = useMemo(() => scheduled.filter(j => j.date > today).slice(0, 5), [scheduled, today])
  const weekJobs  = useMemo(() => scheduled.filter(j => j.date >= today && j.date <= weekEnd), [scheduled, today, weekEnd])

  const nowMins = useMemo(() => {
    const now = new Date()
    return now.getHours() * 60 + now.getMinutes()
  }, [])

  const currentJob = useMemo(() => {
    return todayJobs.find(j => {
      const s = timeToMinutes(j.time_start)
      if (s === null || s > nowMins) return false
      const e = j.time_end ? timeToMinutes(j.time_end) : s + 480
      return e !== null && nowMins <= e + 60
    }) ?? null
  }, [todayJobs, nowMins])

  const firstName = userName.split(' ')[0]

  // ── List-mode jobs ──
  const baseJobs =
    tab === 'today' ? todayJobs :
    tab === 'next'  ? nextJobs  :
                     weekJobs

  const visibleJobs = useMemo(() => {
    if (!query.trim()) return baseJobs
    const q = query.toLowerCase()
    return baseJobs.filter(j =>
      [j.client, j.description ?? '', j.location ?? ''].join(' ').toLowerCase().includes(q)
    )
  }, [baseJobs, query])

  // ── Week / month views ──
  // Cast is safe: InstallerJob now has all fields JobRow reads
  const jobsByDate = useMemo(() =>
    scheduled.reduce<Record<string, ScheduleJob[]>>((acc, j) => {
      const job = j as unknown as ScheduleJob
      if (j.date_end && j.date_end > j.date) {
        let cur = j.date
        while (cur <= j.date_end) {
          ;(acc[cur] ??= []).push(job)
          cur = shiftDate(cur, 1)
        }
      } else {
        ;(acc[j.date] ??= []).push(job)
      }
      return acc
    }, {}),
    [scheduled],
  )

  const weekDays   = useMemo(() => getWeekDays(selectedDate),   [selectedDate])
  const monthCells = useMemo(() => getMonthCells(selectedDate), [selectedDate])

  function goBack() {
    if (viewMode === 'week')  setSelectedDate(d => shiftDate(d, -7))
    if (viewMode === 'month') setSelectedDate(d => shiftMonth(d, -1))
  }
  function goForward() {
    if (viewMode === 'week')  setSelectedDate(d => shiftDate(d, 7))
    if (viewMode === 'month') setSelectedDate(d => shiftMonth(d, 1))
  }
  function drillDown(date: string) {
    setSelectedDate(date)
    setViewMode('list')
  }

  const headingLabel = useMemo(
    () => monthLabel(selectedDate, locale),
    [selectedDate, locale],
  )

  const chips: { v: Tab; label: string; count: number }[] = [
    { v: 'today', label: t(lang, 'installerToday'),    count: todayJobs.length },
    { v: 'next',  label: t(lang, 'installerUpNext'),   count: nextJobs.length  },
    { v: 'week',  label: t(lang, 'installerThisWeek'), count: weekJobs.length  },
  ]

  const views: { v: ViewMode; Icon: typeof List; label: string }[] = [
    { v: 'list',  Icon: List,         label: t(lang, 'viewList')  },
    { v: 'week',  Icon: CalendarDays, label: t(lang, 'viewWeek')  },
    { v: 'month', Icon: Grid3X3,      label: t(lang, 'viewMonth') },
  ]

  return (
    <div className="min-h-screen bg-bg">

      {/* ── Company bar ── */}
      <CompanyBar lang={lang} />

      {/* ── Eyebrow ── */}
      <p className="text-center text-[11px] text-muted uppercase tracking-widest px-4 pt-3 pb-1">
        {t(lang, 'installerHi')}, {firstName}
      </p>

      {/* ── Header ── */}
      <div className="px-4 pt-5 pb-3 flex items-start justify-between gap-3">
        {viewMode === 'list' ? (
          <h1 className="font-display text-[26px] font-medium text-ink tracking-tight leading-none">
            {t(lang, 'installerMyJobs')}
          </h1>
        ) : (
          <div className="flex items-center gap-1">
            <button onClick={goBack}    className="p-1 text-muted hover:text-ink transition-colors rounded">
              <ChevronLeft  size={16} />
            </button>
            <h1 className="font-display text-[26px] font-medium text-ink tracking-tight leading-none px-1">
              {headingLabel}
            </h1>
            <button onClick={goForward} className="p-1 text-muted hover:text-ink transition-colors rounded">
              <ChevronRight size={16} />
            </button>
          </div>
        )}

        <button
          onClick={() => setShowSearch(s => !s)}
          aria-label="Toggle search"
          className={cn(
            'p-2 rounded-lg border transition-colors shrink-0',
            showSearch
              ? 'bg-ink border-ink text-paper'
              : 'bg-paper border-line text-ink2 hover:border-ink2'
          )}
        >
          <Search size={15} />
        </button>
      </div>

      {/* ── Search bar ── */}
      {showSearch && (
        <div className="px-4 pb-3">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={t(lang, 'searchJobs')}
              className="w-full bg-paper border border-line rounded-full py-2 pl-8 pr-8 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-terracotta"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── View toggle + filter chips ── */}
      <div className="flex items-center gap-2 px-4 pb-3 overflow-x-auto scrollbar-none">
        {/* View toggle */}
        <div className="flex bg-paper border border-line rounded-lg p-0.5 shrink-0">
          {views.map(({ v, Icon, label }) => (
            <button
              key={v}
              onClick={() => setViewMode(v)}
              title={label}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors',
                viewMode === v ? 'bg-ink text-paper' : 'text-muted hover:text-ink'
              )}
            >
              <Icon size={11} />
              {label}
            </button>
          ))}
        </div>

        {/* Filter chips — list mode only */}
        {viewMode === 'list' && chips.map(({ v, label, count }) => (
          <button
            key={v}
            onClick={() => setTab(v)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-medium shrink-0 transition-colors',
              tab === v
                ? 'bg-terracotta-soft border-terracotta text-terracotta'
                : 'bg-paper border-line text-ink2 hover:border-ink2',
            )}
          >
            {label}
            {count > 0 && (
              <span className={cn(
                'inline-flex items-center justify-center min-w-[16px] h-4 rounded-full px-1 text-[10px] font-bold leading-none',
                tab === v
                  ? 'bg-terracotta/15 text-terracotta'
                  : 'bg-ink/10 text-ink2',
              )}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Views ── */}
      {viewMode === 'list' && (
        <div className="px-4 space-y-3 pb-24">
          {visibleJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
              <Briefcase size={32} className="text-muted" strokeWidth={1.5} />
              <p className="text-sm text-muted">{t(lang, 'installerNothingToday')}</p>
            </div>
          ) : (
            <>
              {tab === 'today' && currentJob && (
                <NowCard job={currentJob} lang={lang} nowMins={nowMins} />
              )}
              {(tab === 'today' ? visibleJobs.filter(j => j.id !== currentJob?.id) : visibleJobs).map(job => (
                <InstallerJobCard key={job.id} job={job} lang={lang} />
              ))}
            </>
          )}
        </div>
      )}

      {viewMode === 'week' && (
        <WeekView
          weekDays={weekDays}
          jobsByDate={jobsByDate}
          today={today}
          lang={lang}
        />
      )}

      {viewMode === 'month' && (
        <MonthView
          monthCells={monthCells}
          jobsByDate={jobsByDate}
          selectedDate={selectedDate}
          today={today}
          lang={lang}
          onSelectDate={setSelectedDate}
          onDrillDown={drillDown}
        />
      )}

      <BottomNav role="installer" />
    </div>
  )
}
