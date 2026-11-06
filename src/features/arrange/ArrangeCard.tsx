'use client'

import { useEffect, useMemo, useState } from 'react'
import { useToast } from '@/components/Toast'
import { cn } from '@/lib/utils/cn'
import { t, type LangCode } from '@/lib/i18n'
import { hhmm, arrangeTurn, arrangeSeen, opensChangeDate, withoutChangeParam, type ArrangeAction, type ArrangeState, type Arrangement, type GuideInput } from '@/lib/utils/arrange-rules'
import { guideLabel, slotLabel } from '@/lib/utils/arrange-labels'
import { ArrangeReadyDialog } from './ArrangeReadyDialog'
import { ArrangeReasonDialog } from './ArrangeReasonDialog'

/**
 * The To arrange card at the top of an Ongoing job's Details tab (spec
 * 2026-11-04). Shows where the round trip is and gives each side its buttons:
 *   sales side      — Ready to install / Edit, Client OK, Client said no, Back to Ongoing
 *   scheduler side  — Offer to sales (composed on this page), Can't fit, Withdraw
 * Everyone else (designer, production, hr) sees the summary only. Every button
 * goes through POST /api/jobs/[id]/arrange, which re-checks all of it.
 */
/** 'change' is a withdraw reached from the list's Change date link (Nic,
 *  2026-11-06): same step, worded for why he is here. */
type Reason = 'client_no' | 'send_back' | 'withdraw' | 'change'

/** The toast for a refused To arrange request — shared with the job page's
 *  offer (JobDetailShell), so every button explains itself the same way. */
export function arrangeErrorText(lang: LangCode, code: string | undefined, action: ArrangeAction): string {
  if (!code) return t(lang, 'saveError')
  if (code === 'state_changed' || code === 'offer_changed' || code === 'invalid_move' || code === 'not_ongoing') return t(lang, 'arrangeErrChanged')
  if (code === 'missing_fields') return t(lang, action === 'ready' ? 'requiredFieldsMissingOngoing' : 'requiredFieldsMissing')
  if (code === 'text_required') return t(lang, 'arrangeErrText')
  if (code === 'not_permitted') return t(lang, 'saveBlocked')
  if (code.startsWith('bad_guide:')) return t(lang, `arrangeErr_${code.slice(10)}` as 'arrangeErr_bad_range')
  if (code.startsWith('bad_offer:')) return t(lang, `arrangeOfferErr_${code.slice(10)}` as 'arrangeOfferErr_in_past')
  return t(lang, 'saveError')
}

