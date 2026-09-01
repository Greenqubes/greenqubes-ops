'use client'

import { useState, useCallback, useRef, useMemo } from 'react'
import { useLiveChannel } from '@/lib/supabase/useLiveChannel'
import { cn } from '@/lib/utils/cn'
import { t } from '@/lib/i18n'
import { CompanyBar } from '@/components/CompanyBar'
import { BottomNav } from '@/components/BottomNav'
import { DesignerBar } from './DesignerBar'
import { MyJobsView } from './MyJobsView'
import {
  computeUrgency, segmentHeightPx, daysBetween, URGENCY_META,
} from '@/lib/utils/design-urgency'
import type { Segment } from './DesignerBar'
import type { DesignLoadData, MyDesignJob } from '@/lib/supabase/queries/design-load'
import type { LangCode } from '@/lib/i18n'
import type { Role } from '@/lib/supabase/types'

// Singapore never changes offset — render "today" in SGT regardless of where
// the server/browser runs. Copied from fcfs/page.tsx; computed inline like
// FCFSShell's own `today` (no useEffect indirection — that pattern already
// ships on /fcfs without the /schedule hydration issue).
function todaySGT(): string {
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000)
  return now.toISOString().slice(0, 10)
}

type Tab = 'board' | 'myJobs'

interface Props {
  initialData: DesignLoadData
  role:        Role
  lang:        LangCode
}

