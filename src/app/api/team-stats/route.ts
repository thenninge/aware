import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db/supabaseAdmin';
import { HttpError, jsonError, requireTeamAccess } from '@/lib/db/access';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const teamId = request.nextUrl.searchParams.get('teamId');
    if (!teamId) throw new HttpError(400, 'Team ID required');
    await requireTeamAccess(teamId);

    const supabase = getSupabaseAdmin();
    const [postsResult, findsResult, observationsResult] = await Promise.all([
      supabase.from('posts').select('id', { count: 'exact', head: true }).eq('teamid', teamId),
      supabase.from('finds').select('id', { count: 'exact', head: true }).eq('teamid', teamId),
      supabase.from('observations').select('id', { count: 'exact', head: true }).eq('teamid', teamId),
    ]);

    return NextResponse.json({
      posts: postsResult.error ? 0 : (postsResult.count || 0),
      finds: findsResult.error ? 0 : (findsResult.count || 0),
      observations: observationsResult.error ? 0 : (observationsResult.count || 0),
    });
  } catch (error) {
    return jsonError(error);
  }
}
