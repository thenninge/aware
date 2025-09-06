import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../teams/route';

export async function GET(request: NextRequest) {
  try {
    // Try to get all data from posts table to see what columns exist
    const { data: allData, error: allError } = await supabaseAdmin
      .from('posts')
      .select('*');

    // Try to get just the id column
    const { data: idData, error: idError } = await supabaseAdmin
      .from('posts')
      .select('id');

    return NextResponse.json({
      allData: allData || [],
      allError: allError?.message || null,
      idData: idData || [],
      idError: idError?.message || null,
      message: 'Checking what columns actually exist in posts table'
    });
  } catch (error: any) {
    console.error('Error in debug-posts-table:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}