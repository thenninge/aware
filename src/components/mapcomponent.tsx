'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Position {
  lat: number;
  lng: number;
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
}

interface CategoryFilter {
  village: boolean;
  dwelling: boolean;
  city: boolean;
  farm: boolean;
}

interface CategoryConfig {
  color: string;
  opacity: number;
  icon: string;
}

// Component to handle map interactions
function MapController({ onPositionChange, radius, onError, categoryFilters, categoryConfigs }: { 
  onPositionChange?: (position: Position) => void; 
  radius: number;
  onError?: () => void;
  categoryFilters: CategoryFilter;
  categoryConfigs: Record<keyof CategoryFilter, CategoryConfig>;
}) {
  const map = useMap();
  const defaultPos: Position = { lat: 60.424834440433045, lng: 12.408766398367092 };
  const [places, setPlaces] = useState<PlaceData[]>([]);
  const [loading, setLoading] = useState(false);

  // Fix Leaflet icons when component mounts
  useEffect(() => {
    if (typeof window !== 'undefined' && typeof L !== 'undefined') {
      try {
        delete (L.Icon.Default.prototype as any)._getIconUrl;
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
      // Set default position
      map.setView([defaultPos.lat, defaultPos.lng], 13);

      // Handle map clicks for manual position selection
      const handleMapClick = (e: L.LeafletMouseEvent) => {
        const pos: Position = {
          lat: e.latlng.lat,
          lng: e.latlng.lng,
        };
        onPositionChange?.(pos);
      };

      map.on('click', handleMapClick);

      return () => {
        map.off('click', handleMapClick);
      };
    } catch (error) {
      console.error('Map controller error:', error);
      onError?.();
    }
  }, [map, onError]);

  // Fetch places when radius changes
  useEffect(() => {
    const fetchPlaces = async () => {
      setLoading(true);
      try {
        console.log('Fetching places for radius:', radius);
        const response = await fetch(
          `/api/overpass?lat=${defaultPos.lat}&lng=${defaultPos.lng}&radius=${radius}`
        );
        
        if (response.ok) {
          const result = await response.json();
          console.log('Found places:', result.data?.length || 0);
          console.log('Places:', result.data?.map((p: PlaceData) => ({ name: p.name, category: p.category })) || []);
          setPlaces(result.data || []);
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
  }, [radius]);

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
      {/* Default position marker */}
      <Marker
        position={defaultPos}
        icon={L.divIcon({
          className: 'custom-marker selected-position',
          html: '<div style="width: 12px; height: 12px; background-color: #dc2626; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div>',
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        })}
      />
      
      {/* Radius circle */}
      <Circle
        key={`radius-${radius}`}
        center={defaultPos}
        radius={radius}
        pathOptions={{
          color: '#3b82f6',
          fillColor: '#3b82f6',
          fillOpacity: 0.1,
          weight: 2,
        }}
      />

      {/* Place markers */}
      {places
        .filter(place => {
          // Filter based on category filters
          if (place.category === 'village' && !categoryFilters.village) return false;
          if (place.category === 'dwelling' && !categoryFilters.dwelling) return false;
          if (place.category === 'city' && !categoryFilters.city) return false;
          if (place.category === 'farm' && !categoryFilters.farm) return false;
          return true;
        })
        .map((place) => {
          let config = categoryConfigs.village; // default
          
          // Get config based on category
          if (place.category === 'village') config = categoryConfigs.village;
          else if (place.category === 'dwelling') config = categoryConfigs.dwelling;
          else if (place.category === 'city') config = categoryConfigs.city;
          else if (place.category === 'farm') config = categoryConfigs.farm;

          return (
            <Marker
              key={`${place.type}-${place.id}`}
              position={[place.lat, place.lng]}
              icon={L.divIcon({
                className: 'custom-marker place-marker',
                html: `<div style="color: ${config.color}; font-size: 16px; text-shadow: 1px 1px 2px rgba(0,0,0,0.8); opacity: ${config.opacity};">${config.icon}</div>`,
                iconSize: [20, 20],
                iconAnchor: [10, 10],
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
    </>
  );
}

export default function MapComponent({ radius, onPositionChange, onError, categoryFilters, categoryConfigs }: MapComponentProps) {
  const [isLeafletLoaded, setIsLeafletLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

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
    <div className="w-full h-screen">
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
          onPositionChange={onPositionChange} 
          radius={radius}
          onError={() => {
            setHasError(true);
            onError?.();
          }}
          categoryFilters={categoryFilters}
          categoryConfigs={categoryConfigs}
        />
      </MapContainer>
    </div>
  );
}
