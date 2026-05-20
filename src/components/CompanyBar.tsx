'use client'

import { NotificationDrawer } from '@/features/notifications/NotificationDrawer'
import { UserMenu } from '@/components/UserMenu'
import type { LangCode } from '@/lib/i18n'

interface Props {
  lang?: LangCode
}

export function CompanyBar({ lang = 'en' }: Props) {
  return (
    <div className="sticky top-0 z-30 px-4 pt-3 pb-2.5 flex items-center justify-between border-b border-line bg-bg">
      <div className="flex items-center gap-2">
        <span className="font-display font-semibold text-[22px] text-ink tracking-tight leading-none">GreenQubes</span>
        <span className="text-[10px] font-medium text-terracotta/50 tracking-wide">Pre-Alpha</span>
      </div>
      <div className="flex items-center gap-2">
        <NotificationDrawer lang={lang} />
        <UserMenu lang={lang} />
      </div>
    </div>
  )
}
