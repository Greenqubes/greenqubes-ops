'use client'

import { Card } from '@/components/Card'
import { Btn } from '@/components/Btn'
import { Pill } from '@/components/Pill'
import { t } from '@/lib/i18n'
import type { Role, JobStatus } from '@/lib/supabase/types'
import type { LangCode } from '@/lib/i18n'

interface Props {
  status:         JobStatus
  role:           Role
  lang:           LangCode
  onStatusChange: (s: JobStatus) => Promise<void>
  onDelete?:      () => void
}

export function StatusSection({ status, role, lang, onStatusChange, onDelete }: Props) {
  const actions: Array<{ label: string; next: JobStatus; variant?: 'primary' | 'secondary' | 'ghost' }> = []

  if (role === 'sales') {
    if (status === 'pending')            actions.push({ label: t(lang, 'submitForApproval'), next: 'awaiting_approval' })
    if (status === 'awaiting_approval')  actions.push({ label: t(lang, 'recallApproval'), next: 'pending', variant: 'secondary' })
  }

  if (role === 'scheduler') {
    if (status === 'awaiting_approval') {
      actions.push({ label: t(lang, 'approveAndSchedule'), next: 'scheduled' })
      actions.push({ label: t(lang, 'sendBack'), next: 'pending', variant: 'secondary' })
    }
    if (status === 'scheduled') actions.push({ label: t(lang, 'markComplete'), next: 'completed' })
    if (status === 'pending')   actions.push({ label: t(lang, 'pushToSchedule'), next: 'awaiting_approval', variant: 'secondary' })
  }

  if (role === 'installer') {
    if (status === 'scheduled') actions.push({ label: t(lang, 'markComplete'), next: 'completed' })
  }

  const showDeleteBtn = role === 'sales' && status === 'pending' && !!onDelete

  if (actions.length === 0 && !showDeleteBtn) return null

  return (
    <Card className="p-4 flex flex-wrap items-center gap-3">
      <div className="flex-1 flex items-center gap-2">
        <span className="text-xs text-muted">Status</span>
        <Pill variant={status} />
      </div>
      <div className="flex gap-2 flex-wrap">
        {showDeleteBtn && (
          <Btn variant="ghost" size="sm" onClick={onDelete}>
            {t(lang, 'deleteJob')}
          </Btn>
        )}
        {actions.map(a => (
          <Btn
            key={a.next}
            variant={a.variant ?? 'primary'}
            size="sm"
            onClick={() => onStatusChange(a.next)}
          >
            {a.label}
          </Btn>
        ))}
      </div>
    </Card>
  )
}
