'use client'

import Link from 'next/link'
import { Clock, MapPin, Users, Radio, Phone } from 'lucide-react'
import { t } from '@/lib/i18n'
import { fmtTime, timeToMinutes } from '@/features/schedule/utils'
import type { InstallerJob } from '@/lib/supabase/queries/installer'
import type { LangCode } from '@/lib/i18n'

interface Props {
  job:     InstallerJob
  lang:    LangCode
  nowMins: number
}

export function NowCard({ job, lang, nowMins }: Props) {
  const timeStr  = job.time_start
    ? `${fmtTime(job.time_start)}${job.time_end ? ` – ${fmtTime(job.time_end)}` : ''}`
    : null

  const startMins = timeToMinutes(job.time_start)
  const endMins   = job.time_end
    ? timeToMinutes(job.time_end)
    : startMins !== null ? startMins + 480 : null

  const isOverrunning = endMins !== null && nowMins > endMins
  const statusStr     = isOverrunning ? t(lang, 'nowOverrunning') : t(lang, 'nowOngoing')

  const assignees = job.job_assignees
    .map(a => a.users)
    .filter(Boolean) as Array<{ id: string; name: string }>

  return (
    <div className="bg-brand-green-soft border-2 border-brand-green rounded-card overflow-hidden">
      <Link
        href={`/jobs/${job.id}?from=installer`}
        className="block p-4 group hover:bg-brand-green/5 transition-colors"
      >
        {/* NOW badge + status */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-green text-white text-[11px] font-medium">
            <Radio size={11} />
            {t(lang, 'nowBadge')}
          </div>
          <span className="text-xs font-medium text-brand-green">{statusStr}</span>
        </div>

        {/* client name */}
        <p className="font-display text-[22px] font-medium text-ink leading-tight mb-3 truncate">
          {job.client}
        </p>

        {/* icon row */}
        <div className="space-y-1.5">
          {timeStr && (
            <div className="flex items-center gap-1.5 text-xs text-ink2">
              <Clock size={11} className="shrink-0 text-brand-green" />
              {timeStr}
            </div>
          )}
          <div className="flex items-center gap-1.5 text-xs text-ink2">
            <MapPin size={11} className="shrink-0 text-brand-green" />
            <span className="truncate">{job.location}</span>
          </div>
          {assignees.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-ink2">
              <Users size={11} className="shrink-0 text-brand-green" />
              <span className="truncate">{assignees.map(a => a.name).join(', ')}</span>
            </div>
          )}
        </div>

        {/* production / DO pills */}
        {(job.production_ready || job.do_issued) && (
          <div className="flex gap-1.5 mt-3 flex-wrap">
            {job.production_ready && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-brand-green/15 text-brand-green font-medium">
                {t(lang, 'productionReady')} ✓
              </span>
            )}
            {job.do_issued && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-brand-green/15 text-brand-green font-medium">
                {t(lang, 'doIssued')} ✓
              </span>
            )}
          </div>
        )}
      </Link>

      {/* call sales footer */}
      {job.sales_poc?.phone && (
        <div className="border-t border-brand-green/30 px-4 py-2.5 flex items-center justify-between">
          <span className="text-xs text-ink2">{job.sales_poc.name}</span>
          <a
            href={`tel:${job.sales_poc.phone}`}
            className="flex items-center gap-1.5 text-xs font-medium text-brand-green hover:opacity-75 transition-opacity"
          >
            <Phone size={11} />
            {t(lang, 'installerCallSales')}
          </a>
        </div>
      )}
    </div>
  )
}
