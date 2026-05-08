'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { LogOut, ShieldCheck, LayoutDashboard, Languages, Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils/cn'
import type { LangCode } from '@/lib/i18n'
import type { Role } from '@/lib/supabase/types'

const ADMIN_EMAIL = 'ai@greenqubes.com'
const VALID_ROLES: Role[] = ['sales', 'scheduler', 'installer']

function readRoleOverrideCookie(): Role | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(/(?:^|;\s*)role_override=([^;]+)/)
  const val = match?.[1] as Role | undefined
  return val && VALID_ROLES.includes(val) ? val : null
}

const LANG_OPTIONS: { code: LangCode; label: string }[] = [
  { code: 'en', label: 'EN'   },
  { code: 'zh', label: '中文' },
  { code: 'bn', label: 'বাং'  },
]

// Deterministic avatar colour — Tailwind must see these full strings at build time
const AVATAR_COLORS = [
  'bg-terracotta',
  'bg-brand-green',
  'bg-brand-blue',
  'bg-brand-amber',
  'bg-ink2',
]

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function avatarColor(name: string): string {
  const hash = [...name].reduce((sum, c) => sum + c.charCodeAt(0), 0)
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

interface Props {
  lang?: LangCode
}

export function UserMenu({ lang: initialLang }: Props) {
  const [open,         setOpen]         = useState(false)
  const [name,         setName]         = useState('')
  const [email,        setEmail]        = useState('')
  const [isAdmin,      setIsAdmin]      = useState(false)
  const [lang,         setLang]         = useState<LangCode>(initialLang ?? 'en')
  const [changingLang, setChangingLang] = useState(false)
  const [roleOverride, setRoleOverride] = useState<Role | null>(null)
  const ref      = useRef<HTMLDivElement>(null)
  const router   = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      const userEmail = user?.email ?? ''
      setName(user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? '')
      setEmail(userEmail)
      const admin = userEmail === ADMIN_EMAIL
      setIsAdmin(admin)
      if (admin) setRoleOverride(readRoleOverrideCookie())
      if (user) {
        const { data } = await supabase
          .from('users')
          .select('lang')
          .eq('auth_id', user.id)
          .maybeSingle() as { data: { lang: string } | null; error: unknown }
        if (data?.lang) setLang(data.lang as LangCode)
      }
    })
  }, [])

  useEffect(() => {
    if (initialLang) setLang(initialLang)
  }, [initialLang])

  // Close on outside click
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  async function handleSignOut() {
    setOpen(false)
    await createClient().auth.signOut()
    router.push('/login')
  }

  function handleAdmin() {
    setOpen(false)
    router.push('/admin')
  }

  async function handleLangChange(code: LangCode) {
    if (code === lang || changingLang) return
    setChangingLang(true)
    setLang(code)
    await fetch('/api/user/lang', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ lang: code }),
    })
    setChangingLang(false)
    setOpen(false)
    router.refresh()
  }

  function handlePreviewAs(role: Role) {
    document.cookie = `role_override=${role}; path=/; SameSite=Lax`
    setRoleOverride(role)
    setOpen(false)
    if (role === 'installer') {
      router.push('/installer')
    } else if (role === 'scheduler') {
      router.push('/schedule')
    } else {
      router.push('/schedule')
    }
    router.refresh()
  }

  function handleExitPreview() {
    document.cookie = 'role_override=; path=/; max-age=0'
    setRoleOverride(null)
    setOpen(false)
    router.push('/schedule')
    router.refresh()
  }

  const bg  = name ? avatarColor(name) : 'bg-ink2'
  const ini = name ? initials(name)    : '?'

  return (
    <div ref={ref} className="relative shrink-0">
      {/* Avatar button + override chip */}
      <div className="flex items-center gap-1.5">
        {isAdmin && roleOverride && (
          <span className="text-[10px] font-medium text-amber-700 bg-amber/15 border border-amber/30 px-1.5 py-0.5 rounded-full leading-none">
            {roleOverride}
          </span>
        )}
        <button
          onClick={() => setOpen(o => !o)}
          aria-label="User menu"
          aria-expanded={open}
          className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center',
            'text-white text-[11px] font-semibold tracking-wide select-none',
            'transition-opacity hover:opacity-85',
            isAdmin && roleOverride ? 'ring-2 ring-amber/60 ring-offset-1' : '',
            bg,
          )}
        >
          {ini}
        </button>
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-paper border border-line rounded-card shadow-lg z-50 overflow-hidden">
          {/* Identity */}
          <div className="px-4 py-3 border-b border-line">
            <div className="flex items-center gap-2.5">
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                'text-white text-[11px] font-semibold',
                bg,
              )}>
                {ini}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink truncate">{name || '—'}</p>
                {email && <p className="text-[11px] text-muted truncate">{email}</p>}
              </div>
            </div>
          </div>

          {/* Language switcher */}
          <div className="px-4 py-2.5 border-b border-line">
            <div className="flex items-center gap-2 mb-2">
              <Languages size={13} className="text-muted" strokeWidth={1.8} />
              <span className="text-[11px] text-muted uppercase tracking-widest">Language</span>
            </div>
            <div className="flex gap-1.5">
              {LANG_OPTIONS.map(({ code, label }) => (
                <button
                  key={code}
                  onClick={() => handleLangChange(code)}
                  disabled={changingLang}
                  className={cn(
                    'flex-1 py-1 rounded-md text-xs font-medium border transition-colors',
                    lang === code
                      ? 'bg-ink text-white border-ink'
                      : 'bg-bg border-line text-ink2 hover:border-ink2',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Admin shortcuts */}
          {isAdmin && (
            <div className="border-b border-line">
              {/* Preview as */}
              <div className="px-4 pt-2.5 pb-1.5">
                <div className="flex items-center gap-2 mb-2">
                  <Eye size={13} className="text-muted" strokeWidth={1.8} />
                  <span className="text-[11px] text-muted uppercase tracking-widest">Preview as</span>
                </div>
                <div className="flex gap-1.5">
                  {VALID_ROLES.map(role => (
                    <button
                      key={role}
                      onClick={() => handlePreviewAs(role)}
                      className={cn(
                        'flex-1 py-1 rounded-md text-xs font-medium border transition-colors capitalize',
                        roleOverride === role
                          ? 'bg-amber/15 text-amber-700 border-amber/40'
                          : 'bg-bg border-line text-ink2 hover:border-ink2',
                      )}
                    >
                      {role}
                    </button>
                  ))}
                </div>
                {roleOverride && (
                  <button
                    onClick={handleExitPreview}
                    className="mt-2 w-full flex items-center justify-center gap-1.5 py-1 rounded-md text-xs font-medium text-muted hover:text-ink border border-line bg-bg transition-colors"
                  >
                    <EyeOff size={11} strokeWidth={1.8} />
                    Exit preview
                  </button>
                )}
              </div>
              {/* Admin page / User view */}
              {pathname.startsWith('/admin') ? (
                <button
                  onClick={() => { setOpen(false); router.push('/schedule') }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink2 hover:bg-bg hover:text-ink transition-colors"
                >
                  <LayoutDashboard size={14} strokeWidth={1.8} />
                  User view
                </button>
              ) : (
                <button
                  onClick={handleAdmin}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink2 hover:bg-bg hover:text-ink transition-colors"
                >
                  <ShieldCheck size={14} strokeWidth={1.8} className="text-terracotta" />
                  Admin
                </button>
              )}
            </div>
          )}

          {/* Sign out */}
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink2 hover:bg-bg hover:text-ink transition-colors"
          >
            <LogOut size={14} strokeWidth={1.8} />
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
