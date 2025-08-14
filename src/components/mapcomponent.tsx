'use client';

import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMap, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import PieChart from './piechart';
import SettingsMenu from './settingsmenu';

interface Position {
  lat: number;
  lng: number;
  heading?: number; // Compass heading in degrees (0-360)
}

interface PlaceData {
  id: number;
  type: string;
  lat: number;
  lng: number;
  name?: string;
  category: string;
  tags: Record<string, string>;
}

interface MapComponentProps {
  radius: number;
  onPositionChange?: (position: Position) => void;
  onError?: () => void;
  categoryFilters: CategoryFilter;
  categoryConfigs: Record<keyof CategoryFilter, CategoryConfig>;
  shouldScan?: boolean;
  onCategoryChange?: (category: keyof CategoryFilter) => void;
  onScanArea?: () => void;
  onRadiusChange?: (radius: number) => void;
  onCategoryConfigChange?: (category: string, config: CategoryConfig) => void;
  angleRange?: number;
  onAngleRangeChange?: (angleRange: number) => void;
  showMarkers?: boolean;
  onShowMarkersChange?: (show: boolean) => void;
  isLiveMode?: boolean;
  onLiveModeChange?: (isLive: boolean) => void;
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

// Component to handle map interactions
function MapController({ 
  onPositionChange, 
  radius, 
  onError, 
  categoryFilters, 
  categoryConfigs, 
  shouldScan,
  onPlacesChange,
  angleRange,
  showMarkers,
  isLiveMode = false,
  onLiveModeChange
}: { 
  onPositionChange?: (position: Position) => void; 
  radius: number;
  onError?: () => void;
  categoryFilters: CategoryFilter;
  categoryConfigs: Record<keyof CategoryFilter, CategoryConfig>;
  shouldScan?: boolean;
  onPlacesChange?: (places: PlaceData[]) => void;
  angleRange?: number;
  showMarkers?: boolean;
  isLiveMode?: boolean;
  onLiveModeChange?: (isLive: boolean) => void;
}) {
  const map = useMap();
  const [currentPosition, setCurrentPosition] = useState<Position>({ lat: 60.424834440433045, lng: 12.408766398367092 });
  const [places, setPlaces] = useState<PlaceData[]>([]);
  const [loading, setLoading] = useState(false);
  const [watchId, setWatchId] = useState<number | null>(null);
  const [compassId, setCompassId] = useState<number | null>(null);

  // Fix Leaflet icons when component mounts
  useEffect(() => {
    if (typeof window !== 'undefined' && typeof L !== 'undefined') {
      try {
        delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        });
      } catch (error) {
        console.warn('Could not fix Leaflet icons:', error);
      }
    }
  }, []);

  useEffect(() => {
    // Check if map and L are available
    if (!map || typeof L === 'undefined') {
      console.warn('Map or Leaflet not available yet');
      return;
    }

    try {
      // Handle map movement (pan/zoom) to update center position
      const handleMapMove = () => {
        const center = map.getCenter();
        const newPosition: Position = {
          lat: center.lat,
          lng: center.lng,
        };
        setCurrentPosition(newPosition);
        onPositionChange?.(newPosition); // Update parent component with center position
      };

      // Handle map clicks for manual position selection
      const handleMapClick = (e: L.LeafletMouseEvent) => {
        const pos: Position = {
          lat: e.latlng.lat,
          lng: e.latlng.lng,
        };
        setCurrentPosition(pos);
        onPositionChange?.(pos); // Update parent component when user clicks
        // Don't auto-zoom - let user control zoom level
      };

      map.on('moveend', handleMapMove);
      map.on('click', handleMapClick);

      return () => {
        map.off('moveend', handleMapMove);
        map.off('click', handleMapClick);
      };
    } catch (error) {
      console.error('Map controller error:', error);
      onError?.();
    }
  }, [map, onError, onPositionChange]);

  // GPS and Compass functionality
  useEffect(() => {
    // Start compass watching
    const handleCompass = (event: DeviceOrientationEvent) => {
      if (event.alpha !== null) {
        const heading = event.alpha;
        setCurrentPosition(prev => ({
          ...prev,
          heading
        }));
        onPositionChange?.({
          ...currentPosition,
          heading
        });
      }
    };

    if (!isLiveMode) {
      // Clean up watchers when live mode is disabled
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
        setWatchId(null);
      }
      if (compassId) {
        // Clean up compass if available
        if ('DeviceOrientationEvent' in window) {
          window.removeEventListener('deviceorientation', handleCompass);
        }
        setCompassId(null);
      }
      return;
    }

    // Start GPS watching
    if ('geolocation' in navigator) {
      const id = navigator.geolocation.watchPosition(
        (position) => {
          const newPosition: Position = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            heading: currentPosition.heading // Keep existing heading
          };
          setCurrentPosition(newPosition);
          onPositionChange?.(newPosition);
          
          // Center map on new position
          if (map) {
            map.setView([newPosition.lat, newPosition.lng], map.getZoom());
          }
        },
        (error) => {
          console.error('GPS error:', error);
          onError?.();
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 1000
        }
      );
      setWatchId(id);
    }

    if ('DeviceOrientationEvent' in window) {
      window.addEventListener('deviceorientation', handleCompass);
      setCompassId(1); // Just a flag to indicate compass is active
    }

    // Cleanup function
    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
      }
      if ('DeviceOrientationEvent' in window) {
        window.removeEventListener('deviceorientation', handleCompass);
      }
    };
  }, [isLiveMode, map, onPositionChange, onError, currentPosition]);

  // Fetch places when shouldScan is true or radius/category filters change
  useEffect(() => {
    if (!shouldScan) return; // Only fetch when scan is triggered

    const fetchPlaces = async () => {
      setLoading(true);
      try {
        console.log('Scanning area for radius:', radius, 'at position:', currentPosition);
        const response = await fetch(
          `/api/overpass?lat=${currentPosition.lat}&lng=${currentPosition.lng}&radius=${radius}`
        );
        
        if (response.ok) {
          const result = await response.json();
          console.log('Found places:', result.data?.length || 0);
          console.log('Places:', result.data?.map((p: PlaceData) => ({ name: p.name, category: p.category })) || []);
          const newPlaces = result.data || [];
          setPlaces(newPlaces);
          onPlacesChange?.(newPlaces);
        } else {
          console.error('Failed to fetch places');
          setPlaces([]);
        }
      } catch (error) {
        console.error('Error fetching places:', error);
        setPlaces([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPlaces();
  }, [shouldScan, radius, currentPosition, categoryFilters, onPlacesChange]);

  // Don't render anything if L is not available
  if (typeof L === 'undefined') {
    console.warn('Leaflet not available in MapController');
    return null;
  }

  // Don't render anything if map is not available
  if (!map) {
    console.warn('Map not available in MapController');
    return null;
  }

  return (
    <>
      {/* Center position marker - always at map center */}
      <Marker
        position={currentPosition}
        icon={L.divIcon({
          className: 'custom-marker selected-position',
          html: '<div style="width: 12px; height: 12px; background-color: #dc2626; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div>',
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        })}
      />
      
      {/* Radius circle */}
      <Circle
        key={`radius-${radius}-${currentPosition.lat}-${currentPosition.lng}`}
        center={currentPosition}
        radius={radius}
        pathOptions={{
          color: '#3b82f6',
          fillColor: '#3b82f6',
          fillOpacity: 0.1,
          weight: 2,
        }}
      />

      {/* Place markers */}
      {showMarkers && places
        .filter(place => {
          // Filter based on category filters
          if (place.category === 'city' && !categoryFilters.city) return false;
          if (place.category === 'town' && !categoryFilters.town) return false;
          if (place.category === 'village' && !categoryFilters.village) return false;
          if (place.category === 'hamlet' && !categoryFilters.hamlet) return false;
          if (place.category === 'farm' && !categoryFilters.farm) return false;
          if (place.category === 'isolated_dwelling' && !categoryFilters.isolated_dwelling) return false;
          return true;
        })
        .map((place) => {
          let config = categoryConfigs.village; // default
          
          // Get config based on category
          if (place.category === 'city') config = categoryConfigs.city;
          else if (place.category === 'town') config = categoryConfigs.town;
          else if (place.category === 'village') config = categoryConfigs.village;
          else if (place.category === 'hamlet') config = categoryConfigs.hamlet;
          else if (place.category === 'farm') config = categoryConfigs.farm;
          else if (place.category === 'isolated_dwelling') config = categoryConfigs.isolated_dwelling;

          // Convert hex to rgba for opacity - use half opacity for markers
          const hexToRgba = (hex: string, opacity: number) => {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            return `rgba(${r}, ${g}, ${b}, ${opacity * 0.5})`; // Half opacity for markers
          };

          return (
            <Marker
              key={`${place.type}-${place.id}`}
              position={[place.lat, place.lng]}
              icon={L.divIcon({
                className: 'custom-marker place-marker',
                html: `<div style="width: 12px; height: 12px; background-color: ${hexToRgba(config.color, config.opacity)}; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div>`,
                iconSize: [12, 12],
                iconAnchor: [6, 6],
              })}
            />
          );
        })}

      {/* Loading indicator */}
      {loading && (
        <div className="absolute top-4 right-4 bg-white p-2 rounded-lg shadow-lg">
          <div className="text-sm text-gray-600">Laster boliger...</div>
        </div>
      )}

      {/* Pie Chart slices - only show when there's data */}
      {places.length > 0 && (
        <PieChart 
          places={places.filter(place => {
            // Filter based on category filters for pie chart too
            if (place.category === 'city' && !categoryFilters.city) return false;
            if (place.category === 'town' && !categoryFilters.town) return false;
            if (place.category === 'village' && !categoryFilters.village) return false;
            if (place.category === 'hamlet' && !categoryFilters.hamlet) return false;
            if (place.category === 'farm' && !categoryFilters.farm) return false;
            if (place.category === 'isolated_dwelling' && !categoryFilters.isolated_dwelling) return false;
            return true;
          })}
          categoryConfigs={categoryConfigs}
          centerLat={currentPosition.lat}
          centerLng={currentPosition.lng}
          angleRange={angleRange ?? 5}
          radius={radius}
        />
      )}
    </>
  );
}

export default function MapComponent({ 
  radius, 
  onPositionChange, 
  onError, 
  categoryFilters, 
  categoryConfigs, 
  shouldScan,
  onCategoryChange,
  onScanArea,
  onRadiusChange,
  onCategoryConfigChange,
  angleRange = 5,
  onAngleRangeChange,
  showMarkers = true,
  onShowMarkersChange,
  isLiveMode = false,
  onLiveModeChange
}: MapComponentProps) {
  const [isLeafletLoaded, setIsLeafletLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [places, setPlaces] = useState<PlaceData[]>([]);
  const [, setCurrentPosition] = useState<Position>({ lat: 60.424834440433045, lng: 12.408766398367092 });
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const filterMenuRef = useRef<HTMLDivElement>(null);

  // Close filter menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: Event) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(event.target as Node)) {
        setIsFilterExpanded(false);
      }
    };

    if (isFilterExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isFilterExpanded]);

  useEffect(() => {
    // Ensure Leaflet is loaded
    const checkLeaflet = () => {
      try {
        if (typeof window !== 'undefined' && typeof L !== 'undefined') {
          setIsLeafletLoaded(true);
        } else {
          // Retry after a short delay
          setTimeout(checkLeaflet, 100);
        }
      } catch (error) {
        console.error('Error checking Leaflet:', error);
        setHasError(true);
        onError?.();
      }
    };
    
    checkLeaflet();
  }, [onError]);

  if (hasError) {
    return (
      <div className="w-full h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg text-red-600 mb-2">Feil ved lasting av kart</div>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Prøv igjen
          </button>
        </div>
      </div>
    );
  }

  if (!isLeafletLoaded) {
    return (
      <div className="w-full h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-lg">Laster kart-bibliotek...</div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen relative">
      <MapContainer
        center={[60.424834440433045, 12.408766398367092]} // New default position
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
        attributionControl={true}
      >
        {/* OpenStreetMap tiles for testing */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={18}
        />
        
        <MapController 
          onPositionChange={(pos) => {
            setCurrentPosition(pos);
            onPositionChange?.(pos);
          }} 
          radius={radius}
          onError={() => {
            setHasError(true);
            onError?.();
          }}
          categoryFilters={categoryFilters}
          categoryConfigs={categoryConfigs}
          shouldScan={shouldScan}
          onPlacesChange={setPlaces}
          angleRange={angleRange}
          showMarkers={showMarkers}
          isLiveMode={isLiveMode}
          onLiveModeChange={onLiveModeChange}
        />
      </MapContainer>

      {/* Center marker overlay - always visible in center */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-[1000]">
        <div className="w-4 h-4 bg-red-600 border-2 border-white rounded-full shadow-lg"></div>
      </div>

      {/* Settings Menu */}
      <SettingsMenu 
        categoryConfigs={categoryConfigs}
        onCategoryConfigChange={onCategoryConfigChange || (() => {})}
        angleRange={angleRange}
        onAngleRangeChange={onAngleRangeChange || (() => {})}
      />

      {/* Filter controls on right side */}
      <div ref={filterMenuRef} className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg z-[1000] max-w-xs">
        {/* Filter Header with Expand/Collapse */}
        <div className="p-3 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-700">Filtrer & Kontroller</div>
            <button
              onClick={() => setIsFilterExpanded(!isFilterExpanded)}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              {isFilterExpanded ? '▼' : '▶'}
            </button>
          </div>
        </div>
        
        {/* Expandable Filter Content */}
        {isFilterExpanded && (
          <div className="p-3 border-b border-gray-200">
            {/* Radius Control */}
            <div className="mb-3">
              <label className="text-xs font-medium text-gray-700 block mb-1">
                Radius: {radius}m
              </label>
              <input
                type="range"
                min="1000"
                max="4000"
                step="500"
                value={radius}
                onChange={(e) => {
                  onRadiusChange?.(Number(e.target.value));
                }}
                className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer hover:bg-gray-300 transition-colors"
                style={{
                  background: 'linear-gradient(to right, #3b82f6 0%, #3b82f6 ' + ((radius - 1000) / 3000 * 100) + '%, #e5e7eb ' + ((radius - 1000) / 3000 * 100) + '%, #e5e7eb 100%)'
                }}
              />
            </div>

            {/* Global Opacity Control */}
            <div className="mb-3">
              <label className="text-xs font-medium text-gray-700 block mb-1">
                Gjennomsiktighet: {Math.round((categoryConfigs.city?.opacity || 1.0) * 100)}%
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={categoryConfigs.city?.opacity || 1.0}
                onChange={(e) => {
                  const newOpacity = parseFloat(e.target.value);
                  // Apply to all categories
                  Object.keys(categoryConfigs).forEach(category => {
                    const currentConfig = categoryConfigs[category as keyof CategoryFilter];
                    onCategoryConfigChange?.(category as keyof CategoryFilter, {
                      ...currentConfig,
                      opacity: newOpacity
                    });
                  });
                }}
                className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer hover:bg-gray-300 transition-colors"
                style={{
                  background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(categoryConfigs.city?.opacity || 1.0) * 100}%, #e5e7eb ${(categoryConfigs.city?.opacity || 1.0) * 100}%, #e5e7eb 100%)`
                }}
              />
            </div>

                         {/* Category Filters */}
             <div className="mb-3">
               <div className="text-xs font-medium text-gray-700 mb-2">Filtrer:</div>
               <div className="space-y-1">
                 {Object.entries(categoryConfigs).map(([category, config]) => (
                   <label key={category} className="flex items-center gap-2 cursor-pointer text-xs bg-gray-50 px-2 py-1 rounded border hover:bg-gray-100 transition-colors">
                     <input
                       type="checkbox"
                       checked={categoryFilters[category as keyof CategoryFilter]}
                       onChange={() => onCategoryChange?.(category as keyof CategoryFilter)}
                       className="w-3 h-3 text-blue-600 rounded focus:ring-blue-500"
                     />
                     <span 
                       className="font-medium"
                       style={{ color: config.color }}
                     >
                       {category === 'city' && 'By'}
                       {category === 'town' && 'Tettsted'}
                       {category === 'village' && 'Landsby'}
                       {category === 'hamlet' && 'Grend'}
                       {category === 'farm' && 'Gård'}
                       {category === 'isolated_dwelling' && 'Enkeltbolig'}
                     </span>
                   </label>
                 ))}
               </div>
             </div>

             {/* Show Markers Setting */}
             <div className="mb-3">
               <div className="text-xs font-medium text-gray-700 mb-2">Visning:</div>
               <label className="flex items-center gap-2 cursor-pointer text-xs bg-gray-50 px-2 py-1 rounded border hover:bg-gray-100 transition-colors">
                 <input
                   type="checkbox"
                   checked={showMarkers}
                   onChange={(e) => onShowMarkersChange?.(e.target.checked)}
                   className="w-3 h-3 text-blue-600 rounded focus:ring-blue-500"
                 />
                 <span className="font-medium text-gray-700">
                   Vis treff i kart
                 </span>
               </label>
             </div>

             {/* Live Position Setting */}
             <div className="mb-3">
               <div className="text-xs font-medium text-gray-700 mb-2">Live:</div>
               <label className="flex items-center gap-2 cursor-pointer text-xs bg-gray-50 px-2 py-1 rounded border hover:bg-gray-100 transition-colors">
                 <input
                   type="checkbox"
                   checked={isLiveMode}
                   onChange={(e) => onLiveModeChange?.(e.target.checked)}
                   className="w-3 h-3 text-blue-600 rounded focus:ring-blue-500"
                 />
                 <span className="font-medium text-gray-700">
                   Live GPS & Kompass
                 </span>
               </label>
             </div>

          </div>
        )}

        {/* Live Pos Button - Always Visible */}
        <div className="p-3 border-b border-gray-200">
          <button
            onClick={() => onLiveModeChange?.(!isLiveMode)}
            className={`w-full px-3 py-2 rounded text-sm font-medium transition-colors shadow-sm ${
              isLiveMode 
                ? 'bg-green-600 hover:bg-green-700 text-white' 
                : 'bg-gray-600 hover:bg-gray-700 text-white'
            }`}
          >
            {isLiveMode ? '📍 Live Pos (ON)' : '📍 Live Pos'}
          </button>
        </div>

        {/* Scan Button - Always Visible */}
        <div className="p-3">
          <button
            onClick={onScanArea}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm font-medium transition-colors shadow-sm"
          >
            🔍 Scan område
          </button>
        </div>
      </div>
    </div>
  );
}
