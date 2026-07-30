'use client'

import { useRef, useEffect, useState } from 'react'
import { cn } from '@/lib/utils/cn'
import type { InstallerUser } from '@/lib/supabase/queries/jobs'

const AVATAR_COLORS = [
  '#5C7A6B', '#7A6B8A', '#6B7A8A', '#8A6B6B',
  '#6B8A7A', '#7A8A6B', '#8A7A6B', '#6B6B8A',
]

function initials(name: string) {
  return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
}

// none      → not picked
// suggested → sales' tentative pick (yellow)
// assigned  → formal assignment by coordinator/scheduler (green)
export type InstallerCardState = 'none' | 'suggested' | 'assigned'

interface Props {
  installers:   InstallerUser[]
  stateOf:      (id: string) => InstallerCardState
  /** Omit to render the grid read-only (no clicks). */
  onToggle?:    (id: string) => void
  /** Per-card lock — e.g. sales cannot un-assign a formally assigned installer. */
  disabledOf?:  (id: string) => boolean
  /** Optional subtext under the installer name (e.g. "Sales suggested"). */
  noteOf?:      (id: string) => string | null
}

export function InstallerGrid({ installers, stateOf, onToggle, disabledOf, noteOf }: Props) {
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
            const meta     = [
              inst.role,
              inst.years_experience ? `${inst.years_experience}y` : null,
              inst.skills?.length ? inst.skills.join(', ') : null,
            ].filter(Boolean).join(' · ')

            const nameColor =
              st === 'assigned'  ? 'text-brand-green' :
              st === 'suggested' ? 'text-amber-700'   :
              'text-ink'
            const metaColor =
              st === 'assigned'  ? 'text-brand-green/70' :
              st === 'suggested' ? 'text-amber-600'      :
              'text-muted'

            return (
              <button
                key={inst.id}
                type="button"
                onClick={() => { if (!locked) onToggle?.(inst.id) }}
                disabled={locked}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-[1.5px] text-left w-full transition-all',
                  st === 'assigned'  ? 'border-brand-green bg-brand-green/20' :
                  st === 'suggested' ? 'border-amber-300 bg-amber-50'         :
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
                  <p className={cn('text-sm font-semibold truncate', nameColor)}>
                    {inst.name}
                  </p>
                  {meta && (
                    <p className={cn('text-[11px] truncate', metaColor)}>{meta}</p>
                  )}
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
