'use client'

import { useState } from 'react'
import { ChevronRight, AlertCircle, Send } from 'lucide-react'
import { Btn } from '@/components/Btn'
import { TimeSelect } from '@/features/job-detail/TimeSelect'
import { WeekWorkloadChart } from './WeekWorkloadChart'
import { cn } from '@/lib/utils/cn'
import { buildUserMeta } from '@/lib/utils/user-meta'
import type { Clash, Substitute, WeekDay } from '@/app/api/jobs/[id]/clashes/route'
import type { LangCode } from '@/lib/i18n'

interface Props {
  jobDate:           string
  jobTimeStart:      string | null
  jobTimeEnd:        string | null
  clashes:           Clash[]
  softClashes:       Clash[]
  travelWarnings:    Clash[]
  substitutes:       Substitute[]
  weekDays:          WeekDay[]
  lang:              LangCode
  onSendToScheduler: (replacements: Record<string, string | 'keep'>, timeStart: string, timeEnd: string) => Promise<void>
  onNotifyScheduler: (clashNames: string[]) => Promise<void>
  onCancel:          () => void
}

function fmtTime(t: string | null): string {
  if (!t) return ''
  const [hStr, mStr] = t.split(':')
  const h = parseInt(hStr, 10)
  const m = mStr ?? '00'
  const period = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${m} ${period}`
}

function fmtDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-SG', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

function toInputTime(t: string | null): string {
  if (!t) return ''
  return t.slice(0, 5)
}

// Mirror of the server's overlap logic (clashes route) so the modal can
// re-evaluate a clash live when the user shifts the job's time.
const hhmm = (t: string | null) => t?.slice(0, 5) ?? null

function timesOverlap(
  s1: string | null, e1: string | null,
  s2: string | null, e2: string | null,
): boolean {
  const [a, b, c, d] = [hhmm(s1), hhmm(e1), hhmm(s2), hhmm(e2)]
  if (!a || !c) return true
  if (b && d)   return a < d && c < b
  if (b)        return c >= a && c < b
  if (d)        return a >= c && a < d
  return a === c
}

export function ClashResolutionModal({
  jobDate, jobTimeStart, jobTimeEnd,
  clashes, softClashes, travelWarnings, substitutes, weekDays,
  onSendToScheduler, onNotifyScheduler, onCancel,
}: Props) {
  const [replacements, setReplacements] = useState<Record<string, string | 'keep'>>({})
  const [timeStart, setTimeStart] = useState(toInputTime(jobTimeStart))
  const [timeEnd,   setTimeEnd]   = useState(toInputTime(jobTimeEnd))
  const [submitting,    setSubmitting]    = useState(false)
  const [showWarning,   setShowWarning]   = useState(false)

  // A clash is resolved either by choosing a substitute / "keep anyway",
  // OR by shifting the job's time so it no longer overlaps the other job.
  const clashActive = (c: Clash) =>
    timesOverlap(timeStart || null, timeEnd || null, c.conflictingJob.timeStart, c.conflictingJob.timeEnd)
  const unresolvedCount = clashes.filter(
    c => clashActive(c) && replacements[c.installer.id] === undefined,
  ).length
  const allResolved     = unresolvedCount === 0
  const hasKeeps        = Object.values(replacements).some(v => v === 'keep')

  async function handleSend() {
    if (hasKeeps) { setShowWarning(true); return }
    setSubmitting(true)
    try {
      await onSendToScheduler(replacements, timeStart, timeEnd)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleConfirmSend() {
    setSubmitting(true)
    try {
      await onSendToScheduler(replacements, timeStart, timeEnd)
    } finally {
      setSubmitting(false)
      setShowWarning(false)
    }
  }

  // Distinct clashing installer names — passed to the scheduler notification.
  const clashNames = [...new Set(clashes.map(c => c.installer.name))]

  // "Push Anyways" — force the job onto the schedule despite the unresolved clash
  // (e.g. a whole-day floater installer with no fixed time).
  async function handlePushAnyways() {
    setSubmitting(true)
    try {
      await onSendToScheduler(replacements, timeStart, timeEnd)
    } finally {
      setSubmitting(false)
    }
  }

  // "Notify Scheduler" — leave the job pending and flag the scheduler to resolve.
  async function handleNotifyScheduler() {
    setSubmitting(true)
    try {
      await onNotifyScheduler(clashNames)
    } finally {
      setSubmitting(false)
    }
  }

  const timeLabel = [fmtTime(jobTimeStart), fmtTime(jobTimeEnd)].filter(Boolean).join(' – ')

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onCancel} aria-hidden="true" />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-md bg-paper rounded-card border border-line shadow-xl flex flex-col max-h-[85vh]">

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">

            {/* Header */}
            <div>
              <h2 className="font-display text-lg font-semibold text-ink">
                {clashes.length > 0
                  ? `${clashes.length} clash${clashes.length !== 1 ? 'es' : ''} need attention`
                  : 'Review before sending'}
              </h2>
              <p className="mt-1 text-xs text-muted">
                {fmtDate(jobDate)}{timeLabel ? ` · ${timeLabel}` : ''}
              </p>
            </div>

            {/* Travel warning banner */}
            {travelWarnings.length > 0 && (
              <div className="rounded-lg border border-brand-amber bg-brand-amber/10 px-4 py-3 space-y-1">
                <p className="text-xs font-semibold uppercase tracking-widest text-brand-amber">
                  Travel time heads-up
                </p>
                {travelWarnings.map(w => {
                  const t = [fmtTime(w.conflictingJob.timeStart), fmtTime(w.conflictingJob.timeEnd)].filter(Boolean).join('–')
                  return (
                    <p key={w.installer.id} className="text-sm text-ink">
                      <span className="font-semibold">{w.installer.name}</span>
                      {' has a back-to-back job with '}
                      <span className="font-semibold">{w.conflictingJob.client}</span>
                      {t ? ` (${t})` : ''}
                      {'. Are you sure they can make it in time?'}
                    </p>
                  )
                })}
              </div>
            )}

            {/* Soft heads-up — a whole-day / no-fixed-time floater. Non-blocking. */}
            {softClashes.length > 0 && (
              <div className="rounded-lg border border-brand-amber bg-brand-amber/10 px-4 py-3 space-y-1">
                <p className="text-xs font-semibold uppercase tracking-widest text-brand-amber">
                  Heads-up
                </p>
                {softClashes.map(w => (
                  <p key={w.installer.id} className="text-sm text-ink">
                    <span className="font-semibold">{w.installer.name}</span>
                    {' already has an all-day job with '}
                    <span className="font-semibold">{w.conflictingJob.client}</span>
                    {' (no fixed time). Are you sure they can take this on?'}
                  </p>
                ))}
              </div>
            )}

            {/* Clash cards */}
            {clashes.map(clash => {
              const selected = replacements[clash.installer.id]
              const resolvedByTime = !clashActive(clash)
              const conflictTime = [
                fmtTime(clash.conflictingJob.timeStart),
                fmtTime(clash.conflictingJob.timeEnd),
              ].filter(Boolean).join('–')

              return (
                <div key={clash.installer.id} className="rounded-lg border border-line bg-bg overflow-hidden">
                  {/* Clash header */}
                  <div className="flex items-start gap-2 px-4 py-3 border-b border-line">
                    <AlertCircle size={15} className="text-terracotta mt-0.5 shrink-0" />
                    <p className="text-sm text-ink">
                      <span className="font-semibold">{clash.installer.name}</span>
                      {' is double-booked — busy with '}
                      <span className="font-semibold">{clash.conflictingJob.client}</span>
                      {conflictTime ? ` (${conflictTime})` : ''}.
                    </p>
                  </div>

                  {/* Resolved by time shift — no substitute needed */}
                  {resolvedByTime && (
                    <div className="px-4 py-2 bg-brand-green/10 border-b border-line text-xs font-medium text-brand-green">
                      Resolved — the new time no longer overlaps this job.
                    </div>
                  )}

                  {/* Substitute label */}
                  <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted">
                    Choose a substitute
                  </p>

                  {/* Substitute rows */}
                  {substitutes.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-muted">No available substitutes</p>
                  ) : (
                    substitutes.map(sub => {
                      const isSelected = selected === sub.id
                      const m = buildUserMeta({ role: sub.role, subrole: sub.subrole,
                        is_driver: sub.isDriver, qualifications: sub.qualifications })
                      const meta = [
                        m.subroleLine ? m.subroleLine.charAt(0).toUpperCase() + m.subroleLine.slice(1) : null,
                        m.isDriver ? 'Driver' : null,
                        ...m.qualifications,
                      ].filter(Boolean).join(' · ')

                      return (
                        <button
                          key={sub.id}
                          onClick={() => setReplacements(prev => ({ ...prev, [clash.installer.id]: sub.id }))}
                          className={cn(
                            'w-full flex items-center gap-3 px-4 py-3 border-t border-line text-left transition-colors',
                            isSelected ? 'bg-brand-green/10' : 'hover:bg-line/30',
                          )}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className={cn('text-sm font-medium', isSelected ? 'text-brand-green' : 'text-ink')}>
                                Replace with: {sub.name}
                              </p>
                              {sub.hasConflict ? (
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-brand-amber bg-brand-amber/10 px-1.5 py-0.5 rounded">
                                  Conflict
                                </span>
                              ) : (
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-brand-green bg-brand-green/10 px-1.5 py-0.5 rounded">
                                  Free
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted mt-0.5 truncate">{meta}</p>
                          </div>
                          <ChevronRight size={14} className={cn('shrink-0', isSelected ? 'text-brand-green' : 'text-muted')} />
                        </button>
                      )
                    })
                  )}

                  {/* Keep anyway — stages choice silently */}
                  <button
                    onClick={() => setReplacements(prev => ({ ...prev, [clash.installer.id]: 'keep' }))}
                    className={cn(
                      'w-full px-4 py-3 border-t border-line text-sm text-left transition-colors',
                      replacements[clash.installer.id] === 'keep'
                        ? 'text-ink font-medium bg-line/40'
                        : 'text-muted hover:text-ink',
                    )}
                  >
                    Keep anyway ({clash.installer.name})
                  </button>
                </div>
              )
            })}

            {/* Time shift */}
            <div>
              <div className="flex items-center gap-3 my-3">
                <div className="flex-1 h-px bg-line" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted whitespace-nowrap">
                  Or shift the whole job to a different time
                </span>
                <div className="flex-1 h-px bg-line" />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-[10px] font-medium uppercase tracking-wide text-muted mb-1">Start time</label>
                  <TimeSelect value={timeStart} onChange={setTimeStart} />
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] font-medium uppercase tracking-wide text-muted mb-1">End time</label>
                  <TimeSelect value={timeEnd} onChange={setTimeEnd} />
                </div>
              </div>
            </div>

            {/* Team workload chart */}
            <div>
              <div className="flex items-center gap-3 my-3">
                <div className="flex-1 h-px bg-line" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted whitespace-nowrap">
                  Team workload
                </span>
                <div className="flex-1 h-px bg-line" />
              </div>
              <WeekWorkloadChart initialWeekDays={weekDays} jobDate={jobDate} />
            </div>

          </div>

          {/* Footer */}
          <div className="border-t border-line px-5 py-4 space-y-3">
            {unresolvedCount > 0 && (
              <p className="text-center text-xs font-medium text-brand-amber">
                {unresolvedCount} unresolved
              </p>
            )}
            <div className="flex gap-2">
              <Btn variant="secondary" size="sm" onClick={onCancel} disabled={submitting} className="flex-1">
                Cancel
              </Btn>
              <Btn
                variant="primary"
                size="sm"
                onClick={handleSend}
                disabled={!allResolved || submitting}
                className="flex-1 flex items-center justify-center gap-1.5"
              >
                <Send size={13} />
                Push to Schedule
              </Btn>
            </div>

            {/* Override options — shown while a clash is still unresolved
                (e.g. a whole-day floater installer with no fixed time). */}
            {unresolvedCount > 0 && (
              <>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-line" />
                  <span className="text-[10px] text-muted whitespace-nowrap">or</span>
                  <div className="flex-1 h-px bg-line" />
                </div>
                <div className="flex gap-2">
                  <Btn
                    variant="secondary"
                    size="sm"
                    onClick={handleNotifyScheduler}
                    disabled={submitting}
                    className="flex-1 border-brand-amber/40 text-amber-700"
                  >
                    Notify Scheduler
                  </Btn>
                  <Btn
                    variant="secondary"
                    size="sm"
                    onClick={handlePushAnyways}
                    disabled={submitting}
                    className="flex-1"
                  >
                    Push Anyways
                  </Btn>
                </div>
                <p className="text-center text-[11px] text-muted leading-snug">
                  Notify Scheduler keeps the job pending and asks them to sort the clash.
                  Push Anyways schedules it now.
                </p>
              </>
            )}
          </div>

        </div>
      </div>

      {/* Warning prompt — shown when Push to Schedule is clicked with keeps */}
      {showWarning && (
        <>
          <div className="fixed inset-0 z-[60] bg-black/40" aria-hidden="true" />
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none">
            <div className="pointer-events-auto w-full max-w-sm bg-paper rounded-card border border-line shadow-xl p-6 space-y-4 text-center">
              <p className="font-display text-base font-semibold text-ink">Double-booked installer</p>
              <p className="text-sm text-muted">
                You&apos;re keeping an installer who&apos;s already booked at that time. Push to the schedule anyway?
              </p>
              <div className="flex gap-2 justify-center">
                <Btn variant="secondary" size="sm" onClick={() => setShowWarning(false)} disabled={submitting}>
                  Cancel
                </Btn>
                <Btn variant="primary" size="sm" onClick={handleConfirmSend} disabled={submitting}>
                  {submitting ? 'Sending…' : 'OK'}
                </Btn>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
