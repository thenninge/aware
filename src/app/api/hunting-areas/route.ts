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

// GET - Hent hunting areas for aktivt team
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

    // Get hunting areas for this team
    const { data: huntingAreas, error: huntingAreasError } = await supabaseAdmin
      .from('hunting_areas')
      .select('*')
      .eq('teamid', teamId)
      .order('created_at', { ascending: false });

    if (huntingAreasError) {
      console.error('Error fetching hunting areas:', huntingAreasError);
      return NextResponse.json({ error: huntingAreasError.message }, { status: 500 });
    }

    return NextResponse.json(huntingAreas || []);
  } catch (error: any) {
    console.error('Error in GET /api/hunting-areas:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Opprett ny hunting area for aktivt team
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    const userId = session?.user?.googleId || session?.user?.email;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { teamId, id, name, coordinates, color, lineWeight } = body;

    if (!teamId) {
      return NextResponse.json({ error: 'Team ID is required' }, { status: 400 });
    }

    if (!id || !name || !coordinates) {
      return NextResponse.json({ error: 'Missing required fields: id, name, coordinates' }, { status: 400 });
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

    // Create new hunting area
    const { data: newHuntingArea, error: createError } = await supabaseAdmin
      .from('hunting_areas')
      .insert({
        id,
        teamid: teamId,
        name,
        coordinates,
        color: color || '#00ff00',
        line_weight: lineWeight || 3,
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating hunting area:', createError);
      console.error('Insert data was:', { id, teamid: teamId, name, coordinates, color, line_weight: lineWeight });
      return NextResponse.json({ 
        error: createError.message,
        details: createError.details,
        hint: createError.hint,
        code: createError.code 
      }, { status: 500 });
    }

    console.log('Successfully created hunting area:', newHuntingArea);
    return NextResponse.json(newHuntingArea);
  } catch (error: any) {
    console.error('Error in POST /api/hunting-areas:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Slett hunting area
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    const userId = session?.user?.googleId || session?.user?.email;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const huntingAreaId = searchParams.get('id');
    const teamId = searchParams.get('teamId');

    if (!huntingAreaId || !teamId) {
      return NextResponse.json({ error: 'Hunting area ID and team ID are required' }, { status: 400 });
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

    // Delete hunting area
    const { error: deleteError } = await supabaseAdmin
      .from('hunting_areas')
      .delete()
      .eq('id', huntingAreaId)
      .eq('teamid', teamId);

    if (deleteError) {
      console.error('Error deleting hunting area:', deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in DELETE /api/hunting-areas:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

