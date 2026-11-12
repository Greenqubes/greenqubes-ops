'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Download, ExternalLink } from 'lucide-react'
import { t, type LangCode } from '@/lib/i18n'
import { downloadFile } from './useSignedUrls'
import type { GalleryItem } from '@/lib/utils/gallery'

/**
 * A PDF opened inside the app (Nic, 2026-11-11). Android Chrome can't show a
 * PDF inside a page on its own, so pages are drawn to canvas with pdf.js (a
 * library loaded only when a PDF is opened). If it can't — say the storage
 * refuses the read — the person can still open or download it.
 */
export function PdfViewer({ item, url, open, lang, onClose }: {
  item: GalleryItem | null
  url: string | null
  open: boolean
  lang: LangCode
  onClose: () => void
}) {
  const box = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !url || !box.current) return
    let cancelled = false
    const host = box.current
    host.innerHTML = ''
    setFailed(false)
    setLoading(true)
    ;(async () => {
      try {
        const pdfjs = await import('pdfjs-dist')
        pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
        const doc = await pdfjs.getDocument({ url }).promise
        const width = Math.min(host.clientWidth || 800, 1000)
        for (let n = 1; n <= doc.numPages && !cancelled; n++) {
          const page = await doc.getPage(n)
          const base = page.getViewport({ scale: 1 })
          const scale = (width / base.width) * (window.devicePixelRatio || 1)
          const viewport = page.getViewport({ scale })
          const canvas = document.createElement('canvas')
          canvas.width = viewport.width
          canvas.height = viewport.height
          canvas.style.width = '100%'
          canvas.className = 'block bg-white shadow mb-3 rounded'
          host.appendChild(canvas)
          await page.render({ canvas, viewport }).promise
        }
      } catch {
        if (!cancelled) setFailed(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [open, url])

  if (!open || !item || typeof document === 'undefined') return null
  // On the page body, like the delete dialog (final review I1).
  return createPortal(
    <div className="fixed inset-0 z-[70] flex flex-col bg-black/90">
      <div className="flex items-center gap-2 px-3 py-2 text-white">
        <p className="flex-1 min-w-0 truncate text-sm font-medium">{item.name}</p>
        {item.r2Key && (
          <button type="button" aria-label={t(lang, 'galleryDownload')} onClick={() => void downloadFile(item.r2Key!, item.name)}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 hover:bg-white/25 active:bg-white/30"><Download size={22} /></button>
        )}
        <button type="button" aria-label={t(lang, 'close')} onClick={onClose}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 hover:bg-white/25 active:bg-white/30"><X size={22} /></button>
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-6">
        <div ref={box} className="mx-auto max-w-[1000px]" />
        {loading && <p className="py-10 text-center text-sm text-white/70">…</p>}
        {failed && (
          <div className="py-10 text-center space-y-3">
            <p className="text-sm text-white/80">{t(lang, 'galleryPdfFailed')}</p>
            {url && (
              <a href={url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-2 text-sm text-white">
                <ExternalLink size={14} /> {t(lang, 'galleryOpenInBrowser')}
              </a>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
