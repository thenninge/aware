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

interface CategoryFilter {
  city: boolean;
  town: boolean;
  village: boolean;
  hamlet: boolean;
  farm: boolean;
  isolated_dwelling: boolean;
}

interface CategoryConfig {
  color: string;
  opacity: number;
  icon: string;
}

interface AwareMapProps {
  radius: number;
  onPositionChange?: (position: Position) => void;
  categoryFilters: CategoryFilter;
  categoryConfigs: Record<keyof CategoryFilter, CategoryConfig>;
  shouldScan?: boolean;
  onCategoryChange?: (category: keyof CategoryFilter) => void;
  onScanArea?: () => void;
  onRadiusChange?: (radius: number) => void;
  onCategoryConfigChange?: (category: string, config: CategoryConfig) => void;
  angleRange?: number;
  onAngleRangeChange?: (angleRange: number) => void;
}

export default function AwareMap({ 
  radius, 
  onPositionChange, 
  categoryFilters, 
  categoryConfigs, 
  shouldScan,
  onCategoryChange,
  onScanArea,
  onRadiusChange,
  onCategoryConfigChange,
  angleRange,
  onAngleRangeChange
}: AwareMapProps) {
  const [isClient, setIsClient] = useState(false);
  const [hasError, setHasError] = useState(false);

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

  if (hasError) {
    return (
      <div className="w-full h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg text-red-600 mb-2">Feil ved lasting av kart</div>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Prøv igjen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen">
      <MapComponent 
        radius={radius} 
        onPositionChange={onPositionChange}
        categoryFilters={categoryFilters}
        categoryConfigs={categoryConfigs}
        shouldScan={shouldScan}
        onError={() => setHasError(true)}
        onCategoryChange={onCategoryChange}
        onScanArea={onScanArea}
        onRadiusChange={onRadiusChange}
        onCategoryConfigChange={onCategoryConfigChange}
        angleRange={angleRange}
        onAngleRangeChange={onAngleRangeChange}

      />
    </div>
  );
}
