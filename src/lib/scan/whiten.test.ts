/**
 * Standalone test for whiten. Synthetic page 480x640 → cells of 10px.
 * Run: npx tsx src/lib/scan/whiten.test.ts
 * Exits 1 on any failure.
 */
import { whiten } from './whiten'
import { straightenAndWhiten } from './pipeline'
import type { RGBAImage } from './image'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`); failures++ }
}

const W = 480, H = 640
function page(): RGBAImage {
  const data = new Uint8ClampedArray(W * H * 4)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4
    let v = 210                                           // greyish paper as a phone sees it
    if (x >= 200 && x < 260 && y >= 300 && y < 315) v = 110 // grey bar: 6 cells wide, 1.5 cells tall
    if (y === 100 && x > 50 && x < 400) v = 20              // a line of "text"
    const shade = x < 192 ? 0.6 : 1                         // hard phone shadow over the left 40%
    data[i] = data[i + 1] = data[i + 2] = v * shade
    if (x >= 400 && x < 420 && y >= 500 && y < 520) { data[i] = 40; data[i + 1] = 60; data[i + 2] = 200 } // blue stamp
    data[i + 3] = 255
  }
  return { data, width: W, height: H }
}
const lum = (img: RGBAImage, x: number, y: number) => {
  const i = (y * img.width + x) * 4
  return Math.round((img.data[i] + img.data[i + 1] + img.data[i + 2]) / 3)
}

const out = whiten(page())
check('paper in the light is white (≥245)', lum(out, 300, 50) >= 245, true)
check('paper deep in the shadow is white (≥240)', lum(out, 80, 400) >= 240, true)
check('text stays dark (<80)', lum(out, 300, 100) < 80, true)
check('grey bar is NOT hollowed out (centre < 170)', lum(out, 230, 307) < 170, true)
const s = (510 * W + 410) * 4
check('blue stamp keeps its colour (blue > red + 60)', out.data[s + 2] > out.data[s] + 60, true)

let threw = false
try { whiten({ data: new Uint8ClampedArray(W * H * 3), width: W, height: H }) } catch { threw = true }
check('refuses a 3-channel buffer (spike bug)', threw, true)

const flat = straightenAndWhiten(page(), [[0, 0], [W, 0], [W, H], [0, H]])
check('pipeline gives A4 portrait', [flat.width, flat.height], [2480, 3508])
const wide = straightenAndWhiten(page(), [[0, 0], [W, 0], [W, 300], [0, 300]])
check('pipeline gives A4 landscape for a wide quad', [wide.width, wide.height], [3508, 2480])

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nall passed')
