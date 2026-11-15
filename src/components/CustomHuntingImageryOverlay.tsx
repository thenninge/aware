'use client';

import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { customImageryForHuntingAreas } from '@/lib/map/customHuntingImagery';
import type { HuntingArea } from './settingsmenu';

const PANE = 'huntingImagery';
const PANE_Z = '350';

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

    if (!map.getPane(PANE)) {
      const pane = map.createPane(PANE);
      pane.style.zIndex = PANE_Z;
      pane.style.pointerEvents = 'none';
    }

    const layers = configs.map((cfg) => {
      const layer = L.imageOverlay(cfg.url, cfg.bounds, {
        pane: PANE,
        opacity: 1,
        interactive: false,
        crossOrigin: 'anonymous',
      });
      layer.addTo(map);
      map.attributionControl?.addAttribution(cfg.attribution);
      return { layer, attribution: cfg.attribution };
    });

    return () => {
      layers.forEach(({ layer, attribution }) => {
        map.removeLayer(layer);
        map.attributionControl?.removeAttribution(attribution);
      });
    };
    // huntingAreas identity is represented by namesKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, enabled, namesKey]);

  return null;
}