export function ArrangeCard({
  jobId, lang, state, arrangement, salesSide, schedulerSide, canStart, savedSlot,
  beforeAction, onOffer, offerBusy, onChanged,
}: {
  jobId:         string
  lang:          LangCode
  state:         ArrangeState | null
  arrangement:   Arrangement | null
  salesSide:     boolean
  schedulerSide: boolean
  /** An Ongoing job not yet in To arrange, and this person may mark it ready. */
  canStart:      boolean
  /** The job's saved date/time — the guide starts from it the first time. */
  savedSlot:     { date: string | null; timeStart: string | null; timeEnd: string | null }
  /** Unsaved edits block a move (the server reads the saved job). */
  beforeAction:  () => Promise<boolean>
  /** The job page's offer: saves the form, checks the crew, then sends. */
  onOffer:       () => void
  offerBusy:     boolean
  onChanged:     () => void
}) {
  const { error: showError, success: showSuccess } = useToast()
  const [busy, setBusy] = useState(false)
  const [readyOpen, setReadyOpen] = useState(false)
  const [reason, setReason] = useState<Reason | null>(null)

  const initialGuide: GuideInput = useMemo(() => arrangement
    ? { day: arrangement.day, timeStart: arrangement.timeStart, timeEnd: arrangement.timeEnd, note: arrangement.note }
    : {
        day: savedSlot.date ? { mode: 'fixed', day: savedSlot.date } : { mode: 'any' },
        timeStart: hhmm(savedSlot.timeStart), timeEnd: hhmm(savedSlot.timeEnd), note: null,
      }, [arrangement, savedSlot.date, savedSlot.timeStart, savedSlot.timeEnd])

  // Arrived from the list's Change date link: open the take-back step once,
  // and drop the marker so a reload or a later offer does not reopen it.
  // Read after mount — the address is never part of the first render.
  useEffect(() => {
    if (!opensChangeDate(window.location.search, state, schedulerSide)) return
    setReason('change')
    window.history.replaceState(window.history.state, '', window.location.pathname + withoutChangeParam(window.location.search) + window.location.hash)
    // Once, on arrival; the state it reads is the page's first.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (state === null && !canStart) return null

  async function act(action: ArrangeAction, extra: Record<string, unknown> = {}, doneKey?: 'arrangeChangeDone'): Promise<void> {
    if (!(await beforeAction())) return
    setBusy(true)
    try {
      const res = await fetch(`/api/jobs/${jobId}/arrange`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        // What this screen shows — the server refuses if it is out of date.
        body: JSON.stringify({ action, ...extra, seen: arrangeSeen(state, arrangement) }),
      })
      const data = await res.json().catch(() => ({})) as { error?: string; outcome?: string; clashNames?: string[] }
      if (!res.ok) { showError(arrangeErrorText(lang, data.error, action)); return }
      setReadyOpen(false)
      setReason(null)
      if (data.outcome === 'clash') showError(t(lang, 'arrangeClientOkClash').replace('{names}', (data.clashNames ?? []).join(', ')))
      else showSuccess(t(lang, data.outcome === 'scheduled' ? 'arrangeClientOkDone' : doneKey ?? 'arrangeSent'))
      onChanged()
    } catch {
      showError(t(lang, 'saveError'))
    } finally {
      setBusy(false)
    }
  }

  const primary = 'px-3 py-2 rounded-[10px] bg-terracotta text-white text-xs font-semibold disabled:opacity-40'
  const secondary = 'px-3 py-2 rounded-[10px] border border-line bg-paper text-xs font-medium text-ink2 hover:bg-bg disabled:opacity-40'
  const disabled = busy || offerBusy

  // ── Not in To arrange yet: the sales side's way in. ──────────────────────
  if (state === null) {
    return (
      <div className="rounded-[14px] border border-line bg-paper px-4 py-3 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{t(lang, 'arrangeReadyQ')}</p>
          <p className="text-xs text-muted">{t(lang, 'arrangeReadyHint')}</p>
        </div>
        <button type="button" className={primary} disabled={disabled} onClick={() => setReadyOpen(true)}>
          {t(lang, 'arrangeReadyBtn')}
        </button>
        <ArrangeReadyDialog open={readyOpen} initial={initialGuide} busy={busy} lang={lang}
          onClose={() => setReadyOpen(false)} onSend={g => act('ready', g)} />
      </div>
    )
  }

  const a = arrangement
  const turn = arrangeTurn(state)
  const last = a?.lastReturn
  const lastLine = !last || state === 'clash' || state === 'offered' ? null
    : last.kind === 'client_no' ? t(lang, 'arrangeLastNo').replace('{text}', last.text ?? '')
    : last.kind === 'no_fit'    ? t(lang, 'arrangeLastNoFit').replace('{text}', last.text ?? '')
    : last.kind === 'withdrawn' ? `${t(lang, 'arrangeLastWithdrawn').replace('{name}', last.byName)}${last.text ? ` — ${last.text}` : ''}`
    : null
  const salesActs = salesSide && turn === 'sales'
  const schedulerActs = schedulerSide && turn === 'scheduler'
  const offer = a?.offer

  return (
    <div className={cn('rounded-[14px] border border-line bg-paper px-4 py-3 space-y-2 border-l-4',
      state === 'clash' ? 'border-l-bad' : turn === 'scheduler' ? 'border-l-brand-amber' : 'border-l-brand-blue')}>
      <p className="text-[11px] uppercase tracking-widest text-muted">{t(lang, 'arrangeCardTitle')}</p>

      {a && (
        <p className="text-sm text-ink">
          <span className="text-muted">{t(lang, 'arrangeGuideLabel')}: </span>{guideLabel(a)}
        </p>
      )}
      {a?.note && (
        <p className="text-xs text-ink2"><span className="text-muted">{t(lang, 'arrangeNoteLabel')}: </span>{a.note}</p>
      )}
      {state === 'offered' && offer && (
        <div className="rounded-[10px] bg-brand-blue-soft px-3 py-2">
          <p className="font-display text-sm font-semibold text-ink">{t(lang, 'arrangeOfferLabel')}: {slotLabel(offer)}</p>
          <p className="text-xs text-ink2">
            {t(lang, 'arrangeCrewLabel')}: {offer.crewNames.length ? offer.crewNames.join(', ') : t(lang, 'arrangeCrewNone')}
            {' · '}{t(lang, 'arrangeOfferedBy').replace('{name}', offer.byName)}
          </p>
        </div>
      )}
      {lastLine && (
        <p className={cn('rounded-[10px] px-3 py-2 text-xs',
          last?.kind === 'client_no' ? 'bg-bad-soft text-bad' : 'bg-brand-amber-soft text-ink')}>{lastLine}</p>
      )}
      {state === 'clash' && offer && (
        <p className="rounded-[10px] bg-bad-soft px-3 py-2 text-xs text-bad">
          {t(lang, 'arrangeClashText').replace('{slot}', slotLabel(offer)).replace('{names}', last?.text ?? '')}
          {schedulerSide && <><br />{t(lang, 'arrangeClashHint')}</>}
        </p>
      )}

      {/* Whose turn, for anyone who cannot act on it right now. */}
      {!salesActs && !schedulerActs && state !== 'clash' && (
        <p className="text-xs text-muted">{t(lang, turn === 'scheduler' ? 'arrangeWithScheduler' : 'arrangeWithSales')}</p>
      )}
      {schedulerActs && state === 'needs_date' && (
        <p className="text-xs text-ink2">{t(lang, 'arrangeSchedulerHint')}</p>
      )}

      {(salesSide || schedulerSide) && (
        <div className="flex flex-wrap gap-2 pt-1">
          {schedulerActs && state === 'needs_date' && (
            <>
              <button type="button" className={primary} disabled={disabled} onClick={onOffer}>{t(lang, 'arrangeOfferBtn')}</button>
              <button type="button" className={secondary} disabled={disabled} onClick={() => setReason('send_back')}>{t(lang, 'arrangeCantFitBtn')}</button>
            </>
          )}
          {salesSide && state === 'offered' && (
            <>
              <button type="button" className={primary} disabled={disabled} onClick={() => act('client_ok')}>{t(lang, 'arrangeClientOkBtn')}</button>
              <button type="button" className={secondary} disabled={disabled} onClick={() => setReason('client_no')}>{t(lang, 'arrangeClientNoBtn')}</button>
            </>
          )}
          {schedulerSide && state === 'offered' && (
            <button type="button" className={secondary} disabled={disabled} onClick={() => setReason('withdraw')}>{t(lang, 'arrangeWithdrawBtn')}</button>
          )}
          {salesSide && state !== 'clash' && (
            <button type="button" className={secondary} disabled={disabled} onClick={() => setReadyOpen(true)}>{t(lang, 'arrangeEditBtn')}</button>
          )}
          {salesSide && (
            <button type="button" className={secondary} disabled={disabled} onClick={() => act('pull_back')}>
              {t(lang, state === 'needs_date' ? 'arrangeNotReadyBtn' : 'arrangeBackToOngoingBtn')}
            </button>
          )}
        </div>
      )}

      <ArrangeReadyDialog open={readyOpen} initial={initialGuide} busy={busy} lang={lang}
        onClose={() => setReadyOpen(false)} onSend={g => act('ready', g)} />
      <ArrangeReasonDialog open={reason !== null} busy={busy} lang={lang}
        title={t(lang, reason === 'client_no' ? 'arrangeReasonTitleNo' : reason === 'send_back' ? 'arrangeReasonTitleNoFit'
          : reason === 'change' ? 'arrangeReasonTitleChange' : 'arrangeReasonTitleWithdraw')}
        required={reason === 'client_no' || reason === 'send_back'}
        onClose={() => setReason(null)}
        onSend={text => act(reason === 'client_no' ? 'client_no' : reason === 'send_back' ? 'send_back' : 'withdraw', { text },
          reason === 'change' ? 'arrangeChangeDone' : undefined)} />
    </div>
  )
}
