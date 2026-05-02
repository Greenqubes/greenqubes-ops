'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Modal } from '@/components/Modal'
import { Btn } from '@/components/Btn'
import { cn } from '@/lib/utils/cn'
import { t } from '@/lib/i18n'
import type { LangCode } from '@/lib/i18n'
import type { WorkloadDay } from '@/lib/supabase/queries/approvals'

interface Props {
  jobId:        string
  currentDate:  string   // the job's current date (YYYY-MM-DD)
  lang:         LangCode
  onConfirm:    (finalDate: string) => Promise<void>
  onClose:      () => void
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function getMondayOf(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  const diff = (day === 0 ? -6 : 1 - day)
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function fmtDayLabel(dateStr: string, locale: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString(locale, {
    weekday: 'short',
  })
}

function fmtDayNum(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-SG', {
    day: 'numeric', month: 'short',
  })
}

export function WorkloadPreviewModal({ jobId, currentDate, lang, onConfirm, onClose }: Props) {
  const locale      = lang === 'zh' ? 'zh-SG' : lang === 'bn' ? 'bn-BD' : 'en-SG'
  const [weekStart, setWeekStart] = useState(() => getMondayOf(currentDate))
  const [selected,  setSelected]  = useState(currentDate)
  const [workload,  setWorkload]  = useState<WorkloadDay[]>([])
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)

  const weekEnd = addDays(weekStart, 6)

  const fetchWorkload = useCallback(async (from: string, to: string) => {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('jobs')
        .select('date, job_assignees ( users ( name ) )')
        .gte('date', from)
        .lte('date', to)
        .in('status', ['scheduled', 'awaiting_approval', 'pending'])
        .neq('id', jobId)   // exclude the current job itself
      if (error) throw error

      type RawJob = { date: string; job_assignees: Array<{ users: { name: string } | null }> }
      const raw = (data ?? []) as unknown as RawJob[]

      const dayMap = new Map<string, { count: number; installers: Set<string> }>()
      for (const job of raw) {
        const entry = dayMap.get(job.date) ?? { count: 0, installers: new Set<string>() }
        entry.count++
        for (const a of job.job_assignees) {
          if (a.users?.name) entry.installers.add(a.users.name)
        }
        dayMap.set(job.date, entry)
      }

      const days: WorkloadDay[] = []
      const cur = new Date(from + 'T00:00:00')
      const end = new Date(to   + 'T00:00:00')
      while (cur <= end) {
        const ds    = cur.toISOString().slice(0, 10)
        const entry = dayMap.get(ds)
        days.push({ date: ds, jobCount: entry?.count ?? 0, installerNames: entry ? Array.from(entry.installers) : [] })
        cur.setDate(cur.getDate() + 1)
      }
      setWorkload(days)
    } finally {
      setLoading(false)
    }
  }, [jobId])

  useEffect(() => {
    fetchWorkload(weekStart, weekEnd)
  }, [weekStart, weekEnd, fetchWorkload])

  async function handleConfirm() {
    setSaving(true)
    try {
      await onConfirm(selected)
    } finally {
      setSaving(false)
    }
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <Modal isOpen onClose={onClose}>
      <div className="space-y-5 w-full">

        {/* heading */}
        <div>
          <h2 className="font-display text-lg font-medium text-ink">
            {t(lang, 'workloadTitle')}
          </h2>
          <p className="mt-1 text-xs text-muted">{t(lang, 'workloadSubtitle')}</p>
        </div>

        {/* week navigation */}
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => setWeekStart(d => addDays(d, -7))}
            className="p-1 rounded text-muted hover:text-ink transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-xs font-medium text-ink2">
            {fmtDayNum(weekStart)} – {fmtDayNum(weekEnd)}
          </span>
          <button
            onClick={() => setWeekStart(d => addDays(d, 7))}
            className="p-1 rounded text-muted hover:text-ink transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* 7-day grid */}
        {loading ? (
          <div className="grid grid-cols-7 gap-1">
            {DAY_LABELS.map(d => (
              <div key={d} className="h-20 rounded-lg bg-line animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {workload.map((day) => {
              const isSelected  = day.date === selected
              const isCurrent   = day.date === currentDate
              const isToday     = day.date === today
              const isPast      = day.date < today

              return (
                <button
                  key={day.date}
                  onClick={() => !isPast && setSelected(day.date)}
                  disabled={isPast}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-lg p-1.5 text-center transition-colors border',
                    isSelected
                      ? 'bg-terracotta border-terracotta text-white'
                      : isPast
                        ? 'bg-paper border-line text-muted opacity-40 cursor-not-allowed'
                        : 'bg-paper border-line text-ink hover:border-ink2 cursor-pointer',
                  )}
                >
                  {/* day name */}
                  <span className={cn('text-[10px] font-medium uppercase tracking-wide', isSelected ? 'text-white/70' : 'text-muted')}>
                    {fmtDayLabel(day.date, locale)}
                  </span>

                  {/* day number */}
                  <span className={cn('text-xs font-semibold leading-none', isSelected ? 'text-white' : isToday ? 'text-terracotta' : 'text-ink')}>
                    {new Date(day.date + 'T00:00:00').getDate()}
                  </span>

                  {/* job count pill */}
                  {day.jobCount > 0 ? (
                    <span className={cn(
                      'text-[10px] font-medium px-1.5 py-0.5 rounded-full leading-none',
                      isSelected ? 'bg-white/20 text-white' : 'bg-amber-soft text-amber',
                    )}>
                      {day.jobCount}
                    </span>
                  ) : (
                    <span className={cn('text-[10px]', isSelected ? 'text-white/60' : 'text-muted')}>
                      {t(lang, 'workloadFreeDay')}
                    </span>
                  )}

                  {/* installer names (up to 2) */}
                  {day.installerNames.slice(0, 2).map(name => (
                    <span
                      key={name}
                      className={cn(
                        'text-[9px] leading-tight truncate w-full',
                        isSelected ? 'text-white/80' : 'text-ink2',
                      )}
                    >
                      {name.split(' ')[0]}
                    </span>
                  ))}
                  {day.installerNames.length > 2 && (
                    <span className={cn('text-[9px]', isSelected ? 'text-white/60' : 'text-muted')}>
                      +{day.installerNames.length - 2}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {/* helper hint */}
        {!loading && (
          <p className="text-[11px] text-muted text-center">
            {t(lang, 'workloadSelectPrompt')}
            {selected !== currentDate && (
              <span className="ml-1 text-terracotta font-medium">
                → {fmtDayNum(selected)}
              </span>
            )}
          </p>
        )}

        {/* actions */}
        <div className="flex gap-2 justify-end pt-1">
          <Btn variant="secondary" size="sm" onClick={onClose} disabled={saving}>
            {t(lang, 'cancel')}
          </Btn>
          <Btn variant="primary" size="sm" onClick={handleConfirm} disabled={loading || saving}>
            {saving ? t(lang, 'loading') : t(lang, 'workloadConfirm')}
          </Btn>
        </div>

      </div>
    </Modal>
  )
}
