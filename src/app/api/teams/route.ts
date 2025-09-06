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
      .select(`
        *,
        team_members (
          userid,
          role,
          joined_at
        )
      `)
      .eq('ownerid', userId);

    if (ownedError) {
      console.error('Error fetching owned teams:', ownedError);
      return NextResponse.json({ error: ownedError.message }, { status: 500 });
    }

    // Hent teams hvor brukeren er medlem (men ikke eier)
    const { data: memberTeams, error: memberError } = await supabase
      .from('team_members')
      .select(`
        teams (
          *,
          team_members (
            userid,
            role,
            joined_at
          )
        )
      `)
      .eq('userid', userId);

    if (memberError) {
      console.error('Error fetching member teams:', memberError);
      return NextResponse.json({ error: memberError.message }, { status: 500 });
    }

    // Kombiner teams og fjern duplikater
    const ownedTeamIds = new Set((ownedTeams || []).map(team => team.id));
    const uniqueMemberTeams = (memberTeams || [])
      .map(m => m.teams)
      .filter(Boolean)
      .filter(team => !ownedTeamIds.has(team.id)); // Fjern teams som allerede er eid

    const allTeams = [
      ...(ownedTeams || []),
      ...uniqueMemberTeams
    ];

    // Transform team_members to members for frontend compatibility
    // and fetch nicknames for all members
    const teamsWithMembersFormatted = await Promise.all(
      allTeams.map(async (team) => {
        if (!team.team_members || team.team_members.length === 0) {
          return {
            ...team,
            members: []
          };
        }

        // Get user profiles for all team members
        const userIds = team.team_members.map((member: any) => member.userid);
        const { data: userProfiles, error: profilesError } = await supabase
          .from('users')
          .select('google_id, nickname, display_name, email')
          .in('google_id', userIds);

        if (profilesError) {
          console.error('Error fetching user profiles:', profilesError);
        }

        // Merge team members with their user profiles
        const membersWithProfiles = team.team_members.map((member: any) => {
          const userProfile = userProfiles?.find(profile => profile.google_id === member.userid);
          return {
            ...member,
            userProfile: userProfile || null
          };
        });

        return {
          ...team,
          members: membersWithProfiles
        };
      })
    );

    return NextResponse.json(teamsWithMembersFormatted);
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

    // Transform team_members to members for frontend compatibility
    const teamWithMembersFormatted = {
      ...teamWithMembers,
      members: teamWithMembers.team_members || []
    };

    return NextResponse.json(teamWithMembersFormatted, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/teams:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Slett team
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    const userId = session?.user?.googleId || session?.user?.email;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('id');

    if (!teamId) {
      return NextResponse.json({ error: 'Team ID is required' }, { status: 400 });
    }

    const supabase = getAuthenticatedSupabase();

    // Sjekk om brukeren er eier av teamet
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .eq('ownerid', userId)
      .single();

    if (teamError || !team) {
      return NextResponse.json({ error: 'Team not found or you are not the owner' }, { status: 404 });
    }

    // Slett team_members først (foreign key constraint)
    const { error: membersError } = await supabase
      .from('team_members')
      .delete()
      .eq('teamid', teamId);

    if (membersError) {
      console.error('Error deleting team members:', membersError);
      return NextResponse.json({ error: membersError.message }, { status: 500 });
    }

    // Slett teamet
    const { error: deleteError } = await supabase
      .from('teams')
      .delete()
      .eq('id', teamId);

    if (deleteError) {
      console.error('Error deleting team:', deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Team deleted successfully' });
  } catch (error: any) {
    console.error('Error in DELETE /api/teams:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
