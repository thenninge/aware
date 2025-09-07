import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../teams/route';

export async function GET(request: NextRequest) {
  try {
    // Check if tracks table exists and what columns it has
    const { data: tracks, error: tracksError } = await supabaseAdmin
      .from('tracks')
      .select('*')
      .limit(1);

    // Try to insert a test track with createdby
    const { data: testTrack, error: testError } = await supabaseAdmin
      .from('tracks')
      .insert({
        name: 'Test Track',
        createdby: 'test-user'
      })
      .select()
      .single();

    return NextResponse.json({
      tracks: tracks || [],
      tracksError: tracksError?.message || null,
      testTrack: testTrack || null,
      testError: testError?.message || null
    });
  } catch (error: any) {
    console.error('Error in debug-tracks-table:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}