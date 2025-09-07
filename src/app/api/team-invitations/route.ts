import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import nodemailer from 'nodemailer';

// Create admin Supabase client with service role key
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Email configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Send invitation email
async function sendInvitationEmail(email: string, teamId: string, invitationId: string) {
  const inviteLink = `${process.env.NEXTAUTH_URL || process.env.VERCEL_URL || 'http://localhost:3000'}/invite/${invitationId}`;
  
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Invitation to join team in Aware',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">You're invited to join a team!</h2>
        <p>You have been invited to join a team in the Aware application.</p>
        <p>Click the link below to accept the invitation:</p>
        <a href="${inviteLink}" style="display: inline-block; background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">
          Accept Invitation
        </a>
        <p style="color: #666; font-size: 14px;">
          If the button doesn't work, copy and paste this link into your browser:<br>
          <a href="${inviteLink}">${inviteLink}</a>
        </p>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
}

// POST - Send team invitation
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    const userId = session?.user?.googleId || session?.user?.email;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { teamId, email } = await request.json();

    if (!teamId || !email) {
      return NextResponse.json({ error: 'Team ID and email are required' }, { status: 400 });
    }

    // Check if user is a member of the team
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('team_members')
      .select('*')
      .eq('teamid', teamId)
      .eq('userid', userId)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json({ error: 'You are not a member of this team' }, { status: 403 });
    }

    // Check if invitation already exists
    const { data: existingInvitation, error: checkError } = await supabaseAdmin
      .from('team_invitations')
      .select('*')
      .eq('teamid', teamId)
      .eq('email', email)
      .eq('status', 'pending')
      .single();

    if (existingInvitation) {
      return NextResponse.json({ error: 'Invitation already sent to this email' }, { status: 400 });
    }

    // Create invitation
    const { data: invitation, error: inviteError } = await supabaseAdmin
      .from('team_invitations')
      .insert({
        teamid: teamId,
        email: email,
        invitedby: userId,
        status: 'pending'
      })
      .select()
      .single();

    if (inviteError) {
      console.error('Error creating invitation:', inviteError);
      return NextResponse.json({ error: inviteError.message }, { status: 500 });
    }

    // Send email invitation
    try {
      await sendInvitationEmail(email, teamId, invitation.id);
    } catch (emailError) {
      console.error('Error sending email:', emailError);
      // Don't fail the request if email fails, just log it
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Invitation sent successfully',
      invitation 
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error in POST /api/team-invitations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET - Get team invitations
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    const userId = session?.user?.googleId || session?.user?.email;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');

    if (!teamId) {
      return NextResponse.json({ error: 'Team ID is required' }, { status: 400 });
    }

    // Check if user is a member of the team
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('team_members')
      .select('*')
      .eq('teamid', teamId)
      .eq('userid', userId)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json({ error: 'You are not a member of this team' }, { status: 403 });
    }

    // Get invitations for the team
    const { data: invitations, error: invitationsError } = await supabaseAdmin
      .from('team_invitations')
      .select('*')
      .eq('teamid', teamId)
      .order('created_at', { ascending: false });

    if (invitationsError) {
      console.error('Error fetching invitations:', invitationsError);
      return NextResponse.json({ error: invitationsError.message }, { status: 500 });
    }

    return NextResponse.json(invitations);
  } catch (error: any) {
    console.error('Error in GET /api/team-invitations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
