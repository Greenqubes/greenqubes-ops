import { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

interface FieldProps {
  label:    string
  htmlFor?: string
  hint?:    string
  error?:   string
  /** Small control pinned to the right of the label row (Open Maps, etc.). */
  action?:  ReactNode
  children: ReactNode
  className?: string
}

export function Field({ label, htmlFor, hint, error, action, children, className }: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {/* The error sits beside the label, one size smaller (Nic, 2026-09-10),
          so a person's eye lands on the field title and the reason together.
          Red is --bad: the old text-terracotta has rendered moss GREEN since
          the 2026-08-18 palette rebrand, which is not what an error means. */}
      <div className={cn('flex gap-2', action ? 'items-center justify-between min-h-[1.75rem]' : 'items-baseline flex-wrap')}>
        <div className="flex items-baseline gap-2 flex-wrap min-w-0">
          <label htmlFor={htmlFor} className="text-sm font-medium text-ink2">
            {label}
          </label>
          {error && <span className="text-xs font-medium text-bad">{error}</span>}
        </div>
        {action}
      </div>
      {children}
      {hint && !error && <p className="text-xs text-muted">{hint}</p>}
    </div>
  )
}
