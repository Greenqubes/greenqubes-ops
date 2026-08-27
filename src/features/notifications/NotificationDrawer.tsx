'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, X, Hourglass, ArrowRight, RotateCcw, Trash2, Check } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils/cn'
import { t } from '@/lib/i18n'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/Toast'
import { DesignRatingSlider } from '@/features/job-detail/DesignRatingSlider'
import { formatDate } from '@/lib/telegram/templates'
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

type OverdueJob = {
  id:            string
  client:        string
  project_title: string | null
  date:          string
  location:      string | null
  sales_name:    string | null
  coord_names:   string | null
  read:          boolean
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] // always English (CLAUDE.md hard rule)

// '2026-08-13' → '13/08/2026 (Thu)' — static table, not toLocaleDateString (the
// locale formatters caused the /schedule hydration saga; never again)
function fmtOverdueDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  const [y, m, day] = iso.split('-')
  return `${day}/${m}/${y} (${DAYS[d.getDay()]})`
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60)    return 'just now'
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

// Reads a JSON { error } body off a failed response, if there is one — same
// helper shape as JobDetailShell's errorCodeOf, used to turn a 409
// no-jo-file into the designReminderNoJo toast instead of the generic one.
async function errorCodeOf(res: Response): Promise<string | null> {
  try {
    const body = await res.json() as { error?: string }
    return body.error ?? null
  } catch {
    return null
  }
}

// design_assigned / design_due_shift upgraded their `body` column to a JSON
// blob (R2-T2 edit 4) so the drawer can show who assigned + client + install
// date, and the due-shift line as "Due date: old → new". Pre-upgrade rows
// carry a plain-text body (the project title, or "old → new") — JSON.parse
// throws on those, so callers fall back to the original single-line
// rendering and older rows still render sensibly.
type AssignedBody  = { projectTitle: string; assignedBy: string; client: string; installDate: string }
type DueShiftBody  = { projectTitle: string; oldDue: string; newDue: string; client: string; installDate: string }

function parseAssignedBody(raw: string | null): AssignedBody | null {
  if (!raw) return null
  try {
    const v = JSON.parse(raw) as Partial<AssignedBody> | null
    if (v && typeof v === 'object' && typeof v.assignedBy === 'string' && typeof v.client === 'string' && typeof v.installDate === 'string') {
      return v as AssignedBody
    }
  } catch { /* pre-upgrade plain-text row */ }
  return null
}

function parseDueShiftBody(raw: string | null): DueShiftBody | null {
  if (!raw) return null
  try {
    const v = JSON.parse(raw) as Partial<DueShiftBody> | null
    if (v && typeof v === 'object' && typeof v.oldDue === 'string' && typeof v.newDue === 'string' && typeof v.client === 'string') {
      return v as DueShiftBody
    }
  } catch { /* pre-upgrade plain-text row */ }
  return null
}

interface Props {
  lang: LangCode
}

