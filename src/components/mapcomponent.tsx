'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMap, Circle, Polyline, Polygon, Tooltip, Popup, LayersControl } from 'react-leaflet';
import L from 'leaflet';
import MSRRetikkel from './msr-retikkel';
import 'leaflet/dist/leaflet.css';
import React from 'react';
import PieChart from './piechart';
import SettingsMenu, { HuntingArea } from './settingsmenu';
// Database operations now go through Next.js API routes
import { Dialog } from '@headlessui/react';
import { createPortal } from 'react-dom';
import { useCompass } from '@/hooks/useCompass';

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
  mode?: 'aware' | 'track' | 'søk'; // <-- NY
  showOnlyLastShot?: boolean;
  isTracking?: boolean;
  onTrackingChange?: (isTracking: boolean) => void;
  activeTeam?: string | null;
  trackingPoints?: Position[];
  onTrackingPointsChange?: (points: Position[]) => void;
  showMSRRetikkel?: boolean;
  msrRetikkelOpacity?: number;
  msrRetikkelStyle?: 'msr' | 'ivar';
  msrRetikkelVerticalPosition?: number;
  selectedTargetIndex?: number;
  onPreviousTarget?: () => void;
  onNextTarget?: () => void;
  onSelectedTargetIndexChange?: (index: number) => void;
  showAllTracksAndFinds?: boolean;
  showObservations?: boolean;
  showShots?: boolean;
  showTracks?: boolean;
  targetSize?: number;
  shotSize?: number;
  observationSize?: number;
  targetLineColor?: string;
  shotColor?: string;
  targetColor?: string;
  targetLineWeight?: number;
  showHuntingBoundary?: boolean;
  huntingAreas?: HuntingArea[];
  activeHuntingAreaId?: string | null;
  huntingBoundaryColor?: string;
  huntingBoundaryWeight?: number;
  huntingBoundaryOpacity?: number;
  isDefiningHuntingArea?: boolean;
  onHuntingAreaDefined?: (area: HuntingArea) => void;
  onCancelHuntingAreaDefinition?: () => void;
  onRefreshHuntingAreas?: () => void;
  onRegisterSync?: (syncFn: () => void) => void;
  compassSliceLength?: number; // % of screen height
  compassMode?: 'off' | 'on';
  isCompassLocked?: boolean;
  onCompassModeChange?: (mode: 'off' | 'on') => void;
  onCompassLockedChange?: (locked: boolean) => void;
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
  angleRange,
  showMarkers,
  isLiveMode = false,
  onLoadingChange,
  mode = 'aware', // <-- NY
  showOnlyLastShot = false,
  onSearchPositionChange,
  onPlacesChange,
  clearPlaces,
  onGpsPositionChange,
  isMapLocked = false,
}: { 
  onPositionChange?: (position: Position) => void; 
  radius: number;
  onError?: () => void;
  categoryFilters: CategoryFilter;
  categoryConfigs: Record<keyof CategoryFilter, CategoryConfig>;
  shouldScan?: boolean;
  angleRange?: number;
  showMarkers?: boolean;
  isLiveMode?: boolean;
  onLoadingChange?: (loading: boolean) => void;
  mode?: 'aware' | 'track' | 'søk'; // <-- NY
  showOnlyLastShot?: boolean;
  onSearchPositionChange?: (position: Position) => void;
  onPlacesChange?: (places: PlaceData[]) => void;
  clearPlaces?: boolean;
  onGpsPositionChange?: (position: Position) => void;
  isMapLocked?: boolean;
}) {
  const map = useMap();
  const [currentPosition, setCurrentPosition] = useState<Position>({ lat: 60.424834440433045, lng: 12.408766398367092 });
  const [gpsPosition, setGpsPosition] = useState<Position | null>(null); // Separate GPS position
  const [searchPosition, setSearchPosition] = useState<Position | null>(null);
  const [places, setPlaces] = useState<PlaceData[]>([]);
  const [loading, setLoading] = useState(false);
  const [watchId, setWatchId] = useState<number | null>(null);

  // Fix Leaflet icons when component mounts
  useEffect(() => {
    if (typeof window !== 'undefined' && typeof L !== 'undefined') {
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        });
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
        if (isMapLocked) return; // Don't update position when map is locked
        
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
        if (isMapLocked) return; // Don't allow clicks when map is locked
        
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
  }, [map, onError, onPositionChange, isMapLocked]);


  // GPS functionality
  useEffect(() => {
    if (!isLiveMode) {
      // Clean up watchers when live mode is disabled
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
        setWatchId(null);
      }
      return;
    }

    // Start GPS watching
    if ('geolocation' in navigator) {
      const id = navigator.geolocation.watchPosition(
        (position) => {
          const newGpsPosition: Position = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
            heading: currentPosition.heading || undefined // Keep existing heading from compass
          };
          
          // Update GPS position separately
          setGpsPosition(newGpsPosition);
          onGpsPositionChange?.(newGpsPosition);
          
          // Update current position (used for map center and other UI)
          setCurrentPosition(newGpsPosition);
          onPositionChange?.(newGpsPosition);
          
          // Auto-center map on GPS position only when map is locked
          if (isMapLocked && map) {
            map.setView([newGpsPosition.lat, newGpsPosition.lng], map.getZoom());
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

    // Cleanup function
    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [isLiveMode, map, onPositionChange, onError, currentPosition, isMapLocked]);

  // Clear places when clearPlaces prop changes
  useEffect(() => {
    if (clearPlaces) {
      setPlaces([]);
      onPlacesChange?.([]);
    }
  }, [clearPlaces, onPlacesChange]);

  // Fetch places when shouldScan is true or radius/category filters change
  useEffect(() => {
    if (!shouldScan) return; // Only fetch when scan is triggered

    // Set the search position to current position when scan is triggered
    const searchPos = currentPosition;
    setSearchPosition(searchPos);
    onSearchPositionChange?.(searchPos);

    const fetchPlaces = async () => {
      setLoading(true);
      onLoadingChange?.(true);
      try {
        console.log('Scanning area for radius:', radius, 'at position:', searchPos);
        const response = await fetch(
          `/api/overpass?lat=${searchPos.lat}&lng=${searchPos.lng}&radius=${radius}`
        );
        
        if (response.ok) {
          const result = await response.json();
          console.log('Found places:', Array.isArray(result.data) ? result.data.length : 0);
          console.log('Places:', result.data?.map((p: PlaceData) => ({ name: p.name, category: p.category })) || []);
          const newPlaces = Array.isArray(result.data) ? result.data : [];
          setPlaces(newPlaces);
          onPlacesChange?.(newPlaces);
        } else {
          console.error('Failed to fetch places');
          setPlaces([]);
          onPlacesChange?.([]);
        }
      } catch (error) {
        console.error('Error fetching places:', error);
        setPlaces([]);
        onPlacesChange?.([]);
      } finally {
        setLoading(false);
        onLoadingChange?.(false);
      }
    };

    fetchPlaces();
  }, [shouldScan, radius, categoryFilters, onLoadingChange]);

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
      {/* <Circle
        key={`radius-${radius}-${currentPosition.lat}-${currentPosition.lng}`}
        center={currentPosition}
        radius={radius}
        pathOptions={{
          color: '#3b82f6',
          fillColor: '#3b82f6',
          fillOpacity: 0.1,
          weight: 2,
        }}
      /> */}

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

      {/* Pie Chart slices - only show in aware-mode */}
      {mode === 'aware' && Array.isArray(places) && places.length > 0 && searchPosition && (
        <PieChart 
          places={places}
          categoryConfigs={categoryConfigs}
          categoryFilters={categoryFilters}
          centerLat={searchPosition.lat}
          centerLng={searchPosition.lng}
          angleRange={angleRange ?? 5}
          radius={radius}
        />
      )}
    </>
  );
}

// Component to show compass direction as a red pie slice (fixed screen pixels)
function CompassSlice({ 
  heading, 
  isActive,
  isLocked,
  centerLat,
  centerLng,
  lengthPercent = 30, // % of screen height
  angleRange = 1, // ± degrees (total 2 degree slice - narrow arrow)
}: { 
  heading: number | null; 
  isActive: boolean;
  isLocked: boolean;
  centerLat: number;
  centerLng: number;
  lengthPercent?: number;
  angleRange?: number;
}) {
  const map = useMap();
  const [radiusMeters, setRadiusMeters] = useState(100);

  // Calculate radius in meters based on screen height and zoom
  useEffect(() => {
    if (!map) return;

    const updateRadius = () => {
      const screenHeight = window.innerHeight;
      const sliceLengthPixels = (lengthPercent / 100) * screenHeight;
      
      // Get current zoom and center
      const zoom = map.getZoom();
      const center = map.getCenter();
      
      // Calculate meters per pixel at current zoom
      const metersPerPixel = 156543.03392 * Math.cos(center.lat * Math.PI / 180) / Math.pow(2, zoom);
      
      // Convert pixels to meters
      const meters = sliceLengthPixels * metersPerPixel;
      setRadiusMeters(meters);
    };

    updateRadius();

    // Update on zoom or move
    map.on('zoomend', updateRadius);
    map.on('moveend', updateRadius);
    window.addEventListener('resize', updateRadius);

    return () => {
      map.off('zoomend', updateRadius);
      map.off('moveend', updateRadius);
      window.removeEventListener('resize', updateRadius);
    };
  }, [map, lengthPercent]);

  console.log('[CompassSlice] Render check:', { isActive, heading, isLocked, centerLat, centerLng });
  
  if (!isActive || heading === null) {
    console.log('[CompassSlice] Not rendering - isActive:', isActive, 'heading:', heading);
    return null;
  }

  // If locked: slice points up (north), if unlocked: slice points at heading
  const direction = isLocked ? 0 : heading;

  // Calculate arc points for the pie slice
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const startAngle = direction - angleRange;
  const endAngle = direction + angleRange;

  const points: [number, number][] = [[centerLat, centerLng]];

  // Generate arc edge points
  for (let angle = startAngle; angle <= endAngle; angle += 2) {
    const rad = toRad(angle);
    const lat = centerLat + (radiusMeters * Math.cos(rad)) / 111000;
    const lng = centerLng + (radiusMeters * Math.sin(rad)) / (111000 * Math.cos(toRad(centerLat)));
    points.push([lat, lng]);
  }

  // Close the slice back to center
  points.push([centerLat, centerLng]);

  return (
    <Polygon
      positions={points}
      pathOptions={{
        fillColor: '#ef4444',
        fillOpacity: 0.4,
        color: '#ef4444',
        weight: 2,
        opacity: 0.8,
      }}
    />
  );
}

// Component to rotate map based on compass heading
function MapRotator({ 
  heading, 
  isEnabled 
}: { 
  heading: number | null; 
  isEnabled: boolean; 
}) {
  const map = useMap();

  useEffect(() => {
    if (!isEnabled || heading === null || !map) return;

    const container = map.getContainer();
    const rotation = -heading; // Negative because we rotate counter-clockwise

    // Apply rotation to map container
    container.style.transform = `rotate(${rotation}deg)`;
    container.style.transformOrigin = 'center center';
    container.style.transition = 'transform 0.1s linear';
    
    return () => {
      // Reset rotation when disabled
      container.style.transform = '';
      container.style.transition = '';
    };
  }, [map, heading, isEnabled]);

  return null;
}

// Component to handle hunting area definition clicks
function HuntingAreaClickHandler({
  isDefiningHuntingArea,
  onPointAdded,
}: {
  isDefiningHuntingArea: boolean;
  onPointAdded: (lat: number, lng: number) => void;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map || !isDefiningHuntingArea) return;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      onPointAdded(e.latlng.lat, e.latlng.lng);
    };

    map.on('click', handleMapClick);

    return () => {
      map.off('click', handleMapClick);
    };
  }, [map, isDefiningHuntingArea, onPointAdded]);

  return null;
}

