// Lightweight contour utilities for viewshed rendering
// Exposes:
// - extractContours(mask, wrapRays): Array of contours as [{r,s}] index rings
// - contoursToLatLng(contours, profiles): Map index rings to LatLng paths
// - simplifyPathLatLng(path, toleranceMeters): Douglas–Peucker simplification in meters

export type GridIndex = { r: number; s: number };

// Extract outer (and optionally inner) contours from a polar grid mask.
// For performance and simplicity we currently return only the outermost visible ring:
// the furthest visible sample per ray, wrapped in ray direction.
export function extractContours(mask: boolean[][], wrapRays: boolean): Array<Array<GridIndex>> {
  const rays = mask.length;
  if (rays === 0) return [];
  const samples = mask[0]?.length ?? 0;
  if (samples === 0) return [];

  // Outer ring: last visible sample index per ray (fallback to 0)
  const outer: Array<GridIndex> = [];
  for (let r = 0; r < rays; r++) {
    const row = mask[r] || [];
    let sMax = 0;
    for (let s = samples - 1; s >= 0; s--) {
      if (row[s]) {
        sMax = s;
        break;
      }
    }
    outer.push({ r, s: sMax });
  }

  // Ensure wrap continuity if requested (no-op for index ring; wrap is handled by mapping to LatLng)
  const contours: Array<Array<GridIndex>> = [outer];
  return contours;
}

export function contoursToLatLng(
  contours: Array<Array<GridIndex>>,
  profiles: Array<{ locations: google.maps.LatLngLiteral[]; visible: boolean[] }>
): google.maps.LatLngLiteral[][] {
  const out: google.maps.LatLngLiteral[][] = [];
  for (const ring of contours) {
    const path: google.maps.LatLngLiteral[] = [];
    for (const { r, s } of ring) {
      const locs = profiles[r]?.locations;
      if (!locs || !locs.length) continue;
      const idx = Math.max(0, Math.min(locs.length - 1, s));
      path.push(locs[idx]);
    }
    if (path.length > 1) {
      // close the ring
      const first = path[0];
      const last = path[path.length - 1];
      if (first.lat !== last.lat || first.lng !== last.lng) {
        path.push({ ...first });
      }
      out.push(path);
    }
  }
  return out;
}

// Douglas–Peucker simplification in meters using a local equirectangular projection
export function simplifyPathLatLng(
  path: google.maps.LatLngLiteral[],
  toleranceMeters: number
): google.maps.LatLngLiteral[] {
  if (!path || path.length <= 2) return path?.slice() ?? [];
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const lat0 = toRad(path[0].lat);
  const lon0 = toRad(path[0].lng);
  const cosLat0 = Math.cos(lat0);
  const toXY = (p: google.maps.LatLngLiteral) => {
    const x = R * (toRad(p.lng) - lon0) * cosLat0;
    const y = R * (toRad(p.lat) - lat0);
    return { x, y };
  };
  const pts = path.map(toXY);

  const sqTol = toleranceMeters * toleranceMeters;
  const keep = new Array<boolean>(pts.length).fill(false);
  keep[0] = true;
  keep[pts.length - 1] = true;

  function sqSegDist(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) {
    let x = a.x;
    let y = a.y;
    let dx = b.x - x;
    let dy = b.y - y;
    if (dx !== 0 || dy !== 0) {
      const t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);
      if (t > 1) {
        x = b.x;
        y = b.y;
      } else if (t > 0) {
        x += dx * t;
        y += dy * t;
      }
    }
    dx = p.x - x;
    dy = p.y - y;
    return dx * dx + dy * dy;
  }

  function simplifyDP(first: number, last: number) {
    if (last <= first + 1) return;
    let maxSq = -1;
    let idx = -1;
    for (let i = first + 1; i < last; i++) {
      const d = sqSegDist(pts[i], pts[first], pts[last]);
      if (d > maxSq) {
        maxSq = d;
        idx = i;
      }
    }
    if (maxSq > sqTol && idx > first && idx < last) {
      keep[idx] = true;
      simplifyDP(first, idx);
      simplifyDP(idx, last);
    }
  }

  simplifyDP(0, pts.length - 1);
  const out: google.maps.LatLngLiteral[] = [];
  for (let i = 0; i < path.length; i++) {
    if (keep[i]) out.push(path[i]);
  }
  // Keep ring closure if original was closed
  if (out.length >= 3) {
    const f = out[0], l = out[out.length - 1];
    if (f.lat !== l.lat || f.lng !== l.lng) {
      out.push({ ...f });
    }
  }
  return out;
}


