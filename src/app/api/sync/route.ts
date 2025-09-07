import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST - Sync all data (push local data to DB, pull server data to local)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    const userId = session?.user?.googleId || session?.user?.email;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { teamId, localData } = body;

    if (!teamId) {
      return NextResponse.json({ error: 'Team ID is required' }, { status: 400 });
    }

    // Verify user has access to this team
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

    const results = {
      pushed: { tracks: 0, finds: 0, observations: 0, posts: 0 },
      pulled: { tracks: [] as any[], finds: [] as any[], observations: [] as any[], posts: [] as any[] },
      errors: [] as string[]
    };

    // PUSH PHASE: Push local data to database (only if localData is provided)
    if (localData && localData !== null) {
      // Push tracks
      if (localData.tracks && localData.tracks.length > 0) {
        for (const track of localData.tracks as any[]) {
          try {
            // Check if track with this local_id already exists
            const { data: existingTrack } = await supabaseAdmin
              .from('tracks')
              .select('id')
              .eq('local_id', track.id)
              .eq('teamid', teamId)
              .single();

            if (!existingTrack) {
              const { error: trackError } = await supabaseAdmin
                .from('tracks')
                .insert({
                  teamid: teamId,
                  createdby: userId,
                  name: track.name,
                  color: track.color,
                  local_id: track.id,
                  points: track.points ? JSON.stringify(track.points) : null,
                  shot_pair_id: track.shotPairId || 'unknown'
                });

              if (trackError) {
                results.errors.push(`Track ${(track as any).name}: ${trackError.message}`);
              } else {
                results.pushed.tracks++;
              }
            }
          } catch (error: any) {
            results.errors.push(`Track ${(track as any).name}: ${error.message}`);
          }
        }
      }

      // Push finds
      if (localData.finds && localData.finds.length > 0) {
        for (const find of localData.finds as any[]) {
          try {
            // Check if find with this local_id already exists
            const { data: existingFind } = await supabaseAdmin
              .from('finds')
              .select('id')
              .eq('local_id', find.id)
              .eq('teamid', teamId)
              .single();

            if (!existingFind) {
              const { error: findError } = await supabaseAdmin
                .from('finds')
                .insert({
                  teamid: teamId,
                  createdby: userId,
                  name: find.name,
                  local_id: find.id,
                  position: find.position ? JSON.stringify(find.position) : null,
                  shot_pair_id: find.shotPairId || 'unknown',
                  color: find.color || '#10b981'
                });

              if (findError) {
                results.errors.push(`Find ${find.name}: ${findError.message}`);
              } else {
                results.pushed.finds++;
              }
            }
          } catch (error: any) {
            results.errors.push(`Find ${find.name}: ${error.message}`);
          }
        }
      }

      // Push observations
      if (localData.observations && localData.observations.length > 0) {
        for (const observation of localData.observations as any[]) {
          try {
            // Check if observation with this local_id already exists
            const { data: existingObservation } = await supabaseAdmin
              .from('observations')
              .select('id')
              .eq('local_id', observation.id)
              .eq('teamid', teamId)
              .single();

            if (!existingObservation) {
              const { error: observationError } = await supabaseAdmin
                .from('observations')
                .insert({
                  teamid: teamId,
                  createdby: userId,
                  name: observation.name,
                  local_id: observation.id,
                  position: observation.position ? JSON.stringify(observation.position) : null,
                  color: observation.color || '#F59E0B'
                });

              if (observationError) {
                results.errors.push(`Observation ${observation.name}: ${observationError.message}`);
              } else {
                results.pushed.observations++;
              }
            }
          } catch (error: any) {
            results.errors.push(`Observation ${observation.name}: ${error.message}`);
          }
        }
      }

      // Push posts (skuddpar)
      if (localData.posts && localData.posts.length > 0) {
        for (const post of localData.posts as any[]) {
          try {
            // Check if post with this local_id already exists
            const { data: existingPost } = await supabaseAdmin
              .from('posts')
              .select('id')
              .eq('local_id', post.id)
              .eq('teamid', teamId)
              .single();

            if (!existingPost) {
              const { error: postError } = await supabaseAdmin
                .from('posts')
                .insert({
                  teamid: teamId,
                  createdby: userId,
                  title: post.title,
                  content: post.content,
                  local_id: post.id
                });

              if (postError) {
                results.errors.push(`Post ${post.title}: ${postError.message}`);
              } else {
                results.pushed.posts++;
              }
            }
          } catch (error: any) {
            results.errors.push(`Post ${post.title}: ${error.message}`);
          }
        }
      }
    }

    // PULL PHASE: Get all server data for this team
    try {
      // Get tracks
      const { data: serverTracks, error: tracksError } = await supabaseAdmin
        .from('tracks')
        .select('*')
        .eq('teamid', teamId)
        .order('created_at', { ascending: false });

      if (!tracksError && serverTracks) {
        results.pulled.tracks = serverTracks;
      }

      // Get finds
      const { data: serverFinds, error: findsError } = await supabaseAdmin
        .from('finds')
        .select('*')
        .eq('teamid', teamId)
        .order('created_at', { ascending: false });

      if (!findsError && serverFinds) {
        results.pulled.finds = serverFinds;
      }

      // Get observations
      const { data: serverObservations, error: observationsError } = await supabaseAdmin
        .from('observations')
        .select('*')
        .eq('teamid', teamId)
        .order('created_at', { ascending: false });

      if (!observationsError && serverObservations) {
        results.pulled.observations = serverObservations;
      }

      // Get posts
      const { data: serverPosts, error: postsError } = await supabaseAdmin
        .from('posts')
        .select('*')
        .eq('teamid', teamId)
        .order('created_at', { ascending: false });

      if (!postsError && serverPosts) {
        results.pulled.posts = serverPosts;
      }

    } catch (error: unknown) {
      results.errors.push(`Pull error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return NextResponse.json(results);
  } catch (error: unknown) {
    console.error('Error in sync:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
