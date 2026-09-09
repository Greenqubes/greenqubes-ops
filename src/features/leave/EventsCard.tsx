'use client'

import { useState } from 'react'
import { Card } from '@/components/Card'
import { Btn } from '@/components/Btn'
import { Pencil, Trash2, Plus, Check, X } from 'lucide-react'
import { t } from '@/lib/i18n'
import type { LangCode } from '@/lib/i18n'
import type { CompanyEvent } from '@/lib/supabase/queries/leave'
import { fmtDate, todayISO } from './format'

interface Props {
  events:    CompanyEvent[]
  lang:      LangCode
  onChanged: () => void
}

const INPUT_CN =
  'border border-line rounded-lg px-3 py-2 text-sm text-ink bg-bg focus:outline-none focus:ring-2 focus:ring-terracotta/40'

// Company events — a retreat, a shutdown, a town hall. Unlike a public
// holiday these span a range of days, and unlike leave they belong to nobody
// in particular. Label-only: they show on everyone's schedule but never warn
// or block when a job is scheduled during them.
export function EventsCard({ events, lang, onChanged }: Props) {
  const [adding,    setAdding]    = useState(false)
  const [newName,   setNewName]   = useState('')
  const [newStart,  setNewStart]  = useState(todayISO())
  const [newEnd,    setNewEnd]    = useState(todayISO())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName,  setEditName]  = useState('')
  const [editStart, setEditStart] = useState('')
  const [editEnd,   setEditEnd]   = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [busy,      setBusy]      = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  const today = todayISO()
  // Anything not finished yet first; past events below, most recent first.
  const upcoming = events.filter(e => e.date_end >= today)
  const past     = events.filter(e => e.date_end <  today).reverse()

  async function send(url: string, method: string, body?: unknown) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        setError(data.error ?? 'Something went wrong')
        return false
      }
      onChanged()
      return true
    } catch {
      setError('Something went wrong — check your connection')
      return false
    } finally {
      setBusy(false)
    }
  }

  async function handleAdd() {
    if (newName.trim() === '') return
    if (await send('/api/events', 'POST', { name: newName, date_start: newStart, date_end: newEnd })) {
      setNewName('')
      setAdding(false)
    }
  }

  async function handleSaveEdit(id: string) {
    if (editName.trim() === '') return
    if (await send(`/api/events/${id}`, 'PATCH', { name: editName, date_start: editStart, date_end: editEnd })) {
      setEditingId(null)
    }
  }

  function dateRange(e: CompanyEvent) {
    return e.date_start === e.date_end
      ? fmtDate(e.date_start)
      : `${fmtDate(e.date_start)} – ${fmtDate(e.date_end)}`
  }

  function row(e: CompanyEvent, isPast: boolean) {
    return (
      <li key={e.id} className={`py-2 ${isPast ? 'opacity-70' : ''}`}>
        {editingId === e.id ? (
          /* Stacked, never a single row: two date pickers plus a name field
             plus buttons cannot fit a phone's width on one line, and a flex
             row that cannot fit pushes the whole page sideways (the JobRow
             lesson, 2026-09-07). Every field is min-w-0 so nothing sets a
             floor wider than its column. */
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <input type="date" className={`${INPUT_CN} flex-1 min-w-0`} value={editStart}
                onChange={ev => { setEditStart(ev.target.value); if (editEnd < ev.target.value) setEditEnd(ev.target.value) }} />
              <input type="date" className={`${INPUT_CN} flex-1 min-w-0`} value={editEnd} min={editStart}
                onChange={ev => setEditEnd(ev.target.value)} />
            </div>
            <input type="text" className={`${INPUT_CN} w-full min-w-0`} value={editName}
              placeholder={t(lang, 'eventName')}
              onChange={ev => setEditName(ev.target.value)} />
            <div className="flex justify-end gap-2">
              <Btn variant="ghost" size="sm" onClick={() => setEditingId(null)} disabled={busy}>
                {t(lang, 'leaveCancel')}
              </Btn>
              <Btn variant="accent" size="sm" onClick={() => handleSaveEdit(e.id)} disabled={busy || editName.trim() === ''}>
                {t(lang, 'leaveSave')}
              </Btn>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm text-ink flex-1 min-w-0">
              <span className="font-medium">{e.name}</span>
              <span className="text-muted"> · </span>
              <span className="text-ink2">{dateRange(e)}</span>
            </span>
            <button type="button"
              onClick={() => { setEditingId(e.id); setEditName(e.name); setEditStart(e.date_start); setEditEnd(e.date_end) }}
              className="p-1.5 rounded-md text-muted hover:text-ink transition-colors shrink-0"
              aria-label={t(lang, 'leaveEdit')}>
              <Pencil size={14} />
            </button>
            {confirmId === e.id ? (
              <button type="button"
                onClick={async () => { await send(`/api/events/${e.id}`, 'DELETE'); setConfirmId(null) }}
                disabled={busy}
                className="px-2 py-1 rounded-md text-xs font-medium text-bad border border-bad/40 hover:bg-bad/10 transition-colors shrink-0">
                {t(lang, 'leaveConfirmDelete')}
              </button>
            ) : (
              <button type="button" onClick={() => setConfirmId(e.id)}
                className="p-1.5 rounded-md text-muted hover:text-bad transition-colors shrink-0"
                aria-label={t(lang, 'leaveConfirmDelete')}>
                <Trash2 size={14} />
              </button>
            )}
          </div>
        )}
      </li>
    )
  }

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div>
          <h2 className="text-sm font-medium text-ink">{t(lang, 'eventsTitle')}</h2>
          <p className="text-[11px] text-muted mt-0.5">{t(lang, 'eventsSubtitle')}</p>
        </div>
        {!adding && (
          <Btn variant="secondary" size="sm" onClick={() => setAdding(true)}>
            <span className="flex items-center gap-1.5"><Plus size={12} />{t(lang, 'eventAdd')}</span>
          </Btn>
        )}
      </div>

      {adding && (
        <div className="flex flex-col gap-2 mt-3 mb-1">
          <div className="flex gap-2">
            <input type="date" className={`${INPUT_CN} flex-1 min-w-0`} value={newStart}
              onChange={e => { setNewStart(e.target.value); if (newEnd < e.target.value) setNewEnd(e.target.value) }} />
            <input type="date" className={`${INPUT_CN} flex-1 min-w-0`} value={newEnd} min={newStart}
              onChange={e => setNewEnd(e.target.value)} />
          </div>
          <input type="text" className={`${INPUT_CN} w-full min-w-0`}
            placeholder={t(lang, 'eventName')} value={newName}
            onChange={e => setNewName(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Btn variant="ghost" size="sm" onClick={() => { setAdding(false); setNewName('') }} disabled={busy}>
              {t(lang, 'leaveCancel')}
            </Btn>
            <Btn variant="accent" size="sm" onClick={handleAdd} disabled={busy || newName.trim() === ''}>
              {t(lang, 'leaveSave')}
            </Btn>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-bad mt-2">{error}</p>}

      {events.length === 0 && !adding && (
        <p className="text-xs text-muted mt-3">{t(lang, 'eventNone')}</p>
      )}

      {upcoming.length > 0 && (
        <ul className="divide-y divide-line mt-3">{upcoming.map(e => row(e, false))}</ul>
      )}
      {past.length > 0 && (
        <>
          <p className="text-[11px] text-muted uppercase tracking-widest mt-4 mb-1">{t(lang, 'leavePast')}</p>
          <ul className="divide-y divide-line">{past.map(e => row(e, true))}</ul>
        </>
      )}
    </Card>
  )
}
