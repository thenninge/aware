'use client';

import { useEffect, useState, useCallback } from 'react';
import { useMap, Rectangle } from 'react-leaflet';
import L from 'leaflet';

interface OfflineAreaDefinerProps {
  isDefining: boolean;
  onAreaDefined: (bounds: { north: number; south: number; east: number; west: number }) => void;
  onCancel: () => void;
}

export default function OfflineAreaDefiner({
  isDefining,
  onAreaDefined,
  onCancel,
}: OfflineAreaDefinerProps) {
  const map = useMap();
  const [rectangleBounds, setRectangleBounds] = useState<L.LatLngBounds | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<L.LatLng | null>(null);

  const handleMapClick = useCallback((e: L.LeafletMouseEvent) => {
    if (!isDefining) return;

    if (!isDrawing) {
      // First click - start drawing
      setStartPoint(e.latlng);
      setIsDrawing(true);
      setRectangleBounds(L.latLngBounds(e.latlng, e.latlng));
    } else {
      // Second click - finish drawing
      if (startPoint) {
        const bounds = L.latLngBounds(startPoint, e.latlng);
        setRectangleBounds(bounds);
        
        // Call onAreaDefined with the bounds
        onAreaDefined({
          north: bounds.getNorth(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          west: bounds.getWest(),
        });
        
        // Reset
        setIsDrawing(false);
        setStartPoint(null);
        setRectangleBounds(null);
      }
    }
  }, [isDefining, isDrawing, startPoint, onAreaDefined]);

  const handleMapMove = useCallback((e: L.LeafletMouseEvent) => {
    if (!isDefining || !isDrawing || !startPoint) return;
    
    // Update rectangle while mouse moves
    setRectangleBounds(L.latLngBounds(startPoint, e.latlng));
  }, [isDefining, isDrawing, startPoint]);

  const handleKeyPress = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && isDefining) {
      setIsDrawing(false);
      setStartPoint(null);
      setRectangleBounds(null);
      onCancel();
    }
  }, [isDefining, onCancel]);

  useEffect(() => {
    if (!map || !isDefining) return;

    // Add event listeners
    map.on('click', handleMapClick);
    map.on('mousemove', handleMapMove);
    window.addEventListener('keydown', handleKeyPress);

    // Change cursor
    const container = map.getContainer();
    container.style.cursor = 'crosshair';

    return () => {
      map.off('click', handleMapClick);
      map.off('mousemove', handleMapMove);
      window.removeEventListener('keydown', handleKeyPress);
      container.style.cursor = '';
    };
  }, [map, isDefining, handleMapClick, handleMapMove, handleKeyPress]);

  if (!isDefining || !rectangleBounds) return null;

  return (
    <Rectangle
      bounds={rectangleBounds}
      pathOptions={{
        color: '#3b82f6',
        weight: 3,
        fillColor: '#3b82f6',
        fillOpacity: 0.2,
        dashArray: '10, 10',
      }}
    />
  );
}
