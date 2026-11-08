import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db/supabaseAdmin';
import { HttpError, jsonError, requireTeamAccess } from '@/lib/db/access';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const teamId = request.nextUrl.searchParams.get('teamId');
    if (!teamId) throw new HttpError(400, 'Team ID is required');
    await requireTeamAccess(teamId);

    const { data, error } = await getSupabaseAdmin()
      .from('hunting_areas')
      .select('*')
      .eq('teamid', teamId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return NextResponse.json(data || []);
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { teamId, id, name, coordinates, color, lineWeight } = body;
    if (!teamId) throw new HttpError(400, 'Team ID is required');
    if (!id || !name || !coordinates) {
      throw new HttpError(400, 'Missing required fields: id, name, coordinates');
    }
    await requireTeamAccess(teamId);

    const { data, error } = await getSupabaseAdmin()
      .from('hunting_areas')
      .insert({
        id,
        teamid: teamId,
        name,
        coordinates,
        color: color || '#00ff00',
        line_weight: lineWeight || 3,
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
    const huntingAreaId = request.nextUrl.searchParams.get('id');
    const teamId = request.nextUrl.searchParams.get('teamId');
    if (!huntingAreaId || !teamId) throw new HttpError(400, 'Hunting area ID and team ID are required');
    await requireTeamAccess(teamId);

    const { error } = await getSupabaseAdmin()
      .from('hunting_areas')
      .delete()
      .eq('id', huntingAreaId)
      .eq('teamid', teamId);
    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonError(error);
  }
}
