'use client'

import { useState } from 'react'
import { ChevronRight, AlertCircle, Send } from 'lucide-react'
import { Btn } from '@/components/Btn'
import { cn } from '@/lib/utils/cn'
import type { Clash, Substitute } from '@/app/api/jobs/[id]/clashes/route'
import type { LangCode } from '@/lib/i18n'

interface Props {
  jobDate:           string
  jobTimeStart:      string | null
  jobTimeEnd:        string | null
  clashes:           Clash[]
  substitutes:       Substitute[]
  lang:              LangCode
  onSendToScheduler: (replacements: Record<string, string | 'keep'>, timeStart: string, timeEnd: string) => Promise<void>
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

export function ClashResolutionModal({
  jobDate, jobTimeStart, jobTimeEnd,
  clashes, substitutes,
  onSendToScheduler, onCancel,
}: Props) {
  const [replacements, setReplacements] = useState<Record<string, string | 'keep'>>({})
  const [timeStart, setTimeStart] = useState(toInputTime(jobTimeStart))
  const [timeEnd,   setTimeEnd]   = useState(toInputTime(jobTimeEnd))
  const [submitting,    setSubmitting]    = useState(false)
  const [showWarning,   setShowWarning]   = useState(false)

  const unresolvedCount = clashes.filter(c => replacements[c.installer.id] === undefined).length
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
                {clashes.length} clash{clashes.length !== 1 ? 'es' : ''} need attention
              </h2>
              <p className="mt-1 text-xs text-muted">
                {fmtDate(jobDate)}{timeLabel ? ` · ${timeLabel}` : ''}
              </p>
            </div>

            {/* Clash cards */}
            {clashes.map(clash => {
              const selected = replacements[clash.installer.id]
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
                      const meta = [
                        sub.role.charAt(0).toUpperCase() + sub.role.slice(1),
                        sub.yearsExperience != null ? `${sub.yearsExperience}y` : 'N/A',
                        sub.skills.length > 0 ? sub.skills.join(', ') : 'N/A',
                      ].join(' · ')

                      return (
                        <button
                          key={sub.id}
                          onClick={() => setReplacements(prev => ({ ...prev, [clash.installer.id]: sub.id }))}
                          className={cn(
                            'w-full flex items-center gap-3 px-4 py-3 border-t border-line text-left transition-colors',
                            isSelected ? 'bg-green/10' : 'hover:bg-line/30',
                          )}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className={cn('text-sm font-medium', isSelected ? 'text-green' : 'text-ink')}>
                                Replace with: {sub.name}
                              </p>
                              {sub.hasConflict ? (
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-amber bg-amber/10 px-1.5 py-0.5 rounded">
                                  Conflict
                                </span>
                              ) : (
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-green bg-green/10 px-1.5 py-0.5 rounded">
                                  Free
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted mt-0.5 truncate">{meta}</p>
                          </div>
                          <ChevronRight size={14} className={cn('shrink-0', isSelected ? 'text-green' : 'text-muted')} />
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
                  <input
                    type="time"
                    value={timeStart}
                    onChange={e => setTimeStart(e.target.value)}
                    className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink focus:outline-none focus:border-ink2"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] font-medium uppercase tracking-wide text-muted mb-1">End time</label>
                  <input
                    type="time"
                    value={timeEnd}
                    onChange={e => setTimeEnd(e.target.value)}
                    className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink focus:outline-none focus:border-ink2"
                  />
                </div>
              </div>
            </div>

          </div>

          {/* Footer */}
          <div className="border-t border-line px-5 py-4 space-y-3">
            {unresolvedCount > 0 && (
              <p className="text-center text-xs font-medium text-amber">
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
                Send to scheduler
              </Btn>
            </div>
          </div>

        </div>
      </div>

      {/* Warning prompt — shown when Send to scheduler is clicked with keeps */}
      {showWarning && (
        <>
          <div className="fixed inset-0 z-[60] bg-black/40" aria-hidden="true" />
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none">
            <div className="pointer-events-auto w-full max-w-sm bg-paper rounded-card border border-line shadow-xl p-6 space-y-4 text-center">
              <p className="font-display text-base font-semibold text-ink">Push to Scheduler!</p>
              <p className="text-sm text-muted">
                Please check directly with the Scheduler for approval.
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
