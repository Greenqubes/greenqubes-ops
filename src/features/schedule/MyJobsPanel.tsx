'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { t, type LangCode } from '@/lib/i18n'
import { myJobs } from '@/lib/utils/my-jobs'
import { desktopPanelBox } from './my-jobs-panel-box'
import type { StageJob } from '@/lib/supabase/queries/jobs'

/**
 * My Jobs quick links (Nic's screenshot, 2026-10-08). Tapping a row never
 * opens the job: a scheduled one moves the schedule to its date, a draft or
 * pending one opens that tab with the row highlighted.
 *
 * Open/closed is a per-device setting (localStorage), read AFTER mount —
 * /schedule is hydration-sensitive (#418), so the first render must match the
 * server's: closed on the server, then restored.
 */
const KEY = 'gq-my-jobs-open'
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
function label(iso: string | null, tbc: string): string {
  if (!iso) return tbc
  const d = new Date(`${iso}T00:00:00`)
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`
}

type Group = 'draft' | 'pending' | 'scheduled'

export function MyJobsPanel({ jobs, userId, lang, onPickDate, onOpenChange }: {
  jobs:          StageJob[]
  userId:        string
  lang:          LangCode
  onPickDate:    (iso: string) => void
  /** Lets the schedule leave room for the panel on a PC. */
  onOpenChange?: (open: boolean) => void
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)          // server render: closed
  const [isDesktop, setIsDesktop] = useState(false)
  // PC only: the panel fits between the top bar and the bottom menu, both
  // measured from the page so neither is covered (Nic, 2026-10-14).
  const [box, setBox] = useState<{ top: number; bottom: number } | null>(null)

  useEffect(() => {
    if (!open || !isDesktop) return
    const measure = () => {
      const bar = document.querySelector('[data-layout="top-bar"]')
      const nav = document.querySelector('[data-layout="bottom-nav"]')
      setBox(desktopPanelBox({
        topBarBottom:   bar ? bar.getBoundingClientRect().bottom : null,
        navTop:         nav ? nav.getBoundingClientRect().top : null,
        viewportHeight: window.innerHeight,
      }))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [open, isDesktop])

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)').matches
    setIsDesktop(desktop)
    let saved: string | null = null
    try { saved = localStorage.getItem(KEY) } catch { /* private window */ }
    // Phone: hidden by default (spec). PC: remembered, open the first time.
    const initial = desktop ? saved !== 'closed' : false
    setOpen(initial)
    onOpenChange?.(initial && desktop)
  }, [onOpenChange])

  const toggle = (next: boolean) => {
    setOpen(next)
    onOpenChange?.(next && isDesktop)
    if (isDesktop) { try { localStorage.setItem(KEY, next ? 'open' : 'closed') } catch { /* ignore */ } }
  }

  const groups = useMemo(() => myJobs(jobs, userId), [jobs, userId])
  const total = groups.draft.length + groups.pending.length + groups.scheduled.length

  const pick = (j: StageJob, group: Group) => {
    if (group === 'scheduled' && j.date) {
      onPickDate(j.date)
      if (!isDesktop) toggle(false)
      return
    }
    router.push(`/${group === 'draft' ? 'drafts' : 'pending'}?highlight=${j.id}`)
  }

  const section = (title: string, list: StageJob[], group: Group) =>
    list.length === 0 ? null : (
      <div key={group}>
        <h3 className="px-3 pt-3 pb-1 text-[10px] uppercase tracking-widest text-muted">{title} · {list.length}</h3>
        <ul>
          {list.map(j => (
            <li key={`${group}-${j.id}`}>
              <button type="button" onClick={() => pick(j, group)}
                className="w-full text-left px-3 py-2 hover:bg-bg rounded-lg">
                <span className="block text-[11px] text-ink2">{label(j.date, t(lang, 'dateTbc'))}</span>
                <span className="block text-sm font-medium text-ink truncate">{j.project_title || j.client || 'Untitled job'}</span>
                <span className="block text-xs text-muted truncate">{j.client}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    )

  return (
    <>
      {/* The arrow tab, on the right edge, above the bottom nav. */}
      <button type="button" onClick={() => toggle(!open)}
        aria-label={t(lang, open ? 'myJobsHide' : 'myJobsShow')}
        className={cn(
          'fixed top-1/2 -translate-y-1/2 z-[61] rounded-l-lg border border-r-0 border-line bg-paper px-1 py-3 text-ink2 shadow',
          open ? 'right-72' : 'right-0',
        )}>
        {open ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
      {/* Phone: full height over everything (overlay rule: above the bottom
          nav). PC: between the top bar and the bottom menu, measured above,
          so the bell, profile and every tab stay where they are. */}
      {open && (
        <aside
          style={isDesktop && box ? { top: box.top, bottom: box.bottom, height: 'auto' } : undefined}
          className="fixed right-0 top-0 z-[60] h-dvh w-72 max-w-[85vw] bg-paper border-l border-line overflow-y-auto shadow-xl lg:shadow-none">
          <div className="flex items-center justify-between px-3 py-3 border-b border-line">
            <h2 className="font-display text-sm font-semibold text-ink">{t(lang, 'myJobsTitle')}</h2>
            <button type="button" onClick={() => toggle(false)} aria-label={t(lang, 'myJobsHide')} className="p-1 text-muted">
              <X size={14} />
            </button>
          </div>
          {total === 0 && <p className="px-3 py-6 text-sm text-muted">{t(lang, 'myJobsEmpty')}</p>}
          {section(t(lang, 'stageDrafts'), groups.draft, 'draft')}
          {section(t(lang, 'stagePending'), groups.pending, 'pending')}
          {section(t(lang, 'stageScheduled'), groups.scheduled, 'scheduled')}
        </aside>
      )}
    </>
  )
}
