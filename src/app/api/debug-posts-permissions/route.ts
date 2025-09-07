import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    const userId = session?.user?.googleId || session?.user?.email;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Try to insert a test post with the authenticated user
    const { data: testPost, error: testError } = await supabaseAdmin
      .from('posts')
      .insert({
        title: 'Test Post',
        content: 'Test content',
        createdby: userId
      })
      .select()
      .single();

    // Try to get posts
    const { data: posts, error: postsError } = await supabaseAdmin
      .from('posts')
      .select('*');

    return NextResponse.json({
      userId: userId,
      testPost: testPost || null,
      testError: testError?.message || null,
      posts: posts || [],
      postsError: postsError?.message || null
    });
  } catch (error: any) {
    console.error('Error in debug-posts-permissions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
