import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db/supabaseAdmin';
import { HttpError, jsonError, requireTeamAccess } from '@/lib/db/access';
import { mapRows, rowLocalId, rowToFind, rowToObservation, rowToTrack } from '@/lib/db/searchData';

export const dynamic = 'force-dynamic';

type Row = Record<string, unknown>;

/**
 * GET /api/team-data/changes?teamId=…&since=…
 *
 * Gir bare det som er endret eller slettet siden `since` (tidsstempel fra forrige svar).
 * Svaret er lite når ingenting har skjedd (noen hundre byte), i stedet for hele datasettet.
 *
 * `excludeTracks`: kommaseparerte local_id-er for spor klienten selv holder på med.
 *
 * Uten `since` gis bare en `cursor` å starte fra (brukes rett før en full henting).
 *
 * `cursor` er det nyeste `updated_at` i databasen (databasens egen klokke), så telefonens
 * klokke spiller ingen rolle. Neste kall sender den tilbake som `since`.
 */
export async function GET(request: NextRequest) {
  try {
    const teamId = request.nextUrl.searchParams.get('teamId');
    const since = request.nextUrl.searchParams.get('since');
    // Spor som klienten selv holder på med (live-spor): ikke send dem tilbake
    const excludeTracks = new Set(
      (request.nextUrl.searchParams.get('excludeTracks') || '').split(',').map((s) => s.trim()).filter(Boolean)
    );
    if (!teamId) throw new HttpError(400, 'Team ID is required');
    if (since && Number.isNaN(Date.parse(since))) throw new HttpError(400, 'Invalid since');
    await requireTeamAccess(teamId);

    const supabase = getSupabaseAdmin();
    const tables = ['tracks', 'finds', 'observations', 'posts'] as const;

    if (!since) {
      const latest = await Promise.all(
        tables.map(async (table) => {
          const { data, error } = await supabase
            .from(table)
            .select('updated_at')
            .eq('teamid', teamId)
            .order('updated_at', { ascending: false })
            .limit(1);
          if (error) throw new Error(error.message);
          return (data?.[0]?.updated_at as string | undefined) ?? null;
        })
      );
      return NextResponse.json({ cursor: maxTime(latest) ?? new Date(0).toISOString() });
    }

    const [tracks, finds, observations, posts] = await Promise.all(
      tables.map(async (table) => {
        // Spor kan ha mange punkter; hent dem bare for rader som faktisk er endret
        const { data, error } = await supabase
          .from(table)
          .select(table === 'posts' ? 'id, updated_at' : '*')
          .eq('teamid', teamId)
          .gt('updated_at', since)
          .order('updated_at', { ascending: true });
        if (error) throw new Error(error.message);
        return (data || []) as unknown as Row[];
      })
    );

    const split = <T,>(rows: Row[], prefix: string, map: (row: Row) => T | null) => ({
      changed: mapRows(
        rows.filter((r) => !r.deleted_at),
        map
      ),
      deleted: rows
        .filter((r) => r.deleted_at)
        .map((r) => rowLocalId(r, prefix))
        .filter((id): id is string => Boolean(id)),
    });

    const all = [...tracks, ...finds, ...observations, ...posts];
    return NextResponse.json({
      cursor: maxTime(all.map((r) => (r.updated_at as string | undefined) ?? null)) ?? since,
      tracks: split(
        tracks.filter((r) => !excludeTracks.has(String(r.local_id ?? ''))),
        'track',
        rowToTrack
      ),
      finds: split(finds, 'find', rowToFind),
      observations: split(observations, 'observation', rowToObservation),
      // Skuddpar består av to rader som må pares; ved endring henter appen hele (lille) listen på nytt
      shotPlacesChanged: posts.length > 0,
    });
  } catch (error) {
    return jsonError(error);
  }
}

function maxTime(values: Array<string | null>): string | null {
  let best: string | null = null;
  let bestMs = -Infinity;
  for (const v of values) {
    if (!v) continue;
    const ms = Date.parse(v);
    if (ms > bestMs) {
      bestMs = ms;
      best = v;
    }
  }
  return best;
}
