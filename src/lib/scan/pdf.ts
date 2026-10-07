// The smallest correct PDF for scanned pages: each page is one JPEG drawn
// full-bleed on A4. Written by hand so the scanner adds no dependency. Pure.

export interface PdfPage { jpeg: Uint8Array; widthPx: number; heightPx: number }

const A4_PT: [number, number] = [595.28, 841.89]

export function buildPdf(pages: PdfPage[]): Uint8Array<ArrayBuffer> {
  if (!pages.length) throw new Error('a PDF needs at least one page')
  const enc = new TextEncoder()
  const chunks: Uint8Array[] = []
  const offsets: number[] = []
  let length = 0
  const push = (part: string | Uint8Array) => {
    const u = typeof part === 'string' ? enc.encode(part) : part
    chunks.push(u); length += u.length
  }
  const obj = (n: number) => { offsets[n] = length; push(`${n} 0 obj\n`) }

  // the second line's high bytes tell tools the file is binary
  push('%PDF-1.4\n%âãÏÓ\n')
  const kids = pages.map((_, i) => `${3 + 3 * i} 0 R`).join(' ')
  obj(1); push('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n')
  obj(2); push(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>\nendobj\n`)

  pages.forEach((p, i) => {
    const [w, h] = p.widthPx > p.heightPx ? [A4_PT[1], A4_PT[0]] : A4_PT
    const pageN = 3 + 3 * i, contentN = pageN + 1, imageN = pageN + 2
    obj(pageN)
    push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im${i} ${imageN} 0 R >> >> /Contents ${contentN} 0 R >>\nendobj\n`)
    const draw = `q ${w} 0 0 ${h} 0 0 cm /Im${i} Do Q`
    obj(contentN)
    push(`<< /Length ${enc.encode(draw).length} >>\nstream\n${draw}\nendstream\nendobj\n`)
    obj(imageN)
    push(`<< /Type /XObject /Subtype /Image /Width ${p.widthPx} /Height ${p.heightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`)
    push(p.jpeg)
    push('\nendstream\nendobj\n')
  })

  const xrefAt = length
  const count = offsets.length // index 0 is the free entry
  push(`xref\n0 ${count}\n0000000000 65535 f \n`)
  for (let k = 1; k < count; k++) push(`${String(offsets[k]).padStart(10, '0')} 00000 n \n`)
  push(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`)

  const out = new Uint8Array(length)
  let at = 0
  for (const c of chunks) { out.set(c, at); at += c.length }
  return out
}
