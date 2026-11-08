import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db/supabaseAdmin';
import { jsonError, requireTeamAccess } from '@/lib/db/access';

export const dynamic = 'force-dynamic';

// POST - Sync all data (push local data to DB, pull server data to local)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { teamId, localData } = body;
    const { userId } = await requireTeamAccess(teamId);
    const supabaseAdmin = getSupabaseAdmin();

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

      // Push posts (legacy). Skuddplasser skrives via /api/shot-places.
      if (localData.posts && localData.posts.length > 0) {
        for (const post of localData.posts as any[]) {
          try {
            if (!post.content || !post.title) continue;
            const localId = post.local_id || post.localId || post.id;
            if (!localId) continue;
            const { data: existingPost } = await supabaseAdmin
              .from('posts')
              .select('id')
              .eq('local_id', localId)
              .eq('teamid', teamId)
              .maybeSingle();

            if (!existingPost) {
              const { error: postError } = await supabaseAdmin
                .from('posts')
                .insert({
                  teamid: teamId,
                  createdby: userId,
                  title: post.title,
                  content: post.content,
                  local_id: localId
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
    return jsonError(error);
  }
}
