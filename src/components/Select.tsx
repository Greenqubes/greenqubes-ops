'use client'

import { SelectHTMLAttributes, ReactNode, forwardRef } from 'react'
import { cn } from '@/lib/utils/cn'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?:    boolean
  children:  ReactNode
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ error, className, children, ...props }, ref) => (
    <select
      ref={ref}
      {...props}
      className={cn(
        'w-full rounded-lg border bg-paper px-3 py-2 text-sm text-ink cursor-pointer',
        'focus:outline-none focus:ring-2 focus:ring-offset-0',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'transition-colors duration-150',
        error
          ? 'border-terracotta focus:ring-terracotta/20'
          : 'border-line     focus:border-terracotta focus:ring-terracotta/20',
        className
      )}
    >
      {children}
    </select>
  )
)
Select.displayName = 'Select'
