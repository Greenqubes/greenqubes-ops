'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/Modal'
import { Btn } from '@/components/Btn'
import { Field } from '@/components/Field'
import { LocationInput } from '@/features/job-detail/LocationInput'
import { TimeSelect } from '@/features/job-detail/TimeSelect'
import { cn } from '@/lib/utils/cn'
import { t } from '@/lib/i18n'
import type { LangCode } from '@/lib/i18n'
import type { AwayTrip } from '@/lib/utils/away-overlap'
import { todayISO } from './format'

type PersonOption = { id: string; name: string; role: string }

interface Props {
  isOpen:  boolean
  onClose: () => void
  onSaved: () => void
  lang:    LangCode
  users:   PersonOption[]
  /** Null = create mode. */
  editing: AwayTrip | null
}

const INPUT_CN =
  'w-full border border-line rounded-lg px-3 py-2 text-sm text-ink bg-bg focus:outline-none'

// One trip, several people, exact start and end times (Nic, 2026-10-09).
export function AwayFormModal({ isOpen, onClose, onSaved, lang, users, editing }: Props) {
  const [userIds,   setUserIds]   = useState<string[]>([])
  const [title,     setTitle]     = useState('')
  const [business,  setBusiness]  = useState('')
  const [location,  setLocation]  = useState('')
  const [startDate, setStartDate] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endDate,   setEndDate]   = useState('')
  const [endTime,   setEndTime]   = useState('18:00')
  const [note,      setNote]      = useState('')
  const [search,    setSearch]    = useState('')
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  // Reseed on every open, like LeaveFormModal — a cancelled edit never leaks.
  useEffect(() => {
    if (!isOpen) return
    const today = todayISO()
    setUserIds(editing?.people.map(p => p.id) ?? [])
    setTitle(editing?.title ?? '')
    setBusiness(editing?.business ?? '')
    setLocation(editing?.location ?? '')
    setStartDate(editing?.start_date ?? today)
    setStartTime(editing?.start_time.slice(0, 5) ?? '09:00')
    setEndDate(editing?.end_date ?? today)
    setEndTime(editing?.end_time.slice(0, 5) ?? '18:00')
    setNote(editing?.note ?? '')
    setSearch('')
    setError(null)
  }, [isOpen, editing])

  function toggle(id: string) {
    setUserIds(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id])
  }

  function onStartDate(v: string) {
    setStartDate(v)
    if (endDate === '' || endDate < v) setEndDate(v)   // never leave the range inverted
  }

  async function handleSubmit() {
    setError(null)
    // Client-side mirror of the route's checks, so the common mistakes are
    // explained before a round trip. The route re-checks everything.
    if (userIds.length === 0) { setError('Pick at least one person'); return }
    if (!title.trim())        { setError('Add a title'); return }
    if (`${endDate} ${endTime}` <= `${startDate} ${startTime}`) {
      setError('The end must be after the start'); return
    }
    setSaving(true)
    try {
      const body = {
        user_ids: userIds, title, business, location,
        start_date: startDate, start_time: startTime, end_date: endDate, end_time: endTime, note,
      }
      const res = await fetch(editing ? `/api/away/${editing.id}` : '/api/away', {
        method:  editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        setError(data.error ?? 'Save failed')
        return
      }
      onSaved()
      onClose()
    } catch {
      setError('Save failed — check your connection')
    } finally {
      setSaving(false)
    }
  }

  const q = search.trim().toLowerCase()
  // Picked people always stay visible, so a search never hides a tick.
  const shown = users.filter(u => userIds.includes(u.id) || u.name.toLowerCase().includes(q))

  return (
    // scrollBody: the form is taller than a laptop screen. Safe here — both
    // dropdowns in it (TimeSelect, LocationInput) portal to <body>.
    <Modal isOpen={isOpen} onClose={onClose} title={t(lang, editing ? 'awayFormEdit' : 'awayFormNew')} scrollBody>
      <div className="flex flex-col gap-3">
        <Field label={`${t(lang, 'awayPeople')} *`}>
          <input className={INPUT_CN} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" />
          <div className="mt-2 max-h-40 overflow-y-auto flex flex-wrap gap-1.5">
            {shown.map(u => (
              <button
                key={u.id}
                type="button"
                onClick={() => toggle(u.id)}
                className={cn(
                  'px-2.5 py-1 rounded-full border text-xs font-medium',
                  userIds.includes(u.id)
                    ? 'bg-brand-amber-soft border-brand-amber text-ink'
                    : 'bg-paper border-line text-ink2',
                )}
              >
                {u.name}
              </button>
            ))}
          </div>
        </Field>

        <Field label={`${t(lang, 'awayTitleField')} *`}>
          <input className={INPUT_CN} value={title} onChange={e => setTitle(e.target.value)} placeholder="First Aid course" />
        </Field>

        <Field label={t(lang, 'awayBusiness')}>
          <input className={INPUT_CN} value={business} onChange={e => setBusiness(e.target.value)} />
        </Field>

        <Field label={t(lang, 'awayLocation')}>
          <LocationInput value={location} onChange={setLocation} lang={lang} />
        </Field>

        {/* Stacked, not side by side: two date+time pairs in one row overflowed
            a 360px phone on the Leave page before (2026-09-09). */}
        <Field label={`${t(lang, 'awayStarts')} *`}>
          <div className="flex flex-col gap-2">
            <input type="date" className={INPUT_CN} value={startDate} onChange={e => onStartDate(e.target.value)} />
            <TimeSelect value={startTime} onChange={setStartTime} />
          </div>
        </Field>
        <Field label={`${t(lang, 'awayEnds')} *`}>
          <div className="flex flex-col gap-2">
            <input type="date" className={INPUT_CN} value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} />
            <TimeSelect value={endTime} onChange={setEndTime} />
          </div>
        </Field>

        <Field label={t(lang, 'awayNote')}>
          <textarea className={cn(INPUT_CN, 'min-h-[64px]')} value={note} onChange={e => setNote(e.target.value)} />
        </Field>

        {error && <p className="text-xs text-bad">{error}</p>}

        <div className="flex gap-3 pt-1">
          <Btn variant="secondary" onClick={onClose} className="flex-1">Cancel</Btn>
          <Btn variant="accent" onClick={handleSubmit} disabled={saving} className="flex-1">{saving ? 'Saving…' : 'Save'}</Btn>
        </div>
      </div>
    </Modal>
  )
}
