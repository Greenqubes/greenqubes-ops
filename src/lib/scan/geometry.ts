// Corner maths for the document scanner. Pure.

export type Point = [number, number]
/** Always TL, TR, BR, BL. */
export type Quad = [Point, Point, Point, Point]

export const A4_PORTRAIT = { width: 2480, height: 3508 } // 300 dpi

/** Sorts any four points into TL, TR, BR, BL by x+y / x−y extremes — so a
 *  dot dragged past its neighbour still yields an upright page. */
export function orderCorners(pts: Point[]): Quad {
  if (pts.length !== 4) throw new Error('need 4 points')
  const by = (f: (p: Point) => number, max: boolean) =>
    pts.reduce((a, b) => (max ? f(b) > f(a) : f(b) < f(a)) ? b : a)
  const tl = by(p => p[0] + p[1], false)
  const br = by(p => p[0] + p[1], true)
  const tr = by(p => p[0] - p[1], true)
  const bl = by(p => p[0] - p[1], false)
  return [[tl[0], tl[1]], [tr[0], tr[1]], [br[0], br[1]], [bl[0], bl[1]]]
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
