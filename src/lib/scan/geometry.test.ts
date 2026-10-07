/**
 * Standalone test for scan geometry.
 * Run: npx tsx src/lib/scan/geometry.test.ts
 * Exits 1 on any failure.
 */
import { orderCorners, solveHomography, applyHomography, outputSize, insetQuad, type Quad } from './geometry'
import { downscale, assertImage } from './image'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`); failures++ }
}
const near = (p: [number, number], q: [number, number], tol = 0.01) =>
  Math.abs(p[0] - q[0]) <= tol && Math.abs(p[1] - q[1]) <= tol

// orderCorners — scrambled input comes back TL, TR, BR, BL
check('orders scrambled corners',
  orderCorners([[90, 95], [10, 12], [88, 8], [12, 90]]),
  [[10, 12], [88, 8], [90, 95], [12, 90]])
// Review focus: a user drags TL past TR — the quad must still be upright, not mirrored
check('reorders a crossed quad (TL dragged past TR)',
  orderCorners([[95, 10], [5, 10], [95, 90], [5, 90]]),
  [[5, 10], [95, 10], [95, 90], [5, 90]])

// solveHomography — maps each corner exactly, and the centre of a square to the centre
const sq: Quad = [[0, 0], [100, 0], [100, 100], [0, 100]]
const skew: Quad = [[10, 20], [110, 15], [120, 130], [5, 120]]
const h = solveHomography(sq, skew)
check('homography maps all four corners', sq.every((p, i) => near(applyHomography(h, p[0], p[1]), skew[i])), true)
const id = solveHomography(sq, sq)
check('identity maps the centre to itself', near(applyHomography(id, 50, 50), [50, 50]), true)

// outputSize — portrait and landscape A4
check('tall quad → A4 portrait', outputSize([[0, 0], [100, 0], [100, 141], [0, 141]]), { width: 2480, height: 3508 })
check('wide quad → A4 landscape', outputSize([[0, 0], [141, 0], [141, 100], [0, 100]]), { width: 3508, height: 2480 })

// insetQuad
check('inset 5% of 200x400', insetQuad(200, 400), [[10, 20], [190, 20], [190, 380], [10, 380]])

// image helpers
const img = { data: new Uint8ClampedArray(8 * 4 * 4).fill(200), width: 8, height: 4 }
const half = downscale(img, 4)
check('downscale halves an 8px-wide image to 4', [half.image.width, half.image.height, half.scale], [4, 2, 2])
check('downscale averages pixel values', half.image.data[0], 200)
check('downscale leaves a narrow image alone', downscale(img, 400).scale, 1)
let threw = false
try { assertImage({ data: new Uint8ClampedArray(10), width: 8, height: 4 }) } catch { threw = true }
check('assertImage rejects a wrong-length buffer', threw, true)

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nall passed')
