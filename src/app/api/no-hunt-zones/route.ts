import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db/supabaseAdmin';
import { HttpError, jsonError, requireTeamAccess } from '@/lib/db/access';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const teamId = request.nextUrl.searchParams.get('teamId');
    const huntingAreaId = request.nextUrl.searchParams.get('huntingAreaId');
    if (!teamId) throw new HttpError(400, 'Team ID is required');
    await requireTeamAccess(teamId);

    let query = getSupabaseAdmin().from('no_hunt_zones').select('*').eq('teamid', teamId);
    if (huntingAreaId) query = query.eq('hunting_area_id', huntingAreaId);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return NextResponse.json(data || []);
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { teamId, huntingAreaId, name, coordinates } = body || {};
    if (!teamId || !huntingAreaId || !coordinates) {
      throw new HttpError(400, 'Missing teamId, huntingAreaId or coordinates');
    }
    await requireTeamAccess(teamId);

    const { data, error } = await getSupabaseAdmin()
      .from('no_hunt_zones')
      .insert({
        teamid: teamId,
        hunting_area_id: huntingAreaId,
        name: name || null,
        coordinates,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json(data);
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const teamId = request.nextUrl.searchParams.get('teamId');
    const id = request.nextUrl.searchParams.get('id');
    if (!teamId || !id) throw new HttpError(400, 'teamId and id required');
    await requireTeamAccess(teamId);

    const { error } = await getSupabaseAdmin()
      .from('no_hunt_zones')
      .delete()
      .eq('id', id)
      .eq('teamid', teamId);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
