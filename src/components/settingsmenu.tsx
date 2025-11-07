'use client';

import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface CategoryConfig {
  color: string;
  opacity: number;
  icon: string;
}

interface CategoryFilter {
  city: boolean;
  town: boolean;
  village: boolean;
  hamlet: boolean;
  farm: boolean;
  isolated_dwelling: boolean;
}

interface SettingsMenuProps {
  categoryConfigs: Record<string, CategoryConfig>;
  angleRange: number;
  onAngleRangeChange: (angleRange: number) => void;
  onCategoryConfigChange: (category: string, config: CategoryConfig) => void;
  onDeleteAllShots?: () => void;
  showMSRRetikkel?: boolean;
  msrRetikkelOpacity?: number;
  msrRetikkelStyle?: 'msr' | 'ivar';
  msrRetikkelVerticalPosition?: number;
  onShowMSRRetikkelChange?: (show: boolean) => void;
  onMSRRetikkelOpacityChange?: (opacity: number) => void;
  onMSRRetikkelStyleChange?: (style: 'msr' | 'ivar') => void;
  onMSRRetikkelVerticalPositionChange?: (position: number) => void;
  categoryFilters?: CategoryFilter;
  onCategoryChange?: (category: keyof CategoryFilter) => void;
  showMarkers?: boolean;
  onShowMarkersChange?: (show: boolean) => void;
  showShots?: boolean;
  showTracks?: boolean;
  showObservations?: boolean;
  showHuntingBoundary?: boolean;
  targetSize?: number;
  shotSize?: number;
  observationSize?: number;
  targetLineColor?: string;
  shotColor?: string;
  targetColor?: string;
  targetLineWeight?: number;
  onTargetSizeChange?: (size: number) => void;
  onShotSizeChange?: (size: number) => void;
  onObservationSizeChange?: (size: number) => void;
  onTargetLineColorChange?: (color: string) => void;
  onShotColorChange?: (color: string) => void;
  onTargetColorChange?: (color: string) => void;
  onTargetLineWeightChange?: (weight: number) => void;
  huntingAreas?: HuntingArea[];
  activeHuntingAreaId?: string | null;
  onDefineNewHuntingArea?: () => void;
  onActiveHuntingAreaChange?: (id: string | null) => void;
  onDeleteHuntingArea?: (id: string) => void;
  huntingBoundaryColor?: string;
  huntingBoundaryWeight?: number;
  huntingBoundaryOpacity?: number;
  onHuntingBoundaryColorChange?: (color: string) => void;
  onHuntingBoundaryWeightChange?: (weight: number) => void;
  onHuntingBoundaryOpacityChange?: (opacity: number) => void;
  compassSliceLength?: number; // 0-100 (% of screen height)
  onCompassSliceLengthChange?: (length: number) => void;
  showZoomButtons?: boolean;
  onShowZoomButtonsChange?: (v: boolean) => void;
  zoomButtonsX?: number;
  zoomButtonsY?: number;
  onZoomButtonsXChange?: (v: number) => void;
  onZoomButtonsYChange?: (v: number) => void;
  zoomButtonsSide?: 'left' | 'right';
  onZoomButtonsSideChange?: (v: 'left' | 'right') => void;
  // LOS settings
  losObserverHeightM?: number;
  losRadiusM?: number;
  onLosObserverHeightChange?: (v: number) => void;
  onLosRadiusChange?: (v: number) => void;
}

export interface HuntingArea {
  id: string;
  name: string;
  coordinates: [number, number][]; // Array of [lat, lng] points defining the boundary
  color: string;
  lineWeight: number;
  created_at: string;
  team_id?: string; // For future Supabase integration
}

