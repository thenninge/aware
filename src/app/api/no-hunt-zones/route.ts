import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase environment variables');
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { autoRefreshToken: false, persistSession: false }
    }
  );
}

// GET - list no-hunt-zones for a team (optional filter by hunting_area_id)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.googleId || session?.user?.email;
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');
    const huntingAreaId = searchParams.get('huntingAreaId');
    if (!teamId) return NextResponse.json({ error: 'Team ID is required' }, { status: 400 });

    const supabase = getSupabaseAdmin();

    // Access check: member or owner
    const { data: teamAccess, error: accessError } = await supabase
      .from('team_members')
      .select('*')
      .eq('teamid', teamId)
      .eq('userid', userId)
      .single();
    if (accessError && accessError.code !== 'PGRST116') {
      // ignore not found
    }
    const { data: owner } = await supabase
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .eq('ownerid', userId)
      .single();
    if (!teamAccess && !owner) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    let query = supabase.from('no_hunt_zones').select('*').eq('teamid', teamId);
    if (huntingAreaId) {
      query = query.eq('hunting_area_id', huntingAreaId);
    }
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data || []);
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - create a new no-hunt-zone
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.googleId || session?.user?.email;
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { teamId, huntingAreaId, name, coordinates } = body || {};
    if (!teamId || !huntingAreaId || !coordinates) {
      return NextResponse.json({ error: 'Missing teamId, huntingAreaId or coordinates' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    // Access check
    const { data: teamAccess, error: accessError } = await supabase
      .from('team_members')
      .select('*')
      .eq('teamid', teamId)
      .eq('userid', userId)
      .single();
    if (accessError && accessError.code !== 'PGRST116') {
      // ignore not found
    }
    const { data: owner } = await supabase
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .eq('ownerid', userId)
      .single();
    if (!teamAccess && !owner) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const insertData = {
      teamid: teamId,
      hunting_area_id: huntingAreaId,
      name: name || null,
      coordinates,
    };
    const { data: inserted, error } = await supabase
      .from('no_hunt_zones')
      .insert(insertData)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(inserted);
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - delete a no-hunt-zone by id
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.googleId || session?.user?.email;
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');
    const id = searchParams.get('id'); // zone id (text)
    if (!teamId || !id) return NextResponse.json({ error: 'teamId and id required' }, { status: 400 });

    const supabase = getSupabaseAdmin();
    // Access check
    const { data: teamAccess, error: accessError } = await supabase
      .from('team_members')
      .select('*')
      .eq('teamid', teamId)
      .eq('userid', userId)
      .single();
    if (accessError && accessError.code !== 'PGRST116') {
      // ignore not found
    }
    const { data: owner } = await supabase
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .eq('ownerid', userId)
      .single();
    if (!teamAccess && !owner) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { error } = await supabase
      .from('no_hunt_zones')
      .delete()
      .eq('id', id)
      .eq('teamid', teamId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

