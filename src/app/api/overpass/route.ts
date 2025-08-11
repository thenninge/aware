import { NextRequest, NextResponse } from 'next/server';

interface OverpassResponse {
  elements: Array<{
    type: string;
    id: number;
    lat?: number;
    lon?: number;
    tags?: Record<string, string>;
  }>;
}

interface PlaceData {
  id: number;
  type: string;
  lat: number;
  lng: number;
  name?: string;
  category: string;
  tags: Record<string, string>;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');
  const radius = searchParams.get('radius');

  if (!lat || !lng || !radius) {
    return NextResponse.json(
      { error: 'Missing required parameters: lat, lng, radius' },
      { status: 400 }
    );
  }

  try {
    // Overpass API query to get only the categories we control
    const query = `
      [out:json][timeout:25];
      (
        // Villages and settlements
        node(around:${radius}, ${lat}, ${lng})[place=village];
        node(around:${radius}, ${lat}, ${lng})[place=hamlet];
        node(around:${radius}, ${lat}, ${lng})[place=town];
        node(around:${radius}, ${lat}, ${lng})[place=suburb];
        
        // Individual dwellings
        node(around:${radius}, ${lat}, ${lng})[building=house];
        node(around:${radius}, ${lat}, ${lng})[building=residential];
        node(around:${radius}, ${lat}, ${lng})[building=apartments];
        node(around:${radius}, ${lat}, ${lng})[building=detached];
        
        // Cities (larger settlements)
        node(around:${radius}, ${lat}, ${lng})[place=city];
        
        // Farms (look for farm-related names and landuse)
        node(around:${radius}, ${lat}, ${lng})[name~="gård"][place];
        node(around:${radius}, ${lat}, ${lng})[name~="farm"][place];
        node(around:${radius}, ${lat}, ${lng})[landuse=farmland];
        node(around:${radius}, ${lat}, ${lng})[landuse=farmyard];
      );
      out;
    `;

    console.log('Overpass query:', query);

    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!response.ok) {
      throw new Error(`Overpass API error: ${response.status}`);
    }

    const data: OverpassResponse = await response.json();
    console.log('Overpass response count:', data.elements.length);

    // Process and categorize the data
    const places: PlaceData[] = data.elements.map((element) => {
      let category = 'other';
      let name = element.tags?.name || element.tags?.ref || `ID: ${element.id}`;

      // Categorize based on tags - only the categories we control
      if (element.tags?.place === 'village' || element.tags?.place === 'hamlet' || 
          element.tags?.place === 'town' || element.tags?.place === 'suburb') {
        category = 'village';
      } else if (element.tags?.building === 'house' || element.tags?.building === 'residential' ||
                 element.tags?.building === 'apartments' || element.tags?.building === 'detached') {
        category = 'dwelling';
      } else if (element.tags?.place === 'city') {
        category = 'city';
      } else if (element.tags?.name && (element.tags.name.includes('gård') || element.tags.name.includes('farm')) ||
                 element.tags?.landuse === 'farmland' || element.tags?.landuse === 'farmyard') {
        category = 'farm';
      }

      // Get coordinates (nodes only for now)
      const elementLat = element.lat;
      const elementLng = element.lon;

      return {
        id: element.id,
        type: element.type,
        lat: elementLat || parseFloat(lat),
        lng: elementLng || parseFloat(lng),
        name,
        category,
        tags: element.tags || {},
      };
    });

    // Filter out invalid coordinates and only include our controlled categories
    const validPlaces = places.filter(place => 
      place.lat && place.lng && 
      !isNaN(place.lat) && !isNaN(place.lng) &&
      ['village', 'dwelling', 'city', 'farm'].includes(place.category)
    ).slice(0, 50); // Limit to 50 results for testing

    console.log('Valid places found:', validPlaces.length);
    console.log('Categories found:', [...new Set(validPlaces.map(p => p.category))]);
    console.log('Sample places:', validPlaces.slice(0, 3).map(p => ({ name: p.name, category: p.category })));

    return NextResponse.json({
      success: true,
      data: validPlaces,
      count: validPlaces.length,
      query: {
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        radius: parseInt(radius),
      },
    });

  } catch (error) {
    console.error('Overpass API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch data from Overpass API' },
      { status: 500 }
    );
  }
}
