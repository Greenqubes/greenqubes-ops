'use client'
// Four draggable dots over the photo, mouse and finger alike (pointer events).
// While dragging, a magnifier above the finger shows exactly where the dot is —
// the finger otherwise covers the very corner being placed.
//
// The dots are HTML, not SVG circles (final review): a fixed 44px finger
// target whatever the photo's size, and not clipped when a dot sits on the
// photo's edge — which is exactly where the detector leaves pages it refuses.

import { useRef, useState } from 'react'
import type { Point, Quad } from '@/lib/scan/geometry'

interface Props { imageUrl: string; width: number; height: number; quad: Quad; onChange: (q: Quad) => void }

const MAG = 112   // magnifier diameter, css px
const ZOOM = 2.5
const HIT = 44    // dot touch target, css px

export function CornerEditor({ imageUrl, width, height, quad, onChange }: Props) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<{ i: number; pointerId: number; screen: Point; rect: DOMRect } | null>(null)

  const toImage = (clientX: number, clientY: number, r: DOMRect): Point => {
    const x = ((clientX - r.left) / r.width) * width
    const y = ((clientY - r.top) / r.height) * height
    return [Math.max(0, Math.min(width, x)), Math.max(0, Math.min(height, y))]
  }

  const onDown = (i: number) => (e: React.PointerEvent) => {
    if (!boxRef.current || drag) return // one finger, one dot
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    setDrag({ i, pointerId: e.pointerId, screen: [e.clientX, e.clientY], rect: boxRef.current.getBoundingClientRect() })
  }
  const onMove = (e: React.PointerEvent) => {
    if (!drag || e.pointerId !== drag.pointerId) return
    const next = quad.map(p => [p[0], p[1]]) as Quad
    next[drag.i] = toImage(e.clientX, e.clientY, drag.rect)
    onChange(next)
    setDrag({ ...drag, screen: [e.clientX, e.clientY] })
  }
  const onUp = (e: React.PointerEvent) => { if (drag && e.pointerId === drag.pointerId) setDrag(null) }

  const pts = quad.map(p => p.join(',')).join(' ')
  const line = Math.max(width, height) * 0.006

  return (
    <div className="relative mx-auto touch-none select-none"
      style={{ aspectRatio: `${width} / ${height}`, height: `min(68dvh, calc((100vw - 2rem) * ${height / width}))` }}>
      <div ref={boxRef} className="absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="" draggable={false} className="w-full h-full rounded-lg" />
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none">
          <polygon points={pts} fill="rgba(145,199,64,0.15)" stroke="#91C740" strokeWidth={line} />
        </svg>
        {quad.map(([x, y], i) => (
          <div key={i} role="slider" aria-label={`corner ${i + 1}`} aria-valuenow={Math.round(x)}
            className="absolute flex items-center justify-center cursor-grab"
            style={{ width: HIT, height: HIT, left: `${(x / width) * 100}%`, top: `${(y / height) * 100}%`, transform: 'translate(-50%, -50%)' }}
            onPointerDown={onDown(i)} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
            <span className="block w-5 h-5 rounded-full border-[3px] border-terracotta bg-white/85 shadow" />
          </div>
        ))}
      </div>
      {drag && (
        <div className="fixed pointer-events-none rounded-full border-2 border-white shadow-lg overflow-hidden"
          style={{
            width: MAG, height: MAG,
            left: drag.screen[0] - MAG / 2,
            top: Math.max(8, drag.screen[1] - MAG - 40),
            backgroundImage: `url(${imageUrl})`,
            backgroundRepeat: 'no-repeat',
            backgroundSize: `${drag.rect.width * ZOOM}px ${drag.rect.height * ZOOM}px`,
            backgroundPosition: `${-((drag.screen[0] - drag.rect.left) * ZOOM - MAG / 2)}px ${-((drag.screen[1] - drag.rect.top) * ZOOM - MAG / 2)}px`,
          }}>
          <div className="absolute left-1/2 top-1/2 w-3 h-3 -ml-1.5 -mt-1.5 rounded-full border-2 border-brand-lime" />
        </div>
      )}
    </div>
  )
}