export function DesignLoadShell({ initialData, role, lang }: Props) {
  // Covers real designers and admins previewing as designer — getEffectiveRole
  // already resolves the preview cookie server-side before `role` is passed in.
  const isDesigner = role === 'designer'

  const [tab, setTab] = useState<Tab>('board')
  const tabRef = useRef(tab)
  tabRef.current = tab

  const [data, setData]   = useState<DesignLoadData>(initialData)
  const [myJobs, setMyJobs] = useState<MyDesignJob[] | null>(null)
  const [myJobsLoading, setMyJobsLoading] = useState(false)
  const fetchingMineRef = useRef(false)

  const todayISO = todaySGT()

  const refetch = useCallback(async () => {
    const wantMine = isDesigner && tabRef.current === 'myJobs'
    const res = await fetch(`/api/design-load${wantMine ? '?mine=1' : ''}`)
    if (!res.ok) return
    const json = await res.json() as DesignLoadData & { myJobs?: MyDesignJob[] }
    setData({ designers: json.designers })
    if (json.myJobs) setMyJobs(json.myJobs)
  }, [isDesigner])

  // Live refresh on job / assignment / file changes (a design brief upload
  // can flip design_score confidence) + poll fallback — same shape as FCFS.
  useLiveChannel({
    name:    'design-load',
    tables:  [{ table: 'jobs' }, { table: 'job_designers' }, { table: 'files' }],
    onEvent: () => refetch(),
    poll:    { ms: 120_000, fn: () => refetch() },
  })

  // Lazily load My Jobs the first time the toggle switches to it; the live
  // channel above keeps it fresh afterwards (refetch() reads tabRef).
  const openMyJobs = useCallback(() => {
    setTab('myJobs')
    if (myJobs !== null || fetchingMineRef.current) return
    fetchingMineRef.current = true
    setMyJobsLoading(true)
    fetch('/api/design-load?mine=1')
      .then(res => (res.ok ? res.json() : null))
      .then((json: (DesignLoadData & { myJobs?: MyDesignJob[] }) | null) => {
        if (json?.myJobs) setMyJobs(json.myJobs)
      })
      .finally(() => {
        fetchingMineRef.current = false
        setMyJobsLoading(false)
      })
  }, [myJobs])

  const maxOpenCount = useMemo(
    () => Math.max(0, ...data.designers.map(d => d.jobs.length)),
    [data.designers],
  )

  // Per-designer segment geometry, computed once per data/today change so
  // DesignerBar stays a plain presentational component.
  const segmentsByDesigner = useMemo(() => {
    const map = new Map<string, Segment[]>()
    for (const designer of data.designers) {
      const openCount = designer.jobs.length
      map.set(designer.id, designer.jobs.map(job => {
        const daysToDue = job.dueDate ? daysBetween(todayISO, job.dueDate) : null
        const level = computeUrgency({ complexity: job.complexity, daysToDue, openCount, maxOpenCount })
        return { job, level, height: segmentHeightPx(daysToDue) }
      }))
    }
    return map
  }, [data.designers, todayISO, maxOpenCount])

  return (
    <div className="min-h-screen bg-bg">
      <CompanyBar lang={lang} role={role} />

      <div className="bg-paper border-b border-line px-4 pt-3 pb-2">
        <h1 className="font-display text-[15px] font-semibold text-ink">
          {t(lang, 'designLoadTitle')}
        </h1>

        {isDesigner && (
          <div className="flex gap-1 mt-3">
            {(['board', 'myJobs'] as const).map(tabId => (
              <button
                key={tabId}
                type="button"
                onClick={() => (tabId === 'myJobs' ? openMyJobs() : setTab('board'))}
                className={cn(
                  'flex-1 py-2 text-sm font-medium tracking-wide border-b-2 transition-colors',
                  tab === tabId
                    ? 'border-terracotta text-terracotta'
                    : 'border-transparent text-muted hover:text-ink2',
                )}
              >
                {t(lang, tabId === 'board' ? 'boardTab' : 'myJobsTab')}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* pb-24 was mobile clearance for the fixed BottomNav; that's gone
          below lg now (nav drawer instead — R2-T5 / F1), so mobile only
          needs a modest breathing-room pb. lg: keeps the original value
          since BottomNav still renders there unchanged. */}
      <main className="pb-8 lg:pb-24">
        {isDesigner && tab === 'myJobs' ? (
          <MyJobsView
            jobs={myJobs}
            loading={myJobsLoading}
            todayISO={todayISO}
            lang={lang}
            maxOpenCount={maxOpenCount}
          />
        ) : data.designers.length === 0 ? (
          <p className="text-center text-sm text-muted py-12">{t(lang, 'noDesigners')}</p>
        ) : (
          <>
            {/* Legend — moved above the board now that the board itself is a
                tall, bottom-anchored "skyline" area; a legend pinned below a
                min-height area that's mostly empty air (few/short bars) would
                float disconnected from the header instead of reading as a key
                for what's below it. */}
            <div className="flex items-center gap-3 flex-wrap px-4 py-2.5 border-b border-line">
              {([0, 1, 2, 3, 4, 5] as const).map(level => (
                <span key={level} className="flex items-center gap-1.5 text-[11px] text-ink2">
                  <span className={cn('inline-block w-4 h-3.5 rounded-[3px]', URGENCY_META[level].barClass)} />
                  {t(lang, `urgency${level}`)}
                </span>
              ))}
            </div>

            {/* Board area — stable min-height (viewport minus the sticky
                CompanyBar ~44px, this page's title/tab header ~56-90px, the
                legend ~48px, this row's own py-6/py-4 padding, and — at lg
                and up only — the fixed BottomNav ~64-80px incl. safe-area:
                ~300px of chrome total there, floored at 260px so short
                viewports never collapse the board to nothing) so the bars
                read as a real skyline growing off a stable baseline rather
                than a box that hugs its own content. Below lg the BottomNav
                is gone (nav drawer instead — R2-T5 / F1), so the chrome
                budget drops to ~220px (300 minus BottomNav's own height) —
                without this split the board would sit ~64-80px shorter than
                the actual mobile viewport, leaving unused blank space below
                the skyline instead of the bars anchoring to the true bottom
                edge. Columns are an even flex row (no horizontal scroll —
                squeeze narrower as designers are added) bottom-aligned via
                items-end, which — combined with each DesignerBar column
                ending in its (fixed-height) name label — is what pins every
                column's baseline to the same line while the bars above it
                grow upward by however tall their stacked segments are. */}
            <div className="flex items-end gap-1.5 sm:gap-3 px-2 sm:px-4 pt-6 pb-4 min-h-[max(260px,calc(100vh-220px))] lg:min-h-[max(260px,calc(100vh-300px))]">
              {data.designers.map(designer => (
                <DesignerBar
                  key={designer.id}
                  designer={designer}
                  segments={segmentsByDesigner.get(designer.id) ?? []}
                  lang={lang}
                />
              ))}
            </div>
          </>
        )}
      </main>

      {/* Nav drawer (CompanyBar) replaces this below lg — R2-T5 / F1 */}
      <div className="hidden lg:block">
        <BottomNav role={role} />
      </div>
    </div>
  )
}
