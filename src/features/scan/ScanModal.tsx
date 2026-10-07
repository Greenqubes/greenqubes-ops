'use client'
// Full-screen scanner: corners → preview → pages → Save (or Download).
// Portalled to <body> at z-[70] so it sits above the bottom nav (hard rule).

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, RotateCcw, Plus, Check, Download, ArrowLeft, Camera } from 'lucide-react'
import { Btn } from '@/components/Btn'
import { useToast } from '@/components/Toast'
import { t, type LangCode } from '@/lib/i18n'
import { useUnsavedWork } from '@/features/app-version/unsaved-work'
import { detectCorners } from '@/lib/scan/detect-corners'
import { insetQuad, type Quad } from '@/lib/scan/geometry'
import type { RGBAImage } from '@/lib/scan/image'
import { buildPdf } from '@/lib/scan/pdf'
import { scanFileName } from '@/lib/scan/file-name'
import { loadSource, fetchJobFileBlob } from './load-source'
import { processPage, type ScannedPage } from './process-page'
import { CornerEditor } from './CornerEditor'

export type ScanSource = { kind: 'file'; file: File } | { kind: 'job'; r2Key: string; name: string | null }

interface Props {
  lang: LangCode
  jobTitle: string | null
  first: ScanSource
  jobImages: { r2Key: string; name: string | null }[]
  /** Save into the job (the person can upload to Signed DO); otherwise the PDF downloads. */
  canSave: boolean
  /** Must throw on failure — the scanner keeps the pages and shows the reason. */
  onSave: (pdf: Blob, filename: string) => Promise<void>
  onClose: () => void
}

