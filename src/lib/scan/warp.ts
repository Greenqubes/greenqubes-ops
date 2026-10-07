// Straighten: every output pixel looks up where it came from in the photo
// (inverse homography) and blends the four nearest source pixels. Pure.

import { assertImage, type RGBAImage } from './image'
import { solveHomography, type Quad } from './geometry'

export function warp(src: RGBAImage, quad: Quad, width: number, height: number): RGBAImage {
  assertImage(src)
  const h = solveHomography([[0, 0], [width, 0], [width, height], [0, height]], quad)
  const out = new Uint8ClampedArray(width * height * 4)
  const sw = src.width, sh = src.height, s = src.data
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const cx = x + 0.5, cy = y + 0.5
      const d = h[6] * cx + h[7] * cy + 1
      const u = (h[0] * cx + h[1] * cy + h[2]) / d - 0.5
      const v = (h[3] * cx + h[4] * cy + h[5]) / d - 0.5
      const o = (y * width + x) * 4
      out[o + 3] = 255
      if (u < -0.5 || v < -0.5 || u > sw - 0.5 || v > sh - 0.5) {
        out[o] = out[o + 1] = out[o + 2] = 255
        continue
      }
      const x0 = Math.max(0, Math.min(sw - 1, Math.floor(u))), y0 = Math.max(0, Math.min(sh - 1, Math.floor(v)))
      const x1 = Math.min(sw - 1, x0 + 1), y1 = Math.min(sh - 1, y0 + 1)
      const fx = Math.max(0, Math.min(1, u - x0)), fy = Math.max(0, Math.min(1, v - y0))
      const i00 = (y0 * sw + x0) * 4, i10 = (y0 * sw + x1) * 4, i01 = (y1 * sw + x0) * 4, i11 = (y1 * sw + x1) * 4
      for (let c = 0; c < 3; c++) {
        out[o + c] = (s[i00 + c] * (1 - fx) + s[i10 + c] * fx) * (1 - fy) + (s[i01 + c] * (1 - fx) + s[i11 + c] * fx) * fy
      }
    }
  }
  return { data: out, width, height }
}
