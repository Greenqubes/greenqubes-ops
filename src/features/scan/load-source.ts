'use client'
// Photo → pixels the scanner can work on. EXIF rotation is applied by the
// browser ('from-image'), and the long edge is capped so a 24-megapixel phone
// photo doesn't exhaust a cheap Android's memory.

import type { RGBAImage } from '@/lib/scan/image'

export async function loadSource(blob: Blob, maxEdge = 3000): Promise<{ image: RGBAImage; url: string }> {
  const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' })
  try {
    const k = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height))
    const w = Math.round(bmp.width * k), h = Math.round(bmp.height * k)
    const canvas = document.createElement('canvas')
    canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('canvas unavailable')
    ctx.drawImage(bmp, 0, 0, w, h)
    const { data } = ctx.getImageData(0, 0, w, h)
    const jpeg = await new Promise<Blob>((res, rej) =>
      canvas.toBlob(b => (b ? res(b) : rej(new Error('encode failed'))), 'image/jpeg', 0.85))
    return { image: { data, width: w, height: h }, url: URL.createObjectURL(jpeg) }
  } finally {
    bmp.close()
  }
}

/** A photo already on the job. Storage allows browser GET from production,
 *  previews and localhost (checked 2026-10-05). */
export async function fetchJobFileBlob(r2Key: string, name: string | null): Promise<Blob> {
  const res = await fetch('/api/r2/download-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: r2Key, filename: name ?? undefined }),
  })
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: '' })) as { error?: string }
    throw new Error(error || `${res.status}`)
  }
  const { url } = await res.json() as { url: string }
  const file = await fetch(url)
  if (!file.ok) throw new Error(`storage ${file.status}`)
  return file.blob()
}
