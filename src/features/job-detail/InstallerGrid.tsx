'use client'

import { useRef, useEffect, useState } from 'react'
import { cn } from '@/lib/utils/cn'
import { t } from '@/lib/i18n'
import { LinkDot, DriverChip, UserMetaLine } from '@/components/UserMetaLine'
import type { InstallerUser } from '@/lib/supabase/queries/jobs'
import type { LangCode } from '@/lib/i18n'

const AVATAR_COLORS = [
  '#5C7A6B', '#7A6B8A', '#6B7A8A', '#8A6B6B',
  '#6B8A7A', '#7A8A6B', '#8A7A6B', '#6B6B8A',
]

function initials(name: string) {
  return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
}

// none      → not picked
// suggested → sales/coordinator's tentative pick (yellow) — edit 8, 2026-08-27
// assigned  → formal assignment by scheduler only (green, full-card fill)
export type InstallerCardState = 'none' | 'suggested' | 'assigned'

interface Props {
  installers:   InstallerUser[]
  lang:         LangCode
  stateOf:      (id: string) => InstallerCardState
  /** Omit to render the grid read-only (no clicks). */
  onToggle?:    (id: string) => void
  /** Per-card lock — e.g. sales/coordinator cannot un-assign a formally assigned installer. */
  disabledOf?:  (id: string) => boolean
  /** Optional subtext under the installer name (e.g. "Suggested" / "You suggested"). */
  noteOf?:      (id: string) => string | null
}

export function InstallerGrid({ installers, lang, stateOf, onToggle, disabledOf, noteOf }: Props) {
  const scrollRef  = useRef<HTMLDivElement>(null)
  const [showHint, setShowHint] = useState(false)
  const gridReadOnly = !onToggle

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (el.scrollHeight > el.clientHeight) setShowHint(true)
    function onScroll() {
      if (!el) return
      setShowHint(el.scrollTop + el.clientHeight < el.scrollHeight - 4)
    }
    el.addEventListener('scroll', onScroll)
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        className="max-h-[290px] overflow-y-auto"
        style={{ scrollbarWidth: 'thin' }}
      >
        <div className="grid grid-cols-2 gap-2 pr-0.5 max-[480px]:grid-cols-1">
          {installers.map((inst, i) => {
            const st       = stateOf(inst.id)
            const locked   = gridReadOnly || (disabledOf?.(inst.id) ?? false)
            const color    = AVATAR_COLORS[i % AVATAR_COLORS.length]
            const note     = noteOf?.(inst.id) ?? null

            const nameColor =
              st === 'assigned'  ? 'text-brand-green' :
              st === 'suggested' ? 'text-amber-700'   :
              'text-ink'
            const chipClass =
              st === 'assigned'  ? 'text-brand-green border-brand-green/30 bg-transparent' :
              st === 'suggested' ? 'text-amber-700 border-amber-300 bg-transparent'        :
              'text-muted bg-bg border-line'

            return (
              <button
                key={inst.id}
                type="button"
                onClick={() => { if (!locked) onToggle?.(inst.id) }}
                disabled={locked}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-[1.5px] text-left w-full transition-all',
                  // Full-card fill for both states (smoke feedback edit 8
                  // addendum, 2026-08-27) — assigned now matches suggested's
                  // solid tint instead of a faint 20%-opacity overlay.
                  st === 'assigned'  ? 'border-brand-green bg-brand-green-soft' :
                  st === 'suggested' ? 'border-amber-300 bg-amber-50'          :
                  'border-line bg-paper',
                  !locked && st === 'none' && 'hover:border-brand-green hover:bg-brand-green/5',
                  locked && 'cursor-default',
                )}
              >
                <div className="shrink-0">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold text-white"
                    style={{ background: color }}
                  >
                    {initials(inst.name)}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-semibold truncate flex items-center gap-1.5', nameColor)}>
                    <LinkDot status={inst.link_status} />
                    <span className="truncate">{inst.name}</span>
                    {inst.is_driver && <DriverChip label={t(lang, 'metaDriver')} />}
                  </p>
                  <UserMetaLine
                    user={{ role: inst.role, subrole: inst.subrole, qualifications: inst.qualifications }}
                    chipClass={chipClass}
                  />
                  {note && (
                    <p className="text-[11px] truncate text-amber-600 mt-0.5">{note}</p>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>
      {showHint && (
        <p className="text-center text-[10px] text-muted mt-1">Scroll to see more</p>
      )}
    </div>
  )
}
