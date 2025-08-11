'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in Leaflet with Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

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
}

// Component to handle map interactions
function MapController({ onPositionChange, radius }: { onPositionChange?: (position: Position) => void; radius: number }) {
  const map = useMap();
  const [userPosition, setUserPosition] = useState<Position | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [places, setPlaces] = useState<PlaceData[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Get user's GPS position
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const pos: Position = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setUserPosition(pos);
          setSelectedPosition(pos);
          map.setView([pos.lat, pos.lng], 13);
          onPositionChange?.(pos);
        },
        (error) => {
          console.error('Error getting location:', error);
          // Default to Oslo if GPS fails
          const defaultPos: Position = { lat: 59.9139, lng: 10.7522 };
          setSelectedPosition(defaultPos);
          map.setView([defaultPos.lat, defaultPos.lng], 13);
          onPositionChange?.(defaultPos);
        }
      );
    }

    // Handle map clicks for manual position selection
    const handleMapClick = (e: L.LeafletMouseEvent) => {
      const pos: Position = {
        lat: e.latlng.lat,
        lng: e.latlng.lng,
      };
      setSelectedPosition(pos);
      onPositionChange?.(pos);
    };

    map.on('click', handleMapClick);

    return () => {
      map.off('click', handleMapClick);
    };
  }, [map, onPositionChange]);

  // Fetch places when position or radius changes
  useEffect(() => {
    if (!selectedPosition) return;

    const fetchPlaces = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/overpass?lat=${selectedPosition.lat}&lng=${selectedPosition.lng}&radius=${radius}`
        );
        
        if (response.ok) {
          const result = await response.json();
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
  }, [selectedPosition, radius]);

  return (
    <>
      {/* User position marker (GPS) */}
      {userPosition && (
        <Marker
          position={userPosition}
          icon={L.divIcon({
            className: 'custom-marker user-position',
            html: '📍',
            iconSize: [30, 30],
          })}
        />
      )}
      
      {/* Selected position marker */}
      {selectedPosition && (
        <Marker
          position={selectedPosition}
          icon={L.divIcon({
            className: 'custom-marker selected-position',
            html: '🎯',
            iconSize: [25, 25],
          })}
        />
      )}
      
      {/* Radius circle */}
      {selectedPosition && (
        <Circle
          center={selectedPosition}
          radius={radius}
          pathOptions={{
            color: '#3b82f6',
            fillColor: '#3b82f6',
            fillOpacity: 0.1,
            weight: 2,
          }}
        />
      )}

      {/* Place markers */}
      {places.map((place) => {
        let iconHtml = '🏠';
        let iconColor = '#6b7280';

        // Set icon and color based on category
        switch (place.category) {
          case 'village':
            iconHtml = '🏘️';
            iconColor = '#dc2626'; // Red
            break;
          case 'farm':
            iconHtml = '🏡';
            iconColor = '#ffffff'; // White
            break;
          case 'building':
            iconHtml = '🏢';
            iconColor = '#059669'; // Green
            break;
          case 'amenity':
            iconHtml = '🏥';
            iconColor = '#7c3aed'; // Purple
            break;
          case 'shop':
            iconHtml = '🛒';
            iconColor = '#ea580c'; // Orange
            break;
          default:
            iconHtml = '📍';
            iconColor = '#6b7280'; // Gray
        }

        return (
          <Marker
            key={`${place.type}-${place.id}`}
            position={[place.lat, place.lng]}
            icon={L.divIcon({
              className: 'custom-marker place-marker',
              html: `<div style="color: ${iconColor}; font-size: 20px; text-shadow: 1px 1px 2px rgba(0,0,0,0.8);">${iconHtml}</div>`,
              iconSize: [24, 24],
              iconAnchor: [12, 12],
            })}
          />
        );
      })}

      {/* Loading indicator */}
      {loading && selectedPosition && (
        <div className="absolute top-4 right-4 bg-white p-2 rounded-lg shadow-lg">
          <div className="text-sm text-gray-600">Laster steder...</div>
        </div>
      )}
    </>
  );
}

export default function MapComponent({ radius, onPositionChange }: MapComponentProps) {
  return (
    <div className="w-full h-screen">
      <MapContainer
        center={[59.9139, 10.7522]} // Oslo as default
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
        attributionControl={true}
      >
        {/* Kartverkets WMTS Topographic4 (norsk topografi) */}
        <TileLayer
          url="https://opencache.statkart.no/gatekeeper/gk/gk.open_gmaps?layers=topo4&zoom={z}&x={x}&y={y}"
          attribution='&copy; <a href="https://www.kartverket.no/">Kartverket</a>'
          maxZoom={18}
        />
        
        <MapController onPositionChange={onPositionChange} radius={radius} />
      </MapContainer>
    </div>
  );
}
