'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card }   from '@/components/Card'
import { cn }     from '@/lib/utils/cn'
import type { BugReport, BugPriority } from '@/lib/supabase/queries/bugs'

const PRIORITY_PILL: Record<BugPriority, string> = {
  low:    'bg-muted/10 text-muted border-muted/30',
  medium: 'bg-amber/10 text-amber border-amber/30',
  high:   'bg-terracotta/10 text-terracotta border-terracotta/30',
  urgent: 'bg-[var(--bad)]/10 text-[var(--bad)] border-[var(--bad)]/30',
}

function fmtSGT(ts: string) {
  return new Date(ts).toLocaleString('en-SG', {
    day:      'numeric',
    month:    'short',
    hour:     '2-digit',
    minute:   '2-digit',
    timeZone: 'Asia/Singapore',
  })
}

function BugCard({
  bug,
  onFixed,
}: {
  bug:     BugReport
  onFixed: (id: string) => void
}) {
  const [expanded,   setExpanded]   = useState(false)
  const [fixing,     setFixing]     = useState(false)
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null)
  const [loadingUrl, setLoadingUrl] = useState(false)

  async function handleViewScreenshot() {
    if (screenshotUrl) { window.open(screenshotUrl, '_blank'); return }
    if (!bug.screenshot_key) return
    setLoadingUrl(true)
    try {
      const res = await fetch('/api/r2/download-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: bug.screenshot_key }),
      })
      const { url } = await res.json() as { url: string }
      setScreenshotUrl(url)
      window.open(url, '_blank')
    } finally {
      setLoadingUrl(false)
    }
  }

  async function handleMarkFixed() {
    setFixing(true)
    try {
      await fetch(`/api/bugs/${bug.id}`, { method: 'PATCH' })
      onFixed(bug.id)
    } finally {
      setFixing(false)
    }
  }

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={cn(
              'px-1.5 py-0.5 rounded text-[11px] font-medium border capitalize',
              PRIORITY_PILL[bug.priority],
            )}>
              {bug.priority}
            </span>
            <span className="text-xs font-mono text-muted">{fmtSGT(bug.created_at)} SGT</span>
            {bug.route && (
              <span className="px-1.5 py-0.5 rounded text-[11px] font-mono bg-bg text-ink2 border border-line">
                {bug.route}
              </span>
            )}
          </div>
          <p className="text-sm text-ink font-medium line-clamp-2">{bug.message}</p>
          {(bug.user_email || bug.user_role) && (
            <p className="text-[11px] text-muted mt-0.5">
              {bug.user_email}{bug.user_role ? ` (${bug.user_role})` : ''}
            </p>
          )}
        </div>
        <button
          onClick={() => setExpanded(v => !v)}
          className="text-xs text-muted hover:text-ink2 shrink-0 mt-0.5 w-5 text-center"
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? '▲' : '▼'}
        </button>
      </div>

      {expanded && (
        <div className="mt-3 flex flex-col gap-2 text-xs text-ink2">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {bug.platform && <p><span className="text-muted">Platform:</span> {bug.platform}</p>}
            {bug.os       && <p><span className="text-muted">OS:</span> {bug.os}</p>}
            {bug.screen   && <p><span className="text-muted">Screen:</span> {bug.screen}</p>}
            {bug.ip_address && <p><span className="text-muted">IP:</span> {bug.ip_address}</p>}
            {bug.markdown_file && <p className="col-span-2"><span className="text-muted">File:</span> <span className="font-mono">{bug.markdown_file}</span></p>}
          </div>
          <p className="text-sm text-ink whitespace-pre-wrap leading-relaxed border-t border-line pt-2 mt-1">
            {bug.message}
          </p>
        </div>
      )}

      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-line">
        {bug.screenshot_key && (
          <button
            onClick={handleViewScreenshot}
            disabled={loadingUrl}
            className="text-xs text-blue underline underline-offset-2 hover:text-ink2 disabled:opacity-50"
          >
            {loadingUrl ? 'Loading…' : 'View screenshot'}
          </button>
        )}
        {bug.status === 'open' && (
          <button
            onClick={handleMarkFixed}
            disabled={fixing}
            className={cn(
              'text-xs underline underline-offset-2 ml-auto',
              fixing ? 'text-muted cursor-not-allowed' : 'text-green hover:text-ink2',
            )}
          >
            {fixing ? 'Marking fixed…' : 'Mark Fixed'}
          </button>
        )}
        {bug.status === 'fixed' && bug.resolved_at && (
          <p className="text-[11px] text-muted ml-auto">
            Fixed {fmtSGT(bug.resolved_at)} SGT
          </p>
        )}
      </div>
    </Card>
  )
}

export function BugReportsTab() {
  const [bugs,    setBugs]    = useState<BugReport[]>([])
  const [loading, setLoading] = useState(true)
  const [err,     setErr]     = useState<string | null>(null)
  const [showFixed, setShowFixed] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const res  = await fetch('/api/bugs')
      const json = await res.json() as BugReport[] | { error: string }
      if (!res.ok) throw new Error((json as { error: string }).error ?? `HTTP ${res.status}`)
      setBugs(json as BugReport[])
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const markFixed = (id: string) =>
    setBugs(prev => prev.map(b => b.id === id ? { ...b, status: 'fixed' as const, resolved_at: new Date().toISOString() } : b))

  if (loading) return <p className="text-sm text-muted py-6 text-center">Loading…</p>

  if (err) return (
    <div className="rounded-card border border-terracotta/30 bg-terracotta/5 p-4">
      <p className="text-sm font-medium text-terracotta mb-1">Failed to load bug reports</p>
      <p className="text-xs text-ink2">{err}</p>
      <button onClick={load} className="mt-2 text-xs text-muted underline underline-offset-2">Retry</button>
    </div>
  )

  const open  = bugs.filter(b => b.status === 'open')
  const fixed = bugs.filter(b => b.status === 'fixed')

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-widest text-muted font-medium">
          {open.length === 0 ? 'No open bugs' : `${open.length} open bug${open.length === 1 ? '' : 's'}`}
        </p>
        <button onClick={load} className="text-xs text-muted underline underline-offset-2 hover:text-ink2">
          Refresh
        </button>
      </div>

      {open.length === 0 ? (
        <Card className="p-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="inline-block w-2 h-2 rounded-full bg-brand-green" />
            <p className="text-sm font-medium text-ink">No open bug reports</p>
          </div>
          <p className="text-xs text-muted">New bug reports will appear here automatically.</p>
        </Card>
      ) : (
        open.map(bug => <BugCard key={bug.id} bug={bug} onFixed={markFixed} />)
      )}

      {fixed.length > 0 && (
        <div className="flex flex-col gap-3">
          <button
            onClick={() => setShowFixed(v => !v)}
            className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted font-medium hover:text-ink2 transition-colors text-left"
          >
            <span>{showFixed ? '▼' : '▶'}</span>
            {fixed.length} fixed bug{fixed.length === 1 ? '' : 's'}
          </button>
          {showFixed && fixed.map(bug => <BugCard key={bug.id} bug={bug} onFixed={markFixed} />)}
        </div>
      )}
    </div>
  )
}
