'use client'

import { cn } from '@/lib/utils/cn'
import { t } from '@/lib/i18n'
import { fmtTime } from '@/features/schedule/utils'
import { clashesForInstaller } from '@/lib/utils/clash-detection'
import type { InstallerClash } from '@/lib/utils/clash-detection'
import type { FCFSJob, FCFSAssignee } from '@/lib/supabase/queries/fcfs'
import type { LangCode } from '@/lib/i18n'

// Approved design: public/mockups/workflow-v2/fcfs-timeline-v2.html
// One row per job (ordered by FCFS rank), horizontal time axis, one bar per
// installer positioned by time. Bar colour = punctuality + clash state.

const JOB_COL_W = 170
const HOUR_W    = 88
const BAR_H     = 22
const BAR_GAP   = 3
const ROW_PAD   = 4

type BarVariant = 'flex' | 'strict' | 'strict-clash' | 'flex-warn' | 'sug'

const BAR_CLASS: Record<BarVariant, string> = {
  flex:           'bg-punct-flex border border-punct-flex',
  strict:         'bg-punct-strict border border-punct-strict',
  'strict-clash': 'bg-bad border border-bad ring-1 ring-bad',
  'flex-warn':    'bg-punct-flex border-2 border-dashed border-brand-amber',
  sug:            'bg-brand-amber border border-brand-amber opacity-90',
}

// Colour rules from the approved mockup: a hard clash paints both bars bright
// red; a soft clash paints only the flexible bar (blue + amber dashed) — the
// strict side keeps its normal red. Suggestions are always amber.
function barVariant(job: FCFSJob, assignee: FCFSAssignee, clashes: InstallerClash[]): BarVariant {
  if (assignee.is_suggestion) return 'sug'
  const mine = clashesForInstaller(clashes, assignee.user_id)
    .filter(c => !c.involvesSuggestion && (c.jobA.id === job.id || c.jobB.id === job.id))
  if (mine.some(c => c.severity === 'hard')) return 'strict-clash'
  if (mine.some(c => c.severity === 'soft') && job.punctuality === 'flexible') return 'flex-warn'
  return job.punctuality === 'strict' ? 'strict' : 'flex'
}

function barSpan(
  a: FCFSAssignee, job: FCFSJob, startH: number, endH: number,
): { left: string; width: string; allDay: boolean } | null {
  const rangeStart = startH * 60
  const rangeEnd   = endH * 60
  const total      = rangeEnd - rangeStart

  // No fixed start = whole-day floater: span the visible range.
  if (!job.time_start) return { left: '0%', width: '100%', allDay: true }

  const [sh, sm] = job.time_start.split(':').map(Number)
  const startMin = sh * 60 + sm
  let endMin: number
  if (job.time_end) {
    const [eh, em] = job.time_end.split(':').map(Number)
    endMin = eh * 60 + em
  } else {
    endMin = rangeEnd // open-ended: run to the end of the visible range
  }

  const s = Math.max(startMin, rangeStart)
  const e = Math.min(endMin, rangeEnd)
  if (e <= s) return null

  return {
    left:   `${(((s - rangeStart) / total) * 100).toFixed(3)}%`,
    width:  `${(((e - s) / total) * 100).toFixed(3)}%`,
    allDay: false,
  }
}

function hourLabel(h: number): string {
  const hh = h % 24
  if (hh === 0) return '12am'
  if (hh === 12) return '12pm'
  return hh < 12 ? `${hh}am` : `${hh - 12}pm`
}

interface FCFSTimelineProps {
  jobs:       FCFSJob[]
  clashes:    InstallerClash[]
  startH:     number
  endH:       number
  lang:       LangCode
  onJobClick: (job: FCFSJob) => void
}

