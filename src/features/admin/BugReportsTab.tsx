'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Card }   from '@/components/Card'
import { cn }     from '@/lib/utils/cn'
import type { BugReport, BugPriority } from '@/lib/supabase/queries/bugs'

type OpenSort  = 'newest' | 'oldest'
type FixedSort = 'newest' | 'oldest' | 'recently-fixed' | 'oldest-fixed'

function SortDropdown<T extends string>({
  value,
  options,
  onChange,
}: {
  value:    T
  options:  { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  const current = options.find(o => o.value === value)

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 text-xs text-muted hover:text-ink2 transition-colors"
      >
        <span>Sort: {current?.label}</span>
        <span className="text-[10px]">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 bg-paper border border-line rounded-lg shadow-lg py-1 min-w-[140px]">
          {options.map(o => (
            <button
              key={o.value}
              onClick={() => { onChange(o.value); setOpen(false) }}
              className={cn(
                'w-full text-left px-3 py-1.5 text-xs transition-colors',
                o.value === value ? 'text-ink font-medium bg-bg' : 'text-ink2 hover:bg-bg',
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ScreenshotModal({ url, onClose }: { url: string; onClose: () => void }) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4"
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className="relative max-w-3xl w-full bg-paper rounded-card shadow-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-line">
          <p className="text-sm font-medium text-ink">Screenshot</p>
          <div className="flex items-center gap-3">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue underline underline-offset-2 hover:text-ink2"
            >
              Open in new tab
            </a>
            <button
              onClick={onClose}
              className="text-muted hover:text-ink text-lg leading-none"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>
        <div className="overflow-auto max-h-[75vh] bg-bg flex items-center justify-center p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="Bug report screenshot" className="max-w-full h-auto rounded" />
        </div>
      </div>
    </div>
  )
}

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
  onDelete,
  selectMode,
  selected,
  onSelect,
}: {
  bug:        BugReport
  onFixed:    (id: string) => void
  onDelete?:  (id: string) => void
  selectMode?: boolean
  selected?:   boolean
  onSelect?:   (id: string) => void
}) {
  const [expanded,      setExpanded]      = useState(false)
  const [fixing,        setFixing]        = useState(false)
  const [deleting,      setDeleting]      = useState(false)
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null)
  const [loadingUrl,    setLoadingUrl]    = useState(false)
  const [showModal,     setShowModal]     = useState(false)

  async function handleViewScreenshot() {
    if (screenshotUrl) { setShowModal(true); return }
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
      setShowModal(true)
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

  async function handleDelete() {
    setDeleting(true)
    try {
      await fetch(`/api/bugs/${bug.id}`, { method: 'DELETE' })
      onDelete?.(bug.id)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
    {showModal && screenshotUrl && (
      <ScreenshotModal url={screenshotUrl} onClose={() => setShowModal(false)} />
    )}
    <Card className={cn('p-4 transition-colors', selected && 'ring-1 ring-terracotta/40 bg-terracotta/5')}>
      <div className="flex items-start gap-3">
        {selectMode && bug.status === 'fixed' && (
          <input
            type="checkbox"
            checked={!!selected}
            onChange={() => onSelect?.(bug.id)}
            className="mt-1 shrink-0 accent-terracotta"
          />
        )}
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
        {bug.status === 'fixed' && (
          <div className="flex items-center gap-4 ml-auto">
            {bug.resolved_at && (
              <p className="text-[11px] text-muted">Fixed {fmtSGT(bug.resolved_at)} SGT</p>
            )}
            {!selectMode && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className={cn(
                  'text-xs underline underline-offset-2',
                  deleting ? 'text-muted cursor-not-allowed' : 'text-terracotta hover:text-ink2',
                )}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            )}
          </div>
        )}
      </div>
    </Card>
    </>
  )
}

export function BugReportsTab() {
  const [bugs,       setBugs]       = useState<BugReport[]>([])
  const [loading,    setLoading]    = useState(true)
  const [err,        setErr]        = useState<string | null>(null)
  const [showFixed,  setShowFixed]  = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [selected,   setSelected]   = useState<Set<string>>(new Set())
  const [deleting,   setDeleting]   = useState(false)
  const [openSort,   setOpenSort]   = useState<OpenSort>('newest')
  const [fixedSort,  setFixedSort]  = useState<FixedSort>('recently-fixed')

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

  const markFixed  = (id: string) =>
    setBugs(prev => prev.map(b => b.id === id ? { ...b, status: 'fixed' as const, resolved_at: new Date().toISOString() } : b))

  const removeBug  = (id: string) =>
    setBugs(prev => prev.filter(b => b.id !== id))

  const toggleSelect = (id: string) =>
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })

  function exitSelectMode() {
    setSelectMode(false)
    setSelected(new Set())
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return
    setDeleting(true)
    try {
      await Promise.all([...selected].map(id => fetch(`/api/bugs/${id}`, { method: 'DELETE' })))
      setBugs(prev => prev.filter(b => !selected.has(b.id)))
      exitSelectMode()
    } finally {
      setDeleting(false)
    }
  }

  if (loading) return <p className="text-sm text-muted py-6 text-center">Loading…</p>

  if (err) return (
    <div className="rounded-card border border-terracotta/30 bg-terracotta/5 p-4">
      <p className="text-sm font-medium text-terracotta mb-1">Failed to load bug reports</p>
      <p className="text-xs text-ink2">{err}</p>
      <button onClick={load} className="mt-2 text-xs text-muted underline underline-offset-2">Retry</button>
    </div>
  )

  const open = bugs
    .filter(b => b.status === 'open')
    .sort((a, b) => openSort === 'newest'
      ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      : new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )

  const fixed = bugs
    .filter(b => b.status === 'fixed')
    .sort((a, b) => {
      if (fixedSort === 'newest')        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      if (fixedSort === 'oldest')        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      if (fixedSort === 'recently-fixed') return new Date(b.resolved_at ?? 0).getTime() - new Date(a.resolved_at ?? 0).getTime()
      return new Date(a.resolved_at ?? 0).getTime() - new Date(b.resolved_at ?? 0).getTime()
    })

  return (
    <div className="flex flex-col gap-4 pb-24">
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-widest text-muted font-medium">
          {open.length === 0 ? 'No open bugs' : `${open.length} open bug${open.length === 1 ? '' : 's'}`}
        </p>
        <div className="flex items-center gap-3">
          {open.length > 1 && (
            <SortDropdown<OpenSort>
              value={openSort}
              onChange={setOpenSort}
              options={[
                { value: 'newest', label: 'Newest first' },
                { value: 'oldest', label: 'Oldest first' },
              ]}
            />
          )}
          <button onClick={load} className="text-xs text-muted underline underline-offset-2 hover:text-ink2">
            Refresh
          </button>
        </div>
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
        open.map(bug => <BugCard key={bug.id} bug={bug} onFixed={markFixed} onDelete={removeBug} />)
      )}

      {fixed.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => { setShowFixed(v => !v); if (selectMode) exitSelectMode() }}
              className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted font-medium hover:text-ink2 transition-colors text-left"
            >
              <span>{showFixed ? '▼' : '▶'}</span>
              {fixed.length} fixed bug{fixed.length === 1 ? '' : 's'}
            </button>
            {showFixed && (
              <div className="flex items-center gap-3">
                {fixed.length > 1 && (
                  <SortDropdown<FixedSort>
                    value={fixedSort}
                    onChange={setFixedSort}
                    options={[
                      { value: 'recently-fixed', label: 'Recently fixed' },
                      { value: 'oldest-fixed',   label: 'Oldest fixed' },
                      { value: 'newest',         label: 'Newest received' },
                      { value: 'oldest',         label: 'Oldest received' },
                    ]}
                  />
                )}
                <button
                  onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)}
                  className="text-xs text-muted underline underline-offset-2 hover:text-ink2"
                >
                  {selectMode ? 'Cancel' : 'Select'}
                </button>
              </div>
            )}
          </div>
          {showFixed && fixed.map(bug => (
            <BugCard
              key={bug.id}
              bug={bug}
              onFixed={markFixed}
              onDelete={removeBug}
              selectMode={selectMode}
              selected={selected.has(bug.id)}
              onSelect={toggleSelect}
            />
          ))}
        </div>
      )}

      {selectMode && selected.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-paper border-t border-line px-4 py-3 flex items-center justify-between shadow-lg">
          <p className="text-sm font-medium text-ink">
            {selected.size} selected
          </p>
          <button
            onClick={handleBulkDelete}
            disabled={deleting}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium text-paper transition-colors',
              deleting ? 'bg-muted cursor-not-allowed' : 'bg-terracotta hover:bg-terracotta/90',
            )}
          >
            {deleting ? 'Deleting…' : `Delete ${selected.size}`}
          </button>
        </div>
      )}
    </div>
  )
}
