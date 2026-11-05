export interface PlaceData {
  id: number;
  type: string;
  lat: number;
  lng: number;
  name?: string;
  category: string;
  tags: Record<string, string>;
}

const PLACE_CATEGORIES = [
  'city',
  'town',
  'village',
  'hamlet',
  'farm',
  'isolated_dwelling',
] as const;

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

function buildQuery(lat: number, lng: number, radius: number, timeoutSec: number): string {
  return `[out:json][timeout:${timeoutSec}];
node["place"~"city|town|village|hamlet|farm|isolated_dwelling"](around:${radius},${lat},${lng});
out body;`;
}

function categorize(placeTag?: string): string {
  if (placeTag && PLACE_CATEGORIES.includes(placeTag as (typeof PLACE_CATEGORIES)[number])) {
    return placeTag;
  }
  return 'other';
}

function parsePlaces(raw: {
  elements?: Array<{
    type: string;
    id: number;
    lat?: number;
    lon?: number;
    tags?: Record<string, string>;
  }>;
}, fallbackLat: number, fallbackLng: number): PlaceData[] {
  const elements = raw.elements || [];
  return elements
    .map((element) => {
      const category = categorize(element.tags?.place);
      return {
        id: element.id,
        type: element.type,
        lat: element.lat || fallbackLat,
        lng: element.lon || fallbackLng,
        name: element.tags?.name || element.tags?.ref || `ID: ${element.id}`,
        category,
        tags: element.tags || {},
      };
    })
    .filter(
      (place) =>
        place.lat &&
        place.lng &&
        !Number.isNaN(place.lat) &&
        !Number.isNaN(place.lng) &&
        PLACE_CATEGORIES.includes(place.category as (typeof PLACE_CATEGORIES)[number])
    )
    .slice(0, 50);
}

type OverpassJson = Parameters<typeof parsePlaces>[0];

async function queryEndpoint(
  endpoint: string,
  query: string,
  timeoutMs: number
): Promise<OverpassJson | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const url = `${endpoint}?data=${encodeURIComponent(query)}`;
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json, text/plain, */*',
        ...(typeof window === 'undefined'
          ? { 'User-Agent': 'overpass-turbo/aware' }
          : {}),
      },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (!data || !Array.isArray(data.elements)) return null;
    return data;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchPlacesAround(
  lat: number,
  lng: number,
  radius: number
): Promise<PlaceData[]> {
  const timeoutSec = radius > 2000 ? 12 : 10;
  const query = buildQuery(lat, lng, radius, timeoutSec);
  const perAttemptMs = (timeoutSec + 3) * 1000;

  for (const endpoint of ENDPOINTS) {
    const raw = await queryEndpoint(endpoint, query, perAttemptMs);
    if (!raw) continue;
    return parsePlaces(raw, lat, lng);
  }

  throw new Error('OVERPASS_UNAVAILABLE');
}
