export type Coord = { lat: number; lng: number; heading?: number };

export function finiteCoord(lat?: number, lng?: number, heading?: number): Coord | undefined {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  const coord: Coord = { lat: lat as number, lng: lng as number };
  if (Number.isFinite(heading)) coord.heading = heading;
  return coord;
}

export function parseJsonValue(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const text = value.trim();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return value;
  }
}

export function parseCoord(value: unknown): Coord | undefined {
  const parsed = parseJsonValue(value);
  if (!parsed || typeof parsed !== 'object') return undefined;
  const row = parsed as { lat?: number; lng?: number; heading?: number };
  return finiteCoord(
    typeof row.lat === 'number' ? row.lat : Number(row.lat),
    typeof row.lng === 'number' ? row.lng : Number(row.lng),
    typeof row.heading === 'number' ? row.heading : Number(row.heading)
  );
}

export function parsePoints(value: unknown): Coord[] {
  const parsed = parseJsonValue(value);
  if (!Array.isArray(parsed)) return [];
  return parsed.map((point) => parseCoord(point)).filter((point): point is Coord => Boolean(point));
}

export function stringifyJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}
