import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { supabaseAdmin } from '../teams/route';

// GET - Hent alle posts
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    const userId = session?.user?.googleId || session?.user?.email;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all posts (for now, we'll filter by team later)
    const { data: posts, error: postsError } = await supabaseAdmin
      .from('posts')
      .select('*')
      .order('created_at', { ascending: true });

    if (postsError) {
      console.error('Error fetching posts:', postsError);
      return NextResponse.json({ error: postsError.message }, { status: 500 });
    }

    return NextResponse.json(posts || []);
  } catch (error: any) {
    console.error('Error in GET /api/posts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Opprett ny post
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    const userId = session?.user?.googleId || session?.user?.email;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { title, content, teamId, localId } = body;

    // Create new post
    const { data: newPost, error: createError } = await supabaseAdmin
      .from('posts')
      .insert({
        title: title || 'Unnamed Post',
        content: content || '',
        createdby: userId,
        teamid: teamId || null,
        local_id: localId
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating post:', createError);
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    return NextResponse.json(newPost);
  } catch (error: any) {
    console.error('Error in POST /api/posts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Slett posts
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    const userId = session?.user?.googleId || session?.user?.email;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const ids = searchParams.get('ids');

    if (!ids) {
      return NextResponse.json({ error: 'Post IDs are required' }, { status: 400 });
    }

    const postIds = ids.split(',');

    // Delete posts
    const { error: deleteError } = await supabaseAdmin
      .from('posts')
      .delete()
      .in('id', postIds);

    if (deleteError) {
      console.error('Error deleting posts:', deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in DELETE /api/posts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
