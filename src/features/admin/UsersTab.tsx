'use client'

import { useEffect, useState, useCallback } from 'react'
import { Pill }    from '@/components/Pill'
import { Btn }     from '@/components/Btn'
import { Card }    from '@/components/Card'
import { cn }      from '@/lib/utils/cn'
import type { AdminUser } from '@/lib/supabase/queries/admin'
import type { Role, LangCode } from '@/lib/supabase/types'

const ROLES: Role[]     = ['sales', 'scheduler', 'installer', 'admin']
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

function ProvisionForm({ onDone }: { onDone: () => void }) {
  const [email,       setEmail]       = useState('')
  const [name,        setName]        = useState('')
  const [role,        setRole]        = useState<Role>('installer')
  const [lang,        setLang]        = useState<LangCode>('en')
  const [busy,        setBusy]        = useState(false)
  const [err,         setErr]         = useState<string | null>(null)
  const [showModal,   setShowModal]   = useState(false)
  const [pendingRole, setPendingRole] = useState<Role | null>(null)

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
        body:    JSON.stringify({ email, name, role, lang }),
      })
      if (!res.ok) {
        const { error } = await res.json() as { error: string }
        throw new Error(error)
      }
      setEmail(''); setName('')
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
            placeholder="Google account email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
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
          {err && <p className="text-xs text-red-500">{err}</p>}
          <Btn type="submit" variant="accent" size="sm" disabled={busy}>
            {busy ? 'Adding…' : 'Add user'}
          </Btn>
        </form>
      </Card>
    </>
  )
}

// ── User row ───────────────────────────────────────────────────────────────────

function UserRow({ user, onSaved }: { user: AdminUser; onSaved: () => void }) {
  const [editing,     setEditing]     = useState(false)
  const [role,        setRole]        = useState<Role>(user.role)
  const [tgId,        setTgId]        = useState(user.telegram_chat_id ?? '')
  const [digestSub,   setDigestSub]   = useState(user.digest_subscriber)
  const [yearsExp,    setYearsExp]    = useState<number | string>(user.years_experience ?? '')
  const [skills,      setSkills]      = useState<string[]>(user.skills ?? [])
  const [skillInput,  setSkillInput]  = useState('')
  const [busy,        setBusy]        = useState(false)
  const [err,         setErr]         = useState<string | null>(null)
  const [modalPhase,  setModalPhase]  = useState<'confirm' | 'success' | null>(null)
  const [prevRole,    setPrevRole]    = useState<Role>(user.role)

  function addSkill(raw: string) {
    const tag = raw.trim().replace(/,+$/, '').trim()
    if (tag && !skills.includes(tag)) setSkills(prev => [...prev, tag])
    setSkillInput('')
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
      }
      if (role === 'installer') {
        body.years_experience = yearsExp === '' ? null : Number(yearsExp)
        body.skills = skills
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

  function cancel() {
    setRole(user.role)
    setTgId(user.telegram_chat_id ?? '')
    setDigestSub(user.digest_subscriber)
    setYearsExp(user.years_experience ?? '')
    setSkills(user.skills ?? [])
    setSkillInput('')
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
      <Card className={cn('p-4 transition-colors', editing && 'ring-2 ring-terracotta/30')}>
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0">
            <p className="font-display font-medium text-ink text-sm truncate">{user.name}</p>
            <p className="text-xs text-muted truncate">{joined}</p>
          </div>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-muted hover:text-ink2 underline underline-offset-2 shrink-0"
            >
              Edit
            </button>
          )}
        </div>

        {editing ? (
          <div className="flex flex-col gap-2.5 mt-2">
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

            {role === 'installer' && (
              <>
                <div>
                  <label className="text-xs text-muted mb-1 block">Years of experience</label>
                  <input
                    type="number"
                    min={0}
                    className="w-full border border-line rounded-lg px-3 py-2 text-sm text-ink bg-bg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-terracotta/40"
                    placeholder="e.g. 5"
                    value={yearsExp}
                    onChange={e => setYearsExp(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-xs text-muted mb-1 block">Skills</label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {skills.map(s => (
                      <span key={s} className="flex items-center gap-1 text-xs bg-bg border border-line rounded-full px-2.5 py-0.5 text-ink">
                        {s}
                        <button
                          type="button"
                          onClick={() => setSkills(prev => prev.filter(x => x !== s))}
                          className="text-muted hover:text-terracotta leading-none"
                        >×</button>
                      </span>
                    ))}
                  </div>
                  <input
                    className="w-full border border-line rounded-lg px-3 py-2 text-sm text-ink bg-bg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-terracotta/40"
                    placeholder="Add skill, press Enter or comma"
                    value={skillInput}
                    onChange={e => {
                      const v = e.target.value
                      if (v.endsWith(',')) { addSkill(v.slice(0, -1)); return }
                      setSkillInput(v)
                    }}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill(skillInput) } }}
                  />
                </div>
              </>
            )}

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
            <div className="flex flex-wrap gap-2 items-center">
              <Pill variant={user.role} />
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
              {!user.auth_id && (
                <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">
                  not linked
                </span>
              )}
            </div>
          </>
        )}
      </Card>
    </>
  )
}

// ── Tab root ───────────────────────────────────────────────────────────────────

export function UsersTab() {
  const [users,       setUsers]       = useState<AdminUser[]>([])
  const [loading,     setLoading]     = useState(true)
  const [loadErr,     setLoadErr]     = useState<string | null>(null)
  const [showProvide, setShowProvide] = useState(false)

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
        <ProvisionForm onDone={() => { setShowProvide(false); load() }} />
      )}

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
      ) : (
        <div>
          <p className="text-[11px] uppercase tracking-widest text-muted font-medium mb-2">
            {users.length} user{users.length !== 1 ? 's' : ''}
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {users.map(u => (
              <UserRow key={u.id} user={u} onSaved={load} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
