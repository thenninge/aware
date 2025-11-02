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
  showShots?: boolean;
  onShowShotsChange?: (v: boolean) => void;
  showTracks?: boolean;
  onShowTracksChange?: (v: boolean) => void;
  showHuntingBoundary?: boolean;
  onShowHuntingBoundaryChange?: (v: boolean) => void;
}

const categoryLabels: Record<keyof CategoryFilter, string> = {
  city: 'By',
  town: 'Tettsted',
  village: 'Landsby',
  hamlet: 'Grend',
  farm: 'Gård',
  isolated_dwelling: 'Enkeltbolig',
};

export default function FilterMenu({ categoryFilters, onCategoryChange, radius, onRadiusChange, showMarkers, onShowMarkersChange, orientationMode, onOrientationModeChange, categoryConfigs, showOnlyLastShot, onShowOnlyLastShotChange, mode, showAllTracksAndFinds, onShowAllTracksAndFindsChange, showObservations, onShowObservationsChange, showShots, onShowShotsChange, showTracks, onShowTracksChange, showHuntingBoundary, onShowHuntingBoundaryChange }: FilterMenuProps) {
  return (
    <div className="bg-white rounded-lg shadow-lg p-4 min-w-[220px] max-w-xs">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold text-gray-800">Quick filters</h3>
      </div>
      
      {/* Radius Control - kun i Aware-mode */}
      {mode === 'aware' && (
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
      )}
      
      {/* Aware-mode specific filters */}
      {mode === 'aware' && (
        <>
          {/* Vis skuddpar */}
          {showShots !== undefined && onShowShotsChange && (
            <div className="mb-3">
              <label className="flex items-center gap-2 cursor-pointer text-xs bg-gray-50 px-2 py-1 rounded border hover:bg-gray-100 transition-colors">
                <input
                  type="checkbox"
                  checked={showShots}
                  onChange={e => onShowShotsChange(e.target.checked)}
                  className="w-3 h-3 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="font-medium text-gray-700">
                  Vis skuddpar
                </span>
              </label>
            </div>
          )}
          
          {/* Vis søkespor */}
          {showTracks !== undefined && onShowTracksChange && (
            <div className="mb-3">
              <label className="flex items-center gap-2 cursor-pointer text-xs bg-gray-50 px-2 py-1 rounded border hover:bg-gray-100 transition-colors">
                <input
                  type="checkbox"
                  checked={showTracks}
                  onChange={e => onShowTracksChange(e.target.checked)}
                  className="w-3 h-3 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="font-medium text-gray-700">
                  Vis søkespor
                </span>
              </label>
            </div>
          )}
          
          {/* Vis observasjoner */}
          {showObservations !== undefined && onShowObservationsChange && (
            <div className="mb-3">
              <label className="flex items-center gap-2 cursor-pointer text-xs bg-gray-50 px-2 py-1 rounded border hover:bg-gray-100 transition-colors">
                <input
                  type="checkbox"
                  checked={showObservations}
                  onChange={e => onShowObservationsChange(e.target.checked)}
                  className="w-3 h-3 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="font-medium text-gray-700">
                  Vis observasjoner
                </span>
              </label>
            </div>
          )}
          
          {/* Jaktgrenser */}
          {showHuntingBoundary !== undefined && onShowHuntingBoundaryChange && (
            <div className="mb-3">
              <label className="flex items-center gap-2 cursor-pointer text-xs bg-gray-50 px-2 py-1 rounded border hover:bg-gray-100 transition-colors">
                <input
                  type="checkbox"
                  checked={showHuntingBoundary}
                  onChange={e => onShowHuntingBoundaryChange(e.target.checked)}
                  className="w-3 h-3 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="font-medium text-gray-700">
                  Jaktgrenser
                </span>
              </label>
            </div>
          )}
        </>
      )}
      
      {/* Shoot-mode (track) specific filters */}
      {mode === 'track' && (
        <>
          {/* Radio buttons for skuddpar visning */}
          {onShowOnlyLastShotChange && (
            <div className="mb-3">
              <div className="text-xs font-medium text-gray-700 mb-2">Skuddpar:</div>
              <div className="space-y-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs bg-gray-50 px-2 py-1 rounded border hover:bg-gray-100 transition-colors">
                  <input
                    type="radio"
                    name="shotDisplay"
                    checked={!showOnlyLastShot}
                    onChange={() => onShowOnlyLastShotChange(false)}
                    className="w-3 h-3 text-blue-600"
                  />
                  <span className="font-medium text-gray-700">
                    Vis alle skuddpar
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs bg-gray-50 px-2 py-1 rounded border hover:bg-gray-100 transition-colors">
                  <input
                    type="radio"
                    name="shotDisplay"
                    checked={!!showOnlyLastShot}
                    onChange={() => onShowOnlyLastShotChange(true)}
                    className="w-3 h-3 text-blue-600"
                  />
                  <span className="font-medium text-gray-700">
                    Vis kun siste skuddpar
                  </span>
                </label>
              </div>
            </div>
          )}
          
          {/* Vis søkespor */}
          {showTracks !== undefined && onShowTracksChange && (
            <div className="mb-3">
              <label className="flex items-center gap-2 cursor-pointer text-xs bg-gray-50 px-2 py-1 rounded border hover:bg-gray-100 transition-colors">
                <input
                  type="checkbox"
                  checked={showTracks}
                  onChange={e => onShowTracksChange(e.target.checked)}
                  className="w-3 h-3 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="font-medium text-gray-700">
                  Vis søkespor
                </span>
              </label>
            </div>
          )}
          
          {/* Vis observasjoner */}
          {showObservations !== undefined && onShowObservationsChange && (
            <div className="mb-3">
              <label className="flex items-center gap-2 cursor-pointer text-xs bg-gray-50 px-2 py-1 rounded border hover:bg-gray-100 transition-colors">
                <input
                  type="checkbox"
                  checked={showObservations}
                  onChange={e => onShowObservationsChange(e.target.checked)}
                  className="w-3 h-3 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="font-medium text-gray-700">
                  Vis observasjoner
                </span>
              </label>
            </div>
          )}
          
          {/* Jaktgrenser */}
          {showHuntingBoundary !== undefined && onShowHuntingBoundaryChange && (
            <div className="mb-3">
              <label className="flex items-center gap-2 cursor-pointer text-xs bg-gray-50 px-2 py-1 rounded border hover:bg-gray-100 transition-colors">
                <input
                  type="checkbox"
                  checked={showHuntingBoundary}
                  onChange={e => onShowHuntingBoundaryChange(e.target.checked)}
                  className="w-3 h-3 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="font-medium text-gray-700">
                  Jaktgrenser
                </span>
              </label>
            </div>
          )}
        </>
      )}
      
      {/* Track-mode (søk) specific filters */}
      {mode === 'søk' && (
        <>
          {/* Vis skuddpar */}
          {showShots !== undefined && onShowShotsChange && (
            <div className="mb-3">
              <label className="flex items-center gap-2 cursor-pointer text-xs bg-gray-50 px-2 py-1 rounded border hover:bg-gray-100 transition-colors">
                <input
                  type="checkbox"
                  checked={showShots}
                  onChange={e => onShowShotsChange(e.target.checked)}
                  className="w-3 h-3 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="font-medium text-gray-700">
                  Vis skuddpar
                </span>
              </label>
            </div>
          )}
        </>
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
      
      {/* Jaktgrenser i søk-modus */}
      {mode === 'søk' && showHuntingBoundary !== undefined && onShowHuntingBoundaryChange && (
        <div className="mb-3">
          <label className="flex items-center gap-2 cursor-pointer text-xs bg-gray-50 px-2 py-1 rounded border hover:bg-gray-100 transition-colors">
            <input
              type="checkbox"
              checked={showHuntingBoundary}
              onChange={e => onShowHuntingBoundaryChange(e.target.checked)}
              className="w-3 h-3 text-blue-600 rounded focus:ring-blue-500"
            />
            <span className="font-medium text-gray-700">
              Jaktgrenser
            </span>
          </label>
        </div>
      )}
    </div>
  );
}
