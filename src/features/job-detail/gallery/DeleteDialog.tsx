'use client'

import { t, type LangCode } from '@/lib/i18n'

/**
 * WhatsApp's delete choice (Nic, 2026-11-11): Delete for me always; Delete
 * for everyone only for the items this person may delete that way. Built
 * into the page — the browser's own confirm box is never used. Sits above
 * the full-screen viewer (z-index 85) and BottomNav, and below the toast layer (toast-layer.test.ts).
 */
export function DeleteDialog({ count, everyoneCount, open, busy, lang, onMe, onEveryone, onClose }: {
  count: number
  everyoneCount: number
  open: boolean
  busy: boolean
  lang: LangCode
  onMe: () => void
  onEveryone: () => void
  onClose: () => void
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl bg-paper p-5 space-y-4 shadow-xl">
        <p className="font-display text-lg text-ink">{t(lang, 'galleryDeleteTitle').replace('{n}', String(count))}</p>
        {everyoneCount > 0 && everyoneCount < count && (
          <p className="text-sm text-ink2">{t(lang, 'galleryDeleteSome').replace('{e}', String(everyoneCount))}</p>
        )}
        <div className="flex flex-col gap-2">
          {everyoneCount > 0 && (
            <button type="button" disabled={busy} onClick={onEveryone}
              className="w-full rounded-xl bg-bad px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
              {t(lang, 'galleryDeleteForEveryone')}
            </button>
          )}
          <button type="button" disabled={busy} onClick={onMe}
            className="w-full rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-bad disabled:opacity-50">
            {t(lang, 'galleryDeleteForMe')}
          </button>
          <button type="button" disabled={busy} onClick={onClose}
            className="w-full rounded-xl px-4 py-2.5 text-sm text-ink2 disabled:opacity-50">
            {t(lang, 'cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}
