import Link from 'next/link'
import { MapPin, Users } from 'lucide-react'
import { Pill } from '@/components/Pill'
import { cn } from '@/lib/utils/cn'
import type { ScheduleJob } from '@/lib/supabase/queries/jobs'
import { fmtTime, isOverdue } from './utils'

interface JobRowProps {
  job:         ScheduleJob
  currentDate?: string
}

function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86_400_000
  )
}

export function JobRow({ job, currentDate }: JobRowProps) {
  const overdue       = isOverdue(job.status, job.date)
  const isDraft       = job.status === 'pending' || job.status === 'awaiting_approval'
  const isCompleted   = job.status === 'completed'

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
    <Link href={`/jobs/${job.id}`} className="block mb-2 group">
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
  )
}
