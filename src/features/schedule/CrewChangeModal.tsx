'use client'

import { useEffect, useState } from 'react'
import { X, AlertTriangle } from 'lucide-react'
import { Btn } from '@/components/Btn'
import { cn } from '@/lib/utils/cn'
import { MIXED, UNASSIGNED, landingBand, driverBandId, externalBandId, type DragPlan, type DriverRef } from '@/lib/utils/driver-board'

interface Props {
  plan:        DragPlan
  job:         { id: string; title: string }
  drivers:     DriverRef[]
  supportPool: DriverRef[]
  /** Confirmed outside contractors already on the job. A drag never adds or
   *  removes these — they are here so the "lands in" line tells the truth. */
  externals:   DriverRef[]
  onClose:     () => void
  onSaved:     () => void
}

type ClashReport = {
  hasClash: boolean
  clashes:      Array<{ installerName: string; severity: 'hard' | 'soft'; conflict: { projectTitle: string | null; client: string } }>
  leaveClashes: Array<{ installerName: string; dates: string }>
}

/**
 * The prompt a drag must pass. Nic's rules, 2026-09-15/16:
 *   • it ALWAYS asks, even when there is no support crew to ask about —
 *     no silent drags
 *   • the clash check runs on CONFIRM, not on drop: dragging a card over a
 *     driver is not a decision yet and must not throw warnings mid-shuffle
 *   • cancel at any point and nothing was written, no message sent, card
 *     snaps back
 *
 * z-[60]: BottomNav is z-50 and nothing interactive may sit behind it
 * (CLAUDE.md hard rule).
 */
