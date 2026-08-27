'use client'

import { useState, useEffect, useMemo } from 'react'
import { X, Plus, Check, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { t } from '@/lib/i18n'
import { fmtTime } from '@/features/schedule/utils'
import { clashesForInstaller } from '@/lib/utils/clash-detection'
import { EditClashModal, type CheckClash } from '@/features/job-detail/EditClashModal'
import type { InstallerClash } from '@/lib/utils/clash-detection'
import type { FCFSJob } from '@/lib/supabase/queries/fcfs'
import type { InstallerUser } from '@/lib/supabase/queries/jobs'
import type { LangCode } from '@/lib/i18n'
import type { Role } from '@/lib/supabase/types'

// Approved design: public/mockups/workflow-v2/installer-panel.html
// Tap a job on the FCFS board → this panel. Green tick = formally assigned,
// amber tick = sales suggestion (Confirm / Remove), dashed = added not saved.
// Save & Notify reuses the Phase 2 assign-installers route (clears suggestions,
// replaces the formal set, Telegrams new installers + sales POC/coordinators).
//
// Smoke feedback edit 8 (Nic explicit, 2026-08-27; ANSWERED line): coordinator
// is suggest-only here too — they can add/suggest and remove a suggestion,
// but cannot Confirm a suggestion or formally assign. Only scheduler/admin
// keep the full Confirm/Remove-formal/Save & Notify (assign-installers) path.

const EDIT_ROLES: Role[] = ['scheduler', 'admin']

// Always-English date, per the hard rule on date labels.
const fmtDate = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })

const initials = (name: string) =>
  name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()

interface AssignmentPanelProps {
  job:        FCFSJob | null
  clashes:    InstallerClash[]
  installers: InstallerUser[]
  role:       Role
  lang:       LangCode
  onClose:    () => void
  onSaved:    () => void
}

