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

// POST - Slett skuddpar (Skyteplass/Treffpunkt) for aktivt team, eller brukerens egne uten team
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.googleId || session?.user?.email;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let teamId: string | null = null;
    try {
      const body = await request.json();
      teamId = body?.teamId ? String(body.teamId) : null;
    } catch {
      // Ingen body = ingen team
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Skuddpar identifiseres av title (category-kolonnen settes ikke av nyere kode)
    let query = supabaseAdmin
      .from('posts')
      .delete()
      .or('title.in.(Skyteplass,Treffpunkt),category.in.(Skyteplass,Treffpunkt)');

    if (teamId) {
      const { data: teamAccess, error: accessError } = await supabaseAdmin
        .from('team_members')
        .select('userid')
        .eq('teamid', teamId)
        .eq('userid', userId)
        .maybeSingle();

      if (accessError) {
        console.error('Error checking team access:', accessError);
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }

      const { data: ownedTeam } = await supabaseAdmin
        .from('teams')
        .select('id')
        .eq('id', teamId)
        .eq('ownerid', userId)
        .maybeSingle();

      if (!teamAccess && !ownedTeam) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }

      query = query.eq('teamid', teamId);
    } else {
      query = query.is('teamid', null).eq('createdby', userId);
    }

    const { error } = await query;
    if (error) {
      console.error('Error deleting shots:', error);
      return NextResponse.json({ error: 'Failed to delete shots' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in POST /api/delete-shots:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
