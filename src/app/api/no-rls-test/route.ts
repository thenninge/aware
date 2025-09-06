import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: NextRequest) {
  try {
    // Test without RLS by using service role key
    const serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await serviceSupabase
      .from('teams')
      .select('*')
      .limit(1);

    if (error) {
      return NextResponse.json({ 
        error: error.message,
        code: error.code,
        details: error.details 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      data: data,
      message: 'Teams table structure (no RLS)'
    });
  } catch (error) {
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
