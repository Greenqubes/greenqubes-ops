'use client'

import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/Input'
import type { AutocompleteResponse, PlaceSuggestion } from '@/app/api/places/autocomplete/route'

/**
 * Location box with Singapore address suggestions.
 *
 * Typing calls our own server, which asks Google (the key never reaches the
 * browser). Everything degrades to a plain text box when the key is missing,
 * Google is down, or the person is offline — the address can always be typed
 * by hand, and a suggestion is only ever a shortcut.
 */

const MIN_QUERY_LENGTH = 3
// Long enough that a normal typist makes one call per address, not per letter.
const DEBOUNCE_MS = 350

interface Props {
  value:        string
  onChange:     (value: string) => void
  disabled?:    boolean
  error?:       boolean
  placeholder?: string
}

export function LocationInput({ value, onChange, disabled = false, error = false, placeholder }: Props) {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([])
  const [open,        setOpen]        = useState(false)
  const wrapRef  = useRef<HTMLDivElement>(null)
  // Set when the value changed because a suggestion was tapped, so picking an
  // address doesn't immediately re-query it and re-open the list.
  const justPicked = useRef(false)

  useEffect(() => {
    if (disabled) return
    if (justPicked.current) { justPicked.current = false; return }

    const query = value.trim()
    if (query.length < MIN_QUERY_LENGTH) {
      setSuggestions([])
      setOpen(false)
      return
    }

    const timer = setTimeout(() => {
      fetch('/api/places/autocomplete', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ input: query }),
      })
        .then(r => r.ok ? r.json() as Promise<AutocompleteResponse> : null)
        .then(data => {
          if (!data) return
          setSuggestions(data.suggestions)
          setOpen(data.suggestions.length > 0)
        })
        .catch(() => {}) // typing by hand still works
    }, DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [value, disabled])

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent | TouchEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
    }
  }, [open])

  function pick(suggestion: PlaceSuggestion) {
    justPicked.current = true
    onChange(suggestion.full)
    setOpen(false)
    setSuggestions([])
  }

  return (
    <div ref={wrapRef} className="relative">
      <Input
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => { if (suggestions.length) setOpen(true) }}
        onKeyDown={e => { if (e.key === 'Escape') setOpen(false) }}
        disabled={disabled}
        error={error}
        placeholder={placeholder}
        autoComplete="off"
      />

      {open && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 bg-paper border border-line rounded-lg shadow-lg overflow-hidden">
          {suggestions.map((s, i) => (
            <button
              key={`${s.full}-${i}`}
              type="button"
              onClick={() => pick(s)}
              className="w-full text-left px-3 py-2 hover:bg-bg border-b border-line last:border-b-0 transition-colors"
            >
              <span className="block text-sm text-ink truncate">{s.main}</span>
              {s.secondary && (
                <span className="block text-xs text-muted truncate">{s.secondary}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
