'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/Modal'
import { Btn } from '@/components/Btn'
import { Field } from '@/components/Field'
import { t } from '@/lib/i18n'
import type { LangCode } from '@/lib/i18n'
import { leaveRangesOverlap, type LeavePortion } from '@/lib/utils/leave-overlap'
import type { LeaveWithName } from '@/lib/supabase/queries/leave'
import { todayISO } from './format'

type PersonOption = { id: string; name: string; role: string }

interface Props {
  isOpen:    boolean
  onClose:   () => void
  onSaved:   () => void
  lang:      LangCode
  users:     PersonOption[]
  /** Every existing entry — used for the same-person overlap warning. */
  existing:  LeaveWithName[]
  /** Null = create mode. */
  editing:   LeaveWithName | null
}

const SELECT_CN =
  'w-full border border-line rounded-lg px-3 py-2 text-sm text-ink bg-bg focus:outline-none focus:ring-2 focus:ring-terracotta/40'

export function LeaveFormModal({ isOpen, onClose, onSaved, lang, users, existing, editing }: Props) {
  const [userId,       setUserId]       = useState('')
  const [dateStart,    setDateStart]    = useState('')
  const [dateEnd,      setDateEnd]      = useState('')
  const [startPortion, setStartPortion] = useState<LeavePortion>('full')
  const [endPortion,   setEndPortion]   = useState<LeavePortion>('full')
  const [leaveType,    setLeaveType]    = useState('annual')
  const [note,         setNote]         = useState('')
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [overlapAck,   setOverlapAck]   = useState(false)
  const [showOverlap,  setShowOverlap]  = useState(false)

  // Reseed whenever the modal opens — create mode starts on today, edit mode
  // loads the row. Depending on isOpen (not just editing) means reopening the
  // same row after a cancel does not show stale edits.
  useEffect(() => {
    if (!isOpen) return
    const today = todayISO()
    setUserId(editing?.user_id ?? '')
    setDateStart(editing?.date_start ?? today)
    setDateEnd(editing?.date_end ?? today)
    setStartPortion(editing?.start_portion ?? 'full')
    setEndPortion(editing?.end_portion ?? 'full')
    setLeaveType(editing?.details?.leave_type ?? 'annual')
    setNote(editing?.details?.note ?? '')
    setError(null)
    setOverlapAck(false)
    setShowOverlap(false)
  }, [isOpen, editing])

  const singleDay = dateStart !== '' && dateStart === dateEnd

  // One day = one portion question, not two. The DB keeps both columns in
  // step so leaveWindowOnDate reads the same answer whichever end it checks.
  function setSingleDayPortion(p: LeavePortion) {
    setStartPortion(p)
    setEndPortion(p)
  }

  function onStartChange(value: string) {
    setStartPortion('full')
    setEndPortion('full')
    setDateStart(value)
    // Never leave the range inverted — the DB has a check constraint and the
    // route rejects it, but snapping is friendlier than an error.
    if (dateEnd === '' || dateEnd < value) setDateEnd(value)
  }

  async function handleSubmit() {
    setError(null)

    const draft = { date_start: dateStart, date_end: dateEnd }
    const clash = existing.some(l =>
      l.user_id === userId && l.id !== editing?.id && leaveRangesOverlap(l, draft))
    if (clash && !overlapAck) {
      setShowOverlap(true)
      setOverlapAck(true)   // a second press goes through
      return
    }

    setSaving(true)
    try {
      const body = {
        user_id:       userId,
        date_start:    dateStart,
        date_end:      dateEnd,
        start_portion: startPortion,
        end_portion:   endPortion,
        leave_type:    leaveType,
        note:          note.trim() === '' ? null : note.trim(),
      }
      const res = editing
        ? await fetch(`/api/leave/${editing.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        : await fetch('/api/leave', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        setError(data.error ?? 'Save failed')
        return
      }
      onSaved()
      onClose()
    } catch {
      setError('Save failed — check your connection and try again')
    } finally {
      setSaving(false)
    }
  }

  const canSave = userId !== '' && dateStart !== '' && dateEnd !== '' && !saving

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t(lang, editing ? 'leaveEdit' : 'leaveAdd')}>
      <div className="px-6 py-5 space-y-4">
        <Field label={t(lang, 'leavePerson')}>
          <select className={SELECT_CN} value={userId} onChange={e => setUserId(e.target.value)}>
            <option value="">—</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t(lang, 'leaveFrom')}>
            <input
              type="date"
              /* min-w-0: a date input's intrinsic width can exceed a
                 half-width column on a small phone and push the modal. */
              className={`${SELECT_CN} min-w-0`}
              value={dateStart}
              onChange={e => onStartChange(e.target.value)}
            />
          </Field>
          <Field label={t(lang, 'leaveTo')}>
            <input
              type="date"
              /* min-w-0: a date input's intrinsic width can exceed a
                 half-width column on a small phone and push the modal. */
              className={`${SELECT_CN} min-w-0`}
              value={dateEnd}
              min={dateStart || undefined}
              onChange={e => { setDateEnd(e.target.value); setStartPortion('full'); setEndPortion('full') }}
            />
          </Field>
        </div>

        {singleDay ? (
          <Field label={t(lang, 'leavePortion')}>
            <select
              className={SELECT_CN}
              value={startPortion}
              onChange={e => setSingleDayPortion(e.target.value as LeavePortion)}
            >
              <option value="full">{t(lang, 'leavePortionFull')}</option>
              <option value="am">{t(lang, 'leavePortionAm')}</option>
              <option value="pm">{t(lang, 'leavePortionPm')}</option>
            </select>
          </Field>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label={t(lang, 'leaveFirstDay')}>
              <select className={SELECT_CN} value={startPortion} onChange={e => setStartPortion(e.target.value as LeavePortion)}>
                <option value="full">{t(lang, 'leavePortionFull')}</option>
                <option value="pm">{t(lang, 'leavePortionPm')}</option>
              </select>
            </Field>
            <Field label={t(lang, 'leaveLastDay')}>
              <select className={SELECT_CN} value={endPortion} onChange={e => setEndPortion(e.target.value as LeavePortion)}>
                <option value="full">{t(lang, 'leavePortionFull')}</option>
                <option value="am">{t(lang, 'leavePortionAm')}</option>
              </select>
            </Field>
          </div>
        )}

        <Field label={t(lang, 'leaveType')}>
          <select className={SELECT_CN} value={leaveType} onChange={e => setLeaveType(e.target.value)}>
            <option value="annual">{t(lang, 'leaveTypeAnnual')}</option>
            <option value="medical">{t(lang, 'leaveTypeMedical')}</option>
            <option value="emergency">{t(lang, 'leaveTypeEmergency')}</option>
            <option value="other">{t(lang, 'leaveTypeOther')}</option>
          </select>
        </Field>

        <Field label={t(lang, 'leaveNote')}>
          <textarea
            className={`${SELECT_CN} min-h-[72px] resize-y`}
            value={note}
            placeholder={t(lang, 'leaveNotePlaceholder')}
            onChange={e => setNote(e.target.value)}
          />
        </Field>

        {showOverlap && (
          <p className="text-xs text-brand-amber bg-brand-amber-soft border border-brand-amber/30 rounded-lg px-3 py-2">
            {t(lang, 'leaveOverlapWarn')}
          </p>
        )}
        {error && <p className="text-xs text-bad">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Btn variant="secondary" size="sm" onClick={onClose} disabled={saving}>
            {t(lang, 'leaveCancel')}
          </Btn>
          <Btn variant="accent" size="sm" onClick={handleSubmit} disabled={!canSave}>
            {showOverlap ? t(lang, 'leaveSaveAnyway') : t(lang, 'leaveSave')}
          </Btn>
        </div>
      </div>
    </Modal>
  )
}
