'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { t, type LangCode, type Translations } from '@/lib/i18n'
import { placeCard, type Rect } from './placement'

const PAD = 6 // spotlight breathing room around the target

interface Props {
  lang: LangCode
  el: Element | null      // spotlight target; null → centred card, full dim
  titleKey: keyof Translations
  bodyKey: keyof Translations
  stepNo: number          // 1-based
  total: number
  isFirst: boolean
  isLast: boolean
  onNext: () => void
  onBack: () => void
  onExit: () => void
}

export function TourOverlay({ lang, el, titleKey, bodyKey, stepNo, total, isFirst, isLast, onNext, onBack, onExit }: Props) {
  const [mounted, setMounted] = useState(false)
  const [rect, setRect] = useState<Rect | null>(null)
  const [cardStyle, setCardStyle] = useState<React.CSSProperties>({ visibility: 'hidden' })
  const [sheet, setSheet] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setMounted(true) }, [])

  // Measure the target; re-measure on resize + scroll (capture phase so
  // scrolls inside nested containers count too).
  useEffect(() => {
    if (!el) { setRect(null); return }
    const measure = () => {
      const r = el.getBoundingClientRect()
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
    }
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [el])

  // Position the card once its size is known.
  useLayoutEffect(() => {
    const card = cardRef.current
    if (!card) return
    if (!rect) { setSheet(false); setCardStyle({ visibility: 'hidden' }); return }
    const placed = placeCard(
      { top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 },
      { width: card.offsetWidth, height: card.offsetHeight },
      { width: window.innerWidth, height: window.innerHeight },
    )
    if (placed.mode === 'sheet') { setSheet(true); setCardStyle({}) }
    else { setSheet(false); setCardStyle({ top: placed.top, left: placed.left }) }
  }, [rect, stepNo])

  if (!mounted) return null

  const cardBody = (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-display text-base font-medium text-ink">{t(lang, titleKey)}</p>
        <span className="text-[11px] text-muted shrink-0">{stepNo} / {total}</span>
      </div>
      <p className="text-sm text-ink2 leading-relaxed mt-1.5">{t(lang, bodyKey)}</p>
      <div className="flex items-center gap-2 mt-3">
        <button onClick={onExit} className="text-xs text-muted hover:text-ink transition-colors mr-auto">
          {t(lang, 'tourExit')}
        </button>
        {!isFirst && (
          <button onClick={onBack} className="px-3 py-1.5 rounded-lg text-sm font-medium border border-line text-ink2 hover:border-ink2 transition-colors">
            {t(lang, 'tourBack')}
          </button>
        )}
        <button onClick={onNext} className="px-4 py-1.5 rounded-lg text-sm font-medium bg-terracotta text-white hover:opacity-90 transition-opacity">
          {t(lang, isLast ? 'tourFinish' : 'tourNext')}
        </button>
      </div>
    </>
  )

  return createPortal(
    <div data-tour-ui>
      {/* Click shield — show-and-explain: nothing underneath is tappable */}
      <div className="fixed inset-0 z-[80]" />
      {rect ? (
        // Spotlight: transparent hole, the giant box-shadow paints the scrim.
        <div
          className="fixed z-[80] rounded-xl pointer-events-none transition-all duration-200"
          style={{
            top: rect.top - PAD, left: rect.left - PAD,
            width: rect.width + PAD * 2, height: rect.height + PAD * 2,
            boxShadow: '0 0 0 100vmax rgba(0,0,0,0.55)',
          }}
        />
      ) : (
        <div className="fixed inset-0 z-[80] bg-black/55" />
      )}
      {rect && !sheet ? (
        <div ref={cardRef} className="fixed z-[81] w-[300px] max-w-[calc(100vw-16px)] bg-paper border border-line rounded-card shadow-lg p-4" style={cardStyle}>
          {cardBody}
        </div>
      ) : rect && sheet ? (
        <div ref={cardRef} className="fixed z-[81] inset-x-0 bottom-0 bg-paper border-t border-line rounded-t-2xl shadow-lg p-4 pb-[max(env(safe-area-inset-bottom),16px)]">
          {cardBody}
        </div>
      ) : (
        <div ref={cardRef} className="fixed z-[81] inset-0 flex items-center justify-center px-6 pointer-events-none">
          <div className="w-full max-w-sm bg-paper border border-line rounded-card shadow-lg p-5 pointer-events-auto">
            {cardBody}
          </div>
        </div>
      )}
    </div>,
    document.body,
  )
}
