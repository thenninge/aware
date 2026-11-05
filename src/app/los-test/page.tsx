'use client';

import dynamic from 'next/dynamic';

const LosTestMap = dynamic(() => import('./LosTestMap'), { ssr: false });

export default function LosTestPage() {
  return <LosTestMap />;
}