export function AssignmentPanel({ job, clashes, installers, role, lang, onClose, onSaved }: AssignmentPanelProps) {
  const canEdit      = EDIT_ROLES.includes(role)
  const isCoordinator = role === 'coordinator'
  // Coordinator can add/suggest + drop their own or others' suggestions, but
  // never Confirm a suggestion or formally assign — that stays canEdit-only.
  const canSuggest = canEdit || isCoordinator

  const [removedFormal,  setRemovedFormal]  = useState<Set<string>>(new Set())
  const [confirmedSugg,  setConfirmedSugg]  = useState<Set<string>>(new Set())
  const [removedSugg,    setRemovedSugg]    = useState<Set<string>>(new Set())
  const [added,          setAdded]          = useState<string[]>([])
  const [addOpen,        setAddOpen]        = useState(false)
  const [saving,         setSaving]         = useState(false)
  const [error,          setError]          = useState(false)
  const [clashPrompt,    setClashPrompt]    = useState<CheckClash[] | null>(null)

  // Reset local edits whenever a different job is opened.
  useEffect(() => {
    setRemovedFormal(new Set())
    setConfirmedSugg(new Set())
    setRemovedSugg(new Set())
    setAdded([])
    setAddOpen(false)
    setSaving(false)
    setError(false)
    setClashPrompt(null)
  }, [job?.id])

  const formal      = useMemo(() => (job?.assignees ?? []).filter(a => !a.is_suggestion), [job])
  const suggestions = useMemo(() => (job?.assignees ?? []).filter(a => a.is_suggestion), [job])

  const finalIds = useMemo(() => [
    ...formal.filter(a => !removedFormal.has(a.user_id)).map(a => a.user_id),
    ...suggestions.filter(a => confirmedSugg.has(a.user_id)).map(a => a.user_id),
    ...added,
  ], [formal, suggestions, removedFormal, confirmedSugg, added])

  const dirty =
    removedFormal.size > 0 || confirmedSugg.size > 0 || removedSugg.size > 0 || added.length > 0

  const presentIds = useMemo(
    () => new Set([...(job?.assignees ?? []).map(a => a.user_id), ...added]),
    [job, added],
  )
  const addable = installers.filter(u => !presentIds.has(u.id))

  if (!job) return null

  const hasClashToday = (installerId: string) =>
    clashesForInstaller(clashes, installerId)
      .some(c => c.jobA.id === job.id || c.jobB.id === job.id)

  const doSave = async () => {
    setSaving(true)
    setError(false)
    try {
      const res = await fetch(`/api/jobs/${job.id}/assign-installers`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ installer_ids: finalIds }),
      })
      if (!res.ok) throw new Error()
      onSaved()
      onClose()
    } catch {
      setError(true)
    } finally {
      setSaving(false)
    }
  }

  // Coordinator save path (edit 8, ANSWERED line): suggest-only — posts each
  // add/remove individually to suggest-installer, mirroring JobDetailShell's
  // toggleSuggestionFor. No clash preflight: a suggestion doesn't lock the
  // schedule, same as sales' suggest path elsewhere never clash-checking.
  const doSaveSuggestions = async () => {
    setSaving(true)
    setError(false)
    try {
      await Promise.all([
        ...added.map(id => fetch(`/api/jobs/${job.id}/suggest-installer`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ user_id: id, action: 'add' }),
        }).then(res => { if (!res.ok) throw new Error() })),
        ...[...removedSugg].map(id => fetch(`/api/jobs/${job.id}/suggest-installer`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ user_id: id, action: 'remove' }),
        }).then(res => { if (!res.ok) throw new Error() })),
      ])
      onSaved()
      onClose()
    } catch {
      setError(true)
    } finally {
      setSaving(false)
    }
  }

  const handleSave = async () => {
    // Coordinator never formally assigns — skip the assign-installers-backed
    // clash preflight (that route is scheduler/admin only now) and save
    // suggestions directly.
    if (!canEdit && isCoordinator) {
      await doSaveSuggestions()
      return
    }
    setSaving(true)
    setError(false)
    try {
      const res = await fetch(`/api/jobs/${job.id}/assign-installers?checkOnly=true`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ installer_ids: finalIds }),
      })
      if (!res.ok) throw new Error()
      const data: { hasClash: boolean; clashes: CheckClash[] } = await res.json()
      if (data.hasClash) {
        setSaving(false)
        setClashPrompt(data.clashes)
        return
      }
      await doSave()
    } catch {
      setError(true)
      setSaving(false)
    }
  }

  const alertSchedulerAndSave = async () => {
    const names = [...new Set((clashPrompt ?? []).map(c => c.installerName))]
    setClashPrompt(null)
    // Best-effort — the save must not fail because a Telegram send did.
    fetch(`/api/jobs/${job.id}/notify-clash`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ clashNames: names }),
    }).catch(() => {})
    await doSave()
  }

  const rosterOf = (id: string) => installers.find(u => u.id === id)

  return (
    // z-[60]: overlays must layer above the BottomNav (z-50) — hard rule.
    <div className="fixed inset-0 z-[60] flex items-end sm:items-stretch sm:justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />

      <div className="relative z-50 w-full sm:w-[380px] bg-paper max-h-[85vh] sm:max-h-none sm:h-full rounded-t-2xl sm:rounded-none border-t sm:border-t-0 sm:border-l border-line flex flex-col">
        {/* Header */}
        <div className="bg-ink text-paper px-5 py-4 rounded-t-2xl sm:rounded-none flex items-start justify-between shrink-0">
          <div>
            <p className="font-display text-base font-medium">{job.project_title || job.client}</p>
            <p className="text-xs text-paper/70 mt-0.5">{fmtDate(job.date)} · {job.location}</p>
          </div>
          <button onClick={onClose} className="text-paper/70 hover:text-paper mt-0.5" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {/* Rank + punctuality strip */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-line shrink-0">
          <span className="text-[11px] font-extrabold px-1.5 py-0.5 rounded bg-ink text-paper">
            #{job.fcfs_rank}
          </span>
          <span className={cn(
            'text-[11px] font-semibold px-2 py-0.5 rounded-full',
            job.punctuality === 'strict'
              ? 'bg-punct-strict-soft text-punct-strict'
              : 'bg-punct-flex-soft text-punct-flex',
          )}>
            {t(lang, job.punctuality === 'strict' ? 'strictOnTime' : 'flexibleWindow')}
          </span>
          <span className="text-xs text-ink2 ml-auto">
            {job.time_start
              ? `${fmtTime(job.time_start)}${job.time_end ? `–${fmtTime(job.time_end)}` : ''}`
              : t(lang, 'fcfsAllDay')}
          </span>
        </div>

        {/* Installers */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
              {t(lang, 'installers')}
            </p>
            {canSuggest && addable.length > 0 && (
              <button
                onClick={() => setAddOpen(o => !o)}
                className="flex items-center gap-1 text-[11px] font-semibold text-brand-blue"
              >
                <Plus size={11} strokeWidth={2.5} />
                {t(lang, 'fcfsAdd')}
              </button>
            )}
          </div>

          {addOpen && (
            <div className="mb-3 border border-line rounded-[10px] divide-y divide-line overflow-hidden">
              {addable.map(u => (
                <button
                  key={u.id}
                  onClick={() => { setAdded(prev => [...prev, u.id]); setAddOpen(false) }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-bg"
                >
                  <span className="w-7 h-7 rounded-full bg-muted text-white text-[9px] font-bold flex items-center justify-center shrink-0">
                    {initials(u.name)}
                  </span>
                  <span className="text-xs font-medium text-ink">{u.name}</span>
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2">
            {/* Formal assignments */}
            {formal.filter(a => !removedFormal.has(a.user_id)).map(a => (
              <div key={a.user_id} className="border border-line rounded-[10px] p-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-full bg-brand-green text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                    {initials(a.name)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-ink truncate">{a.name}</p>
                    {hasClashToday(a.user_id) && (
                      <p className="text-[10px] text-bad flex items-center gap-1">
                        <AlertTriangle size={9} /> {t(lang, 'fcfsHasClash')}
                      </p>
                    )}
                  </div>
                  <span className="w-5 h-5 rounded-full border-2 border-brand-green flex items-center justify-center shrink-0">
                    <Check size={11} strokeWidth={3} className="text-brand-green" />
                  </span>
                </div>
                <p className="text-[10px] text-brand-green mt-1.5 flex items-center gap-1">
                  <Check size={10} strokeWidth={2.5} /> {t(lang, 'fcfsConfirmed')}
                </p>
                {canEdit && (
                  <div className="mt-2">
                    <button
                      onClick={() => setRemovedFormal(prev => new Set([...prev, a.user_id]))}
                      className="text-[11px] font-semibold text-terracotta border border-terracotta/40 rounded-md px-2.5 py-1"
                    >
                      {t(lang, 'fcfsRemove')}
                    </button>
                  </div>
                )}
              </div>
            ))}

            {/* Suggestions */}
            {suggestions.filter(a => !removedSugg.has(a.user_id)).map(a => {
              const confirmed = confirmedSugg.has(a.user_id)
              return (
                <div key={a.user_id} className="border border-line rounded-[10px] p-3">
                  <div className="flex items-center gap-2.5">
                    <span className={cn(
                      'w-8 h-8 rounded-full text-white text-[10px] font-bold flex items-center justify-center shrink-0',
                      confirmed ? 'bg-brand-green' : 'bg-brand-amber',
                    )}>
                      {initials(a.name)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-ink truncate">{a.name}</p>
                      {hasClashToday(a.user_id) && (
                        <p className="text-[10px] text-bad flex items-center gap-1">
                          <AlertTriangle size={9} /> {t(lang, 'fcfsHasClash')}
                        </p>
                      )}
                    </div>
                    <span className={cn(
                      'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0',
                      confirmed ? 'border-brand-green' : 'border-brand-amber',
                    )}>
                      <Check size={11} strokeWidth={3} className={confirmed ? 'text-brand-green' : 'text-brand-amber'} />
                    </span>
                  </div>
                  <p className={cn(
                    'text-[10px] mt-1.5 flex items-center gap-1',
                    confirmed ? 'text-muted' : 'text-brand-amber',
                  )}>
                    {confirmed
                      ? t(lang, 'fcfsAddedNotSaved')
                      : `${t(lang, 'fcfsSuggestedBy')} ${a.suggested_by_name ?? '—'} · ${t(lang, 'fcfsUnconfirmed')}`}
                  </p>
                  {canSuggest && (
                    <div className="mt-2 flex gap-2">
                      {/* Confirm formally assigns — scheduler/admin only.
                          Coordinator (edit 8) can still drop a suggestion,
                          just never promote one. */}
                      {!confirmed && canEdit && (
                        <button
                          onClick={() => setConfirmedSugg(prev => new Set([...prev, a.user_id]))}
                          className="text-[11px] font-semibold text-white bg-brand-green rounded-md px-2.5 py-1"
                        >
                          {t(lang, 'fcfsConfirm')}
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setRemovedSugg(prev => new Set([...prev, a.user_id]))
                          setConfirmedSugg(prev => {
                            const next = new Set(prev)
                            next.delete(a.user_id)
                            return next
                          })
                        }}
                        className="text-[11px] font-semibold text-terracotta border border-terracotta/40 rounded-md px-2.5 py-1"
                      >
                        {t(lang, 'fcfsRemove')}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}

            {/* Newly added (not yet saved) */}
            {added.map(id => {
              const u = rosterOf(id)
              if (!u) return null
              return (
                <div key={id} className="border border-dashed border-line rounded-[10px] p-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-full bg-muted text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                      {initials(u.name)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-ink truncate">{u.name}</p>
                      {hasClashToday(id) && (
                        <p className="text-[10px] text-bad flex items-center gap-1">
                          <AlertTriangle size={9} /> {t(lang, 'fcfsHasClash')}
                        </p>
                      )}
                    </div>
                    <span className="w-5 h-5 rounded-full border-2 border-dashed border-muted shrink-0" />
                  </div>
                  <p className="text-[10px] text-muted mt-1.5">{t(lang, 'fcfsAddedNotSaved')}</p>
                  <div className="mt-2">
                    <button
                      onClick={() => setAdded(prev => prev.filter(x => x !== id))}
                      className="text-[11px] font-semibold text-terracotta border border-terracotta/40 rounded-md px-2.5 py-1"
                    >
                      {t(lang, 'fcfsRemove')}
                    </button>
                  </div>
                </div>
              )
            })}

            {formal.length === 0 && suggestions.length === 0 && added.length === 0 && (
              <p className="text-xs text-muted py-4 text-center">{t(lang, 'fcfsNoInstallers')}</p>
            )}
          </div>

          {error && <p className="text-xs text-bad mt-3">{t(lang, 'saveError')}</p>}
        </div>

        {/* Actions — canSuggest covers both: scheduler/admin's full Save &
            Notify (formal assign), and coordinator's suggestion-only save
            (handleSave dispatches to doSaveSuggestions for them). */}
        {canSuggest && (
          <div className="flex gap-2 px-5 py-3 border-t border-line shrink-0 pb-[max(env(safe-area-inset-bottom),12px)]">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-[10px] border border-line text-sm font-medium text-ink2"
            >
              {t(lang, 'cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !dirty}
              className="flex-1 px-4 py-2.5 rounded-[10px] bg-terracotta text-white text-sm font-semibold disabled:opacity-40"
            >
              {saving ? t(lang, 'loading') : canEdit ? t(lang, 'fcfsSaveNotify') : t(lang, 'fcfsSaveSuggestions')}
            </button>
          </div>
        )}
      </div>

      <EditClashModal
        isOpen={clashPrompt !== null}
        clashes={clashPrompt ?? []}
        role={role}
        lang={lang}
        onAlertScheduler={alertSchedulerAndSave}
        onProceed={() => { setClashPrompt(null); doSave() }}
        onClose={() => setClashPrompt(null)}
      />
    </div>
  )
}
