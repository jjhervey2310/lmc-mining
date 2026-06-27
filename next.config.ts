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
      { protocol: 'https', hostname: 'aws-microbt-com-bucket.s3.us-west-2.amazonaws.com' },
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
