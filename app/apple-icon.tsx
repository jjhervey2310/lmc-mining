import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0a0a',
        }}
      >
        <svg width="80" height="107" viewBox="0 0 24 32" fill="none">
          <path d="M14 1L2 18H11L9 31L23 12H13L14 1Z" fill="#f59e0b" />
        </svg>
      </div>
    ),
    { ...size }
  )
}
