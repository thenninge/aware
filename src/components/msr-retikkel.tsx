'use client';

import { useMap } from 'react-leaflet';
import { useState, useEffect } from 'react';

interface MSRRetikkelProps {
  isVisible: boolean;
  opacity: number;
  style: 'msr' | 'ivar' | 'circle';
  verticalPosition?: number; // 0-100, kun for ivar-style
  currentPosition?: { lat: number; lng: number; heading?: number };
  compassMode?: 'off' | 'arrow' | 'map';
  sizeRatio?: number; // 0..1 of min(screenWidth, screenHeight)
}

export default function MSRRetikkel({ isVisible, opacity, style, verticalPosition = 50, currentPosition, compassMode = 'off', sizeRatio = 0.3 }: MSRRetikkelProps) {
  const map = useMap();
  const [scaleValues, setScaleValues] = useState({ x: 0, y: 0 });
  const [screenSize, setScreenSize] = useState({ width: 0, height: 0 });
  
  // Dynamisk piksel-størrelse basert på skjermen og valgt sizeRatio
  const minScreen = Math.max(1, Math.min(screenSize.width, screenSize.height));
  const clampedRatio = Math.max(0.1, Math.min(sizeRatio, 0.9));
  const DYNAMIC_SIZE = Math.round(minScreen * clampedRatio);
  const L_SIZE_PIXELS = DYNAMIC_SIZE;
  const CIRCLE_DIAMETER_PIXELS = DYNAMIC_SIZE;
  const CIRCLE_RADIUS_PIXELS = Math.round(CIRCLE_DIAMETER_PIXELS / 2);
  
  // Hent skjermstørrelse og oppdater ved resize
  useEffect(() => {
    const updateScreenSize = () => {
      setScreenSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };
    
    // Sett initial størrelse
    updateScreenSize();
    
    // Lyt til resize events
    window.addEventListener('resize', updateScreenSize);
    
    return () => window.removeEventListener('resize', updateScreenSize);
  }, []);
  
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
  }, [map, currentPosition, isVisible, map?.getZoom(), L_SIZE_PIXELS]);
  
  // Early return ETTER alle hooks er kalt
  if (!isVisible || !currentPosition) return null;

  // Konverter slider-verdi (0-100) til faktisk skjermposisjon (60-85%)
  const actualVerticalPosition = 60 + (verticalPosition / 100) * 25;
  
  // Circle-style rendering
  if (isVisible && currentPosition && style === 'circle') {
    // meters per pixel for HUD display
    const zoom = map.getZoom();
    const center = map.getCenter();
    const metersPerPixel = 156543.03392 * Math.cos(center.lat * Math.PI / 180) / Math.pow(2, zoom);
    const circleRadiusMeters = Math.round(CIRCLE_RADIUS_PIXELS * metersPerPixel);
    // position ring around active map point (currentPosition)
    const p = map.latLngToContainerPoint([currentPosition.lat, currentPosition.lng]);

    return (
      <div
        className="absolute pointer-events-none z-[1000]"
        style={{
          left: `${p.x}px`,
          top: `${p.y}px`,
          transform: 'translate(-50%, -50%)',
          width: `${CIRCLE_DIAMETER_PIXELS}px`,
          height: `${CIRCLE_DIAMETER_PIXELS}px`,
        }}
      >
        {/* Circle ring */}
        <div
          className="absolute rounded-full border-2 border-red-600"
          style={{
            left: '0',
            top: '0',
            width: `${CIRCLE_DIAMETER_PIXELS}px`,
            height: `${CIRCLE_DIAMETER_PIXELS}px`,
            opacity: opacity / 100,
          }}
        />
        {/* Center red dot */}
        <div
          className="absolute w-2 h-2 rounded-full bg-red-600 border-2 border-white shadow"
          style={{
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            opacity: opacity / 100,
          }}
        />
        {/* HUD at ~225 degrees */}
        <div
          className="absolute text-xs font-bold text-red-600 bg-white/85 px-1 py-0.5 rounded shadow-sm"
          style={{
            left: `${50 - (CIRCLE_RADIUS_PIXELS / Math.SQRT2) * 100 / CIRCLE_DIAMETER_PIXELS}%`,
            top: `${50 + (CIRCLE_RADIUS_PIXELS / Math.SQRT2) * 100 / CIRCLE_DIAMETER_PIXELS}%`,
            transform: 'translate(-50%, -50%)',
            opacity: opacity / 100,
          }}
        >
          {circleRadiusMeters}m
        </div>
      </div>
    );
  }

  return (
    <div 
      className="absolute pointer-events-none z-[1000]"
      style={{
        left: style === 'msr' 
          ? `${screenSize.width / 2 + 0}px`  // MSR-style: midt på skjermen
          : `140px`,                          // Ivar-style: 140px fra venstre kant (10px + 50px + 30px + 30px + 20px)
        top: style === 'msr'
          ? `${screenSize.height / 2 + 40}px` // MSR-style: 40px under midten av skjermen
          : `${(actualVerticalPosition / 100) * screenSize.height}px`, // Ivar-style: justerbar vertikal posisjon (slider 0-100 = 60-85% av skjermen)
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
      
      {/* X-akse midtpunkt */}
      <div 
        className="absolute text-xs font-bold text-red-600 bg-white/80 px-1 py-0.5 rounded shadow-sm"
        style={{
          left: `${L_SIZE_PIXELS / 2}px`,
          bottom: '-25px',
          transform: 'translateX(-50%)',
          opacity: opacity / 100,
        }}
      >
        {Math.round(scaleValues.x / 2)}m
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
      
      {/* Y-akse midtpunkt */}
      <div 
        className="absolute text-xs font-bold text-red-600 bg-white/80 px-1 py-0.5 rounded shadow-sm"
        style={{
          left: '-25px',
          bottom: `${L_SIZE_PIXELS / 2 + 15}px`,
          transform: 'translateY(50%)',
          opacity: opacity / 100,
        }}
      >
        {Math.round(scaleValues.y / 2)}m
      </div>
      
      {/* Y-akse ende */}
      <div 
        className="absolute text-xs font-bold text-red-600 bg-white/80 px-1 py-0.5 rounded shadow-sm"
        style={{
          left: '-25px',
          bottom: `${L_SIZE_PIXELS + 15}px`,
          transform: 'translateY(50%)',
          opacity: opacity / 100,
        }}
      >
        {scaleValues.y}m
      </div>
    </div>
  );
}
