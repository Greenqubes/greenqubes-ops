'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils/cn'
import type { InstallerUser } from '@/lib/supabase/queries/jobs'

const AVATAR_COLORS = [
  '#5C7A6B', '#7A6B8A', '#6B7A8A', '#8A6B6B',
  '#6B8A7A', '#7A8A6B', '#8A7A6B', '#6B6B8A',
]

function initials(name: string) {
  return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
}

interface Props {
  allInstallers:       InstallerUser[]
  onChange:            (selectedIds: string[]) => void
  initialSelectedIds?: string[]
  readOnly?:           boolean
}

export function InstallerGrid({ allInstallers, onChange, initialSelectedIds = [], readOnly = false }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelectedIds))
  const scrollRef  = useRef<HTMLDivElement>(null)
  const [showHint, setShowHint] = useState(false)

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

  function toggle(id: string) {
    if (readOnly) return
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      onChange([...next])
      return next
    })
  }

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        className="max-h-[290px] overflow-y-auto"
        style={{ scrollbarWidth: 'thin' }}
      >
        <div className="grid grid-cols-2 gap-2 pr-0.5 max-[480px]:grid-cols-1">
          {allInstallers.map((inst, i) => {
            const isSelected = selected.has(inst.id)
            const color      = AVATAR_COLORS[i % AVATAR_COLORS.length]
            const meta       = [
              inst.role,
              inst.years_experience ? `${inst.years_experience}y` : null,
              inst.skills?.length ? inst.skills.join(', ') : null,
            ].filter(Boolean).join(' · ')

            return (
              <button
                key={inst.id}
                type="button"
                onClick={() => toggle(inst.id)}
                disabled={readOnly}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-[1.5px] text-left w-full transition-all',
                  isSelected
                    ? 'border-green bg-green/20'
                    : 'border-line bg-paper',
                  !readOnly && !isSelected && 'hover:border-green hover:bg-green/5',
                  readOnly && 'cursor-default',
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
                  <p className={cn(
                    'text-sm font-semibold truncate',
                    isSelected ? 'text-green' : 'text-ink',
                  )}>
                    {inst.name}
                  </p>
                  {meta && (
                    <p className={cn('text-[11px] truncate', isSelected ? 'text-green/70' : 'text-muted')}>{meta}</p>
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
