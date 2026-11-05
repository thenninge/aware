/**
 * Local terrain tests. Fetches AWS Terrarium tiles only — never Google.
 * Run: npm run test:terrain
 */
import zlib from 'node:zlib';

const TERRARIUM = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
const GOOGLE_HOSTS = ['googleapis.com', 'maps.googleapis.com', 'maps.google.com'];

function decodeTerrainRGB(r, g, b) {
  return r * 256 + g + b / 256 - 32768;
}

function coordToTile(lat, lng, zoom) {
  const n = 2 ** zoom;
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );
  return { z: zoom, x, y };
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function decodePng(buf) {
  if (buf[0] !== 0x89 || buf.toString('ascii', 1, 4) !== 'PNG') {
    throw new Error('Not a PNG');
  }
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const idat = [];
  while (offset + 8 <= buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    const data = buf.subarray(offset + 8, offset + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data[9];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + len;
  }
  const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
  if (!bpp) throw new Error(`Unsupported PNG color type ${colorType}`);
  const inflated = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * bpp;
  const out = Buffer.alloc(height * stride);
  let src = 0;
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = inflated[src++];
    const row = inflated.subarray(src, src + stride);
    src += stride;
    const dest = Buffer.alloc(stride);
    for (let i = 0; i < stride; i++) {
      const raw = row[i];
      const a = i >= bpp ? dest[i - bpp] : 0;
      const b = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      let val = raw;
      if (filter === 1) val = (raw + a) & 255;
      else if (filter === 2) val = (raw + b) & 255;
      else if (filter === 3) val = (raw + Math.floor((a + b) / 2)) & 255;
      else if (filter === 4) val = (raw + paeth(a, b, c)) & 255;
      dest[i] = val;
    }
    dest.copy(out, y * stride);
    prev = dest;
  }
  return { width, height, bpp, data: out };
}

function pixelRgb(png, x, y) {
  const i = (y * png.width + x) * png.bpp;
  return { r: png.data[i], g: png.data[i + 1], b: png.data[i + 2] };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  console.log('v1.5 terrain tests (no Google Elevation)\n');

  assert(Math.abs(decodeTerrainRGB(128, 0, 0) - 0) < 0.01, 'sea-level terrarium');
  assert(Math.abs(decodeTerrainRGB(129, 44, 0) - (256 + 44)) < 0.01, 'positive elevation');
  console.log('✓ Terrarium decode formula');

  const point = { lat: 60.424834440433045, lng: 12.408766398367092 };
  const tile = coordToTile(point.lat, point.lng, 13);
  assert(tile.z === 13 && Number.isInteger(tile.x) && Number.isInteger(tile.y), 'tile ints');
  console.log(`✓ Web Mercator tile z13 → ${tile.z}/${tile.x}/${tile.y}`);

  const url = TERRARIUM.replace('{z}', String(tile.z))
    .replace('{x}', String(tile.x))
    .replace('{y}', String(tile.y));
  assert(!GOOGLE_HOSTS.some((h) => url.includes(h)), 'must not call Google');
  assert(url.includes('elevation-tiles-prod'), 'AWS terrarium host');

  const res = await fetch(url);
  assert(res.ok, `Terrarium HTTP ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const png = decodePng(buf);
  assert(png.width === 256 && png.height === 256, `tile size ${png.width}x${png.height}`);

  const n = 2 ** 13;
  const px = Math.floor((((point.lng + 180) / 360) * n - tile.x) * 256);
  const latRad = (point.lat * Math.PI) / 180;
  const py = Math.floor(
    (((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n - tile.y) *
      256
  );
  const rgb = pixelRgb(png, px, py);
  const elevation = decodeTerrainRGB(rgb.r, rgb.g, rgb.b);
  assert(elevation > 50 && elevation < 800, `unexpected elevation ${elevation}m at test point`);
  console.log(`✓ AWS Terrarium tile decoded: ${elevation.toFixed(1)} m at ${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}`);

  const EARTH = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;
  function haversine(a, b) {
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * EARTH * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  function dest(origin, bearingDeg, distanceM) {
    const brng = toRad(bearingDeg);
    const lat1 = toRad(origin.lat);
    const lng1 = toRad(origin.lng);
    const d = distanceM / EARTH;
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng));
    const lng2 =
      lng1 +
      Math.atan2(
        Math.sin(brng) * Math.sin(d) * Math.cos(lat1),
        Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
      );
    return { lat: toDeg(lat2), lng: toDeg(lng2) };
  }
  const north100 = dest(point, 0, 100);
  const d100 = haversine(point, north100);
  assert(Math.abs(d100 - 100) < 0.5, `100m destination was ${d100}m`);
  console.log('✓ Destination / haversine (100 m north)');

  // LOS: a hill in the middle should stop visibility before the end
  function visibleIndex(elevations, spacingM, hObs, hTgt) {
    const h0 = elevations[0] + hObs;
    let maxSlope = -Infinity;
    let vis = 0;
    let acc = 0;
    for (let i = 1; i < elevations.length; i++) {
      acc += spacingM;
      const slope = (elevations[i] + hTgt - h0) / acc;
      if (slope > maxSlope) {
        maxSlope = slope;
        vis = i;
      }
    }
    return vis;
  }
  const hill = [100, 100, 160, 100, 100];
  const vis = visibleIndex(hill, 50, 2, 0);
  assert(vis === 2, `expected LOS to stop on hill (idx 2), got ${vis}`);
  console.log('✓ LOS mask stops on intervening hill');

  if (process.env.TEST_LOCAL_API === '1') {
    const gone = await fetch('http://localhost:3000/api/elevation?path=60,12|61,12&samples=8');
    const goneJson = await gone.json();
    assert(gone.status === 410 && goneJson.status === 'GONE', 'local Google elevation must stay disabled');
    const proxy = await fetch('http://localhost:3000/api/terrarium/13/4378/2359');
    assert(proxy.ok && proxy.headers.get('content-type')?.includes('png'), 'local terrarium proxy');
    console.log('✓ Local API: Terrarium proxy up, Google Elevation gone');
  }

  console.log('\nAll terrain tests passed. No Google Elevation calls.');
}

main().catch((err) => {
  console.error('FAIL:', err.message);
  process.exit(1);
});
