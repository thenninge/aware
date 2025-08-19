'use client';

import React, { useRef, useState } from 'react';

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
}

export default function SettingsMenu({ categoryConfigs, onCategoryConfigChange, angleRange, onAngleRangeChange }: SettingsMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

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
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Innstillinger</h3>
      </div>
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
          max={1}
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
              max={1}
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
  );
}
