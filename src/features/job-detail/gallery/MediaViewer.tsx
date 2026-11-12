'use client'

import { useEffect, useMemo, useState } from 'react'
import Lightbox, { type Slide, type GenericSlide } from 'yet-another-react-lightbox'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'
import Video from 'yet-another-react-lightbox/plugins/video'
import 'yet-another-react-lightbox/styles.css'
import { Download, MessageSquare, Trash2, Mic, Loader2 } from 'lucide-react'
import { t, type LangCode } from '@/lib/i18n'
import { followIndex, type GalleryItem, type GallerySource } from '@/lib/utils/gallery'
import { useSignedUrls, downloadFile } from './useSignedUrls'

// Two slide kinds of our own: a voice note, and a photo whose link is still
// being fetched.
declare module 'yet-another-react-lightbox' {
  interface SlideVoice extends GenericSlide { type: 'voice'; src: string | null }
  interface SlidePending extends GenericSlide { type: 'pending' }
  interface SlideTypes { voice: SlideVoice; pending: SlidePending }
}

const SOURCE_KEY: Record<GallerySource, 'galleryChat' | 'galleryVoiceNote' | 'galleryFiles' | 'galleryDesignBrief' | 'galleryProduction' | 'galleryCompletion' | 'galleryDo'> = {
  chat: 'galleryChat', voice: 'galleryVoiceNote', files: 'galleryFiles', design_brief: 'galleryDesignBrief',
  production: 'galleryProduction', completion: 'galleryCompletion', do: 'galleryDo',
}

