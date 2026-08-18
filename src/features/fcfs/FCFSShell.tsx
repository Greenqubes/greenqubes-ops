'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react'
import { useLiveChannel } from '@/lib/supabase/useLiveChannel'
import { cn } from '@/lib/utils/cn'
import { t } from '@/lib/i18n'
import { toISO, shiftDate } from '@/features/schedule/utils'
import { detectClashes, confirmedClashes } from '@/lib/utils/clash-detection'
import { CompanyBar } from '@/components/CompanyBar'
import { BottomNav } from '@/components/BottomNav'
import { FCFSTimeline } from './FCFSTimeline'
import { AssignmentPanel } from './AssignmentPanel'
import { ClashDrawer } from './ClashDrawer'
import type { InstallerClash } from '@/lib/utils/clash-detection'
import type { FCFSJob } from '@/lib/supabase/queries/fcfs'
import type { InstallerUser } from '@/lib/supabase/queries/jobs'
import type { LangCode } from '@/lib/i18n'
import type { Role } from '@/lib/supabase/types'

// Hard rule: date labels are always English, regardless of UI language.
const fmtDayLabel = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

type TimeRange = 'am' | 'pm' | 'ampm' | 'biz'

const RANGES: Record<TimeRange, { startH: number; endH: number; label: string }> = {
  am:   { startH: 0,  endH: 12, label: 'AM' },
  pm:   { startH: 12, endH: 24, label: 'PM' },
  ampm: { startH: 0,  endH: 24, label: 'AM/PM' },
  biz:  { startH: 9,  endH: 18, label: '9am–6pm' },
}

const RANGE_STORAGE_KEY = 'fcfs-time-range'

const clashKey = (c: InstallerClash) => `${c.installerId}-${c.jobA.id}-${c.jobB.id}`

interface FCFSShellProps {
  initialJobs: FCFSJob[]
  initialDate: string
  installers:  InstallerUser[]
  role:        Role
  lang:        LangCode
}

