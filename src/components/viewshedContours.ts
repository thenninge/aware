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

// Merge many grid-aligned quads into fewer closed rings by removing shared edges.
export function unifyQuadsToRings(
  quads: google.maps.LatLngLiteral[][],
  simplifyToleranceMeters = 3
): google.maps.LatLngLiteral[][] {
  if (!quads || quads.length === 0) return [];
  const fmt = (p: google.maps.LatLngLiteral) => `${p.lat.toFixed(7)},${p.lng.toFixed(7)}`;
  const edgeKey = (a: google.maps.LatLngLiteral, b: google.maps.LatLngLiteral) => {
    const ka = fmt(a), kb = fmt(b);
    return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
  };
  type Edge = { a: google.maps.LatLngLiteral; b: google.maps.LatLngLiteral };
  const edgeCount = new Map<string, number>();
  const edgeDir = new Map<string, Edge>(); // store one representative orientation

  for (const q of quads) {
    if (!q || q.length < 4) continue;
    const pts = [q[0], q[1], q[2], q[3]];
    const edges: Edge[] = [
      { a: pts[0], b: pts[1] },
      { a: pts[1], b: pts[2] },
      { a: pts[2], b: pts[3] },
      { a: pts[3], b: pts[0] },
    ];
    for (const e of edges) {
      const k = edgeKey(e.a, e.b);
      edgeCount.set(k, (edgeCount.get(k) || 0) + 1);
      if (!edgeDir.has(k)) edgeDir.set(k, e);
    }
  }

  // Keep only boundary edges (count === 1)
  const boundaryEdges: Edge[] = [];
  for (const [k, cnt] of edgeCount.entries()) {
    if (cnt === 1) {
      const e = edgeDir.get(k)!;
      boundaryEdges.push(e);
    }
  }
  if (boundaryEdges.length === 0) return [];

  // Build adjacency graph
  const toKey = fmt;
  const neighbors = new Map<string, Array<google.maps.LatLngLiteral>>();
  for (const e of boundaryEdges) {
    const ka = toKey(e.a);
    const kb = toKey(e.b);
    if (!neighbors.has(ka)) neighbors.set(ka, []);
    if (!neighbors.has(kb)) neighbors.set(kb, []);
    neighbors.get(ka)!.push(e.b);
    neighbors.get(kb)!.push(e.a);
  }

  // Walk rings
  const visitedEdge = new Set<string>();
  const rings: google.maps.LatLngLiteral[][] = [];

  const dirEdgeKey = (a: google.maps.LatLngLiteral, b: google.maps.LatLngLiteral) =>
    `${toKey(a)}->${toKey(b)}`;

  for (const e of boundaryEdges) {
    const startKey = dirEdgeKey(e.a, e.b);
    if (visitedEdge.has(startKey)) continue;
    // Start a ring following e.a -> e.b
    const ring: google.maps.LatLngLiteral[] = [];
    let prev = e.a;
    let cur = e.b;
    ring.push(prev);
    ring.push(cur);
    visitedEdge.add(startKey);

    while (true) {
      const curNei = neighbors.get(toKey(cur)) || [];
      // choose next neighbor not equal to prev
      let next: google.maps.LatLngLiteral | null = null;
      for (const n of curNei) {
        if (toKey(n) !== toKey(prev)) {
          const k = dirEdgeKey(cur, n);
          if (!visitedEdge.has(k)) {
            next = n;
            visitedEdge.add(k);
            break;
          }
        }
      }
      if (!next) {
        // Closed when next back to start
        if (toKey(cur) !== toKey(ring[0])) {
          // Try to close explicitly
          ring.push({ ...ring[0] });
        }
        break;
      }
      if (toKey(next) === toKey(ring[0])) {
        // Complete
        ring.push(next);
        break;
      }
      ring.push(next);
      prev = cur;
      cur = next;
      // safety
      if (ring.length > boundaryEdges.length + 5) break;
    }
    if (ring.length >= 4) {
      rings.push(simplifyPathLatLng(ring, simplifyToleranceMeters));
    }
  }
  return rings;
}


