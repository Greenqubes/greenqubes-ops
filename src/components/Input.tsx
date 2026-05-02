'use client'

import { InputHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils/cn'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ error, className, ...props }, ref) => (
    <input
      ref={ref}
      {...props}
      className={cn(
        'w-full rounded-lg border bg-paper px-3 py-2 text-sm text-ink',
        'placeholder:text-muted',
        'focus:outline-none focus:ring-2 focus:ring-offset-0',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'transition-colors duration-150',
        error
          ? 'border-terracotta focus:ring-terracotta/20'
          : 'border-line     focus:border-terracotta focus:ring-terracotta/20',
        className
      )}
    />
  )
)
Input.displayName = 'Input'
