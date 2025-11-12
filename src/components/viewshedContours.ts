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

  // Local projection and snapping for robust node matching
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const ref = quads[0][0];
  const lat0 = toRad(ref.lat);
  const lon0 = toRad(ref.lng);
  const cosLat0 = Math.cos(lat0);
  const toXY = (p: google.maps.LatLngLiteral) => ({
    x: R * (toRad(p.lng) - lon0) * cosLat0,
    y: R * (toRad(p.lat) - lat0),
  });
  const toLL = (x: number, y: number): google.maps.LatLngLiteral => ({
    lat: (y / R) * 180 / Math.PI + (lat0 * 180) / Math.PI,
    lng: ((x / (R * cosLat0)) * 180) / Math.PI + (lon0 * 180) / Math.PI,
  });
  const snap = (v: number, grid = 0.2) => Math.round(v / grid) * grid; // 20 cm grid
  const keyXY = (x: number, y: number) => `${x.toFixed(2)},${y.toFixed(2)}`;

  type Node = { x: number; y: number; count: number };
  const nodeMap = new Map<string, Node>();
  const nodeKeyForLL = (p: google.maps.LatLngLiteral) => {
    const xy = toXY(p);
    const xs = snap(xy.x);
    const ys = snap(xy.y);
    const k = keyXY(xs, ys);
    let n = nodeMap.get(k);
    if (!n) {
      n = { x: xs, y: ys, count: 0 };
      nodeMap.set(k, n);
    }
    n.count++;
    return k;
  };

  type Edge = { a: string; b: string };
  const undirectedKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const edgeCount = new Map<string, number>();
  const edgeDir = new Map<string, Edge>();

  for (const q of quads) {
    if (!q || q.length < 4) continue;
    const n0 = nodeKeyForLL(q[0]);
    const n1 = nodeKeyForLL(q[1]);
    const n2 = nodeKeyForLL(q[2]);
    const n3 = nodeKeyForLL(q[3]);
    const edges: Edge[] = [
      { a: n0, b: n1 },
      { a: n1, b: n2 },
      { a: n2, b: n3 },
      { a: n3, b: n0 },
    ];
    for (const e of edges) {
      const k = undirectedKey(e.a, e.b);
      edgeCount.set(k, (edgeCount.get(k) || 0) + 1);
      if (!edgeDir.has(k)) edgeDir.set(k, e);
    }
  }

  // Keep boundary edges
  const boundary: Edge[] = [];
  for (const [k, c] of edgeCount.entries()) {
    if (c === 1) boundary.push(edgeDir.get(k)!);
  }
  if (boundary.length === 0) return [];

  // Build neighbor lists
  const neighbors = new Map<string, string[]>();
  for (const e of boundary) {
    if (!neighbors.has(e.a)) neighbors.set(e.a, []);
    if (!neighbors.has(e.b)) neighbors.set(e.b, []);
    neighbors.get(e.a)!.push(e.b);
    neighbors.get(e.b)!.push(e.a);
  }

  // Convert node key -> average lat/lng (from snapped xy)
  const nodeLL = new Map<string, google.maps.LatLngLiteral>();
  for (const [k, n] of nodeMap.entries()) {
    nodeLL.set(k, toLL(n.x, n.y));
  }

  // Utilities for angle-based traversal
  const vec = (fromK: string, toK: string) => {
    const a = nodeMap.get(fromK)!;
    const b = nodeMap.get(toK)!;
    return { x: b.x - a.x, y: b.y - a.y };
  };
  const angle = (vx: number, vy: number) => Math.atan2(vy, vx);
  const normAngle = (a: number) => {
    while (a <= -Math.PI) a += 2 * Math.PI;
    while (a > Math.PI) a -= 2 * Math.PI;
    return a;
  };

  // Walk rings with right-hand rule (choose smallest clockwise turn)
  const visited = new Set<string>(); // directed edges
  const rings: google.maps.LatLngLiteral[][] = [];

  const dirKey = (a: string, b: string) => `${a}->${b}`;

  for (const e of boundary) {
    if (visited.has(dirKey(e.a, e.b))) continue;
    let startA = e.a;
    let startB = e.b;
    const out: google.maps.LatLngLiteral[] = [];
    out.push(nodeLL.get(startA)!);
    out.push(nodeLL.get(startB)!);
    visited.add(dirKey(startA, startB));

    let prev = startA;
    let cur = startB;
    while (true) {
      const nbrs = (neighbors.get(cur) || []).filter(n => n !== prev);
      if (nbrs.length === 0) break;
      let next = nbrs[0];
      if (nbrs.length > 1) {
        // choose neighbor that yields smallest clockwise turn
        const base = vec(prev, cur);
        const baseAng = angle(base.x, base.y);
        let bestDelta = Infinity;
        for (const cand of nbrs) {
          const v = vec(cur, cand);
          const a = angle(v.x, v.y);
          let d = normAngle(a - baseAng);
          // prefer right turn: map [-pi, pi] -> [0, 2pi) clockwise
          if (d > 0) d = d - 2 * Math.PI;
          if (d < bestDelta) {
            bestDelta = d;
            next = cand;
          }
        }
      }
      if (next === startA) {
        out.push(nodeLL.get(next)!);
        break;
      }
      out.push(nodeLL.get(next)!);
      visited.add(dirKey(cur, next));
      prev = cur;
      cur = next;
      if (out.length > boundary.length + 5) break; // safety
    }
    if (out.length >= 4) {
      rings.push(simplifyPathLatLng(out, simplifyToleranceMeters));
    }
  }

  return rings;
}




