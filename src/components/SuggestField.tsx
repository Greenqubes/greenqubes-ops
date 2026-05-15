'use client'

import { useState, ReactNode } from 'react'

interface Props {
  value:    string
  onAccept: (suggestion: string) => void
  readOnly?: boolean
  field?:   string
  children: ReactNode
}

export function SuggestField({ value, onAccept, readOnly = false, field, children }: Props) {
  const [loading,    setLoading]    = useState(false)
  const [suggestion, setSuggestion] = useState<string | null>(null)

  const handleSuggest = async () => {
    if (!value.trim() || loading) return
    setLoading(true)
    setSuggestion(null)
    try {
      const res  = await fetch('/api/ai/suggest', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ field, value }),
      })
      const data = await res.json() as { suggestion?: string }
      if (data.suggestion) setSuggestion(data.suggestion)
    } finally {
      setLoading(false)
    }
  }

  const showButton = !readOnly && value.trim().length > 0 && !loading && !suggestion

  return (
    <div>
      {(showButton || loading) && (
        <div className="flex justify-end mb-1">
          {showButton && (
            <button
              type="button"
              onClick={handleSuggest}
              className="text-xs font-medium text-terracotta hover:bg-terracotta/10 px-2 py-0.5 rounded transition-colors"
            >
              ✦ Suggest
            </button>
          )}
          {loading && (
            <span className="text-xs text-muted">loading…</span>
          )}
        </div>
      )}
      {children}
      {suggestion && (
        <div className="mt-2 rounded-lg border border-line bg-bg px-3 py-2.5">
          <p className="text-xs text-muted mb-1.5">✦ Suggested improvement</p>
          <p className="text-sm text-ink">{suggestion}</p>
          <div className="flex gap-2 mt-2.5">
            <button
              type="button"
              onClick={() => { onAccept(suggestion); setSuggestion(null) }}
              className="text-xs font-medium px-3 py-1.5 rounded-md bg-terracotta text-white"
            >
              Accept
            </button>
            <button
              type="button"
              onClick={() => setSuggestion(null)}
              className="text-xs font-medium px-3 py-1.5 rounded-md border border-line text-ink2"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