// Component to handle tracking in søk-modus
function TrackingController({ 
  isTracking, 
  mode, 
  onTrackingPointsChange, 
  currentPosition,
  gpsPosition,
  isLiveMode = false
}: { 
  isTracking: boolean; 
  mode: string; 
  onTrackingPointsChange: (points: Position[]) => void; 
  currentPosition?: Position; 
  gpsPosition?: Position | null;
  isLiveMode?: boolean;
}) {
  const map = useMap();
  const [localTrackingPoints, setLocalTrackingPoints] = useState<Position[]>([]);
  const [lastGpsPosition, setLastGpsPosition] = useState<Position | null>(null);

  // Helper function to calculate distance between two positions
  const calculateDistance = (pos1: Position, pos2: Position): number => {
    const R = 6371000; // Earth's radius in meters
    const dLat = (pos2.lat - pos1.lat) * Math.PI / 180;
    const dLng = (pos2.lng - pos1.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(pos1.lat * Math.PI / 180) * Math.cos(pos2.lat * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // GPS-based tracking when GPS is enabled
  useEffect(() => {
    if (!isTracking || mode !== 'søk' || !isLiveMode || !gpsPosition) return;

    // Only track if we have moved at least 5 meters from last position
    if (lastGpsPosition) {
      const distance = calculateDistance(lastGpsPosition, gpsPosition);
      if (distance < 5) {
        return; // Don't track if less than 5 meters
      }
    }

    // Add new GPS position to tracking
    const newPosition: Position = {
      lat: gpsPosition.lat,
      lng: gpsPosition.lng,
      heading: gpsPosition.heading
    };
    
    const updatedPoints = [...localTrackingPoints, newPosition];
    setLocalTrackingPoints(updatedPoints);
    setLastGpsPosition(newPosition);
    onTrackingPointsChange(updatedPoints);
    
    console.log('GPS tracking point added:', newPosition, 'Distance from last:', lastGpsPosition ? calculateDistance(lastGpsPosition, newPosition) : 0);
  }, [gpsPosition, isTracking, mode, isLiveMode, lastGpsPosition, localTrackingPoints, onTrackingPointsChange]);

  // Map-based tracking when GPS is disabled (for lab testing)
  useEffect(() => {
    if (!map || !isTracking || mode !== 'søk' || isLiveMode) return;

    // Event listener for kartbevegelse - logg posisjon når kartet stopper å bevege seg
    const handleMapMoveEnd = () => {
      const center = map.getCenter();
      const newPosition: Position = {
        lat: center.lat,
        lng: center.lng,
        heading: currentPosition?.heading
      };
      const updatedPoints = [...localTrackingPoints, newPosition];
      setLocalTrackingPoints(updatedPoints);
      onTrackingPointsChange(updatedPoints);
    };

    map.on('moveend', handleMapMoveEnd);

    return () => {
      map.off('moveend', handleMapMoveEnd);
    };
  }, [map, isTracking, mode, isLiveMode, onTrackingPointsChange, currentPosition, localTrackingPoints]);

  // Reset local points when tracking starts
  useEffect(() => {
    if (isTracking && mode === 'søk') {
      setLocalTrackingPoints([]);
      setLastGpsPosition(null);
    }
  }, [isTracking, mode]);

  return null; // Denne komponenten renderer ingenting, bare håndterer events
}





// Hjelpefunksjon for å kalkulere ny posisjon ut fra avstand og retning
function destinationPoint(lat: number, lng: number, distance: number, bearing: number): Position {
  const R = 6371000; // Jordradius i meter
  const δ = distance / R; // angular distance in radians
  const θ = (bearing * Math.PI) / 180; // bearing in radians
  const φ1 = (lat * Math.PI) / 180;
  const λ1 = (lng * Math.PI) / 180;
  const φ2 = Math.asin(
    Math.sin(φ1) * Math.cos(δ) +
      Math.cos(φ1) * Math.sin(δ) * Math.cos(θ)
  );
  const λ2 =
    λ1 +
    Math.atan2(
      Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
      Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2)
    );
  return {
    lat: (φ2 * 180) / Math.PI,
    lng: (λ2 * 180) / Math.PI,
  };
}

// Hjelpefunksjon for å finne punkt X meter fra A mot B
function pointTowards(from: Position, to: Position, distanceFromTo: number) {
  const R = 6371000;
  const d = Math.sqrt(
    Math.pow((to.lat - from.lat) * Math.PI / 180 * R, 2) +
    Math.pow((to.lng - from.lng) * Math.PI / 180 * R * Math.cos((from.lat + to.lat) * Math.PI / 360), 2)
  );
  if (d === 0 || distanceFromTo >= d) return { ...to };
  const ratio = (d - distanceFromTo) / d;
  return {
    lat: from.lat + (to.lat - from.lat) * ratio,
    lng: from.lng + (to.lng - from.lng) * ratio,
  };
}

// Ny type for punktpar
interface PointPair {
  current?: Position;
  target?: Position;
  category: string;
  id: number;
  created_at?: string;
}

// Type for lagrede søk-spor
interface SavedTrack {
  id: string;
  points: Position[];
  createdAt: string;
  shotPairId: string;
  mode: string;
  name: string;
  color: string;
}

// Type for lagrede funn
interface SavedFind {
  id: string;
  position: Position;
  createdAt: string;
  shotPairId: string;
  mode: string;
  name: string;
  color: string;
}

// Type for lagrede observasjoner
interface SavedObservation {
  id: string;
  position: Position;
  createdAt: string;
  shotPairId: string;
  mode: string;
  name: string;
  color: string;
}

const LAYER_CONFIGS = [
  {
    name: 'Flyfoto',
    key: 'esri',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles © Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    icon: '🛰️',
  },
  {
    name: 'OpenTopo',
    key: 'opentopo',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: 'Map data: © OpenTopoMap (CC-BY-SA)',
    icon: '⛰️',
  },
  {
    name: 'Standard',
    key: 'osm',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    icon: '🗺️',
  },
];

// Legg til en SVG-komponent for layers-ikonet
function LayersIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2" fill="#fff"/><polyline points="2 17 12 22 22 17" fill="#fff"/><polyline points="2 12 12 17 22 12" fill="#fff"/></svg>
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
  onLiveModeChange,
  mode = 'aware', // <-- NY
  showOnlyLastShot = false,
  isTracking = false,
  onTrackingChange,
  trackingPoints = [],
  onTrackingPointsChange,
      showMSRRetikkel = false,
    msrRetikkelOpacity = 80,
    msrRetikkelStyle = 'msr',
    msrRetikkelVerticalPosition = 50,
      selectedTargetIndex = 0,
  onPreviousTarget,
  onNextTarget,
  onSelectedTargetIndexChange,
  showAllTracksAndFinds = false,
  showObservations = true,
  showShots = true,
  showTracks = true,
  targetSize = 15,
  shotSize = 5,
  observationSize = 2.5,
  targetLineColor = '#ff00ff',
  shotColor = '#2563eb',
  targetColor = '#dc2626',
  targetLineWeight = 4,
  showHuntingBoundary = false,
  huntingAreas = [],
  activeHuntingAreaId = null,
  huntingBoundaryColor = '#00ff00',
  huntingBoundaryWeight = 3,
  huntingBoundaryOpacity = 80,
  isDefiningHuntingArea = false,
  onHuntingAreaDefined,
  onCancelHuntingAreaDefinition,
  onRefreshHuntingAreas,
  onRegisterSync,
  activeTeam = null,
  compassSliceLength = 30, // % of screen height
  compassMode: externalCompassMode,
  isCompassLocked: externalIsCompassLocked,
  onCompassModeChange,
  onCompassLockedChange,
}: MapComponentProps) {
  const [showTargetDialog, setShowTargetDialog] = useState(false);
  const instanceId = useRef(Math.random());
  const [isLeafletLoaded, setIsLeafletLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [places, setPlaces] = useState<PlaceData[]>([]);
  const [currentPosition, setCurrentPosition] = useState<Position | undefined>(undefined);
  const [gpsPosition, setGpsPosition] = useState<Position | null>(null);
  const [searchPosition, setSearchPosition] = useState<Position | null>(null);
  const [clearPlaces, setClearPlaces] = useState(false);
  const [isMapLocked, setIsMapLocked] = useState(false); // Default to unlocked for free map interaction

  // Reset clearPlaces after it's been used
  useEffect(() => {
    if (clearPlaces) {
      setClearPlaces(false);
    }
  }, [clearPlaces]);

  const [rotateMap, setRotateMap] = useState(false); // Ny state

  const [isScanning, setIsScanning] = useState(false);
  const [savedPairs, setSavedPairs] = useState<PointPair[]>([]);
  
  // Use props or default to 'off'
  const compassMode = externalCompassMode || 'off';
  const isCompassLocked = externalIsCompassLocked || false;
  
  // Use compass hook with iOS-optimized settings
  const compass = useCompass({
    isEnabled: compassMode !== 'off',
    onHeadingChange: (heading) => {
      console.log('[MapComponent] onHeadingChange called:', heading, 'currentPosition:', currentPosition);
      setCurrentPosition(prev => {
        const updated = {
          ...prev,
          lat: prev?.lat || 0,
          lng: prev?.lng || 0,
          heading,
        };
        console.log('[MapComponent] Updated position:', updated);
        return updated;
      });
    },
    smoothingAlpha: 0.22,      // Tuned: smooth needle, not sluggish (default 0.22)
    stallMs: 650,              // Faster stall detection (default 650)
    watchdogPeriodMs: 220,     // Check frequently for recovery (default 220)
    minRenderIntervalMs: 50,   // Max ~20 fps UI update (default 50)
    minDeltaDeg: 0.8,          // Deadband: ignore tiny changes (default 0.8)
    enableTiltGuard: true,     // Drop readings at extreme tilt >75° (default true)
    onStall: () => {
      console.warn('[MapComponent] Compass stall detected - auto-recovery in progress');
    },
  });
  
  // Kompass for skuddretning (engasjeres på knappetrykk i dialog)
  const [isShotCompassEnabled, setIsShotCompassEnabled] = useState(false);
  const shotDirectionCompass = useCompass({
    isEnabled: isShotCompassEnabled,
  });

  // Oppdater skuddretning kontinuerlig fra kompasset når aktivert
  useEffect(() => {
    if (!isShotCompassEnabled) return;
    const heading = shotDirectionCompass.currentHeading ?? shotDirectionCompass.lastValidHeading ?? shotDirectionCompass.rawHeading;
    if (heading != null && !Number.isNaN(heading)) {
      const internal = heading > 180 ? heading - 360 : heading; // map 0-359 -> -180..180
      setTargetDirection(internal);
    }
  }, [isShotCompassEnabled, shotDirectionCompass.currentHeading, shotDirectionCompass.lastValidHeading, shotDirectionCompass.rawHeading]);

  // Kompass for observasjonsretning (togglet i observasjonsdialog)
  const [isObservationCompassEnabled, setIsObservationCompassEnabled] = useState(false);
  const observationDirectionCompass = useCompass({
    isEnabled: isObservationCompassEnabled,
  });

  useEffect(() => {
    if (!isObservationCompassEnabled) return;
    const heading = observationDirectionCompass.currentHeading ?? observationDirectionCompass.lastValidHeading ?? observationDirectionCompass.rawHeading;
    if (heading != null && !Number.isNaN(heading)) {
      const internal = heading > 180 ? heading - 360 : heading; // map 0-359 -> -180..180
      setObservationDirection(internal);
    }
  }, [isObservationCompassEnabled, observationDirectionCompass.currentHeading, observationDirectionCompass.lastValidHeading, observationDirectionCompass.rawHeading]);
  
  // Tracking state for søk-modus
  const [savedTracks, setSavedTracks] = useState<SavedTrack[]>([]);
  const [savedFinds, setSavedFinds] = useState<SavedFind[]>([]);
  const [savedObservations, setSavedObservations] = useState<SavedObservation[]>([]);
  const [showSaveTrackDialog, setShowSaveTrackDialog] = useState(false);
  const [trackName, setTrackName] = useState('');
  const [trackColor, setTrackColor] = useState('#EAB308');
  const [trackIncludeDTG, setTrackIncludeDTG] = useState(true);
  
  // Hunting area definition state
  const [huntingAreaPoints, setHuntingAreaPoints] = useState<[number, number][]>([]);
  const [showSaveHuntingAreaDialog, setShowSaveHuntingAreaDialog] = useState(false);
  const [huntingAreaName, setHuntingAreaName] = useState('');
  const [currentTrackingId, setCurrentTrackingId] = useState<string | null>(null);
  const [showFindDialog, setShowFindDialog] = useState(false);
  const [newFindPosition, setNewFindPosition] = useState<Position | null>(null);
  const [findName, setFindName] = useState('');
  const [findColor, setFindColor] = useState('#EF4444');
  
  // Observasjon state
  const [showObservationDialog, setShowObservationDialog] = useState(false);
  const [observationName, setObservationName] = useState('');
  const [observationColor, setObservationColor] = useState('#FF6B35');
  const [observationIncludeDTG, setObservationIncludeDTG] = useState(true);
  const [showObservationRangeModal, setShowObservationRangeModal] = useState(false);
  const [showObservationDirectionUI, setShowObservationDirectionUI] = useState(false);
  const [observationRange, setObservationRange] = useState(250);
  const [observationDirection, setObservationDirection] = useState(0);
  const [previewObservation, setPreviewObservation] = useState<Position | null>(null);

  // Avstandsmåling state
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [measurementPoints, setMeasurementPoints] = useState<Position[]>([]);
  const [totalDistance, setTotalDistance] = useState(0);

  // MSR-retikkel state
  const [localShowMSRRetikkel, setLocalShowMSRRetikkel] = useState(showMSRRetikkel);
  const [localMSRRetikkelOpacity, setLocalMSRRetikkelOpacity] = useState(msrRetikkelOpacity);
  const [localMSRRetikkelStyle, setLocalMSRRetikkelStyle] = useState(msrRetikkelStyle);
  
  // Avstandsmåling funksjoner
  const calculateDistance = (point1: Position, point2: Position): number => {
    const R = 6371000; // Jordens radius i meter
    const dLat = (point2.lat - point1.lat) * Math.PI / 180;
    const dLng = (point2.lng - point1.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const handleMeasureClick = () => {
    if (!currentPosition) return;

    if (!isMeasuring) {
      // Start måling - lagre første punkt
      setIsMeasuring(true);
      setMeasurementPoints([currentPosition]);
      setTotalDistance(0);
    } else {
      // Fortsett måling - legg til nytt punkt og beregn avstand
      const newPoints = [...measurementPoints, currentPosition];
      setMeasurementPoints(newPoints);
      
      // Beregn total avstand (kumulativ)
      let total = 0;
      for (let i = 1; i < newPoints.length; i++) {
        total += calculateDistance(newPoints[i-1], newPoints[i]);
      }
      setTotalDistance(total);
    }
  };

  const handleResetMeasurement = () => {
    console.log('handleResetMeasurement called, current searchPosition:', searchPosition);
    setIsMeasuring(false);
    setMeasurementPoints([]);
    setTotalDistance(0);
    
    // Reset search results and remove search circle completely
    setPlaces([]);
    setClearPlaces(true); // Trigger clearPlaces in MapController
    setSearchPosition(null); // Remove search circle completely
    console.log('setSearchPosition(null) called');
  };
  
  // Hunting area definition functions
  const handleAddHuntingAreaPoint = useCallback((lat: number, lng: number) => {
    setHuntingAreaPoints(prev => [...prev, [lat, lng]]);
  }, []);
  
  const handleCancelHuntingArea = () => {
    setHuntingAreaPoints([]);
    setHuntingAreaName('');
    onCancelHuntingAreaDefinition?.();
  };
  
  const handleFinishHuntingArea = () => {
    if (huntingAreaPoints.length < 3) {
      alert('Du må definere minst 3 punkter for å lage et jaktfelt');
      return;
    }
    setShowSaveHuntingAreaDialog(true);
  };
  
  const handleSaveHuntingArea = () => {
    if (!huntingAreaName.trim()) {
      alert('Du må gi jaktfeltet et navn');
      return;
    }
    
    const newArea: HuntingArea = {
      id: Date.now().toString(),
      name: huntingAreaName.trim(),
      coordinates: [...huntingAreaPoints, huntingAreaPoints[0]], // Close the polygon
      color: huntingBoundaryColor,
      lineWeight: huntingBoundaryWeight,
      created_at: new Date().toISOString(),
    };
    
    onHuntingAreaDefined?.(newArea);
    
    // Reset state
    setHuntingAreaPoints([]);
    setHuntingAreaName('');
    setShowSaveHuntingAreaDialog(false);
  };

  
  // Juster selectedTargetIndex for wraparound (loop fra slutten til starten)
  const adjustedSelectedTargetIndex = (() => {
    if (mode !== 'søk' || !savedPairs || savedPairs.length === 0) return selectedTargetIndex;
    
    const treffpunkter = savedPairs.filter(p => p.category === 'Treffpunkt');
    if (treffpunkter.length === 0) return 0;
    
    // Hvis index er for høy, gå til starten
    if (selectedTargetIndex >= treffpunkter.length) {
      return 0;
    }
    // Hvis index er negativ, gå til slutten
    if (selectedTargetIndex < 0) {
      return treffpunkter.length - 1;
    }
    
    return selectedTargetIndex;
  })();
  
  // useEffect for å oppdatere selectedTargetIndex når den blir for høy eller negativ
  useEffect(() => {
    if (mode === 'søk' && savedPairs && savedPairs.length > 0) {
      const treffpunkter = savedPairs.filter(p => p.category === 'Treffpunkt');
      if (treffpunkter.length > 0) {
        console.log('Wraparound check:', { selectedTargetIndex, treffpunkterLength: treffpunkter.length });
        // Hvis index er for høy (f.eks. 999), gå til første
        if (selectedTargetIndex >= treffpunkter.length) {
          console.log('Forward wraparound: going to first target point');
          onSelectedTargetIndexChange?.(0);
        }
        // Hvis index er negativ, gå til slutten
        if (selectedTargetIndex < 0) {
          console.log('Index negative, setting to last');
          onSelectedTargetIndexChange?.(treffpunkter.length - 1);
        }
      }
    }
  }, [selectedTargetIndex, mode, savedPairs, onSelectedTargetIndexChange]);
  

  
  // Synkroniser MSR-retikkel props med local state
  useEffect(() => {
    setLocalShowMSRRetikkel(showMSRRetikkel);
  }, [showMSRRetikkel]);
  
  useEffect(() => {
    setLocalMSRRetikkelOpacity(msrRetikkelOpacity);
  }, [msrRetikkelOpacity]);
  
  useEffect(() => {
    setLocalMSRRetikkelStyle(msrRetikkelStyle);
  }, [msrRetikkelStyle]);
  
  // Start sporing - generer ny tracking ID og start med tom liste
  const startTracking = () => {
    const newTrackingId = `tracking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setCurrentTrackingId(newTrackingId);
    onTrackingPointsChange?.([]);
    onTrackingChange?.(true);
  };

  // Stopp sporing og vis prompt
  const stopTracking = () => {
    if (trackingPoints && trackingPoints.length > 0) {
      const shouldSave = window.confirm('Lagre spor til skudd?');
      if (shouldSave) {
        // La navn-feltet være tomt
        setTrackName('');
        setTrackIncludeDTG(true); // Default ON
        // Vis dialog for å navngi og velge farge
        setShowSaveTrackDialog(true);
      } else {
        // Slett sporet
        onTrackingPointsChange?.([]);
        setCurrentTrackingId(null);
      }
    }
    onTrackingChange?.(false);
  };

  // Lagre spor til localStorage
  const saveTrackToLocalStorage = (trackId: string | null, points: Position[], name: string, color: string) => {
    if (!trackId) return;
    
    try {
      // Hent eksisterende spor
      const existingTracks = JSON.parse(localStorage.getItem('searchTracks') || '{}');
      
      // Finn aktivt skuddpar ID - bruk selectedTarget i søk-modus, lastPair i andre moduser
      let activeShotPairId: string;
      if (mode === 'søk' && hasSavedPairs && safeSavedPairs.length > 0) {
        // I søk-modus: bruk det aktive treffpunktet
        const treffpunkter = safeSavedPairs.filter(p => p.category === 'Treffpunkt');
        const reversedTreffpunkter = treffpunkter.length > 0 ? [...treffpunkter].reverse() : [];
        const selectedTarget = reversedTreffpunkter[adjustedSelectedTargetIndex];
        activeShotPairId = selectedTarget?.id?.toString() || 'unknown';
      } else {
        // I andre moduser: bruk lastPair
        activeShotPairId = lastPair?.id?.toString() || 'unknown';
      }
      
      // Lagre nytt spor med timestamp og skuddpar info
      const newTrack: SavedTrack = {
        id: trackId,
        points: points,
        createdAt: new Date().toISOString(),
        shotPairId: activeShotPairId,
        mode: 'søk',
        name: name,
        color: color
      };
      
      // Legg til i eksisterende spor (ikke overskriv)
      if (!existingTracks[trackId]) {
        existingTracks[trackId] = newTrack;
        localStorage.setItem('searchTracks', JSON.stringify(existingTracks));
        
        // Oppdater state for å vise det nye sporet umiddelbart
        setSavedTracks(prev => [...prev, newTrack]);
      }
    } catch (error) {
      console.error('Feil ved lagring av spor:', error);
    }
  };

  // Last alle lagrede spor fra localStorage
  const loadSavedTracks = (): SavedTrack[] => {
    try {
      const savedTracks = JSON.parse(localStorage.getItem('searchTracks') || '{}');
      const allTracks = Object.values(savedTracks) as SavedTrack[] || [];
      
      // I søk-modus: vis kun spor for det valgte treffpunktet, eller alle hvis showAllTracksAndFinds er aktiv
      if (mode === 'søk' && hasSavedPairs && safeSavedPairs.length > 0) {
        // Hvis showAllTracksAndFinds er aktiv, vis alle spor
        if (showAllTracksAndFinds) {
          return allTracks;
        }
        
        // Ellers vis kun spor for det valgte treffpunktet
        const treffpunkter = safeSavedPairs.filter(p => p.category === 'Treffpunkt');
        const reversedTreffpunkter = treffpunkter.length > 0 ? [...treffpunkter].reverse() : [];
        const selectedTarget = reversedTreffpunkter[adjustedSelectedTargetIndex];
        if (selectedTarget?.id) {
          // Vis kun spor for det valgte treffpunktet
          return allTracks.filter(track => track.shotPairId === selectedTarget.id.toString());
        }
      }
      // Vis alle spor i andre moduser
      return allTracks;
    } catch (error) {
      console.error('Feil ved lasting av lagrede spor:', error);
      return [];
    }
  };

  // Synkroniser team-data (kun hent data, ikke push)
  const syncTeamData = async () => {
    if (!activeTeam) return;
    
    try {
      console.log('Syncing team data for team:', activeTeam);
      
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          teamId: activeTeam,
          localData: null // Only pull, don't push
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Sync failed:', errorData.error || response.statusText);
        return;
      }

      const syncResults = await response.json();
      console.log('Sync results:', syncResults);
      
      // Load server data into localStorage (clean slate)
      if (syncResults.pulled) {
        // Load tracks for this team
        if (syncResults.pulled.tracks) {
          const teamTracks: { [key: string]: SavedTrack } = {};
          
          syncResults.pulled.tracks.forEach((track: any) => {
            const trackId = track.local_id; // Always use local_id as our local ID
            if (!trackId) {
              console.warn('Track missing local_id:', track);
              return;
            }
            teamTracks[trackId] = {
              id: trackId,
              name: track.name,
              color: track.color,
              shotPairId: track.shot_pair_id || 'unknown',
              points: track.points ? JSON.parse(track.points) : [], // Parse points from JSON
              createdAt: new Date().toISOString(),
              mode: 'søk'
            };
          });
          
          localStorage.setItem('searchTracks', JSON.stringify(teamTracks));
          console.log('Loaded tracks for team:', syncResults.pulled.tracks.length);
        }

        // Load finds for this team
        if (syncResults.pulled.finds) {
          const teamFinds: { [key: string]: SavedFind } = {};
          
          syncResults.pulled.finds.forEach((find: any) => {
            const findId = find.local_id; // Always use local_id as our local ID
            if (!findId) {
              console.warn('Find missing local_id:', find);
              return;
            }
            teamFinds[findId] = {
              id: findId,
              name: find.name,
              position: find.position ? JSON.parse(find.position) : { lat: 0, lng: 0 },
              shotPairId: find.shot_pair_id || 'unknown',
              color: find.color || '#10b981',
              createdAt: new Date().toISOString(),
              mode: 'søk'
            };
          });
          
          localStorage.setItem('searchFinds', JSON.stringify(teamFinds));
          console.log('Loaded finds for team:', syncResults.pulled.finds.length);
        }

        // Load observations for this team
        if (syncResults.pulled.observations) {
          const teamObservations: { [key: string]: SavedObservation } = {};
          
          syncResults.pulled.observations.forEach((obs: any) => {
            const obsId = obs.local_id; // Always use local_id as our local ID
            if (!obsId) {
              console.warn('Observation missing local_id:', obs);
              return;
            }
            teamObservations[obsId] = {
              id: obsId,
              name: obs.name,
              position: obs.position ? JSON.parse(obs.position) : { lat: 0, lng: 0 },
              shotPairId: obs.shot_pair_id || 'unknown',
              color: obs.color || '#F59E0B',
              createdAt: new Date().toISOString(),
              mode: 'søk'
            };
          });
          
          localStorage.setItem('searchObservations', JSON.stringify(teamObservations));
          console.log('Loaded observations for team:', syncResults.pulled.observations.length);
        }

        // Posts are handled by fetchPosts() which is called separately
        console.log('Loaded posts for team:', syncResults.pulled.posts?.length || 0);
      }

      // Trigger re-load of data using existing logic
      if (mode === 'søk') {
        const tracks = loadSavedTracks();
        setSavedTracks(tracks);
        console.log('Set savedTracks:', tracks.length);
        
        const finds = loadSavedFinds();
        setSavedFinds(finds);
        console.log('Set savedFinds:', finds.length);
        
        const observations = loadSavedObservations();
        setSavedObservations(observations);
        console.log('Set savedObservations:', observations.length);
      }

      // Fetch posts for the active team
      fetchPosts();

      console.log('Team data synced successfully for team:', activeTeam);
    } catch (error) {
      console.error('Error syncing team data:', error);
    }
  };

  // Auto-sync without user confirmation
  const autoSyncData = async () => {
    if (!activeTeam) {
      console.log('No active team for auto-sync');
      return;
    }
    
    try {
      // Prepare local data for sync (read directly from localStorage to get latest data)
      const localTracks = JSON.parse(localStorage.getItem('searchTracks') || '{}');
      const localFinds = JSON.parse(localStorage.getItem('searchFinds') || '{}');
      const localObservations = JSON.parse(localStorage.getItem('searchObservations') || '{}');
      
      const localData = {
        tracks: Object.values(localTracks).map((track: any) => ({ ...track, id: track.id, points: track.points, shotPairId: track.shotPairId })),
        finds: Object.values(localFinds).map((find: any) => ({ ...find, id: find.id, shotPairId: find.shotPairId, position: find.position, color: find.color })),
        observations: Object.values(localObservations).map((obs: any) => ({ ...obs, id: obs.id, position: obs.position, color: obs.color })),
        posts: (safeSavedPairs || []).map((post: any) => ({ ...post, id: post.id }))
      };
      
      console.log('Auto-sync sending data:', {
        teamId: activeTeam,
        tracksCount: localData.tracks.length,
        findsCount: localData.finds.length,
        observationsCount: localData.observations.length,
        postsCount: localData.posts.length,
        tracks: localData.tracks.map(track => ({
          id: track.id,
          name: track.name,
          pointsCount: track.points?.length || 0
        }))
      });

      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          teamId: activeTeam,
          localData: localData
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Auto-sync failed:', errorData.error || response.statusText);
        return;
      }

      const syncResults = await response.json();
      console.log('Auto-sync results:', syncResults);
      
      // Load server data into localStorage (clean slate)
      if (syncResults.pulled) {
        // Load tracks for this team
        if (syncResults.pulled.tracks) {
          const teamTracks: { [key: string]: SavedTrack } = {};
          
          syncResults.pulled.tracks.forEach((track: any) => {
            const trackId = track.local_id; // Always use local_id as our local ID
            if (!trackId) {
              console.warn('Track missing local_id:', track);
              return;
            }
            teamTracks[trackId] = {
              id: trackId,
              name: track.name,
              color: track.color,
              shotPairId: track.shot_pair_id || 'unknown',
              points: track.points ? JSON.parse(track.points) : [], // Parse points from JSON
              createdAt: new Date().toISOString(),
              mode: 'søk'
            };
          });
          
          localStorage.setItem('searchTracks', JSON.stringify(teamTracks));
          console.log('Auto-synced tracks for team:', syncResults.pulled.tracks.length);
        }

        // Load finds for this team
        if (syncResults.pulled.finds) {
          const teamFinds: { [key: string]: SavedFind } = {};
          
          syncResults.pulled.finds.forEach((find: any) => {
            const findId = find.local_id; // Always use local_id as our local ID
            if (!findId) {
              console.warn('Find missing local_id:', find);
              return;
            }
            teamFinds[findId] = {
              id: findId,
              name: find.name,
              position: find.position ? JSON.parse(find.position) : { lat: 0, lng: 0 },
              shotPairId: find.shot_pair_id || 'unknown',
              color: find.color || '#10b981',
              createdAt: new Date().toISOString(),
              mode: 'søk'
            };
          });
          
          localStorage.setItem('searchFinds', JSON.stringify(teamFinds));
          console.log('Auto-synced finds for team:', syncResults.pulled.finds.length);
        }

        // Load observations for this team
        if (syncResults.pulled.observations) {
          const teamObservations: { [key: string]: SavedObservation } = {};
          
          syncResults.pulled.observations.forEach((obs: any) => {
            const obsId = obs.local_id; // Always use local_id as our local ID
            if (!obsId) {
              console.warn('Observation missing local_id:', obs);
              return;
            }
            teamObservations[obsId] = {
              id: obsId,
              name: obs.name,
              position: obs.position ? JSON.parse(obs.position) : { lat: 0, lng: 0 },
              shotPairId: obs.shot_pair_id || 'unknown',
              color: obs.color || '#F59E0B',
              createdAt: new Date().toISOString(),
              mode: 'søk'
            };
          });
          
          localStorage.setItem('searchObservations', JSON.stringify(teamObservations));
          console.log('Auto-synced observations for team:', syncResults.pulled.observations.length);
        }

        // Posts are handled by fetchPosts() which is called separately
        console.log('Auto-synced posts for team:', syncResults.pulled.posts?.length || 0);
      }

      // Trigger re-load of data using existing logic
      if (mode === 'søk') {
        const tracks = loadSavedTracks();
        setSavedTracks(tracks);
        
        const finds = loadSavedFinds();
        setSavedFinds(finds);
        
        const observations = loadSavedObservations();
        setSavedObservations(observations);
      }

      // Fetch posts for the active team
      fetchPosts();

      console.log('Auto-sync completed successfully for team:', activeTeam);
    } catch (error) {
      console.error('Auto-sync error:', error);
    }
  };

  // Håndter synkronisering med database (push + pull)
  const handleSyncData = async () => {
    if (!activeTeam) {
      alert('Ingen aktivt team valgt. Vennligst velg et team i admin-menyen først.');
      return;
    }
    
    const shouldSync = window.confirm('Synkroniser alle data med teamet? Dette vil pushe dine lokale data og hente alle team-data.');
    if (shouldSync) {
      try {
        // Prepare local data for sync
        const localData = {
          tracks: (savedTracks || []).map(track => ({ ...track, id: track.id, points: track.points, shotPairId: track.shotPairId })),
          finds: (savedFinds || []).map(find => ({ ...find, id: find.id, shotPairId: find.shotPairId, position: find.position, color: find.color })),
          observations: (savedObservations || []).map(obs => ({ ...obs, id: obs.id, position: obs.position, color: obs.color })),
          posts: (safeSavedPairs || []).map((post: any) => ({ ...post, id: post.id }))
        };

        const response = await fetch('/api/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            teamId: activeTeam,
            localData: localData
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(`Sync failed: ${errorData.error || response.statusText}`);
        }

        const syncResults = await response.json();
        console.log('Sync results:', syncResults);
        
        // Load server data into localStorage (clean slate)
        if (syncResults.pulled) {
          // Load tracks for this team
          if (syncResults.pulled.tracks) {
            const teamTracks: { [key: string]: SavedTrack } = {};
            
            syncResults.pulled.tracks.forEach((track: any) => {
              const trackId = track.local_id || track.id;
              teamTracks[trackId] = {
                id: trackId,
                name: track.name,
                color: track.color,
                shotPairId: track.shot_pair_id || 'unknown',
                points: track.points ? JSON.parse(track.points) : [], // Parse points from JSON
                createdAt: new Date().toISOString(),
                mode: 'søk'
              };
            });
            
            localStorage.setItem('searchTracks', JSON.stringify(teamTracks));
            console.log('Loaded tracks for team:', syncResults.pulled.tracks.length);
          }

          // Load finds for this team
          if (syncResults.pulled.finds) {
            const teamFinds: { [key: string]: SavedFind } = {};
            
            syncResults.pulled.finds.forEach((find: any) => {
              const findId = find.local_id || find.id;
              teamFinds[findId] = {
                id: findId,
                name: find.name,
                position: find.position ? JSON.parse(find.position) : { lat: 0, lng: 0 },
                shotPairId: find.shot_pair_id || 'unknown',
                color: find.color || '#10b981',
                createdAt: new Date().toISOString(),
                mode: 'søk'
              };
            });
            
            localStorage.setItem('searchFinds', JSON.stringify(teamFinds));
            console.log('Loaded finds for team:', syncResults.pulled.finds.length);
          }

          // Load observations for this team
          if (syncResults.pulled.observations) {
            const teamObservations: { [key: string]: SavedObservation } = {};
            
            syncResults.pulled.observations.forEach((obs: any) => {
              const obsId = obs.local_id || obs.id;
              teamObservations[obsId] = {
                id: obsId,
                name: obs.name,
                position: obs.position ? JSON.parse(obs.position) : { lat: 0, lng: 0 },
                shotPairId: obs.shot_pair_id || 'unknown',
                color: obs.color || '#F59E0B',
                createdAt: new Date().toISOString(),
                mode: 'søk'
              };
            });
            
            localStorage.setItem('searchObservations', JSON.stringify(teamObservations));
            console.log('Loaded observations for team:', syncResults.pulled.observations.length);
          }

          // Posts are handled by fetchPosts() which is called separately
          console.log('Loaded posts for team:', syncResults.pulled.posts?.length || 0);
        }

        // Trigger re-load of data using existing logic
        if (mode === 'søk') {
          const tracks = loadSavedTracks();
          setSavedTracks(tracks);
          console.log('Set savedTracks:', tracks.length);
          
          const finds = loadSavedFinds();
          setSavedFinds(finds);
          console.log('Set savedFinds:', finds.length);
          
          const observations = loadSavedObservations();
          setSavedObservations(observations);
          console.log('Set savedObservations:', observations.length);
        }

        // Fetch posts for the active team
        fetchPosts();
        
        // Refresh hunting areas and get count
        let huntingAreasCount = 0;
        if (onRefreshHuntingAreas) {
          onRefreshHuntingAreas();
          // Also fetch count directly for sync message
          try {
            const huntingAreasResponse = await fetch(`/api/hunting-areas?teamId=${activeTeam}`);
            if (huntingAreasResponse.ok) {
              const areas = await huntingAreasResponse.json();
              huntingAreasCount = areas.length;
            }
          } catch (error) {
            console.error('Error fetching hunting areas count:', error);
          }
        }

        // Show sync results
        const pushMessage = [];
        if (syncResults.pushed.tracks > 0) pushMessage.push(`${syncResults.pushed.tracks} spor`);
        if (syncResults.pushed.finds > 0) pushMessage.push(`${syncResults.pushed.finds} funn`);
        if (syncResults.pushed.observations > 0) pushMessage.push(`${syncResults.pushed.observations} observasjoner`);
        if (syncResults.pushed.posts > 0) pushMessage.push(`${syncResults.pushed.posts} skuddpar`);

        const pullMessage = [];
        if (syncResults.pulled.tracks.length > 0) pullMessage.push(`${syncResults.pulled.tracks.length} spor`);
        if (syncResults.pulled.finds.length > 0) pullMessage.push(`${syncResults.pulled.finds.length} funn`);
        if (syncResults.pulled.observations.length > 0) pullMessage.push(`${syncResults.pulled.observations.length} observasjoner`);
        if (syncResults.pulled.posts.length > 0) pullMessage.push(`${syncResults.pulled.posts.length} skuddpar`);
        if (huntingAreasCount > 0) pullMessage.push(`${huntingAreasCount} jaktfelt`);

        let message = 'Synkronisering fullført!';
        if (pushMessage.length > 0) message += `\nPushet: ${pushMessage.join(', ')}`;
        if (pullMessage.length > 0) message += `\nHentet: ${pullMessage.join(', ')}`;
        if (syncResults.errors.length > 0) message += `\nFeil: ${syncResults.errors.length}`;

        alert(message);
      } catch (error) {
        console.error('Error syncing data:', error);
        alert('Feil ved synkronisering: ' + (error as Error).message);
      }
    }
  };

  // Register sync function with parent component
  useEffect(() => {
    if (onRegisterSync) {
      onRegisterSync(handleSyncData);
    }
  }, [onRegisterSync]);

  // Håndter lagring av spor fra dialog
  const handleSaveTrackFromDialog = () => {
    let finalTrackName = trackName.trim();
    
    // Legg til DTG hvis checkbox er på
    if (trackIncludeDTG) {
      const now = new Date();
      const date = now.toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit' });
      const time = now.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit', hour12: false });
      const dtg = `${date} ${time}`;
      
      if (finalTrackName) {
        finalTrackName = `${finalTrackName} - ${dtg}`;
      } else {
        finalTrackName = dtg;
      }
    }
    
    if (!finalTrackName) {
      alert('Vennligst skriv inn et navn eller aktiver "Legg til DTG"');
      return;
    }
    
    // Sjekk at spor har punkter
    const pointsToSave = trackingPoints || [];
    if (pointsToSave.length === 0) {
      alert('Spor har ingen punkter. Start tracking og beveg deg på kartet før du lagrer.');
      return;
    }
    
    saveTrackToLocalStorage(currentTrackingId, pointsToSave, finalTrackName, trackColor);
    console.log('Spor lagret til localStorage:', { 
      id: currentTrackingId, 
      name: finalTrackName, 
      color: trackColor, 
      points: pointsToSave 
    });
    
    // Automatically sync with database
    if (activeTeam) {
      console.log('Auto-syncing track to database for team:', activeTeam);
      autoSyncData();
    }
    
    // Reset dialog state
    setShowSaveTrackDialog(false);
    setTrackName('');
    setTrackColor('#EAB308');
    setTrackIncludeDTG(true);
    onTrackingPointsChange?.([]);
    setCurrentTrackingId(null);
  };

  // Avbryt lagring av spor
  const handleCancelSaveTrack = () => {
    setShowSaveTrackDialog(false);
    setTrackName('');
    setTrackColor('#EAB308');
    setTrackIncludeDTG(true);
    onTrackingPointsChange?.([]);
    setCurrentTrackingId(null);
  };

  // Aktiver funn-modus - bruk nåværende posisjon (rød prikk i midten)
  const toggleFindingMode = () => {
    console.log('toggleFindingMode called, using current position');
    if (currentPosition) {
      const shouldSave = window.confirm('Lagre funn her?');
      if (shouldSave) {
        console.log('Opening find dialog for current position...');
        setNewFindPosition(currentPosition);
        // Sett default navn med dato og tid
        setFindName(generateDefaultName('find'));
        setShowFindDialog(true);
      }
    } else {
      alert('Kunne ikke finne din nåværende posisjon');
    }
  };

  // Lagre funn til localStorage
  const saveFindToLocalStorage = (position: Position, name: string, color: string) => {
    try {
      // Hent eksisterende funn
      const existingFinds = JSON.parse(localStorage.getItem('searchFinds') || '{}');
      
      // Finn aktivt skuddpar ID - bruk selectedTarget i søk-modus, lastPair i andre moduser
      let activeShotPairId: string;
      if (mode === 'søk' && hasSavedPairs && safeSavedPairs.length > 0) {
        // I søk-modus: bruk det aktive treffpunktet
        const treffpunkter = safeSavedPairs.filter(p => p.category === 'Treffpunkt');
        const reversedTreffpunkter = treffpunkter.length > 0 ? [...treffpunkter].reverse() : [];
        const selectedTarget = reversedTreffpunkter[adjustedSelectedTargetIndex];
        activeShotPairId = selectedTarget?.id?.toString() || 'unknown';
      } else {
        // I andre moduser: bruk lastPair
        activeShotPairId = lastPair?.id?.toString() || 'unknown';
      }
      
      // Generer unik ID for funnet
      const findId = `find_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Lagre nytt funn
      const newFind: SavedFind = {
        id: findId,
        position: position,
        createdAt: new Date().toISOString(),
        shotPairId: activeShotPairId,
        mode: 'søk',
        name: name,
        color: color
      };
      
      // Legg til i eksisterende funn
      existingFinds[findId] = newFind;
      localStorage.setItem('searchFinds', JSON.stringify(existingFinds));
      
      // Oppdater state for å vise det nye funnet umiddelbart
      setSavedFinds(prev => [...prev, newFind]);
      
      console.log('Funn lagret:', newFind);
    } catch (error) {
      console.error('Feil ved lagring av funn:', error);
    }
  };

  // Last alle lagrede funn fra localStorage
  const loadSavedFinds = (): SavedFind[] => {
    try {
      const savedFinds = JSON.parse(localStorage.getItem('searchFinds') || '{}');
      const allFinds = Object.values(savedFinds) as SavedFind[] || [];
      
      // I søk-modus: vis kun funn for det valgte treffpunktet, eller alle hvis showAllTracksAndFinds er aktiv
      if (mode === 'søk' && hasSavedPairs && safeSavedPairs.length > 0) {
        // Hvis showAllTracksAndFinds er aktiv, vis alle funn
        if (showAllTracksAndFinds) {
          return allFinds;
        }
        
        // Ellers vis kun funn for det valgte treffpunktet
        const treffpunkter = safeSavedPairs.filter(p => p.category === 'Treffpunkt');
        const reversedTreffpunkter = treffpunkter.length > 0 ? [...treffpunkter].reverse() : [];
        const selectedTarget = reversedTreffpunkter[adjustedSelectedTargetIndex];
        if (selectedTarget?.id) {
          // Vis kun funn for det valgte treffpunktet
          return allFinds.filter(find => find.shotPairId === selectedTarget.id.toString());
        }
      }
      // Vis alle funn i andre moduser
      return allFinds;
    } catch (error) {
      console.error('Feil ved lasting av lagrede funn:', error);
      return [];
    }
  };

  // Last alle lagrede observasjoner fra localStorage
  const loadSavedObservations = (): SavedObservation[] => {
    try {
      const savedObservations = JSON.parse(localStorage.getItem('searchObservations') || '{}');
      const allObservations = Object.values(savedObservations) as SavedObservation[] || [];
      
      // Observasjoner er frie og vises alltid (ikke filtrert på skuddpar)
      return allObservations;
    } catch (error) {
      console.error('Feil ved lasting av lagrede observasjoner:', error);
      return [];
    }
  };

  // Håndter kart-klikk for å plassere funn (ikke lenger brukt for funn)
  const handleMapClick = (e: { latlng: { lat: number; lng: number } }) => {
    console.log('handleMapClick called:', { mode, e });
    // Funksjonen er ikke lenger brukt for funn, men beholdes for fremtidig bruk
  };

  // Håndter lagring av funn fra dialog
  const handleSaveFindFromDialog = () => {
    if (newFindPosition) {
      // Hvis brukeren ikke har skrevet noe, bruk default navnet
      const finalFindName = findName.trim() || findName;
      if (!finalFindName) {
        alert('Vennligst skriv inn et navn for funnet');
        return;
      }

      saveFindToLocalStorage(newFindPosition, finalFindName, findColor);
      setShowFindDialog(false);
      setNewFindPosition(null);
      setFindName('');
      setFindColor('#EF4444');
    }
  };

  // Håndter avbryt av funn dialog
  const handleCancelFind = () => {
    setShowFindDialog(false);
    setNewFindPosition(null);
      setFindName('');
      setFindColor('#EF4444');
  };
  
  // Aktiver observasjon-modus - bruk nåværende posisjon (rød prikk i midten)
  const toggleObservationMode = () => {
    console.log('toggleObservationMode called, using current position');
    if (currentPosition) {
      console.log('Opening observation dialog for current position...');
      // La navn-feltet være tomt
      setObservationName('');
      setObservationIncludeDTG(true); // Default ON
      setShowObservationDialog(true);
    } else {
      alert('Kunne ikke finne din nåværende posisjon');
    }
  };
  
  // Lagre observasjon til localStorage
  const saveObservationToLocalStorage = (position: Position, name: string, color: string) => {
    try {
      // Hent eksisterende observasjoner
      const existingObservations = JSON.parse(localStorage.getItem('searchObservations') || '{}');
      
      // Observasjoner er frie og ikke koblet til skuddpar
      const activeShotPairId = 'free';
      
      // Generer unik ID for observasjonen
      const observationId = `observation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Lagre ny observasjon
      const newObservation: SavedObservation = {
        id: observationId,
        position: position,
        createdAt: new Date().toISOString(),
        shotPairId: activeShotPairId,
        mode: 'søk',
        name: name,
        color: color
      };
      
      // Legg til i eksisterende observasjoner
      existingObservations[observationId] = newObservation;
      localStorage.setItem('searchObservations', JSON.stringify(existingObservations));
      
      // Oppdater state for å vise den nye observasjonen umiddelbart
      setSavedObservations(prev => [...prev, newObservation]);
      
      console.log('Observasjon lagret:', newObservation);
    } catch (error) {
      console.error('Feil ved lagring av observasjon:', error);
    }
  };
  
  // Håndter lagring av observasjon fra dialog
  const handleSaveObservationFromDialog = () => {
    if (currentPosition) {
      let finalObservationName = observationName.trim();
      
      // Legg til DTG hvis checkbox er på
      if (observationIncludeDTG) {
        const now = new Date();
        const date = now.toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit' });
        const time = now.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit', hour12: false });
        const dtg = `${date} ${time}`;
        
        if (finalObservationName) {
          finalObservationName = `${finalObservationName} - ${dtg}`;
          } else {
          finalObservationName = dtg;
        }
      }
      
      if (!finalObservationName) {
        alert('Vennligst skriv inn et navn eller aktiver "Legg til DTG"');
        return;
      }
      
      saveObservationToLocalStorage(currentPosition, finalObservationName, observationColor);
      setShowObservationDialog(false);
      setObservationName('');
      setObservationColor('#FF6B35');
      setObservationIncludeDTG(true);
    }
  };
  
  // Håndter avbryt av observasjon dialog
  const handleCancelObservation = () => {
    setShowObservationDialog(false);
    setObservationName('');
    setObservationColor('#FF6B35');
    setObservationIncludeDTG(true);
  };

  // Håndter observasjon med avstand + retning
  const handleObservationWithDistance = () => {
    // Lukk observasjonsdialogen og start avstand/retning-flyten
    setShowObservationDialog(false);
    setShowObservationRangeModal(true);
  };

  // Bekreft observasjon range og gå til retning
  const handleObservationRangeOk = () => {
    setShowObservationRangeModal(false);
    setShowObservationDirectionUI(true);
  };

  // Lagre observasjon med beregnet posisjon
  const handleSaveObservationWithDistance = () => {
    if (!currentPosition) return;
    
    // Beregn observasjon posisjon basert på nåværende posisjon, avstand og retning
    const observationPosition = destinationPoint(
      currentPosition.lat,
      currentPosition.lng,
      observationRange,
      ((observationDirection + 360) % 360)
    );
    
    // Forbered navn med DTG hvis aktivert
    let finalObservationName = observationName.trim();
    if (observationIncludeDTG) {
      const now = new Date();
      const date = now.toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit' });
      const time = now.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit', hour12: false });
      const dtg = `${date} ${time}`;
      
      if (finalObservationName) {
        finalObservationName = `${finalObservationName} - ${dtg}`;
      } else {
        finalObservationName = dtg;
      }
    }
    
    if (!finalObservationName) {
      alert('Vennligst skriv inn et navn eller aktiver "Legg til DTG"');
      return;
    }
    
    // Lagre observasjon på beregnet posisjon
    saveObservationToLocalStorage(observationPosition, finalObservationName, observationColor);
    
    // Reset states
    setShowObservationDirectionUI(false);
    setShowObservationRangeModal(false);
    setObservationName('');
    setObservationColor('#FF6B35');
    setObservationIncludeDTG(true);
    setObservationRange(250);
    setObservationDirection(0);
    setPreviewObservation(null);
  };

  // Avbryt observasjon avstand/retning
  const handleCancelObservationDistance = () => {
    setShowObservationRangeModal(false);
    setShowObservationDirectionUI(false);
    setObservationRange(250);
    setObservationDirection(0);
    setPreviewObservation(null);
    // Gå tilbake til observasjonsdialogen
    setShowObservationDialog(true);
  };

  
  // --- For interaktiv target-pos modal ---
  const [showTargetRadiusModal, setShowTargetRadiusModal] = useState(false);
  const [showTargetDirectionUI, setShowTargetDirectionUI] = useState(false);
  const [targetRange, setTargetRange] = useState(250); // Default 250m
  const [targetDirection, setTargetDirection] = useState(0); // Startverdi 0 (nord)
  const [previewTarget, setPreviewTarget] = useState<Position | null>(null);
  const [lockedShotPosition, setLockedShotPosition] = useState<Position | null>(null);
  const [showCurrentFeedback, setShowCurrentFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  // State for ny post-dialog
  const [showNewPostDialog, setShowNewPostDialog] = useState(false);
  const [newPostPosition, setNewPostPosition] = useState<Position | null>(null);
  const [newPostName, setNewPostName] = useState('');
  // State for Target-dialog
  const [targetDistance, setTargetDistance] = useState(250);
  // Legg til state for "vis kun siste skudd"
  // Åpne dialog når Target trykkes
  const openTargetDialog = () => {
    setTargetRange(250);
    setShowTargetRadiusModal(true);
    setShowTargetDirectionUI(false);
    setShowTargetDialog(false); // Skjul gammel dialog
  };

  // Oppdater previewTarget når range eller direction endres
  useEffect(() => {
    if (!showTargetDirectionUI || !lockedShotPosition) {
      setPreviewTarget(null);
      return;
    }
    // 0° = nord, 90° = øst, 180° = sør, 270° = vest
    // Konverter fra -180 til +180 til 0-359
    const compassDeg = ((targetDirection + 360) % 360);
    setPreviewTarget(
      destinationPoint(
        lockedShotPosition.lat,
        lockedShotPosition.lng,
        targetRange,
        compassDeg
      )
    );
  }, [showTargetDirectionUI, targetRange, targetDirection, lockedShotPosition]);



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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!L?.Icon?.Default) return;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
      iconUrl:      'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
      shadowUrl:    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    });
  }, []);

  // All database operations now go through Next.js API routes

  // Hent alle poster fra API
  const fetchPosts = async () => {
    try {
      // Only fetch posts if we have an active team
      if (!activeTeam) {
        console.log('No active team, clearing posts');
        setSavedPairs([]);
      return;
    }
      
      console.log('Fetching posts for team:', activeTeam);
      const response = await fetch(`/api/posts?teamId=${activeTeam}`);
      if (!response.ok) {
        throw new Error('Failed to fetch posts');
      }
      const data = await response.json();
      console.log('Fetched posts:', data.length, 'posts');
      
    if (Array.isArray(data)) {
        // Parse content field to extract coordinates and category
        const parsedPosts = data.map(post => {
          const content = post.content || '';
          const latMatch = content.match(/Lat: ([\d.-]+)/);
          const lngMatch = content.match(/Lng: ([\d.-]+)/);
          const targetLatMatch = content.match(/Target: ([\d.-]+), ([\d.-]+)/);
          const categoryMatch = content.match(/Category: (\w+)/);
          
          return {
            current: latMatch && lngMatch ? { lat: parseFloat(latMatch[1]), lng: parseFloat(lngMatch[1]) } : undefined,
            target: targetLatMatch ? { lat: parseFloat(targetLatMatch[1]), lng: parseFloat(targetLatMatch[2]) } : undefined,
            category: categoryMatch ? categoryMatch[1] : 'general',
        id: post.id,
        created_at: post.created_at,
          };
        });

        // Kombiner Skyteplass og Treffpunkt til ett par-objekt
        const skyteplasser = parsedPosts.filter(p => p.category === 'Skyteplass' && p.current);
        const treffpunkter = parsedPosts.filter(p => p.category === 'Treffpunkt' && p.target);
        
        // Sorter etter created_at
        skyteplasser.sort((a, b) => (a.created_at || '') < (b.created_at || '') ? -1 : 1);
        treffpunkter.sort((a, b) => (a.created_at || '') < (b.created_at || '') ? -1 : 1);
        
        // Match skyteplasser med treffpunkter (første skyteplass med første treffpunkt, etc.)
        const combinedPairs: PointPair[] = [];
        for (let i = 0; i < Math.max(skyteplasser.length, treffpunkter.length); i++) {
          const skyteplass = skyteplasser[i];
          // Finn treffpunkt som ble lagret etter denne skyteplassen
          const treffpunkt = treffpunkter.find(t => 
            !skyteplass?.created_at || !t.created_at || t.created_at > skyteplass.created_at
          );
          
          if (skyteplass || treffpunkt) {
            combinedPairs.push({
              current: skyteplass?.current,
              target: treffpunkt?.target,
              category: skyteplass?.category || treffpunkt?.category || 'general',
              id: skyteplass?.id || treffpunkt?.id || 0,
              created_at: skyteplass?.created_at || treffpunkt?.created_at,
            });
            
            // Fjern brukt treffpunkt fra listen
            if (treffpunkt) {
              const index = treffpunkter.indexOf(treffpunkt);
              if (index > -1) treffpunkter.splice(index, 1);
            }
          }
        }
        
        // Legg til gjenværende treffpunkter uten matchende skyteplass
        treffpunkter.forEach(treffpunkt => {
          combinedPairs.push({
            current: undefined,
            target: treffpunkt.target,
            category: treffpunkt.category,
            id: treffpunkt.id,
            created_at: treffpunkt.created_at,
          });
        });
        
        setSavedPairs(combinedPairs);
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
      alert('Kunne ikke hente poster fra backend.');
    }
  };

  // Posts will be fetched when activeTeam is set

  // Synkroniser team-data når activeTeam endres
  useEffect(() => {
    if (activeTeam) {
      console.log('Active team changed, syncing team data:', activeTeam);
      
      // Clear localStorage for clean slate
      localStorage.removeItem('searchTracks');
      localStorage.removeItem('searchFinds');
      localStorage.removeItem('searchObservations');
      
      // Clear local state
      setSavedTracks([]);
      setSavedFinds([]);
      setSavedObservations([]);
      setSavedPairs([]);
      
      // Sync team data (this will populate localStorage and state with server data)
      syncTeamData();
    } else {
      // Clear all data when no team is selected
      console.log('No active team, clearing all data');
      localStorage.removeItem('searchTracks');
      localStorage.removeItem('searchFinds');
      localStorage.removeItem('searchObservations');
      setSavedTracks([]);
      setSavedFinds([]);
      setSavedObservations([]);
      setSavedPairs([]);
    }
  }, [activeTeam]);

  // Gamle state-variabler fjernet - ikke lenger nødvendige med forenklet workflow

  // Ny forenklet handleSaveCurrentPos som trigge target-seleksjon flyten
  const handleSaveCurrentPos = () => {
    if (currentPosition) {
      // Lås posisjonen for target-seleksjon
      setLockedShotPosition({ ...currentPosition });
      // Start target-seleksjon flyten direkte
      setShowTargetRadiusModal(true);
    }
  };

  // Gamle handleSaveTargetPos funksjon fjernet - erstattet av handleTargetModalSave
  const handleTargetRadiusOk = () => {
    setShowTargetRadiusModal(false);
    setShowTargetDirectionUI(true);
  };
  const handleTargetModalSave = async () => {
    if (!lockedShotPosition) return;
    
    // Beregn treffpunkt basert på skyteplass, avstand og retning
    const targetPosition = destinationPoint(
      lockedShotPosition.lat,
      lockedShotPosition.lng,
      targetRange,
      ((targetDirection + 360) % 360)
    );
    
    if (!targetPosition) return;
    
    try {
      // Lagre skyteplass
      const shotResponse = await fetch('/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'Skyteplass',
          content: `Lat: ${lockedShotPosition.lat}, Lng: ${lockedShotPosition.lng}, Category: Skyteplass`,
          teamId: activeTeam
        }),
      });

      if (!shotResponse.ok) {
        throw new Error('Failed to save shot position');
      }

      const shotData = await shotResponse.json();
      
      // Lagre treffpunkt
      const targetResponse = await fetch('/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'Treffpunkt',
          content: `Target: ${targetPosition.lat}, ${targetPosition.lng}, Category: Treffpunkt`,
          teamId: activeTeam
        }),
      });

      if (!targetResponse.ok) {
        throw new Error('Failed to save target position');
      }

      const targetData = await targetResponse.json();
      
      // Oppdater lokal state med begge posisjoner
      setSavedPairs(prev => [
        ...prev, 
        { current: { ...lockedShotPosition }, category: 'Skyteplass', id: shotData.id },
        { target: { ...targetPosition }, category: 'Treffpunkt', id: targetData.id }
      ]);
      
      fetchPosts();
    setShowTargetDirectionUI(false);
      
    } catch (error) {
      console.error('Failed to save shot pair:', error);
      alert('Feil ved lagring av skuddpar: ' + (error as Error).message);
    }
  };

  // 2. Når bruker lagrer ny post, send insert til Supabase
  const handleSaveNewPost = async () => {
    if (newPostPosition && newPostName.trim()) {
      try {
        const response = await fetch('/api/posts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: newPostName.trim(),
            content: `Lat: ${newPostPosition.lat}, Lng: ${newPostPosition.lng}, Category: Post`,
            teamId: activeTeam
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to save post');
        }

        const data = await response.json();
        setSavedPairs(prev => [...prev, { current: { ...newPostPosition }, category: 'Post', id: data.id }]);
        setShowNewPostDialog(false);
        setNewPostName('');
        setNewPostPosition(null);
        fetchPosts();
      } catch (error) {
        console.error('Failed to save new post:', error);
        alert('Feil ved lagring av post: ' + (error as Error).message);
      }
    }
  };

  // Bekreft lagring av treffpunkt
  const handleConfirmTarget = async () => {
    if (!savedPairs.length || !savedPairs[savedPairs.length - 1].current) return;
    const base = savedPairs[savedPairs.length - 1].current;
    if (!base) return; // Guard mot undefined
    const bearing = ((targetDirection + 360) % 360);
    const pos = destinationPoint(base.lat, base.lng, targetRange, bearing);
    try {
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'Treffpunkt',
          content: `Target: ${pos.lat}, ${pos.lng}, Category: Treffpunkt`,
          teamId: activeTeam
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save post');
      }

      const data = await response.json();
      setSavedPairs(prev => [...prev, { target: { ...pos }, category: 'Treffpunkt', id: data.id }]);
      fetchPosts();
    } catch (error) {
      alert('Feil ved lagring av Treffpunkt: ' + (error as Error).message);
      setShowTargetDialog(false);
    }
    setShowTargetDialog(false);
  };

  // Defensive guards i toppen av renderblokken
  const safePlaces: PlaceData[] = Array.isArray(places) ? places : [];
  const hasSafePlaces = safePlaces.length > 0;
  const safeSavedPairs = Array.isArray(savedPairs) ? savedPairs : [];
  const hasSavedPairs = safeSavedPairs.length > 0;
  // Reverser rekkefølgen slik at index 0 = nyeste, index 1 = nest nyeste, etc.
  const reversedPairs = hasSavedPairs ? [...safeSavedPairs].reverse() : [];
  // Siste komplette skuddpar (med både skyteplass og treffpunkt)
  const lastFullPair = hasSavedPairs
    ? (() => {
        for (let i = safeSavedPairs.length - 1; i >= 0; i--) {
          const p = safeSavedPairs[i];
          if (p && p.current && p.target) return p;
        }
        return undefined;
      })()
    : undefined;
  // Fallback: avled siste par fra rekkefølgen i savedPairs når created_at mangler
  const lastDerivedPair = hasSavedPairs
    ? (() => {
        // 1) Finn siste Treffpunkt og en Skyteplass før den
        for (let i = safeSavedPairs.length - 1; i >= 0; i--) {
          const t = safeSavedPairs[i];
          if (t && t.category === 'Treffpunkt' && t.target) {
            for (let j = i - 1; j >= 0; j--) {
              const s = safeSavedPairs[j];
              if (s && s.category === 'Skyteplass' && s.current) {
                return { current: s.current, target: t.target, id: t.id };
              }
            }
          }
        }
        // 2) Finn siste Skyteplass og første Treffpunkt etter den
        for (let i = safeSavedPairs.length - 1; i >= 0; i--) {
          const s = safeSavedPairs[i];
          if (s && s.category === 'Skyteplass' && s.current) {
            for (let j = i + 1; j < safeSavedPairs.length; j++) {
              const t = safeSavedPairs[j];
              if (t && t.category === 'Treffpunkt' && t.target) {
                return { current: s.current, target: t.target, id: t.id };
              }
            }
          }
        }
        return undefined;
      })()
    : undefined;
  // Avled alle komplette par (skyteplass + treffpunkt) i rekkefølge
  const fullShotPairs = hasSavedPairs
    ? (() => {
        const withIdx = safeSavedPairs.map((p, idx) => ({ ...p, _idx: idx } as any));
        const skyteplasser = withIdx.filter((p: any) => p.category === 'Skyteplass' && p.current);
        const treffpunkter = withIdx.filter((p: any) => p.category === 'Treffpunkt' && p.target);
        const getTime = (p: any) => (p.created_at ? new Date(p.created_at).getTime() : p._idx);
        skyteplasser.sort((a: any, b: any) => getTime(a) - getTime(b));
        treffpunkter.sort((a: any, b: any) => getTime(a) - getTime(b));
        const result: { current: Position; target: Position; key: string }[] = [];
        for (const s of skyteplasser) {
          const t = treffpunkter.find((tp: any) => getTime(tp) > getTime(s));
          if (t) {
            result.push({ current: s.current as Position, target: t.target as Position, key: `${s.id}-${t.id}` });
          }
        }
        return result;
      })()
    : [];
  
  // I track-mode: bruk siste skyteplass. I søk-modus: bruk valgt index
  const lastPair = hasSavedPairs 
    ? (mode === 'track' 
        ? safeSavedPairs.filter(p => p.category === 'Skyteplass').pop() // Finn siste skyteplass i track-mode
        : reversedPairs[adjustedSelectedTargetIndex]) // Bruk justert index i søk-modus
    : undefined;

  // Last lagrede spor når komponenten mountes og når modus endres
  useEffect(() => {
    // Last data i alle modus (aware, track og søk)
    const tracks = loadSavedTracks();
    setSavedTracks(tracks);
    
    const finds = loadSavedFinds();
    setSavedFinds(finds);
    
    const observations = loadSavedObservations();
    setSavedObservations(observations);
  }, [mode, adjustedSelectedTargetIndex, lastPair?.id, showAllTracksAndFinds]); // Reager på endringer i modus, valgt treffpunkt, skuddpar og visningsmodus

  // Funksjon for å slette et spesifikt skuddpar
  const handleDeleteShotPair = async (clickedPairId: number) => {
    if (!window.confirm('Er du sikker på at du vil slette dette skuddparet?')) return;
    
    try {
      // Finn hele skuddparet basert på timestamp
      const clickedPair = savedPairs.find(p => p.id === clickedPairId);
      if (!clickedPair || !clickedPair.created_at) {
        alert('Kunne ikke finne skuddparet');
        return;
      }
      
      // Finn skyteplass og treffpunkt som tilhører samme skuddpar
      const clickedTime = new Date(clickedPair.created_at).getTime();
      const timeWindow = 5 * 60 * 1000; // 5 minutter vindu
      
      const relatedPairs = savedPairs.filter(p => {
        const pairTime = new Date(p.created_at || '').getTime();
        return Math.abs(pairTime - clickedTime) < timeWindow;
      });
      
      if (relatedPairs.length === 0) {
        alert('Kunne ikke finne tilhørende poster');
        return;
      }
      
      // Slett alle relaterte poster fra API
      const pairIds = relatedPairs.map(p => p.id);
      try {
        const response = await fetch(`/api/posts?ids=${pairIds.join(',')}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          throw new Error('Failed to delete posts');
        }
      } catch (error) {
        alert('Feil ved sletting: ' + (error as Error).message);
        return;
      }
      
      // Slett tilhørende spor og funn fra localStorage
      const existingTracks = JSON.parse(localStorage.getItem('searchTracks') || '{}');
      const existingFinds = JSON.parse(localStorage.getItem('searchFinds') || '{}');
      
      // Fjern spor med matching shotPairId
      Object.keys(existingTracks).forEach(trackId => {
        if (existingTracks[trackId].shotPairId && pairIds.includes(parseInt(existingTracks[trackId].shotPairId))) {
          delete existingTracks[trackId];
        }
      });
      localStorage.setItem('searchTracks', JSON.stringify(existingTracks));
      
      // Fjern funn med matching shotPairId
      Object.keys(existingFinds).forEach(findId => {
        if (existingFinds[findId].shotPairId && pairIds.includes(parseInt(existingFinds[findId].shotPairId))) {
          delete existingFinds[findId];
        }
      });
      localStorage.setItem('searchFinds', JSON.stringify(existingFinds));
      
      // Oppdater lokal state
      setSavedPairs(prev => prev.filter(pair => !pairIds.includes(pair.id)));
      
      // Oppdater spor og funn state
      setSavedTracks(prev => prev.filter(track => 
        !track.shotPairId || !pairIds.includes(parseInt(track.shotPairId))
      ));
      setSavedFinds(prev => prev.filter(find => 
        !find.shotPairId || !pairIds.includes(parseInt(find.shotPairId))
      ));
      
      alert('Skuddpar slettet!');
    } catch (error) {
      console.error('Feil ved sletting av skuddpar:', error);
      alert('Feil ved sletting av skuddpar');
    }
  };

  // Legg til funksjon for å slette alle skuddpar
  type ShotCategory = 'Skyteplass' | 'Treffpunkt';
  const handleDeleteAllShots = async () => {
    if (!window.confirm('Er du sikker på at du vil slette alle skuddpar?')) return;
    // Slett fra API - delete posts that contain Skyteplass or Treffpunkt in content
    try {
      // Get posts for active team first to find the ones to delete
      if (!activeTeam) {
        alert('Ingen aktivt team valgt');
        return;
      }
      
      const response = await fetch(`/api/posts?teamId=${activeTeam}`);
      if (!response.ok) {
        throw new Error('Failed to fetch posts');
      }
      const posts = await response.json();
      
      // Filter posts that contain Skyteplass or Treffpunkt
      const postsToDelete = posts.filter((post: any) => 
        post.content && (post.content.includes('Skyteplass') || post.content.includes('Treffpunkt'))
      );
      
      if (postsToDelete.length > 0) {
        const ids = postsToDelete.map((post: any) => post.id);
        const deleteResponse = await fetch(`/api/posts?ids=${ids.join(',')}`, {
          method: 'DELETE',
        });

        if (!deleteResponse.ok) {
          throw new Error('Failed to delete posts');
        }
      }
    } catch (error) {
      alert('Feil ved sletting: ' + (error as Error).message);
      return;
    }
    // Oppdater lokal state
    setSavedPairs(prev => prev.filter(pair => pair.category !== 'Skyteplass' && pair.category !== 'Treffpunkt'));
  };

  const [layerIdx, setLayerIdx] = useState(0); // 0 = Flyfoto

  // Ny funksjon for å lagre treffpunkt med valgt retning og avstand
  const handleSaveTargetWithDirection = async () => {
    // Bruk den nye forenklede funksjonen som lagrer både skyteplass og treffpunkt
    await handleTargetModalSave();
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('aware_default_position');
      if (saved) {
        try {
          const pos = JSON.parse(saved);
          if (pos && typeof pos.lat === 'number' && typeof pos.lng === 'number') {
            setCurrentPosition({ lat: pos.lat, lng: pos.lng });
            return;
          }
        } catch {}
      }
      // fallback hvis ikke lagret
      setCurrentPosition({ lat: 60.424834440433045, lng: 12.408766398367092 });
    }
  }, []);

  useEffect(() => {
    if (currentPosition && onPositionChange) {
      onPositionChange(currentPosition);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPosition]);

  if (!currentPosition) {
    return <div className="w-full h-screen flex items-center justify-center text-lg text-gray-500">Laster posisjon...</div>;
  }

  // Generer default navn med dato og tid
  const generateDefaultName = (type: 'track' | 'find' | 'observation') => {
    const now = new Date();
    const date = now.toLocaleDateString('nb-NO', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
    const time = now.toLocaleTimeString('nb-NO', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    if (type === 'track') {
      return `Spor ${date} ${time}`;
    } else if (type === 'find') {
      return `Funn ${date} ${time}`;
    } else {
      return `Obs ${date} ${time}`;
    }
  };

  return (
    <div className="w-full h-screen relative">
      {/* Rett før <MapContainer ...> i render: */}
      <MapContainer
        center={[currentPosition.lat, currentPosition.lng]}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
        attributionControl={true}
      >
        <TileLayer
          url={LAYER_CONFIGS[layerIdx].url}
          attribution={LAYER_CONFIGS[layerIdx].attribution}
          maxZoom={18}
        />
        
        <MapController 
          onPositionChange={(pos) => {
            setCurrentPosition(pos);
          }} 
          onGpsPositionChange={(pos) => {
            setGpsPosition(pos);
          }} 
          radius={radius}
          onError={() => {
            setHasError(true);
            onError?.();
          }}
          categoryFilters={categoryFilters}
          categoryConfigs={categoryConfigs}
          shouldScan={shouldScan}
          angleRange={angleRange}
          showMarkers={showMarkers}
          isLiveMode={isLiveMode}
          onLoadingChange={setIsScanning}
          mode={mode}
          showOnlyLastShot={showOnlyLastShot}
          onSearchPositionChange={(pos) => {
            setSearchPosition(pos);
          }}
          onPlacesChange={(places) => {
            setPlaces(places);
          }}
          clearPlaces={clearPlaces}
          isMapLocked={isMapLocked}
        />
        
        {/* Tracking controller for søk-modus */}
        <TrackingController 
          isTracking={isTracking}
          mode={mode}
          onTrackingPointsChange={onTrackingPointsChange || (() => {})}
          currentPosition={currentPosition}
          gpsPosition={gpsPosition}
          isLiveMode={isLiveMode}
        />
        
        {/* Hunting area click handler */}
        <HuntingAreaClickHandler 
          isDefiningHuntingArea={isDefiningHuntingArea}
          onPointAdded={handleAddHuntingAreaPoint}
        />

        {/* Compass slice - shows direction as red pie slice */}
        {currentPosition && (
          <CompassSlice 
            heading={currentPosition.heading || null}
            isActive={compassMode === 'on'}
            isLocked={isCompassLocked}
            centerLat={currentPosition.lat}
            centerLng={currentPosition.lng}
            lengthPercent={compassSliceLength}
            angleRange={1}
          />
        )}

        {/* Map rotator - rotates map when compass is locked */}
        <MapRotator 
          heading={currentPosition?.heading || null}
          isEnabled={compassMode === 'on' && isCompassLocked}
        />

        {/* MSR-retikkel controller */}
        <MSRRetikkel 
          isVisible={localShowMSRRetikkel}
          opacity={localMSRRetikkelOpacity}
          style={localMSRRetikkelStyle}
          verticalPosition={msrRetikkelVerticalPosition}
          currentPosition={currentPosition}
        />
        
        {/* Jaktgrenser - render active hunting area boundary */}
        {showHuntingBoundary && activeHuntingAreaId && huntingAreas && huntingAreas.length > 0 && (() => {
          const activeArea = huntingAreas.find(area => area.id === activeHuntingAreaId);
          if (!activeArea || !activeArea.coordinates || activeArea.coordinates.length < 3) return null;
          
          return (
            <Polyline
              key={`hunting-area-${activeArea.id}`}
              positions={activeArea.coordinates}
              pathOptions={{
                color: huntingBoundaryColor || activeArea.color || '#00ff00',
                weight: huntingBoundaryWeight || activeArea.lineWeight || 3,
                opacity: (huntingBoundaryOpacity || 80) / 100,
              }}
            >
              <Popup>
                <div className="text-center">
                  <div className="font-semibold text-sm">{activeArea.name}</div>
                  <div className="text-xs text-gray-600 mt-1">Jaktgrense</div>
                </div>
              </Popup>
            </Polyline>
          );
        })()}
        
        {/* Hunting area definition - preview while defining */}
        {isDefiningHuntingArea && huntingAreaPoints.length > 0 && (
          <>
            {/* Show points as markers */}
            {huntingAreaPoints.map((point, index) => (
              <Circle
                key={`hunting-point-${index}`}
                center={point}
                radius={3}
                pathOptions={{
                  color: huntingBoundaryColor,
                  fillColor: huntingBoundaryColor,
                  fillOpacity: (huntingBoundaryOpacity || 80) / 100,
                  weight: 2,
                }}
              />
            ))}
            
            {/* Show line between points */}
            {huntingAreaPoints.length > 1 && (
              <Polyline
                positions={huntingAreaPoints}
                pathOptions={{
                  color: huntingBoundaryColor,
                  weight: huntingBoundaryWeight,
                  opacity: (huntingBoundaryOpacity || 80) / 100,
                  dashArray: '5, 5',
                }}
              />
            )}
          </>
        )}

        {/* Radius circle: kun i aware-mode */}
        {mode === 'aware' && searchPosition && (
          <>
            {console.log('Rendering search circle, searchPosition:', searchPosition)}
          <Circle
              key={`radius-${radius}-${searchPosition.lat}-${searchPosition.lng}`}
              center={[searchPosition.lat, searchPosition.lng]}
            radius={radius ?? 0}
            pathOptions={{
              color: '#3b82f6',
              fillColor: '#3b82f6',
              fillOpacity: 0.0,
              weight: 2,
            }}
          />
          </>
        )}
        
        {/* Rød prikk for egen posisjon i søk-modus */}
        {mode === 'søk' && currentPosition && (
          <Marker
            key={`current-position-søk-${currentPosition.lat}-${currentPosition.lng}`}
            position={[currentPosition.lat, currentPosition.lng]}
            icon={L.divIcon({
              className: 'custom-marker current-position-marker',
              html: `<div style="width: 12px; height: 12px; background-color: #EF4444; opacity: 1; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div>`,
              iconSize: [12, 12],
              iconAnchor: [6, 6],
            })}
          />
        )}
        
        {/* Tracking points i søk-modus */}
        {mode === 'søk' && trackingPoints && trackingPoints.length > 0 && (
          <>
            {/* Gule sirkler for hvert tracking punkt */}
            {trackingPoints.map((point, index) => (
              <Circle
                key={`tracking-point-${index}`}
                center={[point.lat, point.lng]}
                radius={2}
                pathOptions={{
                  color: '#EAB308',
                  weight: 1.5,
                  fillColor: '#EAB308',
                  fillOpacity: 0.5,
                }}
                eventHandlers={{
                  click: (e) => {
                    // Åpne popup manuelt på mobil
                    const popup = e.target.getPopup();
                    if (popup) {
                      popup.openPopup();
                    }
                  }
                }}
              >
                <Popup>
                  <div className="text-center">
                    <div className="font-semibold text-sm">Aktivt spor</div>
                    <div className="text-xs text-gray-500 mt-1">
                      Under opprettelse
                    </div>
                  </div>
                </Popup>
              </Circle>
            ))}
            
            {/* Gul linje mellom tracking punktene */}
            {trackingPoints && trackingPoints.length > 1 && (
              <Polyline
                positions={trackingPoints.map(point => [point.lat, point.lng])}
                pathOptions={{ 
                  color: '#EAB308', 
                  weight: 2,
                  opacity: 0.8
                }}
                eventHandlers={{
                  click: (e) => {
                    // Åpne popup manuelt på mobil
                    const popup = e.target.getPopup();
                    if (popup) {
                      popup.openPopup();
                    }
                  }
                }}
              >
                <Popup>
                  <div className="text-center">
                    <div className="font-semibold text-sm">Aktivt spor</div>
                    <div className="text-xs text-gray-500 mt-1">
                      Under opprettelse
                    </div>
                  </div>
                </Popup>
              </Polyline>
            )}
          </>
        )}

        {/* Avstandsmåling linjer - kun i aware-modus */}
        {mode === 'aware' && measurementPoints.length > 1 && (
          <Polyline
            positions={measurementPoints.map(point => [point.lat, point.lng])}
            pathOptions={{ 
              color: '#3b82f6', 
              weight: 3,
              opacity: 0.8
            }}
          />
        )}

        {/* Avstandsmåling markører - kun i aware-modus */}
        {mode === 'aware' && measurementPoints.map((point, index) => (
          <Marker
            key={`measurement-point-${index}`}
            position={[point.lat, point.lng]}
            icon={L.divIcon({
              className: 'custom-marker measurement-marker',
              html: `<div style="width: 12px; height: 12px; background-color: #3b82f6; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 4px rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; font-size: 8px; color: white; font-weight: bold;">${index + 1}</div>`,
              iconSize: [12, 12],
              iconAnchor: [6, 6],
            })}
          />
        ))}

        {/* Alle lagrede spor i søk-modus */}
        {((mode === 'søk' && showAllTracksAndFinds) || (mode === 'aware' && showTracks) || (mode === 'track' && showTracks)) && savedTracks && savedTracks.length > 0 && (
          <>
            {savedTracks.map((track) => (
              <React.Fragment key={`saved-track-${track.id}`}>
                {/* Fargede sirkler for hvert lagret spor */}
                {track.points && track.points.map((point: Position, index: number) => (
                  <Circle
                    key={`saved-track-${track.id}-point-${index}`}
                    center={[point.lat, point.lng]}
                    radius={2}
                    pathOptions={{
                      color: track.color || '#EAB308',
                      weight: 1.5,
                      fillColor: track.color || '#EAB308',
                      fillOpacity: 0.3, // Litt mer transparent enn aktive spor
                    }}
                    eventHandlers={{
                      click: (e) => {
                        // Åpne popup manuelt på mobil
                        const popup = e.target.getPopup();
                        if (popup) {
                          popup.openPopup();
                        }
                      }
                    }}
                  >
                    <Popup>
                      <div className="text-center">
                        <div className="font-semibold text-sm">{track.name || 'Unnamed track'}</div>
                        <div className="text-xs text-gray-600 mt-1">
                          {new Date(track.createdAt).toLocaleDateString('nb-NO')}
                        </div>
                      </div>
                    </Popup>
                  </Circle>
                ))}
                
                {/* Farget linje mellom punktene i lagret spor */}
                {track.points && track.points.length > 1 && (
                  <Polyline
                    positions={track.points.map((point: Position) => [point.lat, point.lng])}
                    pathOptions={{ 
                      color: track.color || '#EAB308', 
                      weight: 1.5,
                      opacity: 0.6 // Litt mer transparent enn aktive spor
                    }}
                    eventHandlers={{
                      click: (e) => {
                        // Åpne popup manuelt på mobil
                        const popup = e.target.getPopup();
                        if (popup) {
                          popup.openPopup();
                        }
                      }
                    }}
                  >
                    <Popup>
                      <div className="text-center">
                        <div className="font-semibold text-sm">{track.name || 'Unnamed track'}</div>
                        <div className="text-xs text-gray-600 mt-1">
                          {new Date(track.createdAt).toLocaleDateString('nb-NO')}
                        </div>
                      </div>
                    </Popup>
                  </Polyline>
                )}
              </React.Fragment>
            ))}
          </>
        )}

        {/* Alle lagrede funn i søk-modus */}
        {((mode === 'søk' && showAllTracksAndFinds) || (mode === 'aware' && showObservations) || (mode === 'track' && showObservations)) && savedFinds && savedFinds.length > 0 && (
          <>
            {savedFinds.map((find) => (
              <Marker
                key={`saved-find-${find.id}`}
                position={[find.position.lat, find.position.lng]}
                icon={L.divIcon({
                  className: 'custom-marker find-marker',
                  html: `<div style="width: 16px; height: 16px; position: relative;">
                    <div style="width: 2px; height: 16px; background-color: ${find.color}; position: absolute; left: 7px; top: 0;"></div>
                    <div style="width: 16px; height: 2px; background-color: ${find.color}; position: absolute; left: 0; top: 7px;"></div>
                  </div>`,
                  iconSize: [16, 16],
                  iconAnchor: [8, 8],
                })}
                eventHandlers={{
                  click: (e) => {
                    // Åpne popup manuelt på mobil
                    const popup = e.target.getPopup();
                    if (popup) {
                      popup.openPopup();
                    }
                  }
                }}
              >
                <Popup>
                  <div className="text-center">
                    <div className="font-semibold text-sm">{find.name}</div>
                    <div className="text-xs text-gray-600 mt-1">
                      {new Date(find.createdAt).toLocaleDateString('nb-NO')}
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </>
        )}
        
        {/* Alle lagrede observasjoner i søk-modus */}
        {((mode === 'søk' && showObservations) || (mode === 'aware' && showObservations) || (mode === 'track' && showObservations)) && savedObservations && savedObservations.length > 0 && (
          <>
            {savedObservations.map((observation) => (
            <Circle
                key={`saved-observation-${observation.id}`}
                center={[observation.position.lat, observation.position.lng]}
                radius={observationSize}
                pathOptions={{
                  color: observation.color,
                  fillColor: 'transparent',
                  fillOpacity: 0,
                  weight: 2,
                }}
                eventHandlers={{
                  click: (e) => {
                    // Åpne popup manuelt på mobil
                    const popup = e.target.getPopup();
                    if (popup) {
                      popup.openPopup();
                    }
                  }
                }}
              >
                <Popup>
                  <div className="text-center">
                    <div className="font-semibold text-sm">{observation.name}</div>
                    <div className="text-xs text-gray-600 mt-1">
                      {new Date(observation.createdAt).toLocaleDateString('nb-NO')}
                    </div>
                  </div>
                </Popup>
              </Circle>
            ))}
          </>
        )}
        {/* Live preview av radius-sirkel når radius-modal er aktiv */}
        {showTargetRadiusModal && lockedShotPosition && (
          <Circle
            key={`radius-preview-${targetRange}-${lockedShotPosition.lat}-${lockedShotPosition.lng}`}
            center={[lockedShotPosition.lat, lockedShotPosition.lng]}
            radius={targetRange}
            pathOptions={{
              color: '#2563eb',
              fillColor: '#2563eb',
              fillOpacity: 0.08,
              weight: 2,
              dashArray: '5 5',
            }}
          />
        )}
        
        {showTargetDirectionUI && lockedShotPosition && (
          <>
            <Circle
              key={`target-radius-${targetRange}-${lockedShotPosition.lat}-${lockedShotPosition.lng}`}
              center={[lockedShotPosition.lat, lockedShotPosition.lng]}
              radius={targetRange}
              pathOptions={{
                color: '#2563eb',
                fillColor: '#2563eb',
                fillOpacity: 0.1,
                weight: 2,
              }}
            />
            {/* Linje fra skyteplass ut til sirkelen i valgt retning */}
            <Polyline
              positions={[
                [lockedShotPosition.lat, lockedShotPosition.lng],
                [
                  destinationPoint(
                    lockedShotPosition.lat,
                    lockedShotPosition.lng,
                    targetRange,
                    targetDirection
                  ).lat,
                  destinationPoint(
                    lockedShotPosition.lat,
                    lockedShotPosition.lng,
                    targetRange,
                    targetDirection
                  ).lng,
                ],
              ]}
              pathOptions={{ color: '#2563eb', weight: 3 }}
            />
          </>
        )}

        {/* Live preview av observasjon radius-sirkel når radius-modal er aktiv */}
        {showObservationRangeModal && currentPosition && (
          <Circle
            key={`obs-radius-preview-${observationRange}-${currentPosition.lat}-${currentPosition.lng}`}
            center={[currentPosition.lat, currentPosition.lng]}
            radius={observationRange}
            pathOptions={{
              color: '#16a34a',
              fillColor: '#16a34a',
              fillOpacity: 0.08,
              weight: 2,
              dashArray: '5 5',
            }}
          />
        )}
        
        {/* Preview av observasjon når retning velges */}
        {showObservationDirectionUI && currentPosition && (
          <>
            <Circle
              key={`obs-radius-${observationRange}-${currentPosition.lat}-${currentPosition.lng}`}
              center={[currentPosition.lat, currentPosition.lng]}
              radius={observationRange}
              pathOptions={{
                color: '#16a34a',
                fillColor: '#16a34a',
                fillOpacity: 0.1,
                weight: 2,
              }}
            />
            {/* Linje fra nåværende posisjon ut til sirkelen i valgt retning */}
            <Polyline
              positions={[
                [currentPosition.lat, currentPosition.lng],
                [
                  destinationPoint(
                    currentPosition.lat,
                    currentPosition.lng,
                    observationRange,
                    observationDirection
                  ).lat,
                  destinationPoint(
                    currentPosition.lat,
                    currentPosition.lng,
                    observationRange,
                    observationDirection
                  ).lng,
                ],
              ]}
              pathOptions={{ color: '#16a34a', weight: 3 }}
            />
            {/* Marker på observasjonsposisjon */}
            <Circle
              center={[
                destinationPoint(
                  currentPosition.lat,
                  currentPosition.lng,
                  observationRange,
                  observationDirection
                ).lat,
                destinationPoint(
                  currentPosition.lat,
                  currentPosition.lng,
                  observationRange,
                  observationDirection
                ).lng,
              ]}
              radius={observationSize}
              pathOptions={{
                color: observationColor,
                fillColor: observationColor,
                fillOpacity: 0.7,
                weight: 2,
              }}
            />
          </>
        )}

        {/* Place markers: kun i aware-mode */}
        {(mode === 'aware' || mode === 'søk') && showMarkers && hasSafePlaces && safePlaces
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
            const config = categoryConfigs[place.category as keyof CategoryFilter] || { color: '#999', opacity: 0.8, icon: '' };
            return (
              <Marker
                key={`${place.type}-${place.id}`}
                position={Array.isArray(place) && place.length === 2 ? place : [0,0]}
                icon={L.divIcon({
                  className: 'custom-marker place-marker',
                  html: `<div style="width: 12px; height: 12px; background-color: ${config.color}; opacity: ${config.opacity}; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div>`,
                  iconSize: [12, 12],
                  iconAnchor: [6, 6],
                })}
              />
            );
          })}

        {/* Saved points: vis blå X for hver current-posisjon i track-mode */}
        {((mode === 'track' && showShots) || (mode === 'søk' && showShots) || (mode === 'aware' && showShots)) && hasSavedPairs && (
          <>

            
            {mode === 'track'
              ? (() => {
                  if (showOnlyLastShot) {
                    const last = lastFullPair || lastDerivedPair || fullShotPairs[fullShotPairs.length - 1];
                    if (!last) return null;
                    return (
                      <>
                        {last.current && (
                          <Circle
                            center={[last.current.lat, last.current.lng]}
                            radius={shotSize}
                            pathOptions={{ color: shotColor, weight: 1.5, fillColor: shotColor, fillOpacity: 0.5 }}
                          />
                        )}
                        {last.target && (
                          <Circle
                            center={[last.target.lat, last.target.lng]}
                            radius={targetSize}
                            pathOptions={{ color: targetColor, weight: 2, fillColor: targetColor, fillOpacity: 0.4 }}
                          />
                        )}
                      </>
                    );
                  }
                  // Vis alle skuddpar (punkter) – samme logikk som i Aware
                  return (
                    <>
                      {safeSavedPairs.filter(Boolean).map((pair, idx) => (
                        <React.Fragment key={pair.id ?? idx}>
                          {pair && pair.current && (
                            <Circle
                              center={[pair.current.lat, pair.current.lng]}
                          radius={shotSize}
                              pathOptions={{
                                color: shotColor,
                                weight: 1.5,
                                fillColor: shotColor,
                                fillOpacity: 0.5,
                              }}
                            />
                          )}
                          {pair && pair.target && (
                            <Circle
                              center={[pair.target.lat, pair.target.lng]}
                              radius={targetSize}
                              pathOptions={{
                                color: targetColor,
                                weight: 2,
                                fillColor: targetColor,
                                fillOpacity: 0.4,
                              }}
                            />
                          )}
                        </React.Fragment>
                      ))}
                      {/* Stiplede linjer for alle par (samme som Aware) */}
                      {safeSavedPairs.filter(Boolean).map((pair, idx) => (
                        pair && pair.current && pair.target ? (
                          <Polyline
                            key={`track-all-poly-${pair.id ?? idx}`}
                            positions={[[pair.current.lat, pair.current.lng], [pair.target.lat, pair.target.lng]]}
                            pathOptions={{ color: targetLineColor, weight: targetLineWeight, dashArray: '8 12' }}
                          />
                        ) : null
                      ))}
                    </>
                  );
                })()
              : mode === 'søk' 
                ? (() => {
                    // Track-mode (søk): align with Shoot logic
                    if (showOnlyLastShot) {
                      const last = (lastFullPair || lastDerivedPair || fullShotPairs[fullShotPairs.length - 1]) as any;
                      if (!last) return null;
                      return (
                        <>
                          {last.current && (
                            <Circle
                              center={[last.current.lat, last.current.lng]}
                              radius={shotSize}
                              pathOptions={{ color: shotColor, weight: 1.5, fillColor: shotColor, fillOpacity: 0.5 }}
                            />
                          )}
                          {last.target && (
                            <Circle
                              center={[last.target.lat, last.target.lng]}
                              radius={targetSize}
                              pathOptions={{ color: targetColor, weight: 2, fillColor: targetColor, fillOpacity: 0.4 }}
                            />
                          )}
                          {last.current && last.target && (
                            <Polyline
                              key={`sok-last-poly`}
                              positions={[[last.current.lat, last.current.lng], [last.target.lat, last.target.lng]]}
                              pathOptions={{ color: targetLineColor, weight: targetLineWeight, dashArray: '8 12' }}
                            />
                          )}
                        </>
                      );
                    }
                    return (
                      <>
                        {safeSavedPairs.filter(Boolean).map((pair, idx) => (
                          <React.Fragment key={pair.id ?? idx}>
                            {pair && pair.current && (
                              <Circle
                                center={[pair.current.lat, pair.current.lng]}
                                radius={shotSize}
                                pathOptions={{
                                  color: shotColor,
                                  weight: 1.5,
                                  fillColor: shotColor,
                                  fillOpacity: 0.5,
                                }}
                              />
                            )}
                            {pair && pair.target && (
                              <Circle
                                center={[pair.target.lat, pair.target.lng]}
                                radius={targetSize}
                                pathOptions={{
                                  color: targetColor,
                                  weight: 2,
                                  fillColor: targetColor,
                                  fillOpacity: 0.4,
                                }}
                              />
                            )}
                          </React.Fragment>
                        ))}
                        {safeSavedPairs.filter(Boolean).map((pair, idx) => (
                          pair && pair.current && pair.target ? (
                            <Polyline
                              key={`sok-all-poly-${pair.id ?? idx}`}
                              positions={[[pair.current.lat, pair.current.lng], [pair.target.lat, pair.target.lng]]}
                              pathOptions={{ color: targetLineColor, weight: targetLineWeight, dashArray: '8 12' }}
                            />
                          ) : null
                        ))}
                      </>
                    );
                  })()
              : (() => {
                  if (showOnlyLastShot) {
                    const last = (lastFullPair || lastDerivedPair || fullShotPairs[fullShotPairs.length - 1]) as any;
                    if (!last) return null;
                    return (
                      <>
                        {last.current && (
                          <Circle
                            center={[last.current.lat, last.current.lng]}
                            radius={shotSize}
                            pathOptions={{ color: shotColor, weight: 1.5, fillColor: shotColor, fillOpacity: 0.5 }}
                          />
                        )}
                        {last.target && (
                          <Circle
                            center={[last.target.lat, last.target.lng]}
                            radius={targetSize}
                            pathOptions={{ color: targetColor, weight: 2, fillColor: targetColor, fillOpacity: 0.4 }}
                          />
                        )}
                        {last.current && last.target && (
                          <Polyline
                            key={`aware-last-poly`}
                            positions={[[last.current.lat, last.current.lng], [last.target.lat, last.target.lng]]}
                            pathOptions={{ color: targetLineColor, weight: targetLineWeight, dashArray: '8 12' }}
                          />
                        )}
                      </>
                    );
                  }
                  return safeSavedPairs.filter(Boolean).map((pair, idx) => (
                    <React.Fragment key={pair.id ?? idx}>
                      {pair && pair.current && (
                        <Circle
                          center={[pair.current.lat, pair.current.lng]}
                          radius={shotSize}
                          pathOptions={{
                            color: shotColor,
                            weight: 1.5,
                            fillColor: shotColor,
                            fillOpacity: 0.5,
                          }}
                        />
                      )}
                      {pair && pair.target && (
                        <Circle
                          center={[pair.target.lat, pair.target.lng]}
                          radius={targetSize}
                          pathOptions={{
                            color: targetColor,
                            weight: 2,
                            fillColor: targetColor,
                            fillOpacity: 0.4,
                          }}
                        />
                      )}
                      {pair && pair.current && pair.target && (pair.current.lat !== pair.target.lat || pair.current.lng !== pair.target.lng) && (
                        (() => {
                          const positions: [number, number][] = [
                            [pair.current.lat, pair.current.lng],
                            [pair.target.lat, pair.target.lng],
                          ];
                          const polyKey = `polyline-${pair.id ?? idx}`;
                          return (
                            <Polyline
                              key={polyKey}
                              positions={positions}
                              pathOptions={{ color: targetLineColor, weight: targetLineWeight, dashArray: '8 12' }}
                            />
                          );
                        })()
                      )}
                    </React.Fragment>
                  ));
                })()}
          </>
        )}
        {/* Interaktiv preview for target-posisjon i retning-UI */}
        {showTargetDirectionUI && lockedShotPosition && (
          <>
            {/* Sirkel for valgt radius */}
            <Circle
              center={[lockedShotPosition.lat, lockedShotPosition.lng]}
              radius={targetRange}
              pathOptions={{
                color: '#2563eb',
                fillColor: '#2563eb',
                fillOpacity: 0.08,
                weight: 2,
                dashArray: '2 6',
              }}
            />
            {/* Strek fra current til previewTarget */}
            {previewTarget && (
              <>
                <Polyline
                  positions={previewTarget ? [[lockedShotPosition.lat, lockedShotPosition.lng], [previewTarget.lat, previewTarget.lng]] : []}
                  pathOptions={{ color: '#2563eb', weight: 2 }}
                />
                {/* Markør på sirkelen med grad-tall */}
                <Marker
                  position={Array.isArray(previewTarget) && previewTarget.length === 2 ? previewTarget : [0,0]}
                  icon={L.divIcon({
                    className: 'custom-marker preview-target',
                    html: '<div style="font-size: 20px; color: #2563eb; font-weight: bold;">•</div>',
                    iconSize: [20, 20],
                    iconAnchor: [10, 10],
                  })}
                >
                  <Tooltip direction="top" offset={[0, -10]} permanent>
                    {((targetDirection + 360) % 360)}°
                  </Tooltip>
                </Marker>
              </>
            )}
          </>
        )}
        {/* Tegn stiplede linjer mellom alle gyldige par */}
        {(mode === 'track' || mode === 'søk') && showShots && (
          showOnlyLastShot
            ? (() => {
                const pair = lastFullPair || lastDerivedPair || fullShotPairs[fullShotPairs.length - 1];
                if (pair && pair.current && pair.target) {
                  const positions: [number, number][] = [
                    [pair.current.lat, pair.current.lng],
                    [pair.target.lat, pair.target.lng],
                  ];
                  return (
                    <Polyline
                      key={`polyline-last-full-${(pair as any).key ?? (pair as any).id ?? 'last'}`}
                      positions={positions}
                      pathOptions={{ color: targetLineColor, weight: targetLineWeight, dashArray: '8 12' }}
                    />
                  );
                }
                return null;
              })()
            : (() => {
                return fullShotPairs.map(p => (
                  <Polyline
                    key={`polyline-${p.key}`}
                    positions={[[p.current.lat, p.current.lng], [p.target.lat, p.target.lng]]}
                    pathOptions={{ color: targetLineColor, weight: targetLineWeight, dashArray: '8 12' }}
                  />
                ));
              })()
        )}
        {/* TODO: Tegn linje og target-pos senere */}
      </MapContainer>

      {/* Center marker overlay - always visible in center */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-[1000]">
        {/* Vanlig prikk alltid synlig */}
        <div className="w-4 h-4 bg-red-600 border-2 border-white rounded-full shadow-lg"></div>
        
        {/* Retningskakestykke i live mode */}
        {isLiveMode && currentPosition?.heading !== undefined && (
          <div 
            className="absolute top-1/2 left-1/2 w-0 h-0"
            style={{ 
              transform: `translate(-50%, -50%) rotate(${currentPosition.heading}deg)`,
            }}
          >
            {/* Kakestykke med 3 grader bredde og 100m lengde */}
            <svg 
              width="200" 
              height="200" 
              viewBox="0 0 200 200"
              style={{
                transform: 'translateX(-100px) translateY(-100px)'
              }}
            >
              {/* Definer gradient for kakestykket */}
              <defs>
                <linearGradient id="sectorGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="rgba(220, 38, 38, 0.2)" />
                  <stop offset="100%" stopColor="rgba(220, 38, 38, 0.2)" />
                </linearGradient>
              </defs>
              
              {/* Kakestykke: 3 grader bredde, 100m lengde */}
              <path
                d="M 100 100 L 100 0 A 100 100 0 0 1 102.6 0 L 100 100 Z"
                fill="url(#sectorGradient)"
                stroke="rgba(220, 38, 38, 0.8)"
                strokeWidth="1"
              />
            </svg>
          </div>
        )}
      </div>



      {/* Settings & Filter Buttons - Top Right */}
      {/* Fjern hele blokken for Settings & Filter Buttons - Top Right */}





      

      {/* --- PATCH FOR BEDRE KNAPPEPLASSERING --- */}
      {/* Track-mode: Knapp for lagring av skuddpar */}
      {mode === 'track' && (
        <div className="fixed bottom-4 inset-x-0 z-[2001] flex flex-wrap justify-center items-center gap-2 px-2" style={{ pointerEvents: 'none' }}>
          <button
            onClick={handleSaveCurrentPos}
            className="flex-1 min-w-[80px] max-w-[140px] w-auto h-12 rounded-full shadow-lg font-semibold text-[0.875rem] transition-colors border flex flex-col items-center justify-center px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white border-blue-700"
            title="Lagre skuddpar (Skyteplass + Treffpunkt)"
            style={{ pointerEvents: 'auto' }}
          >
            <span className="text-[10px] mt-0.5">Target</span>
          </button>
        </div>
      )}

      {/* Avstandsmåling knapper - kun i aware-modus */}
      {mode === 'aware' && (
        <div className="fixed bottom-4 inset-x-0 z-[2001] flex flex-wrap justify-center items-center gap-2 px-2" style={{ pointerEvents: 'none' }}>
          {/* Reset-knapp - alltid synlig */}
            <button
            onClick={handleResetMeasurement}
            className={`w-18 h-12 rounded-full shadow-lg font-semibold text-[0.75rem] transition-colors border flex items-center justify-center ${
              (isMeasuring || measurementPoints.length > 0 || searchPosition)
                ? 'bg-red-600 hover:bg-red-700 text-white border-red-700'
                : 'bg-gray-300 text-gray-400 border-gray-400 cursor-not-allowed'
            }`}
            disabled={!isMeasuring && measurementPoints.length === 0 && !searchPosition}
            style={{ pointerEvents: 'auto' }}
            >
                  ✕
            </button>

          {/* Avstandstekst - alltid synlig */}
          <div className="bg-white rounded-full px-3 h-12 shadow-lg border min-w-[60px] flex items-center justify-center">
            <span className="text-base font-semibold text-black">
              {totalDistance > 0 
                ? (totalDistance < 1000 
                    ? `${Math.round(totalDistance)}m` 
                    : `${(totalDistance / 1000).toFixed(2)}km`)
                : '0m'
              }
                     </span>
             </div>

          {/* Måle-knapp - avlang */}
          <button
            onClick={handleMeasureClick}
            className={`w-18 h-12 rounded-full shadow-lg font-semibold text-[0.75rem] transition-colors border flex items-center justify-center ${
              isMeasuring
                ? 'bg-green-600 hover:bg-green-700 text-white border-green-700'
                : 'bg-blue-600 hover:bg-blue-700 text-white border-blue-700'
            }`}
            title={isMeasuring ? "Klikk for å legge til neste målepunkt" : "Start avstandsmåling"}
            style={{ pointerEvents: 'auto' }}
          >
            📏
          </button>
        </div>
      )}
      
                        {/* Start/Stopp spor knapp kun i søk-modus */}
        {mode === 'søk' && (
          <div className="fixed bottom-4 inset-x-0 z-[2001] flex flex-wrap justify-center items-center gap-2 px-2 -ml-[15px]" style={{ pointerEvents: 'none' }}>
                    {/* Obs-knapp */}
            <button
                      onClick={toggleObservationMode}
                      className="flex-1 min-w-[60px] max-w-[55px] w-auto h-12 rounded-full shadow-lg font-semibold text-[0.75rem] transition-colors border flex items-center justify-center px-[0.375em] py-[0.375em] bg-orange-600 hover:bg-orange-700 text-white border-orange-700"
                      title="Legg til observasjon"
                      style={{ pointerEvents: 'auto' }}
                    >
                      <span className="text-[10px] font-bold">Obs</span>
          </button>
      
                    {/* Funn! knapp */}
            <button
                      onClick={toggleFindingMode}
                      className="flex-1 min-w-[60px] max-w-[55px] w-auto h-12 rounded-full shadow-lg font-semibold text-[0.75rem] transition-colors border flex items-center justify-center px-[0.375em] py-[0.375em] bg-purple-600 hover:bg-purple-700 text-white border-purple-700"
                      title="Klikk for å plassere markering"
                      style={{ pointerEvents: 'auto' }}
                    >
                      <span className="text-[10px] font-bold">Mark!</span>
            </button>
            
            {/* Start/Stopp spor knapp */}
            <button
              onClick={isTracking ? stopTracking : startTracking}
              className={`flex-1 min-w-[60px] max-w-[55px] w-auto h-12 rounded-full shadow-lg font-semibold text-[0.75rem] transition-colors border flex flex-col items-center justify-center px-[0.375em] py-[0.375em] ${
                isTracking
                  ? 'bg-red-600 hover:bg-red-700 text-white border-red-700'
                  : 'bg-green-600 hover:bg-green-700 text-white border-green-700'
              }`}
                                              title={isTracking ? 'Stop' : 'Start'}
              style={{ pointerEvents: 'auto' }}
            >
                                                                                              <span className="text-[10px] mt-0.5">{isTracking ? 'Stop' : 'Start'}</span>
            </button>
          </div>
        )}
        
      {/* Hunting Area Definition Buttons */}
      {isDefiningHuntingArea && (
        <div className="fixed bottom-4 inset-x-0 z-[2001] flex flex-wrap justify-center items-center gap-4 px-2" style={{ pointerEvents: 'none' }}>
          <button
            onClick={handleCancelHuntingArea}
            className="px-6 py-3 rounded-full shadow-lg font-semibold transition-colors bg-red-600 hover:bg-red-700 text-white"
            style={{ pointerEvents: 'auto' }}
          >
            Avbryt
          </button>
          <div className="text-sm font-semibold text-white bg-black/70 px-4 py-2 rounded-full">
            {huntingAreaPoints.length} punkter
          </div>
          <button
            onClick={handleFinishHuntingArea}
            className="px-6 py-3 rounded-full shadow-lg font-semibold transition-colors bg-green-600 hover:bg-green-700 text-white"
            style={{ pointerEvents: 'auto' }}
          >
            Ferdig
          </button>
        </div>
      )}
      
      {/* MSR-retikkel Button - Bottom Left */}
      <div className="fixed bottom-4 left-4 sm:bottom-4 sm:left-4 bottom-2 left-2 z-[2000] flex flex-col gap-2" style={{ pointerEvents: 'auto' }}>
          {/* MSR-retikkel knapp */}
          <button
            className={`w-12 h-12 rounded-full shadow-lg transition-colors flex items-center justify-center ${
              localShowMSRRetikkel 
                ? 'bg-red-600 hover:bg-red-700 text-white' 
                : 'bg-gray-600 hover:bg-gray-700 text-white'
            }`}
            onClick={() => setLocalShowMSRRetikkel(!localShowMSRRetikkel)}
            title={localShowMSRRetikkel ? 'MSR-retikkel ON' : 'MSR-retikkel OFF'}
          >
            📐
          </button>
      </div>

      {/* Scan & Live Buttons - Bottom Right */}
      <div className="fixed bottom-4 right-4 sm:bottom-4 sm:right-4 bottom-2 right-2 z-[2000] flex flex-col gap-2" style={{ pointerEvents: 'auto' }}>
          {/* Scan-knapp kun i aware-mode */}
          {mode === 'aware' && (
          <button
            onClick={onScanArea}
              className={`w-12 h-12 rounded-full shadow-lg transition-colors flex items-center justify-center ${
                isScanning 
                  ? 'bg-gray-400 cursor-not-allowed text-white' 
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
              title={isScanning ? 'Scanning...' : 'Scan område'}
            >
              {isScanning ? '⏳' : '🔍'}
            </button>
          )}
          {/* Skuddpar-valgknapper - kun i søk-modus */}
          {mode === 'søk' && (
            <>
              {/* Indikator for valgt treffpunkt */}
              {savedPairs.filter(p => p.category === 'Treffpunkt').length > 0 && (
                <div className="text-xs text-center text-gray-700 bg-white/90 px-2 py-1 rounded shadow-sm">
                  {adjustedSelectedTargetIndex + 1}
                </div>
              )}
              
              {/* Pil venstre - forrige treffpunkt */}
          <button
                onClick={onPreviousTarget}
                className="w-12 h-12 rounded-full shadow-lg transition-colors flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white"
                title="Forrige treffpunkt"
              >
                ←
          </button>
              
              {/* Pil høyre - neste treffpunkt */}
          <button
                onClick={onNextTarget}
                className="w-12 h-12 rounded-full shadow-lg transition-colors flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white"
                title="Neste treffpunkt"
              >
                →
          </button>
            </>
          )}

          {/* Kompass-knapp - toggle on/off */}
            <button
            onClick={async () => {
              if (compassMode === 'off') {
                // Turn on compass
                try {
                  await compass.startCompass();
                  onCompassModeChange?.('on');
                  onCompassLockedChange?.(false); // Default: arrow rotates
                } catch (error) {
                  alert((error as Error).message);
                }
              } else {
                // Turn off compass
                compass.stopCompass();
                onCompassModeChange?.('off');
                onCompassLockedChange?.(false);
              }
            }}
            className={`w-12 h-12 rounded-full shadow-lg transition-colors flex items-center justify-center ${
              compassMode === 'off'
                ? 'bg-gray-600 hover:bg-gray-700 text-white'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
            title={compassMode === 'off' ? 'Start kompass' : 'Stopp kompass'}
            >
              🧭
            </button>
          
          {/* Live-posisjon-knapp */}
            <button
              onClick={() => {
              const newLiveMode = !isLiveMode;
              onLiveModeChange?.(newLiveMode);
              // Auto-lock map when GPS is enabled, unlock when disabled
              setIsMapLocked(newLiveMode);
            }}
            className={`w-12 h-12 rounded-full shadow-lg transition-colors flex items-center justify-center ${
              isLiveMode 
                ? 'bg-green-600 hover:bg-green-700 text-white' 
                : 'bg-gray-600 hover:bg-gray-700 text-white'
            }`}
            title={isLiveMode ? 'Live GPS ON (locked)' : 'Live GPS'}
          >
            🛰️
            </button>
          
          {/* Layer-knapp */}
          <button
            className="w-12 h-12 rounded-full shadow-lg transition-colors flex items-center justify-center bg-white/90 border border-gray-300 hover:bg-gray-100"
            onClick={() => setLayerIdx((layerIdx + 1) % LAYER_CONFIGS.length)}
            title={`Bytt kartlag (${LAYER_CONFIGS[layerIdx].name})`}
            style={{ zIndex: 2002 }}
          >
            <span className="w-7 h-7 flex items-center justify-center"><LayersIcon /></span>
          </button>
        </div>

      {/* Kartrotasjon (bare i live-mode og rotateMap) */}
      <style jsx>{`
        .leaflet-container {
          transition: transform 0.3s;
          ${isLiveMode && rotateMap && currentPosition?.heading !== undefined ? `transform: rotate(${-currentPosition.heading}deg);` : ''}
        }
      `}</style>

      {/* Modal for target-radius (første steg) */}
      {showTargetRadiusModal && (
        <div className="fixed bottom-0 left-0 w-full z-[2002] flex justify-center items-end pointer-events-none">
          <div className="bg-white rounded-t-lg shadow-lg p-4 w-full max-w-xs mx-auto mb-2 flex flex-col gap-2 pointer-events-auto">
            <div className="text-base font-semibold text-black mb-1">Sett skuddavstand:</div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={50}
                max={500}
                step={5}
                value={targetRange}
                onChange={e => setTargetRange(Number(e.target.value))}
                className="w-16 border rounded px-2 py-1 text-[16px] text-black"
              />
              <span className="text-xs text-black">m</span>
              <input
                type="range"
                min={50}
                max={500}
                step={5}
                value={targetRange}
                onChange={e => setTargetRange(Number(e.target.value))}
                className="flex-1 touch-manipulation slider-thumb-25"
                style={{ 
                  padding: '12px 0',
                  margin: '-12px 0'
                }}
              />
      </div>
            <div className="flex justify-between items-center mt-2 gap-2">
              <button
                onClick={() => {
                  setShowTargetRadiusModal(false);
                  setShowTargetDirectionUI(false);
                  setLockedShotPosition(null);
                }}
                className="px-6 py-2 rounded bg-gray-200 hover:bg-gray-300 text-sm text-black"
              >Avbryt</button>
              <button
                onClick={() => { setShowTargetRadiusModal(false); setShowTargetDirectionUI(true); }}
                className="px-6 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 text-sm"
              >Neste</button>
            </div>
          </div>
        </div>
      )}

      {/* Slider og lagre-knapp for retning (andre steg) */}
      {showTargetDirectionUI && (
        <div className="fixed bottom-0 left-0 w-full z-[2002] flex justify-center items-end pointer-events-none">
          <div className="bg-white rounded-t-lg shadow-lg p-4 w-full max-w-xs mx-auto mb-2 flex flex-col items-center gap-2 pointer-events-auto">
            <label className="w-full text-black">
              <span className="block text-base font-semibold mb-2">Sett skuddretning:</span>
              <div className="flex items-center gap-2 w-full">
              <input
                  type="number"
                  min={0}
                  max={359}
                  value={((targetDirection + 360) % 360)}
                  onChange={e => {
                    const raw = Number(e.target.value);
                    const normalized = isNaN(raw) ? 0 : Math.max(0, Math.min(359, raw));
                    const internal = normalized > 180 ? normalized - 360 : normalized; // map 0-359 -> -180..180
                    setTargetDirection(internal);
                  }}
                  className="w-16 border rounded px-2 py-1 text-[16px] text-black"
                />
                <span className="text-xs text-black">°</span>
                <div className="flex-1 px-2 py-1">
              <input
                type="range"
                min={-180}
                max={180}
                value={targetDirection}
                onChange={e => setTargetDirection(Number(e.target.value))}
                    className="w-full h-[35px] touch-manipulation slider-thumb-25"
                    style={{ 
                      padding: '12px 0',
                      margin: '-12px 0'
                    }}
                  />
            </div>
            </div>
              {/* Degree display removed; value shown in input field */}
          </label>
            <div className="flex justify-between items-center mt-2 gap-2 w-full">
              <button
                onClick={() => {
                  setShowTargetRadiusModal(false);
                  setShowTargetDirectionUI(false);
                  setLockedShotPosition(null);
                }}
                className="px-6 py-2 rounded bg-gray-200 hover:bg-gray-300 text-sm text-black"
              >Avbryt</button>
              <button
                onClick={async () => {
                  try {
                    if (!isShotCompassEnabled) {
                      setIsShotCompassEnabled(true);
                      await shotDirectionCompass.startCompass();
                    } else {
                      shotDirectionCompass.stopCompass();
                      setIsShotCompassEnabled(false);
                    }
                  } catch (e) {
                    setIsShotCompassEnabled(false);
                    alert('Kunne ikke starte kompass. Gi tillatelse og prøv igjen.');
                  }
                }}
                className={`px-6 py-2 rounded text-white font-semibold text-sm ${isShotCompassEnabled ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 hover:bg-gray-700'}`}
              >Kompass</button>
          <button
                onClick={() => { handleSaveTargetWithDirection(); shotDirectionCompass.stopCompass(); setIsShotCompassEnabled(false); }}
                className="px-6 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm"
          >Lagre</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal for observasjon-radius (første steg) */}
      {showObservationRangeModal && (
        <div className="fixed bottom-0 left-0 w-full z-[2002] flex justify-center items-end pointer-events-none">
          <div className="bg-white rounded-t-lg shadow-lg p-4 w-full max-w-xs mx-auto mb-2 flex flex-col gap-2 pointer-events-auto">
            <div className="text-base font-semibold text-black mb-1">Avstand til observasjon:</div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={50}
                max={1000}
                step={5}
                value={observationRange}
                onChange={e => setObservationRange(Number(e.target.value))}
                className="w-16 border rounded px-2 py-1 text-[16px] text-black"
              />
              <span className="text-xs text-black">m</span>
              <input
                type="range"
                min={50}
                max={1000}
                step={5}
                value={observationRange}
                onChange={e => setObservationRange(Number(e.target.value))}
                className="flex-1 touch-manipulation slider-thumb-25"
                style={{ 
                  padding: '12px 0',
                  margin: '-12px 0'
                }}
              />
            </div>
            <div className="flex justify-between items-center mt-2 gap-2">
              <button
                onClick={handleCancelObservationDistance}
                className="px-6 py-2 rounded bg-gray-200 hover:bg-gray-300 text-sm text-black"
              >Avbryt</button>
              <button
                onClick={handleObservationRangeOk}
                className="px-6 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 text-sm"
              >Neste</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal for observasjon-retning (andre steg) */}
      {showObservationDirectionUI && (
        <div className="fixed bottom-0 left-0 w-full z-[2002] flex justify-center items-end pointer-events-none">
          <div className="bg-white rounded-t-lg shadow-lg p-4 w-full max-w-xs mx-auto mb-2 flex flex-col items-center gap-2 pointer-events-auto">
            <label className="w-full text-black">
              <span className="block text-base font-semibold mb-2">Retning til observasjon:</span>
              <div className="flex items-center gap-2 w-full">
                <input
                  type="number"
                  min={0}
                  max={359}
                  value={((observationDirection + 360) % 360)}
                  onChange={e => {
                    const raw = Number(e.target.value);
                    const normalized = isNaN(raw) ? 0 : Math.max(0, Math.min(359, raw));
                    const internal = normalized > 180 ? normalized - 360 : normalized;
                    setObservationDirection(internal);
                  }}
                className="w-16 border rounded px-2 py-1 text-[16px] text-black"
              />
              <span className="text-xs text-black">°</span>
                <div className="flex-1 px-2 py-1">
                  <input
                    type="range"
                    min={-180}
                    max={180}
                    value={observationDirection}
                    onChange={e => setObservationDirection(Number(e.target.value))}
                    className="w-full h-[35px] touch-manipulation slider-thumb-25"
                    style={{ 
                      padding: '12px 0',
                      margin: '-12px 0'
                    }}
                  />
            </div>
            </div>
          </label>
            <div className="flex justify-between items-center mt-2 gap-2 w-full">
          <button
                onClick={() => { handleCancelObservationDistance(); observationDirectionCompass.stopCompass(); setIsObservationCompassEnabled(false); }}
                className="px-6 py-2 rounded bg-gray-200 hover:bg-gray-300 text-sm text-black"
              >Avbryt</button>
              <button
                onClick={async () => {
                  try {
                    if (!isObservationCompassEnabled) {
                      setIsObservationCompassEnabled(true);
                      await observationDirectionCompass.startCompass();
                    } else {
                      observationDirectionCompass.stopCompass();
                      setIsObservationCompassEnabled(false);
                    }
                  } catch (e) {
                    setIsObservationCompassEnabled(false);
                    alert('Kunne ikke starte kompass. Gi tillatelse og prøv igjen.');
                  }
                }}
                className={`px-6 py-2 rounded text-white font-semibold text-sm ${isObservationCompassEnabled ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 hover:bg-gray-700'}`}
              >Kompass</button>
              <button
                onClick={() => { handleSaveObservationWithDistance(); observationDirectionCompass.stopCompass(); setIsObservationCompassEnabled(false); }}
                className="px-6 py-2 rounded bg-green-600 hover:bg-green-700 text-white font-semibold text-sm"
          >Lagre</button>
            </div>
          </div>
        </div>
      )}

      {showNewPostDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[2000]">
          <div className="bg-white rounded-lg shadow-lg p-6 w-80 flex flex-col gap-4">
            <div className="text-xl font-bold mb-2 text-gray-800">Ny post</div>
            <label className="text-base font-semibold text-gray-700">Navn:
              <input
                type="text"
                value={newPostName}
                onChange={e => setNewPostName(e.target.value)}
                className="w-full border rounded px-2 py-1 mt-1 mb-2 text-lg text-[16px] text-gray-900"
              />
            </label>
            <div className="flex gap-2 justify-end mt-2">
              <button
                onClick={() => { setShowNewPostDialog(false); setNewPostName(''); setNewPostPosition(null); }}
                className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold"
              >Avbryt</button>
              <button
                onClick={handleSaveNewPost}
                className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold"
              >Lagre</button>
            </div>
          </div>
        </div>
      )}
      {showTargetDialog && typeof window !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/40" onClick={() => setShowTargetDialog(false)}>
          <div className="bg-white p-8 rounded max-w-xs w-full" onClick={e => e.stopPropagation()}>
            <div className="text-lg font-semibold mb-2">Velg avstand og retning</div>
            <div className="mb-4">
              <label htmlFor="target-distance" className="block text-xs font-medium text-gray-700 mb-1">Avstand (meter):</label>
              <input type="range" id="target-distance" name="target-distance" min={50} max={1000} step={5} value={targetDistance} onChange={e => setTargetDistance(Number(e.target.value))} className="w-full" />
              <input type="number" id="target-distance-number" name="target-distance-number" min={50} max={1000} step={5} value={targetDistance} onChange={e => setTargetDistance(Number(e.target.value))} className="w-full border rounded px-2 py-1 mt-1 text-[16px] text-black" />
            </div>
            <div className="mb-4 flex flex-col items-center">
              <svg width="120" height="120" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="55" fill="#f3f4f6" stroke="#d1d5db" strokeWidth="2" />
                <line x1="60" y1="60" x2={60 + 50 * Math.sin((isNaN(targetDirection) ? 0 : targetDirection) * Math.PI / 180)} y2={60 - 50 * Math.cos((isNaN(targetDirection) ? 0 : targetDirection) * Math.PI / 180)} stroke="#2563eb" strokeWidth="4" markerEnd="url(#arrow)" />
                <circle cx={60 + 50 * Math.sin((isNaN(targetDirection) ? 0 : targetDirection) * Math.PI / 180)} cy={60 - 50 * Math.cos((isNaN(targetDirection) ? 0 : targetDirection) * Math.PI / 180)} r="5" fill="#2563eb" />
                <defs>
                  <marker id="arrow" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto" markerUnits="strokeWidth">
                    <path d="M0,0 L10,5 L0,10 L3,5 Z" fill="#2563eb" />
                  </marker>
                </defs>
              </svg>
              <div className="w-full mt-2 flex flex-col items-center">
                <label htmlFor="target-direction" className="block text-xs font-medium text-gray-700 mb-1 text-center">Retning:</label>
                <input type="range" id="target-direction" name="target-direction" min={-180} max={180} step={1} value={targetDirection} onChange={e => setTargetDirection(Number(e.target.value))} className="w-full max-w-xs" style={{margin:'0 auto'}} />
                <div className="text-xs text-center mt-1 font-semibold">Retning: {((targetDirection + 360) % 360)}° {
                  ((targetDirection + 360) % 360) === 0 ? '(nord)' :
                  ((targetDirection + 360) % 360) === 180 ? '(sør)' :
                  ((targetDirection + 360) % 360) === 90 ? '(øst)' :
                  ((targetDirection + 360) % 360) === 270 ? '(vest)' : ''
                }</div>
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button onClick={() => setShowTargetDialog(false)} className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 text-xs">Avbryt</button>
              <button onClick={async () => { await handleConfirmTarget(); setShowTargetDialog(false); }} className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 text-xs">Lagre treffpunkt</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Dialog for å lagre spor med navn og farge */}
      {showSaveTrackDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[2000]">
          <div className="bg-white rounded-lg shadow-lg p-6 w-80 flex flex-col gap-4">
            <div className="text-xl font-bold mb-2 text-gray-800">Lagre spor</div>
            
            <label className="text-base font-semibold text-gray-700">
              Navn på spor:
              <input
                type="text"
                value={trackName}
                onChange={e => setTrackName(e.target.value)}
                placeholder="Valgfritt - f.eks. Tomas, tiur"
                className="w-full border rounded px-2 py-1 mt-1 mb-2 text-lg text-[16px] text-gray-900"
                autoFocus
              />
            </label>
            
            {/* DTG checkbox */}
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={trackIncludeDTG}
                onChange={e => setTrackIncludeDTG(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="font-medium text-gray-700">Legg til DTG (dato/tid)</span>
            </label>

            <label className="text-base font-semibold text-gray-700">
              Farge på spor:
              <div className="flex gap-2 mt-1 mb-2">
                <input
                  type="color"
                  value={trackColor}
                  onChange={e => setTrackColor(e.target.value)}
                  className="w-12 h-12 border rounded cursor-pointer"
                  title="Velg farge"
                />
                <div className="flex-1 flex flex-wrap gap-1">
                  {['#EAB308', '#EF4444', '#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EC4899', '#06B6D4'].map((color) => (
                    <button
                      key={color}
                      onClick={() => setTrackColor(color)}
                      className={`w-8 h-8 rounded border-2 ${trackColor === color ? 'border-gray-800' : 'border-gray-300'}`}
                      style={{ backgroundColor: color }}
                      title={`Velg ${color}`}
                    />
                  ))}
                </div>
              </div>
            </label>

            <div className="flex gap-2 justify-end mt-2">
              <button
                onClick={handleCancelSaveTrack}
                className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold"
              >
                Avbryt
              </button>
              <button
                onClick={handleSaveTrackFromDialog}
                className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold"
              >
                Lagre spor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog for å lagre observasjon med navn og farge */}
      {showObservationDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[2000]">
          <div className="bg-white rounded-lg shadow-lg p-6 w-80 flex flex-col gap-4">
            <div className="text-xl font-bold mb-2 text-gray-800">Lagre observasjon</div>
            
            <label className="text-base font-semibold text-gray-700">
              Navn på observasjon:
              <input
                type="text"
                value={observationName}
                onChange={e => setObservationName(e.target.value)}
                placeholder="Valgfritt - f.eks. Elg sett"
                className="w-full border rounded px-2 py-1 mt-1 mb-2 text-lg text-[16px] text-gray-900"
                autoFocus
              />
            </label>
            
            {/* DTG checkbox */}
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={observationIncludeDTG}
                onChange={e => setObservationIncludeDTG(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="font-medium text-gray-700">Legg til DTG (dato/tid)</span>
            </label>

            <label className="text-base font-semibold text-gray-700">
              Farge på observasjon:
              <div className="flex gap-2 mt-1 mb-2">
                <input
                  type="color"
                  value={observationColor}
                  onChange={e => setObservationColor(e.target.value)}
                  className="w-12 h-12 border rounded cursor-pointer"
                  title="Velg farge"
                />
                <div className="flex-1 flex flex-wrap gap-1">
                  {['#FF6B35', '#EF4444', '#EAB308', '#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EC4899'].map((color) => (
                    <button
                      key={color}
                      onClick={() => setObservationColor(color)}
                      className={`w-8 h-8 rounded border-2 ${observationColor === color ? 'border-gray-800' : 'border-gray-300'}`}
                      title={`Velg ${color}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </label>

            <div className="flex gap-2 justify-between mt-2">
              <button
                onClick={handleCancelObservation}
                className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold"
              >
                Avbryt
              </button>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveObservationFromDialog}
                  className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold"
                >
                  Lagre her
                </button>
                <button
                  onClick={handleObservationWithDistance}
                  className="px-3 py-1 rounded bg-green-600 hover:bg-green-700 text-white font-bold"
                >
                  Avstand + retning
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dialog for å lagre funn med navn og farge */}
      {showFindDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[2000]">
          <div className="bg-white rounded-lg shadow-lg p-6 w-80 flex flex-col gap-4">
            <div className="text-xl font-bold mb-2 text-gray-800">Lagre funn</div>
            
            <label className="text-base font-semibold text-gray-700">
              Navn på funn:
              <input
                type="text"
                value={findName}
                onChange={e => setFindName(e.target.value)}
                placeholder={findName || "f.eks. Tiur"}
                className="w-full border rounded px-2 py-1 mt-1 mb-2 text-lg text-[16px] text-gray-900"
                autoFocus
              />
            </label>

            <label className="text-base font-semibold text-gray-700">
              Farge på funn:
              <div className="flex gap-2 mt-1 mb-2">
                <input
                  type="color"
                  value={findColor}
                  onChange={e => setFindColor(e.target.value)}
                  className="w-12 h-12 border rounded cursor-pointer"
                  title="Velg farge"
                />
                <div className="flex-1 flex flex-wrap gap-1">
                  {['#EF4444', '#EAB308', '#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EC4899', '#06B6D4'].map((color) => (
                    <button
                      key={color}
                      onClick={() => setFindColor(color)}
                      className={`w-8 h-8 rounded border-2 ${findColor === color ? 'border-gray-800' : 'border-gray-300'}`}
                      title={`Velg ${color}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </label>

            <div className="flex gap-2 justify-end mt-2">
              <button
                onClick={handleCancelFind}
                className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold"
              >
                Avbryt
              </button>
              <button
                onClick={handleSaveFindFromDialog}
                className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold"
              >
                Lagre funn
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Dialog for å lagre jaktfelt */}
      {showSaveHuntingAreaDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[3000]">
          <div className="bg-white rounded-lg shadow-lg p-6 w-80 flex flex-col gap-4">
            <div className="text-xl font-bold mb-2 text-gray-800">Lagre jaktfelt</div>
            
            <label className="text-base font-semibold text-gray-700">
              Navn på jaktfelt:
              <input
                type="text"
                value={huntingAreaName}
                onChange={e => setHuntingAreaName(e.target.value)}
                className="mt-1 w-full px-2 py-1 text-sm border border-gray-300 rounded"
                placeholder="F.eks. 'Nordlige område'"
              />
            </label>
            
            <div className="text-xs text-gray-500">
              Farge og tykkelse justeres i Innstillinger → Jaktfelt
            </div>
            
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowSaveHuntingAreaDialog(false)}
                className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold"
              >
                Avbryt
              </button>
              <button
                onClick={handleSaveHuntingArea}
                className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold"
              >
                Lagre jaktfelt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


