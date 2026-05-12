'use client'

import { useEffect, useState, useCallback } from 'react'
import { Pill }    from '@/components/Pill'
import { Btn }     from '@/components/Btn'
import { Card }    from '@/components/Card'
import { cn }      from '@/lib/utils/cn'
import type { AdminUser } from '@/lib/supabase/queries/admin'
import type { Role, LangCode } from '@/lib/supabase/types'

const ROLES: Role[]     = ['sales', 'scheduler', 'installer']
const LANGS: LangCode[] = ['en', 'zh', 'bn']

// ── Provision form ─────────────────────────────────────────────────────────────

function ProvisionForm({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState('')
  const [name,  setName]  = useState('')
  const [role,  setRole]  = useState<Role>('installer')
  const [lang,  setLang]  = useState<LangCode>('en')
  const [busy,  setBusy]  = useState(false)
  const [err,   setErr]   = useState<string | null>(null)

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
            onChange={e => setRole(e.target.value as Role)}
          >
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
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
  )
}

// ── User row ───────────────────────────────────────────────────────────────────

function UserRow({ user, onSaved }: { user: AdminUser; onSaved: () => void }) {
  const [editing,   setEditing]   = useState(false)
  const [role,      setRole]      = useState<Role>(user.role)
  const [tgId,      setTgId]      = useState(user.telegram_chat_id ?? '')
  const [digestSub, setDigestSub] = useState(user.digest_subscriber)
  const [busy,      setBusy]      = useState(false)
  const [err,       setErr]       = useState<string | null>(null)

  async function save() {
    setBusy(true); setErr(null)
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          role,
          telegram_chat_id:  tgId.trim() || null,
          digest_subscriber: digestSub,
        }),
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
    setEditing(false)
    setErr(null)
  }

  const joined = new Date(user.created_at).toLocaleDateString('en-SG', {
    day: 'numeric', month: 'short', year: 'numeric',
  })

  return (
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
          <select
            className="w-full border border-line rounded-lg px-3 py-2 text-sm text-ink bg-bg focus:outline-none focus:ring-2 focus:ring-terracotta/40"
            value={role}
            onChange={e => setRole(e.target.value as Role)}
          >
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>

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
