import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db/supabaseAdmin';
import { HttpError, jsonError, requireTeamAccess } from '@/lib/db/access';
import { finiteCoord, mapRows, parseCoord, rowToObservation } from '@/lib/db/searchData';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const teamId = request.nextUrl.searchParams.get('teamId');
    if (!teamId) throw new HttpError(400, 'Team ID is required');
    await requireTeamAccess(teamId);

    const { data, error } = await getSupabaseAdmin()
      .from('observations')
      .select('*')
      .eq('teamid', teamId)
      .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);

    return NextResponse.json(mapRows(data, rowToObservation));
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const teamId = body.teamId as string | undefined;
    const localId = String(body.localId || `observation_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`);
    const position = parseCoord(body.position) || finiteCoord(Number(body.lat), Number(body.lng));
    if (!teamId) throw new HttpError(400, 'Team ID is required');
    if (!position) throw new HttpError(400, 'Position (lat, lng) is required');
    const { userId } = await requireTeamAccess(teamId);

    const supabase = getSupabaseAdmin();
    const { data: existing, error: existingError } = await supabase
      .from('observations')
      .select('id')
      .eq('teamid', teamId)
      .eq('local_id', localId)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (existing) {
      const { data, error } = await supabase.from('observations').select('*').eq('id', existing.id).single();
      if (error) throw new Error(error.message);
      return NextResponse.json(rowToObservation(data as Record<string, unknown>));
    }

    const { data, error } = await supabase
      .from('observations')
      .insert({
        teamid: teamId,
        createdby: userId,
        name: body.name || 'Observasjon',
        lat: position.lat,
        lng: position.lng,
        description: body.description || '',
        color: body.color || '#F59E0B',
        category: body.category || 'observation',
        local_id: localId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json(rowToObservation(data as Record<string, unknown>));
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

    let query = getSupabaseAdmin().from('observations').delete().eq('teamid', teamId);
    if (localId) query = query.eq('local_id', localId);
    else query = query.eq('id', id);
    const { error } = await query;
    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonError(error);
  }
}
