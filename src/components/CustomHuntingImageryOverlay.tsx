'use client';

import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { getTile, saveTile } from '@/lib/idb';
import { customImageryForHuntingAreas } from '@/lib/map/customHuntingImagery';
import type { CustomHuntingImagery } from '@/lib/map/customHuntingImagery';
import type { HuntingArea } from './settingsmenu';

const PANE = 'huntingImagery';
const PANE_Z = '350';
const TRANSPARENT_PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

class ImageryCachingTileLayer extends L.TileLayer {
  layerKey: string;

  constructor(urlTemplate: string, options: L.TileLayerOptions & { layerKey: string }) {
    super(urlTemplate, options);
    this.layerKey = options.layerKey;
  }

  createTile(coords: L.Coords, done: L.DoneCallback): HTMLElement {
    const tile = document.createElement('img') as HTMLImageElement;
    tile.alt = '';
    tile.setAttribute('role', 'presentation');
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

    L.DomEvent.on(tile, 'load', L.Util.bind(this._tileOnLoad, this, done, tile));
    L.DomEvent.on(tile, 'error', () => fail());

    const { z, x, y } = coords;
    const url = this.getTileUrl(coords);

    void (async () => {
      try {
        const cached = await getTile(this.layerKey, z, x, y);
        if (cached) {
          showBlob(cached);
          return;
        }
      } catch {}

      try {
        const response = await fetch(url);
        if (!response.ok) {
          fail();
          return;
        }
        const blob = await response.blob();
        void saveTile(this.layerKey, z, x, y, blob);
        showBlob(blob);
      } catch {
        fail();
      }
    })();

    return tile;
  }
}

function addImageryLayer(map: L.Map, cfg: CustomHuntingImagery): L.TileLayer {
  if (!map.getPane(PANE)) {
    const pane = map.createPane(PANE);
    pane.style.zIndex = PANE_Z;
    pane.style.pointerEvents = 'none';
  }
  const layer = new ImageryCachingTileLayer(cfg.tileUrl, {
    pane: PANE,
    layerKey: cfg.layerKey,
    bounds: L.latLngBounds(
      [cfg.bounds.south, cfg.bounds.west],
      [cfg.bounds.north, cfg.bounds.east]
    ),
    minZoom: cfg.minZoom,
    maxNativeZoom: cfg.maxNativeZoom,
    maxZoom: 18,
    opacity: 1,
    errorTileUrl: TRANSPARENT_PIXEL,
    attribution: cfg.attribution,
    crossOrigin: 'anonymous',
  });
  layer.addTo(map);
  map.attributionControl?.addAttribution(cfg.attribution);
  return layer;
}

interface CustomHuntingImageryOverlayProps {
  huntingAreas: HuntingArea[];
  enabled: boolean;
}

export default function CustomHuntingImageryOverlay({
  huntingAreas,
  enabled,
}: CustomHuntingImageryOverlayProps) {
  const map = useMap();
  const namesKey = huntingAreas.map((area) => area.name).join('|');

  useEffect(() => {
    if (!enabled) return;
    const configs = customImageryForHuntingAreas(huntingAreas.map((area) => area.name));
    if (configs.length === 0) return;

    const layers = configs.map((cfg) => ({
      layer: addImageryLayer(map, cfg),
      attribution: cfg.attribution,
    }));

    return () => {
      layers.forEach(({ layer, attribution }) => {
        map.removeLayer(layer);
        map.attributionControl?.removeAttribution(attribution);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, enabled, namesKey]);

  return null;
}
