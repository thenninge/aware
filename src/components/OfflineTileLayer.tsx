'use client';

import { useEffect, useRef } from 'react';
import { TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { getTile, saveTile } from '@/lib/idb';
import { OFFLINE_MAP_LAYER, isOfflineMapLayer, mapTileProxyUrl } from '@/lib/map/offlineLayers';

interface OfflineTileLayerProps {
  url: string;
  attribution?: string;
  maxZoom?: number;
  layerKey: string;
  enableCaching?: boolean;
}

class OfflineCachingTileLayer extends L.TileLayer {
  layerKey: string;

  constructor(urlTemplate: string, options: L.TileLayerOptions & { layerKey: string }) {
    super(urlTemplate, options);
    this.layerKey = options.layerKey;
  }

  createTile(coords: L.Coords, done: L.DoneCallback): HTMLElement {
    const tile = document.createElement('img') as HTMLImageElement;
    tile.alt = '';
    tile.setAttribute('role', 'presentation');
    if (this.options.crossOrigin || this.options.crossOrigin === '') {
      tile.crossOrigin = this.options.crossOrigin === true ? '' : String(this.options.crossOrigin);
    }

    const { z, x, y } = coords;
    const fallbackKeys = [OFFLINE_MAP_LAYER, 'esri'].filter((key) => key !== this.layerKey);
    let settled = false;

    const fail = () => {
      if (settled) return;
      settled = true;
      L.Util.bind(this._tileOnError, this, done, tile)();
    };

    const showBlob = (blob: Blob) => {
      if (settled) return;
      settled = true;
      tile.src = URL.createObjectURL(blob);
    };

    L.DomEvent.on(tile, 'load', () => {
      settled = true;
    });
    L.DomEvent.on(tile, 'load', L.Util.bind(this._tileOnLoad, this, done, tile));
    L.DomEvent.on(tile, 'error', () => {
      if (settled) {
        L.Util.bind(this._tileOnError, this, done, tile)();
        return;
      }
      void tryFallbacks().then((hit) => {
        if (!hit) fail();
      });
    });

    const tryFallbacks = async (): Promise<boolean> => {
      for (const key of fallbackKeys) {
        try {
          const cached = await getTile(key, z, x, y);
          if (cached) {
            showBlob(cached);
            return true;
          }
        } catch {}
      }
      return false;
    };

    void (async () => {
      try {
        const own = await getTile(this.layerKey, z, x, y);
        if (own) {
          showBlob(own);
          return;
        }
      } catch {}

      if (navigator.onLine !== false) {
        if (isOfflineMapLayer(this.layerKey)) {
          try {
            const response = await fetch(mapTileProxyUrl(this.layerKey, z, x, y));
            if (response.ok) {
              const blob = await response.blob();
              void saveTile(this.layerKey, z, x, y, blob);
              showBlob(blob);
              return;
            }
          } catch {}
          const hit = await tryFallbacks();
          if (!hit) fail();
          return;
        }

        tile.src = this.getTileUrl(coords);
        return;
      }

      const hit = await tryFallbacks();
      if (!hit) fail();
    })();

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
      if (layerRef.current) map.removeLayer(layerRef.current);
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
