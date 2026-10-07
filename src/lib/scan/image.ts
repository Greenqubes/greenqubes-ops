// Plain RGBA pixels, the shape canvas ImageData uses. Pure — runs in the
// browser, a worker, or a test.

// ArrayBuffer-backed so it can go straight into ImageData (TS 5.7+ typing)
export interface RGBAImage { data: Uint8ClampedArray<ArrayBuffer>; width: number; height: number }

/** The spike's second whitening bug (2026-09-30) was a buffer silently
 *  carrying 3 channels where 1 was expected — every read used the wrong
 *  stride and the result looked plausible. Check the length, always. */
export function assertImage(img: RGBAImage): void {
  if (img.data.length !== img.width * img.height * 4) {
    throw new Error(`image buffer is ${img.data.length} bytes, expected ${img.width * img.height * 4}`)
  }
}

/** Area-average downscale to at most `maxWidth` wide. `scale` = source pixels
 *  per output pixel, so a point found on the small copy maps back by × scale. */
export function downscale(img: RGBAImage, maxWidth: number): { image: RGBAImage; scale: number } {
  assertImage(img)
  if (img.width <= maxWidth) return { image: img, scale: 1 }
  const scale = img.width / maxWidth
  const W = maxWidth, H = Math.max(1, Math.round(img.height / scale))
  const out = new Uint8ClampedArray(W * H * 4)
  for (let y = 0; y < H; y++) {
    const y0 = Math.floor(y * scale), y1 = Math.min(img.height, Math.max(y0 + 1, Math.floor((y + 1) * scale)))
    for (let x = 0; x < W; x++) {
      const x0 = Math.floor(x * scale), x1 = Math.min(img.width, Math.max(x0 + 1, Math.floor((x + 1) * scale)))
      let r = 0, g = 0, b = 0, n = 0
      for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) {
        const i = (yy * img.width + xx) * 4
        r += img.data[i]; g += img.data[i + 1]; b += img.data[i + 2]; n++
      }
      const o = (y * W + x) * 4
      out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = 255
    }
  }
  return { image: { data: out, width: W, height: H }, scale }
}
