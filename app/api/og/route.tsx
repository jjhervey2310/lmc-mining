import { ImageResponse } from 'next/og'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const title = searchParams.get('title') || 'LMC Mining Intelligence'
  const subtitle = searchParams.get('sub') || 'Independent Bitcoin Mining Data'

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          background: '#0a0a0a',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Gold radial glow */}
        <div
          style={{
            position: 'absolute',
            top: '-100px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '800px',
            height: '500px',
            background: 'radial-gradient(ellipse at center, rgba(245,158,11,0.15) 0%, transparent 70%)',
          }}
        />

        {/* Lightning bolt icon */}
        <div style={{ fontSize: '64px', marginBottom: '24px' }}>⚡</div>

        {/* Site name */}
        <div
          style={{
            fontSize: '28px',
            fontWeight: 700,
            color: '#f59e0b',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            marginBottom: '20px',
          }}
        >
          LMC Mining Intelligence
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: title.length > 50 ? '38px' : '48px',
            fontWeight: 900,
            color: '#ffffff',
            textAlign: 'center',
            maxWidth: '900px',
            lineHeight: 1.15,
            letterSpacing: '-0.02em',
            marginBottom: '20px',
            padding: '0 40px',
          }}
        >
          {title}
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: '22px',
            color: '#94a3b8',
            textAlign: 'center',
            maxWidth: '700px',
          }}
        >
          {subtitle}
        </div>

        {/* Bottom bar */}
        <div
          style={{
            position: 'absolute',
            bottom: '0',
            left: '0',
            right: '0',
            height: '4px',
            background: 'linear-gradient(90deg, transparent, #f59e0b, transparent)',
          }}
        />

        {/* Domain */}
        <div
          style={{
            position: 'absolute',
            bottom: '24px',
            right: '40px',
            fontSize: '16px',
            color: '#4b5563',
          }}
        >
          lmcmining.com
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}
