'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { MapPin, Users, Check } from 'lucide-react'
import { Pill } from '@/components/Pill'
import { cn } from '@/lib/utils/cn'
import type { ScheduleJob } from '@/lib/supabase/queries/jobs'
import { fmtTime, isOverdue } from './utils'

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

  const installerNames = job.job_assignees
    .map(a => a.users?.name.split(' ')[0])
    .filter(Boolean)
    .join(', ')

  const timeRange = [fmtTime(job.time_start), fmtTime(job.time_end)]
    .filter(Boolean)
    .join(' – ')

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
        <Link
          href={`/jobs/${job.id}`}
          className="flex-1 block group"
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
                job.punctuality === 'strict' ? 'bg-[#D14545]' : 'bg-brand-blue'
              )} />

              <div className="flex-1 min-w-0">
                {/* Client + time / job day */}
                <div className="flex justify-between items-start gap-2 mb-1">
                  <span className="font-display text-base font-medium text-ink truncate leading-snug">
                    {job.project_title || job.client}
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

                  {installerNames && (
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
