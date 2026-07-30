'use client'

import { AlertTriangle } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { cn } from '@/lib/utils/cn'
import { t } from '@/lib/i18n'
import { fmtTime } from '@/features/schedule/utils'
import type { LangCode } from '@/lib/i18n'
import type { Role } from '@/lib/supabase/types'

// Workflow V2 Task 19 (extended): warns when saving an already-scheduled job
// would double-book an installer — the gap deferred from Phase 1, where the
// clash check only ran at push time. Options depend on who is saving:
//   coordinator          → Alert Scheduler (save + Telegram schedulers) / Re-assign
//   scheduler / admin    → Save Anyway / Go Back (they resolve clashes themselves)

export interface CheckClash {
  installerId:   string
  installerName: string
  severity:      'hard' | 'soft'
  conflict: {
    jobId:        string
    projectTitle: string | null
    client:       string
    timeStart:    string | null
    timeEnd:      string | null
  }
}

interface EditClashModalProps {
  isOpen:           boolean
  clashes:          CheckClash[]
  role:             Role
  lang:             LangCode
  onAlertScheduler: () => void
  onProceed:        () => void
  onClose:          () => void
}

export function EditClashModal({
  isOpen, clashes, role, lang, onAlertScheduler, onProceed, onClose,
}: EditClashModalProps) {
  const isCoordinator = role === 'coordinator'

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t(lang, 'fcfsClashDetected')}>
      <div className="flex flex-col gap-2 mb-5">
        {clashes.map((c, i) => (
          <div key={`${c.installerId}-${c.conflict.jobId}-${i}`} className="border border-line rounded-[10px] p-3">
            <div className="flex items-center gap-2">
              <AlertTriangle size={13} className={c.severity === 'hard' ? 'text-bad' : 'text-brand-amber'} />
              <p className="text-sm font-semibold text-ink">{c.installerName}</p>
              <span className={cn(
                'text-[10px] font-semibold px-1.5 py-0.5 rounded-full ml-auto',
                c.severity === 'hard' ? 'bg-bad-soft text-bad' : 'bg-brand-amber-soft text-brand-amber',
              )}>
                {t(lang, c.severity === 'hard' ? 'fcfsHardChip' : 'fcfsSoftChip')}
              </span>
            </div>
            <p className="text-xs text-ink2 mt-1.5">
              {t(lang, 'fcfsAlreadyAssigned')}{' '}
              <strong>{c.conflict.projectTitle || c.conflict.client}</strong>
              {c.conflict.timeStart && (
                <> · {fmtTime(c.conflict.timeStart)}{c.conflict.timeEnd ? `–${fmtTime(c.conflict.timeEnd)}` : ''}</>
              )}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {isCoordinator ? (
          <>
            <button
              onClick={onAlertScheduler}
              className="w-full px-4 py-2.5 rounded-[10px] bg-terracotta text-white text-sm font-semibold"
            >
              {t(lang, 'fcfsAlertScheduler')}
            </button>
            <button
              onClick={onClose}
              className="w-full px-4 py-2.5 rounded-[10px] border border-line text-sm font-medium text-ink2"
            >
              {t(lang, 'fcfsReassignOther')}
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onProceed}
              className="w-full px-4 py-2.5 rounded-[10px] bg-terracotta text-white text-sm font-semibold"
            >
              {t(lang, 'fcfsSaveAnyway')}
            </button>
            <button
              onClick={onClose}
              className="w-full px-4 py-2.5 rounded-[10px] border border-line text-sm font-medium text-ink2"
            >
              {t(lang, 'fcfsGoBack')}
            </button>
          </>
        )}
      </div>
    </Modal>
  )
}