export default function SettingsMenu({ 
  categoryConfigs, 
  onCategoryConfigChange, 
  angleRange, 
  onAngleRangeChange, 
  onDeleteAllShots, 
  currentCenter,
  showMSRRetikkel,
  msrRetikkelOpacity,
  msrRetikkelStyle,
  msrRetikkelVerticalPosition,
  onShowMSRRetikkelChange,
  onMSRRetikkelOpacityChange,
  onMSRRetikkelStyleChange,
  onMSRRetikkelVerticalPositionChange,
  categoryFilters,
  onCategoryChange,
  showMarkers,
  onShowMarkersChange,
  showShots,
  showTracks,
  showObservations,
  showHuntingBoundary,
  targetSize,
  shotSize,
  observationSize,
  targetLineColor,
  shotColor,
  targetColor,
  targetLineWeight,
  onTargetSizeChange,
  onShotSizeChange,
  onObservationSizeChange,
  onTargetLineColorChange,
  onShotColorChange,
  onTargetColorChange,
  onTargetLineWeightChange,
  huntingAreas,
  activeHuntingAreaId,
  onDefineNewHuntingArea,
  onActiveHuntingAreaChange,
  onDeleteHuntingArea,
  huntingBoundaryColor,
  huntingBoundaryWeight,
  huntingBoundaryOpacity,
  onHuntingBoundaryColorChange,
  onHuntingBoundaryWeightChange,
  onHuntingBoundaryOpacityChange,
  compassSliceLength,
  onCompassSliceLengthChange,
  showZoomButtons,
  onShowZoomButtonsChange,
  zoomButtonsX,
  zoomButtonsY,
  onZoomButtonsXChange,
  onZoomButtonsYChange,
  zoomButtonsSide,
  onZoomButtonsSideChange,
  losObserverHeightM,
  losRadiusM,
  onLosObserverHeightChange,
  onLosRadiusChange
}: SettingsMenuProps & { currentCenter?: { lat: number, lng: number } }) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [showHomeSaved, setShowHomeSaved] = useState(false);
  const [showHomeError, setShowHomeError] = useState(false);
  const [showDefaultsSaved, setShowDefaultsSaved] = useState(false);
  const [isHomeExpanded, setIsHomeExpanded] = useState(false);
  const [isPieSliceExpanded, setIsPieSliceExpanded] = useState(false);
  const [isReticleExpanded, setIsReticleExpanded] = useState(false);
  const [isCompassExpanded, setIsCompassExpanded] = useState(false);
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const [isShootTrackExpanded, setIsShootTrackExpanded] = useState(false);
  const [isHuntingAreaExpanded, setIsHuntingAreaExpanded] = useState(false);
  const [isZoomButtonsExpanded, setIsZoomButtonsExpanded] = useState(false);
  const [isLosExpanded, setIsLosExpanded] = useState(false);
  const [savedHomePosition, setSavedHomePosition] = useState<{ lat: number; lng: number } | null>(null);

  const categoryLabels: Record<keyof CategoryFilter, string> = {
    city: 'By',
    town: 'Tettsted',
    village: 'Landsby',
    hamlet: 'Grend',
    farm: 'Gård',
    isolated_dwelling: 'Enkeltbolig',
  };

  // Load saved home position from localStorage
  useEffect(() => {
    const loadSavedHomePosition = () => {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('aware_default_position');
        if (saved) {
          try {
            const pos = JSON.parse(saved);
            setSavedHomePosition(pos);
          } catch (e) {
            console.error('Error loading home position:', e);
          }
        }
      }
    };
    loadSavedHomePosition();
  }, [showHomeSaved]); // Reload when home position is saved

  // Fjernet allOpacities/globalOpacity og tilhørende useState/hook

  const handleColorChange = (category: string, color: string) => {
    const currentConfig = categoryConfigs[category];
    onCategoryConfigChange(category, {
      ...currentConfig,
      color
    });
  };

  const handleOpacityChange = (category: string, opacity: number) => {
    const currentConfig = categoryConfigs[category];
    onCategoryConfigChange(category, {
      ...currentConfig,
      opacity
    });
  };

  // Ny funksjon: Sett opacity for alle kategorier
  const handleGlobalOpacityChange = (opacity: number) => {
    Object.entries(categoryConfigs).forEach(([category, config]) => {
      if (config.opacity !== opacity) {
        onCategoryConfigChange(category, { ...config, opacity });
      }
    });
  };

  return (
    <div ref={menuRef} className="bg-white/95 backdrop-blur-sm p-4 rounded-lg shadow-lg min-w-[280px] max-h-[80vh] overflow-y-auto">
      {showHomeSaved && typeof window !== 'undefined' && createPortal(
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[3000] bg-gray-700 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2 animate-bounce">
          <span className="font-semibold text-lg">Home position saved!</span>
        </div>,
        document.body
      )}
      {showHomeError && typeof window !== 'undefined' && createPortal(
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[3000] bg-gray-500 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2 animate-bounce">
          <span className="font-semibold text-lg">Kartposisjon ikke klar</span>
        </div>,
        document.body
      )}
      {showDefaultsSaved && typeof window !== 'undefined' && createPortal(
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[3000] bg-green-600 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2 animate-bounce">
          <span className="font-semibold text-lg">💾 Innstillinger lagret!</span>
        </div>,
        document.body
      )}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Innstillinger</h3>
      </div>
      
      {/* Home Position Settings Expander */}
      <div className="mb-4 border border-gray-200 rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setIsHomeExpanded(!isHomeExpanded)}
          className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <span className="text-sm font-medium text-gray-700">Home position settings</span>
          <span className="text-gray-500 text-sm">{isHomeExpanded ? '▼' : '▶'}</span>
        </button>
        
        {isHomeExpanded && (
          <div className="p-3 bg-white">
            <button
              type="button"
              className={`w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded shadow-lg text-sm ${!currentCenter ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={!currentCenter}
              onClick={() => {
                if (currentCenter) {
                  localStorage.setItem('aware_default_position', JSON.stringify(currentCenter));
                  setSavedHomePosition(currentCenter); // Update displayed coordinates immediately
                  setShowHomeSaved(true);
                  setTimeout(() => setShowHomeSaved(false), 1200);
                } else {
                  setShowHomeError(true);
                  setTimeout(() => setShowHomeError(false), 1200);
                }
              }}
            >
              Set as home position
            </button>
            {savedHomePosition ? (
              <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-700">
                <div className="font-semibold mb-1 text-gray-600">Lagret home position:</div>
                <div className="font-mono">
                  <div>Lat: {savedHomePosition.lat.toFixed(6)}</div>
                  <div>Lng: {savedHomePosition.lng.toFixed(6)}</div>
                </div>
              </div>
            ) : (
              <div className="mt-2 p-2 bg-gray-100 rounded text-xs text-gray-500 italic">
                Ingen home position lagret ennå
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Reticle Settings Expander */}
      {showMSRRetikkel !== undefined && onShowMSRRetikkelChange && (
        <div className="mb-4 border border-gray-200 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setIsReticleExpanded(!isReticleExpanded)}
            className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <span className="text-sm font-medium text-gray-700">Reticle settings</span>
            <span className="text-gray-500 text-sm">{isReticleExpanded ? '▼' : '▶'}</span>
          </button>
          
          {isReticleExpanded && (
            <div className="p-3 bg-white">
              {/* Show/Hide MSR-retikkel */}
              <div className="mb-3">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={showMSRRetikkel}
                    onChange={(e) => onShowMSRRetikkelChange(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  Vis MSR-retikkel
                </label>
              </div>
              
              {/* MSR-retikkel Opacity */}
              {showMSRRetikkel && msrRetikkelOpacity !== undefined && onMSRRetikkelOpacityChange && (
                <div className="mb-3">
                  <label className="text-xs font-medium text-gray-700 block mb-1">
                    Opasitet markeringer: {msrRetikkelOpacity}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={msrRetikkelOpacity}
                    onChange={(e) => onMSRRetikkelOpacityChange(Number(e.target.value))}
                    className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer hover:bg-gray-300 transition-colors"
                    style={{
                      background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${msrRetikkelOpacity}%, #e5e7eb ${msrRetikkelOpacity}%, #e5e7eb 100%)`
                    }}
                  />
                </div>
              )}
              
              {/* MSR-retikkel Style Toggle */}
              {showMSRRetikkel && msrRetikkelStyle !== undefined && onMSRRetikkelStyleChange && (
                <div className="mb-3">
                  <label className="text-xs font-medium text-gray-700 block mb-2">
                    Plassering:
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onMSRRetikkelStyleChange('msr')}
                      className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                        msrRetikkelStyle === 'msr'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      MSR-style
                    </button>
                    <button
                      type="button"
                      onClick={() => onMSRRetikkelStyleChange('ivar')}
                      className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                        msrRetikkelStyle === 'ivar'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      Ivar-style
                    </button>
                  </div>
                </div>
              )}
              
              {/* Vertical Position Slider - only for Ivar-style */}
              {showMSRRetikkel && msrRetikkelStyle === 'ivar' && msrRetikkelVerticalPosition !== undefined && onMSRRetikkelVerticalPositionChange && (
                <div className="mb-3">
                  <label className="text-xs font-medium text-gray-700 block mb-1">
                    Vertikal posisjon: {Math.round(60 + (msrRetikkelVerticalPosition / 100) * 25)}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={msrRetikkelVerticalPosition}
                    onChange={(e) => onMSRRetikkelVerticalPositionChange(Number(e.target.value))}
                    className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer hover:bg-gray-300 transition-colors"
                    style={{
                      background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${msrRetikkelVerticalPosition}%, #e5e7eb ${msrRetikkelVerticalPosition}%, #e5e7eb 100%)`
                    }}
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    0 = 60% ned (høyere opp), 100 = 85% ned (lenger ned)
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      {/* Compass Settings Expander */}
      {compassSliceLength !== undefined && onCompassSliceLengthChange && (
        <div className="mb-4 border border-gray-200 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setIsCompassExpanded(!isCompassExpanded)}
            className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <span className="text-sm font-medium text-gray-700">Compass settings</span>
            <span className="text-gray-500 text-sm">{isCompassExpanded ? '▼' : '▶'}</span>
          </button>
          
          {isCompassExpanded && (
            <div className="p-3 bg-white">
              {/* Compass Slice Length */}
              <div className="mb-3">
                <label className="text-xs font-medium text-gray-700 block mb-1">
                  Indikatorlengde: {compassSliceLength}%
                </label>
                <input
                  type="range"
                  min="10"
                  max="50"
                  step="5"
                  value={compassSliceLength}
                  onChange={(e) => onCompassSliceLengthChange(Number(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer hover:bg-gray-300 transition-colors"
                  style={{
                    background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(compassSliceLength - 10) / 40 * 100}%, #e5e7eb ${(compassSliceLength - 10) / 40 * 100}%, #e5e7eb 100%)`
                  }}
                />
                <div className="text-xs text-gray-500 mt-1">
                  Prosent av skjermhøyde
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Zoom Buttons Settings Expander */}
      <div className="mb-4 border border-gray-200 rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setIsZoomButtonsExpanded(!isZoomButtonsExpanded)}
          className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <span className="text-sm font-medium text-gray-700">Zoom buttons settings</span>
          <span className="text-gray-500 text-sm">{isZoomButtonsExpanded ? '▼' : '▶'}</span>
        </button>
        {isZoomButtonsExpanded && (
        <div className="p-3 bg-white">
          {onShowZoomButtonsChange && (
            <div className="mb-3">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={!!showZoomButtons}
                  onChange={e => onShowZoomButtonsChange(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                Show zoom buttons
              </label>
            </div>
          )}
          {(onZoomButtonsSideChange && zoomButtonsSide !== undefined) && (
            <div className="mb-3">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={zoomButtonsSide === 'right'}
                  onChange={e => onZoomButtonsSideChange(e.target.checked ? 'right' : 'left')}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                Right side
              </label>
            </div>
          )}
          {(onZoomButtonsYChange && zoomButtonsY !== undefined) && (
            <div className="mb-3">
              <label className="text-xs font-medium text-gray-700 block mb-1">
                Y-position: {zoomButtonsY}px
              </label>
              <input
                type="range"
                min={0}
                max={750}
                step={2}
                value={zoomButtonsY}
                onChange={e => onZoomButtonsYChange(Number(e.target.value))}
                className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer hover:bg-gray-300 transition-colors"
              />
            </div>
          )}
          {(onZoomButtonsXChange && zoomButtonsX !== undefined) && (
            <div className="mb-1">
              <label className="text-xs font-medium text-gray-700 block mb-1">
                X-position: {zoomButtonsX}px
              </label>
              <input
                type="range"
                min={-10}
                max={64}
                step={1}
                value={zoomButtonsX}
                onChange={e => onZoomButtonsXChange(Number(e.target.value))}
                className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer hover:bg-gray-300 transition-colors"
              />
            </div>
          )}
        </div>
        )}
      </div>

      {/* LOS Settings Expander */}
      <div className="mb-4 border border-gray-200 rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setIsLosExpanded(!isLosExpanded)}
          className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <span className="text-sm font-medium text-gray-700">LOS settings</span>
          <span className="text-gray-500 text-sm">{isLosExpanded ? '▼' : '▶'}</span>
        </button>
        {isLosExpanded && (
          <div className="p-3 bg-white">
            {onLosObserverHeightChange && losObserverHeightM !== undefined && (
              <div className="mb-3">
                <label className="text-xs font-medium text-gray-700 block mb-1">
                  Høyde over bakken: {losObserverHeightM} m
                </label>
                <input
                  type="range"
                  min={0}
                  max={15}
                  step={1}
                  value={losObserverHeightM}
                  onChange={e => onLosObserverHeightChange(Number(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer hover:bg-gray-300 transition-colors"
                />
              </div>
            )}
            {onLosRadiusChange && losRadiusM !== undefined && (
              <div className="mb-1">
                <label className="text-xs font-medium text-gray-700 block mb-1">
                  Range (radius): {losRadiusM} m
                </label>
                <input
                  type="range"
                  min={100}
                  max={500}
                  step={10}
                  value={losRadiusM}
                  onChange={e => onLosRadiusChange(Number(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer hover:bg-gray-300 transition-colors"
                />
                <div className="text-[11px] text-gray-500 mt-1">
                  Radius for LOS‑beregning (ikke diameter)
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Filter Settings Expander */}
      {categoryFilters && onCategoryChange && (
        <div className="mb-4 border border-gray-200 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setIsFilterExpanded(!isFilterExpanded)}
            className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <span className="text-sm font-medium text-gray-700">Filter settings</span>
            <span className="text-gray-500 text-sm">{isFilterExpanded ? '▼' : '▶'}</span>
          </button>
          
          {isFilterExpanded && (
            <div className="p-3 bg-white">
              {/* Vis bebyggelse */}
              {showMarkers !== undefined && onShowMarkersChange && (
                <div className="mb-3">
                  <label className="flex items-center gap-2 cursor-pointer text-xs bg-gray-50 px-2 py-1 rounded border hover:bg-gray-100 transition-colors">
                    <input
                      type="checkbox"
                      checked={showMarkers}
                      onChange={e => onShowMarkersChange(e.target.checked)}
                      className="w-3 h-3 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span className="font-medium text-gray-700">
                      Vis bebyggelse
                    </span>
                  </label>
                </div>
              )}
              
              <div className="space-y-1">
                {Object.entries(categoryFilters).map(([category, checked]) => (
                  <label key={category} className="flex items-center gap-2 cursor-pointer text-xs bg-gray-50 px-2 py-1 rounded border hover:bg-gray-100 transition-colors">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onCategoryChange(category as keyof CategoryFilter)}
                      className="w-3 h-3 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span
                      className="font-medium"
                      style={{ color: categoryConfigs[category as keyof CategoryFilter]?.color || '#333' }}
                    >
                      {categoryLabels[category as keyof CategoryFilter]}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Shoot & Track Settings Expander */}
      <div className="mb-4 border border-gray-200 rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setIsShootTrackExpanded(!isShootTrackExpanded)}
          className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <span className="text-sm font-medium text-gray-700">Shoot & Track settings</span>
          <span className="text-gray-500 text-sm">{isShootTrackExpanded ? '▼' : '▶'}</span>
        </button>
        
        {isShootTrackExpanded && (
          <div className="p-3 bg-white">
            {/* Target size */}
            {targetSize !== undefined && onTargetSizeChange && (
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Target size: {targetSize}m
                </label>
                <input
                  type="range"
                  min="5"
                  max="50"
                  step="5"
                  value={targetSize}
                  onChange={(e) => onTargetSizeChange(Number(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer hover:bg-gray-300 transition-colors"
                />
              </div>
            )}
            
            {/* Standplass size */}
            {shotSize !== undefined && onShotSizeChange && (
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Standplass size: {shotSize}m
                </label>
                <input
                  type="range"
                  min="2"
                  max="20"
                  step="1"
                  value={shotSize}
                  onChange={(e) => onShotSizeChange(Number(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer hover:bg-gray-300 transition-colors"
                />
              </div>
            )}
            
            {/* Observasjons size */}
            {observationSize !== undefined && onObservationSizeChange && (
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Observasjons size: {observationSize}m
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="0.5"
                  value={observationSize}
                  onChange={(e) => onObservationSizeChange(Number(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer hover:bg-gray-300 transition-colors"
                />
              </div>
            )}
            
            {/* Skuddplass color */}
            {shotColor !== undefined && onShotColorChange && (
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Skuddplass color:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={shotColor}
                    onChange={(e) => onShotColorChange(e.target.value)}
                    className="w-12 h-8 border rounded cursor-pointer"
                  />
                  <span className="text-xs text-gray-600">{shotColor}</span>
                </div>
              </div>
            )}
            
            {/* Treffpunkt color */}
            {targetColor !== undefined && onTargetColorChange && (
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Treffpunkt color:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={targetColor}
                    onChange={(e) => onTargetColorChange(e.target.value)}
                    className="w-12 h-8 border rounded cursor-pointer"
                  />
                  <span className="text-xs text-gray-600">{targetColor}</span>
                </div>
              </div>
            )}
            
            {/* Target line color */}
            {targetLineColor !== undefined && onTargetLineColorChange && (
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Target line color:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={targetLineColor}
                    onChange={(e) => onTargetLineColorChange(e.target.value)}
                    className="w-12 h-8 border rounded cursor-pointer"
                  />
                  <span className="text-xs text-gray-600">{targetLineColor}</span>
                </div>
              </div>
            )}
            
            {/* Target line tykkelse */}
            {targetLineWeight !== undefined && onTargetLineWeightChange && (
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Target line tykkelse: {targetLineWeight}px
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="1"
                  value={targetLineWeight}
                  onChange={(e) => onTargetLineWeightChange(Number(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer hover:bg-gray-300 transition-colors"
                />
              </div>
            )}
            
            {onDeleteAllShots && (
              <button
                type="button"
                className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded shadow-lg text-sm mt-2"
                onClick={onDeleteAllShots}
              >
                Slett alle skuddpar
              </button>
            )}
          </div>
        )}
      </div>
      
      {/* Jaktfelt Expander */}
      <div className="mb-4 border border-gray-200 rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setIsHuntingAreaExpanded(!isHuntingAreaExpanded)}
          className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <span className="text-sm font-medium text-gray-700">Jaktfelt</span>
          <span className="text-gray-500 text-sm">{isHuntingAreaExpanded ? '▼' : '▶'}</span>
        </button>
        
        {isHuntingAreaExpanded && (
          <div className="p-3 bg-white">
            {/* Definer nytt jaktfelt button */}
            {onDefineNewHuntingArea && (
              <button
                type="button"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded shadow-lg text-sm mb-3"
                onClick={onDefineNewHuntingArea}
              >
                Definer nytt jaktfelt
              </button>
            )}
            
            {/* Velg aktivt jaktfelt dropdown */}
            {huntingAreas !== undefined && onActiveHuntingAreaChange && (
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Velg aktivt jaktfelt:
                </label>
                <select
                  value={activeHuntingAreaId || ''}
                  onChange={(e) => onActiveHuntingAreaChange(e.target.value || null)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                >
                  <option value="">Ingen</option>
                  {huntingAreas.map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.name}
                    </option>
                  ))}
                </select>
                {huntingAreas.length === 0 && (
                  <p className="text-xs text-gray-500 mt-1 italic">
                    Ingen jaktfelt definert ennå
                  </p>
                )}
                {activeHuntingAreaId && onDeleteHuntingArea && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Er du sikker på at du vil slette dette jaktfeltet?')) {
                        onDeleteHuntingArea(activeHuntingAreaId);
                      }
                    }}
                    className="w-full mt-2 bg-red-600 hover:bg-red-700 text-white font-semibold py-1.5 px-3 rounded text-xs"
                  >
                    🗑️ Slett aktivt jaktfelt
                  </button>
                )}
              </div>
            )}
            
            {/* Jaktgrense farge */}
            {huntingBoundaryColor !== undefined && onHuntingBoundaryColorChange && (
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Jaktgrense farge:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={huntingBoundaryColor}
                    onChange={(e) => onHuntingBoundaryColorChange(e.target.value)}
                    className="w-12 h-8 border rounded cursor-pointer"
                  />
                  <span className="text-xs text-gray-600">{huntingBoundaryColor}</span>
                </div>
              </div>
            )}
            
            {/* Jaktgrense tykkelse */}
            {huntingBoundaryWeight !== undefined && onHuntingBoundaryWeightChange && (
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Jaktgrense tykkelse: {huntingBoundaryWeight}px
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="1"
                  value={huntingBoundaryWeight}
                  onChange={(e) => onHuntingBoundaryWeightChange(Number(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer hover:bg-gray-300 transition-colors"
                />
              </div>
            )}
            
            {/* Jaktgrense opasitet */}
            {huntingBoundaryOpacity !== undefined && onHuntingBoundaryOpacityChange && (
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Jaktgrense opasitet: {huntingBoundaryOpacity}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={huntingBoundaryOpacity}
                  onChange={(e) => onHuntingBoundaryOpacityChange(Number(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer hover:bg-gray-300 transition-colors"
                />
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Pie Slice Settings Expander */}
      <div className="mb-4 border border-gray-200 rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setIsPieSliceExpanded(!isPieSliceExpanded)}
          className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <span className="text-sm font-medium text-gray-700">Pie slice settings</span>
          <span className="text-gray-500 text-sm">{isPieSliceExpanded ? '▼' : '▶'}</span>
        </button>
        
        {isPieSliceExpanded && (
          <div className="p-3 bg-white">
            {/* Angle Range Setting */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-700 mb-1">Retningsvinkel (±grader):</label>
              <input
                type="range"
                min={1}
                max={45}
                value={angleRange}
                onChange={e => onAngleRangeChange(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="text-xs text-gray-600 mt-1">±{angleRange}°</div>
            </div>
            
            {/* Global Opacity Slider */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-700 mb-1">Opasitet alle kakestykker:</label>
              <input
                type="range"
                min={0.1}
                max={0.7}
                step={0.05}
                value={(() => {
                  const opacities = Object.values(categoryConfigs).map(c => c.opacity);
                  return opacities.every(o => o === opacities[0]) ? opacities[0] : opacities[0];
                })()}
                onChange={e => handleGlobalOpacityChange(Number(e.target.value))}
                className={`w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer ${(() => {
                  const opacities = Object.values(categoryConfigs).map(c => c.opacity);
                  return opacities.every(o => o === opacities[0]) ? '' : 'opacity-50 pointer-events-none';
                })()}`}
                disabled={(() => {
                  const opacities = Object.values(categoryConfigs).map(c => c.opacity);
                  return !opacities.every(o => o === opacities[0]);
                })()}
              />
              <div className="text-xs text-gray-600 mt-1">
                {(() => {
                  const opacities = Object.values(categoryConfigs).map(c => c.opacity);
                  if (opacities.every(o => o === opacities[0])) {
                    return Math.round(opacities[0] * 100) + '%';
                  } else {
                    return Math.round(opacities[0] * 100) + '% (blandet)';
                  }
                })()}
              </div>
              {/* Reset-knapp for opasitet */}
              <button
                type="button"
                className="mt-2 mb-2 px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 text-xs font-medium text-gray-700 transition-colors"
                onClick={() => {
                  Object.keys(categoryConfigs).forEach((key) => {
                    onCategoryConfigChange(key, {
                      ...categoryConfigs[key],
                      opacity: 0.5,
                    });
                  });
                }}
              >
                Tilbakestill opasitet til 50%
              </button>
            </div>
            
            {/* Kategori-farger og opasitet */}
            <div>
              <div className="text-xs font-medium text-gray-700 mb-2">Farger og opasitet:</div>
              {Object.entries(categoryConfigs).map(([category, config]) => (
                <div key={category} className="flex items-center gap-2 mb-2">
                  <span className="text-lg" title={category}>{config.icon}</span>
                  <input
                    type="color"
                    value={config.color}
                    onChange={e => handleColorChange(category, e.target.value)}
                    className="w-8 h-8 border rounded"
                  />
                  <input
                    type="range"
                    min={0.1}
                    max={0.7}
                    step={0.05}
                    value={config.opacity}
                    onChange={e => handleOpacityChange(category, Number(e.target.value))}
                    className="w-24 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-xs text-gray-600">{Math.round(config.opacity * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {/* Save defaults button */}
      <button
        type="button"
        className="mb-3 w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded shadow-lg text-sm"
        onClick={() => {
          const defaults = {
            angleRange,
            showMSRRetikkel,
            msrRetikkelOpacity,
            msrRetikkelStyle,
            msrRetikkelVerticalPosition,
            categoryConfigs,
            categoryFilters,
            showMarkers,
            showShots,
            showTracks,
            showObservations,
            showHuntingBoundary,
            targetSize,
            shotSize,
            observationSize,
            targetLineColor,
            shotColor,
            targetColor,
            targetLineWeight,
            huntingBoundaryColor,
            huntingBoundaryWeight,
            huntingBoundaryOpacity,
            showZoomButtons,
            zoomButtonsX,
            zoomButtonsY,
            zoomButtonsSide,
            losObserverHeightM,
            losRadiusM
          };
          localStorage.setItem('aware_settings_defaults', JSON.stringify(defaults));
          setShowDefaultsSaved(true);
          setTimeout(() => setShowDefaultsSaved(false), 1200);
        }}
      >
        💾 Lagre som standard
      </button>
    </div>
  );
}
