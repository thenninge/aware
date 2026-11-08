import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db/supabaseAdmin';
import { HttpError, jsonError, requireTeamAccess } from '@/lib/db/access';
import { mapRows, rowToTrack, serializeTrackPoints, type Coord } from '@/lib/db/searchData';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const teamId = request.nextUrl.searchParams.get('teamId');
    if (!teamId) throw new HttpError(400, 'Team ID is required');
    await requireTeamAccess(teamId);

    const { data, error } = await getSupabaseAdmin()
      .from('tracks')
      .select('*')
      .eq('teamid', teamId)
      .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);

    return NextResponse.json(mapRows(data, rowToTrack));
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const teamId = body.teamId as string | undefined;
    const localId = String(body.localId || '').trim();
    if (!teamId) throw new HttpError(400, 'Team ID is required');
    if (!localId) throw new HttpError(400, 'localId is required');
    const { userId } = await requireTeamAccess(teamId);

    const saved = await upsertTrack({
      teamId,
      userId,
      localId,
      name: body.name,
      color: body.color,
      points: body.points,
      shotPairId: body.shotPairId,
    });
    return NextResponse.json(saved);
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const teamId = body.teamId as string | undefined;
    const localId = String(body.localId || '').trim();
    if (!teamId) throw new HttpError(400, 'Team ID is required');
    if (!localId) throw new HttpError(400, 'localId is required');
    const { userId } = await requireTeamAccess(teamId);

    const saved = await upsertTrack({
      teamId,
      userId,
      localId,
      name: body.name,
      color: body.color,
      points: body.points,
      shotPairId: body.shotPairId,
    });
    return NextResponse.json(saved);
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const teamId = body.teamId as string | undefined;
    const localId = body.localId as string | undefined;
    const id = body.id as string | number | undefined;
    if (!teamId || (!localId && id == null)) throw new HttpError(400, 'teamId and (localId or id) required');
    await requireTeamAccess(teamId);

    let query = getSupabaseAdmin().from('tracks').delete().eq('teamid', teamId);
    if (localId) query = query.eq('local_id', localId);
    else query = query.eq('id', id);
    const { error } = await query;
    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonError(error);
  }
}

async function upsertTrack(input: {
  teamId: string;
  userId: string;
  localId: string;
  name?: string;
  color?: string;
  points?: Coord[];
  shotPairId?: string;
}) {
  const supabase = getSupabaseAdmin();
  const { data: existing, error: existingError } = await supabase
    .from('tracks')
    .select('*')
    .eq('teamid', input.teamId)
    .eq('local_id', input.localId)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);

  const payload: Record<string, unknown> = {
    name: input.name || existing?.name || 'Spor',
    color: input.color || existing?.color || '#EAB308',
    points: serializeTrackPoints(Array.isArray(input.points) ? input.points : []),
    shot_pair_id: input.shotPairId || existing?.shot_pair_id || null,
  };

  if (existing?.id) {
    if (!Array.isArray(input.points)) payload.points = existing.points;
    const { data, error } = await supabase.from('tracks').update(payload).eq('id', existing.id).select().single();
    if (error) throw new Error(error.message);
    return rowToTrack(data as Record<string, unknown>);
  }

  const { data, error } = await supabase
    .from('tracks')
    .insert({
      ...payload,
      teamid: input.teamId,
      createdby: input.userId,
      local_id: input.localId,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToTrack(data as Record<string, unknown>);
}
