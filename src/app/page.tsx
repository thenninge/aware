'use client';

import { useState } from 'react';
import AwareMap from '@/components/awaremap';

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

export default function Home() {
  const [radius, setRadius] = useState(3000); // Default 3000m
  const [, setCurrentPosition] = useState<Position | null>(null);
  const [categoryFilters, setCategoryFilters] = useState<CategoryFilter>({
    city: true,
    town: true,
    village: true,
    hamlet: true,
    farm: true,
    isolated_dwelling: true
  });
    const [shouldScan, setShouldScan] = useState(false);
  const [angleRange, setAngleRange] = useState(5); // Default ±5 degrees
  const [showMarkers, setShowMarkers] = useState(true); // Default show markers
 
  const [categoryConfigs, setCategoryConfigs] = useState<Record<keyof CategoryFilter, CategoryConfig>>({
    city: {
      color: '#1e40af', // Dark blue
      opacity: 0.5,
      icon: '🏙️'
    },
    town: {
      color: '#7c3aed', // Dark purple
      opacity: 0.5,
      icon: '🏙️'
    },
    village: {
      color: '#dc2626', // Dark red
      opacity: 0.5,
      icon: '🏘️'
    },
    hamlet: {
      color: '#ea580c', // Dark orange
      opacity: 0.5,
      icon: '🏘️'
    },
    farm: {
      color: '#16a34a', // Dark green
      opacity: 0.5,
      icon: '🏡'
    },
    isolated_dwelling: {
      color: '#0891b2', // Dark cyan
      opacity: 0.5,
      icon: '🏠'
    }
  });

  const handlePositionChange = (position: Position) => {
    setCurrentPosition(position);
  };

  const handleCategoryChange = (category: keyof CategoryFilter) => {
    setCategoryFilters(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const handleScanArea = () => {
    setShouldScan(true);
    // Reset after a short delay to allow the map component to process
    setTimeout(() => setShouldScan(false), 100);
  };

  const handleRadiusChange = (newRadius: number) => {
    setRadius(newRadius);
  };

  const handleCategoryConfigChange = (category: string, config: CategoryConfig) => {
    setCategoryConfigs(prev => ({
      ...prev,
      [category]: config
    }));
  };

    const handleAngleRangeChange = (newAngleRange: number) => {
    setAngleRange(newAngleRange);
  };

  const handleShowMarkersChange = (show: boolean) => {
    setShowMarkers(show);
  };

 

  return (
    <div className="w-full h-screen">
      <AwareMap 
        radius={radius} 
        onPositionChange={handlePositionChange}
        categoryFilters={categoryFilters}
        categoryConfigs={categoryConfigs}
        shouldScan={shouldScan}
        onCategoryChange={handleCategoryChange}
        onScanArea={handleScanArea}
        onRadiusChange={handleRadiusChange}
        onCategoryConfigChange={handleCategoryConfigChange}
                angleRange={angleRange}
        onAngleRangeChange={handleAngleRangeChange}
        showMarkers={showMarkers}
        onShowMarkersChange={handleShowMarkersChange}
      />
    </div>
  );
}
