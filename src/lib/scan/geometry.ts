// Corner maths for the document scanner. Pure.

export type Point = [number, number]
/** Always TL, TR, BR, BL. */
export type Quad = [Point, Point, Point, Point]

export const A4_PORTRAIT = { width: 2480, height: 3508 } // 300 dpi

/** Sorts any four points into TL, TR, BR, BL — so a dot dragged past its
 *  neighbour still yields an upright page. Sorted clockwise by angle around
 *  their centre, then started at the top-left-most point: every point is
 *  used exactly once. (Picking x+y / x−y extremes independently, the first
 *  version, could give one point two corners and drop the fourth — found in
 *  the final review: a page at 45°, or a dot dragged just past another.) */
export function orderCorners(pts: Point[]): Quad {
  if (pts.length !== 4) throw new Error('need 4 points')
  const cx = (pts[0][0] + pts[1][0] + pts[2][0] + pts[3][0]) / 4
  const cy = (pts[0][1] + pts[1][1] + pts[2][1] + pts[3][1]) / 4
  const ring = [...pts].sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx))
  let start = 0
  for (let i = 1; i < 4; i++) {
    const s = ring[i][0] + ring[i][1], best = ring[start][0] + ring[start][1]
    if (s < best || (s === best && ring[i][0] < ring[start][0])) start = i
  }
  const q = [0, 1, 2, 3].map(k => ring[(start + k) % 4])
  return q.map(p => [p[0], p[1]]) as Quad
}

function solve(A: number[][], b: number[]): number[] {
  const n = b.length
  for (let i = 0; i < n; i++) {
    let m = i
    for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[m][i])) m = r
    ;[A[i], A[m]] = [A[m], A[i]]; [b[i], b[m]] = [b[m], b[i]]
    if (Math.abs(A[i][i]) < 1e-12) throw new Error('degenerate quad')
    for (let r = 0; r < n; r++) {
      if (r === i) continue
      const f = A[r][i] / A[i][i]
      for (let c = i; c < n; c++) A[r][c] -= f * A[i][c]
      b[r] -= f * b[i]
    }
  }
  return b.map((v, i) => v / A[i][i])
}

/** 8 coefficients h such that `applyHomography(h, from[i])` = `to[i]`. */
export function solveHomography(from: Quad, to: Quad): number[] {
  const A: number[][] = [], b: number[] = []
  for (let i = 0; i < 4; i++) {
    const [x, y] = from[i], [u, v] = to[i]
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u)
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v)
  }
  return solve(A, b)
}

export function applyHomography(h: number[], x: number, y: number): Point {
  const d = h[6] * x + h[7] * y + 1
  return [(h[0] * x + h[1] * y + h[2]) / d, (h[3] * x + h[4] * y + h[5]) / d]
}

const dist = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1])

/** A4 portrait unless the paper is wider than tall. */
export function outputSize(quad: Quad): { width: number; height: number } {
  const w = (dist(quad[0], quad[1]) + dist(quad[3], quad[2])) / 2
  const h = (dist(quad[0], quad[3]) + dist(quad[1], quad[2])) / 2
  return w > h ? { width: A4_PORTRAIT.height, height: A4_PORTRAIT.width } : { ...A4_PORTRAIT }
}

/** Starting dots when no paper is found. */
export function insetQuad(width: number, height: number, frac = 0.05): Quad {
  const dx = width * frac, dy = height * frac
  return [[dx, dy], [width - dx, dy], [width - dx, height - dy], [dx, height - dy]]
}
