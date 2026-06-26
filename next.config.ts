import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'shop.bitmain.com' },
      { protocol: 'https', hostname: 'www.microbt.com' },
      { protocol: 'https', hostname: 'upload.wikimedia.org' },
    ],
  },
  async redirects() {
    return [
      {
        source: '/hosts/abundant-mines',
        destination: '/hosts/abundant-miners',
        permanent: true,
      },
    ]
  },
}

export default nextConfig
