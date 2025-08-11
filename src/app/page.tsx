'use client';

import { useState } from 'react';
import AwareMap from '@/components/awaremap';

interface Position {
  lat: number;
  lng: number;
}

export default function Home() {
  const [radius, setRadius] = useState(2000); // Default 2000m
  const [currentPosition, setCurrentPosition] = useState<Position | null>(null);

  const handlePositionChange = (position: Position) => {
    setCurrentPosition(position);
  };

  return (
    <div className="w-full h-screen flex flex-col">
      {/* Header */}
      <div className="bg-blue-600 text-white p-4 shadow-lg">
        <h1 className="text-xl font-bold">Aware</h1>
        <p className="text-sm opacity-90">Finn ut hva som ligger rundt deg</p>
      </div>

      {/* Controls */}
      <div className="bg-white p-4 border-b shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <label htmlFor="radius" className="text-sm font-medium text-gray-700">
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
                className="w-32 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-sm font-mono text-gray-600 min-w-[60px]">
                {radius}m
              </span>
            </div>
          </div>
          
          {currentPosition && (
            <div className="text-sm text-gray-600">
              <span className="font-medium">Posisjon:</span>{' '}
              {currentPosition.lat.toFixed(4)}, {currentPosition.lng.toFixed(4)}
            </div>
          )}
        </div>
      </div>

      {/* Map */}
      <div className="flex-1">
        <AwareMap 
          radius={radius} 
          onPositionChange={handlePositionChange}
        />
      </div>
    </div>
  );
}
