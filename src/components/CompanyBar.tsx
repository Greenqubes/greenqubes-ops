'use client'

import Link from 'next/link'
import { NotificationDrawer } from '@/features/notifications/NotificationDrawer'
import { UserMenu } from '@/components/UserMenu'
import type { LangCode } from '@/lib/i18n'

interface Props {
  lang?: LangCode
}

export function CompanyBar({ lang = 'en' }: Props) {
  return (
    <div className="sticky top-0 z-30 px-4 pt-3 pb-2.5 flex items-center justify-between border-b border-line bg-bg">
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
