import { ImageResponse } from 'next/og'

// Terminal app icon (home-screen): white lightning striking a utility pole.
// Scoped to /admin/dashboard so the public site keeps its own icon.

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
        <svg width="180" height="180" viewBox="0 0 180 180" fill="none">
          {/* ground */}
          <rect x="30" y="156" width="120" height="6" rx="3" fill="#374151" />
          {/* utility pole + crossarms */}
          <rect x="86" y="66" width="10" height="92" rx="2" fill="#7c5a3a" />
          <rect x="58" y="76" width="66" height="8" rx="2" fill="#7c5a3a" />
          <rect x="66" y="92" width="50" height="7" rx="2" fill="#7c5a3a" />
          {/* insulators on the crossarm */}
          <rect x="62" y="70" width="6" height="8" rx="2" fill="#9ca3af" />
          <rect x="114" y="70" width="6" height="8" rx="2" fill="#9ca3af" />
          {/* white lightning bolt striking the pole top */}
          <path d="M118 6 L84 40 L100 44 L74 66 L90 68 L80 84 L96 66 L84 62 L108 40 L94 36 Z" fill="#ffffff" />
          {/* impact flash at the strike point */}
          <path d="M80 84 L70 78 M80 84 L72 90 M80 84 L88 92 M80 84 L90 80" stroke="#fbbf24" strokeWidth="4" strokeLinecap="round" />
          <circle cx="80" cy="84" r="5" fill="#fde68a" />
        </svg>
      </div>
    ),
    { ...size }
  )
}
