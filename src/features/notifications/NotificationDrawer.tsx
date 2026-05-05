'use client'

import { useState, useMemo } from 'react'
import { Bell, X, Hourglass, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils/cn'
import { t } from '@/lib/i18n'
import type { ScheduleJob } from '@/lib/supabase/queries/jobs'
import type { LangCode } from '@/lib/i18n'

function isOverdueNow(job: ScheduleJob): boolean {
  if (job.status !== 'scheduled') return false
  const today = new Date().toISOString().split('T')[0]
  if (job.date < today) return true
  if (job.date === today && job.time_end) {
    const [h, m] = job.time_end.split(':').map(Number)
    const now = new Date()
    return now.getHours() * 60 + now.getMinutes() > h * 60 + m
  }
  return false
}

interface Props {
  jobs: ScheduleJob[]
  lang: LangCode
}

export function NotificationDrawer({ jobs, lang }: Props) {
  const [open, setOpen] = useState(false)

  const overdueJobs = useMemo(
    () => jobs.filter(isOverdueNow),
    [jobs],
  )

  const count = overdueJobs.length

  return (
    <>
      {/* ── Bell button ── */}
      <button
        onClick={() => setOpen(true)}
        aria-label={t(lang, 'notifications')}
        className={cn(
          'relative p-2 rounded-lg border transition-colors',
          count > 0
            ? 'bg-bad-soft border-bad text-bad'
            : 'bg-paper border-line text-ink2 hover:border-ink2',
        )}
      >
        <Bell size={15} />
        {count > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 flex items-center justify-center bg-bad text-white text-[10px] font-bold rounded-full px-1 leading-none">
            {count}
          </span>
        )}
      </button>

      {/* ── Backdrop ── */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20"
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── Drawer ── */}
      <div
        className={cn(
          'fixed top-0 right-0 z-50 h-full w-80 bg-paper shadow-xl flex flex-col transition-transform duration-200 ease-out',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-line shrink-0">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-bad-soft">
              <Bell size={14} className="text-bad" />
            </span>
            <span className="text-sm font-medium text-ink">
              {t(lang, 'notifications')}
            </span>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="p-1 text-muted hover:text-ink rounded transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {overdueJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 px-4 text-center">
              <Bell size={28} className="text-muted" strokeWidth={1.5} />
              <p className="text-sm text-muted">{t(lang, 'notificationsNone')}</p>
            </div>
          ) : (
            <div className="px-3 py-3 space-y-2">
              <p className="text-[11px] text-muted uppercase tracking-widest px-1 pb-1">
                {count} {t(lang, 'overdueCount')}
              </p>
              {overdueJobs.map(job => (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  onClick={() => setOpen(false)}
                  className="flex items-start gap-2.5 p-3 rounded-xl border border-bad bg-bad-soft hover:brightness-95 transition-colors group"
                >
                  <Hourglass size={14} className="text-bad mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-bad truncate">{job.client}</p>
                    <p className="text-[11px] text-bad/70 mt-0.5">{job.date}</p>
                    {job.location && (
                      <p className="text-[11px] text-bad/60 truncate">{job.location}</p>
                    )}
                  </div>
                  <ArrowRight
                    size={12}
                    className="text-muted group-hover:text-ink2 mt-0.5 shrink-0 transition-colors"
                  />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
