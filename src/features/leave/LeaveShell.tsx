'use client'

import { useState, useCallback } from 'react'
import { Card } from '@/components/Card'
import { Btn } from '@/components/Btn'
import { CompanyBar } from '@/components/CompanyBar'
import { BottomNav } from '@/components/BottomNav'
import { Pencil, Trash2, Plus, ChevronDown } from 'lucide-react'
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

// Past leave grows forever, so it is never rendered whole: 10 rows to start,
// then 20 more per tap. "Show all" used to dump the lot, which is the flood
// Nic asked about (2026-09-09).
const PAST_PREVIEW = 10
const PAST_STEP    = 20

// A foldable section heading. The toggle and the action button are siblings,
// never nested — a button inside a button is invalid and the inner one stops
// responding. Count sits on the heading so a folded section still says how
// much is inside.
function SectionHead({ title, count, open, onToggle, lang, action }: {
  title: string; count: number; open: boolean; onToggle: () => void
  lang: LangCode; action?: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex items-center gap-1.5 flex-1 min-w-0 text-left rounded-md -m-1 p-1 hover:bg-bg transition-colors"
      >
        <ChevronDown
          size={14}
          className={cn('shrink-0 text-muted transition-transform', !open && '-rotate-90')}
        />
        <h2 className="text-sm font-medium text-ink truncate">{title}</h2>
        {count > 0 && <span className="text-xs text-muted shrink-0">({count})</span>}
        <span className="sr-only">{open ? t(lang, 'leaveHide') : t(lang, 'leaveShow')}</span>
      </button>
      {action}
    </div>
  )
}

// HR's own page. Only hr and real admins can reach it — the route guards it,
// and RLS refuses every write from anyone else regardless.
export function LeaveShell({ initialLeave, initialHolidays, initialEvents, users, lang, role }: Props) {
  const [leave,    setLeave]    = useState(initialLeave)
  const [holidays, setHolidays] = useState(initialHolidays)
  const [events,   setEvents]   = useState(initialEvents)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing,   setEditing]   = useState<LeaveWithName | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [pastLimit, setPastLimit] = useState(PAST_PREVIEW)
  // Upcoming is what HR opens the page for; past leave is reference, so it
  // starts folded. No localStorage — a render-time read of it is the /schedule
  // hydration bug.
  const [openUpcoming, setOpenUpcoming] = useState(true)
  const [openPast,     setOpenPast]     = useState(false)
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
  const pastShown = past.slice(0, pastLimit)
  const pastRemaining = past.length - pastShown.length

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
    /* [&_button]:normal-case — the shared Btn hard-codes `lowercase` in its
       base classes, which was overriding the capitalised labels no matter
       what the strings said (Nic, 2026-09-09, third time of asking). This
       descendant override beats it on specificity, so every button on this
       page reads as written. The rest of the app keeps the lowercase button
       style documented in CONTEXT.md until Nic says otherwise. */
    <div className="min-h-screen bg-bg pb-24 lg:pb-28 [&_button]:normal-case">
      <CompanyBar lang={lang} role={role} />

      {/* Wider than the usual max-w-2xl: at lg this is two columns, with the
          public-holiday list beside the leave records rather than a long
          scroll beneath them (Nic, 2026-09-09). */}
      <div className="max-w-2xl lg:max-w-5xl mx-auto px-4 pt-4">
        <div className="mb-4">
          <h1 className="font-display text-xl font-semibold text-ink">{t(lang, 'leaveTitle')}</h1>
          <p className="text-[11px] text-muted mt-0.5">{t(lang, 'leaveSubtitle')}</p>
        </div>

        {error && <p className="text-xs text-bad mb-3">{error}</p>}

        {/* Phone: one column, holidays last. lg: equal halves with holidays
            moved to the LEFT — the order classes only apply at lg, so the
            DOM order below is the phone order. */}
        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start">
          <div className="flex flex-col gap-4 lg:order-2 min-w-0">
            <Card className="p-5">
              <SectionHead
                title={t(lang, 'leaveUpcoming')}
                count={upcoming.length}
                open={openUpcoming}
                onToggle={() => setOpenUpcoming(o => !o)}
                lang={lang}
                action={
                  <Btn variant="accent" size="sm" onClick={openCreate} className="shrink-0">
                    <span className="flex items-center gap-1.5"><Plus size={12} />{t(lang, 'leaveAddShort')}</span>
                  </Btn>
                }
              />
              {openUpcoming && (
                upcoming.length === 0
                  ? <p className="text-xs text-muted mt-2">{t(lang, 'leaveNone')}</p>
                  : <ul className="divide-y divide-line mt-1">{upcoming.map(l => row(l, false))}</ul>
              )}
            </Card>

            <Card className="p-5">
              <SectionHead
                title={t(lang, 'leavePast')}
                count={past.length}
                open={openPast}
                onToggle={() => setOpenPast(o => !o)}
                lang={lang}
              />
              {openPast && (
                past.length === 0
                  ? <p className="text-xs text-muted mt-2">{t(lang, 'leavePastNone')}</p>
                  : (
                    <>
                      <ul className="divide-y divide-line mt-1">{pastShown.map(l => row(l, true))}</ul>
                      {pastRemaining > 0 && (
                        <button
                          type="button"
                          onClick={() => setPastLimit(n => n + PAST_STEP)}
                          className="text-xs text-terracotta hover:underline mt-3"
                        >
                          {t(lang, 'leaveShowMore')} ({pastRemaining})
                        </button>
                      )}
                    </>
                  )
              )}
            </Card>

            <EventsCard events={events} lang={lang} onChanged={refresh} />
          </div>

          <div className="lg:order-1 min-w-0">
            <HolidaysCard holidays={holidays} lang={lang} onChanged={refresh} />
          </div>
        </div>
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
