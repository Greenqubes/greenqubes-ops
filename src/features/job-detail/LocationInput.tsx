'use client'

import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/Input'
import { composeAddress } from '@/lib/utils/job-form-rules'
import type { AutocompleteResponse, PlaceSuggestion } from '@/app/api/places/autocomplete/route'
import type { PlaceDetailsResponse } from '@/app/api/places/details/route'

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

function newSessionToken(): string {
  // randomUUID needs a secure context; older phone browsers get a plain
  // random string, which is all Google asks of a session token.
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `s-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
}

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
  // One token per address the person is looking up: it ties the typing and the
  // final details lookup together so Google charges one session, not one call
  // per keystroke. Reset after each pick.
  const session = useRef<string>(newSessionToken())

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
        body:    JSON.stringify({ input: query, sessionToken: session.current }),
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

  /**
   * Tapping a suggestion puts its label in the box straight away — the list
   * closes and nothing feels laggy — then swaps in the detailed address
   * (unit number, postcode) as soon as Google answers. If that lookup fails
   * the label simply stays, which is what the box used to hold anyway.
   */
  function pick(suggestion: PlaceSuggestion) {
    justPicked.current = true
    onChange(suggestion.full)
    setOpen(false)
    setSuggestions([])

    const token = session.current
    session.current = newSessionToken()   // this lookup ends the session

    if (!suggestion.placeId) return

    fetch('/api/places/details', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ placeId: suggestion.placeId, sessionToken: token }),
    })
      .then(r => r.ok ? r.json() as Promise<PlaceDetailsResponse> : null)
      .then(data => {
        if (!data?.formattedAddress) return
        justPicked.current = true   // the swap must not re-open the list
        onChange(composeAddress({
          name:     suggestion.main,
          fallback: suggestion.full,
          detailed: data.formattedAddress,
          types:    suggestion.types,
        }))
      })
      .catch(() => {}) // the label stays; the address is still usable
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
