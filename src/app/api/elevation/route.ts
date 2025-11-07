import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const path = searchParams.get('path');
    const samples = searchParams.get('samples') || '64';
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!key) {
      return NextResponse.json({ status: 'NO_API_KEY' }, { status: 500 });
    }
    if (!path) {
      return NextResponse.json({ status: 'MISSING_PATH' }, { status: 400 });
    }

    const url = new URL('https://maps.googleapis.com/maps/api/elevation/json');
    url.searchParams.set('path', path);
    url.searchParams.set('samples', samples);
    url.searchParams.set('key', key);

    const res = await fetch(url.toString());
    const data = await res.json();
    return NextResponse.json(data, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ status: 'ERROR', message: e?.message || 'UNKNOWN' }, { status: 500 });
  }
}


