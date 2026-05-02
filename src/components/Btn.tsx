'use client'

import { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

type BtnVariant = 'primary' | 'secondary' | 'ghost'
type BtnSize    = 'sm' | 'md' | 'lg'

const variantStyles: Record<BtnVariant, string> = {
  primary:   'bg-terracotta text-white border border-transparent hover:brightness-90 active:brightness-75',
  secondary: 'bg-transparent text-ink border border-line hover:bg-bg active:bg-line',
  ghost:     'bg-transparent text-ink2 border border-transparent hover:text-ink',
}

const sizeStyles: Record<BtnSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2   text-sm',
  lg: 'px-5 py-2.5 text-sm',
}

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant
  size?:    BtnSize
  children: ReactNode
}

export function Btn({ variant = 'primary', size = 'md', className, children, ...props }: BtnProps) {
  return (
    <button
      {...props}
      className={cn(
        'inline-flex items-center justify-center gap-1.5',
        'rounded-lg font-medium lowercase tracking-wide',
        'transition-colors duration-150',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      {children}
    </button>
  )
}
