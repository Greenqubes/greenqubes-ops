'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Search, List, CalendarDays, Grid3X3, ChevronLeft, ChevronRight, X, Plus } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils/cn'
import { t as tr } from '@/lib/i18n'
import { ListView  } from './ListView'
import { WeekView  } from './WeekView'
import { MonthView } from './MonthView'
import { NotificationDrawer } from '@/features/notifications/NotificationDrawer'
import { BottomNav } from '@/components/BottomNav'
import { UserMenu } from '@/components/UserMenu'
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
  jobs:     ScheduleJob[]
  lang:     LangCode
  role?:    Role
  pageMode?: 'schedule' | 'pending' | 'completed'
}

export function ScheduleShell({ jobs, lang, role, pageMode = 'schedule' }: ScheduleShellProps) {
  const today  = toISO(new Date())
  const router = useRouter()

  // Refresh server data on job changes (realtime) + every 2 min as fallback.
  // router.refresh() re-fetches server data while preserving all React state
  // (selected date, view mode, filters) — no visible disruption to the user.
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('schedule-jobs-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => {
        router.refresh()
      })
      .subscribe()
    const poll = setInterval(() => router.refresh(), 2 * 60 * 1000)
    return () => {
      supabase.removeChannel(channel)
      clearInterval(poll)
    }
  }, [router])

  const [viewMode,     setViewMode]     = useState<ViewMode>('list')
  const [filter,       setFilter]       = useState<Filter>('all')
  const [query,        setQuery]        = useState('')
  const [showSearch,   setShowSearch]   = useState(false)
  const [selectedDate, setSelectedDate] = useState(today)
  const [selectedIds,  setSelectedIds]  = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [confirmBulk,  setConfirmBulk]  = useState(false)

  const canBulkDelete = role === 'scheduler' || (role === 'sales' && pageMode === 'pending')

  function toggleJob(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleSingleDelete(id: string) {
    await fetch(`/api/jobs/${id}`, { method: 'DELETE' })
    router.refresh()
  }

  async function handleBulkDelete() {
    setBulkDeleting(true)
    try {
      await Promise.all(
        [...selectedIds].map(id => fetch(`/api/jobs/${id}`, { method: 'DELETE' }))
      )
      setSelectedIds(new Set())
      setConfirmBulk(false)
      router.refresh()
    } finally {
      setBulkDeleting(false)
    }
  }

  const locale = langToLocale(lang)

  // ── Filtering ──
  const filtered = useMemo(() => jobs.filter(j => {
    if (pageMode === 'schedule'  && (j.status === 'completed' || j.status === 'pending' || j.status === 'awaiting_approval')) return false
    if (pageMode === 'pending'   && (j.status !== 'pending'   && j.status !== 'awaiting_approval')) return false
    if (pageMode === 'completed' &&  j.status !== 'completed') return false
    const endDate = j.date_end ?? j.date
    if (filter === 'today'    && (today < j.date || today > endDate)) return false
    if (filter === 'upcoming' && endDate < today)  return false
    if (filter === 'week') {
      const startDiff = (new Date(j.date).getTime()    - new Date(today).getTime()) / 86_400_000
      const endDiff   = (new Date(endDate).getTime()   - new Date(today).getTime()) / 86_400_000
      if (endDiff < 0 || startDiff > 7) return false
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

  // Expand multi-day jobs so they appear on every date in their range
  const jobsByDate = useMemo(() =>
    filtered.reduce<Record<string, ScheduleJob[]>>((acc, j) => {
      if (j.date_end && j.date_end > j.date) {
        let cur = j.date
        while (cur <= j.date_end) {
          ;(acc[cur] ??= []).push(j)
          cur = shiftDate(cur, 1)
        }
      } else {
        ;(acc[j.date] ??= []).push(j)
      }
      return acc
    }, {}),
    [filtered]
  )

  const dates = useMemo(
    () => Object.keys(jobsByDate).sort(),
    [jobsByDate]
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
        .toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })
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

      {/* ── Company bar ── */}
      <div className="px-4 pt-3 pb-2.5 flex items-center justify-between border-b border-line">
        <div className="flex items-center gap-2">
          <span className="font-display font-semibold text-[22px] text-ink tracking-tight leading-none">GreenQubes</span>
          <span className="text-[10px] font-medium text-terracotta/50 tracking-wide">Pre-Alpha</span>
        </div>
        <div className="flex items-center gap-2">
          <NotificationDrawer jobs={jobs} lang={lang} />
          <UserMenu lang={lang} />
        </div>
      </div>

      {/* ── Company schedule label ── */}
      <p className="text-center text-[11px] text-muted uppercase tracking-widest px-4 pt-3 pb-1">
        {tr(lang, 'companySchedule')}
      </p>

      {/* ── Header ── */}
      <div className="px-4 pt-5 pb-3 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
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
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowSearch(s => !s)}
            aria-label="Toggle search"
            className={cn(
              'p-2 rounded-lg border transition-colors',
              showSearch
                ? 'bg-ink border-ink text-paper'
                : 'bg-paper border-line text-ink2 hover:border-ink2'
            )}
          >
            <Search size={15} />
          </button>
          {(role === 'sales' || role === 'scheduler') && (
            <Link
              href="/jobs/new"
              className="inline-flex items-center gap-1 px-3 py-[11px] text-xs rounded-lg font-semibold tracking-wide bg-terracotta text-white hover:brightness-90 active:brightness-75 transition-colors shrink-0"
            >
              <Plus size={12} />
              New
            </Link>
          )}
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
              onClick={() => { setViewMode(v); if (v === 'week' || v === 'month') setFilter('all') }}
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

        {viewMode !== 'month' && filterChips
          .filter(chip => viewMode === 'week' ? chip.v === 'all' : true)
          .map(({ v, label }) => (
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
          selectable={canBulkDelete}
          selectedIds={selectedIds}
          onToggle={toggleJob}
          onDelete={handleSingleDelete}
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

      {/* Bulk delete bar — sits above BottomNav */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-[57px] left-0 right-0 z-20 bg-paper border-t border-line px-4 py-3 flex items-center justify-between gap-3">
          {confirmBulk ? (
            <>
              <p className="text-sm font-medium text-ink">
                Delete {selectedIds.size} job{selectedIds.size !== 1 ? 's' : ''}? This can&apos;t be undone.
              </p>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => setConfirmBulk(false)}
                  disabled={bulkDeleting}
                  className="px-3 py-1.5 text-xs font-medium text-ink2 border border-line rounded-lg hover:border-ink2 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={bulkDeleting}
                  className="px-3 py-1.5 text-xs font-medium text-white rounded-lg transition-colors"
                  style={{ backgroundColor: 'var(--terracotta)' }}
                >
                  {bulkDeleting ? 'Deleting…' : 'Confirm'}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-ink2">
                <span className="font-semibold text-ink">{selectedIds.size}</span> selected
              </p>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="px-3 py-1.5 text-xs font-medium text-ink2 border border-line rounded-lg hover:border-ink2 transition-colors"
                >
                  Clear
                </button>
                <button
                  onClick={() => setConfirmBulk(true)}
                  className="px-3 py-1.5 text-xs font-medium text-white rounded-lg transition-colors"
                  style={{ backgroundColor: 'var(--terracotta)' }}
                >
                  Delete {selectedIds.size}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <BottomNav role={role ?? 'sales'} />
    </div>
  )
}
