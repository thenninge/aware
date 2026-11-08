import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db/supabaseAdmin';
import { jsonError, requireTeamAccess, requireUserId, HttpError } from '@/lib/db/access';

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
      .order('created_at', { ascending: true });

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
    const userId = await requireUserId();
    const body = await request.json();
    const { title, content, teamId, localId } = body;
    if (!teamId) throw new HttpError(400, 'Team ID is required');
    await requireTeamAccess(teamId, userId);

    const { data: newPost, error } = await getSupabaseAdmin()
      .from('posts')
      .insert({
        title: title || 'Unnamed Post',
        content: content || '',
        createdby: userId,
        teamid: teamId,
        local_id: localId,
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

export async function DELETE(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const ids = request.nextUrl.searchParams.get('ids');
    const teamId = request.nextUrl.searchParams.get('teamId');
    if (!ids) throw new HttpError(400, 'Post IDs are required');
    const postIds = ids.split(',').map((id) => id.trim()).filter(Boolean);
    if (postIds.length === 0) throw new HttpError(400, 'Post IDs are required');

    const supabase = getSupabaseAdmin();
    if (teamId) {
      await requireTeamAccess(teamId, userId);
      const { error } = await supabase.from('posts').delete().in('id', postIds).eq('teamid', teamId);
      if (error) throw new Error(error.message);
    } else {
      const { data: rows, error: fetchError } = await supabase
        .from('posts')
        .select('id, teamid')
        .in('id', postIds);
      if (fetchError) throw new Error(fetchError.message);
      const teamIds = Array.from(new Set((rows || []).map((r) => r.teamid).filter(Boolean)));
      for (const id of teamIds) {
        await requireTeamAccess(String(id), userId);
      }
      const { error } = await supabase.from('posts').delete().in('id', postIds);
      if (error) throw new Error(error.message);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonError(error);
  }
}
