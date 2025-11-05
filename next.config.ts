import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== 'production';

const nextConfig: NextConfig = {
  // Configure images and assets
  images: {
    unoptimized: true,
  },
  
  // Disable ESLint during build for production
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Handle external domains for Leaflet tiles
  async headers() {
    const base = [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
    ];
    const devNoCache = isDev
      ? [
          {
            source: '/_next/static/:path*',
            headers: [
              { key: 'Cache-Control', value: 'no-store, must-revalidate' },
            ],
          },
          {
            source: '/:path*',
            headers: [
              { key: 'Cache-Control', value: 'no-store, must-revalidate' },
            ],
          },
        ]
      : [];
    return [...base, ...devNoCache];
  },
  
  // Configure webpack for Leaflet
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
};

export default nextConfig;
