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

// One primary + one fallback. lz4 is the same cluster as overpass-api.de.
const ENDPOINTS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
];

const ATTEMPT_MS = 6000;

function buildQuery(lat: number, lng: number, radius: number): string {
  return `[out:json][timeout:5];
node["place"~"city|town|village|hamlet|farm|isolated_dwelling"](around:${Math.round(radius)},${lat},${lng});
out body;`;
}

function categorize(placeTag?: string): string {
  if (placeTag && PLACE_CATEGORIES.includes(placeTag as (typeof PLACE_CATEGORIES)[number])) {
    return placeTag;
  }
  return 'other';
}

function parsePlaces(
  raw: {
    elements?: Array<{
      type: string;
      id: number;
      lat?: number;
      lon?: number;
      tags?: Record<string, string>;
    }>;
  },
  fallbackLat: number,
  fallbackLng: number
): PlaceData[] {
  return (raw.elements || [])
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

function mergeSignals(timeoutMs: number, outer?: AbortSignal): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onOuterAbort = () => controller.abort();
  outer?.addEventListener('abort', onOuterAbort);
  return {
    signal: controller.signal,
    cancel: () => {
      clearTimeout(timer);
      outer?.removeEventListener('abort', onOuterAbort);
    },
  };
}

async function queryEndpoint(
  endpoint: string,
  query: string,
  outer?: AbortSignal
): Promise<OverpassJson | null> {
  if (outer?.aborted) return null;
  const { signal, cancel } = mergeSignals(ATTEMPT_MS, outer);
  const url = `${endpoint}?data=${encodeURIComponent(query)}`;
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...(typeof window === 'undefined' ? { 'User-Agent': 'overpass-turbo/aware' } : {}),
      },
      signal,
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (!data || !Array.isArray(data.elements)) return null;
    return data;
  } catch {
    return null;
  } finally {
    cancel();
  }
}

export async function fetchPlacesAround(
  lat: number,
  lng: number,
  radius: number,
  signal?: AbortSignal
): Promise<PlaceData[]> {
  const query = buildQuery(lat, lng, radius);
  const endpoints = typeof window === 'undefined' ? ENDPOINTS.slice(0, 1) : ENDPOINTS;

  for (const endpoint of endpoints) {
    if (signal?.aborted) throw new Error('OVERPASS_ABORTED');
    const raw = await queryEndpoint(endpoint, query, signal);
    if (raw) return parsePlaces(raw, lat, lng);
  }

  throw new Error('OVERPASS_UNAVAILABLE');
}
