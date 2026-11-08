import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db/supabaseAdmin';
import { jsonError, requireTeamAccess, requireUserId, HttpError } from '@/lib/db/access';
import {
  isShotPlaceRow,
  pairPosts,
  serializeSkyteplass,
  serializeTreffpunkt,
  type Coord,
  type PostRow,
} from '@/lib/db/shotPlaces';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const teamId = request.nextUrl.searchParams.get('teamId');
    if (!teamId) throw new HttpError(400, 'Team ID is required');
    await requireTeamAccess(teamId);

    const { data, error } = await getSupabaseAdmin()
      .from('posts')
      .select('id, title, content, local_id, created_at, teamid')
      .eq('teamid', teamId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching shot places:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(pairPosts((data || []) as PostRow[]));
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const body = await request.json();
    const teamId = body.teamId as string | undefined;
    const name = String(body.name || '').trim();
    const current = body.current as Coord | undefined;
    const target = body.target as Coord | undefined;
    const localId = String(body.localId || `pair_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`);

    if (!teamId) throw new HttpError(400, 'Team ID is required');
    if (!name) throw new HttpError(400, 'Name is required');
    if (!current || !Number.isFinite(current.lat) || !Number.isFinite(current.lng)) {
      throw new HttpError(400, 'Skyteplass coordinates are required');
    }
    if (!target || !Number.isFinite(target.lat) || !Number.isFinite(target.lng)) {
      throw new HttpError(400, 'Treffpunkt coordinates are required');
    }

    await requireTeamAccess(teamId, userId);
    const supabase = getSupabaseAdmin();

    const { data: skyteplass, error: shotError } = await supabase
      .from('posts')
      .insert({
        title: 'Skyteplass',
        content: serializeSkyteplass(current, name),
        createdby: userId,
        teamid: teamId,
        local_id: localId,
      })
      .select()
      .single();
    if (shotError) throw new Error(shotError.message);

    const { data: treffpunkt, error: targetError } = await supabase
      .from('posts')
      .insert({
        title: 'Treffpunkt',
        content: serializeTreffpunkt(target, name),
        createdby: userId,
        teamid: teamId,
        local_id: localId,
      })
      .select()
      .single();
    if (targetError) throw new Error(targetError.message);

    return NextResponse.json({
      id: treffpunkt?.id ?? skyteplass?.id,
      pair_local_id: localId,
      name,
      current,
      target,
      category: 'Treffpunkt',
      created_at: treffpunkt?.created_at || skyteplass?.created_at,
      linked: true,
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const teamId = (body.teamId || request.nextUrl.searchParams.get('teamId')) as string | undefined;
    const pairLocalId = body.pairLocalId as string | undefined;
    const postId = body.postId as number | undefined;
    const deleteAll = Boolean(body.all);
    if (!teamId) throw new HttpError(400, 'Team ID is required');
    await requireTeamAccess(teamId);

    const supabase = getSupabaseAdmin();
    const { data: posts, error } = await supabase
      .from('posts')
      .select('id, local_id, teamid, content, title')
      .eq('teamid', teamId);
    if (error) throw new Error(error.message);

    let ids: number[] = [];
    if (deleteAll) {
      ids = (posts || []).filter(isShotPlaceRow).map((p) => Number(p.id));
    } else if (pairLocalId) {
      ids = (posts || [])
        .filter((p) => String(p.local_id || '') === String(pairLocalId))
        .map((p) => Number(p.id));
    } else if (postId) {
      const clicked = (posts || []).find((p) => Number(p.id) === Number(postId));
      if (clicked?.local_id) {
        ids = (posts || [])
          .filter((p) => String(p.local_id || '') === String(clicked.local_id))
          .map((p) => Number(p.id));
      }
      if (!ids.includes(Number(postId))) ids.push(Number(postId));
    }

    ids = Array.from(new Set(ids.filter((id) => Number.isFinite(id))));
    if (ids.length === 0) {
      if (deleteAll) return NextResponse.json({ success: true, deleted: [] });
      throw new HttpError(400, 'Nothing to delete');
    }

    const { error: deleteError } = await supabase.from('posts').delete().in('id', ids).eq('teamid', teamId);
    if (deleteError) throw new Error(deleteError.message);

    return NextResponse.json({ success: true, deleted: ids });
  } catch (error) {
    return jsonError(error);
  }
}
