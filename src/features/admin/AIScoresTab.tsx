'use client'

// Admin-only tab (Nic's own reading tool) — HARDCODED ENGLISH throughout,
// deliberately: no i18n keys here even though every other tab uses t().
// Static date formatting only (fmtDate, reused from the design-load board) —
// never toLocaleDateString.

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Card } from '@/components/Card'
import { cn } from '@/lib/utils/cn'
import { fmtDate } from '@/features/design-load/DesignerBar'
import { SummaryCards } from './AIScoresSummary'
import type { ScoreRow, Summary } from '@/app/api/admin/design-scores/route'

type DesignScoresData = { scores: ScoreRow[]; summary: Summary }
type Resolution = 'kept' | 'discarded'

const TRIGGER_LABELS: Record<string, string> = {
  brief_change: 'Brief change',
  assign:       'Assigned',
  date_change:  'Date change',
  nightly:      'Nightly sweep',
}
function triggerLabel(trigger: string): string {
  return TRIGGER_LABELS[trigger] ?? trigger
}

function modelLabel(model: string): string {
  const lower = model.toLowerCase()
  if (lower.includes('haiku'))  return 'Haiku'
  if (lower.includes('sonnet')) return 'Sonnet'
  return model
}

// ── Detail feed card ──────────────────────────────────────────────────────

function ScoreCard({ score }: { score: ScoreRow }) {
  return (
    <Card className="p-3">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="font-display text-sm font-semibold text-ink truncate min-w-0">
          {score.jobTitle || 'Untitled job'}
        </p>
        <span className="text-[11px] text-muted shrink-0">{fmtDate(score.createdAt)}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-brand-blue-soft text-brand-blue">
          {triggerLabel(score.trigger)}
        </span>
        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-line text-ink2">
          {modelLabel(score.model)}
        </span>
        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-ink/10 text-ink">
          Complexity {score.complexity}
        </span>
        {score.proposedDue && (
          <span className="text-[10px] text-muted">Due {fmtDate(score.proposedDue)}</span>
        )}
        {score.confidence === 'low' && (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-brand-amber-soft text-brand-amber">
            LOW CONFIDENCE
          </span>
        )}
      </div>
      {score.reason && <p className="text-xs text-ink2 italic">{score.reason}</p>}
    </Card>
  )
}

// ── Flagged strip ─────────────────────────────────────────────────────────

function FlaggedRow({
  row, onResolve,
}: {
  row:       Summary['flagged'][number]
  onResolve: (jobId: string, resolution: Resolution) => void
}) {
  const [busy, setBusy] = useState<Resolution | null>(null)

  const handle = (resolution: Resolution) => {
    setBusy(resolution)
    onResolve(row.jobId, resolution)
  }

  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-brand-amber/20 last:border-b-0">
      <p className="text-xs text-ink2 min-w-0 truncate">
        <span className="font-medium text-ink">{row.jobTitle || 'Untitled job'}</span>
        {' — AI said '}{row.aiComplexity ?? '—'}{' · took '}{row.daysTaken}{' days · '}
        {row.designerName || 'Unknown'}{' rated '}{row.rating}
      </p>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => handle('kept')}
          className="px-2.5 py-1 rounded-full text-[11px] font-medium border border-brand-green text-brand-green hover:bg-brand-green/10 disabled:opacity-50"
        >
          Keep
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => handle('discarded')}
          className="px-2.5 py-1 rounded-full text-[11px] font-medium border border-line text-ink2 hover:border-ink2 disabled:opacity-50"
        >
          Discard
        </button>
      </div>
    </div>
  )
}

// ── Tab root ──────────────────────────────────────────────────────────────

export function AIScoresTab() {
  const [data,    setData]    = useState<DesignScoresData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [filter,  setFilter]  = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setLoadErr(null)
    try {
      const res  = await fetch('/api/admin/design-scores')
      const json = await res.json() as DesignScoresData | { error: string }
      if (!res.ok) throw new Error((json as { error: string }).error ?? `HTTP ${res.status}`)
      setData(json as DesignScoresData)
    } catch (err) {
      setLoadErr((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Optimistic: the row disappears from the strip immediately on click. If
  // the PATCH fails, re-fetch to restore the real (still-flagged) state.
  const handleResolve = useCallback((jobId: string, resolution: Resolution) => {
    setData(prev => prev && {
      ...prev,
      summary: { ...prev.summary, flagged: prev.summary.flagged.filter(f => f.jobId !== jobId) },
    })
    fetch('/api/admin/design-scores', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ jobId, resolution }),
    })
      .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`) })
      .catch(() => load())
  }, [load])

  const filteredScores = useMemo(() => {
    if (!data) return []
    const q = filter.trim().toLowerCase()
    if (!q) return data.scores
    return data.scores.filter(s => s.jobTitle.toLowerCase().includes(q))
  }, [data, filter])

  if (loading && !data) return <p className="text-sm text-muted py-6 text-center">Loading AI scores…</p>
  if (loadErr) return (
    <div className="rounded-card border border-terracotta/30 bg-terracotta/5 p-4">
      <p className="text-sm font-medium text-terracotta mb-1">Failed to load AI scores</p>
      <p className="text-xs text-ink2">{loadErr}</p>
      <button onClick={() => load()} className="mt-2 text-xs text-muted underline underline-offset-2">Retry</button>
    </div>
  )
  if (!data) return null

  return (
    <div className="flex flex-col gap-6 pb-4">

      <SummaryCards summary={data.summary} />

      {data.summary.flagged.length > 0 && (
        <div className="rounded-card border border-brand-amber/30 bg-brand-amber/5 p-4">
          <p className="text-[11px] uppercase tracking-widest text-brand-amber font-medium mb-2">
            Flagged ratings — need a decision
          </p>
          <div className="flex flex-col">
            {data.summary.flagged.map(row => (
              <FlaggedRow key={row.jobId} row={row} onResolve={handleResolve} />
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <p className="text-[11px] uppercase tracking-widest text-muted font-medium">
            Scoring history — {filteredScores.length} of {data.scores.length}
          </p>
          <input
            type="text"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter by job title…"
            className={cn(
              'w-48 px-2.5 py-1.5 rounded-md border border-line bg-paper text-xs text-ink',
              'placeholder:text-muted focus:outline-none focus:border-ink2',
            )}
          />
        </div>
        {filteredScores.length === 0 ? (
          <p className="text-sm text-muted py-6 text-center">
            {data.scores.length === 0 ? 'No scores recorded yet.' : 'No scores match that filter.'}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredScores.map(score => <ScoreCard key={score.id} score={score} />)}
          </div>
        )}
      </div>

      <button
        onClick={() => load()}
        className="text-xs text-muted underline underline-offset-2 hover:text-ink2 text-center pb-2"
      >
        Refresh
      </button>
    </div>
  )
}
