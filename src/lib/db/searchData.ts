import { finiteCoord, parseCoord, parsePoints, stringifyJson, type Coord } from './parse';

export type SearchTrack = {
  id: string;
  points: Coord[];
  createdAt: string;
  shotPairId: string;
  mode: string;
  name: string;
  color: string;
};

export type SearchFind = {
  id: string;
  position: Coord;
  createdAt: string;
  shotPairId: string;
  mode: string;
  name: string;
  color: string;
};

export type SearchObservation = {
  id: string;
  position: Coord;
  createdAt: string;
  shotPairId: string;
  mode: string;
  name: string;
  color: string;
};

type Row = Record<string, unknown>;

function rowLocalId(row: Row, prefix: string): string | null {
  const localId = row.local_id != null && String(row.local_id).trim() ? String(row.local_id) : '';
  if (localId) return localId;
  if (row.id != null) return `${prefix}_${row.id}`;
  return null;
}

function rowCreatedAt(row: Row): string {
  return String(row.created_at || new Date().toISOString());
}

function rowShotPairId(row: Row, fallback = 'unknown'): string {
  const value = row.shot_pair_id ?? row.shotpairid;
  if (value == null || value === '') return fallback;
  return String(value);
}

export function rowToTrack(row: Row): SearchTrack | null {
  const id = rowLocalId(row, 'track');
  if (!id) return null;
  return {
    id,
    name: String(row.name || 'Spor'),
    color: String(row.color || '#EAB308'),
    shotPairId: rowShotPairId(row),
    points: parsePoints(row.points),
    createdAt: rowCreatedAt(row),
    mode: String(row.mode || 'søk'),
  };
}

export function rowToFind(row: Row): SearchFind | null {
  const id = rowLocalId(row, 'find');
  const position = parseCoord(row.position);
  if (!id || !position) return null;
  return {
    id,
    name: String(row.name || 'Funn'),
    color: String(row.color || '#10b981'),
    position,
    shotPairId: rowShotPairId(row),
    createdAt: rowCreatedAt(row),
    mode: String(row.mode || 'søk'),
  };
}

export function rowToObservation(row: Row): SearchObservation | null {
  const id = rowLocalId(row, 'observation');
  const fromPosition = parseCoord(row.position);
  const fromLatLng = finiteCoord(Number(row.lat), Number(row.lng));
  const position = fromPosition || fromLatLng;
  if (!id || !position) return null;
  return {
    id,
    name: String(row.name || 'Observasjon'),
    color: String(row.color || '#F59E0B'),
    position,
    shotPairId: rowShotPairId(row, 'free'),
    createdAt: rowCreatedAt(row),
    mode: String(row.mode || 'søk'),
  };
}

export function mapRows<T>(rows: Row[] | null | undefined, map: (row: Row) => T | null): T[] {
  return (rows || []).map(map).filter((row): row is T => Boolean(row));
}

export function serializeTrackPoints(points: Coord[]): string {
  return stringifyJson(points);
}

export { finiteCoord, parseCoord, type Coord } from './parse';
