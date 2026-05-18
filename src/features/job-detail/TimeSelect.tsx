'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils/cn'

export const TIME_OPTIONS = Array.from({ length: 96 }, (_, i) => {
  const h      = Math.floor(i / 4)
  const m      = (i % 4) * 15
  const hh     = String(h).padStart(2, '0')
  const mm     = String(m).padStart(2, '0')
  const period = h < 12 ? 'am' : 'pm'
  const h12    = h === 0 ? 12 : h > 12 ? h - 12 : h
  return { value: `${hh}:${mm}`, label: `${h12}:${mm}${period}` }
})

interface TimeSelectProps {
  value:        string
  onChange:     (v: string) => void
  disabled?:    boolean
  error?:       boolean
  placeholder?: string
}

export function TimeSelect({
  value,
  onChange,
  disabled,
  error,
  placeholder = '— select time —',
}: TimeSelectProps) {
  const [open, setOpen] = useState(false)
  const ref             = useRef<HTMLDivElement>(null)
  const listRef         = useRef<HTMLDivElement>(null)
  const selected        = TIME_OPTIONS.find(o => o.value === value?.slice(0, 5))

  // Close on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  // Scroll selected option into view when opening
  useEffect(() => {
    if (!open || !listRef.current) return
    const active = listRef.current.querySelector('[data-selected="true"]') as HTMLElement | null
    if (active) active.scrollIntoView({ block: 'center' })
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className={cn(
          'w-full flex items-center justify-between rounded-lg border bg-paper px-3 py-2 text-sm text-left',
          'focus:outline-none focus:ring-2 focus:ring-offset-0 transition-colors duration-150',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          error
            ? 'border-terracotta focus:ring-terracotta/20'
            : 'border-line focus:border-terracotta focus:ring-terracotta/20',
          !selected && 'text-muted'
        )}
      >
        <span>{selected ? selected.label : placeholder}</span>
        <svg
          className="w-3 h-3 text-muted shrink-0"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M2 4l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && !disabled && (
        <div
          ref={listRef}
          className="absolute z-50 w-full mt-1 rounded-lg border border-line bg-paper shadow-lg overflow-y-auto max-h-48"
        >
          <button
            type="button"
            onClick={() => { onChange(''); setOpen(false) }}
            className="w-full px-3 py-2 text-sm text-left text-muted hover:bg-bg transition-colors"
          >
            {placeholder}
          </button>
          {TIME_OPTIONS.map(o => (
            <button
              key={o.value}
              type="button"
              data-selected={o.value === value?.slice(0, 5) ? 'true' : undefined}
              onClick={() => { onChange(o.value); setOpen(false) }}
              className={cn(
                'w-full px-3 py-2 text-sm text-left transition-colors',
                o.value === value?.slice(0, 5)
                  ? 'bg-terracotta-soft text-terracotta font-medium'
                  : 'text-ink hover:bg-bg'
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
