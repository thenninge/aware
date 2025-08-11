'use client';

import { useState } from 'react';
import AwareMap from '@/components/awaremap';

interface Position {
  lat: number;
  lng: number;
}

interface CategoryFilter {
  village: boolean;
  dwelling: boolean;
  city: boolean;
  farm: boolean;
}

interface CategoryConfig {
  color: string;
  opacity: number;
  icon: string;
}

const categoryConfigs: Record<keyof CategoryFilter, CategoryConfig> = {
  village: {
    color: '#dc2626', // Red
    opacity: 0.8,
    icon: '🏘️'
  },
  dwelling: {
    color: '#059669', // Green
    opacity: 0.8,
    icon: '🏠'
  },
  city: {
    color: '#7c3aed', // Purple
    opacity: 0.8,
    icon: '🏙️'
  },
  farm: {
    color: '#ffffff', // White
    opacity: 0.8,
    icon: '🏡'
  }
};

export default function Home() {
  const [radius, setRadius] = useState(2000); // Default 2000m
  const [currentPosition, setCurrentPosition] = useState<Position | null>(null);
  const [categoryFilters, setCategoryFilters] = useState<CategoryFilter>({
    village: true,
    dwelling: true,
    city: true,
    farm: true
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

  return (
    <div className="w-full h-screen flex flex-col">
      {/* Header */}
      <div className="bg-blue-600 text-white p-4 shadow-lg">
        <h1 className="text-xl font-bold">Aware</h1>
        <p className="text-sm opacity-90">Finn ut hva som ligger rundt deg</p>
      </div>

      {/* Controls */}
      <div className="bg-white p-3 border-b shadow-sm">
        {/* Radius Control */}
        <div className="flex items-center gap-3 mb-3">
          <label htmlFor="radius" className="text-sm font-medium text-gray-700 whitespace-nowrap">
            Radius:
          </label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              id="radius"
              min="1000"
              max="4000"
              step="500"
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="w-24 h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer hover:bg-gray-300 transition-colors"
              style={{
                background: 'linear-gradient(to right, #3b82f6 0%, #3b82f6 ' + ((radius - 1000) / 3000 * 100) + '%, #e5e7eb ' + ((radius - 1000) / 3000 * 100) + '%, #e5e7eb 100%)'
              }}
            />
            <span className="text-sm font-mono text-gray-700 bg-blue-50 px-2 py-1 rounded border border-blue-200 min-w-[50px] text-center">
              {radius}m
            </span>
          </div>
          
          {currentPosition && (
            <div className="text-sm text-gray-600 bg-gray-50 px-2 py-1 rounded ml-auto">
              <span className="font-medium">Posisjon:</span>{' '}
              {currentPosition.lat.toFixed(4)}, {currentPosition.lng.toFixed(4)}
            </div>
          )}
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap gap-2">
          {Object.entries(categoryConfigs).map(([category, config]) => (
            <label key={category} className="flex items-center gap-1 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={categoryFilters[category as keyof CategoryFilter]}
                onChange={() => handleCategoryChange(category as keyof CategoryFilter)}
                className="w-3 h-3 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="font-medium text-gray-700">
                {config.icon} {category.charAt(0).toUpperCase() + category.slice(1)}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Map */}
      <div className="flex-1">
        <AwareMap 
          radius={radius} 
          onPositionChange={handlePositionChange}
          categoryFilters={categoryFilters}
          categoryConfigs={categoryConfigs}
        />
      </div>
    </div>
  );
}
