'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card } from '@/components/Card'
import { cn }   from '@/lib/utils/cn'

type CrashLog = {
  id:              string
  occurred_at:     string
  route:           string
  error_message:   string
  stack_trace:     string | null
  component_stack: string | null
  user_email:      string | null
  user_agent:      string | null
  markdown_body:   string
  resolved:        boolean
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

function downloadMd(filename: string, content: string) {
  const a    = document.createElement('a')
  a.href     = URL.createObjectURL(new Blob([content], { type: 'text/markdown' }))
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

function CrashCard({ log, onDismiss }: { log: CrashLog; onDismiss: (id: string) => void }) {
  const [expanded,   setExpanded]   = useState(false)
  const [dismissing, setDismissing] = useState(false)

  const handleDismiss = async () => {
    setDismissing(true)
    try {
      await fetch(`/api/admin/crashes/${log.id}`, { method: 'PATCH' })
      onDismiss(log.id)
    } finally {
      setDismissing(false)
    }
  }

  const filename = `crash-${log.occurred_at.slice(0, 19).replace(/[T:]/g, '-')}.md`

  return (
    <Card className="p-4">
      {/* Summary row */}
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-xs font-mono text-muted">{fmtSGT(log.occurred_at)} SGT</span>
            <span className="px-1.5 py-0.5 rounded text-[11px] font-mono bg-bg text-ink2 border border-line">
              {log.route}
            </span>
            {log.user_email && (
              <span className="text-[11px] text-muted">{log.user_email}</span>
            )}
          </div>
          <p className="text-sm font-medium text-terracotta truncate">{log.error_message}</p>
        </div>
        <button
          onClick={() => setExpanded(v => !v)}
          className="text-xs text-muted hover:text-ink2 shrink-0 mt-0.5 w-5 text-center"
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? '▲' : '▼'}
        </button>
      </div>

      {/* Stack details */}
      {expanded && (
        <div className="mt-3 flex flex-col gap-3">
          {log.stack_trace && (
            <div>
              <p className="text-[11px] uppercase tracking-widest text-muted font-medium mb-1">Stack</p>
              <pre className="text-[11px] font-mono bg-bg rounded-lg p-3 overflow-x-auto whitespace-pre-wrap text-ink2 leading-relaxed max-h-64">
                {log.stack_trace}
              </pre>
            </div>
          )}
          {log.component_stack && (
            <div>
              <p className="text-[11px] uppercase tracking-widest text-muted font-medium mb-1">Component stack</p>
              <pre className="text-[11px] font-mono bg-bg rounded-lg p-3 overflow-x-auto whitespace-pre-wrap text-ink2 leading-relaxed max-h-48">
                {log.component_stack}
              </pre>
            </div>
          )}
          {log.user_agent && (
            <p className="text-[11px] font-mono text-muted leading-relaxed">{log.user_agent}</p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-line">
        <button
          onClick={() => downloadMd(filename, log.markdown_body)}
          className="text-xs text-brand-blue underline underline-offset-2 hover:text-ink2"
        >
          Download .md
        </button>
        <button
          onClick={handleDismiss}
          disabled={dismissing}
          className={cn(
            'text-xs underline underline-offset-2 ml-auto',
            dismissing ? 'text-muted cursor-not-allowed' : 'text-muted hover:text-ink2',
          )}
        >
          {dismissing ? 'Dismissing…' : 'Dismiss'}
        </button>
      </div>
    </Card>
  )
}

export function CrashLogTab() {
  const [logs,    setLogs]    = useState<CrashLog[]>([])
  const [loading, setLoading] = useState(true)
  const [err,     setErr]     = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const res  = await fetch('/api/admin/crashes')
      const json = await res.json() as CrashLog[] | { error: string }
      if (!res.ok) throw new Error((json as { error: string }).error ?? `HTTP ${res.status}`)
      setLogs(json as CrashLog[])
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const dismiss = (id: string) => setLogs(prev => prev.filter(l => l.id !== id))

  if (loading) return <p className="text-sm text-muted py-6 text-center">Loading…</p>

  if (err) return (
    <div className="rounded-card border border-terracotta/30 bg-terracotta/5 p-4">
      <p className="text-sm font-medium text-terracotta mb-1">Failed to load crash logs</p>
      <p className="text-xs text-ink2">{err}</p>
      <button onClick={load} className="mt-2 text-xs text-muted underline underline-offset-2">Retry</button>
    </div>
  )

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-widest text-muted font-medium">
          {logs.length === 0 ? 'No active crashes' : `${logs.length} crash${logs.length === 1 ? '' : 'es'}`}
        </p>
        <button onClick={load} className="text-xs text-muted underline underline-offset-2 hover:text-ink2">
          Refresh
        </button>
      </div>

      {logs.length === 0 ? (
        <Card className="p-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="inline-block w-2 h-2 rounded-full bg-brand-green" />
            <p className="text-sm font-medium text-ink">All clear — no crashes</p>
          </div>
          <p className="text-xs text-muted">New crashes will appear here automatically.</p>
        </Card>
      ) : (
        logs.map(log => <CrashCard key={log.id} log={log} onDismiss={dismiss} />)
      )}
    </div>
  )
}
