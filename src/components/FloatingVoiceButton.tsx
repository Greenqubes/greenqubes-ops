'use client'

import { useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Mic } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { t } from '@/lib/i18n'
import { useDraggableFab } from '@/lib/utils/useDraggableFab'
import { VoiceModeOverlay } from '@/features/voice/VoiceModeOverlay'
import type { LangCode } from '@/lib/i18n'

interface Props {
  lang: LangCode
}

// The Voice PA's big shiny button — on every page for every role (job
// creation stays role-gated server-side). Unlike the chat bubble it also
// shows on /assistant: voice mode is its own surface, not the typed panel.
export function FloatingVoiceButton({ lang }: Props) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const { style: dragStyle, handlers: dragHandlers, isDragging } = useDraggableFab({
    id: 'voice',
    elementRef: buttonRef,
  })

  if (pathname === '/login') return null

  return (
    <>
      {open && <VoiceModeOverlay lang={lang} onClose={() => setOpen(false)} />}
      <button
        ref={buttonRef}
        onClick={() => setOpen(true)}
        onPointerDown={dragHandlers.onPointerDown}
        onClickCapture={dragHandlers.onClickCapture}
        style={dragStyle}
        aria-label={t(lang, 'voiceAssistant')}
        className={cn(
          // One slot above the chat bubble: its bottom (64/120) + its 48px
          // height + a 16px gap. Same draggable/edge-snap behaviour as the
          // other two FABs, just bigger — it is meant to be seen.
          'fixed right-4 bottom-[128px] lg:bottom-[184px] z-[60] w-16 h-16 rounded-full shadow-lg select-none',
          'flex items-center justify-center transition-all duration-200',
          'bg-terracotta text-white hover:bg-terracotta/90',
          isDragging && 'cursor-grabbing',
        )}
      >
        {/* Logo-lime glow ring (rgba literal: var() colours don't take /alpha) */}
        <span aria-hidden className="absolute -inset-1 rounded-full bg-[rgba(145,199,64,0.45)] animate-pulse -z-10" />
        <Mic size={26} />
      </button>
    </>
  )
}
