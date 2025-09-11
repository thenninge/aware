import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../teams/route';

export async function POST(request: NextRequest) {
  try {
    // Try to insert a simple post with minimal data
    const { data: newPost, error: createError } = await supabaseAdmin
      .from('posts')
      .insert({
        name: 'Test Post',
        current_lat: 60.0,
        current_lng: 10.0
      })
      .select()
      .single();

    return NextResponse.json({
      success: true,
      newPost: newPost || null,
      error: createError?.message || null
    });
  } catch (error: any) {
    console.error('Error in test-posts-insert:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