export function NotificationDrawer({ lang }: Props) {
  const [open,        setOpen]        = useState(false)
  const [notifs,      setNotifs]      = useState<InAppNotif[]>([])
  const [overdueJobs, setOverdueJobs] = useState<OverdueJob[]>([])
  const [selectMode,  setSelectMode]  = useState(false)
  const [selected,    setSelected]    = useState<Set<string>>(new Set())
  const [deleting,    setDeleting]    = useState(false)

  // design_reminder Yes/No cards (Task 9) — which card's inline rating
  // slider is expanded, a nonce bumped on every open so the slider gets a
  // fresh `key` (and therefore fresh internal value/touched state) each time
  // — a kept-mounted slider does not reset itself between opens.
  const [openSliderId,     setOpenSliderId]     = useState<string | null>(null)
  const [sliderNonce,      setSliderNonce]      = useState(0)
  const [ratingSubmitting, setRatingSubmitting] = useState(false)

  const router = useRouter()
  const { success: showSuccess, error: showError } = useToast()

  // localStorage key for overdue alerts this user has marked read on this
  // device (job_id → job date; a reschedule to a new date re-alerts)
  const seenKeyRef = useRef<string | null>(null)

  const unreadCount   = notifs.filter(n => !n.read).length
  const unreadOverdue = overdueJobs.filter(j => !j.read).length
  const totalBadge    = unreadCount + unreadOverdue

  // Answered design_reminder cards vanish from the drawer (R2-T2 edit 7) —
  // both Yes and No mark the row read, and a read reminder is simply never
  // rendered. The row itself stays in `notifs` (its created_at still drives
  // the cron's 3-day snooze on the No path); this filter only controls what
  // paints, so bell-badge math (unreadCount above) still counts it.
  const visibleNotifs = notifs.filter(n => !(n.type === 'design_reminder' && n.read))

  const fetchNotifs = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications')
      if (res.ok) setNotifs(await res.json())
    } catch { /* best-effort */ }
  }, [])

  const fetchOverdue = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      seenKeyRef.current = `overdue-seen:${session?.user?.id ?? 'anon'}`
      let seen: Record<string, string> = {}
      try { seen = JSON.parse(localStorage.getItem(seenKeyRef.current) ?? '{}') } catch { /* corrupt entry — treat all as unread */ }

      // Overdue alerts are scoped to the job's team (POC / coordinator /
      // formally assigned installer) — scheduler + admin keep the full view.
      // Preview-as does not apply here: it changes the UI role only.
      let myId: string | null = null
      let seesAll = false
      if (session?.user?.id) {
        type MeRow = { id: string; role: string }
        const { data: me } = await (supabase
          .from('users')
          .select('id, role')
          .eq('auth_id', session.user.id)
          .single() as unknown as Promise<{ data: MeRow | null }>)
        myId = me?.id ?? null
        seesAll = me?.role === 'scheduler' || me?.role === 'admin'
      }

      const today = new Date().toISOString().split('T')[0]
      const now = new Date()
      const nowMins = now.getHours() * 60 + now.getMinutes()

      type JobRow = {
        id: string; client: string; project_title: string | null; date: string
        time_end: string | null; location: string | null; sales_poc_id: string | null
        job_assignees: Array<{ user_id: string; is_suggestion: boolean }> | null
        job_coordinators: Array<{ user_id: string; users: { name: string } | null }> | null
      }
      const { data } = await (supabase
        .from('jobs')
        .select('id, client, project_title, date, time_end, location, sales_poc_id, job_assignees(user_id, is_suggestion), job_coordinators(user_id, users(name))')
        .eq('status', 'scheduled')
        .lte('date', today) as unknown as Promise<{ data: JobRow[] | null }>)

      if (!data) return

      const overdue = data.filter(j => {
        let isOverdue = j.date < today
        if (!isOverdue && j.date === today && j.time_end) {
          const [h, m] = j.time_end.split(':').map(Number)
          isOverdue = nowMins > h * 60 + m
        }
        if (!isOverdue) return false
        if (seesAll) return true
        if (!myId) return false
        return j.sales_poc_id === myId
          || (j.job_coordinators ?? []).some(c => c.user_id === myId)
          || (j.job_assignees ?? []).some(a => a.user_id === myId && !a.is_suggestion)
      })

      // Sales POC names in a follow-up query — never embed users onto jobs
      // in a PostgREST select (standing rule; it has broken twice).
      const pocIds = [...new Set(overdue.map(j => j.sales_poc_id).filter(Boolean))] as string[]
      const nameById = new Map<string, string>()
      if (pocIds.length > 0) {
        type NameRow = { id: string; name: string }
        const { data: pocs } = await (supabase
          .from('users')
          .select('id, name')
          .in('id', pocIds) as unknown as Promise<{ data: NameRow[] | null }>)
        for (const p of pocs ?? []) nameById.set(p.id, p.name)
      }

      setOverdueJobs(overdue.map(j => ({
        id:            j.id,
        client:        j.client,
        project_title: j.project_title ?? null,
        date:          j.date,
        location:      j.location ?? null,
        sales_name:    j.sales_poc_id ? (nameById.get(j.sales_poc_id) ?? null) : null,
        coord_names:   (j.job_coordinators ?? []).map(c => c.users?.name).filter(Boolean).join(', ') || null,
        read:          seen[j.id] === j.date,
      })))
    } catch { /* best-effort */ }
  }, [])

  // Fetch on mount and whenever drawer opens
  useEffect(() => { fetchNotifs(); fetchOverdue() }, [fetchNotifs, fetchOverdue])
  useEffect(() => { if (open) { fetchNotifs(); fetchOverdue() } }, [open, fetchNotifs, fetchOverdue])

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

  // Overdue "Clear All" (R2-T2 edit 4) — overdue cards are computed live from
  // jobs, not DB rows, so there's nothing to delete; this is the same
  // per-device mark-as-read mechanism that used to live in the combined
  // handler, now triggered from the Overdue section header on its own.
  function handleClearOverdue() {
    if (overdueJobs.length === 0 || !seenKeyRef.current) return
    const seen: Record<string, string> = {}
    for (const j of overdueJobs) seen[j.id] = j.date
    try { localStorage.setItem(seenKeyRef.current, JSON.stringify(seen)) } catch { /* best-effort */ }
    setOverdueJobs(prev => prev.map(j => ({ ...j, read: true })))
  }

  // Updates "Clear All" (R2-T2 edit 4) — hard-deletes every one of the
  // caller's own notification rows (unlike the Overdue clear above, these
  // are real rows; RLS scopes the omitted-ids DELETE to the caller).
  async function handleClearAllUpdates() {
    if (notifs.length === 0) return
    setNotifs([])
    try {
      await fetch('/api/notifications', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
    } catch { /* best-effort */ }
  }

  // Per-card 'X' (R2-T2 edit 4) — deletes just that one notification row.
  async function deleteOne(id: string) {
    setNotifs(prev => prev.filter(n => n.id !== id))
    try {
      await fetch('/api/notifications', {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ids: [id] }),
      })
    } catch { /* best-effort — optimistic UI already updated */ }
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

  // Mark a single notification read — used by design_reminder's Yes (on a
  // successful complete) and No (edit 7 — this hides the card via
  // visibleNotifs above while keeping the row for the cron's 3-day snooze),
  // and by every other card type's own tap-to-navigate (edit 4 bullet 1).
  async function markRead(id: string) {
    try {
      await fetch('/api/notifications', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ids: [id] }),
      })
      setNotifs(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)))
    } catch { /* best-effort */ }
  }

  function handleReminderYes(id: string) {
    setOpenSliderId(id)
    setSliderNonce(x => x + 1) // fresh slider mount even when re-opening the same card
  }

  function handleReminderNo(id: string) {
    void markRead(id)
  }

  // Confirm inside the expanded slider — POSTs the rating the same way the
  // designer action bar does (JobDetailShell.handleDesignComplete). On
  // 409 no-jo-file the slider stays open and the notification stays unread,
  // mirroring that same handler's error path.
  async function handleReminderConfirm(n: InAppNotif, rating: number) {
    if (!n.job_id) return
    setRatingSubmitting(true)
    try {
      const res = await fetch(`/api/jobs/${n.job_id}/design-complete`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ rating }),
      })
      if (!res.ok) {
        if (res.status === 409 && await errorCodeOf(res) === 'no-jo-file') {
          showError(t(lang, 'designReminderNoJo'))
          return
        }
        throw new Error()
      }
      await markRead(n.id)
      setOpenSliderId(null)
      showSuccess(t(lang, 'savedSuccessfully'))
    } catch {
      showError(t(lang, 'saveError'))
    } finally {
      setRatingSubmitting(false)
    }
  }

  // Per-notification card renderer — branches by type. design_reminder gets
  // the Yes/No + inline slider (a read one never reaches here — visibleNotifs
  // filters it out, edit 7); design_assigned/design_due_shift parse their
  // JSON body for the assigner/client/install-date/due-date details (edit 4)
  // and fall back to the original single-line render for pre-upgrade rows;
  // everything else (sent_back, …) uses that same generic {title}/{body}
  // card. Clicking/tapping any card here marks it read AND navigates in one
  // tap (edit 4 bullet 1) — design_reminder is the one exception, since its
  // read state is governed entirely by Yes/No (edit 7), not by a body tap.
  function renderNotifCard(n: InAppNotif) {
    const checkbox = selectMode && (
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
    )

    // Per-card 'X' (edit 4 bullet 3) — hidden while bulk-selecting, since
    // that flow already has its own Delete action in the footer.
    const clearBtn = !selectMode && (
      <button
        type="button"
        onClick={() => void deleteOne(n.id)}
        aria-label={t(lang, 'notifClearOne')}
        title={t(lang, 'notifClearOne')}
        className="mt-3 shrink-0 p-1 text-muted hover:text-bad rounded transition-colors"
      >
        <X size={12} />
      </button>
    )

    const markReadAndNavigate = () => { handleClose(); if (!n.read) void markRead(n.id) }

    if (n.type === 'design_reminder') {
      const sliderOpen = openSliderId === n.id
      return (
        <div key={n.id} className="flex items-start gap-2">
          {checkbox}
          <div
            onClick={() => { if (n.job_id) { handleClose(); router.push(`/jobs/${n.job_id}`) } }}
            className="flex-1 p-3 rounded-xl border transition-colors cursor-pointer bg-terracotta-soft border-terracotta/30 hover:brightness-95"
          >
            <div className="flex items-start gap-2.5">
              <div className="shrink-0 mt-0.5">
                <span className="block w-2 h-2 rounded-full bg-terracotta mt-1" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-ink">
                  {t(lang, 'designReminderQ').replace('{title}', n.title)}
                </p>
                <p className="text-[10px] text-muted/60 mt-1">{timeAgo(n.created_at)}</p>
              </div>
            </div>

            {sliderOpen ? (
              <div onClick={e => e.stopPropagation()}>
                <DesignRatingSlider
                  key={`${n.id}-${sliderNonce}`}
                  lang={lang}
                  busy={ratingSubmitting}
                  onCancel={() => setOpenSliderId(null)}
                  onConfirm={rating => handleReminderConfirm(n, rating)}
                />
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-2.5" onClick={e => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => handleReminderYes(n.id)}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-brand-green text-white text-xs font-semibold hover:bg-brand-green/90 transition-colors"
                >
                  {t(lang, 'yesBtn')}
                </button>
                <button
                  type="button"
                  onClick={() => handleReminderNo(n.id)}
                  className="flex-1 px-3 py-1.5 rounded-lg border border-line text-ink2 text-xs font-medium hover:bg-bg transition-colors"
                >
                  {t(lang, 'noBtn')}
                </button>
              </div>
            )}
          </div>
          {clearBtn}
        </div>
      )
    }

    if (n.type === 'design_assigned') {
      const parsed = parseAssignedBody(n.body)
      return (
        <div key={n.id} className="flex items-start gap-2">
          {checkbox}
          <Link
            href={n.job_id ? `/jobs/${n.job_id}` : '#'}
            onClick={markReadAndNavigate}
            className={cn(
              'flex-1 flex items-start gap-2.5 p-3 rounded-xl border transition-colors group',
              n.read ? 'bg-paper border-line hover:brightness-95' : 'bg-terracotta-soft border-terracotta/30 hover:brightness-95',
            )}
          >
            <div className="shrink-0 mt-0.5">
              {!n.read && <span className="block w-2 h-2 rounded-full bg-terracotta mt-1" />}
              {n.read && <RotateCcw size={13} className="text-muted" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn('text-xs font-medium truncate', n.read ? 'text-ink2' : 'text-ink')}>{n.title}</p>
              {parsed ? (
                <>
                  <p className={cn('text-[11px] mt-0.5 truncate', n.read ? 'text-muted' : 'text-ink2')}>{parsed.projectTitle}</p>
                  <p className="text-[11px] text-muted mt-0.5 truncate">{t(lang, 'notifAssignedBy').replace('{name}', parsed.assignedBy)}</p>
                  <p className="text-[11px] text-muted mt-0.5 truncate">{t(lang, 'notifClientLine').replace('{client}', parsed.client)}</p>
                  <p className="text-[11px] text-muted mt-0.5">{t(lang, 'notifInstallLine').replace('{date}', formatDate(parsed.installDate))}</p>
                </>
              ) : (
                n.body && <p className="text-[11px] text-muted mt-0.5 line-clamp-2">{n.body}</p>
              )}
              <p className="text-[10px] text-muted/60 mt-1">{timeAgo(n.created_at)}</p>
            </div>
            <ArrowRight size={12} className="text-muted group-hover:text-ink2 mt-0.5 shrink-0 transition-colors" />
          </Link>
          {clearBtn}
        </div>
      )
    }

    if (n.type === 'design_due_shift') {
      const parsed = parseDueShiftBody(n.body)
      return (
        <div key={n.id} className="flex items-start gap-2">
          {checkbox}
          <Link
            href={n.job_id ? `/jobs/${n.job_id}` : '#'}
            onClick={markReadAndNavigate}
            className={cn(
              'flex-1 flex items-start gap-2.5 p-3 rounded-xl border transition-colors group',
              n.read ? 'bg-paper border-line hover:brightness-95' : 'bg-terracotta-soft border-terracotta/30 hover:brightness-95',
            )}
          >
            <div className="shrink-0 mt-0.5">
              {!n.read && <span className="block w-2 h-2 rounded-full bg-terracotta mt-1" />}
              {n.read && <RotateCcw size={13} className="text-muted" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn('text-xs font-medium truncate', n.read ? 'text-ink2' : 'text-ink')}>{n.title}</p>
              {parsed ? (
                <>
                  <p className="text-[11px] text-muted mt-0.5">
                    {t(lang, 'notifDuePrefix')} {formatDate(parsed.oldDue)} → {formatDate(parsed.newDue)}
                  </p>
                  <p className="text-[11px] text-muted mt-0.5 truncate">{t(lang, 'notifClientLine').replace('{client}', parsed.client)}</p>
                  <p className="text-[11px] text-muted mt-0.5">{t(lang, 'notifInstallLine').replace('{date}', formatDate(parsed.installDate))}</p>
                </>
              ) : (
                n.body && <p className="text-[11px] text-muted mt-0.5">{n.body}</p>
              )}
              <p className="text-[10px] text-muted/60 mt-1">{timeAgo(n.created_at)}</p>
            </div>
            <ArrowRight size={12} className="text-muted group-hover:text-ink2 mt-0.5 shrink-0 transition-colors" />
          </Link>
          {clearBtn}
        </div>
      )
    }

    return (
      <div key={n.id} className="flex items-start gap-2">
        {checkbox}
        <Link
          href={n.job_id ? `/jobs/${n.job_id}` : '#'}
          onClick={markReadAndNavigate}
          className={cn(
            'flex-1 flex items-start gap-2.5 p-3 rounded-xl border transition-colors group',
            n.read ? 'bg-paper border-line hover:brightness-95' : 'bg-terracotta-soft border-terracotta/30 hover:brightness-95',
          )}
        >
          <div className="shrink-0 mt-0.5">
            {!n.read && <span className="block w-2 h-2 rounded-full bg-terracotta mt-1" />}
            {n.read && <RotateCcw size={13} className="text-muted" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className={cn('text-xs font-medium truncate', n.read ? 'text-ink2' : 'text-ink')}>{n.title}</p>
            {n.body && <p className="text-[11px] text-muted mt-0.5 line-clamp-2">{n.body}</p>}
            <p className="text-[10px] text-muted/60 mt-1">{timeAgo(n.created_at)}</p>
          </div>
          <ArrowRight size={12} className="text-muted group-hover:text-ink2 mt-0.5 shrink-0 transition-colors" />
        </Link>
        {clearBtn}
      </div>
    )
  }

  return (
    <>
      {/* ── Bell button ── */}
      <button
        onClick={handleOpen}
        aria-label={t(lang, 'notifications')}
        className={cn(
          'flex items-center gap-1.5 px-2 py-2 rounded-lg border transition-colors',
          unreadOverdue > 0
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
          {visibleNotifs.length === 0 && overdueJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 px-4 text-center">
              <Bell size={28} className="text-muted" strokeWidth={1.5} />
              <p className="text-sm text-muted">{t(lang, 'notificationsNone')}</p>
            </div>
          ) : (
            <div className="px-3 py-3 space-y-4">

              {/* ── Sent-back notifications ── */}
              {visibleNotifs.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <p className="text-[11px] text-muted uppercase tracking-widest">
                      Updates
                    </p>
                    {!selectMode && (
                      <button
                        type="button"
                        onClick={() => void handleClearAllUpdates()}
                        className="text-[10px] font-medium text-muted hover:text-ink2 transition-colors"
                      >
                        {t(lang, 'notifClearAll')}
                      </button>
                    )}
                  </div>
                  {visibleNotifs.map(renderNotifCard)}
                </div>
              )}

              {/* ── Overdue jobs ── */}
              {overdueJobs.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <p className="text-[11px] text-muted uppercase tracking-widest">
                      {overdueJobs.length} {t(lang, 'overdueCount')}
                    </p>
                    <button
                      type="button"
                      onClick={handleClearOverdue}
                      className="text-[10px] font-medium text-muted hover:text-ink2 transition-colors"
                    >
                      {t(lang, 'notifClearAll')}
                    </button>
                  </div>
                  {overdueJobs.map(job => (
                    <Link
                      key={job.id}
                      href={`/jobs/${job.id}`}
                      onClick={handleClose}
                      className={cn(
                        'flex items-start gap-2.5 p-3 rounded-xl border hover:brightness-95 transition-colors group',
                        job.read ? 'border-line bg-paper' : 'border-bad bg-bad-soft',
                      )}
                    >
                      <Hourglass size={14} className={cn('mt-0.5 shrink-0', job.read ? 'text-muted' : 'text-bad')} />
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-xs font-medium truncate', job.read ? 'text-ink2' : 'text-bad')}>
                          {job.project_title || job.client || 'Untitled job'}
                        </p>
                        {job.project_title && (
                          <p className={cn('text-[11px] mt-0.5 truncate', job.read ? 'text-muted' : 'text-bad/70')}>{job.client || 'Untitled'}</p>
                        )}
                        <p className={cn('text-[11px] mt-0.5', job.read ? 'text-muted' : 'text-bad/70')}>{fmtOverdueDate(job.date)}</p>
                        {job.location && (
                          <p className={cn('text-[11px] truncate', job.read ? 'text-muted/70' : 'text-bad/60')}>{job.location}</p>
                        )}
                        <p className={cn('text-[11px] truncate', job.read ? 'text-muted/70' : 'text-bad/60')}>Sales: {job.sales_name || 'NIL'}</p>
                        <p className={cn('text-[11px] truncate', job.read ? 'text-muted/70' : 'text-bad/60')}>Coordinator: {job.coord_names || 'NIL'}</p>
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

        {/* Footer — Delete controls (only when there are visible in-app notifs) */}
        {visibleNotifs.length > 0 && (
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
