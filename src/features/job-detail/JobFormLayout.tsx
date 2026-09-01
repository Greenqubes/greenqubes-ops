'use client'

import { useEffect, useState } from 'react'
import { Lock } from 'lucide-react'
import { t } from '@/lib/i18n'
import { cn } from '@/lib/utils/cn'
import type { LangCode } from '@/lib/i18n'

export type JobTab = 'details' | 'team' | 'files' | 'chat'

const TABS: JobTab[] = ['details', 'team', 'files', 'chat']
const TAB_LABEL_KEY = {
  details: 'tabDetails',
  team:    'tabTeam',
  files:   'tabFiles',
  chat:    'tabChat',
} as const

interface Props {
  lang:        LangCode
  initialTab?: JobTab     // e.g. 'chat' from the ?tab=chat deep link
  lockedTabs?: JobTab[]   // New job pre-save: ['files', 'chat']
  /** Bump (any changing value) to force-switch to the details tab on phone —
   *  e.g. a validation error on a details-column card that's currently hidden
   *  behind another tab. There's no other imperative tab control here. */
  jumpToDetails?: number
  details:     React.ReactNode
  team:        React.ReactNode
  files:       React.ReactNode
  chat:        React.ReactNode
}

// The responsive job-form shell. Below lg: a sticky tab bar shows one group
// at a time. At lg+: no tabs — two columns (Details+Team | Files+Chat).
// Every group stays mounted at all times; tabs only toggle CSS visibility,
// so form state, chat realtime, and uploads survive tab switches.
export function JobFormLayout({
  lang, initialTab = 'details', lockedTabs = [], jumpToDetails, details, team, files, chat,
}: Props) {
  const [active, setActive] = useState<JobTab>(
    lockedTabs.includes(initialTab) ? 'details' : initialTab,
  )

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (jumpToDetails) setActive('details') }, [jumpToDetails])

  const groupCn = (tab: JobTab) => cn(tab !== active && 'hidden', 'lg:block')

  return (
    <>
      {/* Tab bar — phone/narrow only; sticks below the CompanyBar (45px) */}
      <div className="lg:hidden sticky top-[45px] z-20 bg-bg border-b border-line flex">
        {TABS.map(tab => {
          const locked = lockedTabs.includes(tab)
          return (
            <button
              key={tab}
              type="button"
              disabled={locked}
              onClick={() => setActive(tab)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                active === tab
                  ? 'border-terracotta text-terracotta'
                  : 'border-transparent text-ink2',
                locked && 'text-muted opacity-50 cursor-not-allowed',
              )}
            >
              {locked && <Lock size={11} />}
              {t(lang, TAB_LABEL_KEY[tab])}
            </button>
          )
        })}
      </div>

      {/* Content — single column with tabs on phone, two columns at lg+.
          flex + gap (not space-y) so hidden groups leave no stray margins. */}
      <div className="max-w-2xl lg:max-w-6xl mx-auto px-4 pt-4 flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="lg:flex-1 lg:min-w-0 flex flex-col gap-4">
          <div className={groupCn('details')}>{details}</div>
          <div className={groupCn('team')}>{team}</div>
        </div>
        <div className="lg:flex-1 lg:min-w-0 flex flex-col gap-4">
          <div className={groupCn('files')}>{files}</div>
          <div className={groupCn('chat')}>{chat}</div>
        </div>
      </div>
    </>
  )
}
