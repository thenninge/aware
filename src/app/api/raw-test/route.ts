import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: NextRequest) {
  try {
    // Raw SQL test to see what actually exists
    const { data, error } = await supabase
      .rpc('exec_sql', { sql: 'SELECT column_name FROM information_schema.columns WHERE table_name = \'teams\' AND table_schema = \'public\'' });

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
      message: 'Teams table columns'
    });
  } catch (error) {
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
