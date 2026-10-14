'use client'

import { useState } from 'react'
import { Card } from '@/components/Card'
import { Btn } from '@/components/Btn'
import { Pencil, Trash2, Plus, Check, X } from 'lucide-react'
import { t } from '@/lib/i18n'
import type { LangCode } from '@/lib/i18n'
import { awayWhenLabel, type AwayTrip } from '@/lib/utils/away-overlap'
import { AwayFormModal } from './AwayFormModal'
import { todayISO } from './format'

type PersonOption = { id: string; name: string; role: string }

interface Props {
  trips:     AwayTrip[]
  users:     PersonOption[]
  lang:      LangCode
  onChanged: () => void
}

// Away — staff on courses and business trips. Unlike leave the details are
// public and scheduling over it only warns (Nic, 2026-10-09).
export function AwayCard({ trips, users, lang, onChanged }: Props) {
  const [modalOpen, setModalOpen] = useState(false)
  const [editing,   setEditing]   = useState<AwayTrip | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [showPast,  setShowPast]  = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  const today    = todayISO()
  const upcoming = trips.filter(tr => tr.end_date >= today)
  const past     = trips.filter(tr => tr.end_date <  today).reverse()   // most recent first

  async function remove(id: string) {
    setError(null)
    const res = await fetch(`/api/away/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { error?: string }
      setError(data.error ?? 'Delete failed')
      return
    }
    setConfirmId(null)
    onChanged()
  }

  function row(tr: AwayTrip) {
    return (
      <li key={tr.id} className="py-2.5 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink truncate">{tr.people.map(p => p.name).join(', ')}</p>
          <p className="text-xs text-ink2 mt-0.5 truncate">{tr.title}{tr.business ? ` · ${tr.business}` : ''}</p>
          <p className="text-xs text-muted mt-0.5">{awayWhenLabel(tr)}</p>
        </div>
        {confirmId === tr.id ? (
          <>
            <button aria-label={t(lang, 'awayConfirmDelete')} onClick={() => remove(tr.id)} className="p-1.5 text-bad"><Check size={14} /></button>
            <button aria-label="Cancel" onClick={() => setConfirmId(null)} className="p-1.5 text-muted"><X size={14} /></button>
          </>
        ) : (
          <>
            <button aria-label={t(lang, 'awayFormEdit')} onClick={() => { setEditing(tr); setModalOpen(true) }} className="p-1.5 text-muted hover:text-ink"><Pencil size={14} /></button>
            <button aria-label={t(lang, 'awayConfirmDelete')} onClick={() => setConfirmId(tr.id)} className="p-1.5 text-muted hover:text-bad"><Trash2 size={14} /></button>
          </>
        )}
      </li>
    )
  }

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-ink">{t(lang, 'awayCardTitle')}</h2>
          <p className="text-[11px] text-muted mt-0.5">{t(lang, 'awayCardHint')}</p>
        </div>
        <Btn variant="accent" size="sm" onClick={() => { setEditing(null); setModalOpen(true) }} className="shrink-0">
          <span className="flex items-center gap-1.5"><Plus size={12} />{t(lang, 'awayAddShort')}</span>
        </Btn>
      </div>

      {error && <p className="text-xs text-bad mt-2">{error}</p>}

      {upcoming.length === 0
        ? <p className="text-xs text-muted mt-3">{t(lang, 'awayNone')}</p>
        : <ul className="divide-y divide-line mt-1">{upcoming.map(row)}</ul>}

      {past.length > 0 && (
        <button type="button" onClick={() => setShowPast(s => !s)} className="text-xs text-terracotta hover:underline mt-3">
          {t(lang, 'awayPast')} ({past.length})
        </button>
      )}
      {showPast && <ul className="divide-y divide-line mt-1">{past.slice(0, 20).map(row)}</ul>}

      <AwayFormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={onChanged}
        lang={lang}
        users={users}
        editing={editing}
      />
    </Card>
  )
}
