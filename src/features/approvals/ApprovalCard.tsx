'use client'

import Link from 'next/link'
import { MapPin, Users, ExternalLink, UserCircle } from 'lucide-react'
import { Card } from '@/components/Card'
import { Pill } from '@/components/Pill'
import { Btn } from '@/components/Btn'
import { t } from '@/lib/i18n'
import type { LangCode } from '@/lib/i18n'
import type { ApprovalJob } from '@/lib/supabase/queries/approvals'

interface Props {
  job:        ApprovalJob
  lang:       LangCode
  onApprove:  () => void
  onSendBack: () => void
}

function fmtTime(t: string | null) {
  if (!t) return null
  const [h, m] = t.split(':')
  const hr = parseInt(h, 10)
  return `${hr % 12 || 12}:${m} ${hr < 12 ? 'AM' : 'PM'}`
}

function fmtDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-SG', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}

export function ApprovalCard({ job, lang, onApprove, onSendBack }: Props) {
  const assignees = job.job_assignees.map(a => a.users).filter(Boolean) as Array<{ id: string; name: string }>
  const quote     = job.job_financials?.quote_amount

  return (
    <Card className="p-4 space-y-3">
      {/* top row */}
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-display text-sm font-medium text-ink">{job.client}</span>
            <Pill variant="awaiting_approval" />
            {quote != null && (
              <span className="text-xs text-ink2 font-medium">
                S${quote.toLocaleString()}
              </span>
            )}
          </div>
          <p className="text-xs text-muted mt-0.5">
            {fmtDate(job.date)}
            {job.time_start && (
              <span> · {fmtTime(job.time_start)}{job.time_end ? `–${fmtTime(job.time_end)}` : ''}</span>
            )}
          </p>
        </div>
        <Link
          href={`/jobs/${job.id}`}
          className="text-muted hover:text-ink shrink-0 p-1"
          title="Open job"
        >
          <ExternalLink size={14} />
        </Link>
      </div>

      {/* location */}
      {job.location && (
        <div className="flex items-start gap-1.5 text-xs text-ink2">
          <MapPin size={11} className="mt-0.5 shrink-0 text-muted" />
          <span>{job.location}</span>
        </div>
      )}

      {/* description */}
      {job.description && (
        <p className="text-xs text-ink2 leading-relaxed line-clamp-2">{job.description}</p>
      )}

      {/* sales poc */}
      {job.sales_poc && (
        <div className="flex items-center gap-1.5 text-xs text-ink2">
          <UserCircle size={11} className="text-muted shrink-0" />
          <span className="text-muted">Requested by</span>
          <span className="font-medium text-ink">{job.sales_poc.name}</span>
        </div>
      )}

      {/* assignees */}
      {assignees.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <Users size={11} className="text-muted shrink-0" />
          {assignees.map(a => (
            <span
              key={a.id}
              className="text-[11px] px-2 py-0.5 rounded-full bg-brand-green-soft text-brand-green font-medium"
            >
              {a.name}
            </span>
          ))}
        </div>
      )}

      {/* actions */}
      <div className="flex gap-2 pt-1 border-t border-line">
        <Btn variant="accent" size="sm" onClick={onApprove}>
          {t(lang, 'approveAndSchedule')}
        </Btn>
        <Btn variant="secondary" size="sm" onClick={onSendBack}>
          {t(lang, 'sendBack')}
        </Btn>
      </div>
    </Card>
  )
}
