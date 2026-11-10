import Link from 'next/link'
import { cn } from '@/lib/utils/cn'
import { t as tr } from '@/lib/i18n'
import { switchSegments, type SwitchKey } from '@/lib/utils/completed-switch'
import type { LangCode } from '@/lib/i18n'
import type { Role } from '@/lib/supabase/types'

/**
 * Schedule | Completed (My Jobs | All Jobs | Completed for installers) at the
 * top centre of the page — Nic's pick A, 2026-10-27, replacing the Completed
 * tab for every role. Same look as the Jobs tab's Ongoing | Drafts switch.
 * Installers' All Jobs added 2026-11-10 ("sit on top will do").
 *
 * Links rather than a client-side toggle: Completed stays its own page,
 * so the schedule never has to load every completed job ever, and the browser
 * back button returns to whichever side the user was on.
 */
export function CompletedSwitch({ role, current, lang }: {
  role:    Role
  current: SwitchKey
  lang:    LangCode
}) {
  return (
    <div className="flex justify-center px-4 pt-3">
      <nav className="inline-flex gap-1 rounded-[10px] border border-line bg-paper p-1">
        {switchSegments(role).map(s => {
          const on = s.key === current
          return (
            <Link
              key={s.key}
              href={s.href}
              aria-current={on ? 'page' : undefined}
              data-tour={s.key === 'completed' ? 'completed-switch' : undefined}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                on ? 'bg-ink text-paper' : 'text-ink2 hover:bg-bg',
              )}
            >
              {tr(lang, s.labelKey)}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
