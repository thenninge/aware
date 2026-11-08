import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db/supabaseAdmin';
import { HttpError, jsonError, requireTeamAccess } from '@/lib/db/access';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const teamId = request.nextUrl.searchParams.get('teamId');
    if (!teamId) throw new HttpError(400, 'Team ID is required');
    await requireTeamAccess(teamId);

    const { data: posts, error } = await getSupabaseAdmin()
      .from('posts')
      .select('*')
      .eq('teamid', teamId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching posts:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(posts || []);
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { teamId, name, current_lat, current_lng, target_lat, target_lng, category } = body;
    if (!teamId) throw new HttpError(400, 'Team ID is required');
    const { userId } = await requireTeamAccess(teamId);

    const { data: newPost, error } = await getSupabaseAdmin()
      .from('posts')
      .insert({
        teamid: teamId,
        createdby: userId,
        title: name || 'Unnamed Post',
        content: `Lat: ${current_lat}, Lng: ${current_lng}${target_lat ? `, Target: ${target_lat}, ${target_lng}` : ''}${category ? `, Category: ${category}` : ''}`,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating post:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(newPost);
  } catch (error) {
    return jsonError(error);
  }
}
