'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import the entire map component to avoid SSR issues
const MapComponent = dynamic(() => import('./mapcomponent'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-screen bg-gray-100 flex items-center justify-center">
      <div className="text-lg">Laster kart...</div>
    </div>
  ),
});

interface Position {
  lat: number;
  lng: number;
}

interface AwareMapProps {
  radius: number;
  onPositionChange?: (position: Position) => void;
}

export default function AwareMap({ radius, onPositionChange }: AwareMapProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <div className="w-full h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-lg">Laster kart...</div>
      </div>
    );
  }

  return <MapComponent radius={radius} onPositionChange={onPositionChange} />;
}
