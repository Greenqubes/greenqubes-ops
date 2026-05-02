import Link from 'next/link'
import { MapPin, Users } from 'lucide-react'
import { Pill } from '@/components/Pill'
import { cn } from '@/lib/utils/cn'
import type { ScheduleJob } from '@/lib/supabase/queries/jobs'
import { fmtTime, isOverdue } from './utils'

interface JobRowProps {
  job: ScheduleJob
}

export function JobRow({ job }: JobRowProps) {
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

  return (
    <Link href={`/jobs/${job.id}`} className="block mb-2 group">
      <div
        className={cn(
          'rounded-card border p-4 transition-all group-hover:brightness-95',
          isDraft    ? 'border-dashed'           : 'border-line',
          overdue    ? 'border-terracotta bg-terracotta-soft'
                     : isCompleted ? 'bg-paper opacity-70'
                                   : 'bg-paper',
          overdue && 'border-solid'
        )}
      >
        <div className="flex gap-3">
          {/* Punctuality bar */}
          <div className={cn(
            'w-1.5 shrink-0 rounded-full self-stretch',
            job.punctuality === 'strict' ? 'bg-terracotta' : 'bg-brand-blue'
          )} />

          <div className="flex-1 min-w-0">
            {/* Client + time */}
            <div className="flex justify-between items-baseline gap-2 mb-1">
              <span className="font-display text-base font-medium text-ink truncate leading-snug">
                {job.client}
              </span>
              {timeRange && (
                <span className="text-xs font-medium text-ink2 shrink-0">{timeRange}</span>
              )}
            </div>

            {/* Description */}
            {job.description && (
              <p className="text-sm text-ink2 leading-snug mb-2 line-clamp-1">
                {job.description}
              </p>
            )}

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="flex items-center gap-1 text-xs text-muted">
                <MapPin size={11} />
                <span className="truncate max-w-[150px]">{job.location}</span>
              </span>

              {installerNames && (
                <span className="flex items-center gap-1 text-xs text-muted">
                  <Users size={11} />
                  {installerNames}
                </span>
              )}

              {job.production_ready && (
                <span className="text-xs font-medium text-brand-green">production ✓</span>
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
