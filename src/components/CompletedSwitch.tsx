import Link from 'next/link'
import { cn } from '@/lib/utils/cn'
import { t as tr } from '@/lib/i18n'
import { liveHrefFor } from '@/lib/utils/completed-switch'
import type { LangCode } from '@/lib/i18n'
import type { Role } from '@/lib/supabase/types'

/**
 * Schedule | Completed (My Jobs | Completed for installers) at the top centre
 * of the page — Nic's pick A, 2026-10-27, replacing the Completed tab for
 * every role. Same look as the Jobs tab's Ongoing | Drafts switch.
 *
 * Two links rather than a client-side toggle: Completed stays its own page,
 * so the schedule never has to load every completed job ever, and the browser
 * back button returns to whichever side the user was on.
 */
export function CompletedSwitch({ role, current, lang }: {
  role:    Role
  current: 'live' | 'completed'
  lang:    LangCode
}) {
  const liveHref = liveHrefFor(role)
  const seg = (href: string, label: string, on: boolean, tour?: string) => (
    <Link
      href={href}
      aria-current={on ? 'page' : undefined}
      data-tour={tour}
      className={cn(
        'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
        on ? 'bg-ink text-paper' : 'text-ink2 hover:bg-bg',
      )}
    >
      {label}
    </Link>
  )

  return (
    <div className="flex justify-center px-4 pt-3">
      <nav className="inline-flex gap-1 rounded-[10px] border border-line bg-paper p-1">
        {seg(liveHref, tr(lang, liveHref === '/installer' ? 'installerMyJobs' : 'schedule'), current === 'live')}
        {seg('/completed', tr(lang, 'completed'), current === 'completed', 'completed-switch')}
      </nav>
    </div>
  )
}
