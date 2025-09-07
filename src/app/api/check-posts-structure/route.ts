import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    // Try to insert with title and createdby columns
    const { data: testPost, error: testError } = await supabaseAdmin
      .from('posts')
      .insert({
        title: 'Test Post',
        createdby: 'test-user'
      })
      .select()
      .single();

    // Try to get all data to see what columns exist
    const { data: allPosts, error: allError } = await supabaseAdmin
      .from('posts')
      .select('*');

    return NextResponse.json({
      testPost: testPost || null,
      testError: testError?.message || null,
      allPosts: allPosts || [],
      allError: allError?.message || null
    });
  } catch (error: any) {
    console.error('Error in check-posts-structure:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}