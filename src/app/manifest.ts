import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'be AWARE of your shots',
    short_name: 'Aware',
    description: 'by toppjakt.no & coldbarreladjacent',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#1f3d2b',
    theme_color: '#1f3d2b',
    icons: [
      { src: '/pwa-icon/192', sizes: '192x192', type: 'image/png' },
      { src: '/pwa-icon/512', sizes: '512x512', type: 'image/png' },
      { src: '/pwa-icon/512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
