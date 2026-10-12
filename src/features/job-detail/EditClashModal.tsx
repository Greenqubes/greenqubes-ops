'use client'

import { AlertTriangle } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { cn } from '@/lib/utils/cn'
import { t } from '@/lib/i18n'
import { fmtTime } from '@/features/schedule/utils'
import { editClashActions } from './edit-clash-rules'
import type { LangCode } from '@/lib/i18n'
import type { Role } from '@/lib/supabase/types'

// Workflow V2 Task 19 (extended): warns when saving an already-scheduled job
// would double-book an installer — the gap deferred from Phase 1, where the
// clash check only ran at push time. Options depend on who is saving:
//   coordinator          → Alert Scheduler (save + Telegram schedulers) / Re-assign
//   scheduler / admin    → Save Anyway / Go Back (they resolve clashes themselves)
//
// Smoke feedback edit 8 (2026-08-27) narrowed WHEN this opens for
// coordinator — they can no longer dirty the formal installer list (suggest-
// only now), so their pre-flight (JobDetailShell's needsCheck) only fires on
// a TIME change on a scheduled job with existing installers, never on an
// installer swap. Code-review fix (same day, Critical #1) restored that
// path after a first pass over-narrowed the pre-flight to scheduler-only
// and made this branch briefly unreachable for coordinator — see
// JobDetailShell.tsx's needsCheck and assign-installers/route.ts's checkOnly
// gate for the mechanics. Scheduler/admin behavior here is unchanged.

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

// Leave has no second job to point at, so it rides ALONGSIDE CheckClash
// rather than inside it — CheckClash requires a `conflict` job.
export interface LeaveCheckClash {
  installerId:   string
  installerName: string
  /** Pre-formatted range, e.g. "10 Sep 2026 (from PM) – 12 Sep 2026". */
  dates:         string
}

// Away on work — a warning, not a clash (Nic, 2026-10-09). Rides alongside
// like leave, for the same reason: there is no second job to point at.
export interface AwayCheckClash {
  installerId:   string
  installerName: string
  title:         string
  /** Pre-formatted, e.g. "Tue 13 Oct 2026, 2:00pm → Thu 15 Oct 2026, 12:00pm". */
  when:          string
}

interface EditClashModalProps {
  isOpen:           boolean
  clashes:          CheckClash[]
  /** Optional so existing callers compile untouched. */
  leaveClashes?:    LeaveCheckClash[]
  /** Away on work — amber. Optional so existing callers compile untouched. */
  awayClashes?:     AwayCheckClash[]
  role:             Role
  lang:             LangCode
  onAlertScheduler: () => void
  onProceed:        () => void
  onClose:          () => void
}

export function EditClashModal({
  isOpen, clashes, leaveClashes = [], awayClashes = [], role, lang, onAlertScheduler, onProceed, onClose,
}: EditClashModalProps) {
  // An away-only result never escalates (Review Focus #5) — see edit-clash-rules.
  const isCoordinator =
    editClashActions(role, { clashes: clashes.length, leave: leaveClashes.length }) === 'alert-scheduler'

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t(lang, 'fcfsClashDetected')}>
      <div className="flex flex-col gap-2 mb-5">
        {/* Leave first — the hardest of the red flags: a double-booking can be
            argued about, an absent person cannot. The role-branched buttons
            below are deliberately unchanged; a scheduler may still Save
            Anyway, matching the existing convention. */}
        {leaveClashes.map((lc, i) => (
          <div key={`leave-${lc.installerId}-${i}`} className="border border-line rounded-[10px] p-3">
            <div className="flex items-center gap-2">
              <AlertTriangle size={13} className="text-bad" />
              <p className="text-sm font-semibold text-ink">{lc.installerName}</p>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full ml-auto bg-bad-soft text-bad">
                {t(lang, 'fcfsOnLeaveChip')}
              </span>
            </div>
            <p className="text-xs text-ink2 mt-1.5">{lc.dates}</p>
          </div>
        ))}
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
        {/* Away on work — amber, last: a heads-up, not a conflict. */}
        {awayClashes.map((a, i) => (
          <div key={`away-${a.installerId}-${i}`} className="border border-line rounded-[10px] p-3">
            <div className="flex items-center gap-2">
              <AlertTriangle size={13} className="text-brand-amber" />
              <p className="text-sm font-semibold text-ink">{a.installerName}</p>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full ml-auto bg-brand-amber-soft text-brand-amber">
                {t(lang, 'awayChip')}
              </span>
            </div>
            <p className="text-xs text-ink2 mt-1.5">{a.title} · {a.when}</p>
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
