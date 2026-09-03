'use client'

import Link from 'next/link'
import { NotificationDrawer } from '@/features/notifications/NotificationDrawer'
import { UserMenu } from '@/components/UserMenu'
import { NavDrawer } from '@/components/NavDrawer'
import { TourProvider } from '@/features/tour/TourProvider'
import type { LangCode } from '@/lib/i18n'
import type { Role } from '@/lib/supabase/types'

interface Props {
  lang?: LangCode
  // Optional — when supplied, mobile (<lg) swaps in the nav drawer: hamburger
  // left, logo centered, bell top-right (the old profile spot); the profile
  // moves into the drawer itself (R2-T5 / F1). Desktop is identical either
  // way. Omit it (JobDetailShell / NewJobShell — pages with no tab nav of
  // their own, never rendered BottomNav) to keep the original single-layout
  // top bar untouched at every breakpoint.
  role?: Role
}

export function CompanyBar({ lang = 'en', role }: Props) {
  if (!role) {
    return (
      <div className="sticky top-0 z-30 px-4 pt-3 pb-2.5 flex items-center justify-between border-b border-line bg-bg">
        <TourProvider lang={lang} />
        <Link href="/schedule" aria-label="Go to schedule">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/greenqubes-logo.png" alt="GreenQubes" className="brand-logo h-5 w-auto" />
        </Link>
        <div className="flex items-center gap-2">
          <NotificationDrawer lang={lang} />
          <UserMenu lang={lang} />
        </div>
      </div>
    )
  }

  return (
    <div className="sticky top-0 z-30 px-4 pt-3 pb-2.5 flex items-center justify-between border-b border-line bg-bg">
      <TourProvider lang={lang} role={role} />
      {/* Mobile (<lg): hamburger — centered logo — bell. Two flex-1 side
          slots keep the logo perfectly centered regardless of how wide the
          hamburger/bell each render. */}
      <div className="lg:hidden flex flex-1 items-center">
        <NavDrawer role={role} lang={lang} />
      </div>
      <Link href="/schedule" aria-label="Go to schedule" className="lg:hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/greenqubes-logo.png" alt="GreenQubes" className="brand-logo h-5 w-auto" />
      </Link>
      <div className="lg:hidden flex flex-1 items-center justify-end">
        <NotificationDrawer lang={lang} />
      </div>

      {/* Desktop (≥lg): unchanged — logo left, bell + profile right */}
      <Link href="/schedule" aria-label="Go to schedule" className="hidden lg:block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/greenqubes-logo.png" alt="GreenQubes" className="brand-logo h-5 w-auto" />
      </Link>
      <div className="hidden lg:flex items-center gap-2">
        <NotificationDrawer lang={lang} />
        <UserMenu lang={lang} />
      </div>
    </div>
  )
}
