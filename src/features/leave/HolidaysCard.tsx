'use client'

import { useState } from 'react'
import { Card } from '@/components/Card'
import { Btn } from '@/components/Btn'
import { Pencil, Trash2, Plus, Check, X } from 'lucide-react'
import { t } from '@/lib/i18n'
import type { LangCode } from '@/lib/i18n'
import type { Holiday } from '@/lib/supabase/queries/leave'
import { fmtDate, todayISO } from './format'

interface Props {
  holidays: Holiday[]
  lang:     LangCode
  onChanged: () => void
}

const INPUT_CN =
  'border border-line rounded-lg px-3 py-2 text-sm text-ink bg-bg focus:outline-none focus:ring-2 focus:ring-terracotta/40'

// Singapore public holidays. Label-only: they show on the schedule but never
// warn or block, so nothing here talks to the clash engine. HR adds each new
// year when it is gazetted (about 11 rows) — no external service, stack stays
// locked.
export function HolidaysCard({ holidays, lang, onChanged }: Props) {
  const [adding,      setAdding]      = useState(false)
  const [newDate,     setNewDate]     = useState(todayISO())
  const [newName,     setNewName]     = useState('')
  const [editingId,   setEditingId]   = useState<string | null>(null)
  const [editDate,    setEditDate]    = useState('')
  const [editName,    setEditName]    = useState('')
  const [confirmId,   setConfirmId]   = useState<string | null>(null)
  const [busy,        setBusy]        = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  // Newest year first — the year HR is maintaining is the one she wants.
  const byYear = new Map<string, Holiday[]>()
  for (const h of holidays) {
    const year = h.holiday_date.slice(0, 4)
    const list = byYear.get(year)
    if (list) list.push(h)
    else byYear.set(year, [h])
  }
  const years = [...byYear.keys()].sort().reverse()

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
    if (await send('/api/holidays', 'POST', { holiday_date: newDate, name: newName })) {
      setNewName('')
      setAdding(false)
    }
  }

  async function handleSaveEdit(id: string) {
    if (editName.trim() === '') return
    if (await send(`/api/holidays/${id}`, 'PATCH', { holiday_date: editDate, name: editName })) {
      setEditingId(null)
    }
  }

  return (
    /* Heading stays INSIDE the card, like every other section. It was moved
       outside on 2026-09-09 and moved straight back the same day — Nic's
       call, it looked wrong detached from its list. */
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="min-w-0">
          <h2 className="text-sm font-medium text-ink">{t(lang, 'holidaysTitle')}</h2>
          <p className="text-[11px] text-muted mt-0.5">{t(lang, 'holidaysSubtitle')}</p>
        </div>
        {!adding && (
          <Btn variant="accent" size="sm" onClick={() => setAdding(true)} className="shrink-0">
            <span className="flex items-center gap-1.5"><Plus size={12} />{t(lang, 'holidayAdd')}</span>
          </Btn>
        )}
      </div>

      {adding && (
        <div className="flex flex-col gap-2 mt-3 mb-1">
          <input type="date" className={`${INPUT_CN} w-full min-w-0`} value={newDate} onChange={e => setNewDate(e.target.value)} />
          <input
            type="text"
            className={`${INPUT_CN} w-full min-w-0`}
            placeholder={t(lang, 'holidayName')}
            value={newName}
            onChange={e => setNewName(e.target.value)}
          />
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

      {holidays.length === 0 && !adding && (
        <p className="text-xs text-muted mt-3">{t(lang, 'holidayNone')}</p>
      )}

      {years.map(year => (
        <div key={year} className="mt-4">
          <p className="text-[11px] text-muted uppercase tracking-widest mb-1.5">{year}</p>
          <ul className="divide-y divide-line">
            {(byYear.get(year) ?? []).map(h => (
              <li key={h.id} className="py-2">
                {editingId === h.id ? (
                  /* Stacked for the same reason as the events card: a date
                     picker, a name field and two buttons do not fit one line
                     on a phone, and a row that cannot fit pushes the page. */
                  <div className="flex flex-col gap-2">
                    <input type="date" className={`${INPUT_CN} w-full min-w-0`} value={editDate} onChange={e => setEditDate(e.target.value)} />
                    <input
                      type="text"
                      className={`${INPUT_CN} w-full min-w-0`}
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                    />
                    <div className="flex justify-end gap-2">
                      <Btn variant="ghost" size="sm" onClick={() => setEditingId(null)} disabled={busy}>
                        {t(lang, 'leaveCancel')}
                      </Btn>
                      <Btn variant="accent" size="sm" onClick={() => handleSaveEdit(h.id)} disabled={busy || editName.trim() === ''}>
                        {t(lang, 'leaveSave')}
                      </Btn>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-ink flex-1 min-w-0">
                      <span className="text-ink2">{fmtDate(h.holiday_date)}</span>
                      <span className="text-muted"> — </span>
                      {h.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => { setEditingId(h.id); setEditDate(h.holiday_date); setEditName(h.name) }}
                      className="p-1.5 rounded-md text-muted hover:text-ink transition-colors shrink-0"
                      aria-label={t(lang, 'leaveEdit')}
                    >
                      <Pencil size={14} />
                    </button>
                    {confirmId === h.id ? (
                      <button
                        type="button"
                        onClick={async () => { await send(`/api/holidays/${h.id}`, 'DELETE'); setConfirmId(null) }}
                        disabled={busy}
                        className="px-2 py-1 rounded-md text-xs font-medium text-bad border border-bad/40 hover:bg-bad/10 transition-colors shrink-0"
                      >
                        {t(lang, 'leaveConfirmDelete')}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmId(h.id)}
                        className="p-1.5 rounded-md text-muted hover:text-bad transition-colors shrink-0"
                        aria-label={t(lang, 'leaveConfirmDelete')}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </Card>
  )
}
