'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMap, Circle, Polyline, Tooltip, Popup, LayersControl } from 'react-leaflet';
import L from 'leaflet';
import MSRRetikkel from './msr-retikkel';
import 'leaflet/dist/leaflet.css';
import React from 'react';
import PieChart from './piechart';
import SettingsMenu from './settingsmenu';
import { supabase } from '../lib/supabaseClient';
import { Dialog } from '@headlessui/react';
import { createPortal } from 'react-dom';

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
  trackingPoints?: Position[];
  onTrackingPointsChange?: (points: Position[]) => void;
  showMSRRetikkel?: boolean;
  msrRetikkelOpacity?: number;
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
  compassStarted = false,
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
  compassStarted?: boolean;
}) {
  const map = useMap();
  const [currentPosition, setCurrentPosition] = useState<Position>({ lat: 60.424834440433045, lng: 12.408766398367092 });
  const [places, setPlaces] = useState<PlaceData[]>([]);
  const [loading, setLoading] = useState(false);
  const [watchId, setWatchId] = useState<number | null>(null);
  const [compassId, setCompassId] = useState<number | null>(null);
  const [headingHistory, setHeadingHistory] = useState<number[]>([]);
  const [lastUpdateTime, setLastUpdateTime] = useState(0);

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

  // Improved compass handler with proper iOS and Android support
  const handleCompass = useCallback((event: DeviceOrientationEvent) => {
    console.log('Compass event received:', {
      alpha: event.alpha,
      beta: event.beta,
      gamma: event.gamma,
      webkitCompassHeading: (event as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading,
      absolute: event.absolute
    });
    
    let heading: number | null = null;

    // iOS Safari har webkitCompassHeading (0 = nord, med klokka)
    const webkitHeading = (event as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading;
    if (webkitHeading !== undefined) {
      heading = webkitHeading;
      console.log('Using webkitCompassHeading:', heading);
    } else if (event.alpha !== null) {
      // Android / Chrome - inverter for å få med klokka
      heading = 360 - event.alpha;
      console.log('Using alpha:', event.alpha, '-> heading:', heading);
    }

    if (heading !== null && !isNaN(heading)) {
      heading = (heading + 360) % 360;
      
      // Throttle oppdateringer til maks 10 per sekund
      const now = Date.now();
      if (now - lastUpdateTime < 100) { // 100ms = 10 oppdateringer per sekund
        return;
      }
      setLastUpdateTime(now);
      
      // Lagre siste gyldige heading for debugging
      (window as Window & { lastValidHeading?: number }).lastValidHeading = heading;
      
      // Beregn gjennomsnitt for stabilisering - bruk nåværende historikk + ny heading
      const currentHistory = headingHistory;
      const avgHeading = currentHistory.length > 0 
        ? (currentHistory.reduce((sum: number, h: number) => sum + h, 0) + heading) / (currentHistory.length + 1)
        : heading;
      
      // Legg til i historikk for stabilisering
      setHeadingHistory((prev: number[]) => {
        const newHistory = [...prev, heading as number];
        // Behold kun siste 3 målinger (redusert fra 5)
        return newHistory.slice(-3);
      });
      
      setCurrentPosition((prev: Position) => {
        const newPos = {
          ...prev,
          heading: avgHeading as number
        };
        onPositionChange?.(newPos);
        return newPos;
      });
      
      console.log('Heading updated successfully:', avgHeading);
    } else {
      console.log('Invalid compass data:', { webkitCompassHeading: webkitHeading, alpha: event.alpha });
    }
  }, [lastUpdateTime, headingHistory, onPositionChange]);

  // GPS and Compass functionality
  useEffect(() => {



    if (!isLiveMode) {
      // Clean up watchers when live mode is disabled
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
        setWatchId(null);
      }
      if (compassStarted) {
        // Clean up compass if available
        if ('DeviceOrientationEvent' in window) {
          window.removeEventListener('deviceorientation', handleCompass, true);
          setCompassId(null);
        }
        setHeadingHistory([]);
        setLastUpdateTime(0);
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
          heading: currentPosition.heading || undefined // Keep existing heading
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



    // Cleanup function
    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
      }
      if ('DeviceOrientationEvent' in window) {
        window.removeEventListener('deviceorientation', handleCompass, true);
      }
    };
  }, [isLiveMode, map, onPositionChange, onError, currentPosition, handleCompass]);

  // Separate useEffect for compass event listener management
  useEffect(() => {
    if (!compassStarted) return;

    const listener = (e: DeviceOrientationEvent) => handleCompass(e);
    window.addEventListener('deviceorientation', listener, true);
    console.log('Compass event listener added successfully');

    return () => {
      window.removeEventListener('deviceorientation', listener, true);
      console.log('Compass event listener removed');
    };
  }, [compassStarted, handleCompass]);

  // Fetch places when shouldScan is true or radius/category filters change
  useEffect(() => {
    if (!shouldScan) return; // Only fetch when scan is triggered

    const fetchPlaces = async () => {
      setLoading(true);
      onLoadingChange?.(true);
      try {
        console.log('Scanning area for radius:', radius, 'at position:', currentPosition);
        const response = await fetch(
          `/api/overpass?lat=${currentPosition.lat}&lng=${currentPosition.lng}&radius=${radius}`
        );
        
        if (response.ok) {
          const result = await response.json();
          console.log('Found places:', Array.isArray(result.data) ? result.data.length : 0);
          console.log('Places:', result.data?.map((p: PlaceData) => ({ name: p.name, category: p.category })) || []);
          const newPlaces = Array.isArray(result.data) ? result.data : [];
          setPlaces(newPlaces);
        } else {
          console.error('Failed to fetch places');
          setPlaces([]);
        }
      } catch (error) {
        console.error('Error fetching places:', error);
        setPlaces([]);
      } finally {
        setLoading(false);
        onLoadingChange?.(false);
      }
    };

    fetchPlaces();
  }, [shouldScan, radius, currentPosition, categoryFilters, onLoadingChange]);

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
      {mode === 'aware' && Array.isArray(places) && places.length > 0 && (
        <PieChart 
          places={places}
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

// Component to handle tracking in søk-modus
function TrackingController({ 
  isTracking, 
  mode, 
  onTrackingPointsChange, 
  currentPosition 
}: { 
  isTracking: boolean; 
  mode: string; 
  onTrackingPointsChange: (points: Position[]) => void; 
  currentPosition?: Position; 
}) {
  const map = useMap();
  const [localTrackingPoints, setLocalTrackingPoints] = useState<Position[]>([]);

  useEffect(() => {
    if (!map || !isTracking || mode !== 'søk') return;

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
  }, [map, isTracking, mode, onTrackingPointsChange, currentPosition, localTrackingPoints]);

  // Reset local points when tracking starts
  useEffect(() => {
    if (isTracking && mode === 'søk') {
      setLocalTrackingPoints([]);
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
      showMSRRetikkel = true,
    msrRetikkelOpacity = 80,
}: MapComponentProps) {
  const [showTargetDialog, setShowTargetDialog] = useState(false);
  const instanceId = useRef(Math.random());
  const [isLeafletLoaded, setIsLeafletLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [places, setPlaces] = useState<PlaceData[]>([]);
  const [currentPosition, setCurrentPosition] = useState<Position | undefined>(undefined);
  const [isSettingsExpanded, setIsSettingsExpanded] = useState(false);
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const [rotateMap, setRotateMap] = useState(false); // Ny state
  const filterMenuRef = useRef<HTMLDivElement>(null);
  const settingsMenuRef = useRef<HTMLDivElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [savedPairs, setSavedPairs] = useState<PointPair[]>([]);
  const [compassStarted, setCompassStarted] = useState(false);
  
  // Tracking state for søk-modus
  const [currentTrackingId, setCurrentTrackingId] = useState<string | null>(null);
  const [savedTracks, setSavedTracks] = useState<SavedTrack[]>([]);
  const [showSaveTrackDialog, setShowSaveTrackDialog] = useState(false);
  const [trackName, setTrackName] = useState('');
  const [trackColor, setTrackColor] = useState('#EAB308'); // Standard gul farge
  
  // Funn state for søk-modus
  const [savedFinds, setSavedFinds] = useState<SavedFind[]>([]);
  const [showFindDialog, setShowFindDialog] = useState(false);
  const [newFindPosition, setNewFindPosition] = useState<Position | null>(null);
  const [findName, setFindName] = useState('');
  const [findColor, setFindColor] = useState('#EF4444'); // Standard rød farge
  
  // MSR-retikkel state
  const [localShowMSRRetikkel, setLocalShowMSRRetikkel] = useState(showMSRRetikkel);
  const [localMSRRetikkelOpacity, setLocalMSRRetikkelOpacity] = useState(msrRetikkelOpacity);
  
  // Synkroniser MSR-retikkel props med local state
  useEffect(() => {
    setLocalShowMSRRetikkel(showMSRRetikkel);
  }, [showMSRRetikkel]);
  
  useEffect(() => {
    setLocalMSRRetikkelOpacity(msrRetikkelOpacity);
  }, [msrRetikkelOpacity]);
  
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
      
      // Finn aktivt skuddpar ID
      const activeShotPairId = lastPair?.id?.toString() || 'unknown';
      
      // Lagre nytt spor med timestamp og skuddpar info
      const newTrack: SavedTrack = {
        id: trackId,
        points: points,
        createdAt: new Date().toISOString(),
        shotPairId: activeShotPairId, // Bruk reell skuddpar ID istedenfor 'current'
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
      const allTracks = Object.values(savedTracks) as SavedTrack[];
      
      // Filtrer spor basert på aktivt skuddpar og showOnlyLastShot
      if (showOnlyLastShot && hasSavedPairs && safeSavedPairs.length > 0) {
        const currentLastPair = safeSavedPairs[safeSavedPairs.length - 1];
        if (currentLastPair?.id) {
          // Vis kun spor for siste skuddpar
          return allTracks.filter(track => track.shotPairId === currentLastPair.id.toString());
        }
      }
      // Vis alle spor
      return allTracks;
    } catch (error) {
      console.error('Feil ved lasting av lagrede spor:', error);
      return [];
    }
  };

  // Håndter lagring til database
  const handleSaveToDatabase = () => {
    if (savedTracks.length === 0) return;
    
    const shouldSave = window.confirm('Lagre synlige spor til database?');
    if (shouldSave) {
      // TODO: Implementer faktisk lagring til database senere
      console.log('Lagrer spor til database:', savedTracks);
      alert('Spor lagret til database! (placeholder - implementeres senere)');
    }
  };

  // Håndter lagring av spor fra dialog
  const handleSaveTrackFromDialog = () => {
    if (!trackName.trim()) {
      alert('Vennligst skriv inn et navn for sporet');
      return;
    }
    
    saveTrackToLocalStorage(currentTrackingId, trackingPoints || [], trackName.trim(), trackColor);
    console.log('Spor lagret til localStorage:', { 
      id: currentTrackingId, 
      name: trackName, 
      color: trackColor, 
      points: trackingPoints 
    });
    
    // Reset dialog state
    setShowSaveTrackDialog(false);
    setTrackName('');
    setTrackColor('#EAB308');
    onTrackingPointsChange?.([]);
    setCurrentTrackingId(null);
  };

  // Avbryt lagring av spor
  const handleCancelSaveTrack = () => {
    setShowSaveTrackDialog(false);
    setTrackName('');
    setTrackColor('#EAB308');
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
      
      // Finn aktivt skuddpar ID
      const activeShotPairId = lastPair?.id?.toString() || 'unknown';
      
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
      const allFinds = Object.values(savedFinds) as SavedFind[];
      
      // Filtrer funn basert på aktivt skuddpar og showOnlyLastShot
      if (showOnlyLastShot && hasSavedPairs && safeSavedPairs.length > 0) {
        const currentLastPair = safeSavedPairs[safeSavedPairs.length - 1];
        if (currentLastPair?.id) {
          // Vis kun funn for siste skuddpar
          return allFinds.filter(find => find.shotPairId === currentLastPair.id.toString());
        }
      }
      // Vis alle funn
      return allFinds;
    } catch (error) {
      console.error('Feil ved lasting av lagrede funn:', error);
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
    if (newFindPosition && findName.trim()) {
      saveFindToLocalStorage(newFindPosition, findName.trim(), findColor);
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

  const startCompass = async () => {
    try {
      // Check if DeviceOrientationEvent is available
      if (!('DeviceOrientationEvent' in window)) {
        console.warn('DeviceOrientationEvent not available');
        alert('Kompass ikke støttet på denne enheten');
        return;
      }

      // Request permission on iOS 13+ - dette må trigges av brukerklikk
      const requestPermission = (DeviceOrientationEvent as typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> }).requestPermission;
      if (typeof requestPermission === 'function') {
        try {
          const response = await requestPermission();
          if (response === 'granted') {
            console.log('Compass permission granted');
            setCompassStarted(true);
            alert('Kompass startet!');
          } else {
            console.warn('Compass permission denied');
            alert('Ingen tilgang til kompass');
          }
        } catch (err) {
          console.error('Error requesting compass permission:', err);
          alert('Kunne ikke be om kompass-tillatelse');
        }
      } else {
        // Android eller gamle iOS – bare start kompass
        console.log('No permission required, starting compass');
        setCompassStarted(true);
        alert('Kompass startet!');
      }
    } catch (error) {
      console.error('Error starting compass:', error);
      alert('Feil ved start av kompass');
    }
  };
  
  // --- For interaktiv target-pos modal ---
  const [showTargetRadiusModal, setShowTargetRadiusModal] = useState(false);
  const [showTargetDirectionUI, setShowTargetDirectionUI] = useState(false);
  const [targetRange, setTargetRange] = useState(250); // Default 250m
  const [targetDirection, setTargetDirection] = useState(0); // Startverdi 0 (nord)
  const [previewTarget, setPreviewTarget] = useState<Position | null>(null);
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
    const hasSavedPairs = Array.isArray(savedPairs) && savedPairs.length > 0;
    const lastPair = hasSavedPairs ? savedPairs[savedPairs.length - 1] : undefined;
    if (!showTargetDirectionUI || !hasSavedPairs) {
      setPreviewTarget(null);
      return;
    }
    if (!lastPair || !lastPair.current) return;
    // 0° = nord, positiv = med klokka, negativ = mot klokka
    // Kompassgrad: -90 => 270, 90 => 90, -180/180 => 180
    const compassDeg = ((targetDirection + 360) % 360);
    setPreviewTarget(
      destinationPoint(
        lastPair.current.lat,
        lastPair.current.lng,
        targetRange,
        compassDeg
      )
    );
  }, [showTargetDirectionUI, targetRange, targetDirection, savedPairs]);

  // Lukker filter-expander ved klikk utenfor
  useEffect(() => {
    if (!isFilterExpanded) return;
    function handleClick(event: MouseEvent | TouchEvent) {
      if (filterMenuRef.current && !filterMenuRef.current.contains(event.target as Node)) {
        setIsFilterExpanded(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('touchstart', handleClick);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('touchstart', handleClick);
    };
  }, [isFilterExpanded]);

  // Lukker settings-expander ved klikk utenfor
  useEffect(() => {
    if (!isSettingsExpanded) return;
    function handleClick(event: MouseEvent | TouchEvent) {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(event.target as Node)) {
        setIsSettingsExpanded(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('touchstart', handleClick);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('touchstart', handleClick);
    };
  }, [isSettingsExpanded]);

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

  // Sett base-URL for backend
  const BACKEND_URL = 'http://localhost:5000/api/posts';

  // Hent alle poster fra Supabase
  const fetchPosts = async () => {
    const { data, error } = await supabase.from('posts').select('*').order('created_at', { ascending: true });
    if (error) {
      console.error('Error fetching posts:', error);
      alert('Kunne ikke hente poster fra backend.');
      return;
    }
    if (Array.isArray(data)) {
      setSavedPairs(data.map(post => ({
        current: post.current_lat && post.current_lng ? { lat: post.current_lat, lng: post.current_lng } : undefined,
        target: post.target_lat && post.target_lng ? { lat: post.target_lat, lng: post.target_lng } : undefined,
        category: post.category,
        id: post.id,
        created_at: post.created_at,
      })));
    }
  };

  // Hent alle poster ved mount
  useEffect(() => {
    fetchPosts();
  }, []);

  // Legg til state for å styre om Treff-knappen er aktiv
  const [canAddTreff, setCanAddTreff] = useState(false);

  // Oppdater canAddTreff til true når Skudd lagres
  const handleSaveCurrentPos = async () => {
    if (currentPosition) {
      const { data, error } = await supabase.from('posts').insert([
        {
          current_lat: currentPosition.lat,
          current_lng: currentPosition.lng,
          category: 'Skyteplass',
        },
      ]).select();
      if (error) {
        console.error('Failed to save current pos:', error);
        alert('Feil ved lagring av Skyteplass: ' + error.message);
        return;
      }
      if (data && data[0]) {
        setSavedPairs(prev => [...prev, { current: { ...currentPosition }, category: 'Skyteplass', id: data[0].id }]);
        setFeedbackText('lagret');
        setShowCurrentFeedback(true);
        setTimeout(() => setShowCurrentFeedback(false), 1000);
        fetchPosts();
        setCanAddTreff(true); // Aktiver Treff-knappen
      }
    }
  };

  // 3. Lagre target-posisjon til Supabase
  const handleSaveTargetPos = async () => {
    if (currentPosition) {
      const { data, error } = await supabase.from('posts').insert([
        {
          target_lat: currentPosition.lat,
          target_lng: currentPosition.lng,
          category: 'Treffpunkt',
        },
      ]).select();
      if (error) {
        console.error('Failed to save target pos:', error);
        alert('Feil ved lagring av Treffpunkt: ' + error.message);
        return;
      }
      if (data && data[0]) {
        setSavedPairs(prev => [...prev, { target: { ...currentPosition }, category: 'Treffpunkt', id: data[0].id }]);
        setShowCurrentFeedback(true);
        setTimeout(() => setShowCurrentFeedback(false), 700);
        fetchPosts();
      }
    }
  };
  const handleTargetRadiusOk = () => {
    setShowTargetRadiusModal(false);
    setShowTargetDirectionUI(true);
  };
  const handleTargetModalSave = () => {
    const hasSavedPairs = Array.isArray(savedPairs) && savedPairs.length > 0;
    const lastPair = hasSavedPairs ? savedPairs[savedPairs.length - 1] : undefined;
    if (!hasSavedPairs || !lastPair || !lastPair.current) return;
    const previewTarget = destinationPoint(
      lastPair.current.lat,
      lastPair.current.lng,
      targetRange,
      ((targetDirection + 360) % 360)
    );
    if (!previewTarget) return;
    setSavedPairs((prev) =>
      prev.map((pair, idx) =>
        idx === prev.length - 1 ? { ...pair, target: previewTarget } : pair
      )
    );
    setShowTargetDirectionUI(false);
  };

  // 2. Når bruker lagrer ny post, send insert til Supabase
  const handleSaveNewPost = async () => {
    if (newPostPosition && newPostName.trim()) {
      const { data, error } = await supabase.from('posts').insert([
        {
          name: newPostName.trim(),
          current_lat: newPostPosition.lat,
          current_lng: newPostPosition.lng,
          category: 'Post',
        },
      ]).select();
      if (error) {
        console.error('Failed to save new post:', error);
        alert('Feil ved lagring av post: ' + error.message);
        return;
      }
      if (data && data[0]) {
        setSavedPairs(prev => [...prev, { current: { ...newPostPosition }, category: 'Post', id: data[0].id }]);
        setShowNewPostDialog(false);
        setNewPostName('');
        setNewPostPosition(null);
      }
    }
  };

  // Bekreft lagring av treffpunkt
  const handleConfirmTarget = async () => {
    if (!savedPairs.length || !savedPairs[savedPairs.length - 1].current) return;
    const base = savedPairs[savedPairs.length - 1].current;
    if (!base) return; // Guard mot undefined
    const bearing = (targetDirection + 360) % 360;
    const pos = destinationPoint(base.lat, base.lng, targetDistance, bearing);
    const { data, error } = await supabase.from('posts').insert([
      {
        target_lat: pos.lat,
        target_lng: pos.lng,
        category: 'Treffpunkt',
      },
    ]).select();
    if (error) {
      alert('Feil ved lagring av Treffpunkt: ' + error.message);
      setShowTargetDialog(false);
      return;
    }
    if (data && data[0]) {
      setSavedPairs(prev => [...prev, { target: { ...pos }, category: 'Treffpunkt', id: data[0].id }]);
      setFeedbackText('lagret');
      setShowCurrentFeedback(true);
      setTimeout(() => setShowCurrentFeedback(false), 1000);
      fetchPosts();
    }
    setShowTargetDialog(false);
  };

  // Defensive guards i toppen av renderblokken
  const safePlaces: PlaceData[] = Array.isArray(places) ? places : [];
  const hasSafePlaces = safePlaces.length > 0;
  const safeSavedPairs = Array.isArray(savedPairs) ? savedPairs : [];
  const hasSavedPairs = safeSavedPairs.length > 0;
  const lastPair = hasSavedPairs ? safeSavedPairs[safeSavedPairs.length - 1] : undefined;

  // Last lagrede spor når komponenten mountes og når modus endres
  useEffect(() => {
    if (mode === 'søk') {
      const tracks = loadSavedTracks();
      setSavedTracks(tracks);
      
      const finds = loadSavedFinds();
      setSavedFinds(finds);
    } else {
      setSavedTracks([]); // Tøm spor når vi ikke er i søk-modus
      setSavedFinds([]); // Tøm funn når vi ikke er i søk-modus
    }
  }, [mode, showOnlyLastShot, lastPair?.id]); // Reager på endringer i filter og skuddpar

  // Legg til funksjon for å slette alle skuddpar
  type ShotCategory = 'Skyteplass' | 'Treffpunkt';
  const handleDeleteAllShots = async () => {
    if (!window.confirm('Er du sikker på at du vil slette alle skuddpar?')) return;
    // Slett fra Supabase
    const { error } = await supabase.from('posts').delete().in('category', ['Skyteplass', 'Treffpunkt']);
    if (error) {
      alert('Feil ved sletting: ' + error.message);
      return;
    }
    // Oppdater lokal state
    setSavedPairs(prev => prev.filter(pair => pair.category !== 'Skyteplass' && pair.category !== 'Treffpunkt'));
  };

  const [layerIdx, setLayerIdx] = useState(0); // 0 = Flyfoto

  // Ny funksjon for å lagre treffpunkt med valgt retning og avstand
  const handleSaveTargetWithDirection = async () => {
    // Bruk skyteplass-posisjonen, ikke kartets midte
    const hasSavedPairs = Array.isArray(savedPairs) && savedPairs.length > 0;
    const lastPair = hasSavedPairs ? savedPairs[savedPairs.length - 1] : undefined;
    
    if (!lastPair || !lastPair.current) {
      alert('Ingen skyteplass funnet. Du må først lagre en skyteplass med Skudd-knappen.');
      return;
    }
    
    const pos = destinationPoint(
      lastPair.current.lat,
      lastPair.current.lng,
      targetRange,
      targetDirection
    );
    const { data, error } = await supabase.from('posts').insert([
      {
        target_lat: pos.lat,
        target_lng: pos.lng,
        category: 'Treffpunkt',
      },
    ]).select();
    if (error) {
      alert('Feil ved lagring av Treffpunkt: ' + error.message);
      setShowTargetDirectionUI(false);
      return;
    }
    if (data && data[0]) {
      setSavedPairs(prev => [...prev, { target: { ...pos }, category: 'Treffpunkt', id: data[0].id }]);
      setFeedbackText('lagret');
      setShowCurrentFeedback(true);
      setTimeout(() => setShowCurrentFeedback(false), 1000);
      fetchPosts();
    }
    setShowTargetDirectionUI(false);
    setCanAddTreff(false); // Deaktiver Treff-knappen
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
          compassStarted={compassStarted}
        />
        
        {/* Tracking controller for søk-modus */}
        <TrackingController 
          isTracking={isTracking}
          mode={mode}
          onTrackingPointsChange={onTrackingPointsChange || (() => {})}
          currentPosition={currentPosition}
        />

        {/* MSR-retikkel controller */}
        <MSRRetikkel 
          isVisible={localShowMSRRetikkel}
          opacity={localMSRRetikkelOpacity}
          currentPosition={currentPosition}
        />

        {/* Radius circle: kun i aware-mode */}
        {mode === 'aware' && currentPosition && (
          <Circle
            key={`radius-${radius}-${currentPosition.lat}-${currentPosition.lng}`}
            center={[currentPosition.lat, currentPosition.lng]}
            radius={radius ?? 0}
            pathOptions={{
              color: '#3b82f6',
              fillColor: '#3b82f6',
              fillOpacity: 0.0,
              weight: 2,
            }}
          />
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
        {mode === 'søk' && trackingPoints.length > 0 && (
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
            {trackingPoints.length > 1 && (
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

        {/* Alle lagrede spor i søk-modus */}
        {mode === 'søk' && savedTracks.length > 0 && (
          <>
            {savedTracks.map((track) => (
              <React.Fragment key={`saved-track-${track.id}`}>
                {/* Fargede sirkler for hvert lagret spor */}
                {track.points.map((point: Position, index: number) => (
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
                {track.points.length > 1 && (
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
        {mode === 'søk' && savedFinds.length > 0 && (
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
        {showTargetDirectionUI && hasSavedPairs && lastPair && lastPair.current && (
          <>
            <Circle
              key={`target-radius-${targetRange}-${lastPair.current.lat}-${lastPair.current.lng}`}
              center={[lastPair.current.lat, lastPair.current.lng]}
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
                [lastPair.current.lat, lastPair.current.lng],
                [
                  destinationPoint(
                    lastPair.current.lat,
                    lastPair.current.lng,
                    targetRange,
                    targetDirection
                  ).lat,
                  destinationPoint(
                    lastPair.current.lat,
                    lastPair.current.lng,
                    targetRange,
                    targetDirection
                  ).lng,
                ],
              ]}
              pathOptions={{ color: '#2563eb', weight: 3 }}
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
        {(mode === 'track' || mode === 'søk') && hasSavedPairs && (
          <>
            {showOnlyLastShot
              ? (() => {
                  // Finn nyeste skyteplass
                  const skyteplasser = [...safeSavedPairs]
                    .filter(p => p.category === 'Skyteplass' && p.created_at)
                    .sort((a, b) => (a.created_at! < b.created_at! ? 1 : -1)); // nyest først
                  const sisteSkyteplass = skyteplasser[0];
                  if (!sisteSkyteplass) return null;
                  // Finn nyeste treffpunkt etter denne skyteplass
                  const treffpunkter = [...safeSavedPairs]
                    .filter(p => p.category === 'Treffpunkt' && p.created_at && p.created_at > sisteSkyteplass.created_at!)
                    .sort((a, b) => (a.created_at! < b.created_at! ? 1 : -1)); // nyest først
                  const sisteTreffpunkt = treffpunkter[0];
                  return (
                    <>
                      {sisteSkyteplass.current && (
                        <Circle
                          center={[sisteSkyteplass.current.lat, sisteSkyteplass.current.lng]}
                          radius={5}
                          pathOptions={{
                            color: '#2563eb',
                            weight: 1.5,
                            fillColor: '#2563eb',
                            fillOpacity: 0.5,
                          }}
                        />
                      )}
                      {sisteTreffpunkt?.target && (
                        <Circle
                          center={[sisteTreffpunkt.target.lat, sisteTreffpunkt.target.lng]}
                          radius={15}
                          pathOptions={{
                            color: 'rgba(220,38,38,0.8)',
                            weight: 2,
                            fillColor: 'rgba(220,38,38,0.4)',
                            fillOpacity: 0.4,
                          }}
                        />
                      )}
                    </>
                  );
                })()
              : safeSavedPairs.filter(Boolean).map((pair, idx) => (
                  <React.Fragment key={pair.id ?? idx}>
                    {pair && pair.current && (
                      <Circle
                        center={[pair.current.lat, pair.current.lng]}
                        radius={5}
                        pathOptions={{
                          color: '#2563eb',
                          weight: 1.5,
                          fillColor: '#2563eb',
                          fillOpacity: 0.5,
                        }}
                      />
                    )}
                    {pair && pair.target && (
                      <Circle
                        center={[pair.target.lat, pair.target.lng]}
                        radius={15}
                        pathOptions={{
                          color: 'rgba(220,38,38,0.8)',
                          weight: 2,
                          fillColor: 'rgba(220,38,38,0.4)',
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
                            pathOptions={{ color: '#ff00ff', weight: 4, dashArray: '8 12' }}
                          />
                        );
                      })()
                    )}
                  </React.Fragment>
                ))}
          </>
        )}
        {/* Interaktiv preview for target-posisjon i retning-UI */}
        {showTargetDirectionUI && hasSavedPairs && lastPair && (
          <>
            {/* Sirkel for valgt radius */}
            <Circle
              center={Array.isArray(lastPair.current) && lastPair.current.length === 2 ? lastPair.current : [0,0]}
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
                  positions={Array.isArray(lastPair.current) && lastPair.current.length === 2 ? [lastPair.current, previewTarget] : []}
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
        {(mode === 'track' || mode === 'søk') && (
          showOnlyLastShot
            ? (() => {
                const skyteplasser = safeSavedPairs.filter(p => p.category === 'Skyteplass' && p.current && p.created_at !== undefined)
                  .sort((a, b) => (a.created_at! < b.created_at! ? 1 : -1));
                const sisteSkyteplass = skyteplasser[0];
                const treffpunkter = safeSavedPairs.filter(p => p.category === 'Treffpunkt' && p.target && p.created_at !== undefined)
                  .sort((a, b) => (a.created_at! < b.created_at! ? 1 : -1));
                const førsteTreffpunkt = treffpunkter.find(t => sisteSkyteplass && t.created_at !== undefined && t.created_at > sisteSkyteplass.created_at!);
                if (sisteSkyteplass && førsteTreffpunkt && sisteSkyteplass.current && førsteTreffpunkt.target) {
                  const end = pointTowards(sisteSkyteplass.current, førsteTreffpunkt.target, 15);
                  const positions: [number, number][] = [
                    [sisteSkyteplass.current.lat, sisteSkyteplass.current.lng],
                    [end.lat, end.lng],
                  ];
                  return (
                    <Polyline
                      key={`polyline-${sisteSkyteplass.id}-${førsteTreffpunkt.id}`}
                      positions={positions}
                      pathOptions={{ color: '#888', weight: 2, dashArray: '4 8' }}
                    />
                  );
                }
                return null;
              })()
            : (() => {
                const skyteplasser = safeSavedPairs.filter(p => p.category === 'Skyteplass' && p.current && p.created_at !== undefined);
                const treffpunkter = safeSavedPairs.filter(p => p.category === 'Treffpunkt' && p.target && p.created_at !== undefined);
                return skyteplasser.map((skyteplass, idx) => {
                  const treff = treffpunkter.find(t => t.created_at !== undefined && t.created_at > skyteplass.created_at!);
                  if (skyteplass.current && treff && treff.target) {
                    const end = pointTowards(skyteplass.current, treff.target, 15);
                    const positions: [number, number][] = [
                      [skyteplass.current.lat, skyteplass.current.lng],
                      [end.lat, end.lng],
                    ];
                    return (
                      <Polyline
                        key={`polyline-${skyteplass.id}-${treff.id}`}
                        positions={positions}
                        pathOptions={{ color: '#888', weight: 2, dashArray: '4 8' }}
                      />
                    );
                  }
                  return null;
                });
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

      {/* Settings Menu */}
      {isSettingsExpanded && (
        <div ref={settingsMenuRef} className="fixed top-20 right-4 z-[1002]">
          <SettingsMenu 
            categoryConfigs={categoryConfigs}
            onCategoryConfigChange={onCategoryConfigChange || (() => {})}
            angleRange={angleRange}
            onAngleRangeChange={onAngleRangeChange || (() => {})}
          />
          

          
          <button
            onClick={handleDeleteAllShots}
            className="mt-4 w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded shadow-lg text-sm"
          >
            Slett alle skuddpar
          </button>
        </div>
      )}

      {/* Filter Menu */}
      {isFilterExpanded && (
        <div ref={filterMenuRef} className="fixed top-36 right-4 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg z-[1000] max-w-xs">
        {/* Filter Header with Expand/Collapse */}
        <div className="p-3 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-700">Filtrer & Kontroller</div>
            <button
                  onClick={() => setIsFilterExpanded(false)}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
                  ✕
            </button>
          </div>
        </div>
        {/* Expandable Filter Content */}
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
                min="0.1"
                max="0.7"
                step="0.05"
                value={categoryConfigs.city?.opacity || 0.3}
                onChange={(e) => {
                  const newOpacity = parseFloat(e.target.value);
                  if (onCategoryConfigChange) {
                    Object.keys(categoryConfigs).forEach((key) => {
                      onCategoryConfigChange(key as keyof CategoryFilter, {
                        ...categoryConfigs[key as keyof CategoryFilter],
                        opacity: newOpacity,
                    });
                  });
                  }
                }}
                className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer hover:bg-gray-300 transition-colors"
                style={{
                  background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(categoryConfigs.city?.opacity || 0.3) * 100}%, #e5e7eb ${(categoryConfigs.city?.opacity || 0.3) * 100}%, #e5e7eb 100%)`
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

            {/* Kartrotasjon Setting */}
            <div className="mb-3">
              <label className="flex items-center gap-2 cursor-pointer text-xs bg-gray-50 px-2 py-1 rounded border hover:bg-gray-100 transition-colors">
                <input
                  type="checkbox"
                  checked={rotateMap}
                  onChange={(e) => setRotateMap(e.target.checked)}
                  className="w-3 h-3 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="font-medium text-gray-700">
                  Roter kart etter mobilretning (Front up)
                </span>
              </label>
            </div>
             </div>
          </div>
        )}

      {/* --- PATCH FOR BEDRE KNAPPEPLASSERING --- */}
      {/* Track-mode: Knapper for lagring av posisjoner */}
      {mode === 'track' && (
        <div className="fixed bottom-4 inset-x-0 z-[2001] flex flex-wrap justify-center items-center gap-2 px-2">
          <button
            onClick={openTargetDialog}
            disabled={!canAddTreff}
            className={`flex-1 min-w-[60px] max-w-[110px] w-auto h-9 rounded-full shadow-lg font-semibold text-[0.75rem] transition-colors border flex flex-col items-center justify-center px-[0.375em] py-[0.375em] ${
              canAddTreff
                ? 'bg-red-600 hover:bg-red-700 text-white border-red-700'
                : 'bg-gray-300 text-gray-400 border-gray-400 cursor-not-allowed opacity-60'
            }`}
            title="Du må først markere Skyteplass med Skudd-knappen"
          >
            <span className="text-[10px] mt-0.5">Treff</span>
          </button>
          <button
            onClick={handleSaveCurrentPos}
            className="flex-1 min-w-[60px] max-w-[110px] w-auto h-9 rounded-full shadow-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[0.75rem] transition-colors border border-blue-700 flex flex-col items-center justify-center px-[0.375em] py-[0.375em]"
            title="Save current pos"
          >
            <span className="text-[10px] mt-0.5">Skudd</span>
          </button>
        </div>
      )}
      
                                        {/* Start/Stopp spor knapp kun i søk-modus */}
                {mode === 'søk' && (
                  <div className="fixed bottom-4 inset-x-0 z-[2001] flex flex-wrap justify-center items-center gap-2 px-2">
                    {/* Lagre til database knapp */}
                    <button
                      onClick={handleSaveToDatabase}
                      disabled={savedTracks.length === 0}
                      className={`w-9 h-9 rounded-full shadow-lg font-semibold text-[0.75rem] transition-colors border flex items-center justify-center ${
                        savedTracks.length > 0
                          ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-700'
                          : 'bg-gray-400 text-gray-200 border-gray-300 cursor-not-allowed'
                      }`}
                      title="Lagre synlige spor til database"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                        <polyline points="17,21 17,13 7,13 7,21"/>
                        <polyline points="7,3 7,8 15,8"/>
                      </svg>
                    </button>

                    {/* Funn! knapp */}
                    <button
                      onClick={toggleFindingMode}
                      className="px-3 h-9 rounded-full shadow-lg font-semibold text-[0.75rem] transition-colors border flex items-center justify-center bg-purple-600 hover:bg-purple-700 text-white border-purple-700"
                      title="Klikk for å plassere funn"
                    >
                      <span className="text-[10px] font-bold">Funn!</span>
                    </button>

                    {/* Start/Stopp spor knapp */}
                    <button
                      onClick={isTracking ? stopTracking : startTracking}
                      className={`flex-1 min-w-[60px] max-w-[110px] w-auto h-9 rounded-full shadow-lg font-semibold text-[0.75rem] transition-colors border flex flex-col items-center justify-center px-[0.375em] py-[0.375em] ${
                        isTracking
                          ? 'bg-red-600 hover:bg-red-700 text-white border-red-700'
                          : 'bg-green-600 hover:bg-green-700 text-white border-green-700'
                      }`}
                      title={isTracking ? 'Stopp spor' : 'Start spor'}
                    >
                      <span className="text-[10px] mt-0.5">{isTracking ? 'Stopp spor' : 'Start spor'}</span>
                    </button>
                  </div>
                )}
      {/* Scan & Live Buttons - Bottom Right */}
      <div className="fixed bottom-4 right-4 sm:bottom-4 sm:right-4 bottom-2 right-2 z-[1000] flex flex-col gap-2">
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
          
          {/* Layer-knapp */}
          <button
            className="w-12 h-12 rounded-full shadow-lg transition-colors flex items-center justify-center bg-white/90 border border-gray-300 hover:bg-gray-100"
            onClick={() => setLayerIdx((layerIdx + 1) % LAYER_CONFIGS.length)}
            title={`Bytt kartlag (${LAYER_CONFIGS[layerIdx].name})`}
            style={{ zIndex: 2002 }}
          >
            <span className="w-7 h-7 flex items-center justify-center"><LayersIcon /></span>
          </button>
          {/* Live-posisjon-knapp */}
          <button
            onClick={() => onLiveModeChange?.(!isLiveMode)}
            className={`w-12 h-12 rounded-full shadow-lg transition-colors flex items-center justify-center ${
              isLiveMode 
                ? 'bg-green-600 hover:bg-green-700 text-white' 
                : 'bg-gray-600 hover:bg-gray-700 text-white'
            }`}
            title={isLiveMode ? 'Live GPS ON' : 'Live GPS'}
          >
            📍
          </button>
          {/* Kompass start-knapp */}
          {isLiveMode && !compassStarted && (
            <button
              onClick={startCompass}
              className="w-12 h-12 rounded-full shadow-lg bg-green-600 hover:bg-green-700 text-white flex items-center justify-center"
              title="Start kompass"
            >
              🧭
            </button>
          )}
          {/* Kompass status-knapp */}
          {isLiveMode && compassStarted && (
            <button
              onClick={() => {
                const lastHeading = (window as Window & { lastValidHeading?: number }).lastValidHeading;
                alert(`Kompass status:\nCurrent heading: ${currentPosition?.heading || 'N/A'}°\nLast valid heading: ${lastHeading || 'N/A'}°\nKompass aktiv: ${compassStarted}\nDeviceOrientation: ${'DeviceOrientationEvent' in window ? 'Tilgjengelig' : 'Ikke tilgjengelig'}`);
              }}
              className="w-12 h-12 rounded-full shadow-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center"
              title="Kompass status"
            >
              🧭
            </button>
          )}
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
            <div className="text-base font-semibold text-black mb-1">Velg avstand til treffpunkt</div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={50}
                max={500}
                step={5}
                value={targetRange}
                onChange={e => setTargetRange(Number(e.target.value))}
                className="flex-1"
              />
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
      </div>
            <div className="text-xs text-black text-center">Velg avstand med slider eller skriv inn manuelt.</div>
            <div className="flex gap-2 justify-end mt-2">
              <button
                onClick={() => setShowTargetRadiusModal(false)}
                className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 text-xs text-black"
              >Avbryt</button>
              <button
                onClick={() => { setShowTargetRadiusModal(false); setShowTargetDirectionUI(true); }}
                className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 text-xs"
              >OK</button>
            </div>
          </div>
        </div>
      )}
      {/* Feedback for current-pos lagring */}
      {showCurrentFeedback && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[3000] bg-gray-500 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2 animate-bounce">
          <span className="font-semibold text-lg">lagret</span>
        </div>
      )}
      {/* Slider og lagre-knapp for retning (andre steg) */}
      {showTargetDirectionUI && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[2002] bg-white rounded-lg shadow-lg px-4 py-3 flex flex-col items-center gap-2 w-[90vw] max-w-xs">
          <label className="text-sm font-medium w-full text-black">Retning (grader):
            <div className="flex items-center gap-2 w-full mt-1">
              <input
                type="range"
                min={-180}
                max={180}
                value={targetDirection}
                onChange={e => setTargetDirection(Number(e.target.value))}
                className="flex-1"
              />
              <input
                type="number"
                min={-180}
                max={180}
                value={targetDirection}
                onChange={e => setTargetDirection(Number(e.target.value))}
                className="w-16 border rounded px-2 py-1 text-[16px] text-black"
              />
              <span className="text-xs text-black">°</span>
            </div>
            <div className="text-base text-black text-center font-semibold mt-1">
              {((targetDirection + 360) % 360)}° {
                ((targetDirection + 360) % 360) === 0 ? '(nord)' :
                ((targetDirection + 360) % 360) === 180 ? '(sør)' :
                ((targetDirection + 360) % 360) === 90 ? '(øst)' :
                ((targetDirection + 360) % 360) === 270 ? '(vest)' : ''
              }
            </div>
          </label>
          <button
            onClick={handleSaveTargetWithDirection}
            className="px-4 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold mt-1"
          >Lagre</button>
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
                <div className="text-xs text-center mt-1 font-semibold">Retning: {targetDirection}° {
                  targetDirection === 0 ? '(nord)' :
                  targetDirection === 180 || targetDirection === -180 ? '(sør)' :
                  targetDirection === 90 ? '(øst)' :
                  targetDirection === -90 ? '(vest)' : ''
                }</div>
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button onClick={() => setShowTargetDialog(false)} className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 text-xs">Avbryt</button>
              <button onClick={async () => { await handleConfirmTarget(); setShowTargetDialog(false); }} className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 text-xs">Lagre treffpunkt</button>
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
                placeholder="f.eks. Tomas, tiur"
                className="w-full border rounded px-2 py-1 mt-1 mb-2 text-lg text-[16px] text-gray-900"
                autoFocus
              />
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
                placeholder="f.eks. Tiur"
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
    </div>
  );
}
