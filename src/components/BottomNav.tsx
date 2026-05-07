'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Calendar, Inbox, Bot, HardHat, CheckCircle2, Clock } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { Role } from '@/lib/supabase/types'

type Tab = { href: string; label: string; Icon: typeof Calendar }

const TABS: Record<Role, Tab[]> = {
  scheduler: [
    { href: '/schedule',  label: 'Schedule',  Icon: Calendar      },
    { href: '/approvals', label: 'Approvals', Icon: Inbox         },
    { href: '/completed', label: 'Completed', Icon: CheckCircle2  },
    { href: '/assistant', label: 'Assistant', Icon: Bot           },
  ],
  sales: [
    { href: '/schedule',  label: 'Schedule',  Icon: Calendar      },
    { href: '/completed', label: 'Completed', Icon: CheckCircle2  },
    { href: '/pending',   label: 'Pending',   Icon: Clock         },
    { href: '/assistant', label: 'Assistant', Icon: Bot           },
  ],
  installer: [
    { href: '/installer', label: 'My Jobs',   Icon: HardHat       },
    { href: '/assistant', label: 'Assistant', Icon: Bot           },
  ],
}

export function BottomNav({ role }: { role: Role }) {
  const pathname = usePathname()
  const tabs = TABS[role]

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
