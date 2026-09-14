'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils/cn'
import { useAnchoredDropdown, dropdownStyle } from '@/components/useAnchoredDropdown'

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

function getRollingOptions() {
  const now      = new Date()
  const minutes  = now.getHours() * 60 + now.getMinutes()
  const startIdx = Math.min(Math.ceil(minutes / 15), 95)
  return [...TIME_OPTIONS.slice(startIdx), ...TIME_OPTIONS.slice(0, startIdx)]
}

export function TimeSelect({
  value,
  onChange,
  disabled,
  error,
  placeholder = '— select time —',
}: TimeSelectProps) {
  const [open,         setOpen]         = useState(false)
  const [rollingOpts,  setRollingOpts]  = useState(getRollingOptions)
  const ref     = useRef<HTMLDivElement>(null)
  const btnRef  = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const selected = TIME_OPTIONS.find(o => o.value === value?.slice(0, 5))

  // The list is portalled to <body> so the card's overflow-hidden cannot clip
  // it (Nic, 2026-09-14) — which also means it is no longer a DOM descendant
  // of `ref`, so the outside-click check below has to test it separately.
  const pos = useAnchoredDropdown(open && !disabled, btnRef, 192)

  // Close on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      const target = e.target as Node
      if (ref.current?.contains(target))     return
      if (listRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  // Recalculate the rolling order each time it opens
  useEffect(() => {
    if (!open) return
    setRollingOpts(getRollingOptions())
  }, [open])

  // Bring the selected time into view. Waits on `pos` because the list is
  // portalled and does not exist until it has been positioned — on [open]
  // alone this ran while listRef was still null and silently did nothing.
  //
  // Sets scrollTop by hand rather than calling scrollIntoView: the list is
  // position:fixed now, and scrollIntoView would scroll the PAGE behind it to
  // chase an element that never moves.
  useEffect(() => {
    if (!open || !pos) return
    const list = listRef.current
    if (!list) return
    const active = list.querySelector('[data-selected="true"]') as HTMLElement | null
    if (!active) return
    list.scrollTop = active.offsetTop - list.clientHeight / 2 + active.offsetHeight / 2
  }, [open, pos, rollingOpts])

  return (
    <div ref={ref} className="relative">
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className={cn(
          'w-full flex items-center justify-between rounded-lg border bg-paper px-3 py-2 text-sm text-left',
          'focus:outline-none focus:ring-2 focus:ring-offset-0 transition-colors duration-150',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          // Errors are --bad. This read moss green from the 2026-08-18 rebrand
          // until 2026-09-14 — same cause as Field/Input.
          error
            ? 'border-bad focus:ring-bad/20'
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

      {open && !disabled && pos && typeof document !== 'undefined' && createPortal(
        <div
          ref={listRef}
          style={dropdownStyle(pos)}
          // z-[80] clears the bottom nav (z-50) and every drawer/modal layer
          // (z-[60]–z-[70]) — a time field inside a modal must still open on top.
          className="z-[80] rounded-lg border border-line bg-paper shadow-lg overflow-y-auto"
        >
          <button
            type="button"
            onClick={() => { onChange(''); setOpen(false) }}
            className="w-full px-3 py-2 text-sm text-left text-muted hover:bg-bg transition-colors"
          >
            {placeholder}
          </button>
          {rollingOpts.map(o => (
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
        </div>,
        document.body,
      )}
    </div>
  )
}
