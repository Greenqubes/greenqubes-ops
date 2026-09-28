'use client'

import { useState, type ReactNode } from 'react'
import { Languages } from 'lucide-react'
import { t } from '@/lib/i18n'
import { useToast } from '@/components/Toast'
import { translateTarget } from '@/lib/ai/translate'
import type { LangCode } from '@/lib/i18n'

// Translate button + panel for one piece of text, into the viewer's profile
// language (Nic, 2026-09-28). Returns the two halves separately so the button
// can share a label row with ✦ Suggest while the panel sits under the box.
// Read-only: nothing is written back to the form.
export function useTranslateText(value: string, lang: LangCode): { button: ReactNode; panel: ReactNode } {
  const { error: showError } = useToast()
  const [loading, setLoading] = useState(false)
  const [open,    setOpen]    = useState(false)
  // Remember what was translated, so an edited description never shows a
  // translation of the old wording.
  const [result,  setResult]  = useState<{ source: string; text: string } | null>(null)

  const text      = value ?? ''
  const available = !!translateTarget(lang) && text.trim().length > 0
  const fresh     = result !== null && result.source === text
  const showing   = open && fresh

  const handleClick = async () => {
    if (loading) return
    if (showing) { setOpen(false); return }
    if (fresh)   { setOpen(true);  return }
    setLoading(true)
    try {
      const res  = await fetch('/api/ai/translate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ value: text }),
      })
      const data = await res.json().catch(() => ({})) as { translation?: string; error?: string }
      if (!res.ok || !data.translation) {
        showError(data.error || t(lang, 'translateFailed'))
        return
      }
      setResult({ source: text, text: data.translation })
      setOpen(true)
    } catch {
      showError(t(lang, 'translateFailed'))
    } finally {
      setLoading(false)
    }
  }

  const button = available ? (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="text-xs font-medium text-muted border border-line bg-paper hover:text-terracotta hover:border-terracotta px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 shrink-0 disabled:opacity-60"
    >
      <Languages size={12} strokeWidth={1.75} />
      {loading ? t(lang, 'translating') : showing ? t(lang, 'hideTranslation') : t(lang, 'translate')}
    </button>
  ) : null

  const panel = showing && result ? (
    <div className="mt-2 rounded-lg border border-line bg-bg px-3 py-2.5">
      <p className="text-[10px] font-semibold tracking-wider uppercase text-muted mb-1">{t(lang, 'translationLabel')}</p>
      <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap">{result.text}</p>
    </div>
  ) : null

  return { button, panel }
}
