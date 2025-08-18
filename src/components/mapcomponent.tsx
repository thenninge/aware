'use client';

import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMap, Circle, Polyline, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import React from 'react';
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
  mode?: 'aware' | 'track'; // <-- NY
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
  mode?: 'aware' | 'track'; // <-- NY
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
          globalOpacity={categoryConfigs.city?.opacity ?? 1}
        />
      )}
    </>
  );
}

// Enkel SVG-kompassrose
function CompassRose({ heading = 0 }: { heading?: number }) {
  return (
    <div
      className="w-16 h-16 select-none pointer-events-none"
      style={{ transform: `rotate(${heading}deg)` }}
    >
      <svg viewBox="0 0 64 64" width="64" height="64">
        <circle cx="32" cy="32" r="30" fill="#fff" stroke="#333" strokeWidth="2" />
        <polygon points="32,8 36,32 32,24 28,32" fill="#dc2626" />
        <polygon points="32,56 36,32 32,40 28,32" fill="#2563eb" />
        <text x="32" y="18" textAnchor="middle" fontSize="10" fill="#333" fontWeight="bold">N</text>
        <text x="32" y="58" textAnchor="middle" fontSize="10" fill="#333">S</text>
        <text x="54" y="36" textAnchor="middle" fontSize="10" fill="#333">E</text>
        <text x="10" y="36" textAnchor="middle" fontSize="10" fill="#333">W</text>
      </svg>
    </div>
  );
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

// Ny type for punktpar
interface PointPair {
  current?: Position;
  target?: Position;
  category: string;
  id: number;
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
}: MapComponentProps) {
  const [isLeafletLoaded, setIsLeafletLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [places, setPlaces] = useState<PlaceData[]>([]);
  const [currentPosition, setCurrentPosition] = useState<Position>({ lat: 60.424834440433045, lng: 12.408766398367092 });
  const [isSettingsExpanded, setIsSettingsExpanded] = useState(false);
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const [rotateMap, setRotateMap] = useState(false); // Ny state
  const filterMenuRef = useRef<HTMLDivElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [savedPairs, setSavedPairs] = useState<PointPair[]>([]);
  // --- For interaktiv target-pos modal ---
  const [showTargetRadiusModal, setShowTargetRadiusModal] = useState(false);
  const [showTargetDirectionUI, setShowTargetDirectionUI] = useState(false);
  const [targetRange, setTargetRange] = useState(250); // Default 250m
  const [targetDirection, setTargetDirection] = useState(0); // Startverdi 0 (nord)
  const [previewTarget, setPreviewTarget] = useState<Position | null>(null);
  const [showCurrentFeedback, setShowCurrentFeedback] = useState(false);
  // State for ny post-dialog
  const [showNewPostDialog, setShowNewPostDialog] = useState(false);
  const [newPostPosition, setNewPostPosition] = useState<Position | null>(null);
  const [newPostName, setNewPostName] = useState('');

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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!L?.Icon?.Default) return;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
      iconUrl:      'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
      shadowUrl:    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    });
  }, []);

  // 1. Hent alle poster fra backend ved mount
  useEffect(() => {
    fetch('/api/posts')
      .then(res => res.json())
      .then(data => {
        console.log('Fetched posts:', data);
        if (Array.isArray(data)) {
          setSavedPairs(data.map(post => ({
            current: post.current_lat && post.current_lng ? { lat: post.current_lat, lng: post.current_lng } : undefined,
            target: post.target_lat && post.target_lng ? { lat: post.target_lat, lng: post.target_lng } : undefined,
            category: post.category,
            id: post.id,
          })));
        }
      })
      .catch(err => {
        console.error('Error fetching posts:', err);
        alert('Kunne ikke hente poster fra backend.');
      });
  }, []);

  // 2. Lagre current-posisjon til backend
  const handleSaveCurrentPos = () => {
    if (currentPosition) {
      fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_lat: currentPosition.lat,
          current_lng: currentPosition.lng,
          category: 'Skyteplass',
        })
      })
        .then(res => res.json())
        .then(data => {
          console.log('POST response (current):', data);
          setSavedPairs(prev => [...prev, {
            current: { ...currentPosition },
            category: 'Skyteplass',
            id: data.id,
          }]);
          setShowCurrentFeedback(true);
          setTimeout(() => setShowCurrentFeedback(false), 700);
        })
        .catch(err => {
          console.error('Error saving current:', err);
          alert('Kunne ikke lagre Skyteplass.');
        });
    }
  };

  // 3. Lagre target-posisjon til backend
  const handleSaveTargetPos = () => {
    if (currentPosition) {
      fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_lat: currentPosition.lat,
          target_lng: currentPosition.lng,
          category: 'Treffpunkt',
        })
      })
        .then(res => res.json())
        .then(data => {
          console.log('POST response (target):', data);
          setSavedPairs(prev => [...prev, {
            target: { ...currentPosition },
            category: 'Treffpunkt',
            id: data.id,
          }]);
          setShowCurrentFeedback(true);
          setTimeout(() => setShowCurrentFeedback(false), 700);
        })
        .catch(err => {
          console.error('Error saving target:', err);
          alert('Kunne ikke lagre Treffpunkt.');
        });
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

  // 2. Når bruker lagrer ny post, send POST til backend
  const handleSaveNewPost = () => {
    if (newPostPosition && newPostName.trim()) {
      fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newPostName.trim(),
          current_lat: newPostPosition.lat,
          current_lng: newPostPosition.lng,
          category: 'Skyteplass',
        })
      })
        .then(res => res.json())
        .then(data => {
          setSavedPairs(prev => [...prev, {
            current: { ...newPostPosition },
            category: 'Skyteplass',
            id: data.id,
          }]);
          setShowNewPostDialog(false);
          setNewPostName('');
          setNewPostPosition(null);
        });
    }
  };

  // Defensive guards i toppen av renderblokken
  const safePlaces: PlaceData[] = Array.isArray(places) ? places : [];
  const hasSafePlaces = safePlaces.length > 0;
  const safeSavedPairs = Array.isArray(savedPairs) ? savedPairs : [];
  const hasSavedPairs = safeSavedPairs.length > 0;
  const lastPair = hasSavedPairs ? safeSavedPairs[safeSavedPairs.length - 1] : undefined;

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
        {/* OpenStreetMap tiles for testing */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={18}
        />
        
        <MapController 
          onPositionChange={setCurrentPosition} 
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
              fillOpacity: 0.1,
              weight: 2,
            }}
          />
        )}
        {/* Place markers: kun i aware-mode */}
        {mode === 'aware' && showMarkers && hasSafePlaces && safePlaces
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
        {mode === 'track' && hasSavedPairs && (
          <>
            {safeSavedPairs.map((pair, idx) => (
              <React.Fragment key={`pair-current-${idx}`}>
                {pair.current && (
                  <Marker
                    position={[pair.current.lat, pair.current.lng]}
                    icon={L.divIcon({
                      className: 'custom-marker saved-point',
                      html: '<div style="width: 18px; height: 18px; background-color: #2563eb; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div>',
                      iconSize: [18, 18],
                      iconAnchor: [9, 9],
                    })}
                  >
                    <Tooltip direction="top" offset={[0, -10]} permanent>{pair.category}</Tooltip>
                  </Marker>
                )}
              </React.Fragment>
            ))}
            {safeSavedPairs.map((pair, idx) => (
              <React.Fragment key={`pair-target-${idx}`}>
                {pair.target && (
                  <Marker
                    position={[pair.target.lat, pair.target.lng]}
                    icon={L.divIcon({
                      className: 'custom-marker saved-point',
                      html: '<div style="width: 18px; height: 18px; background-color: #dc2626; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div>',
                      iconSize: [18, 18],
                      iconAnchor: [9, 9],
                    })}
                  >
                    <Tooltip direction="top" offset={[0, -10]} permanent>{pair.category}</Tooltip>
                  </Marker>
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
        {/* TODO: Tegn linje og target-pos senere */}
      </MapContainer>

      {/* Center marker overlay - always visible in center */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-[1000]">
        <div className="w-4 h-4 bg-red-600 border-2 border-white rounded-full shadow-lg"></div>
      </div>

      {/* Kompassrose overlay */}
      {isLiveMode && (
        <div className="absolute top-4 left-4 z-[1002]">
          <CompassRose heading={rotateMap ? 0 : (currentPosition?.heading || 0)} />
        </div>
      )}

      {/* Settings & Filter Buttons - Top Right */}
      {false && (
        <div className="fixed top-4 right-4 z-[1001] flex flex-col gap-2">
          <button
            onClick={() => setIsSettingsExpanded((v) => !v)}
            className="bg-white/90 backdrop-blur-sm w-12 h-12 rounded-lg shadow-lg flex items-center justify-center hover:bg-white transition-colors border border-gray-200"
            title="Innstillinger"
          >
            <span className="text-2xl">⚙️</span>
          </button>
          <button
            onClick={() => setIsFilterExpanded((v) => !v)}
            className="bg-white/90 backdrop-blur-sm w-12 h-12 rounded-lg shadow-lg flex items-center justify-center hover:bg-white transition-colors border border-gray-200"
            title="Filter"
          >
            <span className="text-2xl">🧩</span>
          </button>
        </div>
      )}

      {/* Settings Menu */}
      {isSettingsExpanded && (
        <div className="fixed top-20 right-4 z-[1002]">
      <SettingsMenu 
        categoryConfigs={categoryConfigs}
        onCategoryConfigChange={onCategoryConfigChange || (() => {})}
        angleRange={angleRange}
        onAngleRangeChange={onAngleRangeChange || (() => {})}
      />
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
            onClick={handleSaveTargetPos}
            className="flex-1 min-w-[60px] max-w-[110px] w-auto h-9 rounded-full shadow-lg bg-red-600 hover:bg-red-700 text-white font-semibold text-[0.75rem] transition-colors border border-red-700 flex flex-col items-center justify-center px-[0.375em] py-[0.375em]"
            title="Save target pos"
          >
            <span className="text-[10px] mt-0.5">Target</span>
          </button>
          <button
            onClick={handleSaveCurrentPos}
            className="flex-1 min-w-[60px] max-w-[110px] w-auto h-9 rounded-full shadow-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[0.75rem] transition-colors border border-blue-700 flex flex-col items-center justify-center px-[0.375em] py-[0.375em]"
            title="Save current pos"
          >
            <span className="text-[10px] mt-0.5">Current</span>
          </button>
        </div>
      )}
      {/* Scan & Live Buttons - Bottom Right */}
      <div className="fixed bottom-4 right-4 sm:bottom-4 sm:right-4 bottom-2 right-2 z-[1000] flex flex-col gap-2">
          <button
            onClick={onScanArea}
          disabled={mode === 'track'}
          className={`w-12 h-12 rounded-full shadow-lg transition-colors flex items-center justify-center ${
            mode === 'track'
              ? 'bg-gray-400 cursor-not-allowed text-white'
              : isScanning 
                ? 'bg-gray-400 cursor-not-allowed text-white' 
                : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
          title={mode === 'track' ? 'Scan disabled in Track-mode' : (isScanning ? 'Scanning...' : 'Scan område')}
        >
          {isScanning ? '⏳' : '🔍'}
        </button>
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
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[2000]">
          <div className="bg-white rounded-lg shadow-lg p-6 w-80 flex flex-col gap-4">
            <div className="text-xl font-bold mb-2 text-gray-800">Velg avstand</div>
            <label className="text-base font-semibold text-gray-700">Range (meter):
              <input
                type="number"
                min={1}
                max={999}
                value={targetRange}
                onChange={e => setTargetRange(Math.max(1, Math.min(999, Number(e.target.value))))}
                className="w-full border rounded px-2 py-1 mt-1 mb-2 text-lg text-gray-900"
                maxLength={3}
              />
              <input
                type="range"
                min={1}
                max={999}
                value={targetRange}
                onChange={e => setTargetRange(Number(e.target.value))}
                className="w-full mt-1"
              />
              <div className="text-base text-gray-800 text-center font-semibold">{targetRange} meter</div>
            </label>
            <div className="flex gap-2 justify-end mt-2">
              <button
                onClick={() => setShowTargetRadiusModal(false)}
                className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold"
              >Avbryt</button>
              <button
                onClick={handleTargetRadiusOk}
                className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold"
              >OK</button>
      </div>
          </div>
        </div>
      )}
      {/* Feedback for current-pos lagring */}
      {showCurrentFeedback && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[3000] bg-green-500 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2 animate-bounce">
          <span className="text-2xl">✅</span>
          <span className="font-semibold text-lg">Punkt lagret!</span>
        </div>
      )}
      {/* Slider og lagre-knapp for retning (andre steg) */}
      {showTargetDirectionUI && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[2002] bg-white rounded-lg shadow-lg px-4 py-3 flex flex-col items-center gap-2 w-[90vw] max-w-xs">
          <label className="text-sm font-medium w-full">Retning (grader):
            <input
              type="range"
              min={-180}
              max={180}
              value={targetDirection}
              onChange={e => setTargetDirection(Number(e.target.value))}
              className="w-full mt-1"
            />
            <div className="text-base text-gray-800 text-center font-semibold">
              {((targetDirection + 360) % 360)}° {
                ((targetDirection + 360) % 360) === 0 ? '(nord)' :
                ((targetDirection + 360) % 360) === 180 ? '(sør)' :
                ((targetDirection + 360) % 360) === 90 ? '(øst)' :
                ((targetDirection + 360) % 360) === 270 ? '(vest)' : ''
              }
            </div>
          </label>
          <button
            onClick={handleTargetModalSave}
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
                className="w-full border rounded px-2 py-1 mt-1 mb-2 text-lg text-gray-900"
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
    </div>
  );
}
