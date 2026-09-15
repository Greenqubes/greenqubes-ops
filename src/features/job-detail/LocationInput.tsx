'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Input } from '@/components/Input'
import { useAnchoredDropdown, dropdownStyle } from '@/components/useAnchoredDropdown'
import { composeAddress, shouldSuggestAddresses, shouldOfferPreviousLocation } from '@/lib/utils/job-form-rules'
import { t, type LangCode } from '@/lib/i18n'
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
  lang?:        LangCode
  /** Address this job was duplicated from. Offered beneath an EMPTY box only. */
  previousLocation?:          string | null
  onUsePreviousLocation?:     () => void
  onDismissPreviousLocation?: () => void
}

export function LocationInput({
  value, onChange, disabled = false, error = false, placeholder,
  lang = 'en', previousLocation = null, onUsePreviousLocation, onDismissPreviousLocation,
}: Props) {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([])
  const [open,        setOpen]        = useState(false)
  const wrapRef  = useRef<HTMLDivElement>(null)
  const listRef  = useRef<HTMLDivElement>(null)
  // Set when the value changed because a suggestion was tapped, so picking an
  // address doesn't immediately re-query it and re-open the list.
  const justPicked = useRef(false)
  // True once this person has typed in the box. A value that merely arrived
  // in the field never counts — see shouldSuggestAddresses.
  const userEdited = useRef(false)
  // One token per address the person is looking up: it ties the typing and the
  // final details lookup together so Google charges one session, not one call
  // per keystroke. Reset after each pick.
  const session = useRef<string>(newSessionToken())

  // Suggestions are two lines each, so ~5 of them fit in 260px. The list is
  // portalled to <body> (see below) and positioned against the box.
  const pos = useAnchoredDropdown(open && suggestions.length > 0, wrapRef, 260, listRef)

  useEffect(() => {
    // A value arriving from anywhere other than the keyboard — the form
    // loading a saved job, a duplicate prefilling, the detailed-address swap
    // after a pick — is not a request for suggestions. Without this the list
    // dropped open the instant a job with an address was opened, over the
    // fields beneath it (Nic, 2026-09-14).
    if (!shouldSuggestAddresses({ value, disabled, userEdited: userEdited.current, justPicked: justPicked.current })) {
      if (justPicked.current) justPicked.current = false
      if (value.trim().length < MIN_QUERY_LENGTH) {
        setSuggestions([])
        setOpen(false)
      }
      return
    }

    const query = value.trim()
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
      const target = e.target as Node
      // The list is portalled, so it is NOT inside wrapRef any more — without
      // this second check, tapping a suggestion closed the list before the
      // click landed and nothing was picked.
      if (wrapRef.current?.contains(target)) return
      if (listRef.current?.contains(target)) return
      setOpen(false)
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
        onChange={e => { userEdited.current = true; onChange(e.target.value) }}
        onFocus={() => { if (suggestions.length) setOpen(true) }}
        onKeyDown={e => { if (e.key === 'Escape') setOpen(false) }}
        disabled={disabled}
        error={error}
        placeholder={placeholder}
        autoComplete="off"
      />

      {/* The address this job was duplicated from. Duplicate leaves Location
          blank so a bulk copy can never silently inherit the wrong site
          (Nic, 2026-09-15); this puts the old value one tap away for the
          same-site case. Empty box only — typing anything dismisses it. */}
      {shouldOfferPreviousLocation({ current: value, previous: previousLocation, disabled }) && (
        <div className="mt-1.5 flex items-start gap-2">
          <button
            type="button"
            onClick={() => onUsePreviousLocation?.()}
            className="flex-1 min-w-0 text-left text-xs text-muted hover:text-terracotta border border-dashed border-line hover:border-terracotta rounded-md px-2.5 py-1.5 transition-colors"
          >
            <span className="block font-medium">{t(lang, 'usePreviousAddress')}</span>
            <span className="block truncate text-muted">{previousLocation}</span>
          </button>
          <button
            type="button"
            onClick={() => onDismissPreviousLocation?.()}
            aria-label={t(lang, 'dismiss')}
            className="text-muted hover:text-ink text-xs px-2 py-1.5 shrink-0 transition-colors"
          >
            ✕
          </button>
        </div>
      )}

      {/* Portalled for the same reason as TimeSelect: the card's
          overflow-hidden would clip these suggestions. This one usually sat
          high enough in the card to escape it, which is why only the time
          picker was reported (Nic, 2026-09-14). */}
      {open && suggestions.length > 0 && pos && typeof document !== 'undefined' && createPortal(
        <div
          ref={listRef}
          style={dropdownStyle(pos)}
          className="z-[80] bg-paper border border-line rounded-lg shadow-lg overflow-y-auto">
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
        </div>,
        document.body,
      )}
    </div>
  )
}
