'use client';

import { useState } from 'react';

interface CategoryConfig {
  color: string;
  opacity: number;
  icon: string;
}

interface SettingsMenuProps {
  categoryConfigs: Record<string, CategoryConfig>;
  onCategoryConfigChange: (category: string, config: CategoryConfig) => void;
  angleRange: number;
  onAngleRangeChange: (angleRange: number) => void;
}

const predefinedColors = [
  '#B3D9FF', '#D4B3FF', '#FFB3B3', '#FFD4B3', '#B3FFB3', '#B3F0FF',
  '#E6B3FF', '#FFB3E6', '#B3FFE6', '#FFE6B3', '#B3E6FF', '#FFB3D4',
  '#D4FFB3', '#B3FFFF', '#FFE6B3', '#B3D4FF', '#FFB3B3', '#B3FFD4'
];

export default function SettingsMenu({ categoryConfigs, onCategoryConfigChange, angleRange, onAngleRangeChange }: SettingsMenuProps) {
  const [isExpanded, setIsExpanded] = useState(false);

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

  return (
    <div className="absolute top-4 right-32 z-[1001]">
      {/* Settings Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="bg-white/90 backdrop-blur-sm p-3 rounded-lg shadow-lg hover:bg-white transition-colors"
        title="Innstillinger"
      >
        <div className="w-6 h-6 flex items-center justify-center">
          ⚙️
        </div>
      </button>

      {/* Settings Panel */}
      {isExpanded && (
        <div className="absolute top-12 right-0 bg-white/95 backdrop-blur-sm p-4 rounded-lg shadow-lg min-w-[280px] max-h-[80vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Innstillinger</h3>
            <button
              onClick={() => setIsExpanded(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>

          {/* Angle Range Setting */}
          <div className="mb-4 pb-3 border-b border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">📐</span>
              <span className="font-medium text-gray-700">Vinkel-område</span>
            </div>
            <div>
              <label className="text-xs text-gray-600 block mb-1">
                Vinkel: ±{angleRange}° (totalt {angleRange * 2}°)
              </label>
              <input
                type="range"
                min="1"
                max="15"
                step="1"
                value={angleRange}
                onChange={(e) => onAngleRangeChange(parseInt(e.target.value))}
                className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer hover:bg-gray-300 transition-colors"
                style={{
                  background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(angleRange - 1) / 14 * 100}%, #e5e7eb ${(angleRange - 1) / 14 * 100}%, #e5e7eb 100%)`
                }}
              />
              <div className="text-xs text-gray-500 mt-1">
                Mindre vinkel = smalere slices, større vinkel = bredere slices
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {Object.entries(categoryConfigs).map(([category, config]) => (
              <div key={category} className="border-b border-gray-200 pb-3 last:border-b-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{config.icon}</span>
                  <span className="font-medium text-gray-700 capitalize">
                    {category.replace('_', ' ')}
                  </span>
                </div>

                {/* Color Picker */}
                <div className="mb-2">
                  <label className="text-xs text-gray-600 block mb-1">Farge:</label>
                  <div className="flex flex-wrap gap-1">
                    {predefinedColors.map((color) => (
                      <button
                        key={color}
                        onClick={() => handleColorChange(category, color)}
                        className={`w-6 h-6 rounded border-2 transition-all ${
                          config.color === color 
                            ? 'border-gray-800 scale-110' 
                            : 'border-gray-300 hover:border-gray-500'
                        }`}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                  <input
                    type="color"
                    value={config.color}
                    onChange={(e) => handleColorChange(category, e.target.value)}
                    className="mt-1 w-full h-8 rounded border border-gray-300 cursor-pointer"
                  />
                </div>

                {/* Opacity Slider */}
                <div>
                  <label className="text-xs text-gray-600 block mb-1">
                    Gjennomsiktighet: {Math.round(config.opacity * 100)}%
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.1"
                    value={config.opacity}
                    onChange={(e) => handleOpacityChange(category, parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer hover:bg-gray-300 transition-colors"
                    style={{
                      background: `linear-gradient(to right, ${config.color} 0%, ${config.color} ${config.opacity * 100}%, #e5e7eb ${config.opacity * 100}%, #e5e7eb 100%)`
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Reset Button */}
          <div className="mt-4 pt-3 border-t border-gray-200">
            <button
              onClick={() => {
                // Reset to default colors
                const defaultConfigs = {
                  city: { color: '#B3D9FF', opacity: 0.8, icon: '🏙️' },
                  town: { color: '#D4B3FF', opacity: 0.8, icon: '🏙️' },
                  village: { color: '#FFB3B3', opacity: 0.8, icon: '🏘️' },
                  hamlet: { color: '#FFD4B3', opacity: 0.8, icon: '🏘️' },
                  farm: { color: '#B3FFB3', opacity: 0.8, icon: '🏡' },
                  isolated_dwelling: { color: '#B3F0FF', opacity: 0.8, icon: '🏠' }
                };
                Object.entries(defaultConfigs).forEach(([category, config]) => {
                  onCategoryConfigChange(category, config);
                });
                onAngleRangeChange(5); // Reset angle range to default
              }}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded text-sm font-medium transition-colors"
            >
              Tilbakestill til standard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
