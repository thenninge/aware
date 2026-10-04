import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== 'production';

// Identifiserer bygget; brukes av service workeren til cache-navn og forhåndslastingsliste
const BUILD_ID = process.env.VERCEL_GIT_COMMIT_SHA || `local-${Date.now()}`;
const BUILD_TIME = String(Date.now()).padStart(13, '0');

const nextConfig: NextConfig = {
  generateBuildId: async () => BUILD_ID,
  env: {
    NEXT_PUBLIC_BUILD_ID: BUILD_ID,
    NEXT_PUBLIC_BUILD_TIME: BUILD_TIME,
  },

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
  webpack: (config, { isServer, dev }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };

      if (!dev) {
        // Lister alle statiske filer i klient-bygget slik at service workeren kan lagre hele appskallet
        config.plugins.push({
          apply(compiler: any) {
            const { Compilation, sources } = compiler.webpack;
            compiler.hooks.thisCompilation.tap('PrecacheManifest', (compilation: any) => {
              compilation.hooks.processAssets.tap(
                { name: 'PrecacheManifest', stage: Compilation.PROCESS_ASSETS_STAGE_REPORT },
                (assets: Record<string, unknown>) => {
                  const urls = Object.keys(assets)
                    .filter((name) => name.startsWith('static/') && !name.endsWith('.map'))
                    .map((name) => `/_next/${name}`);
                  compilation.emitAsset(
                    `static/${BUILD_ID}/precache-manifest.json`,
                    new sources.RawSource(JSON.stringify(urls))
                  );
                }
              );
            });
          },
        });
      }
    }
    return config;
  },
};

export default nextConfig;
