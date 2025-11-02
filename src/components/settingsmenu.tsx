'use client';

import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface CategoryConfig {
  color: string;
  opacity: number;
  icon: string;
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
  onMSRRetikkelVerticalPositionChange
}: SettingsMenuProps & { currentCenter?: { lat: number, lng: number } }) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [showHomeSaved, setShowHomeSaved] = useState(false);
  const [showHomeError, setShowHomeError] = useState(false);
  const [showDefaultsSaved, setShowDefaultsSaved] = useState(false);
  const [isHomeExpanded, setIsHomeExpanded] = useState(false);
  const [isPieSliceExpanded, setIsPieSliceExpanded] = useState(false);
  const [isReticleExpanded, setIsReticleExpanded] = useState(false);

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
            categoryConfigs
          };
          localStorage.setItem('aware_settings_defaults', JSON.stringify(defaults));
          setShowDefaultsSaved(true);
          setTimeout(() => setShowDefaultsSaved(false), 1200);
        }}
      >
        💾 Lagre som standard
      </button>
      
      {onDeleteAllShots && (
        <button
          type="button"
          className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded shadow-lg text-sm"
          onClick={onDeleteAllShots}
        >
          Slett alle skuddpar
        </button>
      )}
    </div>
  );
}
