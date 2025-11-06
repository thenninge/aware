"use client";

import GoogleMapLayer from '@/components/GoogleMapLayer';

export default function TestGoogleMapPage() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <GoogleMapLayer centerLat={59.91} centerLng={10.75} zoom={12} />
    </div>
  );
}


