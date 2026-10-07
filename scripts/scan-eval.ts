// Real-photo check for the DO scanner. Not shipped; never imported by the app.
// Run: npx tsx scripts/scan-eval.ts "<photo folder>" "<output folder>"
// Writes sheet.jpg (detected corners drawn on every photo), page-<name>.jpg for
// each photo, and all-pages.pdf. Photos stay outside the repo.
import sharp from 'sharp'
import { readdirSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { detectCorners } from '../src/lib/scan/detect-corners'
import { insetQuad } from '../src/lib/scan/geometry'
import { straightenAndWhiten } from '../src/lib/scan/pipeline'
import { buildPdf, type PdfPage } from '../src/lib/scan/pdf'

async function main() {
const [dir, out] = process.argv.slice(2)
if (!dir || !out) { console.error('usage: scan-eval <photos> <out>'); process.exit(1) }
mkdirSync(out, { recursive: true })

const tiles: Buffer[] = []
const pages: PdfPage[] = []
let found = 0
const files = readdirSync(dir).filter(f => /\.(jpe?g|png)$/i.test(f))
for (const f of files) {
  const { data, info } = await sharp(join(dir, f)).rotate()
    .resize({ width: 3000, height: 3000, fit: 'inside', withoutEnlargement: true })
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const img = { data: new Uint8ClampedArray(data), width: info.width, height: info.height }
  const q = detectCorners(img)
  if (q) found++
  const quad = q ?? insetQuad(img.width, img.height)
  const pts = quad.map(p => p.join(',')).join(' ')
  const svg = `<svg width="${img.width}" height="${img.height}"><polygon points="${pts}" fill="none" stroke="${q ? '#00c040' : '#ff0040'}" stroke-width="${img.width / 100}"/><text x="20" y="${img.width / 12}" font-size="${img.width / 14}" fill="#ff0040" font-family="Arial">${q ? '' : 'NOT FOUND '}${f.slice(0, 18)}</text></svg>`
  const drawn = await sharp(join(dir, f)).rotate().resize({ width: img.width }).composite([{ input: Buffer.from(svg) }]).png().toBuffer()
  tiles.push(await sharp(drawn).resize(400, 533, { fit: 'contain', background: '#222' }).png().toBuffer())

  const t0 = Date.now()
  const flat = straightenAndWhiten(img, quad)
  const jpeg = await sharp(Buffer.from(flat.data), { raw: { width: flat.width, height: flat.height, channels: 4 } })
    .removeAlpha().jpeg({ quality: 85 }).toBuffer()
  console.log(`${f}: ${q ? 'found' : 'NOT found'} · ${Date.now() - t0} ms · ${(jpeg.length / 1024).toFixed(0)} KB`)
  writeFileSync(join(out, `page-${f.replace(/\.\w+$/, '')}.jpg`), jpeg)
  pages.push({ jpeg: new Uint8Array(jpeg), widthPx: flat.width, heightPx: flat.height })
}
const cols = 3, rows = Math.ceil(tiles.length / cols)
await sharp({ create: { width: cols * 400, height: rows * 533, channels: 3, background: '#222' } })
  .composite(tiles.map((t, k) => ({ input: t, left: (k % cols) * 400, top: Math.floor(k / cols) * 533 })))
  .jpeg({ quality: 80 }).toFile(join(out, 'sheet.jpg'))
writeFileSync(join(out, 'all-pages.pdf'), buildPdf(pages))
console.log(`\nfound ${found} / ${files.length}`)
}

main().catch(err => { console.error(err); process.exit(1) })
