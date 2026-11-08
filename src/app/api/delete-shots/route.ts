import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db/supabaseAdmin';
import { HttpError, jsonError, requireTeamAccess } from '@/lib/db/access';
import { isShotPlaceRow } from '@/lib/db/shotPlaces';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const teamId = body.teamId as string | undefined;
    if (!teamId) throw new HttpError(400, 'Team ID is required');
    await requireTeamAccess(teamId);

    const supabase = getSupabaseAdmin();
    const { data: posts, error } = await supabase
      .from('posts')
      .select('id, content, title')
      .eq('teamid', teamId);
    if (error) throw new Error(error.message);

    const ids = (posts || []).filter(isShotPlaceRow).map((p) => Number(p.id)).filter(Number.isFinite);
    if (ids.length > 0) {
      const { error: deleteError } = await supabase.from('posts').delete().in('id', ids).eq('teamid', teamId);
      if (deleteError) throw new Error(deleteError.message);
    }

    return NextResponse.json({ success: true, deleted: ids });
  } catch (error) {
    return jsonError(error);
  }
}
