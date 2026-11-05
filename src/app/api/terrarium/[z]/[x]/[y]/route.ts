import { NextResponse } from 'next/server';
import { terrariumTileUrl } from '@/lib/terrain/decode';

export const runtime = 'nodejs';

function parseTile(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  return Number(value);
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ z: string; x: string; y: string }> }
) {
  const { z: zRaw, x: xRaw, y: yRaw } = await params;
  const z = parseTile(zRaw);
  const x = parseTile(xRaw);
  const y = parseTile(yRaw);

  if (z === null || x === null || y === null || z < 0 || z > 15) {
    return NextResponse.json({ error: 'Invalid tile coordinate' }, { status: 400 });
  }

  const max = 2 ** z;
  if (x >= max || y >= max) {
    return NextResponse.json({ error: 'Tile out of range' }, { status: 400 });
  }

  const upstream = await fetch(terrariumTileUrl(z, x, y), {
    headers: { 'User-Agent': 'Aware TerrainEngine/1.5' },
  });

  if (!upstream.ok) {
    return NextResponse.json(
      { error: `Terrarium upstream ${upstream.status}` },
      { status: upstream.status === 404 ? 404 : 502 }
    );
  }

  const body = await upstream.arrayBuffer();
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400, immutable',
    },
  });
}
