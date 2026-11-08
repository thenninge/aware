import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db/supabaseAdmin';
import { jsonError, requireTeamAccess } from '@/lib/db/access';
import { mapRows, rowToFind, rowToObservation, rowToTrack } from '@/lib/db/searchData';
import { pairPosts, type PostRow } from '@/lib/db/shotPlaces';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { teamId } = body;
    await requireTeamAccess(teamId);
    const supabase = getSupabaseAdmin();

    const [tracks, finds, observations, posts] = await Promise.all([
      supabase.from('tracks').select('*').eq('teamid', teamId).order('created_at', { ascending: true }),
      supabase.from('finds').select('*').eq('teamid', teamId).order('created_at', { ascending: true }),
      supabase.from('observations').select('*').eq('teamid', teamId).order('created_at', { ascending: true }),
      supabase.from('posts').select('id, title, content, local_id, created_at, teamid').eq('teamid', teamId).order('created_at', { ascending: true }),
    ]);

    return NextResponse.json({
      pushed: { tracks: 0, finds: 0, observations: 0, posts: 0 },
      pulled: {
        tracks: mapRows(tracks.data, rowToTrack),
        finds: mapRows(finds.data, rowToFind),
        observations: mapRows(observations.data, rowToObservation),
        posts: pairPosts((posts.data || []) as PostRow[]),
      },
      errors: [tracks.error, finds.error, observations.error, posts.error]
        .filter(Boolean)
        .map((error) => error!.message),
    });
  } catch (error) {
    return jsonError(error);
  }
}
