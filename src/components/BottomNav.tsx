'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils/cn'
import { NAV_TABS } from '@/lib/navTabs'
import type { Role } from '@/lib/supabase/types'

// Desktop-only (≥lg) since R2-T5 / F1 — the mobile nav drawer (NavDrawer,
// driven by the same NAV_TABS) replaces this bar below lg in every shell
// that renders it. Callers are responsible for the `hidden lg:block`
// wrapper (kept out of this component so a future desktop-only consumer
// isn't forced to fight it).
export function BottomNav({ role }: { role: Role }) {
  const pathname = usePathname()
  const tabs = NAV_TABS[role]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-paper border-t border-line">
      <div className="max-w-[480px] mx-auto flex pt-2 pb-[env(safe-area-inset-bottom,12px)]">
        {tabs.map(({ href, label, Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex-1 flex flex-col items-center gap-1 text-[10px] font-medium uppercase tracking-wide transition-colors',
                active ? 'text-terracotta' : 'text-muted hover:text-ink2',
              )}
            >
              <Icon size={20} strokeWidth={active ? 2 : 1.6} />
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
