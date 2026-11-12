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
import { resolveStageView, jobListHref, defaultStageView, type StageView } from './stage-view'
import { ArrangeList } from './ArrangeList'
import { MyJobsPanel } from '@/features/schedule/MyJobsPanel'
import { arrangeSeen } from '@/lib/utils/arrange-rules'
import { bulkActionsFor, bulkFailReason, splitBulk, keepOnList, BULK_REASON_KEY, type BulkFailReason, type BulkOutcome } from '@/lib/utils/bulk-move'
import type { MyJobsMode } from '@/lib/utils/my-jobs'
import type { StageJob } from '@/lib/supabase/queries/jobs'
import type { JobGroup } from '@/lib/utils/job-groups'
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
 * `drafts` is null for roles that have none (designer, production, hr): their
 * switch is Ongoing · To arrange.
 *
 * To arrange (Nic, 2026-11-04): a third list of Ongoing jobs sales has marked
 * ready, after Drafts and Ongoing — the order follows a job's life. Those jobs
 * leave the Ongoing list, so a job is only ever in one place. A bare
 * /job-list opens on the role's default (defaultStageView).
 */
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
function dayLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`
}

export function StageListShell({ ongoing, drafts, arrange, groups, canCreate, panelJobs, panelMode, userId, isAdmin, lang, role, navRole }: {
  ongoing:   StageJob[]
  drafts:    StageJob[] | null
  /** Ongoing jobs in To arrange (arrange_state set). */
  arrange:   StageJob[]
  /** Job groups (0072) holding a job on this tab. */
  groups:    JobGroup[]
  canCreate: boolean
  /** The REAL admin role — `role` reads 'scheduler' for a plain admin. */
  isAdmin:   boolean
  /** My Jobs panel (Nic, 2026-10-19): null = no panel for this role. */
  panelJobs: StageJob[] | null
  panelMode: MyJobsMode
  userId:    string
  lang:      LangCode
  role:      Role
  navRole:   Role
}) {
  const router = useRouter()
  const params = useSearchParams()
  const highlight = params.get('highlight')
  const view: StageView = resolveStageView(params.get('view'), drafts !== null, defaultStageView(role))
  const jobs = view === 'drafts' ? (drafts ?? []) : view === 'arrange' ? arrange : ongoing
  const { error: showError, success: showSuccess } = useToast()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // Why a ticked job could not move in the last bulk move (Nic, 2026-11-11).
  const [reasons, setReasons] = useState<Map<string, BulkFailReason>>(new Map())
  const [busy, setBusy] = useState(false)
  // On a PC the open My Jobs panel takes the right edge; the list makes room.
  const [panelOpen, setPanelOpen] = useState(false)
  // "Ready 3 days" needs today's Singapore date — read after mount, so the
  // first render matches the server's.
  const [todayISO, setTodayISO] = useState<string | null>(null)
  useEffect(() => { setTodayISO(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' })) }, [])

  // Bulk delete as the old Pending list had it: sales and coordinators on
  // their drafts, schedulers anywhere. Deletes go to the Bin. Not on To
  // arrange — those cards carry the round trip, not tick boxes.
  const canBulkDelete = view !== 'arrange' && (role === 'scheduler' || (view === 'drafts' && (role === 'sales' || role === 'coordinator')))
  // Moving several jobs back one stage (Nic, 2026-11-11): Back to Ongoing on
  // To arrange, Back to Drafts on Ongoing. Each job still passes its own
  // one-at-a-time rules on the server; failures stay ticked with a reason.
  const acts = bulkActionsFor(view, role, isAdmin)
  const canTick = canBulkDelete || acts.toOngoing || acts.toDraft

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

  // A tick on one list must never delete from the other. Cleared on EVERY
  // list change — the switch, the My Jobs panel, the back button — because
  // a search-param change keeps this component's state, and ticks carried
  // over were invisible yet still counted by Delete (review #1, 2026-10-19).
  useEffect(() => { setSelected(new Set()); setReasons(new Map()) }, [view])
  // …and after any refresh, a ticked job that has left this list (moved by
  // someone else, or moved by a bulk move whose answer never arrived) is
  // dropped — never counted out of sight by Delete (final review #1).
  useEffect(() => {
    const kept = keepOnList(selected, reasons, jobs.map(j => j.id))
    if (kept.changed) { setSelected(kept.selected); setReasons(kept.reasons) }
  }, [jobs])  // eslint-disable-line react-hooks/exhaustive-deps

  const switchTo = (next: StageView) => {
    if (next === view) return
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

  const toggle = (id: string) => {
    if (selected.has(id)) setReasons(r => { if (!r.has(id)) return r; const n = new Map(r); n.delete(id); return n })
    setSelected(s => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }

  // What a bulk move does with its results: moved jobs leave the list on the
  // refresh, the rest stay ticked with their reason under them.
  function settle(outcomes: BulkOutcome[], movedKey: 'bulkMovedOngoing' | 'bulkMovedDrafts') {
    const { moved, failed } = splitBulk(outcomes)
    setSelected(new Set(failed.map(f => f.id)))
    setReasons(new Map(failed.map(f => [f.id, f.reason])))
    if (moved.length) showSuccess(tr(lang, movedKey).replace('{n}', String(moved.length)))
    if (failed.length) showError(tr(lang, 'bulkMoveFailed').replace('{n}', String(failed.length)))
    router.refresh()
  }

  async function bulkToOngoing() {
    setBusy(true)
    try {
      const ids = [...selected]
      const byId = new Map(jobs.map(j => [j.id, j]))
      let outcomes: BulkOutcome[]
      try {
        const res = await fetch('/api/arrange/pull-back-bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobs: ids.map(id => {
            const j = byId.get(id)
            return { id, seen: j ? arrangeSeen(j.arrange_state, j.arrangement) : null }
          }) }),
        })
        const data = await res.json().catch(() => null) as { results?: Array<{ id: string; ok: boolean; status: number; error?: string }> } | null
        if (!res.ok || !data?.results) {
          outcomes = ids.map(id => ({ id, ok: false, reason: bulkFailReason(res.status, undefined) }))
        } else {
          const got = new Map(data.results.map(r => [r.id, r]))
          outcomes = ids.map((id): BulkOutcome => {
            const r = got.get(id)
            return r?.ok ? { id, ok: true } : { id, ok: false, reason: r ? bulkFailReason(r.status, r.error) : 'other' }
          })
        }
      } catch {
        outcomes = ids.map(id => ({ id, ok: false, reason: bulkFailReason(0, undefined) }))
      }
      settle(outcomes, 'bulkMovedOngoing')
    } finally { setBusy(false) }
  }

  async function bulkToDraft() {
    setBusy(true)
    try {
      const outcomes = await Promise.all([...selected].map(async (id): Promise<BulkOutcome> => {
        try {
          const res = await fetch(`/api/jobs/${id}/stage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to: 'draft' }),
          })
          if (res.ok) return { id, ok: true }
          const data = await res.json().catch(() => null) as { error?: string } | null
          return { id, ok: false, reason: bulkFailReason(res.status, data?.error) }
        } catch {
          return { id, ok: false, reason: bulkFailReason(0, undefined) }
        }
      }))
      settle(outcomes, 'bulkMovedDrafts')
    } finally { setBusy(false) }
  }

  const row = (j: StageJob) => (
    <li key={j.id} id={`stage-row-${j.id}`} data-job-card={j.id}
      className="scroll-mt-20 scroll-mb-24 flex items-center gap-3 rounded-[14px] border border-line bg-paper px-4 py-3">
      {canTick && (
        <input type="checkbox" checked={selected.has(j.id)} aria-label="Select" onChange={() => toggle(j.id)} />
      )}
      <Link href={`/jobs/${j.id}`} className="flex-1 min-w-0">
        <p className="font-display text-sm font-semibold text-ink truncate">{j.project_title || j.client || 'Untitled job'}</p>
        <p className="text-xs text-muted truncate">{j.client}</p>
        {view === 'ongoing' && j.designerNames.length > 0 && (
          <p className="text-[11px] text-ink2 truncate">{tr(lang, 'stageDesigner')}: {j.designerNames.join(', ')}</p>
        )}
        {reasons.has(j.id) && <p className="text-[11px] text-bad">{tr(lang, BULK_REASON_KEY[reasons.get(j.id)!])}</p>}
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
      <div className={cn(panelOpen && 'lg:pr-72')}>
      <div className="mx-auto max-w-3xl px-4 pt-4 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-xl text-ink">{tr(lang, 'jobsTabTitle')}</h1>
            <p className="text-xs text-muted">{tr(lang, view === 'drafts' ? 'draftsSubtitle' : view === 'arrange' ? 'arrangeSubtitle' : 'ongoingSubtitle')}</p>
          </div>
          {canCreate && (
            <Link href="/jobs/new"
              className="inline-flex items-center gap-1 px-3 py-[11px] text-xs rounded-lg font-semibold tracking-wide bg-terracotta text-white hover:brightness-90 active:brightness-75 transition-colors shrink-0">
              <Plus size={12} />
              New
            </Link>
          )}
        </div>
        {/* Drafts · Ongoing · To arrange — a job's life, left to right (Nic). */}
        <div className="inline-flex gap-1 rounded-[10px] border border-line bg-paper p-1">
          {drafts !== null && tabBtn('drafts', tr(lang, 'stageDrafts'), drafts.length)}
          {tabBtn('ongoing', tr(lang, 'stageOngoing'), ongoing.length)}
          {tabBtn('arrange', tr(lang, 'stageArrange'), arrange.length)}
        </div>
        <label className="flex items-center gap-2 rounded-[10px] border border-line bg-paper px-3 py-2">
          <Search size={14} className="text-muted" />
          <input value={query} onChange={e => setQuery(e.target.value)}
            className="flex-1 min-w-0 bg-transparent text-sm outline-none" placeholder={tr(lang, 'stageSearch')} />
        </label>
        {canTick && selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-[12px] bg-ink px-3 py-2 text-paper">
            <span className="flex-1 min-w-[80px] text-xs font-semibold">{tr(lang, 'bulkSelected').replace('{n}', String(selected.size))}</span>
            {acts.toOngoing && (
              <button type="button" onClick={bulkToOngoing} disabled={busy}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-paper text-ink disabled:opacity-50">
                {tr(lang, 'bulkBackToOngoing')}
              </button>
            )}
            {acts.toDraft && (
              <button type="button" onClick={bulkToDraft} disabled={busy}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-paper text-ink disabled:opacity-50">
                {tr(lang, 'bulkBackToDrafts')}
              </button>
            )}
            {canBulkDelete && (
              <button type="button" onClick={bulkDelete} disabled={busy}
                className="px-3 py-1.5 text-xs font-medium text-white rounded-lg bg-bad disabled:opacity-50">
                Delete {selected.size}
              </button>
            )}
          </div>
        )}
        {view === 'arrange' ? (
          <ArrangeList jobs={filtered} viewer={{ id: userId, role, isAdmin }} lang={lang} todayISO={todayISO}
            selectable={acts.toOngoing} selected={selected} onToggle={toggle} reasons={reasons} />
        ) : (
          <>
            {filtered.length === 0 && <p className="text-sm text-muted py-8 text-center">{tr(lang, 'stageListEmpty')}</p>}
            <ul className="space-y-2">{dated.map(row)}</ul>
            {undated.length > 0 && (
              <>
                <h2 className="pt-2 text-[11px] uppercase tracking-widest text-muted">{tr(lang, 'dateTbcHeading')}</h2>
                <ul className="space-y-2">{undated.map(row)}</ul>
              </>
            )}
          </>
        )}
      </div>
      </div>

      {/* Tapping a Draft or Ongoing job switches the list here; a Scheduled
          one opens the Schedule page on its date (no onPickJob). */}
      {panelJobs && (
        <MyJobsPanel jobs={panelJobs} userId={userId} lang={lang} mode={panelMode} onOpenChange={setPanelOpen} />
      )}

      {/* Nav drawer (CompanyBar) replaces this below lg — same as ScheduleShell */}
      <div className="hidden lg:block"><BottomNav role={navRole} /></div>
    </div>
  )
}
