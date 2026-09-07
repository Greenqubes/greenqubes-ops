'use client'

import { useState, useRef, useEffect } from 'react'
import { Search, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { RoleFilter } from '@/components/RoleFilter'
import { rolesPresent, filterPickerOptions } from '@/lib/utils/user-meta'

interface Props {
  options:      Array<{ id: string; label: string; role?: string | null }>
  value:        string[]
  onChange:     (ids: string[]) => void
  disabled?:    boolean
  placeholder?: string
}

export function MultiUserSelect({ options, value, onChange, disabled = false, placeholder = '+ Add coordinator' }: Props) {
  const [open,  setOpen]  = useState(false)
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const wrapRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
        setRoleFilter('all')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Close dropdown on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setOpen(false); setQuery(''); setRoleFilter('all') }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [])

  // Users not yet selected
  const unselected = options.filter(o => !value.includes(o.id))

  // Role filter offers only roles the options actually carry, in canonical
  // order. Derived from the full option list, not `unselected`, so the choices
  // don't shift underneath you as you add people.
  const roles = rolesPresent(options)

  // Role and search applied together
  const filtered = filterPickerOptions(unselected, roleFilter, query)

  function addUser(id: string) {
    onChange([...value, id])
    setOpen(false)
    setQuery('')
    setRoleFilter('all')
  }

  function removeUser(id: string) {
    onChange(value.filter(v => v !== id))
  }

  // Resolve display labels for selected ids (preserve order, skip unknown ids)
  const selectedOptions = value
    .map(id => options.find(o => o.id === id))
    .filter((o): o is { id: string; label: string } => o !== undefined)

  const isEmpty = selectedOptions.length === 0

  return (
    <div ref={wrapRef} className="relative">

      {/* Pill row + Add button, all inline-wrapping */}
      <div className="flex flex-wrap items-center gap-1.5 min-h-[28px]">

        {/* Selected pills */}
        {selectedOptions.map(opt => (
          <span
            key={opt.id}
            className="inline-flex items-center gap-1 bg-terracotta/10 text-terracotta text-xs font-medium px-2 py-0.5 rounded-full"
          >
            {opt.label}
            {!disabled && (
              <button
                type="button"
                onClick={() => removeUser(opt.id)}
                aria-label={`Remove ${opt.label}`}
                className="ml-0.5 hover:text-terracotta/60 transition-colors leading-none"
              >
                <X size={10} strokeWidth={2.5} />
              </button>
            )}
          </span>
        ))}

        {/* Empty state — disabled */}
        {isEmpty && disabled && (
          <span className="text-sm text-muted">—</span>
        )}

        {/* Empty state — editable: placeholder doubles as the open trigger */}
        {isEmpty && !disabled && (
          <button
            type="button"
            onClick={() => { setOpen(o => !o); setQuery(''); setRoleFilter('all') }}
            className="text-xs text-muted hover:text-terracotta transition-colors"
          >
            {placeholder}
          </button>
        )}

        {/* Add button — only shown when there are already selected pills */}
        {!isEmpty && !disabled && (
          <button
            type="button"
            onClick={() => { setOpen(o => !o); setQuery(''); setRoleFilter('all') }}
            aria-label="Add user"
            className="inline-flex items-center gap-0.5 text-terracotta text-xs font-medium hover:text-terracotta/70 transition-colors"
          >
            <Plus size={11} strokeWidth={2.5} />
            Add
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && !disabled && (
        <div className="absolute left-0 top-full mt-1 z-50 w-56 bg-paper border border-line rounded-lg shadow-lg max-h-56 flex flex-col">

          {/* Search bar */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-line shrink-0">
            <Search size={13} className="text-muted shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search…"
              className="flex-1 bg-transparent text-sm text-ink placeholder:text-muted outline-none"
            />
          </div>

          {/* Role filter — hidden when the options carry no roles */}
          <RoleFilter roles={roles} value={roleFilter} onChange={setRoleFilter} />

          {/* User list */}
          <ul className="overflow-y-auto flex-1">
            {filtered.map(opt => (
              <li
                key={opt.id}
                onClick={() => addUser(opt.id)}
                className="px-3 py-2 text-sm text-ink hover:bg-bg cursor-pointer"
              >
                {opt.label}
              </li>
            ))}

            {filtered.length === 0 && (
              <li className="px-3 py-2 text-sm text-muted select-none">
                {query.trim().length > 0
                  ? 'No match'
                  : roleFilter !== 'all' ? 'Nobody with that role' : 'No users to add'}
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
