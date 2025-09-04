import React from 'react';

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

interface FilterMenuProps {
  categoryFilters: CategoryFilter;
  onCategoryChange: (category: keyof CategoryFilter) => void;
  radius: number;
  onRadiusChange: (radius: number) => void;
  showMarkers: boolean;
  onShowMarkersChange: (show: boolean) => void;
  orientationMode: 'north' | 'heading';
  onOrientationModeChange: (mode: 'north' | 'heading') => void;
  categoryConfigs: Record<keyof CategoryFilter, CategoryConfig>;
  showOnlyLastShot?: boolean;
  onShowOnlyLastShotChange?: (v: boolean) => void;
  mode?: 'aware' | 'track' | 'søk';
  showAllTracksAndFinds?: boolean;
  onShowAllTracksAndFindsChange?: (v: boolean) => void;
  showObservations?: boolean;
  onShowObservationsChange?: (v: boolean) => void;
}

const categoryLabels: Record<keyof CategoryFilter, string> = {
  city: 'By',
  town: 'Tettsted',
  village: 'Landsby',
  hamlet: 'Grend',
  farm: 'Gård',
  isolated_dwelling: 'Enkeltbolig',
};

export default function FilterMenu({ categoryFilters, onCategoryChange, radius, onRadiusChange, showMarkers, onShowMarkersChange, orientationMode, onOrientationModeChange, categoryConfigs, showOnlyLastShot, onShowOnlyLastShotChange, mode, showAllTracksAndFinds, onShowAllTracksAndFindsChange, showObservations, onShowObservationsChange }: FilterMenuProps) {
  return (
    <div className="bg-white rounded-lg shadow-lg p-4 min-w-[220px] max-w-xs">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold text-gray-800">Filter</h3>
      </div>
      {/* Radius Control */}
      <div className="mb-3">
        <label className="text-xs font-medium text-gray-700 block mb-1">
          Radius: {radius}m
        </label>
        <input
          type="range"
          min={1000}
          max={4000}
          step={500}
          value={radius}
          onChange={e => onRadiusChange(Number(e.target.value))}
          className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer hover:bg-gray-300 transition-colors"
          style={{
            background: 'linear-gradient(to right, #3b82f6 0%, #3b82f6 ' + ((radius - 1000) / 3000 * 100) + '%, #e5e7eb ' + ((radius - 1000) / 3000 * 100) + '%, #e5e7eb 100%)'
          }}
        />
      </div>
      {/* Vis treff i kart */}
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
      {/* Vis kun siste skuddpar - skjul i søk-modus */}
      {onShowOnlyLastShotChange && mode !== 'søk' && (
        <div className="mb-3">
          <label className="flex items-center gap-2 cursor-pointer text-xs bg-gray-50 px-2 py-1 rounded border hover:bg-gray-100 transition-colors">
            <input
              type="checkbox"
              checked={!!showOnlyLastShot}
              onChange={e => onShowOnlyLastShotChange(e.target.checked)}
              className="w-3 h-3 text-blue-600 rounded focus:ring-blue-500"
            />
            <span className="font-medium text-gray-700">
              Vis kun siste skuddpar
            </span>
          </label>
        </div>
      )}
      
      {/* Info i søk-modus */}
      {mode === 'søk' && (
        <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded">
          <div className="text-xs text-blue-700 font-medium">
            Søk-modus aktiv
          </div>
          <div className="text-xs text-blue-600">
            Viser valgt skuddpar automatisk
          </div>
        </div>
      )}
      
      {/* Vis alle søk-spor og funn i søk-modus */}
      {mode === 'søk' && onShowAllTracksAndFindsChange && (
        <div className="mb-3">
          <label className="flex items-center gap-2 cursor-pointer text-xs bg-gray-50 px-2 py-1 rounded border hover:bg-gray-100 transition-colors">
            <input
              type="checkbox"
              checked={!!showAllTracksAndFinds}
              onChange={e => onShowAllTracksAndFindsChange(e.target.checked)}
              className="w-3 h-3 text-blue-600 rounded focus:ring-blue-500"
            />
            <span className="font-medium text-gray-700">
              Vis alle søk-spor og funn
            </span>
          </label>
        </div>
      )}
      
      {/* Vis observasjoner i søk-modus */}
      {mode === 'søk' && onShowObservationsChange && (
        <div className="mb-3">
          <label className="flex items-center gap-2 cursor-pointer text-xs bg-gray-50 px-2 py-1 rounded border hover:bg-gray-100 transition-colors">
            <input
              type="checkbox"
              checked={!!showObservations}
              onChange={e => onShowObservationsChange(e.target.checked)}
              className="w-3 h-3 text-blue-600 rounded focus:ring-blue-500"
            />
            <span className="font-medium text-gray-700">
              Vis observasjoner
            </span>
          </label>
        </div>
      )}
      {/* Kategori-filter */}
      <div className="mb-3">
        <div className="text-xs font-medium text-gray-700 mb-2">Filtrer:</div>
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
      {/* Nord opp / Retning opp switch */}
      <div className="mt-4 flex items-center justify-between bg-gray-50 px-2 py-2 rounded border">
        <span className="text-xs font-medium text-gray-700">Nord opp</span>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={orientationMode === 'heading'}
            onChange={e => onOrientationModeChange(e.target.checked ? 'heading' : 'north')}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:bg-blue-600 transition-colors"></div>
          <span className="ml-2 text-xs text-gray-700">Retning opp</span>
        </label>
      </div>
    </div>
  );
}
