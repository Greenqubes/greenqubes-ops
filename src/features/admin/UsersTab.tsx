'use client'

import { useEffect, useState, useCallback } from 'react'
import { Pill }    from '@/components/Pill'
import { Btn }     from '@/components/Btn'
import { Card }    from '@/components/Card'
import { cn }      from '@/lib/utils/cn'
import type { AdminUser } from '@/lib/supabase/queries/admin'
import type { Role, LangCode } from '@/lib/supabase/types'
import { linkStatus, filterUsers, subroleSuggestions, qualificationSuggestions } from '@/lib/utils/user-meta'
import { LinkDot, DriverChip } from '@/components/UserMetaLine'

const ROLES: Role[]     = ['sales', 'scheduler', 'coordinator', 'installer', 'designer', 'production', 'admin']
const LANGS: LangCode[] = ['en', 'zh', 'bn']

// ── Admin role confirmation modal ──────────────────────────────────────────

type ModalPhase = 'confirm' | 'success'

function AdminRoleModal({
  phase,
  email,
  onConfirm,
  onCancel,
  onClose,
}: {
  phase:     ModalPhase
  email:     string
  onConfirm: () => void
  onCancel:  () => void
  onClose:   () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm px-4">
      <div className="bg-paper border border-line rounded-card shadow-lg w-full max-w-sm p-6 flex flex-col gap-4">
        {phase === 'confirm' ? (
          <>
            <p className="font-display font-medium text-ink text-base">Are you sure?</p>
            <p className="text-sm text-ink2">
              This user will have unrestricted access to the whole system.
            </p>
            <div className="flex gap-2 justify-end">
              <Btn variant="ghost" size="sm" onClick={onCancel}>No</Btn>
              <Btn variant="accent" size="sm" onClick={onConfirm}>Yes</Btn>
            </div>
          </>
        ) : (
          <>
            <p className="font-display font-medium text-ink text-base">
              {email} is now Admin!
            </p>
            <div className="flex justify-end">
              <Btn variant="primary" size="sm" onClick={onClose}>Ok</Btn>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Provision form ─────────────────────────────────────────────────────────────

function ProvisionForm({ onDone, allUsers }: { onDone: () => void; allUsers: AdminUser[] }) {
  const [email,        setEmail]        = useState('')
  const [name,         setName]         = useState('')
  const [role,         setRole]         = useState<Role>('installer')
  const [lang,         setLang]         = useState<LangCode>('en')
  const [subrole,      setSubrole]      = useState('')
  const [subroleInput, setSubroleInput] = useState('')
  const [isDriver,     setIsDriver]     = useState(false)
  const [quals,        setQuals]        = useState<string[]>([])
  const [qualInput,    setQualInput]    = useState('')
  const [busy,         setBusy]         = useState(false)
  const [err,          setErr]          = useState<string | null>(null)
  const [showModal,    setShowModal]    = useState(false)
  const [pendingRole,  setPendingRole]  = useState<Role | null>(null)

  function addQual(raw: string) {
    const tag = raw.trim().replace(/,+$/, '').trim()
    if (tag && !quals.includes(tag)) setQuals(prev => [...prev, tag])
    setQualInput('')
  }

  function handleRoleChange(next: Role) {
    if (next === 'admin') {
      setPendingRole(next)
      setShowModal(true)
    } else {
      setRole(next)
    }
  }

  function confirmAdmin() {
    if (pendingRole) setRole(pendingRole)
    setPendingRole(null)
    setShowModal(false)
  }

  function cancelAdmin() {
    setPendingRole(null)
    setShowModal(false)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setErr(null)
    try {
      const res = await fetch('/api/admin/users', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          email:          email.trim() || null,
          name, role, lang,
          subrole:        subrole.trim() || null,
          is_driver:      isDriver,
          qualifications: quals,
        }),
      })
      if (!res.ok) {
        const { error } = await res.json() as { error: string }
        throw new Error(error)
      }
      setEmail(''); setName(''); setSubrole(''); setSubroleInput('')
      setIsDriver(false); setQuals([]); setQualInput('')
      onDone()
    } catch (err) {
      setErr((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {showModal && (
        <AdminRoleModal
          phase="confirm"
          email={email || 'This user'}
          onConfirm={confirmAdmin}
          onCancel={cancelAdmin}
          onClose={cancelAdmin}
        />
      )}
      <Card className="p-4 mb-4">
        <p className="text-[11px] uppercase tracking-widest text-muted font-medium mb-3">
          Provision new user
        </p>
        <form onSubmit={submit} className="flex flex-col gap-2.5">
          <input
            className="w-full border border-line rounded-lg px-3 py-2 text-sm text-ink bg-bg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-terracotta/40"
            placeholder="Google account email — leave blank for a name card only"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          <input
            className="w-full border border-line rounded-lg px-3 py-2 text-sm text-ink bg-bg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-terracotta/40"
            placeholder="Display name"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
          <div className="flex gap-2">
            <select
              className="flex-1 border border-line rounded-lg px-3 py-2 text-sm text-ink bg-bg focus:outline-none focus:ring-2 focus:ring-terracotta/40"
              value={role}
              onChange={e => handleRoleChange(e.target.value as Role)}
            >
              {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
            </select>
            <select
              className="w-24 border border-line rounded-lg px-3 py-2 text-sm text-ink bg-bg focus:outline-none focus:ring-2 focus:ring-terracotta/40"
              value={lang}
              onChange={e => setLang(e.target.value as LangCode)}
            >
              {LANGS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>

          <div className="flex gap-2">
            <input
              className="flex-1 border border-line rounded-lg px-3 py-2 text-sm text-ink bg-bg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-terracotta/40"
              placeholder="Subrole — e.g. metalworks, printing"
              value={subroleInput}
              onChange={e => setSubroleInput(e.target.value)}
              list="subrole-suggestions"
            />
            <Btn type="button" variant="ghost" size="sm"
                 onClick={() => { if (subroleInput.trim()) { setSubrole(subroleInput.trim()); setSubroleInput('') } }}>
              Insert
            </Btn>
          </div>
          <datalist id="subrole-suggestions">
            {subroleSuggestions(allUsers, role).map(s => <option key={s} value={s} />)}
          </datalist>
          {subrole && (
            <span className="self-start flex items-center gap-1 text-xs bg-bg border border-line rounded-full px-2.5 py-0.5 text-ink">
              {subrole}
              <button type="button" onClick={() => setSubrole('')} className="text-muted hover:text-terracotta leading-none">×</button>
            </span>
          )}

          {role === 'installer' && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="accent-terracotta w-4 h-4"
                     checked={isDriver} onChange={e => setIsDriver(e.target.checked)} />
              <span className="text-sm text-ink">Driver (licensed vehicle operator)</span>
            </label>
          )}

          <div className="flex flex-wrap gap-1.5">
            {quals.map(q => (
              <span key={q} className="flex items-center gap-1 text-xs bg-bg border border-line rounded-full px-2.5 py-0.5 text-ink">
                {q}
                <button type="button" onClick={() => setQuals(prev => prev.filter(x => x !== q))}
                        className="text-muted hover:text-terracotta leading-none">×</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className="flex-1 border border-line rounded-lg px-3 py-2 text-sm text-ink bg-bg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-terracotta/40"
              placeholder="Qualifications — e.g. WAH, Safety Supervisor"
              value={qualInput}
              onChange={e => {
                const v = e.target.value
                if (v.endsWith(',')) { addQual(v.slice(0, -1)); return }
                setQualInput(v)
              }}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addQual(qualInput) } }}
              list="qual-suggestions"
            />
            <Btn type="button" variant="ghost" size="sm" onClick={() => addQual(qualInput)}>
              Insert
            </Btn>
          </div>
          <datalist id="qual-suggestions">
            {qualificationSuggestions(allUsers).map(q => <option key={q} value={q} />)}
          </datalist>

          {err && <p className="text-xs text-red-500">{err}</p>}
          <Btn type="submit" variant="accent" size="sm" disabled={busy}>
            {busy ? 'Adding…' : 'Add user'}
          </Btn>
        </form>
      </Card>
    </>
  )
}

// ── Delete user confirmation modal ────────────────────────────────────────────

function DeleteUserModal({
  user,
  onConfirm,
  onCancel,
  busy,
  err,
}: {
  user:      AdminUser
  onConfirm: () => void
  onCancel:  () => void
  busy:      boolean
  err:       string | null
}) {
  const isProvisioned = user.auth_id === null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm px-4">
      <div className="bg-paper border border-line rounded-card shadow-lg w-full max-w-sm p-6 flex flex-col gap-4">
        <p className="font-display font-medium text-ink text-base">
          {isProvisioned ? 'Remove provisioned user?' : 'Remove access?'}
        </p>
        <p className="text-sm text-ink2">
          {isProvisioned
            ? `${user.name} hasn't signed in yet. This will delete them permanently.`
            : `${user.name} will no longer be able to sign in. Their name will remain on past jobs and messages.`}
        </p>
        {err && <p className="text-xs text-red-500">{err}</p>}
        <div className="flex gap-2 justify-end">
          <Btn variant="ghost" size="sm" onClick={onCancel} disabled={busy}>Cancel</Btn>
          <Btn
            variant="accent"
            size="sm"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Removing…' : 'Remove'}
          </Btn>
        </div>
      </div>
    </div>
  )
}

// ── User row ───────────────────────────────────────────────────────────────────

function UserRow({ user, allUsers, onSaved }: { user: AdminUser; allUsers: AdminUser[]; onSaved: () => void }) {
  const [editing,       setEditing]       = useState(false)
  const [role,          setRole]          = useState<Role>(user.role)
  const [tgId,          setTgId]          = useState(user.telegram_chat_id ?? '')
  const [digestSub,     setDigestSub]     = useState(user.digest_subscriber)
  const [name,          setName]          = useState(user.name)
  const [email,         setEmail]         = useState(user.email ?? '')
  const [subrole,       setSubrole]       = useState(user.subrole ?? '')
  const [subroleInput,  setSubroleInput]  = useState('')
  const [isDriver,      setIsDriver]      = useState(user.is_driver)
  const [quals,         setQuals]         = useState<string[]>(user.qualifications ?? [])
  const [qualInput,     setQualInput]     = useState('')
  const [busy,          setBusy]          = useState(false)
  const [err,           setErr]           = useState<string | null>(null)
  const [modalPhase,    setModalPhase]    = useState<'confirm' | 'success' | null>(null)
  const [prevRole,      setPrevRole]      = useState<Role>(user.role)
  const [showDelete,    setShowDelete]    = useState(false)
  const [deleteBusy,    setDeleteBusy]    = useState(false)
  const [deleteErr,     setDeleteErr]     = useState<string | null>(null)

  function addQual(raw: string) {
    const tag = raw.trim().replace(/,+$/, '').trim()
    if (tag && !quals.includes(tag)) setQuals(prev => [...prev, tag])
    setQualInput('')
  }

  function handleRoleChange(next: Role) {
    if (next === 'admin') {
      setPrevRole(role)
      setRole('admin')
      setModalPhase('confirm')
    } else {
      setRole(next)
    }
  }

  async function confirmAdmin() {
    setBusy(true); setErr(null)
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          role:              'admin',
          telegram_chat_id:  tgId.trim() || null,
          digest_subscriber: digestSub,
        }),
      })
      if (!res.ok) {
        const { error } = await res.json() as { error: string }
        throw new Error(error)
      }
      setModalPhase('success')
    } catch (err) {
      setErr((err as Error).message)
      setRole(prevRole)
      setModalPhase(null)
    } finally {
      setBusy(false)
    }
  }

  function cancelAdmin() {
    setRole(prevRole)
    setModalPhase(null)
  }

  function closeSuccessModal() {
    setModalPhase(null)
    setEditing(false)
    onSaved()
  }

  async function save() {
    setBusy(true); setErr(null)
    try {
      const body: Record<string, unknown> = {
        role,
        telegram_chat_id:  tgId.trim() || null,
        digest_subscriber: digestSub,
        subrole:           subrole.trim() || null,
        is_driver:         isDriver,
        qualifications:    quals,
      }
      if (user.name !== 'GreenqubesAI') {
        body.name  = name.trim()
        body.email = email.trim() || null
      }
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      if (!res.ok) {
        const { error } = await res.json() as { error: string }
        throw new Error(error)
      }
      setEditing(false)
      onSaved()
    } catch (err) {
      setErr((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function confirmDelete() {
    setDeleteBusy(true); setDeleteErr(null)
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = res.headers.get('content-type')?.includes('application/json')
          ? await res.json() as { error?: string }
          : {} as { error?: string }
        if (res.status >= 400 && res.status < 500) {
          throw new Error(body.error ?? `HTTP ${res.status}`)
        }
        throw new Error('Something went wrong. Please try again.')
      }
      setShowDelete(false)
      onSaved()
    } catch (err) {
      setDeleteErr((err as Error).message)
    } finally {
      setDeleteBusy(false)
    }
  }

  function cancel() {
    setRole(user.role)
    setTgId(user.telegram_chat_id ?? '')
    setDigestSub(user.digest_subscriber)
    setName(user.name)
    setEmail(user.email ?? '')
    setSubrole(user.subrole ?? '')
    setSubroleInput('')
    setIsDriver(user.is_driver)
    setQuals(user.qualifications ?? [])
    setQualInput('')
    setEditing(false)
    setErr(null)
  }

  const joined = new Date(user.created_at).toLocaleDateString('en-SG', {
    day: 'numeric', month: 'short', year: 'numeric',
  })

  return (
    <>
      {modalPhase && (
        <AdminRoleModal
          phase={modalPhase}
          email={user.email ?? user.name}
          onConfirm={confirmAdmin}
          onCancel={cancelAdmin}
          onClose={closeSuccessModal}
        />
      )}
      {showDelete && (
        <DeleteUserModal
          user={user}
          onConfirm={confirmDelete}
          onCancel={() => { setShowDelete(false); setDeleteErr(null) }}
          busy={deleteBusy}
          err={deleteErr}
        />
      )}
      <Card className={cn('p-4 transition-colors', editing && 'ring-2 ring-terracotta/30')}>
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0">
            <p className="font-display font-medium text-ink text-sm truncate flex items-center gap-1.5">
              <LinkDot status={linkStatus(user)} />
              <span className="truncate">{user.name}</span>
              {user.is_driver && <DriverChip label="Driver" />}
            </p>
            <p className="text-xs text-muted truncate">{joined}</p>
          </div>
          {!editing && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setEditing(true)}
                className="text-xs text-muted hover:text-ink2 underline underline-offset-2"
              >
                Edit
              </button>
              {user.name !== 'GreenqubesAI' && (
                <button
                  onClick={() => { setDeleteErr(null); setShowDelete(true) }}
                  className="text-xs text-terracotta hover:text-terracotta/80 underline underline-offset-2"
                >
                  Remove
                </button>
              )}
            </div>
          )}
        </div>

        {editing ? (
          <div className="flex flex-col gap-2.5 mt-2">
            {user.name !== 'GreenqubesAI' && (
              <>
                <div>
                  <label className="text-xs text-muted mb-1 block">Display name</label>
                  <input
                    className="w-full border border-line rounded-lg px-3 py-2 text-sm text-ink bg-bg focus:outline-none focus:ring-2 focus:ring-terracotta/40"
                    value={name}
                    onChange={e => setName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted mb-1 block">Google account email</label>
                  <input
                    type="email"
                    placeholder="Add email to let them sign in"
                    className="w-full border border-line rounded-lg px-3 py-2 text-sm text-ink bg-bg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-terracotta/40"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </div>
              </>
            )}
            {user.name === 'GreenqubesAI' ? (
              <div className="w-full border border-line rounded-lg px-3 py-2 text-sm text-muted bg-bg opacity-60 cursor-not-allowed">
                {role.charAt(0).toUpperCase() + role.slice(1)}
              </div>
            ) : (
              <select
                className="w-full border border-line rounded-lg px-3 py-2 text-sm text-ink bg-bg focus:outline-none focus:ring-2 focus:ring-terracotta/40"
                value={role}
                onChange={e => handleRoleChange(e.target.value as Role)}
              >
                {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
              </select>
            )}

            <div>
              <label className="text-xs text-muted mb-1 block">Telegram Chat ID</label>
              <input
                className="w-full border border-line rounded-lg px-3 py-2 text-sm text-ink bg-bg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-terracotta/40"
                placeholder="e.g. 123456789"
                value={tgId}
                onChange={e => setTgId(e.target.value)}
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="accent-terracotta w-4 h-4"
                checked={digestSub}
                onChange={e => setDigestSub(e.target.checked)}
              />
              <span className="text-sm text-ink">Receives Monday digest</span>
            </label>

            <div>
              <label className="text-xs text-muted mb-1 block">Subrole</label>
              {subrole && (
                <span className="mb-2 inline-flex items-center gap-1 text-xs bg-bg border border-line rounded-full px-2.5 py-0.5 text-ink">
                  {subrole}
                  <button type="button" onClick={() => setSubrole('')} className="text-muted hover:text-terracotta leading-none">×</button>
                </span>
              )}
              <div className="flex gap-2">
                <input
                  className="flex-1 border border-line rounded-lg px-3 py-2 text-sm text-ink bg-bg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-terracotta/40"
                  placeholder="e.g. metalworks, printing"
                  value={subroleInput}
                  onChange={e => setSubroleInput(e.target.value)}
                  list={`subrole-suggestions-${user.id}`}
                />
                <Btn type="button" variant="ghost" size="sm"
                     onClick={() => { if (subroleInput.trim()) { setSubrole(subroleInput.trim()); setSubroleInput('') } }}>
                  Insert
                </Btn>
              </div>
              <datalist id={`subrole-suggestions-${user.id}`}>
                {subroleSuggestions(allUsers, role).map(s => <option key={s} value={s} />)}
              </datalist>
            </div>

            {role === 'installer' && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="accent-terracotta w-4 h-4"
                       checked={isDriver} onChange={e => setIsDriver(e.target.checked)} />
                <span className="text-sm text-ink">Driver (licensed vehicle operator)</span>
              </label>
            )}

            <div>
              <label className="text-xs text-muted mb-1 block">Qualifications / licenses</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {quals.map(q => (
                  <span key={q} className="flex items-center gap-1 text-xs bg-bg border border-line rounded-full px-2.5 py-0.5 text-ink">
                    {q}
                    <button
                      type="button"
                      onClick={() => setQuals(prev => prev.filter(x => x !== q))}
                      className="text-muted hover:text-terracotta leading-none"
                    >×</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  className="flex-1 border border-line rounded-lg px-3 py-2 text-sm text-ink bg-bg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-terracotta/40"
                  placeholder="e.g. WAH, Safety Supervisor"
                  value={qualInput}
                  onChange={e => {
                    const v = e.target.value
                    if (v.endsWith(',')) { addQual(v.slice(0, -1)); return }
                    setQualInput(v)
                  }}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addQual(qualInput) } }}
                  list={`qual-suggestions-${user.id}`}
                />
                <Btn type="button" variant="ghost" size="sm" onClick={() => addQual(qualInput)}>
                  Insert
                </Btn>
              </div>
              <datalist id={`qual-suggestions-${user.id}`}>
                {qualificationSuggestions(allUsers).map(q => <option key={q} value={q} />)}
              </datalist>
            </div>

            {err && <p className="text-xs text-red-500">{err}</p>}

            <div className="flex gap-2">
              <Btn variant="primary" size="sm" onClick={save} disabled={busy}>
                {busy ? 'Saving…' : 'Save'}
              </Btn>
              <Btn variant="ghost" size="sm" onClick={cancel} disabled={busy}>
                Cancel
              </Btn>
            </div>
          </div>
        ) : (
          <>
            {user.auth_id === null && user.email && (
              <p className="text-sm text-[--ink2] mb-2">Waiting for sign-in: <span className="font-medium">{user.email}</span></p>
            )}
            {user.auth_id === null && !user.email && (
              <p className="text-sm text-[--ink2] mb-2">Card only — no email yet</p>
            )}
            <div className="flex flex-wrap gap-2 items-center">
              <Pill variant={user.role} />
              {user.subrole && (
                <span className="text-xs text-ink2 bg-bg border border-line rounded-full px-2 py-0.5">{user.subrole}</span>
              )}
              {user.telegram_chat_id ? (
                <span className="text-xs text-muted font-mono">TG {user.telegram_chat_id}</span>
              ) : (
                <span className="text-xs text-muted italic">No Telegram ID</span>
              )}
              {user.digest_subscriber && (
                <span className="text-xs bg-brand-blue/10 text-brand-blue border border-brand-blue/20 rounded-full px-2 py-0.5 font-medium">
                  digest
                </span>
              )}
            </div>
            {(user.qualifications ?? []).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {user.qualifications.map(q => (
                  <span key={q} className="text-xs text-muted bg-bg border border-line rounded-full px-2 py-0.5">{q}</span>
                ))}
              </div>
            )}
          </>
        )}
      </Card>
    </>
  )
}

