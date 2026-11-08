import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from './supabaseAdmin';

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function requireUserId(): Promise<string> {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.googleId || session?.user?.email;
  if (!userId) throw new HttpError(401, 'Unauthorized');
  return String(userId);
}

export async function requireTeamAccess(teamId: string, userId?: string): Promise<{ userId: string }> {
  if (!teamId) throw new HttpError(400, 'Team ID is required');
  const uid = userId ?? (await requireUserId());
  const supabase = getSupabaseAdmin();

  const { data: member } = await supabase
    .from('team_members')
    .select('id')
    .eq('teamid', teamId)
    .eq('userid', uid)
    .maybeSingle();
  if (member) return { userId: uid };

  const { data: owned } = await supabase
    .from('teams')
    .select('id')
    .eq('id', teamId)
    .eq('ownerid', uid)
    .maybeSingle();
  if (!owned) throw new HttpError(403, 'Access denied');
  return { userId: uid };
}

export function jsonError(error: unknown) {
  if (error instanceof HttpError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error(error);
  return Response.json({ error: 'Internal server error' }, { status: 500 });
}
