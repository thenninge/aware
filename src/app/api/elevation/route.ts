import { NextResponse } from 'next/server';

/**
 * Google Elevation API is intentionally disabled.
 * Height queries go through Terrarium DEM (MapService / TerrainEngine).
 */
export async function GET() {
  return NextResponse.json(
    {
      status: 'GONE',
      error_message:
        'Google Elevation API is disabled. Use local Terrarium DEM via MapService.',
    },
    { status: 410 }
  );
}
