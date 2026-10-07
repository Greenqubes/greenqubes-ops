// Make a photographed page look scanned: white paper, no shadows, colour kept.
// Pure. Proven on the Mustafa DO in the 2026-09-30 spike, where two simpler
// versions failed: a fine blur-based estimate hollowed out the logo and the
// grey table header, and a channel-count slip made the whole step a no-op.

import { assertImage, type RGBAImage } from './image'

const CELLS_ACROSS = 48
const LO = 30, HI = 235
/** Median window radius in cells: 3 → 7x7, so a dark area up to 3 cells
 *  (~13 mm on A4) thick, or 4x4 cells square, keeps its colour. A shadow must
 *  be larger than that to be removed — phone shadows are. */
const MEDIAN_R = 3

export function whiten(img: RGBAImage): RGBAImage {
  assertImage(img)
  const { width: W, height: H, data } = img
  const cell = Math.max(4, Math.ceil(W / CELLS_ACROSS))
  const GX = Math.ceil(W / cell), GY = Math.ceil(H / cell)

  // 1. paper brightness per cell = the level only the brightest 5% exceed,
  //    so ink in the cell cannot drag the estimate down
  const grid = new Float32Array(GX * GY)
  const hist = new Uint32Array(256)
  for (let gy = 0; gy < GY; gy++) for (let gx = 0; gx < GX; gx++) {
    hist.fill(0); let n = 0
    const yEnd = Math.min(H, (gy + 1) * cell), xEnd = Math.min(W, (gx + 1) * cell)
    for (let y = gy * cell; y < yEnd; y += 2) for (let x = gx * cell; x < xEnd; x += 2) {
      const i = (y * W + x) * 4
      hist[Math.round((data[i] + data[i + 1] + data[i + 2]) / 3)]++; n++
    }
    let acc = 0, v = 255
    for (; v > 0; v--) { acc += hist[v]; if (acc >= n * 0.05) break }
    grid[gy * GX + gx] = Math.max(v, 60)
  }

  // 2. 7x7 median across cells — a logo, header bar or shaded panel loses
  //    the vote instead of being whitened away (3x3 kept only areas ~1 cell
  //    thick; found in the final review). Median keeps hard shadow edges sharp.
  const med = new Float32Array(GX * GY)
  const win: number[] = []
  for (let gy = 0; gy < GY; gy++) for (let gx = 0; gx < GX; gx++) {
    win.length = 0
    for (let dy = -MEDIAN_R; dy <= MEDIAN_R; dy++) for (let dx = -MEDIAN_R; dx <= MEDIAN_R; dx++) {
      const x = Math.min(GX - 1, Math.max(0, gx + dx)), y = Math.min(GY - 1, Math.max(0, gy + dy))
      win.push(grid[y * GX + x])
    }
    win.sort((a, b) => a - b)
    med[gy * GX + gx] = win[win.length >> 1]
  }

  // 3. divide by the paper estimate (bilinear between cell centres), then
  //    stretch the levels; each channel uses the same divisor, so colour stays
  const out = new Uint8ClampedArray(data.length)
  const scale = 255 / (HI - LO)
  for (let y = 0; y < H; y++) {
    const fy = Math.min(GY - 1, Math.max(0, (y + 0.5) / cell - 0.5))
    const y0 = Math.floor(fy), y1 = Math.min(GY - 1, y0 + 1), ty = fy - y0
    for (let x = 0; x < W; x++) {
      const fx = Math.min(GX - 1, Math.max(0, (x + 0.5) / cell - 0.5))
      const x0 = Math.floor(fx), x1 = Math.min(GX - 1, x0 + 1), tx = fx - x0
      const bg = (med[y0 * GX + x0] * (1 - tx) + med[y0 * GX + x1] * tx) * (1 - ty)
               + (med[y1 * GX + x0] * (1 - tx) + med[y1 * GX + x1] * tx) * ty
      const i = (y * W + x) * 4
      for (let c = 0; c < 3; c++) out[i + c] = ((data[i + c] / bg) * 255 - LO) * scale
      out[i + 3] = 255
    }
  }
  return { data: out, width: W, height: H }
}