// ── Tab root ───────────────────────────────────────────────────────────────────

export function UsersTab() {
  const [users,         setUsers]         = useState<AdminUser[]>([])
  const [loading,       setLoading]       = useState(true)
  const [loadErr,       setLoadErr]       = useState<string | null>(null)
  const [showProvide,   setShowProvide]   = useState(false)
  const [roleFilter,    setRoleFilter]    = useState<string>('all')
  const [subroleFilter, setSubroleFilter] = useState<string>('all')

  const shown = filterUsers(users, roleFilter, subroleFilter)
  const subroleOptions = roleFilter === 'all'
    ? ([...new Set(users.map(u => u.subrole?.trim()).filter(Boolean))] as string[]).sort((a, b) => a.localeCompare(b))
    : subroleSuggestions(users, roleFilter)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadErr(null)
    try {
      const res  = await fetch('/api/admin/users')
      const json = await res.json() as AdminUser[] | { error: string }
      if (!res.ok) {
        throw new Error((json as { error: string }).error ?? `HTTP ${res.status}`)
      }
      if (!Array.isArray(json)) {
        throw new Error('Unexpected response — have you run npx supabase db push?')
      }
      setUsers(json)
    } catch (err) {
      setLoadErr((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="flex flex-col gap-3">
      {/* Provision toggle */}
      <button
        onClick={() => setShowProvide(v => !v)}
        className={cn(
          'w-full py-2.5 rounded-card border text-sm font-medium transition-colors',
          showProvide
            ? 'border-terracotta text-terracotta bg-terracotta/5'
            : 'border-line text-muted hover:text-ink2 hover:border-ink2',
        )}
      >
        {showProvide ? '− Close provision form' : '+ Provision new user'}
      </button>

      {showProvide && (
        <ProvisionForm onDone={() => { setShowProvide(false); load() }} allUsers={users} />
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-1.5">
        {(['all', ...ROLES] as string[]).map(r => (
          <button
            key={r}
            onClick={() => { setRoleFilter(r); setSubroleFilter('all') }}
            className={cn(
              'text-xs rounded-full border px-2.5 py-1 transition-colors',
              roleFilter === r
                ? 'border-terracotta text-terracotta bg-terracotta/5 font-medium'
                : 'border-line text-muted hover:text-ink2',
            )}
          >
            {r === 'all' ? 'All' : r.charAt(0).toUpperCase() + r.slice(1)}
          </button>
        ))}
        <select
          className="ml-auto border border-line rounded-lg px-2 py-1 text-xs text-ink bg-bg focus:outline-none"
          value={subroleFilter}
          onChange={e => setSubroleFilter(e.target.value)}
        >
          <option value="all">All subroles</option>
          <option value="none">No subrole</option>
          {subroleOptions.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* User list */}
      {loading ? (
        <p className="text-sm text-muted py-6 text-center">Loading…</p>
      ) : loadErr ? (
        <div className="rounded-card border border-terracotta/30 bg-terracotta/5 p-4">
          <p className="text-sm font-medium text-terracotta mb-1">Failed to load users</p>
          <p className="text-xs text-ink2">{loadErr}</p>
          <p className="text-xs text-muted mt-2">
            If this is a missing-column error, run <code className="font-mono">npx supabase db push</code> to apply migration 0006.
          </p>
          <button onClick={load} className="mt-2 text-xs text-muted underline underline-offset-2">
            Retry
          </button>
        </div>
      ) : users.length === 0 ? (
        <p className="text-sm text-muted py-6 text-center">No users yet.</p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-muted py-6 text-center">No users match this filter.</p>
      ) : (
        <div>
          <p className="text-[11px] uppercase tracking-widest text-muted font-medium mb-2">
            {roleFilter === 'all' && subroleFilter === 'all'
              ? `${users.length} user${users.length !== 1 ? 's' : ''}`
              : `${shown.length} of ${users.length} user${users.length !== 1 ? 's' : ''}`}
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {shown.map(u => (
              <UserRow key={u.id} user={u} allUsers={users} onSaved={load} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
