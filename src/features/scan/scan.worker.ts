// Runs the per-page pixel work off the main thread — on a mid-range phone the
// ~9-megapixel loop would otherwise freeze the screen for seconds.

import { straightenAndWhiten } from '@/lib/scan/pipeline'
import type { RGBAImage } from '@/lib/scan/image'
import type { Quad } from '@/lib/scan/geometry'

type Req = { image: RGBAImage; quad: Quad }
type Res = { ok: true; jpeg: Blob; width: number; height: number } | { ok: false; error: string }

// The project's tsconfig carries the DOM lib, not WebWorker; narrow `self`
// instead of adding a conflicting lib reference.
const scope = self as unknown as { onmessage: ((e: MessageEvent<Req>) => void) | null; postMessage: (m: Res) => void }

scope.onmessage = async (e) => {
  try {
    const flat = straightenAndWhiten(e.data.image, e.data.quad)
    const canvas = new OffscreenCanvas(flat.width, flat.height)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('no 2d context in worker')
    ctx.putImageData(new ImageData(flat.data, flat.width, flat.height), 0, 0)
    const jpeg = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 })
    scope.postMessage({ ok: true, jpeg, width: flat.width, height: flat.height })
  } catch (err) {
    scope.postMessage({ ok: false, error: err instanceof Error ? err.message : String(err) })
  }
}
