import type { SearchFind, SearchObservation, SearchTrack } from './searchData';

const CACHE_KEY = 'aware_search_cache_v1';

export type SearchKind = 'tracks' | 'finds' | 'observations';
type PendingOp = 'upsert' | 'delete';

type Pending = Record<SearchKind, Record<string, PendingOp>>;
type TeamCache = {
  tracks: Record<string, SearchTrack>;
  finds: Record<string, SearchFind>;
  observations: Record<string, SearchObservation>;
  pending: Pending;
};

function emptyPending(): Pending {
  return { tracks: {}, finds: {}, observations: {} };
}

function emptyTeam(): TeamCache {
  return { tracks: {}, finds: {}, observations: {}, pending: emptyPending() };
}

function readAll(): Record<string, TeamCache> {
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

function writeAll(all: Record<string, TeamCache>) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(all));
  } catch {}
}

function teamKey(teamId?: string | null) {
  return teamId || '_local';
}

function readLegacyMap<T>(key: string): Record<string, T> {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || '{}');
    return raw && typeof raw === 'object' ? raw as Record<string, T> : {};
  } catch {
    return {};
  }
}

function readTeam(teamId?: string | null): TeamCache {
  const all = readAll();
  const current = all[teamKey(teamId)];
  const cache: TeamCache = current
    ? {
        tracks: current.tracks || {},
        finds: current.finds || {},
        observations: current.observations || {},
        pending: {
          tracks: current.pending?.tracks || {},
          finds: current.pending?.finds || {},
          observations: current.pending?.observations || {},
        },
      }
    : emptyTeam();
  if (!current && typeof window !== 'undefined') {
    cache.tracks = readLegacyMap('searchTracks');
    cache.finds = readLegacyMap('searchFinds');
    cache.observations = readLegacyMap('searchObservations');
    if (Object.keys(cache.tracks).length || Object.keys(cache.finds).length || Object.keys(cache.observations).length) {
      writeTeam(teamId, cache);
    }
  }
  return cache;
}

function writeTeam(teamId: string | null | undefined, cache: TeamCache) {
  const all = readAll();
  all[teamKey(teamId)] = cache;
  writeAll(all);
}

export function listCachedTracks(teamId?: string | null): SearchTrack[] {
  return Object.values(readTeam(teamId).tracks);
}

export function listCachedFinds(teamId?: string | null): SearchFind[] {
  return Object.values(readTeam(teamId).finds);
}

export function listCachedObservations(teamId?: string | null): SearchObservation[] {
  return Object.values(readTeam(teamId).observations);
}

export function putCachedTrack(teamId: string | null | undefined, track: SearchTrack) {
  const cache = readTeam(teamId);
  cache.tracks[track.id] = track;
  cache.pending.tracks[track.id] = 'upsert';
  writeTeam(teamId, cache);
}

export function putCachedFind(teamId: string | null | undefined, find: SearchFind) {
  const cache = readTeam(teamId);
  cache.finds[find.id] = find;
  cache.pending.finds[find.id] = 'upsert';
  writeTeam(teamId, cache);
}

export function putCachedObservation(teamId: string | null | undefined, observation: SearchObservation) {
  const cache = readTeam(teamId);
  cache.observations[observation.id] = observation;
  cache.pending.observations[observation.id] = 'upsert';
  writeTeam(teamId, cache);
}

export function removeCachedItem(teamId: string | null | undefined, kind: SearchKind, id: string) {
  const cache = readTeam(teamId);
  delete cache[kind][id];
  cache.pending[kind][id] = 'delete';
  writeTeam(teamId, cache);
}

export function markSynced(teamId: string | null | undefined, kind: SearchKind, id: string) {
  const cache = readTeam(teamId);
  delete cache.pending[kind][id];
  writeTeam(teamId, cache);
}

export function pendingEntries(teamId: string | null | undefined) {
  return readTeam(teamId).pending;
}

export function getCachedTrack(teamId: string | null | undefined, id: string): SearchTrack | undefined {
  return readTeam(teamId).tracks[id];
}

export function getCachedFind(teamId: string | null | undefined, id: string): SearchFind | undefined {
  return readTeam(teamId).finds[id];
}

export function getCachedObservation(teamId: string | null | undefined, id: string): SearchObservation | undefined {
  return readTeam(teamId).observations[id];
}

export function mergeServerSearchData(
  teamId: string | null | undefined,
  server: { tracks: SearchTrack[]; finds: SearchFind[]; observations: SearchObservation[] }
) {
  const cache = readTeam(teamId);
  const merge = <T extends { id: string }>(
    kind: SearchKind,
    serverItems: T[],
    localItems: Record<string, T>
  ): T[] => {
    const merged = new Map<string, T>();
    for (const item of serverItems) {
      if (cache.pending[kind][item.id] === 'delete') continue;
      merged.set(item.id, item);
    }
    for (const [id, op] of Object.entries(cache.pending[kind])) {
      if (op === 'upsert' && localItems[id]) merged.set(id, localItems[id]);
    }
    return Array.from(merged.values());
  };

  const tracks = merge('tracks', server.tracks, cache.tracks);
  const finds = merge('finds', server.finds, cache.finds);
  const observations = merge('observations', server.observations, cache.observations);

  cache.tracks = Object.fromEntries(tracks.map((track) => [track.id, track]));
  cache.finds = Object.fromEntries(finds.map((find) => [find.id, find]));
  cache.observations = Object.fromEntries(observations.map((obs) => [obs.id, obs]));
  writeTeam(teamId, cache);

  return { tracks, finds, observations };
}
