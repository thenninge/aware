import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db/supabaseAdmin';
import { HttpError, jsonError, requireTeamAccess } from '@/lib/db/access';
import { mapRows, parseCoord, rowToFind } from '@/lib/db/searchData';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const teamId = request.nextUrl.searchParams.get('teamId');
    if (!teamId) throw new HttpError(400, 'Team ID is required');
    await requireTeamAccess(teamId);

    const { data, error } = await getSupabaseAdmin()
      .from('finds')
      .select('*')
      .eq('teamid', teamId)
      .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);

    return NextResponse.json(mapRows(data, rowToFind));
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const teamId = body.teamId as string | undefined;
    const localId = String(body.localId || `find_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`);
    const position = parseCoord(body.position);
    if (!teamId) throw new HttpError(400, 'Team ID is required');
    if (!position) throw new HttpError(400, 'Position (lat, lng) is required');
    const { userId } = await requireTeamAccess(teamId);

    const supabase = getSupabaseAdmin();
    const { data: existing, error: existingError } = await supabase
      .from('finds')
      .select('id')
      .eq('teamid', teamId)
      .eq('local_id', localId)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (existing) {
      const { data, error } = await supabase.from('finds').select('*').eq('id', existing.id).single();
      if (error) throw new Error(error.message);
      return NextResponse.json(rowToFind(data as Record<string, unknown>));
    }

    const { data, error } = await supabase
      .from('finds')
      .insert({
        teamid: teamId,
        createdby: userId,
        name: body.name || 'Funn',
        local_id: localId,
        position,
        color: body.color || '#EF4444',
        shotpairid: body.shotPairId || null,
        mode: body.mode || 'søk',
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json(rowToFind(data as Record<string, unknown>));
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

    let query = getSupabaseAdmin().from('finds').delete().eq('teamid', teamId);
    if (localId) query = query.eq('local_id', localId);
    else query = query.eq('id', id);
    const { error } = await query;
    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonError(error);
  }
}
