'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Search, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export type SelectOption = {
  id:    string
  label: string
}

interface Props {
  value:           string
  onChange:        (label: string) => void
  options:         SelectOption[]
  placeholder?:    string
  disabled?:       boolean
  onAddNew?:       (name: string) => Promise<SelectOption>
  onDeleteOption?: (id: string, label: string) => Promise<void>
  onClearOption?:  () => void
  confirmDelete?:  (label: string) => Promise<boolean>
}

export function SearchableSelect({
  value, onChange, options, placeholder = 'Select…', disabled = false,
  onAddNew, onDeleteOption, onClearOption, confirmDelete,
}: Props) {
  const [open,    setOpen]    = useState(false)
  const [query,   setQuery]   = useState('')
  const [loading, setLoading] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setOpen(false); setQuery('') }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [])

  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(query.toLowerCase()),
  )

  async function handleAddNew() {
    if (!onAddNew || !query.trim()) return
    setLoading(true)
    try {
      const created = await onAddNew(query.trim())
      onChange(created.label)
      setOpen(false)
      setQuery('')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(e: React.MouseEvent, opt: SelectOption) {
    e.stopPropagation()
    if (!onDeleteOption) return
    if (confirmDelete) {
      setOpen(false)
      setQuery('')
      const ok = await confirmDelete(opt.label)
      if (!ok) return
    }
    await onDeleteOption(opt.id, opt.label)
    if (value === opt.label) onClearOption?.()
  }

  const hasValue = value.trim().length > 0

  return (
    <div ref={wrapRef} className="relative">
      {/* Trigger */}
      <div
        onClick={() => { if (!disabled) { setOpen(o => !o); setQuery('') } }}
        className={cn(
          'flex items-center gap-2 w-full border rounded-lg px-3 py-2 text-sm min-h-[38px] transition-colors select-none',
          disabled
            ? 'opacity-45 cursor-not-allowed bg-bg border-line'
            : 'cursor-pointer bg-bg border-line hover:border-ink2',
          open && !disabled && 'border-terracotta bg-paper rounded-b-none',
          hasValue ? 'text-ink' : 'text-muted',
        )}
      >
        <span className="flex-1 truncate text-left">
          {hasValue ? value : placeholder}
        </span>
        {hasValue && onClearOption && !disabled && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onClearOption() }}
            className="w-[18px] h-[18px] rounded-full bg-line flex items-center justify-center hover:bg-terracotta hover:text-white transition-colors shrink-0"
            aria-label="Clear"
          >
            <X size={8} strokeWidth={2.5} />
          </button>
        )}
        <ChevronDown
          size={14}
          className={cn('text-muted shrink-0 transition-transform', open && 'rotate-180')}
        />
      </div>

      {/* Dropdown */}
      {open && !disabled && (
        <div className="absolute left-0 right-0 top-full z-50 bg-paper border border-terracotta border-t-0 rounded-b-lg shadow-lg max-h-56 flex flex-col">
          {/* Search bar */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-line shrink-0">
            <Search size={13} className="text-muted shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search…"
              className="flex-1 bg-transparent text-sm text-ink placeholder:text-muted outline-none"
              onKeyDown={e => { if (e.key === 'Enter' && onAddNew && filtered.length === 0) handleAddNew() }}
            />
          </div>

          {/* List */}
          <ul className="overflow-y-auto flex-1">
            {filtered.map(opt => (
              <li
                key={opt.id}
                onClick={() => { onChange(opt.label); setOpen(false); setQuery('') }}
                className="flex items-center gap-2 px-3 py-2.5 text-sm text-ink cursor-pointer hover:bg-bg group"
              >
                <span className="flex-1">{opt.label}</span>
                {onDeleteOption && (
                  <button
                    type="button"
                    onClick={e => handleDelete(e, opt)}
                    className="w-4 h-4 rounded-full flex items-center justify-center text-muted opacity-0 group-hover:opacity-100 hover:bg-terracotta/10 hover:text-terracotta transition-all"
                    aria-label={`Remove ${opt.label}`}
                  >
                    <X size={8} strokeWidth={2.5} />
                  </button>
                )}
              </li>
            ))}

            {/* Add new — shown when searching and no exact match */}
            {onAddNew && query.trim().length > 0 && filtered.length === 0 && (
              <li
                onClick={handleAddNew}
                className="flex items-center gap-2 px-3 py-2.5 text-sm text-terracotta font-medium cursor-pointer hover:bg-terracotta/5 border-t border-line"
              >
                <Plus size={13} />
                {loading ? 'Adding…' : `Add "${query.trim()}"`}
              </li>
            )}
            {/* Always-visible Add new at bottom */}
            {onAddNew && !(query.trim().length > 0 && filtered.length === 0) && (
              <li
                onClick={handleAddNew}
                className="flex items-center gap-2 px-3 py-2.5 text-sm text-terracotta font-medium cursor-pointer hover:bg-terracotta/5 border-t border-line"
              >
                <Plus size={13} />
                {loading ? 'Adding…' : 'Add new…'}
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
