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

// kumi.systems hangs (dead since 2026-09). overpass-api.de 406/refuses from
// many clients. osm.ch returns empty success for Norway. Europe extract:
const ENDPOINTS = [
  'https://ovp.dresel.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

const ATTEMPT_MS = 8000;

function buildQuery(lat: number, lng: number, radius: number): string {
  return `[out:json][timeout:6];
nwr["place"~"city|town|village|hamlet|farm|isolated_dwelling"](around:${Math.round(radius)},${lat},${lng});
out center;`;
}

function categorize(placeTag?: string): string {
  if (placeTag && PLACE_CATEGORIES.includes(placeTag as (typeof PLACE_CATEGORIES)[number])) {
    return placeTag;
  }
  return 'other';
}

type OverpassElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
};

type OverpassJson = {
  elements?: OverpassElement[];
};

function parsePlaces(raw: OverpassJson, fallbackLat: number, fallbackLng: number): PlaceData[] {
  return (raw.elements || [])
    .map((element) => {
      const category = categorize(element.tags?.place);
      return {
        id: element.id,
        type: element.type,
        lat: element.lat ?? element.center?.lat ?? fallbackLat,
        lng: element.lon ?? element.center?.lon ?? fallbackLng,
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
    );
}

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
      // No Accept header: overpass-api.de and some WAFs 406 on application/json.
      // No custom headers in the browser so this stays a simple CORS request.
      headers:
        typeof window === 'undefined'
          ? { 'User-Agent': 'ColdBoreAware/1.5 (+https://cbaware.vercel.app)' }
          : undefined,
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

async function queryOwnApi(
  lat: number,
  lng: number,
  radius: number,
  outer?: AbortSignal
): Promise<PlaceData[] | null> {
  if (outer?.aborted) return null;
  const { signal, cancel } = mergeSignals(9000, outer);
  const url = `/api/overpass?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}&radius=${Math.round(radius)}`;
  try {
    const response = await fetch(url, { method: 'GET', cache: 'no-store', signal });
    if (!response.ok) return null;
    const data = await response.json();
    if (!data?.success || !Array.isArray(data.data)) return null;
    return data.data as PlaceData[];
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
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    throw new Error('OVERPASS_UNAVAILABLE');
  }
  // Browser: same-origin API first. Safari/PWA often block direct Overpass.
  // Server must not call /api/overpass (that would recurse).
  if (typeof window !== 'undefined') {
    if (signal?.aborted) throw new Error('OVERPASS_ABORTED');
    const fromApi = await queryOwnApi(lat, lng, radius, signal);
    if (fromApi) return fromApi;
  }

  const query = buildQuery(lat, lng, radius);
  const endpoints = typeof window === 'undefined' ? ENDPOINTS.slice(0, 1) : ENDPOINTS;

  for (const endpoint of endpoints) {
    if (signal?.aborted) throw new Error('OVERPASS_ABORTED');
    const raw = await queryEndpoint(endpoint, query, signal);
    if (raw) return parsePlaces(raw, lat, lng);
  }

  throw new Error('OVERPASS_UNAVAILABLE');
}

function buildBboxQuery(south: number, west: number, north: number, east: number): string {
  return `[out:json][timeout:6];
nwr["place"~"city|town|village|hamlet|farm|isolated_dwelling"](${south},${west},${north},${east});
out center;`;
}

async function queryOwnApiBbox(
  south: number,
  west: number,
  north: number,
  east: number,
  outer?: AbortSignal
): Promise<PlaceData[] | null> {
  if (outer?.aborted) return null;
  const { signal, cancel } = mergeSignals(9000, outer);
  const url = `/api/overpass?south=${south}&west=${west}&north=${north}&east=${east}`;
  try {
    const response = await fetch(url, { method: 'GET', cache: 'no-store', signal });
    if (!response.ok) return null;
    const data = await response.json();
    if (!data?.success || !Array.isArray(data.data)) return null;
    return data.data as PlaceData[];
  } catch {
    return null;
  } finally {
    cancel();
  }
}

export async function fetchPlacesInBbox(
  south: number,
  west: number,
  north: number,
  east: number,
  signal?: AbortSignal
): Promise<PlaceData[]> {
  if (![south, west, north, east].every(Number.isFinite) || south >= north || west >= east) {
    throw new Error('OVERPASS_UNAVAILABLE');
  }
  const midLat = (south + north) / 2;
  const midLng = (west + east) / 2;
  if (typeof window !== 'undefined') {
    if (signal?.aborted) throw new Error('OVERPASS_ABORTED');
    const fromApi = await queryOwnApiBbox(south, west, north, east, signal);
    if (fromApi) return fromApi;
  }

  const query = buildBboxQuery(south, west, north, east);
  const endpoints = typeof window === 'undefined' ? ENDPOINTS.slice(0, 1) : ENDPOINTS;
  for (const endpoint of endpoints) {
    if (signal?.aborted) throw new Error('OVERPASS_ABORTED');
    const raw = await queryEndpoint(endpoint, query, signal);
    if (raw) return parsePlaces(raw, midLat, midLng);
  }
  throw new Error('OVERPASS_UNAVAILABLE');
}
