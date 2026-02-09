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
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

// GET - Hent finds for aktivt team
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    const userId = session?.user?.googleId || session?.user?.email;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');

    if (!teamId) {
      return NextResponse.json({ error: 'Team ID is required' }, { status: 400 });
    }

    // Verify user has access to this team
    const supabaseAdmin = getSupabaseAdmin();
    const { data: teamAccess, error: accessError } = await supabaseAdmin
      .from('team_members')
      .select('*')
      .eq('teamid', teamId)
      .eq('userid', userId)
      .single();

    if (accessError && accessError.code !== 'PGRST116') {
      console.error('Error checking team access:', accessError);
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Also check if user is owner of the team
    const { data: ownedTeam, error: ownerError } = await supabaseAdmin
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .eq('ownerid', userId)
      .single();

    if (!teamAccess && !ownedTeam) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get finds for this team
    const { data: finds, error: findsError } = await supabaseAdmin
      .from('finds')
      .select('*')
      .eq('teamid', teamId)
      .order('created_at', { ascending: false });

    if (findsError) {
      console.error('Error fetching finds:', findsError);
      return NextResponse.json({ error: findsError.message }, { status: 500 });
    }

    return NextResponse.json(finds || []);
  } catch (error: any) {
    console.error('Error in GET /api/team-data/finds:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Opprett ny find for aktivt team
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    const userId = session?.user?.googleId || session?.user?.email;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { teamId, name, localId, position, color, shotPairId, mode } = body;

    if (!teamId) {
      return NextResponse.json({ error: 'Team ID is required' }, { status: 400 });
    }

    if (!position || !position.lat || !position.lng) {
      return NextResponse.json({ error: 'Position (lat, lng) is required' }, { status: 400 });
    }

    // Verify user has access to this team
    const supabaseAdmin = getSupabaseAdmin();
    const { data: teamAccess, error: accessError } = await supabaseAdmin
      .from('team_members')
      .select('*')
      .eq('teamid', teamId)
      .eq('userid', userId)
      .single();

    if (accessError && accessError.code !== 'PGRST116') {
      console.error('Error checking team access:', accessError);
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Also check if user is owner of the team
    const { data: ownedTeam, error: ownerError } = await supabaseAdmin
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .eq('ownerid', userId)
      .single();

    if (!teamAccess && !ownedTeam) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Create new find with complete data
    const { data: newFind, error: createError } = await supabaseAdmin
      .from('finds')
      .insert({
        teamid: teamId,
        createdby: userId,
        name: name || 'Unnamed Find',
        local_id: localId,
        position: position,
        color: color || '#EF4444',
        shotpairid: shotPairId || null,
        mode: mode || 'søk'
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating find:', createError);
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    return NextResponse.json(newFind);
  } catch (error: any) {
    console.error('Error in POST /api/team-data/finds:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Slett find for aktivt team via local_id eller id
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.googleId || session?.user?.email;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { teamId, localId, id } = body || {};

    if (!teamId || (!localId && !id)) {
      return NextResponse.json({ error: 'teamId and (localId or id) required' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Authz: ensure user belongs to team or owns it
    const { data: teamAccess } = await supabaseAdmin
      .from('team_members')
      .select('id')
      .eq('teamid', teamId)
      .eq('userid', userId)
      .maybeSingle();
    const { data: ownedTeam } = await supabaseAdmin
      .from('teams')
      .select('id')
      .eq('id', teamId)
      .eq('ownerid', userId)
      .maybeSingle();
    if (!teamAccess && !ownedTeam) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    let query = supabaseAdmin.from('finds').delete().eq('teamid', teamId);
    if (localId) {
      query = query.eq('local_id', localId);
    } else if (id) {
      query = query.eq('id', id);
    }
    const { error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
