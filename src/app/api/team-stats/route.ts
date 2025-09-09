import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

// Create admin Supabase client with service role key
function getSupabaseAdmin() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase environment variables');
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    const userId = session?.user?.googleId || session?.user?.email;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    // Get user's active team from the request or session
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');
    
    if (!teamId) {
      return NextResponse.json({ error: 'Team ID required' }, { status: 400 });
    }

    // Get counts for posts, finds, and observations for this team
    const [postsResult, findsResult, observationsResult] = await Promise.all([
      supabase
        .from('posts')
        .select('id', { count: 'exact' })
        .eq('teamid', teamId),
      
      supabase
        .from('finds')
        .select('id', { count: 'exact' })
        .eq('teamid', teamId),
      
      supabase
        .from('observations')
        .select('id', { count: 'exact' })
        .eq('teamid', teamId)
    ]);

    // Log errors but don't fail the request
    if (postsResult.error) {
      console.error('Error fetching posts count:', postsResult.error);
    }
    if (findsResult.error) {
      console.error('Error fetching finds count:', findsResult.error);
    }
    if (observationsResult.error) {
      console.error('Error fetching observations count:', observationsResult.error);
    }

    // Return counts, defaulting to 0 if there's an error
    const stats = {
      posts: postsResult.error ? 0 : (postsResult.count || 0),
      finds: findsResult.error ? 0 : (findsResult.count || 0),
      observations: observationsResult.error ? 0 : (observationsResult.count || 0)
    };

    return NextResponse.json(stats);

  } catch (error) {
    console.error('Error in team-stats API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
