'use client'

import { useEffect, useRef, useState } from 'react'
import { Modal } from '@/components/Modal'
import { TimeSelect } from '@/features/job-detail/TimeSelect'
import { cn } from '@/lib/utils/cn'
import { t, type LangCode } from '@/lib/i18n'
import { validateGuide, type GuideInput } from '@/lib/utils/arrange-rules'

type Mode = 'any' | 'between' | 'fixed'

/**
 * "Ready to install" (Nic, 2026-11-03): what sales already knows about the
 * install slot. Day: any / between two dates / one fixed day. Time: like the
 * job form — a start time with an optional end, blank for any time. Whatever
 * sales fills in is locked for the scheduler. Crew suggestions stay where
 * they always are, in the Team tab.
 */
export function ArrangeReadyDialog({ open, initial, busy, lang, onClose, onSend }: {
  open:    boolean
  initial: GuideInput
  busy:    boolean
  lang:    LangCode
  onClose: () => void
  onSend:  (g: GuideInput) => void
}) {
  const [mode,  setMode]  = useState<Mode>('any')
  const [from,  setFrom]  = useState('')
  const [to,    setTo]    = useState('')
  const [day,   setDay]   = useState('')
  const [start, setStart] = useState('')
  const [end,   setEnd]   = useState('')
  const [note,  setNote]  = useState('')
  const [error, setError] = useState<string | null>(null)

  // Start from what is saved each time it OPENS — read through a ref, so a
  // parent re-render while it is open can never wipe what is being typed.
  const initialRef = useRef(initial)
  initialRef.current = initial
  useEffect(() => {
    if (!open) return
    const i = initialRef.current
    const d = i.day
    setMode(d.mode)
    setFrom(d.mode === 'between' ? d.from : '')
    setTo(d.mode === 'between' ? d.to : '')
    setDay(d.mode === 'fixed' ? d.day : '')
    setStart(i.timeStart ?? '')
    setEnd(i.timeEnd ?? '')
    setNote(i.note ?? '')
    setError(null)
  }, [open])

  const send = () => {
    const g: GuideInput = {
      day: mode === 'any' ? { mode: 'any' } : mode === 'between' ? { mode: 'between', from, to } : { mode: 'fixed', day },
      timeStart: start || null,
      timeEnd: start ? (end || null) : null,
      note: note.trim() || null,
    }
    const bad = validateGuide(g)
    if (bad) { setError(t(lang, `arrangeErr_${bad}` as 'arrangeErr_bad_range')); return }
    onSend(g)
  }

  const radio = (m: Mode, label: string) => (
    <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
      <input type="radio" name="arrange-day" checked={mode === m} onChange={() => setMode(m)} />
      {label}
    </label>
  )
  const dateInput = (value: string, set: (v: string) => void, disabled: boolean) => (
    <input type="date" value={value} disabled={disabled} onChange={e => set(e.target.value)}
      className={cn('min-w-0 rounded-[8px] border border-line bg-paper px-2 py-1 text-sm text-ink', disabled && 'opacity-40')} />
  )

  return (
    <Modal isOpen={open} onClose={onClose} title={t(lang, 'arrangeReadyBtn')} scrollBody>
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-ink2">{t(lang, 'arrangeDay')}</p>
          {radio('any', t(lang, 'arrangeDayAny'))}
          <div className="flex flex-wrap items-center gap-2">
            {radio('between', t(lang, 'arrangeDayBetween'))}
            {dateInput(from, setFrom, mode !== 'between')}
            <span className="text-xs text-muted">{t(lang, 'arrangeDayAnd')}</span>
            {dateInput(to, setTo, mode !== 'between')}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {radio('fixed', t(lang, 'arrangeDayFixed'))}
            {dateInput(day, setDay, mode !== 'fixed')}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-ink2">{t(lang, 'arrangeTime')} <span className="font-normal text-muted">· {t(lang, 'arrangeTimeHint')}</span></p>
          <div className="grid grid-cols-2 gap-2">
            <div className="min-w-0">
              <p className="text-[11px] text-muted mb-1">{t(lang, 'arrangeStartLabel')}</p>
              <TimeSelect value={start} onChange={setStart} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-muted mb-1">{t(lang, 'arrangeEndOptional')}</p>
              <TimeSelect value={end} onChange={setEnd} disabled={!start} />
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-semibold text-ink2">{t(lang, 'arrangeNoteLabel')}</p>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} maxLength={500}
            placeholder={t(lang, 'arrangeNotePlaceholder')}
            className="w-full rounded-[10px] border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-ink2" />
        </div>

        {error && <p className="text-xs text-bad">{error}</p>}

        <div className="flex gap-2">
          <button type="button" onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-[10px] border border-line bg-paper text-sm font-medium text-ink2 hover:bg-bg">
            {t(lang, 'cancel')}
          </button>
          <button type="button" disabled={busy} onClick={send}
            className="flex-1 px-4 py-2.5 rounded-[10px] bg-terracotta text-white text-sm font-semibold disabled:opacity-40">
            {t(lang, 'arrangeSendBtn')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
