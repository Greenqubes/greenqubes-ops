'use client'
// Four draggable dots over the photo, mouse and finger alike (pointer events).
// While dragging, a magnifier above the finger shows exactly where the dot is —
// the finger otherwise covers the very corner being placed.

import { useRef, useState } from 'react'
import type { Point, Quad } from '@/lib/scan/geometry'

interface Props { imageUrl: string; width: number; height: number; quad: Quad; onChange: (q: Quad) => void }

const MAG = 112   // magnifier diameter, css px
const ZOOM = 2.5

export function CornerEditor({ imageUrl, width, height, quad, onChange }: Props) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<{ i: number; screen: Point; rect: DOMRect } | null>(null)

  const toImage = (clientX: number, clientY: number, r: DOMRect): Point => {
    const x = ((clientX - r.left) / r.width) * width
    const y = ((clientY - r.top) / r.height) * height
    return [Math.max(0, Math.min(width, x)), Math.max(0, Math.min(height, y))]
  }

  const onDown = (i: number) => (e: React.PointerEvent) => {
    if (!boxRef.current) return
    e.preventDefault()
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    setDrag({ i, screen: [e.clientX, e.clientY], rect: boxRef.current.getBoundingClientRect() })
  }
  const onMove = (e: React.PointerEvent) => {
    if (!drag) return
    const next = quad.map(p => [p[0], p[1]]) as Quad
    next[drag.i] = toImage(e.clientX, e.clientY, drag.rect)
    onChange(next)
    setDrag({ ...drag, screen: [e.clientX, e.clientY] })
  }
  const onUp = () => setDrag(null)

  const r = Math.max(width, height) * 0.022
  const pts = quad.map(p => p.join(',')).join(' ')

  return (
    <div className="relative mx-auto touch-none select-none"
      style={{ aspectRatio: `${width} / ${height}`, height: `min(68dvh, calc((100vw - 2rem) * ${height / width}))` }}>
      <div ref={boxRef} className="absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="" draggable={false} className="w-full h-full rounded-lg" />
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
          <polygon points={pts} fill="rgba(145,199,64,0.15)" stroke="#91C740" strokeWidth={r / 3} />
          {quad.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={r} fill="rgba(255,255,255,0.85)" stroke="#5A801F" strokeWidth={r / 4}
              className="cursor-grab"
              onPointerDown={onDown(i)} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />
          ))}
        </svg>
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
