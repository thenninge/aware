'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    const id = encodeURIComponent(process.env.NEXT_PUBLIC_BUILD_ID || 'dev');
    const time = encodeURIComponent(process.env.NEXT_PUBLIC_BUILD_TIME || '0');
    navigator.serviceWorker
      .register(`/sw.js?b=${id}&t=${time}`, { scope: '/' })
      .then((registration) => {
        registration.update().catch(() => {});
        const onVisible = () => {
          if (document.visibilityState === 'visible') registration.update().catch(() => {});
        };
        document.addEventListener('visibilitychange', onVisible);
      })
      .catch((error) => {
        console.warn('Service worker kunne ikke registreres:', error);
      });
  }, []);

  return null;
}
