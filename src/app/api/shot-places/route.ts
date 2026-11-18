import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db/supabaseAdmin';
import { jsonError, requireTeamAccess, requireUserId, HttpError } from '@/lib/db/access';
import {
  isShotPlaceRow,
  pairPosts,
  samePostId,
  serializeSkyteplass,
  serializeTreffpunkt,
  type Coord,
  type PostId,
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
      .is('deleted_at', null)
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
    // posts.id er UUID (tekst). Godta både enkelt-id og liste, og sammenlign alltid som tekst.
    const requestedIds: string[] = [
      ...(Array.isArray(body.postIds) ? body.postIds : []),
      ...(body.postId != null ? [body.postId] : []),
    ]
      .filter((id: unknown) => id != null && String(id) !== '' && String(id) !== 'NaN')
      .map((id: unknown) => String(id));
    const deleteAll = Boolean(body.all);
    if (!teamId) throw new HttpError(400, 'Team ID is required');
    await requireTeamAccess(teamId);

    const supabase = getSupabaseAdmin();
    const { data: posts, error } = await supabase
      .from('posts')
      .select('id, local_id, teamid, content, title')
      .eq('teamid', teamId)
      .is('deleted_at', null);
    if (error) throw new Error(error.message);
    const rows = (posts || []) as Array<{ id: PostId; local_id?: string | null; content?: string | null; title?: string | null }>;

    const ids = new Set<string>();
    if (deleteAll) {
      rows.filter(isShotPlaceRow).forEach((p) => ids.add(String(p.id)));
    } else {
      const localIds = new Set<string>();
      if (pairLocalId) localIds.add(String(pairLocalId));
      for (const id of requestedIds) {
        const row = rows.find((p) => samePostId(p.id, id));
        if (!row) continue; // finnes ikke (lenger) i dette laget
        ids.add(String(row.id));
        if (row.local_id) localIds.add(String(row.local_id));
      }
      // Ta med begge halvdelene av paret (skyteplass og treffpunkt)
      rows
        .filter((p) => p.local_id && localIds.has(String(p.local_id)))
        .forEach((p) => ids.add(String(p.id)));
    }

    if (ids.size === 0) {
      // Allerede slettet (f.eks. av en annen på laget): ikke en feil for brukeren
      return NextResponse.json({ success: true, deleted: [] });
    }

    // Myk sletting, så de andre på laget får vite om det
    const { error: deleteError } = await supabase
      .from('posts')
      .update({ deleted_at: new Date().toISOString() })
      .in('id', Array.from(ids))
      .eq('teamid', teamId);
    if (deleteError) throw new Error(deleteError.message);

    return NextResponse.json({ success: true, deleted: Array.from(ids) });
  } catch (error) {
    return jsonError(error);
  }
}
