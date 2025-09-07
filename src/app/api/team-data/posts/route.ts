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

// GET - Hent posts for aktivt team
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

    // Get posts for this team
    const { data: posts, error: postsError } = await supabaseAdmin
      .from('posts')
      .select('*')
      .eq('teamid', teamId)
      .order('created_at', { ascending: false });

    if (postsError) {
      console.error('Error fetching posts:', postsError);
      return NextResponse.json({ error: postsError.message }, { status: 500 });
    }

    return NextResponse.json(posts || []);
  } catch (error: any) {
    console.error('Error in GET /api/team-data/posts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Opprett ny post for aktivt team
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    const userId = session?.user?.googleId || session?.user?.email;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { teamId, name, current_lat, current_lng, target_lat, target_lng, category } = body;

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

    // Create new post
    const { data: newPost, error: createError } = await supabaseAdmin
      .from('posts')
      .insert({
        teamid: teamId,
        createdby: userId,
        title: name || 'Unnamed Post',
        content: `Lat: ${current_lat}, Lng: ${current_lng}${target_lat ? `, Target: ${target_lat}, ${target_lng}` : ''}${category ? `, Category: ${category}` : ''}`
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating post:', createError);
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    return NextResponse.json(newPost);
  } catch (error: any) {
    console.error('Error in POST /api/team-data/posts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
