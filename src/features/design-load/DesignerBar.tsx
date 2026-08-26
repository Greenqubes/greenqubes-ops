'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils/cn'
import { t } from '@/lib/i18n'
import { URGENCY_META } from '@/lib/utils/design-urgency'
import type { UrgencyLevel } from '@/lib/utils/design-urgency'
import type { DesignLoadJob } from '@/lib/supabase/queries/design-load'
import type { LangCode } from '@/lib/i18n'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] // always English (CLAUDE.md hard rule)

// '2026-08-13' → '13/08 (Thu)' — static table, never toLocaleDateString (the
// locale formatters caused the /schedule hydration saga; never again).
// Mirrors NotificationDrawer's fmtOverdueDate.
export function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  const [, m, day] = iso.slice(0, 10).split('-')
  return `${day}/${m} (${DAYS[d.getDay()]})`
}

export type Segment = { job: DesignLoadJob; level: UrgencyLevel; height: number }

// Shared content layout for both the board bubble and the My Jobs row cards
// (spec: "row card reuses the bubble's content layout"). `job` accepts the
// wider MyDesignJob shape too — structural typing, no cast needed.
export function JobCardContent({ job, lang }: { job: DesignLoadJob; lang: LangCode }) {
  return (
    <div className="min-w-0">
      <p className="font-display text-sm font-semibold text-ink truncate">
        {job.projectTitle || t(lang, 'untitledJob')}
      </p>
      <p className="text-xs text-muted truncate">{job.client || 'Untitled'}</p>
      {job.pocName && (
        <p className="text-[11px] text-ink2 mt-1 truncate">{t(lang, 'salesPOC')}: {job.pocName}</p>
      )}
      <div className="flex flex-col gap-0.5 mt-1.5 text-[11px] text-ink2">
        <span>Install: {fmtDate(job.installDate)}</span>
        <span>Due: {fmtDate(job.dueDate)}</span>
        <span className="text-muted">Created: {fmtDate(job.createdAt)}</span>
      </div>
      {job.reason && (
        <p className="text-[11px] text-muted mt-1.5 italic line-clamp-2">{job.reason}</p>
      )}
      {job.confidence === 'low' && (
        <span className="inline-flex items-center gap-1 mt-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-brand-amber-soft text-brand-amber">
          {t(lang, 'lowConfidence')}
        </span>
      )}
    </div>
  )
}

interface DesignerBarProps {
  designer: { id: string; name: string; jobs: DesignLoadJob[] }
  segments: Segment[]
  lang:     LangCode
}

export function DesignerBar({ designer, segments, lang }: DesignerBarProps) {
  const router = useRouter()
  const [openJobId, setOpenJobId] = useState<string | null>(null)

  const openSegment = segments.find(s => s.job.jobId === openJobId) ?? null

  // First tap opens the bubble; a second tap on the same segment (or a
  // desktop click, which lands after hover already opened it) navigates.
  const handleSegmentClick = (jobId: string) => {
    if (openJobId === jobId) router.push(`/jobs/${jobId}`)
    else setOpenJobId(jobId)
  }

  // Data arrives newest-first (assignedAt DESC). The stack is bottom-aligned
  // via flex-col-reverse so the name label sits directly under it — with
  // that container reversal, the DOM order must be reversed too so the
  // newest job still ends up on top (segments newest-assigned on top).
  const stacked = [...segments].reverse()

  return (
    <div
      className="relative flex flex-col items-center shrink-0 w-14"
      onMouseLeave={() => setOpenJobId(null)}
    >
      {/* Tap-away backdrop (mobile) — closes the bubble without navigating
          through whatever sits underneath, including the bottom nav. */}
      {openJobId && (
        <div className="fixed inset-0 z-[59]" onClick={() => setOpenJobId(null)} />
      )}

      {segments.length === 0 ? (
        <div className="w-8 h-8 rounded border border-dashed border-line bg-muted/10" />
      ) : (
        <div className="flex flex-col-reverse gap-0.5 w-8">
          {stacked.map(seg => (
            <button
              key={seg.job.jobId}
              type="button"
              onMouseEnter={() => setOpenJobId(seg.job.jobId)}
              onClick={() => handleSegmentClick(seg.job.jobId)}
              className={cn('relative w-full rounded-[3px]', URGENCY_META[seg.level].barClass)}
              style={{ height: seg.height }}
              aria-label={seg.job.projectTitle || t(lang, 'untitledJob')}
            >
              {seg.job.confidence === 'low' && (
                <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-white ring-1 ring-ink/30" />
              )}
            </button>
          ))}
        </div>
      )}

      <p className="mt-1.5 text-[10px] font-medium text-ink2 text-center truncate w-full">
        {designer.name}
      </p>

      {openSegment && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-[60] w-56 rounded-card border border-line bg-paper shadow-lg p-3">
          <JobCardContent job={openSegment.job} lang={lang} />
          <button
            type="button"
            onClick={() => router.push(`/jobs/${openSegment.job.jobId}`)}
            className="mt-2 w-full py-1.5 rounded-md bg-brand-blue text-white text-xs font-semibold"
          >
            {t(lang, 'openJobBtn')}
          </button>
        </div>
      )}
    </div>
  )
}