export function FCFSTimeline({ jobs, clashes, startH, endH, lang, onJobClick }: FCFSTimelineProps) {
  const hours    = Array.from({ length: endH - startH }, (_, i) => startH + i)
  const minWidth = JOB_COL_W + hours.length * HOUR_W

  const isHardClashJob = (job: FCFSJob) =>
    clashes.some(c => !c.involvesSuggestion && c.severity === 'hard' &&
      (c.jobA.id === job.id || c.jobB.id === job.id))

  return (
    <div data-tour="fcfs-board" className="overflow-x-auto">
      <div style={{ minWidth }}>
        {/* Time axis header */}
        <div className="flex sticky top-0 z-10 bg-paper border-b-2 border-line">
          <div
            className="shrink-0 border-r border-line px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-muted flex items-center"
            style={{ width: JOB_COL_W }}
          >
            {t(lang, 'fcfsJobColumn')}
          </div>
          {/* flex-1 so columns stretch with the viewport — the bars are
              percentage-positioned, so fixed-width columns drift on wide
              screens (the 9am–6pm bug from the smoke test). */}
          {hours.map(h => (
            <div
              key={h}
              className={cn(
                'flex-1 border-r border-line/60 px-1 py-1.5 text-[10px] font-semibold text-ink2 bg-bg/40',
                h === 12 && 'border-l-2 border-l-terracotta/40',
              )}
              style={{ minWidth: HOUR_W }}
            >
              {hourLabel(h)}
            </div>
          ))}
        </div>

        {/* Job rows */}
        {jobs.map(job => {
          const bars = job.assignees.filter(a => !a.is_sub_installer)
          const rowH = ROW_PAD * 2 + Math.max(bars.length, 1) * BAR_H + Math.max(bars.length - 1, 0) * BAR_GAP
          const allSuggestions = bars.length > 0 && bars.every(b => b.is_suggestion)

          return (
            <div
              key={job.id}
              className="flex border-b border-line last:border-b-0 cursor-pointer hover:bg-bg/50 transition-colors"
              style={{ minHeight: rowH }}
              onClick={() => onJobClick(job)}
            >
              <div
                className="shrink-0 border-r border-line px-3 py-1 flex flex-col justify-center gap-0.5 bg-paper"
                style={{ width: JOB_COL_W }}
              >
                <span className={cn(
                  'text-[10px] font-extrabold',
                  allSuggestions ? 'text-brand-amber' : 'text-muted',
                )}>
                  #{job.fcfs_rank}
                </span>
                <span className={cn(
                  'text-xs font-semibold leading-tight truncate',
                  isHardClashJob(job) ? 'text-bad' : 'text-ink',
                )}>
                  {job.project_title || job.client}
                </span>
                {bars.length === 0 && (
                  <span className="text-[10px] text-brand-amber">{t(lang, 'fcfsUnassigned')}</span>
                )}
              </div>

              <div className="relative flex-1">
                {/* Hour gridlines + 15-min ticks */}
                <div className="absolute inset-0 flex">
                  {hours.map(h => (
                    <div
                      key={h}
                      className={cn(
                        'flex-1 border-r border-line/60 h-full',
                        h === 12 && 'border-l-2 border-l-terracotta/40',
                      )}
                      style={{
                        minWidth: HOUR_W,
                        backgroundImage: 'linear-gradient(to right, var(--line) 1px, transparent 1px)',
                        backgroundSize: '25% 100%',
                        backgroundPosition: '-1px 0',
                        opacity: 0.5,
                      }}
                    />
                  ))}
                </div>

                {bars.map((a, idx) => {
                  const span = barSpan(a, job, startH, endH)
                  if (!span) return null
                  const variant = barVariant(job, a, clashes)
                  const timeLabel = span.allDay
                    ? t(lang, 'fcfsAllDay')
                    : `${fmtTime(job.time_start)}${job.time_end ? `–${fmtTime(job.time_end)}` : ''}`
                  return (
                    <div
                      key={a.user_id}
                      className={cn(
                        'absolute rounded flex items-center gap-1.5 px-2 overflow-hidden z-[2]',
                        BAR_CLASS[variant],
                      )}
                      style={{
                        left:   span.left,
                        width:  span.width,
                        top:    ROW_PAD + idx * (BAR_H + BAR_GAP),
                        height: BAR_H,
                      }}
                    >
                      <span className="text-[10px] font-bold text-white whitespace-nowrap shrink-0">
                        {a.name}
                      </span>
                      <span className="text-[8px] text-white/75 whitespace-nowrap ml-auto pl-1 shrink-0">
                        {timeLabel}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
