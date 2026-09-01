'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { NAV_TABS } from '@/lib/navTabs'
import { UserMenu } from '@/components/UserMenu'
import type { Role } from '@/lib/supabase/types'
import type { LangCode } from '@/lib/i18n'

interface Props {
  role: Role
  lang?: LangCode
}

// Mobile-only (<lg) left nav drawer — R2-T5 / F1. Replaces the fixed
// BottomNav below lg in every shell that used to render it; BottomNav keeps
// showing at ≥lg unchanged. Driven by the same NAV_TABS map as BottomNav (one
// shared source) and hosts the UserMenu trigger in its footer, since the
// profile moves out of CompanyBar's top-right on mobile.
//
// Self-contained: renders its own hamburger trigger + backdrop + sliding
// panel as one unit, so a caller just drops <NavDrawer /> wherever the
// trigger belongs.
export function NavDrawer({ role, lang }: Props) {
  const [open, setOpen] = useState(false)
  // Mount-gate before portaling — `document` doesn't exist during SSR, and
  // this only ever flips true inside an effect (never during the server or
  // first-hydration render), so createPortal below is never reached until
  // the client is definitely up. Same pattern UserMenu already uses to gate
  // its dark-mode button.
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()
  const panelRef = useRef<HTMLDivElement>(null)
  const tabs = NAV_TABS[role]

  useEffect(() => { setMounted(true) }, [])

  const close = () => setOpen(false)

  // Escape closes; focus lands in the panel on open (simple version, per
  // spec — no full focus trap).
  useEffect(() => {
    if (!open) return
    panelRef.current?.focus()
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  return (
    <>
      {/* Trigger stays right where the caller put it (CompanyBar's mobile
          slot, or AssistantShell's own slim bar) — only the backdrop + panel
          below are portaled. */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open navigation menu"
        aria-expanded={open}
        className="lg:hidden p-2 -ml-2 rounded-lg text-ink2 hover:text-ink hover:bg-bg transition-colors"
      >
        <Menu size={19} strokeWidth={1.8} />
      </button>

      {/* Backdrop + panel render via a portal straight onto document.body —
          not as children of whatever host (CompanyBar / the AssistantShell
          slim bar) rendered the trigger above. CompanyBar's own root div is
          `sticky z-30`, which creates a stacking context; anything painted
          as ITS descendant is capped inside that context no matter how high
          its own z-index reads, so a nested z-[70] here would have stacked
          under other z-[59]/z-[60] fixed elements that live outside that
          context (the bug-report and floating-chat FABs) — exactly the bug
          this portal fixes. Escaping to document.body puts this drawer in
          the same root stacking context as those FABs, where z-[70]
          actually outranks their z-[59]/z-[60]. */}
      {mounted && createPortal(
        <>
          {/* Backdrop — z-[70]: above BottomNav's old z-50, the
              notification drawer (z-40 backdrop / z-50 panel), and the
              floating chat/bug FABs (z-[60]/z-[59]), per the overlay hard
              rule. Tap closes without navigating through whatever sits
              underneath. */}
          {open && (
            <div
              className="lg:hidden fixed inset-0 z-[70] bg-black/20"
              onClick={close}
              aria-hidden="true"
            />
          )}

          {/* Panel — slides in from the left; kept mounted (translate-x
              toggles visibility) for the transition, matching
              NotificationDrawer's own pattern. */}
          <div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className={cn(
              'lg:hidden fixed top-0 left-0 z-[70] h-full w-72 max-w-[80vw] bg-paper shadow-xl',
              'flex flex-col transition-transform duration-200 ease-out focus:outline-none',
              open ? 'translate-x-0' : '-translate-x-full',
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-line shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/greenqubes-logo.png" alt="GreenQubes" className="brand-logo h-5 w-auto" />
              <button
                onClick={close}
                aria-label="Close navigation menu"
                className="p-1.5 rounded-lg text-ink2 hover:text-ink hover:bg-bg transition-colors"
              >
                <X size={18} strokeWidth={1.8} />
              </button>
            </div>

            {/* Tabs — full words (more room than the old bottom nav), active
                route highlighted the same way BottomNav does today. */}
            <nav className="flex-1 overflow-y-auto py-2">
              {tabs.map(({ href, label, Icon }) => {
                const active = pathname.startsWith(href)
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={close}
                    className={cn(
                      'flex items-center gap-3 mx-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                      active ? 'bg-terracotta-soft text-terracotta' : 'text-ink2 hover:bg-bg hover:text-ink',
                    )}
                  >
                    <Icon size={18} strokeWidth={active ? 2 : 1.6} />
                    {label}
                  </Link>
                )
              })}
            </nav>

            {/* Profile — bottom area; reuses UserMenu's own avatar trigger +
                dropdown (dark mode, language, Telegram, logout) verbatim,
                just opening upward/left since it's anchored near the bottom
                edge. */}
            <div className="shrink-0 border-t border-line px-4 py-3 flex items-center gap-3">
              <UserMenu lang={lang} openDirection="up" align="left" />
              <span className="text-sm font-medium text-ink2">Account</span>
            </div>
          </div>
        </>,
        document.body,
      )}
    </>
  )
}
