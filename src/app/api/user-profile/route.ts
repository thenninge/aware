import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - Hent brukerprofil
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    const userId = session?.user?.googleId || session?.user?.email;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Hent brukerprofil fra users-tabellen
    const { data: userProfile, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('google_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found
      console.error('Error fetching user profile:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(userProfile || null);
  } catch (error: any) {
    console.error('Error in GET /api/user-profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Oppdater brukerprofil
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    const userId = session?.user?.googleId || session?.user?.email;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { nickname, display_name } = body;

    // Sjekk om brukeren allerede eksisterer
    const { data: existingUser, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('google_id', userId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error checking existing user:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (existingUser) {
      // Oppdater eksisterende bruker
      const { data: updatedUser, error: updateError } = await supabaseAdmin
        .from('users')
        .update({
          nickname: nickname || existingUser.nickname,
          display_name: display_name || existingUser.display_name,
          updated_at: new Date().toISOString()
        })
        .eq('google_id', userId)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating user profile:', updateError);
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      return NextResponse.json(updatedUser);
    } else {
      // Opprett ny bruker
      const { data: newUser, error: insertError } = await supabaseAdmin
        .from('users')
        .insert({
          google_id: userId,
          email: session.user?.email || '',
          display_name: display_name || session.user?.name || session.user?.email || '',
          nickname: nickname || null
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating user profile:', insertError);
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }

      return NextResponse.json(newUser);
    }
  } catch (error: any) {
    console.error('Error in PUT /api/user-profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