type Loaded = { image: RGBAImage; url: string; quad: Quad }
type Step = 'loading' | 'corners' | 'processing' | 'pages' | 'saving'

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export function ScanModal({ lang, jobTitle, first, jobImages, canSave, onSave, onClose }: Props) {
  const { error: showError, success: showSuccess } = useToast()
  const [step, setStep] = useState<Step>('loading')
  const [current, setCurrent] = useState<Loaded | null>(null)
  const [pages, setPages] = useState<ScannedPage[]>([])
  const [addMenu, setAddMenu] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const savingRef = useRef(false)

  // pages not yet saved are unsaved work — a post-deploy refresh waits
  useUnsavedWork('do-scan', pages.length > 0 || step === 'saving')

  // latest values for callbacks and the unmount cleanup
  const pagesRef = useRef(pages); pagesRef.current = pages
  const currentRef = useRef(current); currentRef.current = current

  const open = async (src: ScanSource) => {
    setStep('loading'); setAddMenu(false)
    try {
      const blob = src.kind === 'file' ? src.file : await fetchJobFileBlob(src.r2Key, src.name)
      const { image, url } = await loadSource(blob)
      const quad = detectCorners(image) ?? insetQuad(image.width, image.height)
      setCurrent(prev => { if (prev) URL.revokeObjectURL(prev.url); return { image, url, quad } })
      setStep('corners')
    } catch {
      // HEIC on desktop Chrome, a PDF picked by mistake, a failed download
      showError(t(lang, 'scanOpenFailed'))
      if (pagesRef.current.length) setStep('pages')
      else if (currentRef.current) setStep('corners')
      else onClose()
    }
  }

  useEffect(() => { void open(first) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    pagesRef.current.forEach(p => URL.revokeObjectURL(p.url))
    if (currentRef.current) URL.revokeObjectURL(currentRef.current.url)
  }, [])

  const next = async () => {
    if (!current || step !== 'corners') return
    setStep('processing')
    try {
      const page = await processPage(current.image, current.quad)
      setPages(ps => [...ps, page])
      setStep('pages')
    } catch (err) {
      showError(err instanceof Error ? err.message : String(err))
      setStep('corners')
    }
  }

  // Retake = drop the last page and take a NEW photo (final review: it used
  // to reopen the same blurry photo). Cancelling the camera leaves the old
  // photo's corners on screen, where New photo / Back still work.
  const retakeLast = () => {
    setPages(ps => { const last = ps[ps.length - 1]; if (last) URL.revokeObjectURL(last.url); return ps.slice(0, -1) })
    setStep('corners')
    fileRef.current?.click()
  }

  const finish = async () => {
    // a double tap must not upload twice — state alone is too slow to block it
    if (savingRef.current || !pagesRef.current.length) return
    savingRef.current = true
    setStep('saving')
    try {
      const pdfPages = await Promise.all(pagesRef.current.map(async p => ({
        jpeg: new Uint8Array(await p.jpeg.arrayBuffer()), widthPx: p.width, heightPx: p.height,
      })))
      const pdf = new Blob([buildPdf(pdfPages)], { type: 'application/pdf' })
      const filename = scanFileName(jobTitle, new Date())
      const onPc = window.matchMedia('(pointer: fine)').matches
      if (canSave) await onSave(pdf, filename)
      if (!canSave || onPc) downloadBlob(pdf, filename)
      if (canSave) showSuccess(t(lang, 'scanSaved'))
      setPages([])
      onClose()
    } catch (err) {
      showError(t(lang, 'uploadFailed').replace('{reason}', err instanceof Error ? err.message : String(err)))
      setStep('pages')
    } finally {
      savingRef.current = false
    }
  }

  const close = () => {
    if (savingRef.current) return
    if (pagesRef.current.length && !window.confirm(t(lang, 'scanDiscardConfirm'))) return
    onClose()
  }

  const busy = step === 'loading' || step === 'processing' || step === 'saving'

  return createPortal(
    <div className="fixed inset-0 z-[70] flex flex-col bg-black text-white">
      <div className="flex items-center justify-between px-4 py-3">
        <p className="text-sm font-medium">
          {t(lang, 'scanTitle')}{pages.length > 0 && ` · ${t(lang, 'scanPages').replace('{n}', String(pages.length))}`}
        </p>
        <button type="button" onClick={close} aria-label="Close" disabled={step === 'saving'}
          className="p-2 rounded hover:bg-white/10 disabled:opacity-40">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-auto px-4 pb-4 flex flex-col items-center justify-center gap-3">
        {busy && (
          <p className="text-sm opacity-80">{step === 'saving' ? t(lang, 'uploading') : t(lang, 'scanProcessing')}</p>
        )}

        {step === 'corners' && current && (
          <>
            <p className="text-xs opacity-80">{t(lang, 'scanAdjustHint')}</p>
            <CornerEditor imageUrl={current.url} width={current.image.width} height={current.image.height}
              quad={current.quad} onChange={quad => setCurrent(c => (c ? { ...c, quad } : c))} />
          </>
        )}

        {step === 'pages' && pages.length > 0 && (
          <div className="flex gap-3 overflow-x-auto max-w-full">
            {pages.map((p, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={p.url} src={p.url} alt={`page ${i + 1}`} className="max-h-[62dvh] rounded bg-white" />
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 px-4 py-3 border-t border-white/10">
        {step === 'corners' && (
          <>
            {pages.length > 0 && (
              <Btn variant="secondary" className="bg-paper" onClick={() => setStep('pages')}><ArrowLeft size={14} />{t(lang, 'scanBack')}</Btn>
            )}
            <Btn variant="secondary" className="bg-paper" onClick={() => fileRef.current?.click()}><Camera size={14} />{t(lang, 'scanNewPhoto')}</Btn>
            <Btn variant="accent" onClick={next}><Check size={14} />{t(lang, 'scanNext')}</Btn>
          </>
        )}
        {step === 'pages' && (
          <>
            <Btn variant="secondary" className="bg-paper" onClick={retakeLast}><RotateCcw size={14} />{t(lang, 'scanRetake')}</Btn>
            <div className="relative">
              <Btn variant="secondary" className="bg-paper"
                onClick={() => (jobImages.length ? setAddMenu(m => !m) : fileRef.current?.click())}>
                <Plus size={14} />{t(lang, 'scanAddPage')}
              </Btn>
              {addMenu && (
                <div className="absolute bottom-full mb-2 left-0 w-64 max-w-[80vw] rounded-lg bg-paper text-ink shadow-lg overflow-hidden">
                  <button type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-bg"
                    onClick={() => { setAddMenu(false); fileRef.current?.click() }}>{t(lang, 'scanFromCamera')}</button>
                  {jobImages.map(img => (
                    <button key={img.r2Key} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-bg truncate"
                      onClick={() => void open({ kind: 'job', r2Key: img.r2Key, name: img.name })}>
                      {t(lang, 'scanFromJob')}: {img.name ?? img.r2Key.split('/').pop()}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Btn variant="accent" onClick={finish}>
              {canSave ? <><Check size={14} />{t(lang, 'scanSave')}</> : <><Download size={14} />{t(lang, 'scanDownload')}</>}
            </Btn>
          </>
        )}
      </div>

      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void open({ kind: 'file', file: f }) }} />
    </div>,
    document.body,
  )
}
