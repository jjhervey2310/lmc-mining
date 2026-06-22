import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
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
