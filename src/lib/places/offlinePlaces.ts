import { getAllOfflinePlaces, saveOfflinePlaces } from '../idb';
import { padBounds, rawBoundsFromPolygon, coverBoundsWithCircles, type GeoBounds } from '../geo/tiles';
import {
  isWithinPolygonBuffer,
  nearestWithinRadius,
  polygonFromBounds,
  PLACES_BUFFER_M,
} from '../geo/polygon';
import { fetchPlacesAround, fetchPlacesInBbox, type PlaceData } from './overpass';

function placeKey(place: PlaceData): string {
  return `${place.type}/${place.id}`;
}

function mergePlaces(groups: PlaceData[][]): PlaceData[] {
  const byKey = new Map<string, PlaceData>();
  for (const group of groups) {
    for (const place of group) byKey.set(placeKey(place), place);
  }
  return [...byKey.values()];
}

async function fetchPlacesCoveringBounds(bounds: GeoBounds, signal?: AbortSignal): Promise<PlaceData[]> {
  try {
    return await fetchPlacesInBbox(bounds.south, bounds.west, bounds.north, bounds.east, signal);
  } catch {
    const centers = coverBoundsWithCircles(bounds, 3500).slice(0, 12);
    const groups: PlaceData[][] = [];
    for (let i = 0; i < centers.length; i += 2) {
      if (signal?.aborted) throw new Error('Download cancelled');
      const batch = await Promise.all(
        centers.slice(i, i + 2).map((center) =>
          fetchPlacesAround(center.lat, center.lng, 3500, signal).catch(() => [] as PlaceData[])
        )
      );
      groups.push(...batch);
    }
    return mergePlaces(groups);
  }
}

export async function downloadPlacesForArea(args: {
  areaId: string;
  bounds: GeoBounds;
  polygon?: Array<[number, number]>;
  signal?: AbortSignal;
}): Promise<number> {
  const polygon = args.polygon && args.polygon.length >= 3 ? args.polygon : polygonFromBounds(args.bounds);
  const queryBounds = padBounds(rawBoundsFromPolygon(polygon) || args.bounds, PLACES_BUFFER_M);
  const fetched = await fetchPlacesCoveringBounds(queryBounds, args.signal);
  const places = fetched.filter((place) => isWithinPolygonBuffer(place, polygon, PLACES_BUFFER_M));
  await saveOfflinePlaces({
    areaId: args.areaId,
    places,
    updatedAt: Date.now(),
  });
  return places.length;
}

export async function getCachedPlacesAround(
  lat: number,
  lng: number,
  radiusM: number
): Promise<PlaceData[]> {
  const bundles = await getAllOfflinePlaces();
  const merged = mergePlaces(bundles.map((bundle) => bundle.places as PlaceData[]));
  return nearestWithinRadius(merged, { lat, lng }, radiusM, 50);
}
