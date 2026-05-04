'use client'

import { useState, useMemo, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search, List, CalendarDays, Grid3X3, ChevronLeft, ChevronRight, X, Bot } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils/cn'
import { t as tr } from '@/lib/i18n'
import { ListView  } from './ListView'
import { WeekView  } from './WeekView'
import { MonthView } from './MonthView'
import { NotificationDrawer } from '@/features/notifications/NotificationDrawer'
import {
  toISO, shiftDate, shiftMonth,
  getWeekDays, getMonthCells, monthLabel, langToLocale,
} from './utils'
import type { ScheduleJob } from '@/lib/supabase/queries/jobs'
import type { LangCode } from '@/lib/i18n'
import type { Role } from '@/lib/supabase/types'

type ViewMode = 'list' | 'week' | 'month'
type Filter   = 'all' | 'today' | 'week' | 'upcoming'

interface ScheduleShellProps {
  jobs:          ScheduleJob[]
  lang:          LangCode
  role?:         Role
  approvalCount?: number
}

export function ScheduleShell({ jobs, lang, role, approvalCount = 0 }: ScheduleShellProps) {
  const today = toISO(new Date())

  const [liveApprovalCount, setLiveApprovalCount] = useState(approvalCount)

  useEffect(() => { setLiveApprovalCount(approvalCount) }, [approvalCount])

  useEffect(() => {
    if (role !== 'scheduler') return
    const supabase = createClient()

    async function refreshCount() {
      const { count } = await supabase
        .from('jobs')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'awaiting_approval')
      setLiveApprovalCount(count ?? 0)
    }

    const channel = supabase
      .channel('schedule-approvals')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'jobs' }, () => {
        refreshCount()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [role])

  const [viewMode,     setViewMode]     = useState<ViewMode>('list')
  const [filter,       setFilter]       = useState<Filter>('all')
  const [query,        setQuery]        = useState('')
  const [showSearch,   setShowSearch]   = useState(false)
  const [selectedDate, setSelectedDate] = useState(today)

  const locale = langToLocale(lang)

  // ── Filtering ──
  const filtered = useMemo(() => jobs.filter(j => {
    if (filter === 'today'    && j.date !== today) return false
    if (filter === 'upcoming' && j.date <  today)  return false
    if (filter === 'week') {
      const diff = (new Date(j.date).getTime() - new Date(today).getTime()) / 86_400_000
      if (diff < 0 || diff > 7) return false
    }
    if (query.trim()) {
      const q   = query.toLowerCase()
      const hay = [
        j.client, j.description ?? '', j.location,
        ...j.job_assignees.map(a => a.users?.name ?? ''),
      ].join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  }), [jobs, filter, query, today])

  const dates = useMemo(
    () => [...new Set(filtered.map(j => j.date))].sort(),
    [filtered]
  )

  const jobsByDate = useMemo(() =>
    filtered.reduce<Record<string, ScheduleJob[]>>((acc, j) => {
      ;(acc[j.date] ??= []).push(j)
      return acc
    }, {}),
    [filtered]
  )

  const weekDays   = useMemo(() => getWeekDays(selectedDate),   [selectedDate])
  const monthCells = useMemo(() => getMonthCells(selectedDate), [selectedDate])

  // ── Navigation ──
  function goBack() {
    if (viewMode === 'list')  setSelectedDate(d => shiftDate(d, -1))
    if (viewMode === 'week')  setSelectedDate(d => shiftDate(d, -7))
    if (viewMode === 'month') setSelectedDate(d => shiftMonth(d, -1))
  }
  function goForward() {
    if (viewMode === 'list')  setSelectedDate(d => shiftDate(d,  1))
    if (viewMode === 'week')  setSelectedDate(d => shiftDate(d,  7))
    if (viewMode === 'month') setSelectedDate(d => shiftMonth(d, 1))
  }
  function drillDown(date: string) {
    setSelectedDate(date)
    setViewMode('list')
  }

  // ── Heading label ──
  const headingLabel = useMemo(() => {
    if (viewMode === 'list') {
      return new Date(selectedDate + 'T00:00:00')
        .toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'short' })
    }
    return monthLabel(selectedDate, locale)
  }, [viewMode, selectedDate, locale])

  const views: { v: ViewMode; Icon: typeof List; label: string }[] = [
    { v: 'list',  Icon: List,         label: tr(lang, 'viewList')  },
    { v: 'week',  Icon: CalendarDays, label: tr(lang, 'viewWeek')  },
    { v: 'month', Icon: Grid3X3,      label: tr(lang, 'viewMonth') },
  ]

  const filterChips: { v: Filter; label: string }[] = [
    { v: 'all',      label: tr(lang, 'filterAll')      },
    { v: 'today',    label: tr(lang, 'filterToday')    },
    { v: 'week',     label: tr(lang, 'filterWeek')     },
    { v: 'upcoming', label: tr(lang, 'filterUpcoming') },
  ]

  const listStrings = {
    noJobs:        tr(lang, 'noJobs'),
    strictOnTime:  tr(lang, 'strictOnTime'),
    flexibleWindow: tr(lang, 'flexibleWindow'),
  }

  return (
    <div className="min-h-screen bg-bg">

      {/* ── Header ── */}
      <div className="px-4 pt-5 pb-3 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-muted uppercase tracking-widest mb-1">
            {tr(lang, 'companySchedule')}
          </p>
          <div className="flex items-center gap-1">
            <button onClick={goBack}    className="p-1 text-muted hover:text-ink transition-colors rounded">
              <ChevronLeft  size={16} />
            </button>
            <h1 className="font-display text-2xl font-medium text-ink tracking-tight leading-none px-1">
              {headingLabel}
            </h1>
            <button onClick={goForward} className="p-1 text-muted hover:text-ink transition-colors rounded">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {role === 'scheduler' && (
            <Link
              href="/approvals"
              className="relative p-2 rounded-lg border border-line bg-paper text-ink2 hover:border-ink2 transition-colors"
              title={tr(lang, 'approvalsTab')}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 11l3 3L22 4"/>
                <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
              </svg>
              {liveApprovalCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 flex items-center justify-center bg-terracotta text-white text-[10px] font-bold rounded-full px-1 leading-none">
                  {liveApprovalCount}
                </span>
              )}
            </Link>
          )}
          <Link
            href="/assistant"
            className="p-2 rounded-lg border border-line bg-paper text-ink2 hover:border-ink2 transition-colors"
            title={tr(lang, 'assistant')}
          >
            <Bot size={15} />
          </Link>
          <NotificationDrawer jobs={jobs} lang={lang} />
          <button
            onClick={() => setShowSearch(s => !s)}
            aria-label="Toggle search"
            className={cn(
              'p-2 rounded-lg border transition-colors',
              showSearch
                ? 'bg-ink border-ink text-white'
                : 'bg-paper border-line text-ink2 hover:border-ink2'
            )}
          >
            <Search size={15} />
          </button>
        </div>
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
              placeholder={tr(lang, 'searchJobs')}
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
        <div className="flex bg-paper border border-line rounded-lg p-0.5 shrink-0">
          {views.map(({ v, Icon, label }) => (
            <button
              key={v}
              onClick={() => setViewMode(v)}
              title={label}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors',
                viewMode === v ? 'bg-ink text-white' : 'text-muted hover:text-ink'
              )}
            >
              <Icon size={11} />
              {label}
            </button>
          ))}
        </div>

        {filterChips.map(({ v, label }) => (
          <button
            key={v}
            onClick={() => setFilter(v)}
            className={cn(
              'px-3 py-1.5 rounded-full border text-[11px] font-medium shrink-0 transition-colors',
              filter === v
                ? 'bg-terracotta-soft border-terracotta text-terracotta'
                : 'bg-paper border-line text-ink2 hover:border-ink2'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Views ── */}
      {viewMode === 'list' && (
        <ListView
          jobs={filtered}
          dates={dates}
          jobsByDate={jobsByDate}
          selectedDate={selectedDate}
          today={today}
          lang={lang}
          strings={listStrings}
          onSelectDate={setSelectedDate}
        />
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
    </div>
  )
}
