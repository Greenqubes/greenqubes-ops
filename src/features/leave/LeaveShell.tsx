'use client'

import { useState, useCallback } from 'react'
import { Card } from '@/components/Card'
import { Btn } from '@/components/Btn'
import { CompanyBar } from '@/components/CompanyBar'
import { BottomNav } from '@/components/BottomNav'
import { Pencil, Trash2, Plus } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { t } from '@/lib/i18n'
import type { LangCode } from '@/lib/i18n'
import type { Role } from '@/lib/supabase/types'
import { useLiveChannel } from '@/lib/supabase/useLiveChannel'
import { leaveDatesLabel } from '@/lib/utils/leave-overlap'
import type { LeaveWithName, Holiday, CompanyEvent } from '@/lib/supabase/queries/leave'
import { LeaveFormModal } from './LeaveFormModal'
import { HolidaysCard } from './HolidaysCard'
import { EventsCard } from './EventsCard'
import { fmtDate, todayISO } from './format'

type PersonOption = { id: string; name: string; role: string }

interface Props {
  initialLeave:    LeaveWithName[]
  initialHolidays: Holiday[]
  initialEvents:   CompanyEvent[]
  users:           PersonOption[]
  lang:            LangCode
  role:            Role
}

const PAST_PREVIEW = 10

// HR's own page. Only hr and real admins can reach it — the route guards it,
// and RLS refuses every write from anyone else regardless.
export function LeaveShell({ initialLeave, initialHolidays, initialEvents, users, lang, role }: Props) {
  const [leave,    setLeave]    = useState(initialLeave)
  const [holidays, setHolidays] = useState(initialHolidays)
  const [events,   setEvents]   = useState(initialEvents)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing,   setEditing]   = useState<LeaveWithName | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [showAllPast, setShowAllPast] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const today = todayISO()

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/leave')
      if (!res.ok) return
      const data = await res.json() as { leave: LeaveWithName[]; holidays: Holiday[]; events: CompanyEvent[] }
      setLeave(data.leave)
      setHolidays(data.holidays)
      setEvents(data.events)
    } catch {
      // A failed refresh leaves the last good list on screen — harmless.
    }
  }, [])

  // Another admin (or HR on her phone) recording leave updates this page
  // without a reload. Same hook every live surface uses.
  useLiveChannel({
    name:    'leave-live',
    tables:  [{ table: 'user_leaves' }, { table: 'public_holidays' }, { table: 'company_events' }],
    onEvent: refresh,
  })

  const upcoming = leave.filter(l => l.date_end >= today)
  const past     = leave.filter(l => l.date_end <  today).reverse()   // most recent first
  const pastShown = showAllPast ? past : past.slice(0, PAST_PREVIEW)

  async function handleDelete(id: string) {
    setError(null)
    try {
      const res = await fetch(`/api/leave/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        setError(data.error ?? 'Delete failed')
        return
      }
      await refresh()
    } catch {
      setError('Delete failed — check your connection')
    } finally {
      setConfirmId(null)
    }
  }

  function openCreate() { setEditing(null); setModalOpen(true) }
  function openEdit(l: LeaveWithName) { setEditing(l); setModalOpen(true) }

  const typeLabel: Record<string, string> = {
    annual:    t(lang, 'leaveTypeAnnual'),
    medical:   t(lang, 'leaveTypeMedical'),
    emergency: t(lang, 'leaveTypeEmergency'),
    other:     t(lang, 'leaveTypeOther'),
  }

  function row(l: LeaveWithName, isPast: boolean) {
    return (
      <li key={l.id} className={cn('py-3 flex items-start gap-3', isPast && 'opacity-70')}>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-ink truncate">{l.user_name}</p>
          <p className="text-xs text-ink2 mt-0.5">{leaveDatesLabel(l, fmtDate)}</p>
          {l.details && (
            <p className="text-[11px] text-muted mt-0.5">
              {typeLabel[l.details.leave_type] ?? l.details.leave_type}
              {l.details.note ? ` — ${l.details.note}` : ''}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => openEdit(l)}
          className="p-1.5 rounded-md text-muted hover:text-ink transition-colors shrink-0"
          aria-label={t(lang, 'leaveEdit')}
        >
          <Pencil size={14} />
        </button>
        {confirmId === l.id ? (
          <button
            type="button"
            onClick={() => handleDelete(l.id)}
            className="px-2 py-1 rounded-md text-xs font-medium text-bad border border-bad/40 hover:bg-bad/10 transition-colors shrink-0"
          >
            {t(lang, 'leaveConfirmDelete')}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmId(l.id)}
            className="p-1.5 rounded-md text-muted hover:text-bad transition-colors shrink-0"
            aria-label={t(lang, 'leaveConfirmDelete')}
          >
            <Trash2 size={14} />
          </button>
        )}
      </li>
    )
  }

  return (
    <div className="min-h-screen bg-bg pb-24 lg:pb-28">
      <CompanyBar lang={lang} role={role} />

      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-xl font-semibold text-ink">{t(lang, 'leaveTitle')}</h1>
            <p className="text-[11px] text-muted mt-0.5">{t(lang, 'leaveSubtitle')}</p>
          </div>
          <Btn variant="accent" size="sm" onClick={openCreate} className="shrink-0">
            <span className="flex items-center gap-1.5"><Plus size={12} />{t(lang, 'leaveAdd')}</span>
          </Btn>
        </div>

        {error && <p className="text-xs text-bad">{error}</p>}

        <Card className="p-5">
          <h2 className="text-sm font-medium text-ink mb-1">{t(lang, 'leaveUpcoming')}</h2>
          {upcoming.length === 0
            ? <p className="text-xs text-muted mt-2">{t(lang, 'leaveNone')}</p>
            : <ul className="divide-y divide-line">{upcoming.map(l => row(l, false))}</ul>}
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-medium text-ink mb-1">{t(lang, 'leavePast')}</h2>
          {past.length === 0
            ? <p className="text-xs text-muted mt-2">{t(lang, 'leavePastNone')}</p>
            : (
              <>
                <ul className="divide-y divide-line">{pastShown.map(l => row(l, true))}</ul>
                {!showAllPast && past.length > PAST_PREVIEW && (
                  <button
                    type="button"
                    onClick={() => setShowAllPast(true)}
                    className="text-xs text-terracotta hover:underline mt-3"
                  >
                    {t(lang, 'leaveShowAllPast')} ({past.length})
                  </button>
                )}
              </>
            )}
        </Card>

        <EventsCard events={events} lang={lang} onChanged={refresh} />

        <HolidaysCard holidays={holidays} lang={lang} onChanged={refresh} />
      </div>

      {/* Callers own the hidden lg:block wrapper — see BottomNav's own note. */}
      <div className="hidden lg:block"><BottomNav role={role} /></div>

      <LeaveFormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={refresh}
        lang={lang}
        users={users}
        existing={leave}
        editing={editing}
      />
    </div>
  )
}
