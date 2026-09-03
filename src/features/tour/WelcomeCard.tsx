'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { LANGS, t, type LangCode } from '@/lib/i18n'

// First-login offer, two views: the welcome ask, then (after Start tour)
// the language chooser — Nic 2026-09-03. Language names come from LANGS'
// native labels, so they need no translation. Portaled to document.body
// with a mount gate — CompanyBar's sticky z-30 root is a stacking context
// (see NavDrawer.tsx).
export function WelcomeCard({ lang, onPick, onSkip }: {
  lang: LangCode
  onPick: (code: LangCode) => void
  onSkip: () => void
}) {
  const [mounted, setMounted] = useState(false)
  const [choosing, setChoosing] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  if (!mounted) return null

  return createPortal(
    <div data-tour-ui className="fixed inset-0 z-[80] flex items-center justify-center px-6 bg-black/40">
      <div className="w-full max-w-sm bg-paper border border-line rounded-card shadow-lg p-6 space-y-4">
        {choosing ? (
          <>
            <p className="font-display text-lg font-medium text-ink">{t(lang, 'tourLangTitle')}</p>
            <p className="text-sm text-ink2 leading-relaxed">{t(lang, 'tourLangBody')}</p>
            <div className="flex flex-col gap-2 pt-1">
              {LANGS.map(({ code, native }) => (
                <button
                  key={code}
                  onClick={() => onPick(code)}
                  className="w-full py-2.5 rounded-lg text-sm font-medium border border-line text-ink hover:border-ink2 transition-colors"
                >
                  {native}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="font-display text-lg font-medium text-ink">{t(lang, 'tourWelcomeTitle')}</p>
            <p className="text-sm text-ink2 leading-relaxed">{t(lang, 'tourWelcomeBody')}</p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={onSkip}
                className="flex-1 py-2 rounded-lg text-sm font-medium border border-line text-ink2 hover:border-ink2 transition-colors"
              >
                {t(lang, 'tourSkip')}
              </button>
              <button
                onClick={() => setChoosing(true)}
                className="flex-1 py-2 rounded-lg text-sm font-medium bg-terracotta text-white hover:opacity-90 transition-opacity"
              >
                {t(lang, 'tourStart')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
