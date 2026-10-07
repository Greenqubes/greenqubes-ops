// One page: corners → straight, whitened A4. Shared by the worker and the
// main-thread fallback so both produce identical pages.

import type { RGBAImage } from './image'
import { orderCorners, outputSize, type Quad } from './geometry'
import { warp } from './warp'
import { whiten } from './whiten'

export function straightenAndWhiten(src: RGBAImage, quad: Quad): RGBAImage {
  const ordered = orderCorners(quad)
  const { width, height } = outputSize(ordered)
  return whiten(warp(src, ordered, width, height))
}
