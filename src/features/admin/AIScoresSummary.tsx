'use client'

import { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'
import { URGENCY_META } from '@/lib/utils/design-urgency'
import { Card } from '@/components/Card'
import type { Summary } from '@/app/api/admin/design-scores/route'

// Hardcoded English throughout this file — Nic-only reader, explicit decision
// (see AIScoresTab.tsx header comment).

const URGENCY_LEVELS = [1, 2, 3, 4, 5] as const

function CardLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] uppercase tracking-widest text-muted font-medium mb-3">
      {children}
    </p>
  )
}

function UrgencyChips({ counts }: { counts: Summary['urgencyCounts'] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {URGENCY_LEVELS.map(level => (
        <span
          key={level}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-line text-xs font-medium text-ink2"
        >
          <span className={cn('w-2 h-2 rounded-full shrink-0', URGENCY_META[level].barClass)} aria-hidden />
          {URGENCY_META[level].label} · {counts[level]}
        </span>
      ))}
    </div>
  )
}

function LoadBars({ rows }: { rows: Summary['loadPerDesigner'] }) {
  if (rows.length === 0) return <p className="text-xs text-muted">No designers yet.</p>
  const max = Math.max(1, ...rows.map(d => d.count))
  return (
    <div className="flex flex-col gap-1.5">
      {rows.map(d => (
        <div key={d.name} className="flex items-center gap-2">
          <span className="w-20 shrink-0 text-xs text-ink2 truncate">{d.name}</span>
          <div className="flex-1 h-2 rounded-full bg-bg overflow-hidden">
            <div
              className="h-full rounded-full bg-brand-blue"
              style={{ width: `${Math.round((d.count / max) * 100)}%` }}
            />
          </div>
          <span className="w-5 shrink-0 text-right text-xs font-semibold text-ink2">{d.count}</span>
        </div>
      ))}
    </div>
  )
}

function ScrollList({ children, empty }: { children: ReactNode[]; empty: string }) {
  if (children.length === 0) return <p className="text-xs text-muted">{empty}</p>
  return (
    <div className="flex flex-col gap-1 max-h-48 overflow-y-auto pr-1">
      {children}
    </div>
  )
}

function AccuracyList({ rows }: { rows: Summary['accuracy'] }) {
  return (
    <ScrollList empty="No completed design jobs yet.">
      {rows.map((r, i) => {
        const diff = Math.abs(r.estimatedDays - r.actualDays)
        const good = diff <= 1
        return (
          <div key={i} className="flex items-center justify-between gap-2 text-xs">
            <span className="text-ink2 truncate">{r.jobTitle || 'Untitled job'}</span>
            <span className={cn('font-semibold shrink-0', good ? 'text-brand-green' : 'text-brand-amber')}>
              est {r.estimatedDays}d vs actual {r.actualDays}d
            </span>
          </div>
        )
      })}
    </ScrollList>
  )
}

function RatingAccuracyList({ rows }: { rows: Summary['ratingAccuracy'] }) {
  return (
    <ScrollList empty="No trusted ratings yet.">
      {rows.map((r, i) => {
        const diff = r.aiComplexity === null ? null : Math.abs(r.aiComplexity - r.ratedComplexity)
        const color = diff === null ? 'text-muted'
          : diff === 0 ? 'text-brand-green'
          : diff === 1 ? 'text-brand-amber'
          : 'text-bad'
        return (
          <div key={i} className="flex items-center justify-between gap-2 text-xs">
            <span className="text-ink2 truncate">{r.jobTitle || 'Untitled job'}</span>
            <span className={cn('font-semibold shrink-0', color)}>
              AI {r.aiComplexity ?? '—'} vs rated {r.ratedComplexity}
            </span>
          </div>
        )
      })}
    </ScrollList>
  )
}

function PerDesignerList({ rows }: { rows: Summary['perDesigner'] }) {
  return (
    <ScrollList empty="No rated jobs yet.">
      {rows.map(r => (
        <p key={r.name} className="text-xs text-ink2">
          <span className="font-medium text-ink">{r.name}</span> · avg deviation {r.avgDeviation.toFixed(1)} · flagged {r.flaggedRecent}
        </p>
      ))}
    </ScrollList>
  )
}

function ActivityLine({ activity }: { activity: Summary['activity'] }) {
  return (
    <p className="text-xs text-ink2">
      {activity.last30dCalls} calls last 30 days — {activity.haiku} Haiku / {activity.sonnet} Sonnet
    </p>
  )
}

export function SummaryCards({ summary }: { summary: Summary }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
      <Card className="p-4">
        <CardLabel>Urgency — open jobs</CardLabel>
        <UrgencyChips counts={summary.urgencyCounts} />
      </Card>

      <Card className="p-4">
        <CardLabel>Load per designer</CardLabel>
        <LoadBars rows={summary.loadPerDesigner} />
      </Card>

      <Card className="p-4">
        <CardLabel>Activity — last 30 days</CardLabel>
        <ActivityLine activity={summary.activity} />
      </Card>

      <Card className="p-4">
        <CardLabel>Turnaround accuracy</CardLabel>
        <AccuracyList rows={summary.accuracy} />
      </Card>

      <Card className="p-4">
        <CardLabel>Rating accuracy</CardLabel>
        <RatingAccuracyList rows={summary.ratingAccuracy} />
      </Card>

      <Card className="p-4">
        <CardLabel>Per-designer deviation</CardLabel>
        <PerDesignerList rows={summary.perDesigner} />
      </Card>
    </div>
  )
}
