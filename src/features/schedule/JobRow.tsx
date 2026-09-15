'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { MapPin, Users, Check } from 'lucide-react'
import { Pill } from '@/components/Pill'
import { cn } from '@/lib/utils/cn'
import type { ScheduleJob } from '@/lib/supabase/queries/jobs'
import { splitCrew } from '@/lib/utils/job-card'
import { fmtTime, isOverdue } from './utils'

/** A crew member's name. Whole name, never a first name — see splitCrew. */
function NamePill({ name }: { name: string }) {
  return (
    <span className="inline-block rounded-full border border-line bg-bg px-2 py-[1px] text-[11px] font-medium text-ink2">
      {name}
    </span>
  )
}

function CrewLine({ label, names }: { label: string; names: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[12px] font-semibold text-ink">{label}</span>
      {names.length > 0
        ? names.map(n => <NamePill key={n} name={n} />)
        : <span className="text-[11px] italic text-muted">none</span>}
    </div>
  )
}

interface JobRowProps {
  job:          ScheduleJob
  currentDate?: string
  selectable?:  boolean
  selected?:    boolean
  onToggle?:    (id: string) => void
  deletable?:   boolean
  onDelete?:    () => void
}

function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86_400_000
  )
}

export function JobRow({ job, currentDate, selectable, selected, onToggle, deletable, onDelete }: JobRowProps) {
  const overdue       = isOverdue(job.status, job.date)
  const isDraft       = job.status === 'pending' || job.status === 'awaiting_approval'
  const isCompleted   = job.status === 'completed'

  const [confirmDelete, setConfirmDelete] = useState(false)
  const touchStartX = useRef<number | null>(null)

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return
    const delta = e.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    if (delta > 60 && deletable) setConfirmDelete(true)
  }

  // Compact meta row, installer views only. Kept on first names because that
  // row is a single tight line; the team card below uses whole names in pills
  // precisely because first names are ambiguous ("Ali B" and "Ali Ramjan"
  // both collapse to "Ali"; "Xiao Yi" becomes "Xiao").
  const installerNames = job.job_assignees
    .map(a => a.users?.name.split(' ')[0])
    .filter(Boolean)
    .join(', ')

  // Driver vs Support Crew — two separate lines on the card (Nic, 2026-09-15).
  const { drivers, support } = splitCrew(job.job_assignees)

  // Sales / Coordinator / Installer lines (Nic, 2026-08-19). Only when the
  // feeding query loaded team fields — installer views pass InstallerJob rows
  // without them (and keep the compact first-names meta row instead).
  const hasTeamInfo = job.sales_name !== undefined || job.job_coordinators !== undefined
  const coordinatorNames = (job.job_coordinators ?? [])
    .map(c => c.users?.name)
    .filter(Boolean)
    .join(', ')
  // No time set = whole-day floater — say so instead of leaving a blank
  // (matches the FCFS board's "All day" bars).
  const timeRange = [fmtTime(job.time_start), fmtTime(job.time_end)]
    .filter(Boolean)
    .join(' – ') || 'All day'

  const jobDayLabel = (() => {
    if (!job.date_end || job.date_end <= job.date || !currentDate) return null
    const total = daysBetween(job.date, job.date_end) + 1
    const day   = daysBetween(job.date, currentDate) + 1
    return `${day}/${total}`
  })()

  return (
    <>
      <div className="flex items-start gap-2 mb-2">
        {selectable && (
          <button
            type="button"
            onClick={() => onToggle?.(job.id)}
            className="mt-3 shrink-0 w-5 h-5 rounded border-2 hidden md:flex items-center justify-center transition-colors"
            style={{
              borderColor: selected ? 'var(--terracotta)' : 'var(--line)',
              backgroundColor: selected ? 'var(--terracotta)' : 'var(--paper)',
            }}
          >
            {selected && <Check size={11} className="text-white" strokeWidth={3} />}
          </button>
        )}
        {/* min-w-0: a flex item's min-width defaults to its content, so a
            long nowrap title inflates the whole card past the phone screen
            (sideways scroll + pinch-zoom-out). Keeps the card at row width. */}
        <Link
          href={`/jobs/${job.id}`}
          className="flex-1 min-w-0 block group"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div
            className={cn(
              'rounded-card border p-4 transition-all group-hover:brightness-95',
              isDraft    ? 'border-dashed'           : 'border-line',
              overdue    ? 'border-bad bg-bad-soft'
                         : isCompleted ? 'bg-paper opacity-70'
                                       : 'bg-paper',
              overdue && 'border-solid'
            )}
          >
            <div className="flex gap-3">
              {/* Punctuality bar */}
              <div className={cn(
                'w-1.5 shrink-0 rounded-full self-stretch',
                job.punctuality === 'strict' ? 'bg-punct-strict' : 'bg-punct-flex'
              )} />

              {hasTeamInfo ? (
                /* Team card, rebuilt to Nic's sketch (2026-09-15): title,
                   description over two lines, the FULL address, and Support
                   Crew on the left; time and the people in a column on the
                   right. The address was previously truncated at 150px, so
                   the unit number and postcode Google Places fills in were
                   saved and then hidden. */
                <div className="flex-1 min-w-0 flex gap-3">
                  <div className="flex-1 min-w-0 space-y-1.5">
                    {/* break-words on all three: line-clamp hides overflow but
                        cannot WRAP an unbroken string, so a pasted run of
                        characters with no spaces pushed straight through the
                        card and over the crew column (Nic, 2026-09-15). */}
                    <h3 className="font-display text-[17px] font-semibold text-ink leading-tight line-clamp-2 break-words">
                      {job.project_title || job.client || 'Untitled job'}
                    </h3>

                    {/* Two lines, then "…" — Nic's call. */}
                    {job.description && (
                      <p className="text-[13px] text-ink2 leading-snug line-clamp-2 break-words">
                        {job.description}
                      </p>
                    )}

                    {/* The address wraps freely onto a second and third line.
                        It is deliberately NOT clamped at two: cutting this
                        field off is the bug this card exists to fix, and a
                        full Singapore address with unit number and postcode
                        needs three lines in the narrowest column. Three is
                        far more than any real address and only stops junk
                        data stretching the card. */}
                    <p className="flex items-start gap-1 text-[12px] font-semibold text-ink leading-snug">
                      <MapPin size={12} className="mt-[2px] shrink-0 text-muted" />
                      <span className="min-w-0 line-clamp-3 break-words">{job.location || '—'}</span>
                    </p>

                    <CrewLine label="Support Crew:" names={support} />

                    {(job.production_ready || job.do_issued) && (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5">
                        {job.production_ready && (
                          <span className="text-xs font-medium text-brand-green">Production ✓</span>
                        )}
                        {job.do_issued && (
                          <span className="text-xs font-medium text-brand-green">DO ✓</span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="w-[150px] shrink-0 border-l border-line pl-3 flex flex-col gap-1.5">
                    <div>
                      <span className="block text-[9px] uppercase tracking-wide text-muted leading-none">Time</span>
                      <span className="block text-[15px] font-semibold text-ink leading-tight">{timeRange}</span>
                    </div>
                    {jobDayLabel && (
                      <div>
                        <span className="block text-[9px] uppercase tracking-wide text-muted leading-none">Job Day</span>
                        <span className="block text-[13px] font-medium text-ink2 leading-tight">{jobDayLabel}</span>
                      </div>
                    )}
                    <p className="text-[11.5px] text-muted leading-tight break-words">
                      Sales: <span className="font-medium text-ink2">{job.sales_name || 'NIL'}</span>
                    </p>
                    <p className="text-[11.5px] text-muted leading-tight break-words">
                      Coordinator: <span className="font-medium text-ink2">{coordinatorNames || 'NIL'}</span>
                    </p>
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-[11.5px] text-muted">Driver:</span>
                      {drivers.length > 0
                        ? drivers.map(n => <NamePill key={n} name={n} />)
                        : <span className="text-[11px] italic text-muted">nobody yet</span>}
                    </div>
                    {/* The status pill lives here for EVERY status, not just
                        the exceptions — bottom-right, where Overdue already
                        sat (Nic, 2026-09-15). Scheduled now shows too; it
                        used to be hidden on the grounds that everything on
                        the schedule tab is scheduled, but the same card is
                        reused on Pending and Completed, so one fixed place
                        for "what state is this job in" reads better than a
                        pill that appears only sometimes. Overdue still wins,
                        since it is the more urgent fact about a scheduled
                        job. */}
                    <div className="mt-auto flex justify-end pt-1">
                      <Pill variant={overdue ? 'overdue' : job.status} />
                    </div>
                  </div>
                </div>
              ) : (
              <div className="flex-1 min-w-0">
                {/* Client + time / job day */}
                <div className="flex justify-between items-start gap-2 mb-1">
                  <span className="font-display text-base font-medium text-ink truncate leading-snug">
                    {job.project_title || job.client || 'Untitled job'}
                  </span>
                  {(timeRange || jobDayLabel) && (
                    <div className="flex flex-col items-end shrink-0 gap-0.5">
                      {timeRange && (
                        <>
                          <span className="text-[9px] text-muted uppercase tracking-wide leading-none">Job Time:</span>
                          <span className="text-[15px] font-medium text-ink2 leading-none">{timeRange}</span>
                        </>
                      )}
                      {jobDayLabel && (
                        <>
                          <span className="text-[9px] text-muted uppercase tracking-wide leading-none mt-1">Job Day:</span>
                          <span className="text-[15px] font-medium text-ink2 leading-none">{jobDayLabel}</span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Description */}
                {job.description && (
                  <p className="text-[13px] text-ink2 leading-snug mb-2 line-clamp-1">
                    {job.description}
                  </p>
                )}

                {/* Meta row */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="flex items-center gap-1 text-[11px] text-muted">
                    <MapPin size={11} />
                    <span className="truncate max-w-[150px]">{job.location}</span>
                  </span>

                  {!hasTeamInfo && installerNames && (
                    <span className="flex items-center gap-1 text-[11px] text-muted">
                      <Users size={11} />
                      {installerNames}
                    </span>
                  )}

                  {job.production_ready && (
                    <span className="text-xs font-medium text-brand-green">Production ✓</span>
                  )}
                  {job.do_issued && (
                    <span className="text-xs font-medium text-brand-green">DO ✓</span>
                  )}

                  {overdue && <Pill variant="overdue" />}
                  {!overdue && job.status !== 'scheduled' && (
                    <Pill variant={job.status} />
                  )}
                </div>

              </div>
              )}
            </div>
          </div>
        </Link>
      </div>

      {/* Swipe-to-delete confirmation modal */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-ink/40"
          onClick={() => setConfirmDelete(false)}
        >
          <div
            className="w-full max-w-xs bg-paper rounded-2xl border border-line p-6 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <p className="font-display text-base font-medium text-ink text-center">Delete this job?</p>
            <p className="text-sm text-muted text-center">This can&apos;t be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 py-2.5 rounded-xl border border-line text-sm font-medium text-ink2 hover:border-ink2 transition-colors"
              >
                No
              </button>
              <button
                onClick={() => { setConfirmDelete(false); onDelete?.() }}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white transition-colors"
                style={{ backgroundColor: 'var(--terracotta)' }}
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
