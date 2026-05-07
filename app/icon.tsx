import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: 32, height: 32, background: '#ffffff', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="22" height="22" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
          <rect x="0" y="0" width="9" height="20" rx="2" fill="#1e3a7a"/>
          <rect x="11" y="0" width="9" height="9" rx="2" fill="#1e3a7a"/>
          <rect x="11" y="11" width="9" height="9" rx="2" fill="#1e3a7a"/>
        </svg>
      </div>
    ),
    { ...size }
  )
}