export function FCFSShell({ initialJobs, initialDate, installers, role, lang }: FCFSShellProps) {
  const [date, setDate]           = useState(initialDate)
  const [jobs, setJobs]           = useState<FCFSJob[]>(initialJobs)
  const [loading, setLoading]     = useState(false)
  const [range, setRange]         = useState<TimeRange>('ampm')
  const [panelJobId, setPanelJobId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [dismissed, setDismissed]   = useState<Set<string>>(new Set())

  const dateRef = useRef(date)
  dateRef.current = date

  // Restore the last-used time range after mount (avoids a hydration mismatch).
  useEffect(() => {
    const saved = localStorage.getItem(RANGE_STORAGE_KEY) as TimeRange | null
    if (saved && saved in RANGES) setRange(saved)
  }, [])

  const pickRange = (r: TimeRange) => {
    setRange(r)
    localStorage.setItem(RANGE_STORAGE_KEY, r)
  }

  const refetch = useCallback(async (target: string, showSpinner: boolean) => {
    if (showSpinner) setLoading(true)
    try {
      const res = await fetch(`/api/fcfs?date=${target}`)
      if (!res.ok) return
      const data: FCFSJob[] = await res.json()
      if (dateRef.current === target) setJobs(data)
    } finally {
      if (showSpinner) setLoading(false)
    }
  }, [])

  // Fetch when the day changes (initial day came from the server).
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return }
    refetch(date, true)
  }, [date, refetch])

  // Live refresh on job / assignment changes + 2-min polling fallback,
  // mirroring the schedule page. job_assignees events flow once migration
  // 0043 adds the table to the realtime publication.
  useLiveChannel({
    name:    'fcfs-live',
    tables:  [{ table: 'jobs' }, { table: 'job_assignees' }],
    onEvent: () => refetch(dateRef.current, false),
    poll:    { ms: 2 * 60 * 1000, fn: () => refetch(dateRef.current, false) },
  })

  const allClashes = useMemo(() => detectClashes(jobs), [jobs])
  const boardClashes = useMemo(
    () => confirmedClashes(allClashes).filter(c => !dismissed.has(clashKey(c))),
    [allClashes, dismissed],
  )

  // One toolbar chip per installer with an active confirmed clash.
  const clashChips = useMemo(() => {
    const byInstaller = new Map<string, { name: string; count: number; hard: boolean }>()
    for (const c of boardClashes) {
      const entry = byInstaller.get(c.installerId) ?? { name: c.installerName, count: 0, hard: false }
      entry.count += 1
      entry.hard ||= c.severity === 'hard'
      byInstaller.set(c.installerId, entry)
    }
    return [...byInstaller.values()]
  }, [boardClashes])

  const panelJob = panelJobId ? jobs.find(j => j.id === panelJobId) ?? null : null
  const cfg = RANGES[range]
  const today = toISO(new Date())

  return (
    <div className="min-h-screen bg-bg">
      <CompanyBar lang={lang} />

      {/* Toolbar */}
      <div className="bg-paper border-b border-line px-4 pt-3 pb-2 flex flex-col gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="font-display text-[15px] font-semibold text-ink mr-1">
            {t(lang, 'fcfsTitle')}
          </h1>
          <button
            onClick={() => setDate(d => shiftDate(d, -1))}
            className="flex items-center gap-0.5 px-2 py-1 rounded-md bg-bg border border-line text-xs text-ink2"
          >
            <ChevronLeft size={12} />
          </button>
          <span className="text-[13px] font-semibold text-ink">{fmtDayLabel(date)}</span>
          <button
            onClick={() => setDate(d => shiftDate(d, 1))}
            className="flex items-center gap-0.5 px-2 py-1 rounded-md bg-bg border border-line text-xs text-ink2"
          >
            <ChevronRight size={12} />
          </button>
          <button
            onClick={() => setDate(today)}
            disabled={date === today}
            className="px-2 py-1 rounded-md bg-paper border border-line text-xs text-ink2 disabled:opacity-40"
          >
            {t(lang, 'fcfsToday')}
          </button>

          {clashChips.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto min-w-0 flex-1">
              {clashChips.map(chip => (
                <button
                  key={chip.name}
                  onClick={() => setDrawerOpen(true)}
                  className={cn(
                    'flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-semibold shrink-0 whitespace-nowrap',
                    chip.hard
                      ? 'bg-bad-soft border-bad/40 text-bad'
                      : 'bg-brand-amber-soft border-brand-amber/40 text-brand-amber',
                  )}
                >
                  <AlertTriangle size={12} />
                  {chip.name} — {chip.count} {t(lang, chip.count > 1 ? 'fcfsClashes' : 'fcfsClash')}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center">
          <div className="flex rounded-lg border border-line bg-bg overflow-hidden">
            {(Object.keys(RANGES) as TimeRange[]).map(r => (
              <button
                key={r}
                onClick={() => pickRange(r)}
                className={cn(
                  'px-2.5 py-1 text-[11px] font-semibold border-r border-line last:border-r-0 whitespace-nowrap',
                  r === range ? 'bg-brand-blue text-white' : 'text-muted',
                )}
              >
                {RANGES[r].label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Board */}
      <main className="pb-24">
        {loading ? (
          <p className="text-center text-sm text-muted py-12">{t(lang, 'loading')}</p>
        ) : jobs.length === 0 ? (
          <p className="text-center text-sm text-muted py-12">{t(lang, 'fcfsNoJobs')}</p>
        ) : (
          <FCFSTimeline
            jobs={jobs}
            clashes={boardClashes}
            startH={cfg.startH}
            endH={cfg.endH}
            lang={lang}
            onJobClick={job => setPanelJobId(job.id)}
          />
        )}

        {/* Legend */}
        <div className="flex items-center gap-4 flex-wrap px-4 py-2 border-t border-line mt-2">
          {([
            ['bg-punct-flex',                                        'flexibleWindow'],
            ['bg-punct-strict',                                      'strictOnTime'],
            ['bg-bad',                                               'fcfsLegendHard'],
            ['bg-punct-flex border-2 border-dashed border-brand-amber', 'fcfsLegendSoft'],
            ['bg-brand-amber opacity-90',                            'fcfsLegendSuggestion'],
          ] as const).map(([swatch, key]) => (
            <span key={key} className="flex items-center gap-1.5 text-[11px] text-ink2">
              <span className={cn('inline-block w-6 h-3.5 rounded-[3px]', swatch)} />
              {t(lang, key)}
            </span>
          ))}
        </div>
      </main>

      <AssignmentPanel
        job={panelJob}
        clashes={allClashes}
        installers={installers}
        role={role}
        lang={lang}
        onClose={() => setPanelJobId(null)}
        onSaved={() => refetch(dateRef.current, false)}
      />

      <ClashDrawer
        isOpen={drawerOpen}
        clashes={boardClashes}
        lang={lang}
        onClose={() => setDrawerOpen(false)}
        onOpenJob={jobId => { setDrawerOpen(false); setPanelJobId(jobId) }}
        onDismiss={c => setDismissed(prev => new Set([...prev, clashKey(c)]))}
      />

      <BottomNav role={role} />
    </div>
  )
}