const VIDEO_TYPE: Record<string, string> = { mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', '3gp': 'video/3gpp' }

/** "Mon 9 Nov, 3:42 PM" in Singapore time — English always (hard rule). */
function whenLabel(ts: string): string {
  const d = new Date(new Date(ts).getTime() + 8 * 3_600_000)
  const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'], MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const h = d.getUTCHours(), m = String(d.getUTCMinutes()).padStart(2, '0')
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MON[d.getUTCMonth()]}, ${h % 12 || 12}:${m} ${h >= 12 ? 'PM' : 'AM'}`
}

/**
 * The full-screen viewer for the job Gallery and the chat (Nic, 2026-11-11):
 * swipe through the job's photos, videos and voice notes, pinch to zoom, see
 * who sent each one and when, Download, Go to message (chat items), Delete.
 * It sits at z-index 85: above BottomNav and every job-page overlay, below
 * the delete dialog and the toasts. Links are fetched for the photo on screen and its neighbours
 * only.
 */
export function MediaViewer({ items, startKey, open, lang, onClose, onDelete, onGoToMessage }: {
  items: GalleryItem[]
  startKey: string | null
  open: boolean
  lang: LangCode
  onClose: () => void
  onDelete: (item: GalleryItem) => void
  onGoToMessage?: (item: GalleryItem) => void
}) {
  const { urls, sign } = useSignedUrls()
  // The viewer follows the photo it is ON, by key (final review I4): set once
  // when it opens; a new upload or a delete elsewhere shifts positions but
  // not what's on screen; if that photo itself goes, the next one shows.
  const [curKey, setCurKey] = useState<string | null>(startKey)
  const [lastIndex, setLastIndex] = useState(0)
  useEffect(() => {
    if (!open) return
    setCurKey(startKey)
    setLastIndex(Math.max(0, items.findIndex(i => i.key === startKey)))
  }, [open, startKey])  // eslint-disable-line react-hooks/exhaustive-deps

  const safe = followIndex(curKey, lastIndex, items.map(i => i.key))
  const current = items[safe] ?? null
  // Remember where it is, so a vanished photo hands over to its neighbour.
  useEffect(() => {
    if (!open || !current) return
    if (current.key !== curKey) setCurKey(current.key)
    if (safe !== lastIndex) setLastIndex(safe)
  }, [open, current, curKey, safe, lastIndex])
  // Everything gone (all deleted while open): close, never reopen by itself.
  useEffect(() => { if (open && items.length === 0) onClose() }, [open, items.length, onClose])

  useEffect(() => {
    if (!open) return
    const near = items.slice(Math.max(0, safe - 2), safe + 3).map(i => i.r2Key).filter((k): k is string => !!k)
    sign(near)
  }, [open, safe, items, sign])

  const slides = useMemo<Slide[]>(() => items.map(it => {
    const url = it.r2Key ? urls[it.r2Key] ?? null : null
    if (it.kind === 'voice') return { type: 'voice', src: url }
    if (!url) return { type: 'pending' }
    if (it.kind === 'video') {
      const ext = (it.name.split('.').pop() ?? '').toLowerCase()
      return { type: 'video', sources: [{ src: url, type: VIDEO_TYPE[ext] ?? 'video/mp4' }], controls: true }
    }
    return { type: 'image', src: url, alt: it.name }
  }), [items, urls])

  if (!open || items.length === 0) return null

  return (
    <Lightbox
      key={items.length}
      open={open}
      close={onClose}
      index={safe}
      slides={slides}
      plugins={[Zoom, Video]}
      on={{ view: ({ index: i }) => { setLastIndex(i); setCurKey(items[i]?.key ?? null) } }}
      carousel={{ finite: true, preload: 2 }}
      controller={{ closeOnBackdropClick: false }}
      // Above BottomNav and every job-page overlay (z-[81] at most), below the
      // delete dialog and the toast layer (toast-layer.test.ts).
      styles={{ root: { ['--yarl__portal_zindex' as string]: 85 } }}
      render={{
        slide: ({ slide }) => {
          if (slide.type === 'pending') {
            return <Loader2 className="animate-spin text-white/70" size={28} />
          }
          if (slide.type === 'voice') {
            return (
              <div className="flex flex-col items-center gap-4 text-white">
                <span className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-green/80"><Mic size={36} /></span>
                {slide.src
                  ? <audio controls src={slide.src} className="w-72 max-w-[80vw]" />
                  : <Loader2 className="animate-spin text-white/70" size={24} />}
              </div>
            )
          }
          return undefined
        },
        controls: () => current && (
          <>
            <div className="absolute left-0 right-14 top-0 px-4 py-3 text-white pointer-events-none">
              <p className="text-sm font-semibold truncate">{current.by ?? '—'}</p>
              <p className="text-xs text-white/70 truncate">
                {t(lang, SOURCE_KEY[current.source])} · {whenLabel(current.ts)} · {t(lang, 'galleryOf').replace('{i}', String(safe + 1)).replace('{n}', String(items.length))}
              </p>
            </div>
            {/* Big, thumb-sized buttons (Nic, 2026-11-12): icon over label so three
                fit side by side on a narrow phone. */}
            <div className="absolute inset-x-0 bottom-0 flex gap-3 px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-8 bg-gradient-to-t from-black/80 to-transparent">
              {current.r2Key && (
                <button type="button" onClick={() => void downloadFile(current.r2Key!, current.name)}
                  className="flex flex-1 min-w-0 min-h-[64px] flex-col items-center justify-center gap-1 rounded-xl bg-white/20 px-1 py-2.5 text-[13px] font-semibold leading-tight text-white active:bg-white/30">
                  <Download size={24} /> {t(lang, 'galleryDownload')}
                </button>
              )}
              {onGoToMessage && (current.source === 'chat' || current.source === 'voice') && (
                <button type="button" onClick={() => onGoToMessage(current)}
                  className="flex flex-1 min-w-0 min-h-[64px] flex-col items-center justify-center gap-1 rounded-xl bg-white/20 px-1 py-2.5 text-[13px] font-semibold leading-tight text-white active:bg-white/30">
                  <MessageSquare size={24} /> {t(lang, 'galleryGoToMessage')}
                </button>
              )}
              <button type="button" onClick={() => onDelete(current)}
                className="flex flex-1 min-w-0 min-h-[64px] flex-col items-center justify-center gap-1 rounded-xl bg-white/20 px-1 py-2.5 text-[13px] font-semibold leading-tight text-[#F2A6A6] active:bg-white/30">
                <Trash2 size={24} /> {t(lang, 'galleryDelete')}
              </button>
            </div>
          </>
        ),
      }}
    />
  )
}
