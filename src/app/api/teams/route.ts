import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';

// Create admin Supabase client with service role key
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // NB! Service role key, not anon key
);

// Create authenticated Supabase client
function getAuthenticatedSupabase() {
  return supabaseAdmin;
}

// GET - Hent teams for en bruker
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    const userId = session?.user?.googleId || session?.user?.email;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getAuthenticatedSupabase();

    // Hent teams hvor brukeren er eier eller medlem
    const { data: ownedTeams, error: ownedError } = await supabase
      .from('teams')
      .select('*')
      .eq('ownerid', userId);

    if (ownedError) {
      console.error('Error fetching owned teams:', ownedError);
      return NextResponse.json({ error: ownedError.message }, { status: 500 });
    }

    // Hent teams hvor brukeren er medlem (men ikke eier)
    const { data: memberTeams, error: memberError } = await supabase
      .from('team_members')
      .select('teams(*)')
      .eq('userid', userId);

    if (memberError) {
      console.error('Error fetching member teams:', memberError);
      return NextResponse.json({ error: memberError.message }, { status: 500 });
    }

    // Kombiner teams
    const allTeams = [
      ...(ownedTeams || []),
      ...(memberTeams?.map(m => m.teams).filter(Boolean) || [])
    ];

    return NextResponse.json(allTeams);
  } catch (error) {
    console.error('Error in GET /api/teams:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Opprett nytt team
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    const userId = session?.user?.googleId || session?.user?.email;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name } = await request.json();
    const ownerId = userId;
    const supabase = getAuthenticatedSupabase();

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Opprett team
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .insert({
        name: name.trim(),
        ownerid: ownerId
      })
      .select()
      .single();

    if (teamError) {
      console.error('Error creating team:', teamError);
      return NextResponse.json({ error: teamError.message }, { status: 500 });
    }

    // Legg til eieren som medlem
    const { error: memberError } = await supabase
      .from('team_members')
      .insert({
        teamid: team.id,
        userid: ownerId,
        role: 'owner'
      });

    if (memberError) {
      console.error('Error adding owner as member:', memberError);
      // Slett teamet hvis vi ikke kan legge til eieren som medlem
      await supabase.from('teams').delete().eq('id', team.id);
      return NextResponse.json({ error: memberError.message }, { status: 500 });
    }

    // Hent team med medlemmer
    const { data: teamWithMembers, error: fetchError } = await supabase
      .from('teams')
      .select(`
        *,
        team_members (
          userid,
          role,
          joined_at
        )
      `)
      .eq('id', team.id)
      .single();

    if (fetchError) {
      console.error('Error fetching team with members:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    return NextResponse.json(teamWithMembers, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/teams:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
