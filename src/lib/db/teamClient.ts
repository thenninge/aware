import type { SearchFind, SearchObservation, SearchTrack } from './searchData';
import type { Coord } from './parse';
import {
  getCachedFind,
  getCachedObservation,
  getCachedTrack,
  markSynced,
  pendingEntries,
} from './searchCache';

async function send<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(body.error || response.statusText);
  }
  return response.json();
}

export async function fetchTeamTracks(teamId: string): Promise<SearchTrack[]> {
  return send(`/api/team-data/tracks?teamId=${encodeURIComponent(teamId)}`);
}

export async function fetchTeamFinds(teamId: string): Promise<SearchFind[]> {
  return send(`/api/team-data/finds?teamId=${encodeURIComponent(teamId)}`);
}

export async function fetchTeamObservations(teamId: string): Promise<SearchObservation[]> {
  return send(`/api/team-data/observations?teamId=${encodeURIComponent(teamId)}`);
}

export async function fetchTeamSearchData(teamId: string) {
  const [tracks, finds, observations] = await Promise.all([
    fetchTeamTracks(teamId),
    fetchTeamFinds(teamId),
    fetchTeamObservations(teamId),
  ]);
  return { tracks, finds, observations };
}

export async function upsertTeamTrack(
  teamId: string,
  track: {
    localId: string;
    name?: string;
    color?: string;
    points?: Coord[];
    shotPairId?: string;
  },
  method: 'POST' | 'PATCH' = 'POST'
): Promise<SearchTrack> {
  return send('/api/team-data/tracks', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ teamId, ...track }),
  });
}

export async function deleteTeamItem(kind: 'tracks' | 'finds' | 'observations', teamId: string, localId: string) {
  return send(`/api/team-data/${kind}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ teamId, localId }),
  });
}

export async function saveTeamFind(teamId: string, find: SearchFind): Promise<SearchFind> {
  return send('/api/team-data/finds', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      teamId,
      localId: find.id,
      name: find.name,
      position: find.position,
      color: find.color,
      shotPairId: find.shotPairId,
      mode: find.mode,
    }),
  });
}

export async function flushPendingSearchData(teamId: string) {
  const pending = pendingEntries(teamId);

  for (const [id, op] of Object.entries(pending.tracks)) {
    try {
      if (op === 'delete') {
        await deleteTeamItem('tracks', teamId, id);
      } else {
        const track = getCachedTrack(teamId, id);
        if (!track) {
          markSynced(teamId, 'tracks', id);
          continue;
        }
        await upsertTeamTrack(teamId, {
          localId: track.id,
          name: track.name,
          color: track.color,
          points: track.points,
          shotPairId: track.shotPairId,
        }, 'PATCH');
      }
      markSynced(teamId, 'tracks', id);
    } catch {
      // Still offline or server error; keep pending.
    }
  }

  for (const [id, op] of Object.entries(pending.finds)) {
    try {
      if (op === 'delete') {
        await deleteTeamItem('finds', teamId, id);
      } else {
        const find = getCachedFind(teamId, id);
        if (!find) {
          markSynced(teamId, 'finds', id);
          continue;
        }
        await saveTeamFind(teamId, find);
      }
      markSynced(teamId, 'finds', id);
    } catch {}
  }

  for (const [id, op] of Object.entries(pending.observations)) {
    try {
      if (op === 'delete') {
        await deleteTeamItem('observations', teamId, id);
      } else {
        const observation = getCachedObservation(teamId, id);
        if (!observation) {
          markSynced(teamId, 'observations', id);
          continue;
        }
        await saveTeamObservation(teamId, observation);
      }
      markSynced(teamId, 'observations', id);
    } catch {}
  }
}

export async function saveTeamObservation(teamId: string, observation: SearchObservation): Promise<SearchObservation> {
  return send('/api/team-data/observations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      teamId,
      localId: observation.id,
      name: observation.name,
      lat: observation.position.lat,
      lng: observation.position.lng,
      position: observation.position,
      color: observation.color,
      category: 'observation',
    }),
  });
}
