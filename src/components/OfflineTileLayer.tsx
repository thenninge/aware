'use client';

import { useEffect, useRef } from 'react';
import { TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { getTile, saveTile } from '@/lib/idb';

interface OfflineTileLayerProps {
  url: string;
  attribution?: string;
  maxZoom?: number;
  layerKey: string;
  enableCaching?: boolean;
}

// Custom TileLayer with offline caching
class OfflineCachingTileLayer extends L.TileLayer {
  layerKey: string;
  
  constructor(urlTemplate: string, options: L.TileLayerOptions & { layerKey: string }) {
    super(urlTemplate, options);
    this.layerKey = options.layerKey;
  }
  
  createTile(coords: L.Coords, done: L.DoneCallback): HTMLElement {
    const tile = document.createElement('img') as HTMLImageElement;
    
    L.DomEvent.on(tile, 'load', L.Util.bind(this._tileOnLoad, this, done, tile));
    L.DomEvent.on(tile, 'error', L.Util.bind(this._tileOnError, this, done, tile));
    
    if (this.options.crossOrigin || this.options.crossOrigin === '') {
      tile.crossOrigin = this.options.crossOrigin === true ? '' : this.options.crossOrigin;
    }
    
    tile.alt = '';
    tile.setAttribute('role', 'presentation');
    
    const { z, x, y } = coords;
    
    // Try to load from cache first
    getTile(this.layerKey, z, x, y)
      .then((cachedBlob) => {
        if (cachedBlob && tile.parentElement) {
          tile.src = URL.createObjectURL(cachedBlob);
        } else {
          const tileUrl = this.getTileUrl(coords);
          tile.src = tileUrl;
          
          // Cache the tile after it loads
          fetch(tileUrl)
            .then((response) => response.blob())
            .then((blob) => {
              saveTile(this.layerKey, z, x, y, blob).catch(() => {
                // Silently fail - caching is optional
              });
            })
            .catch(() => {
              // Silently fail - network error
            });
        }
      })
      .catch(() => {
        const tileUrl = this.getTileUrl(coords);
        tile.src = tileUrl;
      });
    
    return tile;
  }
}

function OfflineTileLayerImpl({ layerKey, url, attribution, maxZoom }: OfflineTileLayerProps) {
  const map = useMap();
  const layerRef = useRef<OfflineCachingTileLayer | null>(null);
  
  useEffect(() => {
    if (!map) return;
    
    const layer = new OfflineCachingTileLayer(url, {
      attribution,
      maxZoom,
      layerKey,
    });
    
    layer.addTo(map);
    layerRef.current = layer;
    
    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
      }
    };
  }, [map, url, attribution, maxZoom, layerKey]);
  
  return null;
}

export default function OfflineTileLayer(props: OfflineTileLayerProps) {
  if (!props.enableCaching) {
    return (
      <TileLayer
        url={props.url}
        attribution={props.attribution}
        maxZoom={props.maxZoom}
      />
    );
  }
  
  return <OfflineTileLayerImpl {...props} />;
}
