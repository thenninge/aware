import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST() {
  try {
    const testUserId = '115227437298316098585';
    const testTeamName = 'Test Team';

    // Test creating a team
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .insert({
        name: testTeamName,
        ownerid: testUserId
      })
      .select()
      .single();

    if (teamError) {
      return NextResponse.json({ 
        error: teamError.message,
        code: teamError.code,
        details: teamError.details
      }, { status: 500 });
    }

    // Test adding owner as member
    const { error: memberError } = await supabase
      .from('team_members')
      .insert({
        teamid: team.id,
        userid: testUserId,
        role: 'owner'
      });

    if (memberError) {
      return NextResponse.json({ 
        error: memberError.message,
        code: memberError.code,
        details: memberError.details
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      team,
      message: 'Team created successfully!'
    });
  } catch (error: any) {
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
}
