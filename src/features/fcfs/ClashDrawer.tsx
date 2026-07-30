'use client'

import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { t } from '@/lib/i18n'
import { fmtTime } from '@/features/schedule/utils'
import type { InstallerClash } from '@/lib/utils/clash-detection'
import type { FCFSJob } from '@/lib/supabase/queries/fcfs'
import type { LangCode } from '@/lib/i18n'

// Bottom sheet opened from the toolbar clash chips: each clash shows the two
// jobs side by side — earlier FCFS rank has priority — with a shortcut to
// re-assign the later job and a session-local Dismiss.

interface ClashDrawerProps {
  isOpen:    boolean
  clashes:   InstallerClash[]
  lang:      LangCode
  onClose:   () => void
  onOpenJob: (jobId: string) => void
  onDismiss: (clash: InstallerClash) => void
}

function JobCard({ job, label, first, lang }: { job: FCFSJob; label: string; first: boolean; lang: LangCode }) {
  return (
    <div className={cn(
      'rounded-[10px] border p-3 flex-1 min-w-0',
      first ? 'border-brand-green' : 'border-terracotta',
    )}>
      <p className={cn(
        'text-[11px] font-bold mb-0.5',
        first ? 'text-brand-green' : 'text-terracotta',
      )}>{label}</p>
      <p className="text-xs font-semibold text-ink truncate">
        #{job.fcfs_rank} {job.project_title || job.client}
      </p>
      <p className="text-xs text-ink2 truncate">{job.client}</p>
      <p className="text-xs text-ink2">
        {job.time_start
          ? `${fmtTime(job.time_start)}${job.time_end ? `–${fmtTime(job.time_end)}` : ''}`
          : t(lang, 'fcfsAllDay')}
      </p>
    </div>
  )
}

export function ClashDrawer({ isOpen, clashes, lang, onClose, onOpenJob, onDismiss }: ClashDrawerProps) {
  if (!isOpen) return null

  return (
    // z-[60]: overlays must layer above the BottomNav (z-50) — hard rule.
    <div className="fixed inset-0 z-[60] flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" />
      <div
        className="relative w-full bg-paper border-t border-line rounded-t-2xl p-5 max-h-[80vh] overflow-y-auto pb-[max(env(safe-area-inset-bottom),20px)]"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="font-display text-base font-medium text-ink mb-4">
          {t(lang, 'fcfsClashDrawerTitle')}
        </h3>

        {clashes.length === 0 && (
          <p className="text-sm text-muted py-6 text-center">{t(lang, 'fcfsNoClashes')}</p>
        )}

        <div className="flex flex-col gap-5">
          {clashes.map(c => (
            <div key={`${c.installerId}-${c.jobA.id}-${c.jobB.id}`}>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={13} className={c.severity === 'hard' ? 'text-bad' : 'text-brand-amber'} />
                <p className={cn(
                  'text-sm font-semibold',
                  c.severity === 'hard' ? 'text-bad' : 'text-brand-amber',
                )}>
                  {c.installerName} — {t(lang, c.severity === 'hard' ? 'fcfsHardClashTitle' : 'fcfsSoftClashTitle')}
                </p>
              </div>

              <div className="flex gap-3 mb-3">
                <JobCard job={c.jobA} label={t(lang, 'fcfsCreatedFirst')} first lang={lang} />
                <JobCard job={c.jobB} label={t(lang, 'fcfsCreatedSecond')} first={false} lang={lang} />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => onOpenJob(c.jobB.id)}
                  className="flex-1 px-4 py-2 rounded-[10px] bg-terracotta text-white text-sm font-semibold"
                >
                  {t(lang, 'fcfsReassign')} #{c.jobB.fcfs_rank}
                </button>
                <button
                  onClick={() => onDismiss(c)}
                  className="px-4 py-2 rounded-[10px] border border-line text-sm font-medium text-ink2"
                >
                  {t(lang, 'fcfsDismiss')}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
