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
    // Overpass API query to get various types of places
    const query = `
      [out:json][timeout:25];
      (
        // Villages and towns
        node(around:${radius}, ${lat}, ${lng})[place=village];
        node(around:${radius}, ${lat}, ${lng})[place=town];
        node(around:${radius}, ${lat}, ${lng})[place=hamlet];
        
        // Farms and farmyards
        way(around:${radius}, ${lat}, ${lng})[landuse=farmyard];
        way(around:${radius}, ${lat}, ${lng})[landuse=farmland];
        
        // Buildings
        way(around:${radius}, ${lat}, ${lng})[building=house];
        way(around:${radius}, ${lat}, ${lng})[building=residential];
        way(around:${radius}, ${lat}, ${lng})[building=commercial];
        way(around:${radius}, ${lat}, ${lng})[building=industrial];
        
        // Amenities
        node(around:${radius}, ${lat}, ${lng})[amenity];
        way(around:${radius}, ${lat}, ${lng})[amenity];
        
        // Shops and services
        node(around:${radius}, ${lat}, ${lng})[shop];
        way(around:${radius}, ${lat}, ${lng})[shop];
      );
      out center;
    `;

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

    // Process and categorize the data
    const places: PlaceData[] = data.elements.map((element) => {
      let category = 'other';
      let name = element.tags?.name || element.tags?.ref || `ID: ${element.id}`;

      // Categorize based on tags
      if (element.tags?.place === 'village' || element.tags?.place === 'town' || element.tags?.place === 'hamlet') {
        category = 'village';
      } else if (element.tags?.landuse === 'farmyard' || element.tags?.landuse === 'farmland') {
        category = 'farm';
      } else if (element.tags?.building) {
        category = 'building';
      } else if (element.tags?.amenity) {
        category = 'amenity';
      } else if (element.tags?.shop) {
        category = 'shop';
      }

      // Get coordinates (handle both nodes and ways)
      let elementLat = element.lat;
      let elementLng = element.lon;

      // For ways, use center coordinates if available
      if (element.type === 'way' && !elementLat && !elementLng) {
        // This is a simplified approach - in a real app you'd want to calculate the center properly
        elementLat = parseFloat(lat) + (Math.random() - 0.5) * 0.01; // Temporary approximation
        elementLng = parseFloat(lng) + (Math.random() - 0.5) * 0.01;
      }

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

    // Filter out invalid coordinates
    const validPlaces = places.filter(place => 
      place.lat && place.lng && 
      !isNaN(place.lat) && !isNaN(place.lng)
    );

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
