import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    return NextResponse.json({
      hasSession: !!session,
      session: session ? {
        user: session.user,
        googleId: session.user?.googleId,
        email: session.user?.email
      } : null,
      message: 'Checking authentication status'
    });
  } catch (error: any) {
    console.error('Error in debug-auth-issue:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
