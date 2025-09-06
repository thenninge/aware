import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';

// Create admin Supabase client with service role key
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - Get invitation details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const invitationId = params.id;

    const { data: invitation, error } = await supabaseAdmin
      .from('team_invitations')
      .select(`
        *,
        teams (
          name
        )
      `)
      .eq('id', invitationId)
      .single();

    if (error || !invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    return NextResponse.json(invitation);
  } catch (error: any) {
    console.error('Error in GET /api/invitations/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Accept invitation
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    const userId = session?.user?.googleId || session?.user?.email;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const invitationId = params.id;

    // Get invitation details
    const { data: invitation, error: inviteError } = await supabaseAdmin
      .from('team_invitations')
      .select('*')
      .eq('id', invitationId)
      .single();

    if (inviteError || !invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    if (invitation.status !== 'pending') {
      return NextResponse.json({ error: 'Invitation already processed' }, { status: 400 });
    }

    // Check if user is already a member
    const { data: existingMember, error: memberError } = await supabaseAdmin
      .from('team_members')
      .select('*')
      .eq('teamid', invitation.teamid)
      .eq('userid', userId)
      .single();

    if (existingMember) {
      // User is already a member, just update invitation status
      await supabaseAdmin
        .from('team_invitations')
        .update({ status: 'accepted' })
        .eq('id', invitationId);
      
      return NextResponse.json({ 
        success: true, 
        message: 'Already a member of this team' 
      });
    }

    // Add user to team
    const { error: addMemberError } = await supabaseAdmin
      .from('team_members')
      .insert({
        teamid: invitation.teamid,
        userid: userId,
        role: 'member'
      });

    if (addMemberError) {
      console.error('Error adding member to team:', addMemberError);
      return NextResponse.json({ error: addMemberError.message }, { status: 500 });
    }

    // Update invitation status
    const { error: updateError } = await supabaseAdmin
      .from('team_invitations')
      .update({ status: 'accepted' })
      .eq('id', invitationId);

    if (updateError) {
      console.error('Error updating invitation status:', updateError);
      // Don't fail the request, member was already added
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Successfully joined the team' 
    });
  } catch (error: any) {
    console.error('Error in POST /api/invitations/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