export function CrewChangeModal({ plan, job, drivers, supportPool, externals, onClose, onSaved }: Props) {
  const externalIds   = externals.map(e => e.id)
  const externalNames = externals.map(e => e.name)

  const [driverIds,  setDriverIds]  = useState<string[]>(plan.driverIds)
  const [supportIds, setSupportIds] = useState<string[]>(plan.supportIds)
  const [checking,   setChecking]   = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [report,     setReport]     = useState<ClashReport | null>(null)
  const [error,      setError]      = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const toggle = (list: string[], set: (v: string[]) => void, id: string) =>
    set(list.includes(id) ? list.filter(x => x !== id) : [...list, id])

  // Where the card will ACTUALLY land, externals included. A job dragged to
  // Unassigned that still has an outside contractor on it does NOT become
  // unassigned — this route clears internal crew only, so it falls into that
  // external's container. The label has to say so, or the scheduler is told
  // something untrue about a drag they are about to confirm.
  const landing = landingBand(driverIds, externalIds)
  const landingLabel =
    landing === UNASSIGNED ? 'Unassigned'
    : landing === MIXED    ? 'Mixed Drivers'
    : externalBandId(externalIds[0] ?? '') === landing
      ? `${externalNames[0] ?? 'an external installer'} (external)`
      : drivers.find(d => driverBandId(d.id) === landing)?.name ?? 'a driver'

  async function confirm() {
    setError(null)

    // Clash + leave check first, unless the job is being emptied — nobody can
    // clash with nobody.
    if (!report && driverIds.length > 0) {
      setChecking(true)
      try {
        const res = await fetch(`/api/jobs/${job.id}/assign-installers?checkOnly=true`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ installer_ids: driverIds }),
        })
        if (res.ok) {
          const data = await res.json() as ClashReport
          if (data.hasClash) { setReport(data); setChecking(false); return }
        }
      } catch {
        // A failed check must not block the scheduler — they are told, and
        // the save is still theirs to make.
        setError('Could not check for clashes. You can still save.')
      }
      setChecking(false)
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/jobs/${job.id}/crew`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ driver_ids: driverIds, support_ids: supportIds }),
      })
      // Read the response. fetch does not reject on an HTTP error, and a
      // swallowed failure is indistinguishable from success — the exact trap
      // that lost Nic's attachment on 2026-09-15.
      const data = await res.json().catch(() => ({})) as { error?: string }
      if (!res.ok) { setError(data.error ?? 'The change could not be saved.'); setSaving(false); return }
      onSaved()
    } catch {
      setError('The change could not be saved. Check your connection and try again.')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/45 p-0 sm:p-6" onClick={onClose}>
      <div
        className="w-full sm:max-w-md max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-line bg-paper p-5 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold text-ink leading-tight">Move this job</h2>
            <p className="text-[13px] text-ink2 truncate">{job.title}</p>
          </div>
          <button onClick={onClose} className="shrink-0 p-1 text-muted hover:text-ink"><X size={18} /></button>
        </div>

        {plan.destructive && (
          <div className="rounded-xl border border-bad bg-bad-soft p-3">
            <p className="text-[13px] font-semibold text-bad">This takes everyone off the job.</p>
            <p className="text-[12px] text-ink2 mt-0.5">
              The driver and all support crew are removed. The job stays on the schedule with nobody on it.
            </p>
          </div>
        )}

        {plan.removedDriverIds.length > 0 && !plan.destructive && (
          <p className="text-[13px] text-ink2">
            Coming off:{' '}
            <span className="font-semibold text-ink">
              {plan.removedDriverIds.map(id => drivers.find(d => d.id === id)?.name ?? 'someone').join(', ')}
            </span>
          </p>
        )}

        {/* Said out loud, never silently. The support crew belongs to the
            driver (Nic, 2026-09-16), so when the driver goes their helpers go
            too — "its a different team altogether". Emptying a list the
            scheduler had filled without a word would read as a bug. */}
        {plan.removedSupportIds.length > 0 && !plan.destructive && (
          <div className="rounded-xl border border-brand-amber bg-brand-amber-soft p-3">
            <p className="text-[13px] font-semibold text-brand-amber">
              The support crew comes off too
            </p>
            <p className="text-[12px] text-ink2 mt-0.5">
              {plan.removedSupportIds.map(id => supportPool.find(p => p.id === id)?.name ?? 'someone').join(', ')}
              {' '}rode with the driver this job is leaving. Pick who should support it now.
            </p>
          </div>
        )}

        {plan.askDrivers && (
          <div className="space-y-2">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">Drivers on this job</p>
            <div className="flex flex-wrap gap-2">
              {drivers.map(d => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => { toggle(driverIds, setDriverIds, d.id); setReport(null) }}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors',
                    driverIds.includes(d.id)
                      ? 'border-terracotta bg-terracotta text-white'
                      : 'border-line bg-bg text-ink2 hover:border-ink2',
                  )}
                >
                  {d.name}
                </button>
              ))}
            </div>
            <p className="text-[11.5px] text-muted">
              Pick one and it goes into that driver&apos;s own container instead.
            </p>
          </div>
        )}

        {plan.askSupport && (
          <div className="space-y-2">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">Support crew</p>
            {supportPool.length === 0 ? (
              <p className="text-[13px] italic text-muted">Nobody available.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {supportPool.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggle(supportIds, setSupportIds, p.id)}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors',
                      supportIds.includes(p.id)
                        ? 'border-brand-green bg-brand-green-soft text-brand-green'
                        : 'border-line bg-bg text-ink2 hover:border-ink2',
                    )}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
            <p className="text-[11.5px] text-muted">Tap to add or remove.</p>
          </div>
        )}

        {externalNames.length > 0 && (
          <p className="text-[12px] text-ink2">
            <span className="font-semibold text-ink">{externalNames.join(', ')}</span>
            {' '}stays on this job — outside contractors are changed on the job form, not here.
          </p>
        )}

        <p className="text-[13px] text-ink2">
          Lands in <span className="font-semibold text-ink">{landingLabel}</span>.
        </p>

        {report && (
          <div className="rounded-xl border border-bad bg-bad-soft p-3 space-y-1">
            <p className="flex items-center gap-1.5 text-[13px] font-semibold text-bad">
              <AlertTriangle size={14} /> Conflicts found
            </p>
            {report.clashes.map((c, i) => (
              <p key={`c${i}`} className="text-[12px] text-ink2">
                {c.installerName} is already on {c.conflict.projectTitle || c.conflict.client}
                {c.severity === 'hard' ? ' at the same time' : ' in an overlapping window'}.
              </p>
            ))}
            {report.leaveClashes.map((l, i) => (
              <p key={`l${i}`} className="text-[12px] text-ink2">{l.installerName} is on leave ({l.dates}).</p>
            ))}
            <p className="text-[12px] text-ink2 pt-1">Save anyway, or go back and pick someone else.</p>
          </div>
        )}

        {error && <p className="text-[13px] font-medium text-bad">{error}</p>}

        {/* Nobody is told about this now — the 6pm summary carries it. Said
            out loud so a scheduler never assumes a drag sent a message. */}
        <p className="text-[11.5px] text-muted">
          Nobody is messaged now — changes go out in the 6pm summary. Jobs dated today are sent straight away.
        </p>

        <div className="flex gap-3 pt-1">
          <Btn variant="secondary" onClick={onClose} className="flex-1">Cancel</Btn>
          <Btn onClick={confirm} disabled={checking || saving} className="flex-1">
            {checking ? 'Checking…' : saving ? 'Saving…' : report ? 'Save anyway' : 'Confirm'}
          </Btn>
        </div>
      </div>
    </div>
  )
}
