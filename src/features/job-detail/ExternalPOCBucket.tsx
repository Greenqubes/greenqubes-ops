'use client'

import { useEffect, useState } from 'react'
import { Plus, Globe, Trash2, Link2, TriangleAlert, Check } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { useToast } from '@/components/Toast'
import { t } from '@/lib/i18n'
import { cn } from '@/lib/utils/cn'
import type { LangCode } from '@/lib/i18n'
import type { Role } from '@/lib/supabase/types'

type ExtContact = {
  id:               string
  name:             string
  phone:            string
  token:            string
  url:              string
  deleted_at:       string | null
  job_count:        number
  active_job_count: number
}

type LinkStatus = 'pending' | 'accepted' | 'declined'
type JobLink    = { status: LinkStatus; is_suggestion: boolean }

interface Props {
  jobId:     string
  lang:      LangCode
  role:      Role
  /** Completed jobs lock the bucket. */
  readOnly:  boolean
}

const AVATAR_COLORS = ['#5C7A6B', '#7A6B8A', '#6B7A8A', '#8A6B6B', '#6B8A7A', '#8A7A6B']

function initials(name: string) {
  return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
}

// External installer POC bucket (Team card, approved mockup). "External
// Installers" is NOT a user role — contacts persist across jobs with one
// lifetime link each. Assign existing people, add new ones (link minted
// immediately), delete with a warning (link dies instantly), restore with
// full history. Scheduler / coordinator / admin only — the parent gates
// rendering, RLS + routes gate the data.
export function ExternalPOCBucket({ jobId, lang, role, readOnly }: Props) {
  const { success: showSuccess, error: showError } = useToast()

  // Everyone office-side SEES the bucket (Nic, Phase 4 smoke test). Managers
  // assign + manage the pool; sales suggest (amber, confirmed by a manager);
  // designer/production are strictly view-only.
  const isManager = (['scheduler', 'coordinator', 'admin'] as Role[]).includes(role) && !readOnly
  const isSales   = role === 'sales' && !readOnly

  const [open,      setOpen]      = useState(false)
  const [loaded,    setLoaded]    = useState(false)
  const [contacts,  setContacts]  = useState<ExtContact[]>([])
  const [links,     setLinks]     = useState<Map<string, JobLink>>(new Map())
  const [showAdd,   setShowAdd]   = useState(false)
  const [newName,   setNewName]   = useState('')
  const [newPhone,  setNewPhone]  = useState('')
  const [saving,    setSaving]    = useState(false)
  const [deleting,  setDeleting]  = useState<ExtContact | null>(null)
  const [restoring, setRestoring] = useState<ExtContact | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch('/api/external-contacts').then(r => r.ok ? r.json() : []),
      fetch(`/api/jobs/${jobId}/external-contacts`).then(r => r.ok ? r.json() : []),
    ]).then(([all, assigned]: [ExtContact[], Array<{ contact_id: string; status: LinkStatus; is_suggestion: boolean }>]) => {
      if (cancelled) return
      setContacts(all)
      setLinks(new Map(assigned.map(a => [a.contact_id, { status: a.status, is_suggestion: a.is_suggestion }])))
      if (assigned.length > 0) setOpen(true)
      setLoaded(true)
    }).catch(() => { if (!cancelled) setLoaded(true) })
    return () => { cancelled = true }
  }, [jobId])

  // Manager → real link (or confirms a sales suggestion in place).
  // Sales   → suggestion (server decides by role; UI mirrors it).
  const assignContact = async (contactId: string) => {
    const prev = links.get(contactId)
    setLinks(p => new Map(p).set(contactId, { status: 'pending', is_suggestion: !isManager }))
    try {
      const res = await fetch(`/api/jobs/${jobId}/external-contacts`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ contact_id: contactId }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setLinks(p => {
        const next = new Map(p)
        if (prev) next.set(contactId, prev); else next.delete(contactId)
        return next
      })
      showError(t(lang, 'saveError'))
    }
  }

  const unassignContact = async (contactId: string) => {
    const prev = links.get(contactId)
    setLinks(p => { const next = new Map(p); next.delete(contactId); return next })
    try {
      const res = await fetch(`/api/jobs/${jobId}/external-contacts`, {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ contact_id: contactId }),
      })
      if (!res.ok) throw new Error()
    } catch {
      if (prev) setLinks(p => new Map(p).set(contactId, prev))
      showError(t(lang, 'saveError'))
    }
  }

  const addNewContact = async () => {
    const name = newName.trim()
    if (!name || saving) return
    setSaving(true)
    try {
      const res = await fetch('/api/external-contacts', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name, phone: newPhone.trim() }),
      })
      if (!res.ok) throw new Error()
      const contact: ExtContact = await res.json()
      setContacts(prev => [...prev, contact])
      setNewName('')
      setNewPhone('')
      setShowAdd(false)
      await assignContact(contact.id)
      copyLink(contact)
    } catch {
      showError(t(lang, 'saveError'))
    } finally {
      setSaving(false)
    }
  }

  // Compose from the site we're on RIGHT NOW — not NEXT_PUBLIC_APP_URL, which
  // names production in every Vercel environment. On the preview this copies a
  // preview link (production has no /ext until the clean-cut switchover).
  const copyLink = (contact: ExtContact) => {
    const url = `${window.location.origin}/ext/${contact.token}`
    if (!navigator.clipboard) {
      window.prompt(t(lang, 'extBucketCopyLink'), url)
      return
    }
    navigator.clipboard.writeText(url)
      .then(() => showSuccess(t(lang, 'extBucketLinkCopied')))
      .catch(() => window.prompt(t(lang, 'extBucketCopyLink'), url))
  }

  const deleteContact = async () => {
    if (!deleting) return
    const id = deleting.id
    setDeleting(null)
    setContacts(prev => prev.map(c =>
      c.id === id ? { ...c, deleted_at: new Date().toISOString() } : c,
    ))
    try {
      const res = await fetch(`/api/external-contacts/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
    } catch {
      setContacts(prev => prev.map(c => c.id === id ? { ...c, deleted_at: null } : c))
      showError(t(lang, 'saveError'))
    }
  }

  const restoreContact = async () => {
    if (!restoring) return
    const id = restoring.id
    setRestoring(null)
    setContacts(prev => prev.map(c => c.id === id ? { ...c, deleted_at: null } : c))
    try {
      const res = await fetch(`/api/external-contacts/${id}`, { method: 'PATCH' })
      if (!res.ok) throw new Error()
    } catch {
      setContacts(prev => prev.map(c =>
        c.id === id ? { ...c, deleted_at: new Date().toISOString() } : c,
      ))
      showError(t(lang, 'saveError'))
    }
  }

  const active  = contacts.filter(c => !c.deleted_at)
  const deleted = contacts.filter(c => c.deleted_at)

  if (!open) {
    // View-only roles get the bucket only when it default-opens (job already
    // has contacts) — a trigger button they can't use is just noise.
    if (!isManager && !isSales) return null
    return (
      <div className="border-t border-line px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full flex items-center justify-center gap-1.5 rounded-lg border-[1.5px] border-dashed border-line bg-bg px-4 py-2 text-xs font-semibold text-ink2 hover:border-brand-amber hover:text-ink transition-colors"
        >
          <Plus size={13} />
          {t(lang, 'extBucketAdd')}
        </button>
      </div>
    )
  }

  const statusChip = (link: JobLink | undefined, contactId: string) => {
    // Not on this job yet: managers Assign, sales Suggest, others see nothing.
    if (!link) {
      if (!isManager && !isSales) return null
      return (
        <button
          type="button"
          onClick={() => assignContact(contactId)}
          className="text-[10px] font-bold px-2 py-1 rounded-md border border-line bg-bg text-ink2"
        >
          + {t(lang, isManager ? 'extBucketAssign' : 'extBucketSuggest')}
        </button>
      )
    }

    // Sales suggestion (amber): manager taps to CONFIRM (upgrades the row);
    // sales taps to retract their own suggestion; others just see the label.
    if (link.is_suggestion) {
      const label = t(lang, isSales ? 'extBucketSuggested' : 'extBucketSalesSuggested')
      const action = isManager ? () => assignContact(contactId)
                   : isSales   ? () => unassignContact(contactId)
                   : undefined
      return (
        <button
          type="button"
          disabled={!action}
          onClick={action}
          title={isManager ? t(lang, 'fcfsConfirm') : isSales ? t(lang, 'extBucketRemove') : undefined}
          className="text-[10px] font-bold px-2 py-1 rounded-md border bg-brand-amber-soft border-brand-amber/40 text-brand-amber disabled:opacity-100"
        >
          {label}
        </button>
      )
    }

    const label =
      link.status === 'accepted' ? t(lang, 'extBucketAccepted') :
      link.status === 'declined' ? t(lang, 'extBucketDeclined') :
      t(lang, 'extBucketAssigned')
    return (
      <button
        type="button"
        disabled={!isManager}
        onClick={() => unassignContact(contactId)}
        title={isManager ? t(lang, 'extBucketRemove') : undefined}
        className={cn(
          'text-[10px] font-bold px-2 py-1 rounded-md border disabled:opacity-100',
          link.status === 'accepted' ? 'bg-brand-green-soft border-brand-green/30 text-brand-green' :
          link.status === 'declined' ? 'bg-terracotta-soft border-terracotta/30 text-terracotta' :
          'bg-brand-amber-soft border-brand-amber/40 text-brand-amber',
        )}
      >
        {label}
      </button>
    )
  }

  return (
    <div className="border-t border-line px-4 pt-3 pb-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-muted flex items-center gap-1.5">
          <Globe size={12} />
          {t(lang, 'extBucketTitle')}
        </p>
        {(isManager || isSales) && (
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-[11px] font-semibold text-terracotta"
          >
            {t(lang, 'extBucketRemove')}
          </button>
        )}
      </div>

      {!loaded && <p className="text-xs text-muted py-2">{t(lang, 'loading')}</p>}

      {/* Existing contacts */}
      {loaded && active.length > 0 && (
        <>
          <p className="text-[13px] font-semibold uppercase tracking-wide text-muted/70 mb-1.5">
            {t(lang, 'extBucketPrevUsed')}
          </p>
          <div className="space-y-1.5 mb-2.5">
            {active.map((c, i) => (
              <div
                key={c.id}
                className={cn(
                  'rounded-xl border-[1.5px] px-3 py-2.5 flex items-center gap-2.5',
                  links.get(c.id)?.status === 'accepted' ? 'border-brand-green bg-brand-green/10' :
                  links.get(c.id)                        ? 'border-brand-amber bg-brand-amber/10' :
                  'border-line bg-paper',
                )}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold text-white shrink-0"
                  style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}
                >
                  {initials(c.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink truncate">{c.name}</p>
                  <p className="text-[11px] text-muted truncate">
                    {[c.phone, `${c.job_count} ${t(lang, c.job_count === 1 ? 'extBucketPastJob' : 'extBucketPastJobs')}`]
                      .filter(Boolean).join(' · ')}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {statusChip(links.get(c.id), c.id)}
                  {(isManager || isSales) && (
                    <button
                      type="button"
                      onClick={() => copyLink(c)}
                      title={t(lang, 'extBucketCopyLink')}
                      className="w-7 h-7 rounded-md border border-line bg-bg flex items-center justify-center text-muted hover:text-brand-blue hover:border-brand-blue transition-colors"
                    >
                      <Link2 size={12} />
                    </button>
                  )}
                  {isManager && (
                    <button
                      type="button"
                      onClick={() => setDeleting(c)}
                      title={t(lang, 'extBucketDeleteConfirm')}
                      className="w-7 h-7 rounded-md border border-line bg-bg flex items-center justify-center text-muted hover:text-terracotta hover:border-terracotta transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Deleted contacts — restorable forever (manager housekeeping only) */}
      {loaded && isManager && deleted.length > 0 && (
        <div className="space-y-1.5 mb-2.5">
          {deleted.map(c => (
            <div key={c.id} className="rounded-xl border-[1.5px] border-line bg-bg/60 overflow-hidden opacity-80">
              <div className="px-3 py-2.5 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-line flex items-center justify-center text-[11px] font-semibold text-paper shrink-0">
                  {initials(c.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-muted line-through truncate">{c.name}</p>
                  <p className="text-[11px] text-muted truncate">{t(lang, 'extBucketDeleted')}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setRestoring(c)}
                  className="text-[10px] font-bold px-2 py-1 rounded-md border border-brand-blue/40 bg-brand-blue-soft text-brand-blue shrink-0"
                >
                  {t(lang, 'extBucketRestore')}
                </button>
              </div>
              {c.active_job_count > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-amber/10 border-t border-line">
                  <TriangleAlert size={11} className="text-brand-amber shrink-0" />
                  <p className="text-[10px] text-brand-amber">
                    {c.active_job_count} {t(lang, 'extBucketSuspended')}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add new contact — pool management is manager-only */}
      {isManager && !showAdd && loaded && (
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="w-full flex items-center justify-center gap-1.5 rounded-lg border-[1.5px] border-dashed border-line bg-bg px-4 py-2 text-xs font-semibold text-ink2 hover:border-brand-amber hover:text-ink transition-colors"
        >
          <Plus size={12} />
          {t(lang, 'extBucketAddNew')}
        </button>
      )}

      {showAdd && (
        <div className="rounded-xl border border-dashed border-line bg-bg p-3 space-y-2">
          <p className="text-[13px] font-semibold uppercase tracking-wide text-muted">
            {t(lang, 'extBucketAddNew')}
          </p>
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder={t(lang, 'extBucketName')}
              className="flex-1 min-w-0 rounded-lg border border-line bg-paper px-3 py-1.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:border-terracotta focus:ring-terracotta/20"
            />
            <input
              value={newPhone}
              onChange={e => setNewPhone(e.target.value)}
              placeholder={t(lang, 'extBucketPhone')}
              className="flex-1 min-w-0 rounded-lg border border-line bg-paper px-3 py-1.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:border-terracotta focus:ring-terracotta/20"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void addNewContact()}
              disabled={!newName.trim() || saving}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-ink text-paper px-3 py-2 text-xs font-bold disabled:opacity-40"
            >
              <Plus size={12} />
              {saving ? t(lang, 'loading') : t(lang, 'extBucketAddGenerate')}
            </button>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="rounded-lg border border-line bg-paper px-3 py-2 text-xs font-semibold text-ink2"
            >
              {t(lang, 'cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      <Modal isOpen={deleting !== null} onClose={() => setDeleting(null)}>
        {deleting && (
          <div className="space-y-3">
            <h2 className="font-display text-lg font-medium text-ink">
              {t(lang, 'extBucketDeleteVerb')} {deleting.name}?
            </h2>
            <p className="text-sm text-muted">{t(lang, 'extBucketDeleteSub')}</p>
            <div className="flex items-start gap-2 rounded-lg border border-terracotta/30 bg-terracotta-soft px-3 py-2.5">
              <TriangleAlert size={14} className="text-terracotta shrink-0 mt-0.5" />
              <p className="text-xs text-terracotta leading-relaxed">
                {t(lang, 'extBucketDeleteWarn')}
                {deleting.active_job_count > 0 &&
                  ` ${deleting.active_job_count} ${t(lang, deleting.active_job_count === 1 ? 'extBucketActiveJob' : 'extBucketActiveJobs')}`}
              </p>
            </div>
            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={() => void deleteContact()}
                className="w-full rounded-[10px] bg-terracotta text-white py-2.5 text-sm font-semibold"
              >
                {t(lang, 'extBucketDeleteConfirm')}
              </button>
              <button
                type="button"
                onClick={() => setDeleting(null)}
                className="w-full rounded-[10px] bg-bg text-ink2 py-2.5 text-sm font-semibold"
              >
                {t(lang, 'cancel')}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Restore confirmation */}
      <Modal isOpen={restoring !== null} onClose={() => setRestoring(null)}>
        {restoring && (
          <div className="space-y-3">
            <h2 className="font-display text-lg font-medium text-ink">
              {t(lang, 'extBucketRestoreVerb')} {restoring.name}?
            </h2>
            <p className="text-sm text-muted">{t(lang, 'extBucketRestoreSub')}</p>
            <div className="flex items-start gap-2 rounded-lg border border-brand-green/30 bg-brand-green-soft px-3 py-2.5">
              <Check size={14} className="text-brand-green shrink-0 mt-0.5" strokeWidth={3} />
              <p className="text-xs text-brand-green leading-relaxed">{t(lang, 'extBucketRestoreInfo')}</p>
            </div>
            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={() => void restoreContact()}
                className="w-full rounded-[10px] bg-brand-green text-white py-2.5 text-sm font-semibold"
              >
                {t(lang, 'extBucketRestoreConfirm')}
              </button>
              <button
                type="button"
                onClick={() => setRestoring(null)}
                className="w-full rounded-[10px] bg-bg text-ink2 py-2.5 text-sm font-semibold"
              >
                {t(lang, 'cancel')}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
