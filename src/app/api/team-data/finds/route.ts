import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db/supabaseAdmin';
import { HttpError, jsonError, requireTeamAccess } from '@/lib/db/access';
import { mapRows, matchingSearchRowIds, parseCoord, rowToFind, stringifyJson } from '@/lib/db/searchData';

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
      .is('deleted_at', null)
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
        // Kolonnene må stemme med tabellen: id, teamid, name, color, createdby,
        // created_at, local_id, position (JSON-tekst), shot_pair_id
        teamid: teamId,
        createdby: userId,
        name: body.name || 'Funn',
        local_id: localId,
        position: stringifyJson(position),
        color: body.color || '#EF4444',
        shot_pair_id: body.shotPairId || null,
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

    const supabase = getSupabaseAdmin();
    const { data: rows, error: listError } = await supabase
      .from('finds')
      .select('id, local_id')
      .eq('teamid', teamId)
      .is('deleted_at', null);
    if (listError) throw new Error(listError.message);
    const ids = matchingSearchRowIds(rows, { localId, id }, 'find');
    if (ids.length > 0) {
      // Myk sletting: raden får et slettemerke, så de andre på laget får vite om det
      const { error } = await supabase
        .from('finds')
        .update({ deleted_at: new Date().toISOString() })
        .in('id', ids)
        .eq('teamid', teamId);
      if (error) throw new Error(error.message);
    }
    return NextResponse.json({ success: true, deleted: ids });
  } catch (error) {
    return jsonError(error);
  }
}
