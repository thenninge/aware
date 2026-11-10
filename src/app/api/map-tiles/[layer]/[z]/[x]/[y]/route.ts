import { NextResponse } from 'next/server';
import { isOfflineMapLayer, OFFLINE_LAYER_URLS } from '@/lib/map/offlineLayers';

export const runtime = 'nodejs';

function parseTile(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  return Number(value);
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ layer: string; z: string; x: string; y: string }> }
) {
  const { layer, z: zRaw, x: xRaw, y: yRaw } = await params;
  if (!isOfflineMapLayer(layer)) {
    return NextResponse.json({ error: 'Unsupported map layer' }, { status: 400 });
  }

  const z = parseTile(zRaw);
  const x = parseTile(xRaw);
  const y = parseTile(yRaw);
  if (z === null || x === null || y === null || z < 0 || z > 18) {
    return NextResponse.json({ error: 'Invalid tile coordinate' }, { status: 400 });
  }

  const max = 2 ** z;
  if (x >= max || y >= max) {
    return NextResponse.json({ error: 'Tile out of range' }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(OFFLINE_LAYER_URLS[layer](z, x, y), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Aware/1.5; +https://cbaware.vercel.app)',
        Referer: 'https://cbaware.vercel.app/',
      },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return NextResponse.json({ error: 'Upstream timeout' }, { status: 504 });
  }
  if (!upstream.ok) {
    return NextResponse.json(
      { error: `Upstream ${upstream.status}` },
      { status: upstream.status === 404 ? 404 : 502 }
    );
  }

  const body = await upstream.arrayBuffer();
  const contentType = upstream.headers.get('content-type') || 'image/png';
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400, immutable',
    },
  });
}
