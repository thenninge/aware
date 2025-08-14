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
  const [radius, setRadius] = useState(2000); // Default 2000m
  const [currentPosition, setCurrentPosition] = useState<Position | null>(null);
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
  const [categoryConfigs, setCategoryConfigs] = useState<Record<keyof CategoryFilter, CategoryConfig>>({
    city: {
      color: '#B3D9FF', // Vibrant blue
      opacity: 0.8,
      icon: '🏙️'
    },
    town: {
      color: '#D4B3FF', // Vibrant purple
      opacity: 0.8,
      icon: '🏙️'
    },
    village: {
      color: '#FFB3B3', // Vibrant red
      opacity: 0.8,
      icon: '🏘️'
    },
    hamlet: {
      color: '#FFD4B3', // Vibrant orange
      opacity: 0.8,
      icon: '🏘️'
    },
    farm: {
      color: '#B3FFB3', // Vibrant green
      opacity: 0.8,
      icon: '🏡'
    },
    isolated_dwelling: {
      color: '#B3F0FF', // Vibrant cyan
      opacity: 0.8,
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
      />
    </div>
  );
}
