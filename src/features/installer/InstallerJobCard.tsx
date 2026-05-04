'use client'

import Link from 'next/link'
import { ArrowRight, Phone, MapPin, Clock } from 'lucide-react'
import { Pill } from '@/components/Pill'
import { t } from '@/lib/i18n'
import { fmtTime } from '@/features/schedule/utils'
import type { InstallerJob } from '@/lib/supabase/queries/installer'
import type { LangCode } from '@/lib/i18n'

interface Props {
  job:  InstallerJob
  lang: LangCode
}

export function InstallerJobCard({ job, lang }: Props) {
  const timeStr = job.time_start
    ? `${fmtTime(job.time_start)}${job.time_end ? ` – ${fmtTime(job.time_end)}` : ''}`
    : null

  const dateLabel = new Date(job.date + 'T00:00:00')
    .toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short' })

  return (
    <div className="bg-paper border border-line rounded-2xl overflow-hidden">
      <Link
        href={`/jobs/${job.id}?from=installer`}
        className="block p-4 group hover:bg-bg/60 transition-colors"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <Pill variant={job.status} />
              <span className="text-[11px] text-muted">{dateLabel}</span>
            </div>
            <p className="font-medium text-ink truncate">{job.client}</p>
            {timeStr && (
              <div className="flex items-center gap-1.5 text-xs text-ink2">
                <Clock size={11} className="shrink-0" />
                {timeStr}
              </div>
            )}
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <MapPin size={11} className="shrink-0" />
              <span className="truncate">{job.location}</span>
            </div>
          </div>
          <ArrowRight
            size={14}
            className="text-muted group-hover:text-ink2 mt-1 shrink-0 transition-colors"
          />
        </div>
      </Link>

      {job.sales_poc?.phone && (
        <div className="border-t border-line px-4 py-2.5 flex items-center justify-between">
          <span className="text-xs text-muted">{job.sales_poc.name}</span>
          <a
            href={`tel:${job.sales_poc.phone}`}
            className="flex items-center gap-1.5 text-xs font-medium text-brand-blue hover:opacity-75 transition-opacity"
          >
            <Phone size={11} />
            {t(lang, 'installerCallSales')}
          </a>
        </div>
      )}
    </div>
  )
}
