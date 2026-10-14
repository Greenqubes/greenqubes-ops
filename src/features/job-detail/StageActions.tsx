'use client'

import { useState } from 'react'
import { Modal } from '@/components/Modal'
import { useToast } from '@/components/Toast'
import { t, type LangCode } from '@/lib/i18n'
import type { Stage } from '@/lib/utils/job-stage'

/**
 * Stage moves on the edit form that are not Push to Schedule (spec
 * 2026-10-09): Draft → Ongoing, Ongoing → Draft, Scheduled → Ongoing.
 * Server-checked by /api/jobs/[id]/stage; these buttons are a convenience.
 */
export function StageActions({ jobId, stage, canMove, beforeMove, onMoved, lang }: {
  jobId: string
  stage: Stage
  lang:  LangCode
  canMove: (to: Stage) => boolean
  /** Saves unsaved edits and checks required fields; false = stop. */
  beforeMove: (to: Stage) => Promise<boolean>
  onMoved: (status: string) => void
}) {
  const { error: showError, success: showSuccess } = useToast()
  const [busy, setBusy] = useState(false)
  const [confirmPostpone, setConfirmPostpone] = useState(false)

  async function move(to: Stage) {
    setBusy(true)
    try {
      if (!(await beforeMove(to))) return
      const res = await fetch(`/api/jobs/${jobId}/stage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to }),
      })
      const data = await res.json().catch(() => ({})) as { status?: string; error?: string }
      if (!res.ok || !data.status) {
        showError(
          data.error === 'missing_fields' ? t(lang, 'requiredFieldsMissingOngoing')
          : data.error === 'designers_assigned' ? t(lang, 'moveToDraftsDesigners')
          : data.error === 'not_permitted' ? t(lang, 'saveBlocked')
          : t(lang, 'saveError'),
        )
        return
      }
      onMoved(data.status)
      showSuccess(t(lang, 'savedSuccessfully'))
    } catch {
      showError(t(lang, 'saveError'))
    } finally {
      setBusy(false)
      setConfirmPostpone(false)
    }
  }

  const showToOngoing   = stage === 'draft'     && canMove('ongoing')
  const showToDrafts    = stage === 'ongoing'   && canMove('draft')
  const showPostpone    = stage === 'scheduled' && canMove('ongoing')
  if (!showToOngoing && !showToDrafts && !showPostpone) return null

  const btn = 'flex-1 flex items-center justify-center px-4 py-2.5 rounded-[10px] border border-line bg-paper text-sm font-medium text-ink2 hover:bg-bg disabled:opacity-40'
  return (
    <div className="flex flex-wrap gap-2 mb-2">
      {showToOngoing && (
        <button type="button" className={btn} disabled={busy} onClick={() => move('ongoing')}>{t(lang, 'saveAsOngoingBtn')}</button>
      )}
      {showToDrafts && (
        <button type="button" className={btn} disabled={busy} onClick={() => move('draft')}>{t(lang, 'moveBackToDrafts')}</button>
      )}
      {showPostpone && (
        <button type="button" className={btn} disabled={busy} onClick={() => setConfirmPostpone(true)}>{t(lang, 'moveBackToOngoing')}</button>
      )}
      <Modal isOpen={confirmPostpone} onClose={() => setConfirmPostpone(false)} title={t(lang, 'moveBackToOngoing')}>
        <div className="space-y-4">
          <p className="text-sm text-ink2">{t(lang, 'postponeConfirmBody')}</p>
          <div className="flex gap-2">
            <button type="button" className={btn} onClick={() => setConfirmPostpone(false)}>{t(lang, 'cancel')}</button>
            <button type="button" disabled={busy} onClick={() => move('ongoing')}
              className="flex-1 px-4 py-2.5 rounded-[10px] bg-terracotta text-white text-sm font-semibold disabled:opacity-40">
              {t(lang, 'moveBackToOngoing')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
