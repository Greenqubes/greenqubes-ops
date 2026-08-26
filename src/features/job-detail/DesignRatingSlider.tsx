'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { t } from '@/lib/i18n'
import type { LangCode } from '@/lib/i18n'

interface Props {
  lang:      LangCode
  busy?:     boolean
  onConfirm: (rating: number) => void
  onCancel:  () => void
}

// Inline 1-5 "how heavy was this" rating + confirm. Shared by two hosts —
// the designer action bar (JobDetailShell, Task 8) and the notification
// drawer (Task 9) — so this component owns no layout/positioning of its own
// (no sticky bar, no modal chrome, no height animation): each host wraps it
// in whatever container fits its own placement. value/touched state lives
// here; only the final confirmed rating and cancel intent cross the prop
// boundary.
export function DesignRatingSlider({ lang, busy = false, onConfirm, onCancel }: Props) {
  const [value,   setValue]   = useState(3)
  const [touched, setTouched] = useState(false)

  return (
    <div className="space-y-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-ink">{t(lang, 'designRatingQ')}</p>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          aria-label={t(lang, 'cancel')}
          className="shrink-0 text-muted hover:text-ink transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <X size={16} />
        </button>
      </div>

      <div className="px-1">
        {/* No default shown until touched — an untouched slider carries no rating. */}
        <p className="text-center text-lg font-bold text-terracotta mb-1 h-6">
          {touched ? value : ''}
        </p>
        <input
          type="range"
          min={1}
          max={5}
          step={1}
          value={value}
          disabled={busy}
          onChange={e => { setValue(Number(e.target.value)); setTouched(true) }}
          className="w-full accent-brand-green disabled:opacity-50"
        />
        <div className="flex items-center justify-between text-[11px] text-muted mt-1">
          <span>{t(lang, 'designRatingLight')}</span>
          <span>{t(lang, 'designRatingHeavy')}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => { if (touched) onConfirm(value) }}
        disabled={!touched || busy}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-[10px] bg-brand-green text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {busy ? t(lang, 'loading') : t(lang, 'designRatingConfirm')}
      </button>
    </div>
  )
}
