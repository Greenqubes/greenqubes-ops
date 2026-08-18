import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: '#91C740',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#1A1815',
          fontSize: 18,
          fontWeight: 700,
          fontFamily: 'serif',
        }}
      >
        G
      </div>
    ),
    { ...size },
  )
}
