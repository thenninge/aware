import { NextRequest, NextResponse } from 'next/server';
import { fetchPlacesAround, fetchPlacesInBbox } from '@/lib/places/overpass';

export const dynamic = 'force-dynamic';
export const maxDuration = 10;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const south = searchParams.get('south');
  const west = searchParams.get('west');
  const north = searchParams.get('north');
  const east = searchParams.get('east');

  if (south && west && north && east) {
    const southNum = parseFloat(south);
    const westNum = parseFloat(west);
    const northNum = parseFloat(north);
    const eastNum = parseFloat(east);
    if (![southNum, westNum, northNum, eastNum].every(Number.isFinite) || southNum >= northNum || westNum >= eastNum) {
      return NextResponse.json({ error: 'Invalid bounding box' }, { status: 400 });
    }
    try {
      const places = await fetchPlacesInBbox(southNum, westNum, northNum, eastNum);
      return NextResponse.json({
        success: true,
        data: places,
        count: places.length,
        query: { south: southNum, west: westNum, north: northNum, east: eastNum },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const busy = message === 'OVERPASS_UNAVAILABLE';
      return NextResponse.json(
        {
          error: busy ? 'Overpass is busy or blocked from this server' : 'Failed to fetch data from Overpass API',
          details: message,
        },
        { status: busy ? 503 : 500 }
      );
    }
  }

  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');
  const radius = searchParams.get('radius');

  if (!lat || !lng || !radius) {
    return NextResponse.json(
      { error: 'Missing required parameters: lat, lng, radius (or south, west, north, east)' },
      { status: 400 }
    );
  }

  const latNum = parseFloat(lat);
  const lngNum = parseFloat(lng);
  const radiusNum = parseInt(radius, 10);
  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum) || Math.abs(latNum) > 90 || Math.abs(lngNum) > 180) {
    return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 });
  }
  if (radiusNum > 4000) {
    return NextResponse.json(
      {
        error: 'Radius too large for reliable results',
        suggestion: 'Please reduce radius to 4000m or less.',
        maxRadius: 4000,
        recommendedRadius: 2000,
      },
      { status: 400 }
    );
  }

  try {
    const places = await fetchPlacesAround(latNum, lngNum, radiusNum);
    return NextResponse.json({
      success: true,
      data: places,
      count: places.length,
      query: {
        lat: latNum,
        lng: lngNum,
        radius: radiusNum,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const busy = message === 'OVERPASS_UNAVAILABLE';
    return NextResponse.json(
      {
        error: busy
          ? 'Overpass is busy or blocked from this server'
          : 'Failed to fetch data from Overpass API',
        details: message,
      },
      { status: busy ? 503 : 500 }
    );
  }
}
