// First guess at where the paper is. A head start, not a promise: on the
// 2026-09-30 real-photo set it found 5 of 9; paper lying on other paper or
// touching something white defeats it. The corner editor always lets people
// fix it, so a confident wrong answer is worse than `null` — hence the
// rejection rules at the end. Pure.

import { downscale, type RGBAImage } from './image'
import { orderCorners, type Point, type Quad } from './geometry'

const WORK_WIDTH = 400
const ERODE = 3

function otsu(L: Float32Array): number {
  const hist = new Array<number>(256).fill(0)
  for (const v of L) hist[v | 0]++
  const n = L.length
  let sum = 0
  for (let i = 0; i < 256; i++) sum += i * hist[i]
  let sB = 0, wB = 0, best = 0, th = 128
  for (let t = 0; t < 256; t++) {
    wB += hist[t]; if (!wB) continue
    const wF = n - wB; if (!wF) break
    sB += t * hist[t]
    const mB = sB / wB, mF = (sum - sB) / wF, v = wB * wF * (mB - mF) ** 2
    if (v > best) { best = v; th = t }
  }
  return th
}

export function detectCorners(img: RGBAImage): Quad | null {
  const { image: small, scale } = downscale(img, WORK_WIDTH)
  const W = small.width, H = small.height, n = W * H, d = small.data

  // paper = brighter than the photo's own threshold, and not coloured
  const L = new Float32Array(n), S = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2]
    L[i] = (r + g + b) / 3; S[i] = Math.max(r, g, b) - Math.min(r, g, b)
  }
  const th = otsu(L)
  const mask = new Uint8Array(n)
  for (let i = 0; i < n; i++) mask[i] = L[i] > th && S[i] < 40 ? 1 : 0

  // erode — cuts thin bridges to neighbouring white things
  const er = new Uint8Array(n)
  for (let y = ERODE; y < H - ERODE; y++) for (let x = ERODE; x < W - ERODE; x++) {
    let ok = 1
    for (let k = -ERODE; k <= ERODE && ok; k++) if (!mask[(y + k) * W + x] || !mask[y * W + x + k]) ok = 0
    er[y * W + x] = ok
  }

  // the biggest blob near the middle of the photo
  const lab = new Int32Array(n)
  let id = 0, bestId = 0, bestScore = 0, bestArea = 0
  for (let i = 0; i < n; i++) {
    if (!er[i] || lab[i]) continue
    id++
    const stack = [i]; lab[i] = id
    let c = 0, sx = 0, sy = 0
    while (stack.length) {
      const p = stack.pop()!
      c++; sx += p % W; sy += (p / W) | 0
      const px = p % W
      for (const q of [px > 0 ? p - 1 : -1, px < W - 1 ? p + 1 : -1, p - W, p + W]) {
        if (q >= 0 && q < n && er[q] && !lab[q]) { lab[q] = id; stack.push(q) }
      }
    }
    const dx = sx / c / W - 0.5, dy = sy / c / H - 0.5
    const score = c * (1 - Math.min(0.9, Math.hypot(dx, dy)))
    if (score > bestScore) { bestScore = score; bestId = id; bestArea = c }
  }
  if (!bestId) return null

  // corners = extremes of x+y and x−y, pushed back out by the erosion
  let tl: Point = [0, 0], tr: Point = [0, 0], br: Point = [0, 0], bl: Point = [0, 0]
  let a = Infinity, b = -Infinity, c2 = -Infinity, e = Infinity, cx = 0, cy = 0
  for (let i = 0; i < n; i++) {
    if (lab[i] !== bestId) continue
    const x = i % W, y = (i / W) | 0
    cx += x; cy += y
    if (x + y < a) { a = x + y; tl = [x, y] }
    if (x + y > b) { b = x + y; br = [x, y] }
    if (x - y > c2) { c2 = x - y; tr = [x, y] }
    if (x - y < e) { e = x - y; bl = [x, y] }
  }
  cx /= bestArea; cy /= bestArea
  const grow = ERODE * Math.SQRT2
  const push = ([x, y]: Point): Point => {
    const len = Math.hypot(x - cx, y - cy) || 1
    return [x + ((x - cx) / len) * grow, y + ((y - cy) / len) * grow]
  }
  const q = orderCorners([tl, tr, br, bl].map(push))

  // reject shapes that are not a page
  const dist = (p: Point, r: Point) => Math.hypot(p[0] - r[0], p[1] - r[1])
  const area = Math.abs(q.reduce((s, p, i) => { const r = q[(i + 1) % 4]; return s + p[0] * r[1] - r[0] * p[1] }, 0)) / 2
  const side1 = (dist(q[0], q[1]) + dist(q[3], q[2])) / 2, side2 = (dist(q[0], q[3]) + dist(q[1], q[2])) / 2
  const aspect = Math.max(side1, side2) / Math.max(1, Math.min(side1, side2))
  const m = Math.max(2, W * 0.01)
  const onEdge = q.some(([x, y]) => x < m || y < m || x > W - 1 - m || y > H - 1 - m)
  if (area < n * 0.12 || aspect < 1.15 || aspect > 1.75 || onEdge) return null

  return q.map(([x, y]) => [x * scale, y * scale]) as Quad
}
