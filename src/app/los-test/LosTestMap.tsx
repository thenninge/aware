'use client';

import { MapContainer, TileLayer, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useViewshed } from '@/components/useViewshed';
import ViewshedLeafletOverlay from '@/components/ViewshedLeafletOverlay';

function ClickHandler({
  onClick,
  disabled,
}: {
  onClick: (pos: { lat: number; lng: number }) => void;
  disabled: boolean;
}) {
  useMapEvents({
    click(e) {
      if (disabled) return;
      onClick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

export default function LosTestMap() {
  const los = useViewshed({
    radiusM: 350,
    rays: 180,
    samples: 64,
    observerHeightM: 5,
    targetHeightM: 0,
  });

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      <MapContainer
        center={[60.5936, 12.3955]}
        zoom={14}
        style={{ width: '100%', height: '100%' }}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickHandler
          disabled={los.status === 'running'}
          onClick={(pos) => {
            los.clear();
            los.runAt(pos);
          }}
        />
        <ViewshedLeafletOverlay data={los.data} />
      </MapContainer>
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: 10,
          zIndex: 1000,
          background: 'rgba(255,255,255,0.9)',
          border: '1px solid #ddd',
          borderRadius: 8,
          padding: '8px 10px',
          fontSize: 12,
          color: '#111827',
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 4 }}>LOS-test (Terrarium DEM)</div>
        <div>Radius: {los.meta.radiusM} m</div>
        <div>Rays: {los.meta.rays}</div>
        <div>Samples: {los.meta.samples}</div>
        <div>Status: {los.status}</div>
        <div style={{ marginTop: 6 }}>
          <button
            onClick={() => los.clear()}
            disabled={los.status === 'running'}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #ccc' }}
          >
            {los.status === 'running' ? 'Beregner…' : 'Tøm LOS'}
          </button>
        </div>
        <div style={{ marginTop: 6, color: '#374151' }}>Klikk i kartet for LOS. Ingen Google Elevation.</div>
        {los.error && (
          <div style={{ marginTop: 6, color: '#b91c1c' }}>Feil: {los.error}</div>
        )}
      </div>
    </div>
  );
}
