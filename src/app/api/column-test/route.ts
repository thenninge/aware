import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: NextRequest) {
  try {
    // Test different column names
    const tests = [
      { name: 'ownerId', query: () => supabase.from('teams').select('ownerId').limit(1) },
      { name: 'ownerid', query: () => supabase.from('teams').select('ownerid').limit(1) },
      { name: 'owner_id', query: () => supabase.from('teams').select('owner_id').limit(1) }
    ];

    const results = [];
    for (const test of tests) {
      try {
        const { data, error } = await test.query();
        results.push({
          column: test.name,
          success: !error,
          error: error?.message || null
        });
      } catch (e) {
        results.push({
          column: test.name,
          success: false,
          error: e instanceof Error ? e.message : 'Unknown error'
        });
      }
    }

    return NextResponse.json({ 
      success: true, 
      results: results,
      message: 'Column name tests'
    });
  } catch (error) {
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
