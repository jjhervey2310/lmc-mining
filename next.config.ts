import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'assets-www.bitmain.com.cn' },
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
