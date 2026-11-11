'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils/cn'
import { t as tr, type LangCode } from '@/lib/i18n'
import { groupArrangeJobs, arrangeCta, arrangeCardHref, isArrangeSalesSide, isArrangeSchedulerSide, type ArrangeCta } from '@/lib/utils/arrange-rules'
import { guideLabel, slotLabel, daysWaiting } from '@/lib/utils/arrange-labels'
import { BULK_REASON_KEY, type BulkFailReason } from '@/lib/utils/bulk-move'
import type { StageJob } from '@/lib/supabase/queries/jobs'
import type { StageViewer } from '@/lib/utils/job-stage-rules'

/**
 * The To arrange list (Nic's pick A, 2026-11-03; spec 2026-11-04): every
 * Ongoing job sales has marked ready, split by whose turn it is. "Needs a
 * date" — the scheduler's turn — on top; "Waiting on sales" below and quieter.
 * Each card opens the job, where the buttons are.
 *
 * `selectable` (bulk Back to Ongoing, Nic 2026-11-11) adds a tick box to the
 * left of each card; a job that could not move shows its reason underneath.
 * Without it the cards render exactly as before.
 */
export function ArrangeList({ jobs, viewer, lang, todayISO, selectable = false, selected, onToggle, reasons }: {
  jobs:     StageJob[]
  viewer:   StageViewer
  lang:     LangCode
  /** Singapore date, read after mount by the shell — never during render. */
  todayISO: string | null
  selectable?: boolean
  selected?:   Set<string>
  onToggle?:   (id: string) => void
  reasons?:    Map<string, BulkFailReason>
}) {
  const { needsDate, withSales } = groupArrangeJobs(jobs)
  const schedulerSide = isArrangeSchedulerSide(viewer)

  const chip = (j: StageJob) => {
    const a = j.arrangement
    switch (j.arrange_state) {
      case 'clash':
        return { text: tr(lang, 'arrangeChipClash'), cls: 'bg-bad-soft text-bad' }
      case 'needs_date':
        return a?.lastReturn?.kind === 'client_no'
          ? { text: tr(lang, 'arrangeChipClientNo'), cls: 'bg-bad-soft text-bad' }
          : { text: tr(lang, 'arrangeGroupNeedsDate'), cls: 'bg-brand-amber-soft text-brand-amber' }
      case 'offered':
        return { text: tr(lang, 'arrangeChipOffered'), cls: 'bg-brand-blue-soft text-brand-blue' }
      case 'no_fit':
        return { text: tr(lang, 'arrangeChipNoFit'), cls: 'bg-brand-amber-soft text-brand-amber' }
      default:
        return null
    }
  }

  // The word on the right when this person can act on the card. Change date
  // (Nic, 2026-11-06) also changes where the card goes: straight to the
  // take-back step on the job page.
  const ctaOf = (j: StageJob): ArrangeCta | null => {
    if (!j.arrange_state) return null
    const rulesJob = { status: j.status, created_by: j.created_by, sales_poc_id: j.sales_poc_id, coordinatorIds: j.coordinatorIds }
    return arrangeCta(j.arrange_state, isArrangeSalesSide(viewer, rulesJob), schedulerSide)
  }
  const CTA_KEY = { offer: 'arrangeOfferCta', answer: 'arrangeAnswerCta', change: 'arrangeChangeCta' } as const

  const card = (j: StageJob, quiet: boolean) => {
    const a = j.arrangement
    const c = chip(j)
    const ctaKind = ctaOf(j)
    const action = ctaKind ? tr(lang, CTA_KEY[ctaKind]) : null
    const waited = a && todayISO ? daysWaiting(a.readyAt, todayISO) : null
    const reason = a?.lastReturn && (j.arrange_state === 'needs_date' || j.arrange_state === 'no_fit' || j.arrange_state === 'clash')
      ? a.lastReturn.text : null
    const why = reasons?.get(j.id)
    return (
      <li key={j.id} id={`stage-row-${j.id}`} data-job-card={j.id}
        className={cn('scroll-mt-20 scroll-mb-24 rounded-[14px] border border-line bg-paper', quiet && 'opacity-70', selectable && 'flex items-start gap-3 pl-4')}>
        {selectable && (
          <input type="checkbox" className="mt-4 shrink-0" checked={selected?.has(j.id) ?? false} aria-label="Select"
            onChange={() => onToggle?.(j.id)} />
        )}
        <div className={cn(selectable && 'flex-1 min-w-0')}>
        <Link href={arrangeCardHref(j.id, ctaKind)} className={cn('block py-3 space-y-1.5', selectable ? 'pr-4' : 'px-4')}>
          <div className="flex items-start justify-between gap-2">
            <p className="font-display text-sm font-semibold text-ink min-w-0 truncate">{j.project_title || j.client || 'Untitled job'}</p>
            {c && <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold', c.cls)}>{c.text}</span>}
          </div>
          <p className="text-xs text-muted truncate">
            {j.client}
            {j.salesName && <> · {tr(lang, 'arrangeSales')}: {j.salesName}</>}
            {waited !== null && <> · {waited === 0 ? tr(lang, 'arrangeReadyToday') : tr(lang, 'arrangeReadyDays').replace('{n}', String(waited))}</>}
          </p>
          {a && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-md bg-bg px-2 py-0.5 text-[11px] text-ink2">{guideLabel(a)}</span>
              {j.arrange_state === 'offered' && a.offer && (
                <span className="rounded-md bg-brand-blue-soft px-2 py-0.5 text-[11px] text-ink">
                  {tr(lang, 'arrangeOfferLabel')}: {slotLabel(a.offer)}
                  {a.offer.crewNames.length > 0 && <> · {a.offer.crewNames.join(', ')}</>}
                </span>
              )}
            </div>
          )}
          {(reason || action) && (
            <div className="flex items-end justify-between gap-2">
              <p className="text-[11px] text-ink2 min-w-0 line-clamp-2">{reason ? `“${reason}”` : ''}</p>
              {action && <span className="shrink-0 text-xs font-semibold text-terracotta">{action}</span>}
            </div>
          )}
        </Link>
        {why && <p className={cn('pb-3 text-[11px] text-bad', selectable ? 'pr-4' : 'px-4')}>{tr(lang, BULK_REASON_KEY[why])}</p>}
        </div>
      </li>
    )
  }

  if (jobs.length === 0) return <p className="text-sm text-muted py-8 text-center">{tr(lang, 'stageListEmpty')}</p>
  return (
    <div className="space-y-2">
      {needsDate.length > 0 && (
        <>
          <h2 className="text-[11px] uppercase tracking-widest text-muted">{tr(lang, 'arrangeGroupNeedsDate')} · {needsDate.length}</h2>
          <ul className="space-y-2">{needsDate.map(j => card(j, false))}</ul>
        </>
      )}
      {withSales.length > 0 && (
        <>
          <h2 className="pt-2 text-[11px] uppercase tracking-widest text-muted">{tr(lang, 'arrangeGroupWithSales')} · {withSales.length}</h2>
          <ul className="space-y-2">{withSales.map(j => card(j, true))}</ul>
        </>
      )}
    </div>
  )
}
