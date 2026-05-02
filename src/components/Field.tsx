import { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

interface FieldProps {
  label:    string
  htmlFor?: string
  hint?:    string
  error?:   string
  children: ReactNode
  className?: string
}

export function Field({ label, htmlFor, hint, error, children, className }: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink2">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-muted">{hint}</p>}
      {error         && <p className="text-xs text-terracotta">{error}</p>}
    </div>
  )
}
