'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, Plus } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { t as tr } from '@/lib/i18n'
import { CompanyBar } from '@/components/CompanyBar'
import { BottomNav } from '@/components/BottomNav'
import { useToast } from '@/components/Toast'
import { blinkJobCards } from '@/features/schedule/job-jump'
import { resolveStageView, jobListHref, type StageView } from './stage-view'
import type { StageJob } from '@/lib/supabase/queries/jobs'
import type { LangCode } from '@/lib/i18n'
import type { Role } from '@/lib/supabase/types'

/**
 * The Jobs tab (Nic, 2026-10-14): Ongoing and Drafts in one tab with a switch
 * at the top, opening on Ongoing. Plain lists, not the date strip — many jobs
 * here have no date. Ongoing = dated first (soonest first), then "Date to be
 * confirmed" (newest first). Drafts = newest first.
 *
 * The switch lives in the address (?view=drafts) so the back button and the
 * My Jobs panel land on the right list; ?highlight=<jobId> scrolls to a row
 * only if it is off screen and blinks it twice.
 *
 * `drafts` is null for roles that have none (designer, production, hr): they
 * get the Ongoing list with no switch.
 */
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
function dayLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`
}

export function StageListShell({ ongoing, drafts, canCreate, lang, role, navRole }: {
  ongoing:   StageJob[]
  drafts:    StageJob[] | null
  canCreate: boolean
  lang:      LangCode
  role:      Role
  navRole:   Role
}) {
  const router = useRouter()
  const params = useSearchParams()
  const highlight = params.get('highlight')
  const view: StageView = resolveStageView(params.get('view'), drafts !== null)
  const jobs = view === 'drafts' ? (drafts ?? []) : ongoing
  const { error: showError } = useToast()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  // Bulk delete as the old Pending list had it: sales and coordinators on
  // their drafts, schedulers anywhere. Deletes go to the Bin.
  const canBulkDelete = role === 'scheduler' || (view === 'drafts' && (role === 'sales' || role === 'coordinator'))

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? jobs.filter(j => [j.project_title ?? '', j.client, j.location].join(' ').toLowerCase().includes(q)) : jobs
  }, [jobs, query])

  const dated   = view === 'ongoing' ? filtered.filter(j => j.date).sort((a, b) => a.date!.localeCompare(b.date!)) : filtered
  const undated = view === 'ongoing' ? filtered.filter(j => !j.date) : []

  // From the My Jobs panel: scroll only if the row is off screen, then blink
  // it twice — the same as on the schedule (Nic, 2026-10-14).
  useEffect(() => {
    if (!highlight) return
    blinkJobCards(document, highlight)
  }, [highlight, view])

  const switchTo = (next: StageView) => {
    if (next === view) return
    setSelected(new Set())   // a tick on one list must not delete from the other
    router.replace(jobListHref(next))
  }

  async function bulkDelete() {
    setBusy(true)
    try {
      const results = await Promise.all([...selected].map(id =>
        fetch(`/api/jobs/${id}`, { method: 'DELETE' }).then(r => ({ id, ok: r.ok })).catch(() => ({ id, ok: false }))))
      const failed = results.filter(r => !r.ok).map(r => r.id)
      setSelected(new Set(failed))
      if (failed.length) showError(tr(lang, 'bulkDeleteFailed').replace('{n}', String(failed.length)))
      router.refresh()
    } finally { setBusy(false) }
  }

  const toggle = (id: string) => setSelected(s => {
    const n = new Set(s)
    if (n.has(id)) n.delete(id); else n.add(id)
    return n
  })

  const row = (j: StageJob) => (
    <li key={j.id} id={`stage-row-${j.id}`} data-job-card={j.id}
      className="scroll-mt-20 scroll-mb-24 flex items-center gap-3 rounded-[14px] border border-line bg-paper px-4 py-3">
      {canBulkDelete && (
        <input type="checkbox" checked={selected.has(j.id)} aria-label="Select" onChange={() => toggle(j.id)} />
      )}
      <Link href={`/jobs/${j.id}`} className="flex-1 min-w-0">
        <p className="font-display text-sm font-semibold text-ink truncate">{j.project_title || j.client || 'Untitled job'}</p>
        <p className="text-xs text-muted truncate">{j.client}</p>
        {view === 'ongoing' && j.designerNames.length > 0 && (
          <p className="text-[11px] text-ink2 truncate">{tr(lang, 'stageDesigner')}: {j.designerNames.join(', ')}</p>
        )}
      </Link>
      <span className="shrink-0 text-xs text-ink2">{j.date ? dayLabel(j.date) : tr(lang, 'dateTbc')}</span>
    </li>
  )

  const tabBtn = (v: StageView, label: string, count: number) => (
    <button type="button" onClick={() => switchTo(v)} aria-pressed={view === v}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
        view === v ? 'bg-ink text-paper' : 'text-ink2 hover:bg-bg',
      )}>
      {label}
      <span className={cn('rounded-full px-1.5 text-[10px]', view === v ? 'bg-paper text-ink' : 'bg-bg')}>{count}</span>
    </button>
  )

  return (
    <div className="min-h-screen bg-bg pb-24">
      <CompanyBar lang={lang} role={role} navRole={navRole} />
      <div className="mx-auto max-w-3xl px-4 pt-4 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-xl text-ink">{tr(lang, 'jobsTabTitle')}</h1>
            <p className="text-xs text-muted">{tr(lang, view === 'drafts' ? 'draftsSubtitle' : 'ongoingSubtitle')}</p>
          </div>
          {canCreate && (
            <Link href="/jobs/new"
              className="inline-flex items-center gap-1 px-3 py-[11px] text-xs rounded-lg font-semibold tracking-wide bg-terracotta text-white hover:brightness-90 active:brightness-75 transition-colors shrink-0">
              <Plus size={12} />
              New
            </Link>
          )}
        </div>
        {drafts !== null && (
          <div className="inline-flex gap-1 rounded-[10px] border border-line bg-paper p-1">
            {tabBtn('ongoing', tr(lang, 'stageOngoing'), ongoing.length)}
            {tabBtn('drafts', tr(lang, 'stageDrafts'), drafts.length)}
          </div>
        )}
        <label className="flex items-center gap-2 rounded-[10px] border border-line bg-paper px-3 py-2">
          <Search size={14} className="text-muted" />
          <input value={query} onChange={e => setQuery(e.target.value)}
            className="flex-1 min-w-0 bg-transparent text-sm outline-none" placeholder={tr(lang, 'stageSearch')} />
        </label>
        {canBulkDelete && selected.size > 0 && (
          <button onClick={bulkDelete} disabled={busy}
            className="px-3 py-1.5 text-xs font-medium text-white rounded-lg bg-bad disabled:opacity-50">
            Delete {selected.size}
          </button>
        )}
        {filtered.length === 0 && <p className="text-sm text-muted py-8 text-center">{tr(lang, 'stageListEmpty')}</p>}
        <ul className="space-y-2">{dated.map(row)}</ul>
        {undated.length > 0 && (
          <>
            <h2 className="pt-2 text-[11px] uppercase tracking-widest text-muted">{tr(lang, 'dateTbcHeading')}</h2>
            <ul className="space-y-2">{undated.map(row)}</ul>
          </>
        )}
      </div>
      {/* Nav drawer (CompanyBar) replaces this below lg — same as ScheduleShell */}
      <div className="hidden lg:block"><BottomNav role={navRole} /></div>
    </div>
  )
}
