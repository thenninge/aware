'use client';

import { useState, useEffect } from 'react';
import AwareMap from '@/components/awaremap';
import SettingsMenu from '@/components/settingsmenu';
import FilterMenu from '@/components/filtermenu';

interface Position {
  lat: number;
  lng: number;
  heading?: number; // Compass heading in degrees (0-360)
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
  const [mode, setMode] = useState<'aware' | 'track'>('aware');
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
  const [isLiveMode, setIsLiveMode] = useState(false); // Default live mode off
  const [isSettingsExpanded, setIsSettingsExpanded] = useState(false);
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const [orientationMode, setOrientationMode] = useState<'north' | 'heading'>('north');
 
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

  useEffect(() => {
    if (mode === 'track') {
      setShowMarkers(false);
    } else if (mode === 'aware') {
      setShowMarkers(true);
    }
  }, [mode]);

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

  const handleLiveModeChange = (isLive: boolean) => {
    setIsLiveMode(isLive);
  };

 

  return (
    <div className="w-full h-screen">
      {/* Mode-toggle og menyknapper alltid synlig, fixed og midtjustert, også på mobil */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 z-[2001] flex justify-center items-center w-full max-w-xs px-2 py-1 gap-2">
        {/* Settings-knapp */}
        <button
          onClick={() => setIsSettingsExpanded((v) => !v)}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors border border-gray-200"
          title="Innstillinger"
        >
          <span className="text-xl">⚙️</span>
        </button>
        <button
          className={`font-semibold px-2 py-1 rounded-full transition-colors text-xs ${mode === 'aware' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
          onClick={() => setMode('aware')}
        >
          Aware
        </button>
        <button
          className={`font-semibold px-2 py-1 rounded-full transition-colors text-xs ${mode === 'track' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
          onClick={() => setMode('track')}
        >
          Track
        </button>
        {/* Filter-knapp */}
        <button
          onClick={() => setIsFilterExpanded((v) => !v)}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors border border-gray-200"
          title="Filter"
        >
          <span className="text-xl">☑️</span>
        </button>
      </div>
      {/* Settings Menu */}
      {isSettingsExpanded && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-[2002]">
          <SettingsMenu
            categoryConfigs={categoryConfigs}
            onCategoryConfigChange={handleCategoryConfigChange}
            angleRange={angleRange}
            onAngleRangeChange={handleAngleRangeChange}
          />
        </div>
      )}
      {/* Filter Menu */}
      {isFilterExpanded && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-[2002]">
          <FilterMenu
            categoryFilters={categoryFilters}
            onCategoryChange={handleCategoryChange}
            radius={radius}
            onRadiusChange={handleRadiusChange}
            showMarkers={showMarkers}
            onShowMarkersChange={handleShowMarkersChange}
            orientationMode={orientationMode}
            onOrientationModeChange={setOrientationMode}
            categoryConfigs={categoryConfigs}
          />
        </div>
      )}
      {/* Kartet */}
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
        isLiveMode={isLiveMode}
        onLiveModeChange={handleLiveModeChange}
        mode={mode}
      />
    </div>
  );
}
