'use client';

import { useMap } from 'react-leaflet';
import { useState, useEffect } from 'react';

interface MSRRetikkelProps {
  isVisible: boolean;
  opacity: number;
  currentPosition?: { lat: number; lng: number };
}

export default function MSRRetikkel({ isVisible, opacity, currentPosition }: MSRRetikkelProps) {
  const map = useMap();
  const [scaleValues, setScaleValues] = useState({ x: 0, y: 0 });
  
  // Fast piksel-størrelse for L-en (200px x 200px)
  const L_SIZE_PIXELS = 200;
  
  // Beregn faktiske avstander i meter basert på zoom-nivå
  useEffect(() => {
    if (!map || !currentPosition || !isVisible) return;
    
    // Hent kartets zoom og center
    const zoom = map.getZoom();
    const center = map.getCenter();
    
    // Beregn meter per piksel basert på zoom
    // Dette er en tilnærming - Leaflet har ikke direkte meter-per-pixel API
    const metersPerPixel = 156543.03392 * Math.cos(center.lat * Math.PI / 180) / Math.pow(2, zoom);
    
    // Beregn faktiske avstander i meter
    const xDistanceMeters = Math.round(L_SIZE_PIXELS * metersPerPixel);
    const yDistanceMeters = Math.round(L_SIZE_PIXELS * metersPerPixel);
    
    setScaleValues({ x: xDistanceMeters, y: yDistanceMeters });
  }, [map, currentPosition, isVisible, map?.getZoom()]);
  
  // Early return ETTER alle hooks er kalt
  if (!isVisible || !currentPosition) return null;

  return (
    <div 
      className="absolute pointer-events-none z-[1000]"
      style={{
        left: 'calc(25% + 257px)',
        top: 'calc(50% + 0px)',
        transform: 'translate(-50%, -50%)',
        width: `${L_SIZE_PIXELS}px`,
        height: `${L_SIZE_PIXELS}px`,
      }}
    >
      {/* Origo punkt (nederst til venstre) */}
      <div 
        className="absolute w-2 h-2 rounded-full bg-red-600 border-2 border-white shadow-lg"
        style={{
          left: '0',
          bottom: '0',
          opacity: opacity / 100,
        }}
      />
      
      {/* X-akse (horisontal mot høyre) */}
      <div 
        className="absolute bg-red-600"
        style={{
          left: '0',
          bottom: '0',
          width: `${L_SIZE_PIXELS}px`,
          height: '2px',
          opacity: opacity / 100,
        }}
      />
      
      {/* Y-akse (vertikal oppover) */}
      <div 
        className="absolute bg-red-600"
        style={{
          left: '0',
          bottom: '0',
          width: '2px',
          height: `${L_SIZE_PIXELS}px`,
          opacity: opacity / 100,
        }}
      />
      
      {/* Skala merker på X-akse (origo, midt, ende) - vertikale streker */}
      <div 
        className="absolute bg-red-600"
        style={{
          left: '0',
          bottom: '-8px',
          width: '2px',
          height: '16px',
          opacity: opacity / 100,
        }}
      />
      <div 
        className="absolute bg-red-600"
        style={{
          left: `${L_SIZE_PIXELS / 2}px`,
          bottom: '-8px',
          width: '2px',
          height: '16px',
          opacity: opacity / 100,
        }}
      />
      <div 
        className="absolute bg-red-600"
        style={{
          left: `${L_SIZE_PIXELS}px`,
          bottom: '-8px',
          width: '2px',
          height: '16px',
          opacity: opacity / 100,
        }}
      />
      
      {/* Skala merker på Y-akse (origo, midt, ende) - horisontale streker */}
      <div 
        className="absolute bg-red-600"
        style={{
          left: '-8px',
          bottom: '0',
          width: '16px',
          height: '2px',
          opacity: opacity / 100,
        }}
      />
      <div 
        className="absolute bg-red-600"
        style={{
          left: '-8px',
          bottom: `${L_SIZE_PIXELS / 2}px`,
          width: '16px',
          height: '2px',
          opacity: opacity / 100,
        }}
      />
      <div 
        className="absolute bg-red-600"
        style={{
          left: '-8px',
          bottom: `${L_SIZE_PIXELS}px`,
          width: '16px',
          height: '2px',
          opacity: opacity / 100,
        }}
      />
      
      {/* Tekst-labels for avstander */}
      {/* Origo (0) */}
      <div 
        className="absolute text-xs font-bold text-red-600 bg-white/80 px-1 py-0.5 rounded shadow-sm"
        style={{
          left: '0',
          bottom: '-25px',
          opacity: opacity / 100,
        }}
      >
        0
      </div>
      
      {/* X-akse ende */}
      <div 
        className="absolute text-xs font-bold text-red-600 bg-white/80 px-1 py-0.5 rounded shadow-sm"
        style={{
          left: `${L_SIZE_PIXELS}px`,
          bottom: '-25px',
          transform: 'translateX(-50%)',
          opacity: opacity / 100,
        }}
      >
        {scaleValues.x}m
      </div>
      
      {/* Y-akse ende */}
      <div 
        className="absolute text-xs font-bold text-red-600 bg-white/80 px-1 py-0.5 rounded shadow-sm"
        style={{
          left: '-25px',
          bottom: `${L_SIZE_PIXELS}px`,
          transform: 'translateY(50%)',
          opacity: opacity / 100,
        }}
      >
        {scaleValues.y}m
      </div>
    </div>
  );
}
