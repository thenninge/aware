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

// GET - Hent observations for aktivt team
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

    // Get observations for this team
    const { data: observations, error: observationsError } = await supabaseAdmin
      .from('observations')
      .select('*')
      .eq('teamid', teamId)
      .order('created_at', { ascending: false });

    if (observationsError) {
      console.error('Error fetching observations:', observationsError);
      return NextResponse.json({ error: observationsError.message }, { status: 500 });
    }

    return NextResponse.json(observations || []);
  } catch (error: any) {
    console.error('Error in GET /api/team-data/observations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Opprett ny observation for aktivt team
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    const userId = session?.user?.googleId || session?.user?.email;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { teamId, name, lat, lng, description, color, category } = body;

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

    // Create new observation
    const { data: newObservation, error: createError } = await supabaseAdmin
      .from('observations')
      .insert({
        teamid: teamId,
        createdby: userId,
        name: name || 'Unnamed Observation',
        lat,
        lng,
        description: description || '',
        color: color || '#f59e0b',
        category: category || 'general'
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating observation:', createError);
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    return NextResponse.json(newObservation);
  } catch (error: any) {
    console.error('Error in POST /api/team-data/observations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
