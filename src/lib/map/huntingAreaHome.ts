export type HomePosition = { lat: number; lng: number };

type AreaLike = {
  id: string;
  coordinates: [number, number][];
};

const STORE_KEY = 'aware_home_positions_v1';
const LEGACY_KEY = 'aware_default_position';

function isValidHome(pos: unknown): pos is HomePosition {
  if (!pos || typeof pos !== 'object') return false;
  const p = pos as HomePosition;
  return Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;
}

function readStore(): Record<string, HomePosition> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Record<string, HomePosition> = {};
    for (const [id, value] of Object.entries(parsed)) {
      if (isValidHome(value)) out[id] = { lat: value.lat, lng: value.lng };
    }
    return out;
  } catch {
    return {};
  }
}

function writeStore(store: Record<string, HomePosition>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
}

export function centroidOfArea(area: AreaLike): HomePosition | null {
  const pts = area.coordinates.filter(
    (p): p is [number, number] => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1])
  );
  if (pts.length === 0) return null;
  const ring =
    pts.length > 1 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]
      ? pts.slice(0, -1)
      : pts;
  const lat = ring.reduce((sum, p) => sum + p[0], 0) / ring.length;
  const lng = ring.reduce((sum, p) => sum + p[1], 0) / ring.length;
  return isValidHome({ lat, lng }) ? { lat, lng } : null;
}

export function readHomeForArea(areaId: string | null | undefined): HomePosition | null {
  if (!areaId) return null;
  const stored = readStore()[String(areaId)];
  if (stored) return stored;
  return null;
}

export function writeHomeForArea(areaId: string, pos: HomePosition) {
  if (!areaId || !isValidHome(pos)) return;
  const store = readStore();
  store[String(areaId)] = { lat: pos.lat, lng: pos.lng };
  writeStore(store);
}

/** Home for a field: saved point, else polygon centroid. */
export function homeForHuntingArea(area: AreaLike | undefined | null): HomePosition | null {
  if (!area) return null;
  return readHomeForArea(area.id) ?? centroidOfArea(area);
}

export function readLegacyGlobalHome(): HomePosition | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const pos = JSON.parse(raw);
    return isValidHome(pos) ? { lat: pos.lat, lng: pos.lng } : null;
  } catch {
    return null;
  }
}
