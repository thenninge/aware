import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use service role key to bypass RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  try {
    // Test basic table existence with service role
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('*')
      .limit(1);

    const { data: members, error: membersError } = await supabase
      .from('team_members')
      .select('*')
      .limit(1);

    return NextResponse.json({
      success: true,
      teams: {
        exists: !teamsError,
        error: teamsError?.message,
        data: teams,
        count: teams?.length || 0
      },
      members: {
        exists: !membersError,
        error: membersError?.message,
        data: members,
        count: members?.length || 0
      },
      message: 'Service role test completed'
    });
  } catch (error: any) {
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
}
