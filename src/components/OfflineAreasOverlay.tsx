'use client';

import { useEffect, useState } from 'react';
import { Rectangle, Tooltip } from 'react-leaflet';
import { getOfflineAreas, type OfflineArea } from '@/lib/idb';

export default function OfflineAreasOverlay() {
  const [areas, setAreas] = useState<OfflineArea[]>([]);

  useEffect(() => {
    const load = () => {
      void getOfflineAreas()
        .then(setAreas)
        .catch(() => setAreas([]));
    };
    load();
    window.addEventListener('aware-offline-areas-changed', load);
    return () => window.removeEventListener('aware-offline-areas-changed', load);
  }, []);

  if (!areas.length) return null;

  return (
    <>
      {areas.map((area) => (
        <Rectangle
          key={area.id}
          bounds={[
            [area.bounds.south, area.bounds.west],
            [area.bounds.north, area.bounds.east],
          ]}
          pathOptions={{
            color: '#0f766e',
            weight: 1,
            dashArray: '6 6',
            fillOpacity: 0.04,
          }}
        >
          <Tooltip permanent={false}>
            {area.huntingAreaId ? `${area.name} (jaktfelt, offline)` : `${area.name} (offline)`}
          </Tooltip>
        </Rectangle>
      ))}
    </>
  );
}
