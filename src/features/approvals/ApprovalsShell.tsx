'use client'

import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { t } from '@/lib/i18n'
import { useToast } from '@/components/Toast'
import { ApprovalCard } from './ApprovalCard'
import { SendBackModal } from './SendBackModal'
import { BottomNav } from '@/components/BottomNav'
import { UserMenu } from '@/components/UserMenu'
import type { ApprovalJob } from '@/lib/supabase/queries/approvals'
import type { LangCode } from '@/lib/i18n'

interface Props {
  queue:  ApprovalJob[]
  userId: string
  lang:   LangCode
}

export function ApprovalsShell({ queue: initialQueue, userId: _userId, lang }: Props) {
  const { success: showSuccess, error: showError } = useToast()

  const [queue,       setQueue]       = useState(initialQueue)
  const [sendBackJob, setSendBackJob] = useState<ApprovalJob | null>(null)

  function removeJob(id: string) {
    setQueue(q => q.filter(j => j.id !== id))
  }

  async function handleApprove(jobId: string) {
    removeJob(jobId)
    try {
      const res = await fetch(`/api/jobs/${jobId}/approve`, { method: 'POST' })
      if (!res.ok) throw new Error('approve failed')
      showSuccess(t(lang, 'approvedSuccess'))
    } catch {
      showError(t(lang, 'saveError'))
    }
  }

  async function handleSendBack(jobId: string, note: string) {
    setSendBackJob(null)
    removeJob(jobId)
    try {
      const res = await fetch(`/api/jobs/${jobId}/send-back`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ note }),
      })
      if (!res.ok) throw new Error('send-back failed')
      showSuccess(t(lang, 'sentBack'))
    } catch {
      showError(t(lang, 'saveError'))
    }
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="sticky top-0 z-10 bg-bg border-b border-line px-4 pt-4 pb-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-muted uppercase tracking-widest mb-0.5">Greenqubes</p>
          <h1 className="font-display text-2xl font-medium text-ink tracking-tight leading-none">
            {t(lang, 'approvalsTitle')}
          </h1>
        </div>
        {queue.length > 0 && (
          <span className="bg-terracotta text-white text-xs font-medium px-2 py-0.5 rounded-full shrink-0">
            {queue.length}
          </span>
        )}
        <UserMenu />
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-6 pb-24 space-y-4">
        {queue.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <CheckCircle2 size={36} className="text-brand-green" strokeWidth={1.5} />
            <p className="text-sm text-muted">{t(lang, 'approvalsEmpty')}</p>
          </div>
        ) : (
          queue.map(job => (
            <ApprovalCard
              key={job.id}
              job={job}
              lang={lang}
              onApprove={() => handleApprove(job.id)}
              onSendBack={() => setSendBackJob(job)}
            />
          ))
        )}
      </div>

      {sendBackJob && (
        <SendBackModal
          client={sendBackJob.client}
          lang={lang}
          onConfirm={(note) => handleSendBack(sendBackJob.id, note)}
          onClose={() => setSendBackJob(null)}
        />
      )}

      <BottomNav role="scheduler" />
    </div>
  )
}
