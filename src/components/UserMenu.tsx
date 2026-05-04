'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { LogOut, ShieldCheck, LayoutDashboard } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils/cn'

const ADMIN_EMAIL = 'ai@greenqubes.com'

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

export function UserMenu() {
  const [open,     setOpen]     = useState(false)
  const [name,     setName]     = useState('')
  const [email,    setEmail]    = useState('')
  const [isAdmin,  setIsAdmin]  = useState(false)
  const ref      = useRef<HTMLDivElement>(null)
  const router   = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      const userEmail = user?.email ?? ''
      setName(user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? '')
      setEmail(userEmail)
      setIsAdmin(userEmail === ADMIN_EMAIL)
    })
  }, [])

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

  const bg  = name ? avatarColor(name) : 'bg-ink2'
  const ini = name ? initials(name)    : '?'

  return (
    <div ref={ref} className="relative shrink-0">
      {/* Avatar button */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="User menu"
        aria-expanded={open}
        className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center',
          'text-white text-[11px] font-semibold tracking-wide select-none',
          'transition-opacity hover:opacity-85',
          bg,
        )}
      >
        {ini}
      </button>

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

          {/* Admin account shortcuts */}
          {isAdmin && pathname.startsWith('/admin') && (
            <button
              onClick={() => { setOpen(false); router.push('/schedule') }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink2 hover:bg-bg hover:text-ink transition-colors border-b border-line"
            >
              <LayoutDashboard size={14} strokeWidth={1.8} />
              User view
            </button>
          )}
          {isAdmin && !pathname.startsWith('/admin') && (
            <button
              onClick={handleAdmin}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink2 hover:bg-bg hover:text-ink transition-colors border-b border-line"
            >
              <ShieldCheck size={14} strokeWidth={1.8} className="text-terracotta" />
              Admin
            </button>
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
