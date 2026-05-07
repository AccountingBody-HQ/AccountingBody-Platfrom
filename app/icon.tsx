import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: 32, height: 32, display: 'flex' }}>
        <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
          <circle cx="16" cy="16" r="16" fill="#ffffff"/>
          <rect x="6" y="6" width="8" height="20" rx="2" fill="#1e3a7a"/>
          <rect x="18" y="6" width="8" height="9" rx="2" fill="#1e3a7a"/>
          <rect x="18" y="17" width="8" height="9" rx="2" fill="#1e3a7a"/>
        </svg>
      </div>
    ),
    { ...size }
  )
}
