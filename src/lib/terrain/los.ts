import { Coordinate, destination, distance, interpolatePath } from '../geo/coordinates';
import { TerrainEngine } from './TerrainEngine';

export type LatLng = Coordinate;

export type RayProfile = {
  locations: LatLng[];
  visible: boolean[];
};

export type ViewshedData = {
  origin: LatLng;
  endpoints: LatLng[];
  path: LatLng[];
  quads?: LatLng[][];
  holes?: LatLng[][];
  profiles?: RayProfile[];
};

export type ViewshedParams = {
  radiusM?: number;
  rays?: number;
  samples?: number;
  observerHeightM?: number;
  targetHeightM?: number;
};

function losMaskAlongRay(
  profile: Array<{ location: LatLng; elevation: number }>,
  observerHeightM: number,
  targetHeightM: number
) {
  const n = profile.length;
  const visible = new Array<boolean>(n).fill(false);
  if (n === 0) return { visible, visibleIndex: 0 };
  const h0 = profile[0].elevation + observerHeightM;
  let maxSlope = -Infinity;
  let prev = profile[0].location;
  let acc = 0;
  const eps = 1e-4;
  visible[0] = true;
  let vis = 0;
  for (let i = 1; i < n; i++) {
    const cur = profile[i].location;
    acc += distance(prev, cur);
    const slope = (profile[i].elevation + targetHeightM - h0) / Math.max(acc, 1e-6);
    if (slope > maxSlope + eps) {
      maxSlope = slope;
      visible[i] = true;
      vis = i;
    }
    prev = cur;
  }
  return { visible, visibleIndex: vis };
}

function buildQuads(profiles: RayProfile[], blocked: boolean) {
  const rays = profiles.length;
  const quads: LatLng[][] = [];
  for (let j = 0; j < rays; j++) {
    const A = profiles[j];
    const B = profiles[(j + 1) % rays];
    if (!A || !B) continue;
    const n = Math.min(A.visible.length, B.visible.length);
    for (let k = 0; k < n - 1; k++) {
      const cells = [A.visible[k], A.visible[k + 1], B.visible[k], B.visible[k + 1]];
      const allVisible = cells.every(Boolean);
      const allBlocked = cells.every((v) => !v);
      if ((blocked && allBlocked) || (!blocked && allVisible)) {
        quads.push([
          A.locations[k],
          A.locations[k + 1],
          B.locations[k + 1],
          B.locations[k],
        ]);
      }
    }
  }
  return quads;
}

export async function calculateViewshed(
  engine: TerrainEngine,
  origin: Coordinate,
  params: ViewshedParams
): Promise<ViewshedData> {
  const radiusM = params.radiusM ?? 350;
  const rays = params.rays ?? 180;
  const samples = params.samples ?? 64;
  const observerHeightM = params.observerHeightM ?? 5;
  const targetHeightM = params.targetHeightM ?? 0;

  const rayPaths: LatLng[][] = [];
  const allPoints: LatLng[] = [];
  for (let i = 0; i < rays; i++) {
    const end = destination(origin, (i * 360) / rays, radiusM);
    const path = interpolatePath([origin, end], samples);
    rayPaths.push(path);
    allPoints.push(...path);
  }

  const elevations = await engine.getElevations(allPoints);
  const coverage = engine.coverage(elevations);
  if (coverage < 0.5) {
    throw new Error(
      'DEM_UNAVAILABLE: mangler Terrarium-høydedata for dette området. Last ned offline-område, eller sjekk nett.'
    );
  }

  const endpoints: LatLng[] = new Array(rays);
  const profiles: RayProfile[] = new Array(rays);

  for (let i = 0; i < rays; i++) {
    const path = rayPaths[i];
    const offset = i * samples;
    const profile = path.map((location, k) => ({
      location,
      elevation: elevations[offset + k] ?? 0,
    }));
    const mask = losMaskAlongRay(profile, observerHeightM, targetHeightM);
    endpoints[i] = profile[mask.visibleIndex].location;
    profiles[i] = {
      locations: path,
      visible: mask.visible,
    };
  }

  return {
    origin,
    endpoints,
    path: [...endpoints, endpoints[0]],
    quads: buildQuads(profiles, false),
    holes: buildQuads(profiles, true),
    profiles,
  };
}
