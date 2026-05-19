'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { Bell, X, Hourglass, ArrowRight, RotateCcw, Trash2, Check } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils/cn'
import { t } from '@/lib/i18n'
import type { ScheduleJob } from '@/lib/supabase/queries/jobs'
import type { LangCode } from '@/lib/i18n'

type InAppNotif = {
  id:         string
  type:       string
  job_id:     string | null
  title:      string
  body:       string | null
  read:       boolean
  created_at: string
}

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

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60)    return 'just now'
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

interface Props {
  jobs: ScheduleJob[]
  lang: LangCode
}

export function NotificationDrawer({ jobs, lang }: Props) {
  const [open,       setOpen]       = useState(false)
  const [notifs,     setNotifs]     = useState<InAppNotif[]>([])
  const [selectMode, setSelectMode] = useState(false)
  const [selected,   setSelected]   = useState<Set<string>>(new Set())
  const [deleting,   setDeleting]   = useState(false)

  const overdueJobs = useMemo(() => jobs.filter(isOverdueNow), [jobs])

  const unreadCount  = notifs.filter(n => !n.read).length
  const totalBadge   = unreadCount + overdueJobs.length

  const fetchNotifs = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications')
      if (res.ok) setNotifs(await res.json())
    } catch { /* best-effort */ }
  }, [])

  // Fetch on mount and whenever drawer opens
  useEffect(() => { fetchNotifs() }, [fetchNotifs])
  useEffect(() => { if (open) fetchNotifs() }, [open, fetchNotifs])

  function handleOpen() {
    setOpen(true)
    setSelectMode(false)
    setSelected(new Set())
  }

  function handleClose() {
    setOpen(false)
    setSelectMode(false)
    setSelected(new Set())
  }

  async function handleMarkAllRead() {
    try {
      await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      setNotifs(prev => prev.map(n => ({ ...n, read: true })))
    } catch { /* best-effort */ }
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleDelete() {
    if (selected.size === 0) return
    setDeleting(true)
    try {
      await fetch('/api/notifications', {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ids: [...selected] }),
      })
      setNotifs(prev => prev.filter(n => !selected.has(n.id)))
      setSelected(new Set())
      setSelectMode(false)
    } catch { /* best-effort */ } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      {/* ── Bell button ── */}
      <button
        onClick={handleOpen}
        aria-label={t(lang, 'notifications')}
        className={cn(
          'flex items-center gap-1.5 px-2 py-2 rounded-lg border transition-colors',
          overdueJobs.length > 0
            ? 'bg-bad border-bad text-white'
            : unreadCount > 0
              ? 'bg-terracotta border-terracotta text-white'
              : 'bg-paper border-line text-ink2 hover:border-ink2',
        )}
      >
        <Bell size={15} />
        {totalBadge > 0 && (
          <span className="text-[10px] font-bold leading-none">
            {totalBadge > 10 ? '10+' : totalBadge}
          </span>
        )}
      </button>

      {/* ── Backdrop ── */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black/20" onClick={handleClose} />
      )}

      {/* ── Drawer ── */}
      <div
        className={cn(
          'fixed top-0 right-0 z-50 h-full w-80 bg-paper shadow-xl flex flex-col transition-transform duration-200 ease-out',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-line shrink-0">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-bad-soft">
              <Bell size={14} className="text-bad" />
            </span>
            <span className="text-sm font-medium text-ink">
              {t(lang, 'notifications')}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && !selectMode && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-muted hover:text-ink2 hover:bg-bg transition-colors"
                title="Mark all as read"
              >
                <Check size={11} />
                Mark all read
              </button>
            )}
            <button
              onClick={handleClose}
              className="p-1 text-muted hover:text-ink rounded transition-colors"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {notifs.length === 0 && overdueJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 px-4 text-center">
              <Bell size={28} className="text-muted" strokeWidth={1.5} />
              <p className="text-sm text-muted">{t(lang, 'notificationsNone')}</p>
            </div>
          ) : (
            <div className="px-3 py-3 space-y-4">

              {/* ── Sent-back notifications ── */}
              {notifs.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] text-muted uppercase tracking-widest px-1">
                    Updates
                  </p>
                  {notifs.map(n => (
                    <div key={n.id} className="flex items-start gap-2">
                      {selectMode && (
                        <button
                          onClick={() => toggleSelect(n.id)}
                          className="mt-3 shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors"
                          style={{
                            borderColor:     selected.has(n.id) ? 'var(--terracotta)' : 'var(--line)',
                            backgroundColor: selected.has(n.id) ? 'var(--terracotta)' : 'var(--paper)',
                          }}
                        >
                          {selected.has(n.id) && <Check size={9} className="text-white" strokeWidth={3} />}
                        </button>
                      )}
                      <Link
                        href={n.job_id ? `/jobs/${n.job_id}` : '#'}
                        onClick={handleClose}
                        className={cn(
                          'flex-1 flex items-start gap-2.5 p-3 rounded-xl border transition-colors group',
                          n.read
                            ? 'bg-paper border-line hover:brightness-95'
                            : 'bg-terracotta-soft border-terracotta/30 hover:brightness-95',
                        )}
                      >
                        <div className="shrink-0 mt-0.5">
                          {!n.read && (
                            <span className="block w-2 h-2 rounded-full bg-terracotta mt-1" />
                          )}
                          {n.read && (
                            <RotateCcw size={13} className="text-muted" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            'text-xs font-medium truncate',
                            n.read ? 'text-ink2' : 'text-ink',
                          )}>
                            {n.title}
                          </p>
                          {n.body && (
                            <p className="text-[11px] text-muted mt-0.5 line-clamp-2">{n.body}</p>
                          )}
                          <p className="text-[10px] text-muted/60 mt-1">{timeAgo(n.created_at)}</p>
                        </div>
                        <ArrowRight
                          size={12}
                          className="text-muted group-hover:text-ink2 mt-0.5 shrink-0 transition-colors"
                        />
                      </Link>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Overdue jobs ── */}
              {overdueJobs.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] text-muted uppercase tracking-widest px-1">
                    {overdueJobs.length} {t(lang, 'overdueCount')}
                  </p>
                  {overdueJobs.map(job => (
                    <Link
                      key={job.id}
                      href={`/jobs/${job.id}`}
                      onClick={handleClose}
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
          )}
        </div>

        {/* Footer — Delete controls (only when there are in-app notifs) */}
        {notifs.length > 0 && (
          <div className="shrink-0 border-t border-line px-4 py-3 flex items-center justify-between gap-2">
            {selectMode ? (
              <>
                <button
                  onClick={() => { setSelectMode(false); setSelected(new Set()) }}
                  className="text-xs text-muted hover:text-ink2 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={selected.size === 0 || deleting}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                    selected.size > 0
                      ? 'bg-terracotta text-white hover:bg-terracotta/90'
                      : 'bg-line text-muted cursor-not-allowed',
                  )}
                >
                  <Trash2 size={11} />
                  {deleting ? 'Deleting…' : selected.size > 0 ? `Delete? (${selected.size})` : 'Delete?'}
                </button>
              </>
            ) : (
              <button
                onClick={() => setSelectMode(true)}
                className="flex items-center gap-1.5 text-xs text-muted hover:text-ink2 transition-colors ml-auto"
              >
                <Trash2 size={12} />
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    </>
  )
}
