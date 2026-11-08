export type Coord = { lat: number; lng: number };

export type ShotPlace = {
  id: number;
  pair_local_id?: string;
  name?: string;
  current?: Coord;
  target?: Coord;
  category: 'Skyteplass' | 'Treffpunkt';
  created_at?: string;
  linked: boolean;
};

export type PostRow = {
  id: number;
  title?: string;
  content?: string | null;
  local_id?: string | null;
  created_at?: string;
  teamid?: string;
};

function finiteCoord(lat?: number, lng?: number): Coord | undefined {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  return { lat: lat as number, lng: lng as number };
}

export function parsePostContent(content: string | null | undefined): {
  category: string;
  name?: string;
  current?: Coord;
  target?: Coord;
} {
  const text = content || '';
  const latMatch = text.match(/Lat:\s*([\d.-]+)/);
  const lngMatch = text.match(/Lng:\s*([\d.-]+)/);
  const targetMatch = text.match(/Target:\s*([\d.-]+),\s*([\d.-]+)/);
  const categoryMatch = text.match(/Category:\s*(\w+)/);
  const nameMatch = text.match(/Name:\s*([^,]+)(?:,|$)/);
  return {
    category: categoryMatch?.[1] || 'general',
    name: nameMatch?.[1]?.trim(),
    current: finiteCoord(
      latMatch ? parseFloat(latMatch[1]) : undefined,
      lngMatch ? parseFloat(lngMatch[1]) : undefined
    ),
    target: finiteCoord(
      targetMatch ? parseFloat(targetMatch[1]) : undefined,
      targetMatch ? parseFloat(targetMatch[2]) : undefined
    ),
  };
}

export function serializeSkyteplass(coord: Coord, name: string): string {
  return `Lat: ${coord.lat}, Lng: ${coord.lng}, Category: Skyteplass, Name: ${name}`;
}

export function serializeTreffpunkt(coord: Coord, name: string): string {
  return `Target: ${coord.lat}, ${coord.lng}, Category: Treffpunkt, Name: ${name}`;
}

export function isShotPlaceRow(post: { content?: string | null; title?: string | null }): boolean {
  const category = parsePostContent(post.content).category;
  const title = post.title || '';
  return category === 'Skyteplass' || category === 'Treffpunkt' || title === 'Skyteplass' || title === 'Treffpunkt';
}

export function pairPosts(posts: PostRow[]): ShotPlace[] {
  const parsed = posts.map((post) => {
    const fields = parsePostContent(post.content);
    return {
      ...fields,
      id: post.id,
      created_at: post.created_at,
      local_id: post.local_id || null,
    };
  });

  const groups = new Map<string, { skyteplass?: (typeof parsed)[number]; treffpunkt?: (typeof parsed)[number] }>();
  for (const p of parsed) {
    if (!p.local_id) continue;
    if (!groups.has(p.local_id)) groups.set(p.local_id, {});
    const g = groups.get(p.local_id)!;
    if (p.category === 'Skyteplass' && p.current) g.skyteplass = p;
    if (p.category === 'Treffpunkt' && p.target) g.treffpunkt = p;
  }

  const fromLocalId: ShotPlace[] = [];
  groups.forEach((g, key) => {
    const current = g.skyteplass?.current;
    const target = g.treffpunkt?.target;
    if (!current && !target) return;
    fromLocalId.push({
      current,
      target,
      category: target ? 'Treffpunkt' : 'Skyteplass',
      id: (g.treffpunkt?.id ?? g.skyteplass?.id ?? 0) as number,
      created_at: g.treffpunkt?.created_at || g.skyteplass?.created_at,
      name: g.treffpunkt?.name || g.skyteplass?.name,
      pair_local_id: key,
      linked: true,
    });
  });

  const skyteplasser = parsed
    .filter((p) => p.category === 'Skyteplass' && p.current && !p.local_id)
    .sort((a, b) => (a.created_at || '') < (b.created_at || '') ? -1 : 1);
  const treffpunkter = parsed
    .filter((p) => p.category === 'Treffpunkt' && p.target && !p.local_id)
    .sort((a, b) => (a.created_at || '') < (b.created_at || '') ? -1 : 1);

  const fallback: ShotPlace[] = [];
  for (const skyteplass of skyteplasser) {
    const idx = treffpunkter.findIndex(
      (t) => !skyteplass.created_at || !t.created_at || t.created_at >= skyteplass.created_at
    );
    const treffpunkt = idx >= 0 ? treffpunkter.splice(idx, 1)[0] : undefined;
    fallback.push({
      current: skyteplass.current,
      target: treffpunkt?.target,
      category: treffpunkt?.target ? 'Treffpunkt' : 'Skyteplass',
      id: (treffpunkt?.id ?? skyteplass.id) as number,
      created_at: skyteplass.created_at || treffpunkt?.created_at,
      name: skyteplass.name || treffpunkt?.name,
      linked: false,
    });
  }

  const leftovers: ShotPlace[] = treffpunkter.map((t) => ({
    target: t.target,
    category: 'Treffpunkt',
    id: t.id,
    created_at: t.created_at,
    name: t.name,
    linked: false,
  }));

  const combined = [...fromLocalId, ...fallback, ...leftovers];
  const seen = new Set<string>();
  const unique: ShotPlace[] = [];
  for (const p of combined) {
    const key = `${p.id}|${p.current ? `${p.current.lat},${p.current.lng}` : ''}|${p.target ? `${p.target.lat},${p.target.lng}` : ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(p);
  }
  return unique;
}
