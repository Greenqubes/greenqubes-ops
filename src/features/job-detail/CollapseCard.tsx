'use client'

import { ChevronDown } from 'lucide-react'
import { Card } from '@/components/Card'
import { cn } from '@/lib/utils/cn'
import { useCardCollapse } from './useCardCollapse'

interface Props {
  title:          string
  storageKey:     string
  collapsible?:   boolean   // default true; chevron + fold apply on lg+ only
  bodyClassName?: string    // default 'p-4'; pass 'p-0' when children bring their own padding
  children:       React.ReactNode
}

export function CollapseCard({
  title, storageKey, collapsible = true, bodyClassName = 'p-4', children,
}: Props) {
  const { open, toggle } = useCardCollapse(storageKey)

  return (
    <Card className="overflow-hidden">
      <div className={cn(
        'px-4 py-3 border-b border-line flex items-center justify-between',
        !open && 'lg:border-b-0',
      )}>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">
          {title}
        </span>
        {collapsible && (
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            className="hidden lg:flex items-center justify-center w-6 h-6 rounded text-muted hover:text-ink transition-colors"
          >
            <ChevronDown size={14} className={cn('transition-transform', !open && '-rotate-90')} />
          </button>
        )}
      </div>
      {/* Below lg the card is always expanded — collapse is PC-only */}
      <div className={cn(bodyClassName, !open && 'lg:hidden')}>{children}</div>
    </Card>
  )
}
