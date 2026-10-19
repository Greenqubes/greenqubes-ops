'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { t, type LangCode } from '@/lib/i18n'
import { myJobs, type MyJobsMode } from '@/lib/utils/my-jobs'
import { scheduleJumpHref } from './job-jump'
import { desktopPanelBox, measuredEdge } from './my-jobs-panel-box'
import { jobListHref } from '@/features/stages/stage-view'
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
// Scheduler / admin: which of the two lists they last looked at, per device.
const TAB_KEY = 'gq-my-jobs-tab'
type SchedTab = 'mine' | 'unscheduled'
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
function label(iso: string | null, tbc: string): string {
  if (!iso) return tbc
  const d = new Date(`${iso}T00:00:00`)
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`
}

type Group = 'draft' | 'ongoing' | 'scheduled'

export function MyJobsPanel({ jobs, userId, lang, mode = 'mine', onPickJob, onOpenChange }: {
  jobs:          StageJob[]
  userId:        string
  lang:          LangCode
  /** Jump the schedule to this job's date, then scroll to and blink it. */
  /** 'mine' (sales, coordinator, scheduler, admin) or 'designer' — the jobs
   *  assigned to them (Nic, 2026-10-19). */
  mode?:         MyJobsMode
  /** On the Schedule page: jump in place. Elsewhere (the Jobs tab) leave it
   *  out and a Scheduled job opens the Schedule page on its date instead. */
  onPickJob?:    (iso: string, jobId: string) => void
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
      // A bar that is display:none (the bottom menu below laptop width) has no
      // layout box and must not count as sitting at the top (review #2).
      const edge = (sel: string, side: 'top' | 'bottom') => {
        const el = document.querySelector(sel)
        if (!el) return null
        return measuredEdge({ hasLayoutBox: el.getClientRects().length > 0, edge: el.getBoundingClientRect()[side] })
      }
      setBox(desktopPanelBox({
        topBarBottom:   edge('[data-layout="top-bar"]', 'bottom'),
        navTop:         edge('[data-layout="bottom-nav"]', 'top'),
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
  }, [])

  // Follow the window across laptop width (snapping a PC window to half the
  // screen) instead of deciding once at load (review #2, 2026-10-19).
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const onChange = () => setIsDesktop(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // The page makes room for the panel only while it is open on a PC.
  useEffect(() => { onOpenChange?.(open && isDesktop) }, [open, isDesktop, onOpenChange])

  const toggle = (next: boolean) => {
    setOpen(next)
    if (isDesktop) { try { localStorage.setItem(KEY, next ? 'open' : 'closed') } catch { /* ignore */ } }
  }

  // Schedulers (and admin) arrange everyone's work AND enter jobs themselves
  // (Nic, 2026-10-19): two lists — Mine (the same as sales) and Not scheduled
  // (their own drafts + every Ongoing job in the company). The company's
  // scheduled jobs are left out on purpose: they would flood the panel. The
  // last list used is remembered on this device.
  const isScheduler = mode === 'scheduler'
  const [schedTab, setSchedTab] = useState<SchedTab>('unscheduled')
  useEffect(() => {
    if (!isScheduler) return
    let saved: string | null = null
    try { saved = localStorage.getItem(TAB_KEY) } catch { /* private window */ }
    if (saved === 'mine' || saved === 'unscheduled') setSchedTab(saved)
  }, [isScheduler])
  const chooseTab = (tab: SchedTab) => {
    setSchedTab(tab)
    try { localStorage.setItem(TAB_KEY, tab) } catch { /* ignore */ }
  }
  const mineGroups  = useMemo(() => myJobs(jobs, userId, isScheduler ? 'mine' : mode), [jobs, userId, mode, isScheduler])
  const officeGroups = useMemo(() => isScheduler ? myJobs(jobs, userId, 'scheduler') : null, [jobs, userId, isScheduler])
  const groups = !isScheduler || schedTab === 'mine' || !officeGroups ? mineGroups : officeGroups
  const total = groups.draft.length + groups.ongoing.length + groups.scheduled.length
  const count = (g: typeof groups) => g.draft.length + g.ongoing.length + g.scheduled.length

  const pick = (j: StageJob, group: Group) => {
    // On a phone the panel covers the page — get it out of the way first.
    if (!isDesktop) toggle(false)
    if (group === 'scheduled' && j.date) {
      if (onPickJob) onPickJob(j.date, j.id)
      else router.push(scheduleJumpHref(j.date, j.id))
      return
    }
    router.push(jobListHref(group === 'draft' ? 'drafts' : 'ongoing', j.id))
  }

  const section = (title: string, list: StageJob[], group: Group) =>
    list.length === 0 ? null : (
      <div key={group}>
        {/* Larger, bold, with the count in its own badge (Nic, 2026-10-14). */}
        <h3 className="flex items-center gap-2 px-3 pt-4 pb-1.5 text-[13px] font-bold uppercase tracking-wide text-ink">
          {title}
          <span className="rounded-full border border-line bg-bg px-2 py-[1px] text-[11px] font-semibold text-ink2">{list.length}</span>
        </h3>
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
          'fixed top-1/2 -translate-y-1/2 z-[61] lg:z-[26] rounded-l-lg border border-r-0 border-line bg-paper px-1 py-3 text-ink2 shadow',
          open ? 'right-72' : 'right-0',
        )}>
        {open ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
      {/* Phone: full height over everything (overlay rule: above the bottom
          nav). PC: between the top bar and the bottom menu, measured above,
          so the bell, profile and every tab stay where they are — and on
          layer 25, UNDER the top bar (z-30), so the profile menu that drops
          out of the bar draws over the panel (Nic, 2026-10-14). Nothing on
          a PC needs it higher: it no longer overlaps the bottom menu. */}
      {open && (
        <aside
          style={isDesktop && box ? { top: box.top, bottom: box.bottom, height: 'auto' } : undefined}
          className="fixed right-0 top-0 z-[60] lg:z-[25] h-dvh w-72 max-w-[85vw] bg-paper border-l border-line overflow-y-auto shadow-xl lg:shadow-none">
          <div className="flex items-center justify-between px-3 py-3 border-b border-line">
            <h2 className="font-display text-sm font-semibold text-ink">{t(lang, 'myJobsTitle')}</h2>
            <button type="button" onClick={() => toggle(false)} aria-label={t(lang, 'myJobsHide')} className="p-1 text-muted">
              <X size={14} />
            </button>
          </div>
          {isScheduler && officeGroups && (
            <div className="flex gap-1 px-3 pt-3">
              {([
                ['mine',        t(lang, 'myJobsTabMine'),        count(mineGroups)],
                ['unscheduled', t(lang, 'myJobsTabUnscheduled'), count(officeGroups)],
              ] as const).map(([tab, label, n]) => (
                <button key={tab} type="button" onClick={() => chooseTab(tab)} aria-pressed={schedTab === tab}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1 rounded-lg px-1.5 py-1.5 text-[11px] font-semibold transition-colors',
                    schedTab === tab ? 'bg-ink text-paper' : 'border border-line text-ink2 hover:bg-bg',
                  )}>
                  {label}
                  <span className={cn('rounded-full px-1.5 text-[10px]', schedTab === tab ? 'bg-paper text-ink' : 'bg-bg')}>{n}</span>
                </button>
              ))}
            </div>
          )}
          {total === 0 && <p className="px-3 py-6 text-sm text-muted">{t(lang, 'myJobsEmpty')}</p>}
          {section(t(lang, 'stageDrafts'), groups.draft, 'draft')}
          {section(t(lang, 'stageOngoing'), groups.ongoing, 'ongoing')}
          {section(t(lang, 'stageScheduled'), groups.scheduled, 'scheduled')}
        </aside>
      )}
    </>
  )
}
