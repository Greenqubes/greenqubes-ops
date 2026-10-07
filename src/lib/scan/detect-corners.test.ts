/**
 * Standalone test for corner detection on synthetic photos.
 * Run: npx tsx src/lib/scan/detect-corners.test.ts
 * Exits 1 on any failure.
 */
import { detectCorners } from './detect-corners'
import type { RGBAImage } from './image'
import type { Quad, Point } from './geometry'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`); failures++ }
}

const inside = (q: Quad, x: number, y: number) => {
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = q[i], [bx, by] = q[(i + 1) % 4]
    if ((bx - ax) * (y - ay) - (by - ay) * (x - ax) < 0) return false
  }
  return true
}
function photo(w: number, h: number, bg: number, paper: Quad | null, paperVal = 235): RGBAImage {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4
    const v = paper && inside(paper, x, y) ? paperVal : bg
    data[i] = data[i + 1] = data[i + 2] = v; data[i + 3] = 255
  }
  return { data, width: w, height: h }
}
const close = (a: Point, b: Point, tol: number) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= tol

// paper on a dark floor, slightly rotated, in an 800px-wide photo (tests the scale-back too)
const truth: Quad = [[120, 100], [680, 140], [660, 960], [100, 940]]
const found = detectCorners(photo(800, 1066, 50, truth))
check('finds paper on a dark background', found !== null, true)
if (found) check('every corner within 12px (800px photo)', found.every((p, i) => close(p, truth[i], 12)), true)

check('plain white photo → null', detectCorners(photo(400, 533, 240, null)), null)
check('tiny paper (5% of the photo) → null', detectCorners(photo(400, 533, 50, [[180, 240], [220, 240], [220, 300], [180, 300]])), null)
check('paper running off the edge → null', detectCorners(photo(400, 533, 50, [[0, 50], [300, 50], [300, 500], [0, 500]])), null)

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nall passed')
