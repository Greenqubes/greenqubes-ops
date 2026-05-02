import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.imagedelivery.net' },
      { protocol: 'https', hostname: '*.r2.dev' },
    ],
  },
}

export default nextConfig
