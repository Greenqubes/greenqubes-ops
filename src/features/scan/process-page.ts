'use client'
// One page through the scanner. Worker first; the main thread if this browser
// has no OffscreenCanvas in workers (older iOS) — same pipeline either way.

import { straightenAndWhiten } from '@/lib/scan/pipeline'
import type { RGBAImage } from '@/lib/scan/image'
import type { Quad } from '@/lib/scan/geometry'

export interface ScannedPage { jpeg: Blob; width: number; height: number; url: string }

type WorkerReply = { ok: true; jpeg: Blob; width: number; height: number } | { ok: false; error: string }

function inWorker(image: RGBAImage, quad: Quad): Promise<ScannedPage> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./scan.worker.ts', import.meta.url))
    worker.onmessage = (e: MessageEvent<WorkerReply>) => {
      worker.terminate()
      const r = e.data
      if (r.ok) resolve({ jpeg: r.jpeg, width: r.width, height: r.height, url: URL.createObjectURL(r.jpeg) })
      else reject(new Error(r.error))
    }
    worker.onerror = (e) => { worker.terminate(); reject(new Error(e.message || 'worker failed')) }
    worker.postMessage({ image, quad })
  })
}

async function onMainThread(image: RGBAImage, quad: Quad): Promise<ScannedPage> {
  await new Promise(r => setTimeout(r, 30)) // let "Straightening…" paint first
  const flat = straightenAndWhiten(image, quad)
  const canvas = document.createElement('canvas')
  canvas.width = flat.width; canvas.height = flat.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas unavailable')
  ctx.putImageData(new ImageData(flat.data, flat.width, flat.height), 0, 0)
  const jpeg = await new Promise<Blob>((res, rej) =>
    canvas.toBlob(b => (b ? res(b) : rej(new Error('encode failed'))), 'image/jpeg', 0.85))
  return { jpeg, width: flat.width, height: flat.height, url: URL.createObjectURL(jpeg) }
}

export async function processPage(image: RGBAImage, quad: Quad): Promise<ScannedPage> {
  if (typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined') {
    try { return await inWorker(image, quad) } catch { /* fall through to the main thread */ }
  }
  return onMainThread(image, quad)
}
