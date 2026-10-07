/**
 * Standalone test for warp.
 * Run: npx tsx src/lib/scan/warp.test.ts
 * Exits 1 on any failure.
 */
import { warp } from './warp'
import type { RGBAImage } from './image'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`); failures++ }
}

// left half red, right half blue
function halves(w: number, h: number): RGBAImage {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4
    data[i] = x < w / 2 ? 255 : 0; data[i + 2] = x < w / 2 ? 0 : 255; data[i + 3] = 255
  }
  return { data, width: w, height: h }
}
const px = (img: RGBAImage, x: number, y: number) =>
  Array.from(img.data.slice((y * img.width + x) * 4, (y * img.width + x) * 4 + 3))

const out = warp(halves(100, 100), [[10, 10], [90, 10], [90, 90], [10, 90]], 80, 80)
check('output size', [out.width, out.height, out.data.length], [80, 80, 80 * 80 * 4])
check('left of output is red', px(out, 20, 40), [255, 0, 0])
check('right of output is blue', px(out, 60, 40), [0, 0, 255])

// Review focus: a small WhatsApp-sized source still fills a big output
const up = warp(halves(40, 40), [[0, 0], [40, 0], [40, 40], [0, 40]], 400, 400)
check('upsamples a small source: left red', px(up, 50, 200), [255, 0, 0])
check('upsamples a small source: right blue', px(up, 350, 200), [0, 0, 255])

// a quad reaching outside the source → white, not garbage
const outside = warp(halves(100, 100), [[-50, -50], [150, -50], [150, 150], [-50, 150]], 100, 100)
check('outside the source is white', px(outside, 1, 1), [255, 255, 255])

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nall passed')
