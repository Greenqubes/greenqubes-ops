'use client'

import { useRef, useEffect, useState } from 'react'
import { cn } from '@/lib/utils/cn'

// Same avatar palette as InstallerGrid — kept as its own copy since the two
// grids take differently-shaped data (designers are plain {id,label} options,
// installers carry role/experience/skills) and aren't meant to share a
// component, just a look.
const AVATAR_COLORS = [
  '#5C7A6B', '#7A6B8A', '#6B7A8A', '#8A6B6B',
  '#6B8A7A', '#7A8A6B', '#8A7A6B', '#6B6B8A',
]

function initials(name: string) {
  return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
}

export interface DesignerOption {
  id:    string
  label: string
}

interface Props {
  designers:    DesignerOption[]
  selectedIds:  string[]
  /** Omit to render the grid read-only (no clicks) — designer/production/installer roles. */
  onToggle?:    (id: string) => void
}

// Mirrors InstallerGrid's tile anatomy (avatar, name, full-fill selected
// state) minus installer-only bits — no meta line (role/experience/skills),
// no suggested/assigned split. Designer selection is a single state: picked
// or not (edit 3, smoke feedback 2026-08-27).
export function DesignerGrid({ designers, selectedIds, onToggle }: Props) {
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
          {designers.map((d, i) => {
            const selected = selectedIds.includes(d.id)
            const locked   = gridReadOnly
            const color    = AVATAR_COLORS[i % AVATAR_COLORS.length]

            return (
              <button
                key={d.id}
                type="button"
                onClick={() => { if (!locked) onToggle?.(d.id) }}
                disabled={locked}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-[1.5px] text-left w-full transition-all',
                  // Full-fill selected state — same green-soft treatment as
                  // InstallerGrid's assigned tile.
                  selected ? 'border-brand-green bg-brand-green-soft' : 'border-line bg-paper',
                  !locked && !selected && 'hover:border-brand-green hover:bg-brand-green/5',
                  locked && 'cursor-default',
                )}
              >
                <div className="shrink-0">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold text-white"
                    style={{ background: color }}
                  >
                    {initials(d.label)}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-semibold truncate', selected ? 'text-brand-green' : 'text-ink')}>
                    {d.label}
                  </p>
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
