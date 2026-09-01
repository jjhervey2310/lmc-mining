import { NextResponse } from 'next/server'

// Web-app manifest for installing the terminal as a phone app. Served
// dynamically so start_url can carry the admin secret WITHOUT the secret ever
// living in a public static file — the manifest itself requires the secret.

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get('secret') || ''
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  return NextResponse.json(
    {
      name: "Jacob's Dashboard",
      short_name: 'Dashboard',
      description: "Lightning Mines mission control — Jacob's private terminal",
      start_url: `/admin/dashboard?secret=${secret}`,
      scope: '/admin/',
      display: 'standalone',
      orientation: 'portrait',
      background_color: '#f1f5f9',
      theme_color: '#0a0a0a',
      icons: [
        { src: '/admin/dashboard/apple-icon.png', sizes: '180x180', type: 'image/png' },
        { src: '/terminal-icon.png', sizes: '1024x1024', type: 'image/png' },
      ],
    },
    { headers: { 'Content-Type': 'application/manifest+json' } },
  )
}
