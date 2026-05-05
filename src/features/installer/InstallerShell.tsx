'use client'

import { useState, useMemo } from 'react'
import { Briefcase } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { UserMenu } from '@/components/UserMenu'
import { t } from '@/lib/i18n'
import { toISO, timeToMinutes } from '@/features/schedule/utils'
import { InstallerJobCard } from './InstallerJobCard'
import { NowCard } from './NowCard'
import { Pill } from '@/components/Pill'
import { BottomNav } from '@/components/BottomNav'
import type { InstallerJob } from '@/lib/supabase/queries/installer'
import type { LangCode } from '@/lib/i18n'

type Tab = 'today' | 'next' | 'week' | 'past'

function getWeekEnd(today: string): string {
  const d = new Date(today + 'T00:00:00')
  const dayOfWeek = d.getDay()
  const daysUntilSun = dayOfWeek === 0 ? 0 : 7 - dayOfWeek
  d.setDate(d.getDate() + daysUntilSun)
  return toISO(d)
}

interface Props {
  jobs:     InstallerJob[]
  lang:     LangCode
  userName: string
}

export function InstallerShell({ jobs, lang, userName }: Props) {
  const [tab, setTab] = useState<Tab>('today')

  const today   = toISO(new Date())
  const weekEnd = getWeekEnd(today)

  const scheduled = useMemo(
    () => jobs
      .filter(j => j.status === 'scheduled')
      .sort((a, b) => a.date.localeCompare(b.date) || (a.time_start ?? '').localeCompare(b.time_start ?? '')),
    [jobs],
  )

  const todayJobs = useMemo(
    () => scheduled.filter(j => j.date === today),
    [scheduled, today],
  )

  const nextJobs = useMemo(
    () => scheduled.filter(j => j.date > today).slice(0, 5),
    [scheduled, today],
  )

  const weekJobs = useMemo(
    () => scheduled.filter(j => j.date >= today && j.date <= weekEnd),
    [scheduled, today, weekEnd],
  )

  const pastJobs = useMemo(
    () => jobs
      .filter(j => j.status === 'completed' || j.date < today)
      .sort((a, b) => b.date.localeCompare(a.date)),
    [jobs, today],
  )

  const firstName = userName.split(' ')[0]

  const nowMins = useMemo(() => {
    const now = new Date()
    return now.getHours() * 60 + now.getMinutes()
  }, [])

  const currentJob = useMemo(() => {
    return todayJobs.find(j => {
      const s = timeToMinutes(j.time_start)
      if (s === null || s > nowMins) return false
      const e = j.time_end ? timeToMinutes(j.time_end) : s + 480
      return e !== null && nowMins <= e + 60
    }) ?? null
  }, [todayJobs, nowMins])

  const tabs: { v: Tab; label: string; count: number }[] = [
    { v: 'today', label: t(lang, 'installerToday'),    count: todayJobs.length },
    { v: 'next',  label: t(lang, 'installerUpNext'),   count: nextJobs.length  },
    { v: 'week',  label: t(lang, 'installerThisWeek'), count: weekJobs.length  },
    { v: 'past',  label: t(lang, 'installerHistoryTab'), count: 0              },
  ]

  const visibleJobs =
    tab === 'today' ? todayJobs :
    tab === 'next'  ? nextJobs  :
    tab === 'week'  ? weekJobs  :
                     pastJobs

  return (
    <div className="min-h-screen bg-bg">

      {/* ── Company bar ── */}
      <div className="px-4 pt-3 pb-2.5 flex items-center justify-between border-b border-line">
        <div className="flex items-center gap-2">
          <span className="font-display font-semibold text-[22px] text-ink tracking-tight leading-none">GreenQubes</span>
          <span className="text-[10px] font-medium text-terracotta/50 tracking-wide">Pre-Alpha</span>
        </div>
        <UserMenu lang={lang} />
      </div>

      {/* ── Header ── */}
      <div className="px-4 pt-5 pb-4">
        <p className="text-[11px] text-muted uppercase tracking-widest mb-1">{t(lang, 'installerHi')}, {firstName}</p>
        <h1 className="font-display text-[26px] font-medium text-ink tracking-tight leading-none">
          {t(lang, 'installerToday')}
        </h1>
        <Pill variant="installer" className="mt-1.5" />
      </div>

      {/* ── Tabs ── */}
      <div className="px-4 pb-3 flex gap-1.5 overflow-x-auto scrollbar-none">
        {tabs.map(({ v, label, count }) => (
          <button
            key={v}
            onClick={() => setTab(v)}
            className={cn(
              'flex items-center gap-1.5 px-3.5 py-2 rounded-full border text-xs font-medium shrink-0 transition-colors',
              tab === v
                ? 'bg-brand-green text-white border-brand-green'
                : 'bg-paper border-line text-ink2 hover:border-ink2',
            )}
          >
            {label}
            {count > 0 && (
              <span className={cn(
                'inline-flex items-center justify-center min-w-[16px] h-4 rounded-full px-1 text-[10px] font-bold leading-none',
                tab === v ? 'bg-white/25 text-white' : 'bg-brand-green/15 text-brand-green',
              )}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Section label ── */}
      {tab === 'past' && pastJobs.length > 0 && (
        <p className="px-4 pb-2 text-[11px] text-muted uppercase tracking-widest">
          {t(lang, 'installerHistoryTitle')}
        </p>
      )}

      {/* ── Job list ── */}
      <div className="px-4 space-y-3 pb-24">
        {visibleJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <Briefcase size={32} className="text-muted" strokeWidth={1.5} />
            <p className="text-sm text-muted">{t(lang, 'installerNothingToday')}</p>
          </div>
        ) : (
          <>
            {tab === 'today' && currentJob && (
              <NowCard job={currentJob} lang={lang} nowMins={nowMins} />
            )}
            {(tab === 'today' ? visibleJobs.filter(j => j.id !== currentJob?.id) : visibleJobs).map(job => (
              <InstallerJobCard key={job.id} job={job} lang={lang} />
            ))}
          </>
        )}
      </div>

      <BottomNav role="installer" />
    </div>
  )
}
